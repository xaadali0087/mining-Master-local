import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useExpeditions } from "@/hooks/useExpeditions";
import { useStaking } from "@/hooks/useStaking";
import { ethers } from "ethers";
import { useRoninWallet } from "@/services/wallet/RoninWalletProvider";
import { getContractAddress } from "@/config/contracts";
import ReturnFromMines from "./ReturnFromMines";

export default function EnterMines() {
  const [showStartModal, setShowStartModal] = useState(false);
  const [showMiningModal, setShowMiningModal] = useState(true); // Control mining progress dialog visibility
  const [expeditionErrorDetails, setExpeditionErrorDetails] =
    useState<string>("");

  const {
    anyOnExpedition,
    latestEndTime,
    loading,
    allMinersEligible,
    allMinersFed,
    cooldownTime,
    forceRefresh,
    statuses,
  } = useExpeditions();
  const { stakedMiners } = useStaking();
  const { connector, address } = useRoninWallet();

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const timeLeft = Math.max(0, latestEndTime * 1000 - now);
  const isMining = anyOnExpedition;
  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}h ${m.toString().padStart(2, "0")}m ${s
      .toString()
      .padStart(2, "0")}s`;
  };

  // Determine if the player has any staked miners
  const hasCharacter = (stakedMiners?.length || 0) > 0;

  // Check if all miners are eligible for a new expedition
  // This now properly includes BOTH being fed AND expedition cooldown being over
  const canStartExpedition = !loading && allMinersEligible;

  // We separately track feeding status for more detailed UI feedback
  const allMinersPropperlyFed = !loading && allMinersFed;

  // CRITICAL FIX #1: Force refresh on component mount to ensure data is current
  useEffect(() => {
    console.log(
      "[EnterMines] Component mounted - force refreshing expedition data"
    );
    forceRefresh(); // Force expedition data refresh on component mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs once on mount

  // CRITICAL FIX #2: Log detailed expedition status for debugging with timestamps

  // Reset mining dialog visibility when expedition status changes
  useEffect(() => {
    // Show the mining dialog when miners are on expedition
    if (anyOnExpedition) {
      setShowMiningModal(true);
    }
  }, [anyOnExpedition]);

  useEffect(() => {
    // Skip if no statuses available
    if (!statuses?.length) {
      console.log("[EnterMines] No expedition statuses available yet");
      return;
    }

    console.log(
      `[${new Date().toISOString()}] [EnterMines] Processing ${
        statuses.length
      } miner statuses`
    );

    // IMPORTANT DEBUG: Log ALL miners regardless of eligibility status
    console.log(
      `[EnterMines] Debug - All miner statuses:`,
      statuses.map((s) => ({
        minerId: s.minerId,
        eligibleForExpedition: s.eligibleForNewExpedition,
        fedStatus: s.fedStatus?.isActive,
        mealExpiry: s.fedStatus?.expiryTime
          ? new Date(s.fedStatus?.expiryTime * 1000).toISOString()
          : "None",
        onExpedition: s.onExpedition,
      }))
    );

    // Process ineligible miners with detailed reporting
    const ineligible = statuses
      .filter((s) => !s.eligibleForNewExpedition)
      .map((s) => {
        // Log raw data for this miner for debugging with detailed meal status
        console.log(`[EnterMines] Ineligible miner #${s.minerId} data:`, {
          minerId: s.minerId,
          fedStatus: s.fedStatus,
          onExpedition: s.onExpedition,
          eligibleForExpedition: s.eligibleForNewExpedition,
          mealTimestamp: s.fedStatus?.timestamp
            ? new Date(s.fedStatus.timestamp * 1000).toISOString()
            : "None",
          mealExpiry: s.fedStatus?.expiryTime
            ? new Date(s.fedStatus.expiryTime * 1000).toISOString()
            : "None",
        });

        // CRITICAL FIX: Get feeding status directly from the expedition hook data
        // This ensures synchronized meal status across components
        const mealActive = s.fedStatus?.isActive ?? false;

        // Determine ineligibility reason with specific classification
        let reason;
        if (!mealActive) {
          reason = "Miner has not eaten";
        } else if (s.onExpedition) {
          reason = "Miner is currently on expedition";
        } else {
          reason = "Miner is on expedition cooldown";
        }

        return {
          id: s.minerId,
          isFed: mealActive ? "Yes" : "No",
          mealId: s.fedStatus?.mealId || 0,
          mealExpiry: s.fedStatus?.expiryTime
            ? new Date(s.fedStatus.expiryTime * 1000).toLocaleString()
            : "None",
          reason,
        };
      });

    // Log complete results for debugging
    if (ineligible.length > 0) {
      console.log("[EnterMines] Detailed ineligible miners status:");
      console.table(ineligible);
    }
  }, [statuses]); // Re-run whenever statuses updates

  // Button handler to open the mining expedition modal
  const handleStartMiningClick = () => {
    console.log("[EnterMines] Start mining clicked - refreshing data");
    // Log detailed eligibility status for debugging
    console.log(`[${new Date().toISOString()}] ✅ DEBUG - Eligible check:`, {
      allMinersEligible,
      eligibleCount: statuses.filter((s) => s.eligibleForNewExpedition).length,
      eligibleMiners: statuses
        .filter((s) => s.eligibleForNewExpedition)
        .map((s) => s.minerId),
      allMinersFed,
    });
    forceRefresh();
    setExpeditionErrorDetails("");
    setShowStartModal(true);
  };

  const toggleModal = (open: boolean) => {
    setShowStartModal(open);
  };

  // Handle the actual start expedition transaction
  const handleStartExpeditionTx = async () => {
    if (!connector) {
      console.log(
        `[${new Date().toISOString()}] No wallet connection available`
      );
      setExpeditionErrorDetails(
        "Wallet not connected. Please connect your wallet and try again."
      );
      setShowStartModal(true);
      return;
    }

    // CRITICAL DEBUG: Log wallet status before proceeding
    console.log(
      `[${new Date().toISOString()}] Wallet status: connected=${!!connector}, address=${address}`
    );

    // Debug the mining expedition UI eligibility vs contract eligibility
    console.log(`[${new Date().toISOString()}] PRE-TX ELIGIBILITY CHECK:`, {
      fromHook: statuses
        .filter((s) => s.eligibleForNewExpedition)
        .map((s) => s.minerId),
      feedingStatus: statuses.map((s) => ({
        id: s.minerId,
        fed: s.fedStatus?.isActive,
        mealId: s.fedStatus?.mealId,
        expiry: s.fedStatus?.expiryTime
          ? new Date(s.fedStatus.expiryTime * 1000).toISOString()
          : "None",
      })),
    });

    if (!hasCharacter) {
      alert("You have no staked miners to send on an expedition");
      return;
    }
    const provider = new ethers.BrowserProvider(connector.provider);
    const signer = await provider.getSigner();
    const expeditionAddress = getContractAddress("MiningExpeditionProxy");
    if (!expeditionAddress) {
      alert("Missing MiningExpeditionProxy address");
      return;
    }
    const abi = [
      "function startExpedition(uint256)",
      "function startExpeditions(uint256[])",
    ];
    const expedition = new ethers.Contract(expeditionAddress, abi, signer);

    // CRITICAL FIX: Compare UI eligibility with contract simulation
    console.log(
      `[${new Date().toISOString()}] Starting expedition eligibility check via contract simulation`
    );

    // For debug: Check which miners hook thinks are eligible
    const hookEligible = statuses
      .filter((s) => s.eligibleForNewExpedition)
      .map((s) => s.minerId);
    console.log(
      `[${new Date().toISOString()}] Hook shows these miners as eligible:`,
      hookEligible
    );

    // For batched transaction, we'll use miners the hook thinks are eligible
    // This ensures UI and transaction logic are in sync
    const eligibleFromHook =
      hookEligible.length > 0 ? hookEligible : stakedMiners;

    const eligible: number[] = [];
    const ineligible: { id: any; reason: string }[] = [];

    // Prepare call data and sender
    const iface = expedition.interface;
    const from = await signer.getAddress();

    // Log the food contract for debugging
    const foodSystemAddress = getContractAddress("FoodSystemProxy");
    console.log(
      `[${new Date().toISOString()}] Food contract: ${foodSystemAddress}`
    );

    // CRITICAL FIX: Get the actual food system address directly from the MiningExpedition contract first
    // This ensures we're using the same food system contract that expedition is using
    const expeditionDetailedAbi = [
      "function foodSystemAddress() view returns (address)",
      "function startExpedition(uint256)",
    ];
    const expeditionDetailed = new ethers.Contract(
      expeditionAddress,
      expeditionDetailedAbi,
      provider
    );
    const actualFoodSystemAddress =
      await expeditionDetailed.foodSystemAddress();

    // Compare with the config address to detect mismatches
    if (actualFoodSystemAddress !== foodSystemAddress) {
      console.log(
        `[${new Date().toISOString()}] ⚠️ CRITICAL ADDRESS MISMATCH - Config vs Contract:`
      );
      console.log(
        `[${new Date().toISOString()}] Config Food System: ${foodSystemAddress}`
      );
      console.log(
        `[${new Date().toISOString()}] Actual Food System: ${actualFoodSystemAddress}`
      );
    }

    // ALWAYS use the address from the contract for consistency
    // This is the food system address the MiningExpedition contract will use
    const foodAbi = [
      "function getMinerMealStatus(uint256 tokenId) view returns (uint256 mealId, uint256 timestamp, uint256 successRate, uint256 minReward, uint256 maxReward)",
    ];
    const foodContract = new ethers.Contract(
      actualFoodSystemAddress,
      foodAbi,
      provider
    );

    console.log(
      `[${new Date().toISOString()}] Checking meal status directly from correct food contract...`
    );

    // Store contract-verified meal statuses
    const contractMealStatus = new Map<
      number,
      { mealId: number; timestamp: number }
    >();

    // Check each miner's meal status directly from contract
    await Promise.all(
      eligibleFromHook.map(async (id: number) => {
        try {
          const result = await foodContract.getMinerMealStatus(id);
          const mealId = Number(result[0]);
          const timestamp = Number(result[1]);

          // Store for comparison
          contractMealStatus.set(id, { mealId, timestamp });

          // Log for debugging
          console.log(
            `[${new Date().toISOString()}] Miner ${id} meal status from contract: mealId=${mealId}, timestamp=${timestamp} (${
              timestamp > 0
                ? new Date(timestamp * 1000).toLocaleString()
                : "never"
            })`
          );

          // Add debug info - has this miner eaten according to the contract condition?
          console.log(
            `[${new Date().toISOString()}] Miner ${id} has ${
              timestamp > 0 ? "✅ eaten" : "❌ NOT eaten"
            } according to contract condition`
          );
        } catch (error) {
          console.error(`Failed to get meal status for miner ${id}:`, error);
        }
      })
    );

    // THEN: Simulate each transaction to detect eligibility issues
    await Promise.all(
      eligibleFromHook.map(async (id: any) => {
        try {
          // Debug the specific miner we're testing
          console.log(
            `[${new Date().toISOString()}] Testing miner ${id} eligibility via contract call...`
          );

          // Get meal status for comparison
          const mealStatus = contractMealStatus.get(id);
          if (mealStatus) {
            // Check if contract shows this miner has eaten (exactly as contract checks)
            const hasEatenByContract = mealStatus.timestamp > 0;
            console.log(
              `[${new Date().toISOString()}] Pre-check: Miner ${id} has ${
                hasEatenByContract ? "✅ eaten" : "❌ NOT eaten"
              } (timestamp=${mealStatus.timestamp})`
            );
          }

          // Now we've verified we're using the correct food system address from the contract itself
          // RPC call simulating startExpedition with correct msg.sender
          await provider.call({
            to: expeditionAddress,
            data: iface.encodeFunctionData("startExpedition", [id]),
            from,
          });

          console.log(
            `[${new Date().toISOString()}] ✅ Miner ${id} passed simulation check`
          );
          eligible.push(id);
        } catch (e: any) {
          // Enhanced error extraction
          let reason =
            e?.info?.error?.message || e?.reason || e?.message || String(e);
          console.log(
            `[${new Date().toISOString()}] ❌ Miner ${id} failed: ${reason}`
          );

          // Try to make error messages more user-friendly
          if (
            reason.includes("not fed") ||
            reason.includes("feeding status") ||
            reason.includes("not eaten") ||
            reason.includes("hasn't eaten")
          ) {
            reason = "Miner has not eaten";

            // Add debugging info about contract meal state if available
            const mealStatus = contractMealStatus.get(id);
            if (mealStatus) {
              console.log(
                `[${new Date().toISOString()}] CONTRADICTION? Contract shows mealTimestamp=${
                  mealStatus.timestamp
                } for miner ${id}`
              );
            }
          } else if (reason.includes("cooldown")) {
            reason = "Expedition cooldown not finished";
          }

          ineligible.push({ id, reason });
        }
      })
    );

    // Log ineligible miners for debugging
    if (ineligible.length > 0) {
      console.table(ineligible);

      // Count error types to give better feedback
      const feedingErrors = ineligible.filter(
        (item) =>
          item.reason.includes("not eaten") || item.reason.includes("fed")
      ).length;

      const cooldownErrors = ineligible.filter((item) =>
        item.reason.includes("cooldown")
      ).length;

      // CRITICAL FIX: Handle the timestamp synchronization issue in a different way
      if (eligible.length === 0 && hookEligible.length > 0) {
        console.log(
          `[${new Date().toISOString()}] ⚠️ Simulation shows no eligible miners, but hook indicates ${
            hookEligible.length
          } should be eligible`
        );
        console.log(
          `[${new Date().toISOString()}] ⚠️ This is a timestamp synchronization issue. Let's check the actual blockchain time and meal expiry.`
        );

        // Instead of just using hook data, check the actual blockchain timestamp
        try {
          // Use provider.getBlock('latest') instead of a contract call that doesn't exist
          const latestBlock = await provider.getBlock("latest");
          const blockTimestamp =
            latestBlock?.timestamp ?? Math.floor(Date.now() / 1000);
          console.log(
            `[${new Date().toISOString()}] Blockchain timestamp: ${blockTimestamp}, local timestamp: ${Math.floor(
              Date.now() / 1000
            )}`
          );
          console.log(
            `[${new Date().toISOString()}] Time difference: ${
              blockTimestamp - Math.floor(Date.now() / 1000)
            } seconds`
          );

          // Get the food system contract to check meal status directly
          const foodSystemAbi = [
            "function getMinerMealStatus(uint256) view returns (uint256, uint256)",
          ];
          const foodContract = new ethers.Contract(
            foodSystemAddress!,
            foodSystemAbi,
            signer
          );

          // Check each miner's actual meal status against the blockchain timestamp
          const verifiedEligible = await Promise.all(
            hookEligible.map(async (id) => {
              try {
                const [mealId, mealTimestamp] =
                  await foodContract.getMinerMealStatus(id);
                console.log(
                  `[${new Date().toISOString()}] Miner ${id} meal status: ID=${mealId}, timestamp=${mealTimestamp}`
                );

                // Get meal cooldown from contract using proper ABI
                const foodSystemAbiWithCooldown = [
                  "function getMinerMealStatus(uint256) view returns (uint256, uint256)",
                  "function MEAL_COOLDOWN() view returns (uint256)",
                ];
                const foodContractWithCooldown = new ethers.Contract(
                  foodSystemAddress!,
                  foodSystemAbiWithCooldown,
                  provider
                );
                const mealCooldown = Number(
                  await foodContractWithCooldown.MEAL_COOLDOWN()
                );

                // Calculate expiry using BLOCKCHAIN time, not local time
                const mealExpiry = Number(mealTimestamp) + Number(mealCooldown);
                console.log(
                  `[${new Date().toISOString()}] Miner ${id} meal expires at: ${mealExpiry}, current block time: ${blockTimestamp}`
                );

                // Verify eligibility using blockchain time
                if (Number(mealId) > 0 && mealExpiry > blockTimestamp) {
                  console.log(
                    `[${new Date().toISOString()}] ✅ Miner ${id} is ACTUALLY eligible based on blockchain time`
                  );
                  return id;
                } else {
                  console.log(
                    `[${new Date().toISOString()}] ❌ Miner ${id} is NOT eligible based on blockchain time`
                  );
                  return null;
                }
              } catch (e) {
                console.error(
                  `[${new Date().toISOString()}] Error checking miner ${id}:`,
                  e
                );
                return null;
              }
            })
          );

          // Filter out null values
          const actuallyEligible = verifiedEligible.filter(
            (id) => id !== null
          ) as number[];
          console.log(
            `[${new Date().toISOString()}] Actually eligible miners: ${
              actuallyEligible.length
            }`
          );

          if (actuallyEligible.length > 0) {
            eligible.push(...actuallyEligible);
          }
        } catch (e) {
          console.error(
            `[${new Date().toISOString()}] Failed to verify with blockchain time:`,
            e
          );

          // CRITICAL FIX: Trust our hook's eligibility data since all other checks are failing
          // This is our last attempt fallback
          console.log(
            `[${new Date().toISOString()}] Fallback: Using hook eligibility data directly as last resort`
          );

          // Use hook data since we couldn't verify with blockchain time
          // We have clear evidence the miners are fed in the hook logs, so force use them
          eligible.push(...hookEligible);

          console.log(
            `[${new Date().toISOString()}] Attempting expedition with ${
              hookEligible.length
            } miners from hook directly`
          );
        }
      } else if (eligible.length === 0) {
        // No eligible miners from any source
        console.log(
          `[${new Date().toISOString()}] ❌ No eligible miners from both hook and simulation`
        );

        // Format detailed error message
        let errorMessage = "Expedition failed: ";
        if (feedingErrors > 0) {
          errorMessage += `${feedingErrors} miner(s) need to be fed. `;
        }
        if (cooldownErrors > 0) {
          errorMessage += `${cooldownErrors} miner(s) still on cooldown.`;
        }

        setExpeditionErrorDetails(errorMessage);
        setShowStartModal(true); // Keep the modal open to show the error
        return;
      }
    }

    // Clear any previous errors if we have eligible miners
    if (eligible.length > 0) {
      setExpeditionErrorDetails("");
    }

    // CRITICAL: Check if we actually have any eligible miners after all checks
    if (eligible.length === 0) {
      const errorMsg =
        "No eligible miners found for expedition. Please make sure your miners are fed.";
      console.log(`[${new Date().toISOString()}] ${errorMsg}`);
      setExpeditionErrorDetails(errorMsg);
      setShowStartModal(true); // Reopen modal to show error
      return;
    }

    console.log(
      `[${new Date().toISOString()}] Preparing to start expedition for ${
        eligible.length
      } miners: ${eligible.join(", ")}`
    );

    // Batch start expeditions in one tx
    let tx;
    try {
      // Attempt expedition with automatic gas estimation
      console.log(
        `[${new Date().toISOString()}] Calling startExpeditions with miner IDs:`,
        eligible
      );
      tx = await expedition.startExpeditions(eligible);

      // Wait for transaction confirmation with more detailed logging
      console.log(
        `[${new Date().toISOString()}] Transaction sent! Hash:`,
        tx.hash
      );
      const receipt = await tx.wait();
      console.log(
        `[${new Date().toISOString()}] Expedition successful! Block:`,
        receipt.blockNumber
      );

      // Force refresh expedition data to update UI
      forceRefresh();

      // Show success message to user
      setExpeditionErrorDetails("");
      return;
    } catch (err: any) {
      console.error(
        `[${new Date().toISOString()}] Expedition transaction error:`,
        err
      );

      // Handle gas estimation errors by setting a fixed gas limit
      if (err.action === "estimateGas") {
        try {
          console.log(
            `[${new Date().toISOString()}] Retrying with fixed gas limit of 500,000`
          );
          tx = await expedition.startExpeditions(eligible, {
            gasLimit: 500_000,
          });
          const receipt = await tx.wait();
          console.log(
            `[${new Date().toISOString()}] Expedition successful on retry! Block:`,
            receipt.blockNumber
          );

          // Force refresh expedition data to update UI
          forceRefresh();

          // Show success message to user
          setExpeditionErrorDetails("");
          return;
        } catch (retryErr: any) {
          console.error(
            `[${new Date().toISOString()}] Expedition retry failed:`,
            retryErr
          );
          err = retryErr; // Update error for error handling below
        }
      }

      // Extract error details for user feedback
      let errorMsg = "Failed to start expedition";

      // Parse out the revert reason if available
      if (err.receipt) {
        if (err.receipt.status === 0) {
          errorMsg = "Transaction reverted by the blockchain";

          // Try to extract more useful error information
          if (err.reason) {
            errorMsg += ": " + err.reason;
          } else if (err.message && err.message.includes("has not eaten")) {
            errorMsg =
              "Miners are not properly fed. Please feed them and try again.";
          } else if (err.message && err.message.includes("cooldown")) {
            errorMsg =
              "Some miners are still on cooldown from previous expedition.";
          }
        }
      }

      console.error(
        `[${new Date().toISOString()}] Final error message: ${errorMsg}`
      );
      setExpeditionErrorDetails(errorMsg);
      setShowStartModal(true); // Reopen modal to show error
      return;
    }
  };

  return (
    <div className="flex justify-center w-full">
      <button
        onClick={() => handleStartMiningClick()}
        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold p-3 rounded-lg transition-all duration-300 font-winky"
        data-component-name="EnterMines"
      >
        Enter the Mines
      </button>

      {/* Mining progress dialog - shown when miners are on expedition */}
      {isMining && showMiningModal && (
        <Dialog open={true} onOpenChange={(open) => setShowMiningModal(open)}>
          <DialogContent className="bg-[#2a1a0a] border-2 border-amber-500/30 rounded-xl p-8 !max-w-md">
            <DialogHeader className="flex justify-between items-center mb-6">
              <DialogTitle className="text-2xl font-bold text-amber-400 font-winky">
                Mining in Progress
              </DialogTitle>
            </DialogHeader>

            <div className="bg-[#1a0d00] border border-amber-500/30 rounded-lg p-6 text-center">
              <p className="text-amber-200 font-body">
                {timeLeft > 0
                  ? "Time remaining until return"
                  : "Expedition complete!"}
              </p>
              <p className="text-4xl font-bold text-amber-400 font-winky my-4">
                {timeLeft > 0 ? formatTime(timeLeft) : "Ready to Return"}
              </p>
              <p className="text-amber-200 font-body">
                {timeLeft > 0
                  ? "Your miners are working hard..."
                  : "Your miners are waiting to report their findings!"}
              </p>

              {/* Add ReturnFromMines component when expedition is complete */}
              {timeLeft === 0 && (
                <div className="mt-6">
                  <ReturnFromMines />
                </div>
              )}
            </div>

            {/* Close button - IMPORTANT: This allows users to close the popup dialog */}
            <div className="flex justify-center mt-4">
              <button
                onClick={() => setShowMiningModal(false)}
                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 font-winky"
              >
                Close
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Start expedition dialog - shown when user clicks "Enter the Mines" */}
      <Dialog open={showStartModal} onOpenChange={toggleModal}>
        <DialogContent className="bg-[#2a1a0a] border-2 border-amber-500/30 rounded-xl p-8 !max-w-md">
          <DialogHeader className="flex justify-between items-center mb-6">
            <DialogTitle className="text-2xl font-bold text-amber-400 font-winky">
              Mining Expedition
            </DialogTitle>
          </DialogHeader>

          <div className="mb-6">
            <div className="flex items-center mb-4">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                  hasCharacter ? "bg-green-500" : "bg-red-500"
                }`}
              >
                {hasCharacter ? "✓" : "✗"}
              </div>
              <p className="text-amber-400 font-body">Have a miner character</p>
            </div>

            <div className="flex items-center mb-4">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                  allMinersPropperlyFed ? "bg-green-500" : "bg-red-500"
                }`}
              >
                {allMinersPropperlyFed ? "✓" : "✗"}
              </div>
              <p className="text-amber-400 font-body">All miners are fed</p>
            </div>

            <div className="flex items-center mb-4">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                  canStartExpedition ? "bg-green-500" : "bg-red-500"
                }`}
              >
                {canStartExpedition ? "✓" : "✗"}
              </div>
              <p className="text-amber-400 font-body">
                Miners are eligible for expedition
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            {loading ? (
              <div className="text-amber-200 mb-4 text-center">
                <p>Loading miner status...</p>
              </div>
            ) : (
              !canStartExpedition && (
                <div className="text-amber-200 mb-4 text-center">
                  {anyOnExpedition ? (
                    <p>
                      Your miners are currently mining! Return when complete.
                    </p>
                  ) : !allMinersPropperlyFed ? (
                    <div>
                      <p className="text-red-300 font-semibold mb-1">
                        Your miners need to eat before expedition!
                      </p>
                      <p className="text-amber-200 text-sm">
                        Feed them a meal from the Food menu
                      </p>
                    </div>
                  ) : (
                    <p>
                      Your miners are resting after an expedition (
                      {(cooldownTime / 3600).toFixed(1)}h cooldown).
                    </p>
                  )}
                </div>
              )
            )}

            {expeditionErrorDetails && (
              <div className="text-red-300 mb-4 text-center text-sm">
                <p>{expeditionErrorDetails}</p>
              </div>
            )}
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={() => toggleModal(false)}
              className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 font-winky"
            >
              Cancel
            </button>

            {hasCharacter && canStartExpedition ? (
              <button
                onClick={async () => {
                  toggleModal(false);
                  try {
                    await handleStartExpeditionTx();
                  } catch (error) {
                    console.error(
                      `[${new Date().toISOString()}] Expedition error:`,
                      error
                    );
                    setExpeditionErrorDetails(
                      "Failed to start expedition. Please try again."
                    );
                    toggleModal(true); // Reopen modal to show error
                  }
                }}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-6 py-3 rounded-lg transition-all duration-300 font-winky"
              >
                Start Expedition
              </button>
            ) : (
              <button
                disabled
                className="bg-amber-500/50 text-black/50 font-semibold px-6 py-3 rounded-lg cursor-not-allowed font-winky"
              >
                Start Expedition
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
