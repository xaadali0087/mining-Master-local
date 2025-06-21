/**
 * @title RewardsPanel component
 * @notice Component for displaying and claiming pending rewards
 * @dev Uses the useStaking hook to interact with the staking contract
 */

import React, { useState } from 'react';
import { useStaking } from '../hooks/useStaking';
import { useRoninWallet } from '../services/wallet/RoninWalletProvider';

export const RewardsPanel: React.FC = () => {
  const { isConnected } = useRoninWallet();
  const { 
    pendingRewards, 
    isLoading,
    claimRewards,
    refreshStakingData 
  } = useStaking();
  
  const [isClaiming, setIsClaiming] = useState(false);
  
  const handleClaimRewards = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }
    
    if (Number(pendingRewards) <= 0) {
      alert("No rewards to claim");
      return;
    }
    
    setIsClaiming(true);
    try {
      const tx = await claimRewards();
      if (!tx) {
        throw new Error("Failed to submit transaction");
      }
      
      console.log("Claim rewards transaction:", tx);
      
      // Wait for transaction receipt
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);
      
      // Refresh staking data
      await refreshStakingData();
      
      alert(`Successfully claimed ${pendingRewards} GEMS!`);
    } catch (error) {
      console.error("Error claiming rewards:", error);
      alert("Failed to claim rewards. Please try again.");
    } finally {
      setIsClaiming(false);
    }
  };
  
  // Format pending rewards for display (limit to 4 decimal places)
  const formattedRewards = Number(pendingRewards).toFixed(4);
  
  return (
    <div className="bg-[#2a1a0a] border-2 border-amber-500/40 rounded-xl p-4 shadow-lg">
      <h3 className="text-amber-400 font-bold font-winky text-center mb-2">Pending Rewards</h3>
      
      <div className="flex justify-between items-center bg-[#1a0d00]/50 rounded-lg p-3 mb-4 border border-amber-500/20">
        <div className="flex items-center">
          <img src="/images/Mine.png" alt="GEMS" className="w-6 h-6 mr-2" />
          <span className="text-amber-400 font-bold">{isLoading ? "Loading..." : formattedRewards}</span>
        </div>
        <span className="text-amber-400/70 text-xs">GEMS</span>
      </div>
      
      <button
        onClick={handleClaimRewards}
        disabled={isClaiming || isLoading || !isConnected || Number(pendingRewards) <= 0}
        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold py-2 rounded-lg transition-all duration-300 font-winky shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isClaiming ? "Claiming..." : "Claim Rewards"}
      </button>
      
      {!isConnected && (
        <p className="text-red-400 text-xs text-center mt-2">Connect wallet to claim</p>
      )}
      
      {isConnected && Number(pendingRewards) <= 0 && (
        <p className="text-amber-400/70 text-xs text-center mt-2">No rewards available yet</p>
      )}
    </div>
  );
};

export default RewardsPanel;
