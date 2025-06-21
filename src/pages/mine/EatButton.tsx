import { useState, useEffect, useMemo, useRef } from "react";
import { getContractAddress } from "@/config/contracts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { FOOD_ITEMS, FoodItem } from "@/constants/food";
import { useStaking } from "@/hooks/useStaking";
import { useMealStatuses } from "@/hooks/useMealStatuses";
import { useRoninWallet } from "@/services/wallet/RoninWalletProvider";
import { useExpeditions } from "@/hooks/useExpeditions";
import { ethers } from "ethers";
import Countdown from "react-countdown";
// Import not needed as we're using environment variables directly
// import { getContractAddress } from "@/config/contracts";

// Meal ABI minimal interface for the contract (updated to include all required functions)
const MealABI = [
  "function canEatMeal(uint256 minerId, uint256 mealId) view returns (bool,uint256)",
  "function getMinerMealStatus(uint256 minerId) view returns (uint256,uint256,uint256,uint256,uint256)",
  "function MEAL_COOLDOWN() view returns (uint256)",
  // feedMiner is not used here but kept for compatibility; adjust if contract differs
  "function feedMiner(uint256 minerId, uint256 mealId)",
];

// BatchAction function to handle multiple transactions
class BatchAction {
  actions: Array<[number, bigint, bigint]> = [];

  addAction(action: number, arg1: number | bigint, arg2: number | bigint) {
    this.actions.push([action, BigInt(arg1), BigInt(arg2)]);
  }

