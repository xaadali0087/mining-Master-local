import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRoninWallet } from "../../services/wallet/RoninWalletProvider";
import { useStaking } from "../../hooks/useStaking";
import RegistryService from "../../services/contracts/RegistryService";
import SimpleRegistryHealer from "../../services/contracts/SimpleRegistryHealer";
import { ethers } from "ethers";
import { useMining } from "../../contexts/MiningContext";
// We'll use a regular div with hover effect instead of importing a tooltip component

// Import NFT types for comments/reference only
// import { NFT } from "../../services/contracts/NFTService";

class BatchAction {
  actions: Array<[number, bigint, bigint]> = [];

  addAction(action: number, arg1: number | bigint, arg2: number | bigint) {
    this.actions.push([action, BigInt(arg1), BigInt(arg2)]);
  }

  async executeBatch(batchContract: ethers.Contract) {
    if (this.actions.length === 0) return null;
    try {
      return await batchContract.executeBatch(this.actions);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`executeBatch failed: ${message}`);
    }
  }
}

const MAX_SLOTS = 100;
const FREE_SLOTS = 20; // First 20 slots are free

export default function MinerArea() {
  // Local UI state
  const [showAddMiner, setShowAddMiner] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(-1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loadingStake, setLoadingStake] = useState(false);
  const [approvingNFT, setApprovingNFT] = useState(false);
  const [processingMinerId, setProcessingMinerId] = useState<number | null>(
    null
  );
  const [stakingStatus, setStakingStatus] = useState<
    "idle" | "checking" | "approving" | "staking" | "error" | "success"
  >("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [minerSlots, setMinerSlots] = useState(MAX_SLOTS); // Updated to allow up to 100 miners
  const [purchasedSlots, setPurchasedSlots] = useState(0);
  const [onChainRewards, setOnChainRewards] = useState<string>("0.0000");
  const [isLoadingOnChainRewards, setIsLoadingOnChainRewards] =
    useState<boolean>(false);
  // Simplified on-chain rewards tracking without virtual spending UI controls

  // Get mining state from context
  const { isMining, timeLeft, formatTime } = useMining();

  // Connect to wallet and staking contract
  const { isConnected, connector } = useRoninWallet();

  // Optional registry services (won't break if not available)
  // We're keeping these initialized but not using them in staking/unstaking flow
  // to avoid multiple wallet confirmations
  const [, setRegistryService] = useState<RegistryService | null>(null);
  const [, setRegistryHealer] = useState<SimpleRegistryHealer | null>(null);
  const [, setRegistryAvailable] = useState(false);

  // Initialize registry services when wallet is connected
  useEffect(() => {
    if (connector && connector.provider) {
      // Initialize registry services with error handling
      const initRegistryServices = async () => {
        try {
          const provider = new ethers.BrowserProvider(connector.provider);

          // Try to initialize registry service
          const registry = new RegistryService(provider);
          if (registry.hasAnyRegistry()) {
            setRegistryService(registry);
            setRegistryAvailable(true);
            console.log("Registry service initialized successfully");

            // Only initialize healer if registry is available
            try {
              const healer = new SimpleRegistryHealer(provider);
              setRegistryHealer(healer);
              console.log("Registry healer initialized successfully");
            } catch (healerError) {
              console.warn(
                "Registry healer initialization failed:",
                healerError
              );
              // Healer is optional, continue without it
            }
          } else {
            console.log(
              "No registry contracts available - registry features disabled"
            );
            setRegistryAvailable(false);
          }
        } catch (error) {
          console.warn("Registry services initialization failed:", error);
          setRegistryAvailable(false);
          // Continue without registry - it's an optional enhancement
        }
      };

      initRegistryServices();
    }
  }, [connector]);

  const {
    stakedMiners,
    stakedMinerCount,
    isLoading: stakingLoading,
    error: stakingError,
    availableMiners,
    loadingMiners,
    estimatedRewards,
    autoSyncEnabled,
    stakeMiner,
    unstakeMiner,
    refreshStakingData,
    claimRewards,
    getUserPurchasedSlots,
  } = useStaking();

  // Transform stakedMiner IDs to our UI format
  const [displayMiners, setDisplayMiners] = useState<
    Array<{ id: number; name: string; image: string }>
  >([]);

  // Fetch on-chain rewards data from the contract
  const fetchOnChainRewards = async () => {
    if (!isConnected || !connector) return;

    try {
      setIsLoadingOnChainRewards(true);

      // Get the staking contract address from environment variables
      const stakingContractAddress =
        import.meta.env.VITE_NETWORK_ENV === "mainnet"
          ? import.meta.env.VITE_MAINNET_STAKING_PROXY_ADDRESS
          : import.meta.env.VITE_TESTNET_STAKING_PROXY_ADDRESS;

      // Define minimal ABI for getPendingRewards function
      const stakingABI = [
        "function getPendingRewards(address user) external view returns (uint256)",
      ];

      // Connect to the contract and fetch real on-chain rewards
      const provider = new ethers.BrowserProvider(connector.provider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        stakingContractAddress,
        stakingABI,
        signer
      );
      const userAddress = await signer.getAddress();

      // console.log(
      //   `Fetching on-chain rewards for ${userAddress} from contract ${stakingContractAddress}`
      // );

      // Get the actual pending rewards from the contract
      const pendingRewards = await contract.getPendingRewards(userAddress);
      const formattedRewards = ethers.formatEther(pendingRewards);

      // console.log(`On-chain rewards fetched: ${formattedRewards} GEMS`);
      setOnChainRewards(formattedRewards);
      setIsLoadingOnChainRewards(false);
    } catch (error) {
      // console.error("Failed to fetch on-chain rewards:", error);
      setIsLoadingOnChainRewards(false);
    }
  };

  // Note: Virtual spending functionality is now handled through game transactions
  // Players spend gems through adding miners or buying boosts in the shop
  // This automatically updates their virtual spent amount

  // Fetch on-chain rewards when connected or rewards change
  useEffect(() => {
    if (isConnected) {
      fetchOnChainRewards();

      // Set up periodic refresh every 30 seconds
      const refreshInterval = setInterval(() => {
        fetchOnChainRewards();
      }, 30000);

      // Clean up interval on unmount
      return () => clearInterval(refreshInterval);
    }
  }, [isConnected]);

  useEffect(() => {
    // Convert numerical IDs to display format
    const miners = stakedMiners.map((id) => ({
      id: Number(id),
      name: `Miner #${String(id).padStart(3, "0")}`,
      image: "/images/Miner.png",
    }));
    setDisplayMiners(miners);

    // Log discrepancy between stakedMinerCount and actual array length for debugging
    if (stakedMiners.length !== stakedMinerCount) {
      // console.warn(
      //   `Miner count mismatch: stakedMinerCount=${stakedMinerCount}, stakedMiners.length=${stakedMiners.length}`
      // );
    }
  }, [stakedMiners, stakedMinerCount]);

  useEffect(() => {
    const fetchUserPurchasedSlots = async () => {
      const purchasedSlots = await getUserPurchasedSlots();
      console.log("[MinerArea] User purchased slots:", purchasedSlots);
      if (purchasedSlots) {
        setPurchasedSlots(purchasedSlots);
      }
    };
    fetchUserPurchasedSlots();
  }, [getUserPurchasedSlots]);

  const toggleAddMinerModal = (open: boolean) => {
    setShowAddMiner(open);
    // Reset payment dialog when closing add miner modal
    if (!open) {
      setShowPaymentDialog(false);
      setSelectedSlotIndex(-1);
    }
    document.body.style.overflow = open ? "hidden" : "auto";
  };

  const handleSlotClick = (slotIndex: number) => {
    // Check if this is a paid slot (beyond the free slots)
    if (slotIndex >= FREE_SLOTS) {
      // This is a paid slot, show payment dialog first
      setSelectedSlotIndex(slotIndex);
      setShowPaymentDialog(true);
    } else {
      // This is a free slot, directly show add miner dialog
      toggleAddMinerModal(true);
    }
  };

  const handlePayForSlot = async () => {
    if (!connector) return;
    if (MAX_SLOTS <= FREE_SLOTS + purchasedSlots) {
      alert("You have reached the maximum number of slots");
      return;
    }
    try {
      setStatusMessage("Purchasing additional miner slot...");
      setStakingStatus("staking");

      // 1. Get provider, signer
      const provider = new ethers.BrowserProvider(connector.provider);
      const signer = await provider.getSigner();

      // 2. Get batch contract address from env
      const network = import.meta.env.VITE_NETWORK_ENV || "testnet";
      let batchAddress;
      if (network === "testnet") {
        batchAddress =
          import.meta.env.VITE_TESTNET_REWARD_SPENDING_BATCH_ADDRESS ||
          import.meta.env.VITE_TESTNET_REWARD_SPENDING_INTERFACE_FIXED2_ADDRESS;
      } else {
        batchAddress =
          import.meta.env.VITE_MAINNET_REWARD_SPENDING_BATCH_ADDRESS ||
          import.meta.env.VITE_MAINNET_REWARD_SPENDING_INTERFACE_FIXED2_ADDRESS;
      }
      if (
        !batchAddress ||
        batchAddress === "0x0000000000000000000000000000000000000000"
      ) {
        throw new Error("Missing or invalid batch contract address");
      }

      // 3. Create batch contract instance
      const batchContractABI = [
        "function executeBatch(tuple(uint8 action,uint256 arg1,uint256 arg2)[] actions)",
      ];
      const batchContract = new ethers.Contract(
        batchAddress,
        batchContractABI,
        signer
      );

      // 4. Create batch action (type SLOTS = 2, arg1 = number of slots to buy, arg2 = 0)
      const batch = new BatchAction();
      batch.addAction(2, 1, 0); // 2 = SLOTS, 1 = number of slots to buy, 0 = unused

      // 5. Send transaction
      const tx = await batch.executeBatch(batchContract);
      if (tx) {
        await tx.wait();
        setShowPaymentDialog(false);
        toggleAddMinerModal(true);
        setStatusMessage("Slot purchased successfully!");
        setStakingStatus("success");
        // Optionally refresh staking data here
        await refreshStakingData();
      }
    } catch (error) {
      console.error("Failed to purchase slot:", error);
      setStakingStatus("error");
      setStatusMessage("Failed to purchase slot. Please try again.");
    }
  };

  // Handle staking a miner
  const handleStakeMiner = async (miner: {
    id: number;
    name: string;
    image: string;
  }) => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setLoadingStake(true);
    setProcessingMinerId(miner.id);
    setStakingStatus("checking");
    setStatusMessage("Preparing to stake miner...");

    try {
      console.log(`Starting process to stake miner #${miner.id}`);

      // We're skipping registry healing during staking to reduce wallet confirmations
      // Registry will be automatically updated when a token is transferred in the contract events
      console.log(
        "Skipping registry healing during staking to reduce wallet confirmations"
      );

      // Phase 2: Approval (useStaking hook handles this internally but we'll show UI feedback)
      setApprovingNFT(true);
      setStakingStatus("approving");
      setStatusMessage(`Approving Miner #${miner.id} for staking...`);

      // Use the stakeMiner function from the useStaking hook which already properly implements
      // the two-step process (approval then stake)
      const tx = await stakeMiner(miner.id);

      // Make sure we have a valid transaction
      if (!tx) {
        throw new Error("Failed to get a valid transaction response");
      }

      // Move to staking phase once approval is done
      setApprovingNFT(false);
      setStakingStatus("staking");
      setStatusMessage(
        `Staking Miner #${miner.id}. Waiting for blockchain confirmation...`
      );

      console.log("Staking transaction submitted:", tx.hash);

      // Wait for transaction to be mined with increased timeout
      try {
        const receipt = await tx.wait();
        console.log(
          "Transaction confirmed in block:",
          receipt?.blockNumber || "unknown"
        );

        // Transaction successful
        setStakingStatus("success");
        setStatusMessage(`Successfully staked Miner #${miner.id}!`);

        // Close the modal
        toggleAddMinerModal(false);

        // Refresh staking data after transaction
        await refreshStakingData();

        // Show success message
        alert(`Successfully staked Miner #${miner.id}!`);
      } catch (waitError) {
        console.error("Error waiting for transaction confirmation:", waitError);
        throw new Error(
          "Transaction may have failed on the blockchain. Please check your wallet for confirmation."
        );
      }
    } catch (error) {
      console.error("Error staking miner:", error);

      // Set error state
      setStakingStatus("error");

      // Extract error message for display
      let errorMessage = "Failed to stake miner.";

      if (error instanceof Error) {
        const errorStr = JSON.stringify(error);
        console.error("Full error object:", errorStr);

        // Provide more specific error messages based on the error content
        if (error.message.includes("user rejected")) {
          errorMessage = "Transaction was rejected by the user";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "You do not have enough RON for gas fees";
        } else if (error.message.includes("do not own")) {
          errorMessage = "You do not own this NFT";
        } else if (
          error.message.includes("approval") ||
          error.message.includes("approve")
        ) {
          errorMessage = "Failed to approve the NFT for staking";
        } else if (
          error.message.includes("execution reverted") ||
          error.message.includes("CALL_EXCEPTION")
        ) {
          errorMessage =
            "Transaction failed on the blockchain. The NFT may already be staked or you may not be the owner.";
        } else {
          // Use the error message from the error object if available
          errorMessage = `Failed to stake miner: ${error.message}`;
        }
      }

      setStatusMessage(errorMessage);
      alert(errorMessage);
    } finally {
      // Reset staking UI state
      setLoadingStake(false);
      setApprovingNFT(false);
      setProcessingMinerId(null);

      // After a delay, reset the status to idle
      setTimeout(() => {
        setStakingStatus("idle");
        setStatusMessage("");
      }, 3000);
    }
  };

  // Handle unstaking a miner
  const handleUnstakeMiner = async (tokenId: number) => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    if (confirm("Are you sure you want to unstake this miner?")) {
      try {
        // We're skipping registry healing during unstaking to reduce wallet confirmations
        // Registry will be automatically updated when a token is transferred in the contract events
        console.log(
          "Skipping registry healing during unstaking to reduce wallet confirmations"
        );

        // Proceed with unstaking
        const tx = await unstakeMiner(tokenId);
        console.log("Unstaking transaction:", tx);

        // Refresh staking data after transaction
        await refreshStakingData();
      } catch (error) {
        console.error("Error unstaking miner:", error);
        alert("Failed to unstake miner. Please try again.");
      }
    }
  };

  return (
    <div
      className="w-11/12 max-w-6xl mx-auto p-6 relative"
      data-component-name="MinerArea"
    >
      {/* Background stylistic elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a0d00]/20 to-transparent rounded-xl"></div>

      {/* Miner Area Header */}
      <div
        className="flex justify-between items-center mb-6 relative z-10"
        data-component-name="MinerArea"
      >
        <div
          className="flex items-center gap-3"
          data-component-name="MinerArea"
        >
          <h2
            className="text-3xl font-bold text-amber-400 font-winky"
            data-component-name="MinerArea"
          >
            Miner Area
          </h2>
          {isMining && (
            <div className="bg-amber-500/20 border border-amber-500/50 rounded-full px-4 py-1 text-amber-300 font-winky text-sm flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
              <span>Mining: {formatTime(timeLeft)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Connection status */}
          {!isConnected ? (
            <span className="text-red-400 font-body px-4 py-2 bg-[#1a0d00]/50 rounded-lg border border-red-500/20">
              Wallet not connected
            </span>
          ) : stakingError ? (
            <div className="flex flex-col">
              <span className="text-red-400 font-body px-4 py-2 bg-[#1a0d00]/50 rounded-lg border border-red-500/20 mb-1">
                Error: {stakingError}
              </span>
              {/* Diagnostic link hidden per request */
              /* <a 
                href="/debug" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-amber-400 hover:text-amber-300 transition-colors duration-200 underline text-center"
              >
                Open Diagnostic Page
              </a> */}
            </div>
          ) : stakingLoading ? (
            <span className="text-amber-400 font-body px-4 py-2 bg-[#1a0d00]/50 rounded-lg border border-amber-500/20 animate-pulse">
              Loading...
            </span>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-amber-400 font-body px-4 py-2 bg-[#1a0d00]/50 rounded-lg border border-amber-500/20">
                Miners: {stakedMiners.length}/{minerSlots}
              </span>

              {/* On-chain rewards display */}
              {isConnected && (
                <div
                  data-component-name="OnChainRewards"
                  className="flex items-center gap-2 text-xs bg-[#1a0d00]/50 rounded-lg px-4 py-2 border border-amber-500/30 h-[38px]"
                >
                  <div className="flex items-center">
                    <img
                      src="/images/Mine.png"
                      alt="On-chain"
                      className="w-4 h-4 mr-1"
                    />
                    <span
                      className="text-amber-400 font-bold font-body"
                      data-component-name="MinerArea"
                    >
                      {isLoadingOnChainRewards ? "..." : onChainRewards}
                    </span>
                    <span className="ml-1 text-amber-300/50 text-[10px]">
                      on-chain
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        fetchOnChainRewards();
                      }}
                      className="ml-2 text-amber-300/70 hover:text-amber-300 transition-colors"
                      title="Refresh on-chain rewards"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                      </svg>
                    </button>
                  </div>
                  <div className="relative group ml-2">
                    <span className="text-[10px] cursor-help text-amber-400/70 inline-flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 16v-4"></path>
                        <path d="M12 8h.01"></path>
                      </svg>
                    </span>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1 bg-amber-800 text-amber-200 text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none z-10">
                      Spendable in-game at miners and shop
                      <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 border-4 border-transparent border-t-amber-800"></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Estimated rewards display */}
              {Number(estimatedRewards) > 0 && (
                <div
                  data-component-name="MinerArea"
                  className="flex items-center gap-2 text-xs bg-[#1a0d00]/50 rounded-lg px-4 py-2 border border-amber-500/20 h-[38px]"
                >
                  <div className="flex items-center">
                    <img
                      src="/images/Mine.png"
                      alt="GEMS"
                      className="w-4 h-4 mr-1"
                    />
                    <span className="text-amber-400 font-bold font-body">
                      {Number(estimatedRewards).toFixed(4)}
                      {autoSyncEnabled && (
                        <span className="animate-pulse ml-1 text-green-400">
                          •
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="relative group">
                    <button
                      onClick={async () => {
                        if (
                          window.confirm(
                            "Claim " +
                            Number(estimatedRewards).toFixed(6) +
                            " GEMS?"
                          )
                        ) {
                          if (isConnected) {
                            try {
                              // Use the claimRewards function from useStaking
                              const tx = await claimRewards();
                              if (tx) {
                                alert("Successfully claimed GEMS!");
                                // Refresh staking data after claiming
                                await refreshStakingData();
                              }
                            } catch (error) {
                              console.error("Failed to claim rewards:", error);
                              alert(
                                "Failed to claim rewards. Please try again."
                              );
                            }
                          }
                        }
                      }}
                      className="text-[10px] bg-amber-500 hover:bg-amber-600 text-black px-2 py-1 rounded transition-all duration-300 font-winky shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed ml-1"
                      disabled={true}
                    >
                      Claim
                    </button>
                    {/* Tooltip that appears on hover */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1 bg-amber-800 text-amber-200 text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap pointer-events-none z-10">
                      (¬‿¬ ) not yet, keep eating!
                      <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 border-4 border-transparent border-t-amber-800"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Slot management now handled directly via the miner grid */}
        </div>
      </div>

      {/* Decorative divider with view toggle */}
      <div className="relative py-4 my-2" data-component-name="MinerArea">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-amber-500/30"></div>
        </div>
        <div className="relative flex justify-between items-center">
          <div className="flex-1"></div>
          <span
            className="bg-[#1a0d00] px-4 py-1 text-amber-500 rounded-full border border-amber-500/40 text-xs font-winky shadow-inner shadow-amber-900/10"
            data-component-name="MinerArea"
          >
            Miners
          </span>
          <div className="flex-1 flex justify-end">
            <div className="bg-[#1a0d00] flex rounded-lg border border-amber-500/40 overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 text-xs font-winky transition-colors duration-200 flex items-center ${viewMode === "grid"
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-amber-500/70 hover:text-amber-400"
                  }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Grid
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-xs font-winky transition-colors duration-200 flex items-center ${viewMode === "list"
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-amber-500/70 hover:text-amber-400"
                  }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Staked Miners Display (Grid or List view) */}
      <div className="h-[450px] overflow-y-auto pr-2 relative z-10 scrollbar-thin scrollbar-thumb-amber-500 scrollbar-track-[#1a0d00]">
        {viewMode === "grid" ? (
          /* Grid View */
          <div
            className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4 mb-8"
            data-component-name="MinerArea"
          >
            {/* Display staked miners in grid */}
            {displayMiners.map((miner) => (
              <div
                key={miner.id}
                className="bg-[#2a1a0a] border-2 border-amber-500/40 rounded-xl p-4 flex flex-col items-center transition-all duration-300 hover:border-amber-500 hover:shadow-amber-900/20 hover:shadow-lg relative overflow-hidden group pb-8"
                data-component-name="MinerArea"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-amber-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="w-full flex-1 flex items-center justify-center relative z-10 aspect-square">
                  <img
                    src={miner.image}
                    alt={miner.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                {/* Unstake button */}
                <button
                  onClick={() => handleUnstakeMiner(miner.id)}
                  className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                >
                  ✕
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-[#1a0d00] p-2 text-center">
                  <span className="text-sm text-amber-400 font-winky">
                    {miner.name}
                  </span>
                </div>
              </div>
            ))}

            {/* Display empty slots in grid */}
            {Array.from({
              length: minerSlots - stakedMiners.length,
            }).map((_, index) => {
              const slotIndex = stakedMiners.length + index;
              const isFreeSlot = slotIndex < FREE_SLOTS;
              const isPurchasedSlot =
                slotIndex >= FREE_SLOTS &&
                slotIndex < FREE_SLOTS + purchasedSlots;

              return (
                <button
                  key={`empty-slot-${index}`}
                  onClick={() => handleSlotClick(slotIndex)}
                  className="bg-[#2a1a0a] border-2 border-dashed border-amber-500/30 rounded-xl p-3 flex flex-col items-center justify-center hover:border-amber-500 hover:bg-[#3a2410] transition-all duration-300 aspect-square hover:shadow-amber-900/20 hover:shadow-lg relative"
                  data-component-name="MinerArea"
                >
                  {/* Tag to indicate if slot is free or costs gems */}
                  <div
                    className={`absolute -top-1.5 -right-1.5 ${isFreeSlot || isPurchasedSlot
                      ? "bg-green-600/80"
                      : "bg-amber-600/80"
                      } text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium z-20 shadow-sm flex items-center backdrop-blur-sm border ${isFreeSlot || isPurchasedSlot
                        ? "border-green-500/30"
                        : "border-amber-500/30"
                      }`}
                  >
                    {isFreeSlot ? (
                      <span>FREE</span>
                    ) : isPurchasedSlot ? (
                      <span>PURCHASED</span>
                    ) : (
                      <img
                        src="/images/Mine.png"
                        alt="Gem"
                        className="w-3.5 h-3.5"
                      />
                    )}
                  </div>
                  <span
                    className="text-3xl text-amber-400"
                    data-component-name="MinerArea"
                  >
                    +
                  </span>
                  <span className="mt-1 text-sm text-amber-400 font-winky">
                    Add Miner
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div
            className="flex flex-col gap-2 mb-8"
            data-component-name="MinerArea"
          >
            {/* Display staked miners in list */}
            {displayMiners.map((miner) => (
              <div
                key={miner.id}
                className="bg-[#2a1a0a] border-2 border-amber-500/40 rounded-lg p-3 hover:border-amber-500 hover:shadow-amber-900/20 hover:shadow-lg transition-all duration-300 group relative overflow-hidden"
                data-component-name="MinerArea"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-14 h-14 mr-4 bg-[#1a0d00]/50 rounded-lg border border-amber-500/20 p-1 flex items-center justify-center">
                    <img
                      src={miner.image}
                      alt={miner.name}
                      className="max-w-full max-h-full object-contain transform group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-amber-400 font-bold font-winky">
                      {miner.name}
                    </h4>
                    <p className="text-amber-400/70 text-xs">Staked Miner</p>
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={() => handleUnstakeMiner(miner.id)}
                      className="bg-red-500/80 hover:bg-red-600 text-white rounded px-2 py-1 text-xs"
                    >
                      Unstake
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Display empty slots in list */}
            {Array.from({ length: minerSlots - stakedMiners.length }).map(
              (_, index) => {
                const slotIndex = stakedMiners.length + index;
                const isFreeSlot = slotIndex < FREE_SLOTS;

                return (
                  <button
                    key={`empty-slot-${index}`}
                    onClick={() => handleSlotClick(slotIndex)}
                    className="bg-[#2a1a0a] border-2 border-dashed border-amber-500/30 rounded-lg p-3 hover:border-amber-500 hover:bg-[#3a2410] transition-all duration-300 text-left hover:shadow-amber-900/20 hover:shadow-lg relative"
                    data-component-name="MinerArea"
                  >
                    {/* Tag to indicate if slot is free or costs gems */}
                    <div
                      className={`absolute -top-1.5 -right-1.5 ${isFreeSlot ? "bg-green-600/80" : "bg-amber-600/80"
                        } text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium z-20 shadow-sm flex items-center backdrop-blur-sm border ${isFreeSlot
                          ? "border-green-500/30"
                          : "border-amber-500/30"
                        }`}
                    >
                      {isFreeSlot ? (
                        <span>FREE</span>
                      ) : (
                        <img
                          src="/images/Mine.png"
                          alt="Gem"
                          className="w-3.5 h-3.5"
                        />
                      )}
                    </div>
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-14 h-14 mr-4 bg-[#1a0d00]/50 rounded-lg border border-amber-500/20 p-1 flex items-center justify-center">
                        <span className="text-2xl text-amber-400">+</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-amber-500/70 font-bold font-winky">
                          Empty Slot
                        </h4>
                        <p className="text-amber-400/70 text-xs">
                          Click to add a miner
                        </p>
                      </div>
                    </div>
                  </button>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* Add Miner Dialog */}
      <Dialog open={showAddMiner} onOpenChange={toggleAddMinerModal}>
        <DialogContent className="bg-gradient-to-b from-[#2a1a0a] to-[#1a0d00] border-2 border-amber-500/40 rounded-xl p-8 w-full max-w-lg shadow-xl">
          <DialogHeader className="flex justify-between items-center mb-6">
            <DialogTitle className="text-2xl font-bold text-amber-400 font-winky flex items-center gap-2">
              <img src="/images/Miner.png" alt="" className="w-8 h-8" />
              Available Miners{" "}
              {loadingMiners ? "(Loading...)" : `(${availableMiners.length})`}
            </DialogTitle>
          </DialogHeader>

          {loadingMiners ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
            </div>
          ) : availableMiners.length === 0 ? (
            <div className="bg-[#1a0d00] border border-amber-500/30 rounded-lg p-6 text-center">
              <p className="text-amber-400 mb-2">
                No miners available for staking
              </p>
              <p className="text-amber-300/70 text-sm">
                You need to own Miner NFTs to stake them.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {availableMiners.map((miner) => (
                <div
                  key={miner.id}
                  className="bg-[#1a0d00] border border-amber-500/30 rounded-lg p-4 hover:border-amber-500 hover:shadow-amber-900/20 hover:shadow-lg transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-gradient-to-t from-amber-900/10 to-transparent opacity-0 group-hover:opacity-100 rounded-full transition-opacity duration-300"></div>
                      <img
                        src={miner.image}
                        alt={miner.name}
                        className="w-12 h-12 object-contain transform group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <div className="flex-grow">
                      <h4 className="text-amber-400 font-bold font-winky">
                        {miner.name}
                      </h4>
                      <p className="text-amber-300/70 text-sm">
                        NFT ID: #{miner.id}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <button
                        onClick={() =>
                          handleStakeMiner({
                            id:
                              typeof miner.id === "string"
                                ? parseInt(miner.id)
                                : miner.id,
                            name: miner.name || `Miner #${miner.id}`,
                            image: miner.image || "/images/Miner.png",
                          })
                        }
                        className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-black font-semibold px-4 py-2 rounded-lg transition-all duration-300 font-winky shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loadingStake || !isConnected}
                      >
                        {processingMinerId === miner.id
                          ? approvingNFT
                            ? "Approving..."
                            : "Staking..."
                          : "Stake"}
                      </button>
                      {processingMinerId === miner.id &&
                        stakingStatus !== "idle" && (
                          <span className="text-xs text-amber-300 mt-1 italic">
                            {statusMessage}
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Payment Dialog for Paid Slots */}
      <Dialog
        open={showPaymentDialog}
        onOpenChange={(open) => !open && setShowPaymentDialog(false)}
      >
        <DialogContent className="bg-gradient-to-b from-[#2a1a0a] to-[#1a0d00] border-2 border-amber-500/40 rounded-xl p-8 w-full max-w-md shadow-xl">
          <DialogHeader className="flex justify-between items-center mb-6">
            <DialogTitle className="text-2xl font-bold text-amber-400 font-winky flex items-center gap-2">
              <img src="/images/Mine.png" alt="" className="w-6 h-6" />
              Purchase Slot
            </DialogTitle>
          </DialogHeader>
          <div className="bg-[#1a0d00]/60 p-6 rounded-lg border border-amber-500/20 mb-6 text-center">
            <p className="text-amber-400 text-lg font-body mb-4">
              This is a premium miner slot.
            </p>
            <div className="flex items-center justify-center gap-2">
              <p className="text-amber-400 text-xl font-body">Cost:</p>
              <div className="flex items-center bg-amber-900/30 px-3 py-1 rounded-lg border border-amber-500/40">
                <span className="text-white font-bold mr-2">1000</span>
                <img src="/images/Mine.png" alt="GEMS" className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setShowPaymentDialog(false)}
              className="bg-gray-700 hover:bg-gray-800 text-amber-200 font-semibold px-6 py-3 rounded-lg transition-all duration-300 font-winky border border-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handlePayForSlot}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-6 py-3 rounded-lg transition-all duration-300 font-winky shadow-md hover:shadow-lg"
            >
              Purchase & Continue
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Slot management now handled directly through the payment dialog */}
    </div>
  );
}
