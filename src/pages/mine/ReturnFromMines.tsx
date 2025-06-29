import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getContractAddress } from "@/config/contracts";
import { useExpeditions } from "@/hooks/useExpeditions";
import { useStaking } from "@/hooks/useStaking";
import { useGEMSService } from "@/services/contracts/GEMSService";
import { useRoninWallet } from "@/services/wallet/RoninWalletProvider";
import { ethers } from "ethers";
import { useEffect, useState } from "react";

interface MiningRewards {
  gems: number;
}

interface MiningResult {
  success: boolean;
  rewards: MiningRewards;
}

export default function ReturnFromMines() {
  const [showResults, setShowResults] = useState(false);
  const [miningResults, setMiningResults] = useState<MiningResult | null>(null);
  const [isCompletingExpedition, setIsCompletingExpedition] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [connectedAddress, setConnectedAddress] = useState<string>("");

  // Use the GEMS service to get token balance
  const { getBalance } = useGEMSService();

  const { connector } = useRoninWallet();

  const { readyToComplete, refetch, statuses } = useExpeditions(15000);
  const { stakedMiners } = useStaking();

  // Get and display the connected wallet address
  useEffect(() => {
    const updateAddress = async () => {
      if (connector) {
        try {
          const provider = new ethers.BrowserProvider(connector.provider);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          setConnectedAddress(address);
        } catch (error) {
          console.error("Failed to get wallet address:", error);
          setConnectedAddress("Error getting address");
        }
      } else {
        setConnectedAddress("Not connected");
      }
    };

    updateAddress();
  }, [connector]);

  // Log detailed information about expedition status for debugging
  useEffect(() => {
    console.log(`[ReturnFromMines] Debug info:`, {
      readyToComplete: readyToComplete.length,
      stakedMiners: stakedMiners.length,
      isCompletingExpedition,
      expeditionStatuses: statuses.map((s: any) => ({
        minerId: s.minerId,
        onExpedition: s.onExpedition,
        startTime: s.startTime,
        endTime: s.endTime,
        completed: s.completed,
        currentTime: Math.floor(Date.now() / 1000),
        timeRemaining:
          s.endTime > Math.floor(Date.now() / 1000)
            ? s.endTime - Math.floor(Date.now() / 1000)
            : "Time elapsed",
      })),
    });
  }, [readyToComplete, stakedMiners, statuses, isCompletingExpedition]);

  // Consider miners ready if ANY are ready to complete, rather than requiring all
  const anyReady = readyToComplete.length > 0;
  // We no longer require all miners to be ready, just at least one
  const miningComplete = anyReady;

  // Enhanced debug logging for expeditions ready to complete
  useEffect(() => {
    if (anyReady && connector) {
      console.log(
        "[ReturnFromMines] Miners ready to complete expedition:",
        readyToComplete.map((m: any) => m.minerId)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyReady, connector, readyToComplete]);

  // Separate the internal expedition completion logic from the UI button handler
  const handleReturnInternal = async () => {
    try {
      // debugger;
      const provider = new ethers.BrowserProvider(connector!.provider);
      const signer = await provider.getSigner();
      const connectedAddress = await signer.getAddress();
      // console.log("TCL: handleReturnInternal -> connectedAddress", connectedAddress)

      // const fetchedGemsbalanceOld: any = await getBalance(connectedAddress, false);

      // console.log('Received GEMS balance: CustomBalance', fetchedGemsbalanceOld);

      const expAddress = getContractAddress("MiningExpeditionProxy");
      const stakingAddress = getContractAddress("StakingProxy");
      if (!expAddress) throw new Error("Missing expedition proxy address");
      if (!stakingAddress) throw new Error("Missing staking proxy address");

      // ABIs for both contracts
      const stakingAbi = [
        "function stakedMiners(uint256 minerId) external view returns (address owner, uint256 stakedAt, bool isStaked)",
        "function getPendingRewards(address user) external view returns (uint256)",
      ];

      const expeditionAbi = [
        "function expeditions(uint256 minerId) external view returns (uint256 startTime, uint256 endTime, bool completed, bool successful, uint256 baseReward, uint256 boostedReward, uint256 boostPercentage)",
        "function completeExpeditions(uint256[] calldata minerIds) external",
        "function completeExpedition(uint256 minerId) external",
        "function MINING_COOLDOWN() external view returns (uint256)",
        "event ExpeditionRewardCalculated(address indexed owner, uint256 indexed minerId, uint256 reward)",
        "function balanceOf(address owner) external view returns (uint256)"
      ];


      const expedition = new ethers.Contract(expAddress, expeditionAbi, signer);
      const staking = new ethers.Contract(stakingAddress, stakingAbi, provider);



      // Check blockchain time for diagnostics
      // const blockNumber = await provider.getBlockNumber();
      // const block = await provider.getBlock(blockNumber);
      // const blockchainTime = block?.timestamp || Math.floor(Date.now() / 1000);
      // const localTime = Math.floor(Date.now() / 1000);
      // console.log(`[ReturnFromMines] Time diagnostics:`, {
      //   blockchainTime,
      //   localTime,
      //   diff: localTime - blockchainTime,
      //   blockNumber,
      // });

      // Get current expedition time setting
      // const cooldownTime = await expedition.MINING_COOLDOWN();
      // console.log(
      //   `[ReturnFromMines] Current expedition duration setting: ${cooldownTime} seconds`
      // );

      // Get potential miners to complete
      const potentialMinerIds = readyToComplete.map(
        ({ minerId }: { minerId: number }) => minerId
      );
      // console.log(
      //   `[ReturnFromMines] Checking ownership for miners:`,
      //   potentialMinerIds
      // );

      // Verify ownership of each miner
      const ownedMinerIds: number[] = [];
      const unownedMinerIds: number[] = [];

      for (const minerId of potentialMinerIds) {
        try {
          const [owner, , isStaked] = await staking.stakedMiners(minerId);
          if (
            isStaked &&
            owner.toLowerCase() === connectedAddress.toLowerCase()
          ) {
            ownedMinerIds.push(minerId);
          } else {
            unownedMinerIds.push(minerId);
            // console.log(
            //   `[ReturnFromMines] Miner ${minerId} not owned by connected wallet (owner: ${owner})`
            // );
          }
        } catch (err) {
          // console.warn(
          //   `[ReturnFromMines] Error checking ownership for miner ${minerId}:`,
          //   err
          // );
          unownedMinerIds.push(minerId);
        }
      }

      // Check if we have any owned miners to complete
      if (ownedMinerIds.length === 0) {
        throw new Error(
          `No owned miners ready for expedition completion. Please connect with the wallet that owns the miners.`
        );
      }

      // If some miners are unowned, show a warning but proceed with owned ones
      if (unownedMinerIds.length > 0) {
        // console.warn(
        //   `[ReturnFromMines] Skipping ${unownedMinerIds.length} miners not owned by connected wallet`
        // );
      }

      // console.log(
      //   `[ReturnFromMines] Attempting to complete expeditions for owned miners:`,
      //   ownedMinerIds
      // );

      // Initialize miners that are truly ready according to blockchain time
      let validatedMinerIds: number[] = [];

      // Validate each miner's expedition against blockchain time
      try {
        const actuallyReadyMiners: number[] = [];
        const notReadyMiners: { minerId: number; reason: string }[] = [];
        const latestBlock = await provider.getBlock("latest");
        const latestBlockchainTime =
          latestBlock?.timestamp || Math.floor(Date.now() / 1000);

        for (const id of ownedMinerIds) {
          try {
            const expeditionData = await expedition.expeditions(BigInt(id));
            const startTime = Number(expeditionData[0]);
            const endTime = Number(expeditionData[1]);
            const completed = expeditionData[2];
            // const successful = expeditionData[3];

            // console.log(`[ReturnFromMines] Miner ${id} expedition data:`, {
            //   startTime,
            //   endTime,
            //   completed,
            //   successful,
            //   blockchainTime: latestBlockchainTime,
            //   readyStatus:
            //     latestBlockchainTime >= endTime
            //       ? "READY"
            //       : `NOT READY (${endTime - latestBlockchainTime}s remaining)`,
            //   startedStatus: startTime > 0 ? "STARTED" : "NOT STARTED",
            // });

            // Verify if this miner is actually ready according to blockchain time
            if (
              startTime > 0 &&
              !completed &&
              latestBlockchainTime >= endTime
            ) {
              actuallyReadyMiners.push(id);
            } else {
              let reason = "Unknown";
              if (startTime === 0) reason = "Expedition not started";
              else if (completed) reason = "Already completed";
              else if (latestBlockchainTime < endTime)
                reason = `Time remaining: ${endTime - latestBlockchainTime}s`;
              notReadyMiners.push({ minerId: id, reason });
            }
          } catch (err) {
            // console.warn(
            //   `[ReturnFromMines] Error checking expedition data for miner ${id}:`,
            //   err
            // );
            notReadyMiners.push({ minerId: id, reason: "Error checking data" });
          }
        }

        // Report on our findings
        if (actuallyReadyMiners.length === 0) {
          // console.warn(
          //   "[ReturnFromMines] No miners are actually ready according to blockchain time!"
          // );
          // console.warn("[ReturnFromMines] Not ready miners:", notReadyMiners);
          throw new Error(
            "No miners are ready for expedition completion according to blockchain time."
          );
        } else if (notReadyMiners.length > 0) {
          // console.warn(
          //   `[ReturnFromMines] ${notReadyMiners.length} miners not ready, proceeding with ${actuallyReadyMiners.length} ready miners`
          // );
          // console.warn("[ReturnFromMines] Not ready miners:", notReadyMiners);
        }

        // Update validated miners list with those truly ready according to blockchain time
        validatedMinerIds = actuallyReadyMiners;
      } catch (error) {
        // console.warn(
        //   "[ReturnFromMines] Error validating expedition readiness:",
        //   error
        // );
        throw error;
      }

      // Use the validated miners list that meets blockchain time requirements
      if (validatedMinerIds.length === 0) {
        throw new Error(
          "No miners are ready for expedition completion according to blockchain time"
        );
      }

      // console.log(
      //   `[ReturnFromMines] Calling completeExpeditions with validated IDs:`,
      //   validatedMinerIds
      // );

      // CRITICAL: Double-verify ownership right before sending transaction
      const doubleCheckedMinerIds: number[] = [];
      // console.log(
      //   `[ReturnFromMines] CRITICAL - Double checking ownership before transaction...`
      // );

      for (const minerId of validatedMinerIds) {
        try {
          const [actualOwner, , isActuallyStaked] = await staking.stakedMiners(
            minerId
          );
          const actualOwnerLower = actualOwner.toLowerCase();
          const connectedAddressLower = connectedAddress.toLowerCase();
          const ownerMatch = actualOwnerLower === connectedAddressLower;

          // console.log(
          //   `[ReturnFromMines] Ownership verification for miner ${minerId}:`,
          //   {
          //     actualOwner,
          //     actualOwnerLower,
          //     connectedAddress,
          //     connectedAddressLower,
          //     isActuallyStaked,
          //     ownerMatch,
          //     contractCallFrom: await signer.getAddress(),
          //   }
          // );

          if (isActuallyStaked && ownerMatch) {
            doubleCheckedMinerIds.push(minerId);
          } else {
            // console.warn(
            //   `[ReturnFromMines] ⚠️ CRITICAL: Miner ${minerId} ownership verification failed in final check`
            // );
          }
        } catch (err) {
          // console.error(
          //   `[ReturnFromMines] Error in final ownership verification for miner ${minerId}:`,
          //   err
          // );
        }
      }

      // Use only miners that passed the double ownership check
      if (doubleCheckedMinerIds.length === 0) {
        throw new Error(
          "No miners passed final ownership verification. Cannot proceed with expedition completion."
        );
      }

      if (doubleCheckedMinerIds.length !== validatedMinerIds.length) {
        // console.warn(
        //   `[ReturnFromMines] ⚠️ Some miners failed final ownership check. Originally had ${validatedMinerIds.length}, now have ${doubleCheckedMinerIds.length}`
        // );
      }

      // console.log(
      //   `[ReturnFromMines] Final transaction will include these miners:`,
      //   doubleCheckedMinerIds
      // );

      // Snapshot pending rewards before completing expeditions
      const prevPendingRewards: bigint = await staking.getPendingRewards(
        connectedAddress
      );

      // Using a different approach: try to complete one miner at a time to isolate which ones have issues
      const successfulMiners: number[] = [];
      const failedMiners: { minerId: number; error: string }[] = [];

      // Update UI status to show processing progress
      const setStatusForUser = (status: string) => {
        // console.log(`[ReturnFromMines] Status: ${status}`);
        setProcessingStatus(status);
      };

      setStatusForUser(
        `Attempting to complete ${doubleCheckedMinerIds.length} expeditions...`
      );

      // Process each miner individually to identify which ones have issues
      for (let i = 0; i < doubleCheckedMinerIds.length; i++) {
        const minerId = doubleCheckedMinerIds[i];
        setStatusForUser(
          `Processing miner #${minerId} (${i + 1}/${doubleCheckedMinerIds.length
          })`
        );

        try {
          // Triple-check ownership immediately before sending transaction
          const [actualOwner, , isActuallyStaked] = await staking.stakedMiners(
            minerId
          );
          const callerAddress = await signer.getAddress();

          if (
            !isActuallyStaked ||
            actualOwner.toLowerCase() !== callerAddress.toLowerCase()
          ) {
            // console.error(
            //   `[ReturnFromMines] Final ownership check failed for miner ${minerId}. Expected: ${callerAddress}, Got: ${actualOwner}`
            // );
            failedMiners.push({
              minerId: minerId,
              error: "Ownership validation failed",
            });
            continue;
          }

          // Attempt to complete this single miner's expedition
          // console.log(
          //   `[ReturnFromMines] Attempting to complete expedition for miner: ${minerId}`
          // );

          // Try both single miner completion and batch completion as fallback
          let tx;
          try {
            // First try the single-miner method
            // Obtain VRF coordinator via minimal ABI (avoid depending on full expedition ABI)
            let vrfCoordinatorAddr: string;
            try {
              const miniExpAbi = ["function vrfCoordinator() view returns (address)"];
              const miniExp = new ethers.Contract(expAddress, miniExpAbi, provider);
              vrfCoordinatorAddr = await miniExp.vrfCoordinator();
            } catch (e) {
              // console.warn("[ReturnFromMines] Could not read vrfCoordinator from contract, using fallback", e);
              vrfCoordinatorAddr = (import.meta.env.VITE_VRF_COORDINATOR as string) ||
                (import.meta.env.VRF_COORDINATOR as string) ||
                "0xa60c1e07fa030e4b49eb54950adb298ab94dd312"; // Saigon default
            }
            const coordinatorAbi = [
              "function estimateRequestRandomFee(uint32,uint256) view returns (uint256)"
            ];
            const coordinator = new ethers.Contract(vrfCoordinatorAddr, coordinatorAbi, provider);
            const CALLBACK_GAS_LIMIT = 200_000;
            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice ?? 0n;
            let fee: bigint;
            try {
              fee = await coordinator.estimateRequestRandomFee(CALLBACK_GAS_LIMIT, gasPrice);
              // add 5% buffer
              const minFee = 50_000_000_000_000_000n; // 0.05 RON
              fee = fee + fee / 5n; // add 20% buffer
              if (fee < minFee) fee = minFee;
            } catch (e) {
              // console.warn("[ReturnFromMines] estimateRequestRandomFee failed, defaulting fee", e);
              fee = 50_000_000_000_000_000n; // 0.05 RON fallback
            }
            // console.log(`[ReturnFromMines] Estimated VRF fee for miner ${minerId}:`, fee.toString());
            // debugger
            if (typeof expedition.completeExpedition === "function") {
              // Perform a static call first to detect obvious revert reasons (optional but helpful)
              try {
                // await expedition.completeExpedition.staticCall(BigInt(minerId), { value: fee });
                await expedition.completeExpedition.staticCall(BigInt(minerId));
              } catch (simErr) {
                console.error(`[ReturnFromMines] Static call revert reason for miner ${minerId}:`, simErr);
              }
              // tx = await expedition.completeExpedition(BigInt(minerId), { value: fee, gasLimit: 500_000 });

              tx = await expedition.completeExpedition(BigInt(minerId));
            } else {
              // Fallback to batch completion with a single miner
              // console.log(
              //   `[ReturnFromMines] Single miner completion not available, using batch method for miner: ${minerId}`
              // );
              tx = await expedition.completeExpeditions([minerId]);
            }
            const receipt = await tx.wait();
            // console.log(
            //   `[ReturnFromMines] Successfully completed expedition for miner: ${minerId}, hash: ${receipt.hash}`
            // );
            successfulMiners.push(minerId);
          } catch (innerErr: any) {
            // If this specific approach fails, it will be caught by the outer catch block
            console.error(
              `[ReturnFromMines] Inner transaction attempt failed: ${JSON.stringify(
                innerErr
              )}`
            );
            throw innerErr;
          }
        } catch (minerErr: any) {
          const errorMsg =
            minerErr.reason || minerErr.message || "Unknown error";
          console.error(
            `[ReturnFromMines] Failed to complete expedition for miner ${minerId}: ${errorMsg}`
          );
          failedMiners.push({ minerId: minerId, error: errorMsg });
        }
      }

      // Log the results for debugging
      // console.log(`[ReturnFromMines] Individual completion results:`, {
      //   successfulMiners,
      //   failedMiners,
      // });

      if (successfulMiners.length === 0) {
        throw new Error(
          `Failed to complete expeditions for any miners. Check logs for details.`
        );
      }

      // const fetchGemsbalanceNew: any = await getBalance(connectedAddress, false);

      // console.log('Received GEMS balance: CustomBalance', fetchGemsbalanceNew);

      // Aggregate rewards via staking pending rewards difference
      setStatusForUser(`Fetching updated pending rewards...`);

      const afterPendingRewards: bigint = await staking.getPendingRewards(
        connectedAddress
      );

      const diff = afterPendingRewards - prevPendingRewards;
      // console.log("TCL: ReturnFromMines -> afterPendingRewards", afterPendingRewards)
      // console.log("TCL: ReturnFromMines -> prevPendingRewards", prevPendingRewards)

      const totalGems = parseFloat(ethers.formatUnits(diff, 18));
      // console.log(`[ReturnFromMines] Pending rewards diff:`, diff);
      // console.log("TCL: ReturnFromMines -> totalGems", totalGems)
      // debugger;


      // console.log("TCL: ReturnFromMines -> diff", diff)
      const anySuccess = successfulMiners.length > 0 && diff > 0;
      // console.log("TCL: ReturnFromMines -> anySuccess", anySuccess)
      // debugger;
      setMiningResults({ success: anySuccess, rewards: { gems: totalGems } });
      setShowResults(true);

      // refresh statuses
      refetch();
    } catch (e) {
      console.error("[ReturnFromMines] Complete expedition error:", e);

      // Provide more helpful error messages based on error type
      const errorMsg = (e as any).message || "Unknown error";

      if (
        errorMsg.includes("Unauthorized") ||
        errorMsg.includes("Not the staked miner owner")
      ) {
        alert(
          "Failed to complete expedition: You are not authorized to complete expeditions for these miners. Please connect with the wallet that owns the miners."
        );
      } else if (
        errorMsg.includes("Expedition not yet ended") ||
        errorMsg.includes("blockchain time")
      ) {
        alert(
          "Failed to complete expedition: The expedition has not ended yet according to blockchain time. Please wait until the expedition is complete."
        );
      } else if (errorMsg.includes("Miner not on expedition")) {
        alert(
          "Failed to complete expedition: One or more miners are not on an expedition or have already completed their expedition."
        );
      } else {
        alert("Failed to complete expedition: " + errorMsg);
      }

      return false; // Failed
    } finally {
      setIsCompletingExpedition(false);
    }
  };

  // UI button handler - only triggered by user action
  const handleReturn = () => {
    if (!connector) {
      alert("Wallet not connected. Please connect your wallet and try again.");
      return;
    }

    if (!anyReady) {
      console.log(
        "[ReturnFromMines] No miners are ready to complete expedition:",
        {
          readyToComplete: readyToComplete.map((m: any) => m.minerId),
          statuses: statuses.map((s: any) => ({
            minerId: s.minerId,
            onExpedition: s.onExpedition,
            endTime: s.endTime,
            currentTime: Math.floor(Date.now() / 1000),
            timeLeft: s.endTime - Math.floor(Date.now() / 1000),
            completed: s.completed,
          })),
        }
      );

      alert(
        "No miners have completed their expedition yet. Please wait until expedition time is finished."
      );
      return;
    }

    // Mark as processing and call the internal handler
    setIsCompletingExpedition(true);
    console.log("[ReturnFromMines] User initiated expedition completion");

    // Make sure we handle the async operation properly
    handleReturnInternal()
      .then((success) => {
        if (success) {
          console.log("[ReturnFromMines] Expedition completion succeeded");
        } else {
          console.log("[ReturnFromMines] Expedition completion failed");
        }
      })
      .catch((err) => {
        console.error(
          "[ReturnFromMines] Unexpected error during expedition completion:",
          err
        );
        alert(
          `Unexpected error: ${err.message || "Unknown error"
          }. Check console for details.`
        );
      })
      .finally(() => {
        setIsCompletingExpedition(false);
      });
  };

  const closeResults = () => {
    setShowResults(false);
    setMiningResults(null);
    refetch();
    window.location.reload();
  };

  const handleReduceTime = async () => {
    try {
      debugger;
      const provider = new ethers.BrowserProvider(connector!.provider);
      const signer = await provider.getSigner();
      const expAddress = getContractAddress("MiningExpeditionProxy");
      // const expAddress = import.meta.env.VITE_TESTNET_FOOD_SYSTEM_PROXY_ADDRESS

      if (!expAddress) throw new Error("Missing expedition proxy address");

      const expeditionAbi = [
        "function expeditions(uint256 minerId) external view returns (uint256 startTime, uint256 endTime, bool completed, bool successful, uint256 baseReward, uint256 boostedReward, uint256 boostPercentage)",
        "function completeExpeditions(uint256[] calldata minerIds) external",
        "function completeExpedition(uint256 minerId) external",
        "function MINING_COOLDOWN() external view returns (uint256)",
        "event ExpeditionRewardCalculated(address indexed owner, uint256 indexed minerId, uint256 reward)",
        "function updateExpeditionTime(uint256 time) external",
        "function setMiningExpeditionAddress(address _miningExpeditionAddress) external"
      ];
      // const minerId = 189;
      const expedition = new ethers.Contract(expAddress, expeditionAbi, signer);


      const estimateTime = 3 * 60
      // const addressTime = "0xe2BeB770C81538B25415300bF2138bc4e517a692"
      // const tx = await expedition.setMiningExpeditionAddress(addressTime);
      const tx = await expedition.updateExpeditionTime(estimateTime);
      await tx.wait();
      console.log("TCL: handleReduceTime -> tx", tx)


      // const findTime = await expedition.expeditions(minerId);
      // const startTime = Number(findTime.startTime);
      // const endTime = Number(findTime.endTime);

      // console.log("Start Time: TCL", new Date(startTime * 1000).toLocaleString());
      // console.log("End Time: TCL", new Date(endTime * 1000).toLocaleString());
      // Get current expedition time setting
      // console.log("TCL: handleReturnInternal -> reduceTime", tx)


    } catch (error) {
      console.log("TCL: handleReduceTime -> error", error)

    }
  }

  return (
    <div className="flex justify-center w-full">
      <div className="w-full flex flex-col items-center gap-2">
        <button
          onClick={handleReturn}
          disabled={!miningComplete || isCompletingExpedition}
          className={`w-full ${miningComplete && !isCompletingExpedition
            ? "bg-amber-500 hover:bg-amber-600"
            : "bg-amber-500/60 cursor-not-allowed"
            } text-black font-semibold p-3 rounded-lg transition-all duration-300 font-winky`}
          data-component-name="ReturnFromMines"
        >
          {isCompletingExpedition
            ? "Returning from Mines..."
            : "Return From The Mines"}
        </button>

        {isCompletingExpedition && processingStatus && (
          <div className="text-sm text-amber-300 mt-2">{processingStatus}</div>
        )}
      </div>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="bg-[#2a1a0a] border-2 border-amber-500/30 rounded-xl p-8 !max-w-2xl">
          <DialogHeader className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Expedition Results</h2>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {miningResults?.success ? (
              <div className="text-center">
                <p className="text-green-400 text-xl mb-4 font-winky">
                  Your miners returned with {miningResults.rewards.gems} gems!
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-red-400 text-xl mb-4 font-winky">
                  Your miners came back empty-handed!
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-center">
            <button
              onClick={closeResults}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-6 py-3 rounded-lg transition-all duration-300 font-winky"
            >
              Collect Rewards
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