  async executeBatch(batchContract: ethers.Contract) {
    if (this.actions.length === 0) return null;
    console.log("Executing batch with actions:", this.actions);
    try {
      return await batchContract.executeBatch(this.actions);
    } catch (error: unknown) {
      console.error("executeBatch error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`executeBatch failed: ${message}`);
    }
  }
}

// Minimal props typing for react-countdown renderer (package ships its own d.ts in node_modules,
// but to avoid installing missing DefinitelyTyped package we create local fallback)
interface CountdownRenderProps {
  minutes: number;
  seconds: number;
  completed: boolean;
}

// React imports are at the top of the file

export default function EatButton() {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [gemBalance, setGemBalance] = useState<string>("0");
  const [loading, setLoading] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [isOGMinerHolder, setIsOGMinerHolder] = useState(false);

  // Get staking state and GEMS service - use stakedMinerCount from useMealStatuses for consistency
  const { stakedMiners, availableMiners } = useStaking();
  const {
    statuses: mealStatuses,
    loading: mealLoading,
    refetch: refetchMealStatuses,
    stakedMinerCount,
  } = useMealStatuses();
  const { anyOnExpedition } = useExpeditions();

  // Ensure we have a normalized list of miner IDs regardless of their original structure
  const minerTokenIds = useMemo<number[]>(() => {
    return ((stakedMiners as any[]) ?? []).map((miner) => {
      if (typeof miner === "object" && miner !== null && "tokenId" in miner) {
        return Number((miner as any).tokenId);
      }
      return Number(miner);
    });
  }, [stakedMiners]);
  const statusMap = useMemo(
    () => Object.fromEntries(mealStatuses.map((s) => [s.id, s])),
    [mealStatuses]
  );
  const [eligibleMeals, setEligibleMeals] = useState<Record<number, boolean>>(
    {}
  );
  // Cache of meal eligibility results to avoid repeated async calls
  const [mealEligibilityCache, setMealEligibilityCache] = useState<
    Record<number, boolean>
  >({});

  // Track fed status of all miners
  const [minerFeedingStatus, setMinerFeedingStatus] = useState<
    Record<number, { mealId: number; endTime: number }>
  >({});

  // Global feeding status check (shared across all meals)
  const [globalFeedingCheck, setGlobalFeedingCheck] = useState<{
    checked: boolean;
    anyFed: boolean;
    lastChecked: number;
  }>({ checked: false, anyFed: false, lastChecked: 0 });

  // This function checks eligibility but also updates the cache
  const canAllEatMeal = async (mealId: number) => {
    try {
      if (!connector || minerTokenIds.length === 0) {
        console.log("No connector or miners available, defaulting to eligible");
        return true;
      }

      console.log(`Checking if all miners can eat meal ${mealId}...`);

      const provider = new ethers.BrowserProvider(connector.provider);
      const signer = await provider.getSigner();

      // Use the same getContractAddress function as useExpeditions for consistency
      const mealContractAddress = getContractAddress("FoodSystemProxy");

      if (!mealContractAddress || !ethers.isAddress(mealContractAddress)) {
        console.error(`Invalid meal contract address: ${mealContractAddress}`);
        return false;
      }

      const contract = new ethers.Contract(
        mealContractAddress,
        MealABI,
        signer
      );
      const now = Math.floor(Date.now() / 1000); // Current time in seconds

      // OPTIMIZATION: Check global feeding status with a longer cache time
      // Only check feeding status if it hasn't been checked recently
      if (
        !globalFeedingCheck.checked ||
        now - globalFeedingCheck.lastChecked > 60
      ) {
        console.log("Performing global feeding status check for all miners...");

        const cooldown = await contract.MEAL_COOLDOWN();
        const minerFeedingStatuses: Record<
          number,
          { mealId: number; endTime: number }
        > = {};
        let anyMinerStillFed = false;

        // Use Promise.all for batch processing all miners at once
        await Promise.all(
          minerTokenIds.map(async (minerId) => {
            try {
              const [
                currentMealId,
                timestamp,
                successRate,
                minReward,
                maxReward,
              ] = await contract.getMinerMealStatus(minerId);

              const currentMealIdNum = Number(currentMealId);

              if (currentMealIdNum !== 0) {
                const cooldownEnd = Number(timestamp) + Number(cooldown);

                // Store the feeding status regardless of whether it's active
                minerFeedingStatuses[minerId] = {
                  mealId: currentMealIdNum,
                  endTime: cooldownEnd,
                };

                // If any miner is still fed, all miners are considered fed (since they're fed as a batch)
                if (now < cooldownEnd) {
                  console.log(
                    `Miner ${minerId} is still fed with meal ${currentMealIdNum} until ${new Date(
                      cooldownEnd * 1000
                    ).toLocaleString()}`
                  );
                  anyMinerStillFed = true;
                }
              }
            } catch (error) {
              console.error(
                `Error checking meal status for miner ${minerId}:`,
                error
              );
            }
          })
        );

        // Update the feeding status state
        setMinerFeedingStatus(minerFeedingStatuses);

        // Update global feeding check status with longer cache duration
        setGlobalFeedingCheck({
          checked: true,
          anyFed: anyMinerStillFed,
          lastChecked: now,
        });

        // OPTIMIZATION: If any miner is fed, ALL meals are ineligible
        // Update all meal eligibility states at once
        if (anyMinerStillFed) {
          console.log("Miners are fed - marking ALL meals as ineligible");
          // Mark all meals as ineligible since miners are already fed
          const mealCount = 15; // Hardcoded assumption, could be retrieved from contract
          const allMealsIneligible: Record<number, boolean> = {};
          for (let i = 1; i <= mealCount; i++) {
            allMealsIneligible[i] = false;
          }
          setMealEligibilityCache(allMealsIneligible);
          setEligibleMeals(allMealsIneligible);
          return false;
        }
      } else if (globalFeedingCheck.anyFed) {
        // Use cached result if checked recently and miners are fed
        console.log(
          "Using cached feeding status - miners are fed, meal ineligible"
        );
        return false;
      }

      // If we got here, no miners are currently fed, so check specific meal eligibility
      console.log(
        "No miners currently fed, checking specific meal eligibility..."
      );

      // Check if this meal's eligibility is already in cache
      if (mealEligibilityCache[mealId] !== undefined) {
        console.log(
          `Using cached eligibility for meal ${mealId}: ${mealEligibilityCache[mealId]}`
        );
        return mealEligibilityCache[mealId];
      }

      // Step 2: Batch check if all miners can eat this specific meal
      let allCanEat = true;
      let maxTimeLeft = 0;

      // Use Promise.all for batch processing
      const canEatResults = await Promise.all(
        minerTokenIds.map(async (minerId) => {
          try {
            const [canEat, timeLeft] = await contract.canEatMeal(
              minerId,
              mealId
            );
            return { minerId, canEat, timeLeft: Number(timeLeft) };
          } catch (error) {
            console.error(
              `Error checking if miner ${minerId} can eat meal ${mealId}:`,
              error
            );
            return { minerId, canEat: false, timeLeft: 0, error };
          }
        })
      );

      // Process results
      for (const result of canEatResults) {
        if (!result.canEat) {
          console.log(
            `Miner ${result.minerId} cannot eat meal ${mealId}, time left: ${result.timeLeft} seconds`
          );
          allCanEat = false;
          if (result.timeLeft > maxTimeLeft) {
            maxTimeLeft = result.timeLeft;
          }
        }
      }

      // Update eligibility cache
      if (!allCanEat) {
        setMealEligibilityCache((prev) => ({ ...prev, [mealId]: false }));
        setEligibleMeals((prev) => ({ ...prev, [mealId]: false }));
        return false;
      }

      // All miners can eat this meal and none are on cooldown
      // Update eligibility cache
      if (allCanEat) {
        setMealEligibilityCache((prev) => ({ ...prev, [mealId]: true }));
        setEligibleMeals((prev) => ({ ...prev, [mealId]: true }));
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking meal eligibility:", error);
      // Fall back to the status map in case of error
      const status = statusMap[mealId];
      return status ? status.canEat : true;
    }
  };
  const { connector } = useRoninWallet();

  // Effect to log feeding status when it changes
  useEffect(() => {
    if (Object.keys(minerFeedingStatus).length > 0) {
      const now = Math.floor(Date.now() / 1000);
      const fedMiners = Object.entries(minerFeedingStatus).filter(
        ([_, status]) => now < status.endTime
      );
      if (fedMiners.length > 0) {
        console.log(`${fedMiners.length} miners are currently fed:`);
        fedMiners.forEach(([minerId, status]) => {
          console.log(
            `Miner ${minerId} is fed with meal ${
              status.mealId
            } until ${new Date(status.endTime * 1000).toLocaleString()}`
          );
        });
      } else {
        console.log("No miners are currently fed.");
      }
    }
  }, [minerFeedingStatus]);

  useEffect(() => {
    try {
      console.log("Checking if user owns first edition miners");

      // Check staked and available miners from staking state
      const allUserMiners = [
        ...(stakedMiners || []),
        ...(availableMiners || []),
      ];

      // Define the OG miner max ID - can be overridden by env variable
      const OG_MINER_MAX_ID = parseInt(
        import.meta.env.VITE_OG_MINER_MAX_ID || "1980"
      );

      // Check if any of user's miners are in the OG miner range
      const hasFirstEdition = allUserMiners.some((id) => {
        // Make sure we handle both number and string IDs
        const minerId = typeof id === "string" ? parseInt(id) : Number(id);
        return minerId <= OG_MINER_MAX_ID;
      });

      if (hasFirstEdition) {
        console.log("Found first edition miner in user miners");
      }

      setIsOGMinerHolder(hasFirstEdition);
      console.log(
        `User ${hasFirstEdition ? "is" : "is not"} an OG miner holder`
      );
    } catch (error) {
      console.error("Error checking first edition ownership:", error);
      setIsOGMinerHolder(false);
    }
  }, [stakedMiners, availableMiners]);

  // Helper to fetch on-chain (pending rewards) GEMS balance
  const updateGemBalance = async () => {
    if (!connector) return;
    try {
      const provider = new ethers.BrowserProvider(connector.provider);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      const stakingContractAddress =
        import.meta.env.VITE_NETWORK_ENV === "mainnet"
          ? import.meta.env.VITE_MAINNET_STAKING_PROXY_ADDRESS
          : import.meta.env.VITE_TESTNET_STAKING_PROXY_ADDRESS;

      const stakingABI = [
        "function getPendingRewards(address) view returns (uint256)",
      ];
      const contract = new ethers.Contract(
        stakingContractAddress,
        stakingABI,
        provider
      );
      const pending = await contract.getPendingRewards(userAddress);
      const formatted = ethers.formatUnits(pending, 18);
      setGemBalance(formatted);
    } catch (err) {
      console.error("Error updating on-chain GEMS balance:", err);
    }
  };

  useEffect(() => {
    updateGemBalance();
  }, [connector]);

  // Add debounce to reduce excessive API calls
  const [lastCheckTime, setLastCheckTime] = useState(0);
  const CHECK_COOLDOWN_MS = 30000; // 30 second cooldown between checks

  // Check the eligibility of all meals on component load with debounce
  useEffect(() => {
    // Store the timeout reference for cleanup
    let timeoutId: number | undefined;

    const checkAllMeals = async () => {
      if (minerTokenIds.length === 0) return;

      // Add debounce to prevent excessive calls
      const now = Date.now();
      if (now - lastCheckTime < CHECK_COOLDOWN_MS) {
        // Skip without logging to reduce console noise
        return;
      }

      setLastCheckTime(now);

      try {
        // Check each meal in the FOOD_ITEMS array
        for (const food of FOOD_ITEMS) {
          await canAllEatMeal(food.id);
          // Reduced logging
        }
      } catch (error) {
        console.error("Error checking meal eligibility:", error);
      }
    };

    // Only run if we have miners and a wallet connection
    if (connector && minerTokenIds.length > 0) {
      // Use setTimeout to delay the check and avoid immediate execution
      timeoutId = window.setTimeout(checkAllMeals, 1000);
    }

    // Cleanup function to clear timeout if component unmounts or dependencies change
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [connector, minerTokenIds.length]); // Removed mealStatuses.length and lastCheckTime dependencies

  const openConfirmation = (food: FoodItem) => {
    console.log(`Opening confirmation for food:`, food);
    console.log(`Current stakedMiners.length:`, stakedMiners.length);
    console.log(`Current gemBalance:`, gemBalance);
    refetchMealStatuses();
    setSelectedFood(food);
    setConfirmOpen(true);
    setOpen(false);
  };

  const handleEat = async () => {
    if (!selectedFood || !connector) return;
    try {
      setLoading(true);
      setTransactionLoading(true);

      // Check if expedition is in progress
      if (anyOnExpedition) {
        alert("Cannot feed while an expedition is in progress.");
        setLoading(false);
        setTransactionLoading(false);
        return;
      }

      const provider = new ethers.BrowserProvider(connector.provider);
      const signer = await provider.getSigner();

      if (!signer) {
        throw new Error("Signer not available");
      }

      // Determine Food System (Meal) contract address based on network
      const mealContractAddress =
        import.meta.env.VITE_NETWORK_ENV === "mainnet"
          ? import.meta.env.VITE_MAINNET_FOOD_SYSTEM_PROXY_ADDRESS
          : import.meta.env.VITE_TESTNET_FOOD_SYSTEM_PROXY_ADDRESS;

      if (!mealContractAddress || !ethers.isAddress(mealContractAddress)) {
        throw new Error(
          `Invalid meal contract address for network: ${mealContractAddress}`
        );
      }

      // We'll use the batchContract later for transactions, no need to create unused contract instance

      // Check if all miners can eat this meal (using the improved canAllEatMeal function)
      const allCanEat = await canAllEatMeal(selectedFood.id);
      if (!allCanEat) {
        alert(
          "Not all staked miners can eat this meal yet. Wait for cooldown or expedition completion."
        );
        setLoading(false);
        setTransactionLoading(false);
        return;
      }

      // Create batch action to feed all miners at once
      const batch = new BatchAction();

      // Add all actions (feed each miner with selected food)
      minerTokenIds.forEach((minerId) => {
        batch.addAction(0, minerId, selectedFood.id);
      });

      // Get the batch contract address for executing the transaction
      // Check for different possible environment variable patterns since RewardSpendingBatch doesn't have a direct match
      const network = import.meta.env.VITE_NETWORK_ENV || "testnet";
      let batchAddress;

      if (network === "testnet") {
        // Try multiple possible variable names for the batch contract
        batchAddress =
          import.meta.env.VITE_TESTNET_REWARD_SPENDING_BATCH_ADDRESS ||
          import.meta.env.VITE_TESTNET_REWARD_SPENDING_INTERFACE_FIXED2_ADDRESS;
      } else {
        batchAddress =
          import.meta.env.VITE_MAINNET_REWARD_SPENDING_BATCH_ADDRESS ||
          import.meta.env.VITE_MAINNET_REWARD_SPENDING_INTERFACE_FIXED2_ADDRESS;
      }

      console.log("Using batch contract address:", batchAddress);

      if (!batchAddress) {
        throw new Error(
          "Missing batch contract address. Check environment variables for REWARD_SPENDING_BATCH_ADDRESS or REWARD_SPENDING_INTERFACE_FIXED2_ADDRESS"
        );
      }

      if (batchAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error(
          "Invalid batch contract address: Address is zero address"
        );
      }

      // Create batch contract instance with proper error handling
      try {
        const batchContractABI = [
          "function executeBatch(tuple(uint8 action,uint256 arg1,uint256 arg2)[] actions)",
        ];
        console.log("Creating contract with:", {
          address: batchAddress,
          abi: batchContractABI,
          signerAddress: await signer.getAddress(),
        });

        // Verify address format
        if (!ethers.isAddress(batchAddress)) {
          throw new Error(`Invalid address format: ${batchAddress}`);
        }

        const batchContract = new ethers.Contract(
          batchAddress,
          batchContractABI,
          signer
        );
        console.log("Batch contract instance created successfully");

        // Execute batch and wait for confirmation
        console.log("Executing batch with", batch.actions.length, "actions");
        const tx = await batch.executeBatch(batchContract);
        console.log("Transaction sent:", tx.hash);
        await tx.wait();
      } catch (contractError: unknown) {
        console.error("Contract error details:", contractError);
        const errorMessage =
          contractError instanceof Error
            ? contractError.message
            : "Unknown error";
        throw new Error(`Batch contract error: ${errorMessage}`);
      }

      const totalCost = selectedFood.price * stakedMiners.length;
      console.log(`Batch eat tx confirmed. Total cost ${totalCost}`);

      // Update gem balance after successful transaction
      await updateGemBalance();

      setConfirmOpen(false);
      // Show success message or notification here
    } catch (error) {
      console.error("Error when executing batch eat transaction:", error);
      alert("Failed to purchase meal");
    } finally {
      setTransactionLoading(false); // Keep main loading true until we refresh meal status
      setConfirmOpen(false);
      // Reset selected food after transaction
      setSelectedFood(null);

      // Update local states and selections when meal data changes
      if (!loading) {
        setOpen(false);
        refetchMealStatuses();

        // Pre-check eligibility for all meals to update UI
        // Use a timeout to avoid immediate execution
        if (FOOD_ITEMS.length > 0 && connector) {
          setTimeout(() => {
            const checkEligibility = async () => {
              const newEligibleMeals: Record<number, boolean> = {};
              for (const food of FOOD_ITEMS) {
                newEligibleMeals[food.id] = await canAllEatMeal(food.id);
              }
              setEligibleMeals(newEligibleMeals);
            };
            checkEligibility();
          }, 1000);
        }
      }
    }
  };

  const expeditionInProgress = anyOnExpedition;

  // Cost calculation is done inline in the UI components directly
  // No need for a separate totalCost variable

  // Using the cost in the confirmation dialog (used implicitly)

  // Use totalCost in UI feedback and costs calculation

  const hasEnoughGems = useMemo(() => {
    if (!selectedFood) return false;
    if (selectedFood.id === 12 && selectedFood.name === "Dango")
      return isOGMinerHolder;
    return parseFloat(gemBalance) >= stakedMinerCount * selectedFood.price;
  }, [selectedFood, gemBalance, stakedMinerCount, isOGMinerHolder]);

  // Check if the selected food is eligible for all miners
  const isMealEligible = useMemo(() => {
    if (!selectedFood) return false;
    // Use the eligibility cache from canAllEatMeal checks
    return (
      mealEligibilityCache[selectedFood.id] ??
      eligibleMeals[selectedFood.id] ??
      false
    );
  }, [selectedFood, eligibleMeals, mealEligibilityCache]);

  // Only log button state changes when debugging is needed
  // Using useRef to track previous state to avoid constant logging
  const previousStateRef = useRef<string>("");

  // For troubleshooting, uncomment this block
  useEffect(() => {
    const currentState = JSON.stringify({
      stakedMinerCount,
      hasEnoughGems,
      selectedFood: selectedFood?.id || null,
      isOGMinerHolder,
      anyOnExpedition,
    });
    // Only log if state actually changed
    if (currentState !== previousStateRef.current) {
      console.log(`EatButton state changed:`, {
        isMealEligible,
        stakedMinerCount,
        hasEnoughGems,
        loading,
        selectedFood: selectedFood?.id || null,
        isOGMinerHolder,
        anyOnExpedition,
      });
      previousStateRef.current = currentState;
    }
  }, [
    stakedMinerCount,
    hasEnoughGems,
    loading,
    selectedFood,
    isOGMinerHolder,
    anyOnExpedition,
  ]);

  return (
    <div className="flex justify-center w-full relative">
      <button
        onClick={() => {
          if (expeditionInProgress) {
            alert(
              "Cannot feed while an expedition is in progress. Please wait for miners to return."
            );
            return;
          }
          setOpen(true);
        }}
        disabled={
          mealLoading ||
          loading ||
          stakedMiners.length === 0 ||
          expeditionInProgress
        }
        className={`w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold p-3 rounded-lg transition-all duration-300 font-winky shadow-lg shadow-amber-900/20 ${
          mealLoading ||
          loading ||
          stakedMiners.length === 0 ||
          expeditionInProgress
            ? "bg-gray-500 cursor-not-allowed"
            : ""
        }`}
        data-component-name="EatButton"
      >
        {expeditionInProgress ? "Expedition Running..." : "Eat"}
      </button>

      {/* Food Selection Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-gradient-to-b from-[#2a1a0a] to-[#1a0d00] border-2 border-amber-500/40 rounded-xl p-0 !max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl">
          <div className="bg-amber-950/50 border-b border-amber-500/30 p-6">
            <DialogHeader className="flex justify-between items-center">
              <DialogTitle className="text-3xl font-bold text-amber-400 font-winky drop-shadow-md">
                <span className="mr-3">🍽️</span> Choose Food
              </DialogTitle>
              <DialogClose className="h-8 w-8 rounded-full bg-amber-800/30 hover:bg-amber-700 p-1 text-amber-300 transition-colors" />
            </DialogHeader>
            <p className="text-amber-200/90 mt-2 pl-1">
              Feed your miners to gain powerful bonuses
            </p>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            {FOOD_ITEMS.map((food) => {
              const status = statusMap[food.id];
              const disabled = mealLoading || (status && !status.canEat);
              return (
                <div
                  key={food.id}
                  onClick={() => !disabled && openConfirmation(food)}
                  className="bg-gradient-to-br from-[#1a0d00] to-[#150800] border border-amber-500/30 rounded-lg p-5 hover:border-amber-400 hover:shadow-md hover:shadow-amber-900/30 transition-all duration-300 cursor-pointer relative overflow-hidden group"
                  style={{
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  {food.id === 13 && food.name === "Dango" ? (
                    <div className="absolute top-2 right-2 bg-amber-900/40 px-3 py-1 rounded-full text-amber-200/90 text-sm font-semibold">
                      {isOGMinerHolder ? (
                        <span className="text-green-300">FREE for OG</span>
                      ) : (
                        <span className="text-red-300">OG Only</span>
                      )}
                    </div>
                  ) : food.price === 0 ? (
                    <span className="absolute top-2 right-2 bg-green-700/70 px-3 py-1 rounded-full text-green-100 text-xs font-bold">
                      FREE
                    </span>
                  ) : disabled && status ? (
                    <div className="absolute top-2 right-2 bg-gray-800/70 px-3 py-1 rounded-full text-amber-200/80 text-sm font-semibold">
                      <Countdown
                        date={Date.now() + status.timeUntil * 1000}
                        renderer={({
                          minutes,
                          seconds,
                        }: CountdownRenderProps) =>
                          `${minutes}:${seconds.toString().padStart(2, "0")}`
                        }
                      />
                    </div>
                  ) : (
                    <div className="absolute top-2 right-2 bg-amber-900/40 px-3 py-1 rounded-full text-amber-200/90 text-sm font-semibold">
                      {food.price} <span className="text-amber-300">💎</span>
                    </div>
                  )}

                  <div className="flex items-start">
                    <div className="text-4xl mr-4 p-2 bg-amber-950/30 rounded-lg group-hover:scale-110 transition-transform">
                      {food.icon}
                    </div>

                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-amber-400 font-winky mb-2">
                        {food.name}
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-1 text-sm">
                          <span className="text-amber-300">💎</span>
                          <span className="text-amber-200/90">
                            {food.gemChance}% gem chance
                          </span>
                        </div>
                        {stakedMiners.length > 1 && (
                          <p className="mt-2 text-amber-300/90 text-xs bg-amber-950/30 px-2 py-1 rounded inline-block">
                            Total cost:{" "}
                            {food.id === 13 && food.name === "Dango"
                              ? isOGMinerHolder
                                ? "FREE"
                                : "OG Only"
                              : food.price === 0
                              ? "FREE"
                              : `${food.price * stakedMiners.length} 💎`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="absolute bottom-0 right-0 bg-amber-500/10 px-3 py-1 text-amber-200/80 text-xs rounded-tl-lg">
                      {!disabled && (
                        <span className="group-hover:text-amber-300 transition-colors">
                          Click to eat
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-gradient-to-b from-[#2a1a0a] to-[#1a0d00] border-2 border-amber-500/40 rounded-xl p-6 max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-amber-400 font-winky drop-shadow-md flex items-center">
              <span className="mr-3">{selectedFood?.icon}</span> Confirm
              Purchase
            </DialogTitle>
            <DialogDescription className="text-amber-200/90 mt-2">
              Review your food purchase for your miners
            </DialogDescription>
          </DialogHeader>

          {selectedFood && (
            <div className="py-4 space-y-4">
              <div className="flex justify-between items-center p-3 bg-amber-950/50 rounded-lg border border-amber-500/30">
                <div className="font-semibold text-amber-300">
                  {selectedFood.name}
                </div>
                <div className="text-amber-200">
                  {selectedFood.id === 13 && selectedFood.name === "Dango"
                    ? isOGMinerHolder
                      ? "FREE (OG benefit)"
                      : "Not Available"
                    : `${selectedFood.price} 💎`}
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-amber-950/50 rounded-lg border border-amber-500/30">
                <div className="font-semibold text-amber-300">
                  Staked Miners
                </div>
                <div className="text-amber-200">{stakedMiners.length}</div>
              </div>

              <div className="flex justify-between items-center p-3 bg-amber-950/50 rounded-lg border border-amber-500/30">
                <div className="font-semibold text-amber-300">Total Cost</div>
                <div className="text-amber-200">
                  {selectedFood.id === 13 && selectedFood.name === "Dango"
                    ? isOGMinerHolder
                      ? "FREE"
                      : "Not Available"
                    : selectedFood.price === 0
                    ? "FREE"
                    : `${(selectedFood.price * stakedMiners.length).toFixed(
                        2
                      )} 💎`}
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-amber-950/50 rounded-lg border border-amber-500/30">
                <div className="font-semibold text-amber-300">Your Balance</div>
                <div className="text-amber-200">
                  {parseFloat(gemBalance).toFixed(2)} 💎
                </div>
              </div>

              {/* Affordability and error messages handled via hasEnoughGems */}
              {!hasEnoughGems && (
                <div className="p-3 bg-red-900/50 rounded-lg border border-red-500/30 text-red-200">
                  {selectedFood.id === 13 &&
                  selectedFood.name === "Dango" &&
                  !isOGMinerHolder ? (
                    <>
                      <p className="font-semibold">Not Eligible!</p>
                      <p className="text-sm mt-1">
                        Dango is exclusively available to holders of first
                        edition miners. You need to own a first edition miner
                        NFT to use this food.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">Not enough gems!</p>
                      <p className="text-sm mt-1">
                        You need{" "}
                        {(selectedFood.price * stakedMinerCount).toFixed(2)}{" "}
                        gems but only have {parseFloat(gemBalance).toFixed(2)}{" "}
                        gems. Consider unstaking some miners or choosing a
                        cheaper food.
                      </p>
                    </>
                  )}
                </div>
              )}

              {stakedMinerCount === 0 && (
                <div className="p-3 bg-red-900/50 rounded-lg border border-red-500/30 text-red-200">
                  <p className="font-semibold">No miners staked!</p>
                  <p className="text-sm mt-1">
                    You need to stake at least one miner before you can feed
                    them.
                  </p>
                </div>
              )}

              {selectedFood.id === 13 &&
                selectedFood.name === "Dango" &&
                isOGMinerHolder && (
                  <div className="p-3 bg-green-900/50 rounded-lg border border-green-500/30 text-green-200">
                    <p className="font-semibold">
                      Congratulations you're an OG miner holder!
                    </p>
                    <p className="text-sm mt-1">
                      As a holder of a first edition miner (IDs 1-1980), you can
                      enjoy Dango for free.
                    </p>
                  </div>
                )}
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between mt-4">
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-5 py-2 bg-gray-700/70 hover:bg-gray-600/70 text-amber-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEat}
              disabled={
                !hasEnoughGems ||
                !isMealEligible ||
                stakedMinerCount === 0 ||
                transactionLoading ||
                (selectedFood?.id === 12 &&
                  selectedFood?.name === "Dango" &&
                  !isOGMinerHolder) ||
                anyOnExpedition
              }
              className={`px-5 py-2 rounded-lg transition-colors ${
                hasEnoughGems &&
                isMealEligible &&
                stakedMinerCount > 0 &&
                !transactionLoading &&
                !(
                  selectedFood?.id === 12 &&
                  selectedFood?.name === "Dango" &&
                  !isOGMinerHolder
                ) &&
                !anyOnExpedition
                  ? "bg-amber-500 hover:bg-amber-600 text-black"
                  : "bg-amber-800/50 text-amber-300/50 cursor-not-allowed"
              }`}
            >
              {loading ? "Processing..." : "Confirm"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
