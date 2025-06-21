/**
 * @title useStaking hook
 * @notice Custom React hook for integrating the StakingService with UI components
 * @dev Provides a clean interface for components to interact with the staking contract
 */

import { ethers } from 'ethers';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BALANCE_REFRESH_EVENT } from '../components/WalletConnector';
import { getContractAddress } from '../config/contracts';
import NFTService, { NFT } from '../services/contracts/NFTService';
import StakingService from '../services/contracts/StakingService';
import StakingSyncService, { StakingData } from '../services/StakingSyncService';
import { useRoninWallet } from '../services/wallet/RoninWalletProvider';

// Define types for staking operations
export interface StakingState {
  stakedMiners: number[];
  stakedMinerCount: number;
  pendingRewards: string;
  gemsPerSecond: string; // GEMS earned per second per miner
  lastRewardsUpdate: number; // Timestamp of last blockchain update
  isLoading: boolean;
  error: string | null;
  availableMiners: NFT[];
  loadingMiners: boolean;
  autoSyncEnabled: boolean; // Whether auto-sync is enabled
  estimatedRewards: string; // Locally estimated rewards that update in real-time
}

export function useStaking() {
  // Get wallet context from RoninWallet provider
  const { isConnected, connector, address } = useRoninWallet();
  const [stakingService, setStakingService] = useState<StakingService | null>(null);
  const [nftService, setNftService] = useState<NFTService | null>(null);
  const [syncService, setSyncService] = useState<StakingSyncService | null>(null);

  // References for cleanup and intervals
  const cleanupSyncRef = useRef<(() => void) | null>(null);
  const rewardsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State for staking operations
  const [state, setState] = useState<StakingState>({
    stakedMiners: [],
    stakedMinerCount: 0,
    pendingRewards: '0',
    gemsPerSecond: '0',
    lastRewardsUpdate: Date.now(),
    isLoading: false,
    error: null,
    availableMiners: [],
    loadingMiners: false,
    autoSyncEnabled: false,
    estimatedRewards: '0'
  });

  // Initialize services when wallet connects
  useEffect(() => {
    console.log("addresss", address)
    if (isConnected && connector && address) {
      try {
        // Create provider from connector
        const provider = new ethers.BrowserProvider(connector.provider);

        // Initialize services
        const stakingService = new StakingService(provider);
        const nftService = new NFTService(provider);
        const syncService = new StakingSyncService(provider);

        // Set services in state
        setStakingService(stakingService);
        setNftService(nftService);
        setSyncService(syncService);

        // Get initial contract state
        refreshStakingData();

        // Set up automatic data synchronization
        setupAutoSync(address, syncService);
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to initialize services'
        }));
      }
    }

    // Clean up when component unmounts or wallet disconnects
    return () => {
      // Stop auto-sync
      if (cleanupSyncRef.current) {
        cleanupSyncRef.current();
        cleanupSyncRef.current = null;
      }

      // Clear rewards update interval
      if (rewardsIntervalRef.current) {
        clearInterval(rewardsIntervalRef.current);
        rewardsIntervalRef.current = null;
      }
    };
  }, [connector, isConnected, address]);

  // Set up automatic blockchain data synchronization
  const setupAutoSync = useCallback((walletAddress: string, syncSvc: StakingSyncService) => {
    console.log(`Setting up auto sync for wallet ${walletAddress}`);

    // Handle blockchain data updates
    const handleSyncUpdate = (data: StakingData) => {
      console.log('Received blockchain data update:', data);

      setState(prev => ({
        ...prev,
        stakedMiners: data.stakedMiners,
        stakedMinerCount: data.stakedMinerCount,
        pendingRewards: data.pendingRewards,
        estimatedRewards: data.pendingRewards, // Initially set estimated to actual
        gemsPerSecond: data.gemsPerSecond,
        lastRewardsUpdate: data.lastSyncTimestamp,
        isLoading: false,
        error: null,
        autoSyncEnabled: true
      }));

      // After getting data from blockchain, fetch available miners
      fetchAvailableMiners();

      // Set up local rewards estimation timer
      setupRewardsEstimation(
        data.pendingRewards,
        data.gemsPerSecond,
        data.stakedMinerCount,
        data.lastSyncTimestamp
      );
    };

    // Set up sync with 30 second interval
    const cleanup = syncSvc.setupAutoSync(walletAddress, handleSyncUpdate, 30000);
    cleanupSyncRef.current = cleanup;

    return cleanup;
  }, []);

  // Set up local estimation of rewards between blockchain updates
  const setupRewardsEstimation = useCallback((
    baseRewards: string,
    gemsPerSecond: string,
    minerCount: number,
    lastUpdateTime: number
  ) => {
    // Clear any existing interval
    if (rewardsIntervalRef.current) {
      clearInterval(rewardsIntervalRef.current);
    }

    // No need for estimation if no miners are staked
    if (minerCount === 0) return;

    // Update rewards estimation every second
    rewardsIntervalRef.current = setInterval(() => {
      if (syncService) {
        const estimated = syncService.estimateCurrentRewards(
          baseRewards,
          gemsPerSecond,
          minerCount,
          lastUpdateTime
        );

        setState(prev => ({
          ...prev,
          estimatedRewards: estimated
        }));
      }
    }, 1000);
  }, [syncService]);

  // To prevent multiple simultaneous calls
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const FETCH_COOLDOWN_MS = 5000; // 5 second cooldown
  const stakedMinersRef = useRef<number[]>([]);

  // Keep the ref updated with latest stakedMiners
  useEffect(() => {
    stakedMinersRef.current = state.stakedMiners;
  }, [state.stakedMiners]);

  // Fetch available miners for staking with debounce
  const fetchAvailableMiners = useCallback(async (force = false) => {
    if (!nftService || !address) return;

    // Add debounce to prevent excessive calls
    const now = Date.now();
    if (!force && now - lastFetchTime < FETCH_COOLDOWN_MS) {
      console.log(`Skipping NFT fetch - last fetch was ${Math.floor((now - lastFetchTime) / 1000)}s ago (cooldown: ${FETCH_COOLDOWN_MS / 1000}s)`);
      return;
    }

    setLastFetchTime(now);

    setState(prev => ({
      ...prev,
      loadingMiners: true,
      error: null // Clear any previous errors when starting a new fetch
    }));

    try {
      console.log(`Fetching NFTs for wallet ${address}...`);
      // Get all NFTs owned by the connected address using the updated NFTService
      const ownedNFTs = await nftService.getOwnedNFTs(address);

      console.log(`Successfully fetched ${ownedNFTs.length} NFTs:`, ownedNFTs.map(nft => nft.id));

      // Filter out already staked miners - use the ref to avoid dependency issues
      const availableForStaking = ownedNFTs.filter(nft =>
        !stakedMinersRef.current.includes(Number(nft.id))
      );

      console.log(`${availableForStaking.length} NFTs available for staking`);

      setState(prev => ({
        ...prev,
        availableMiners: availableForStaking,
        loadingMiners: false,
        error: null
      }));
    } catch (error) {
      console.error('Error fetching NFTs:', error);

      // Provide a more detailed error message for debugging
      const errorMessage = error instanceof Error
        ? `Failed to fetch NFTs: ${error.message}`
        : 'Failed to fetch NFTs: Unknown error';

      setState(prev => ({
        ...prev,
        loadingMiners: false,
        error: errorMessage
      }));
    }
  }, [nftService, address, lastFetchTime]);

  // Get all staking data for a user
  const refreshStakingData = useCallback(async () => {
    if (!address) {
      console.log('Cannot refresh staking data: Wallet not connected');
      setState(prev => ({ ...prev, error: 'Wallet not connected' }));
      return;
    }

    // Check if services are properly initialized before proceeding
    if (!stakingService || !syncService) {
      console.log('Cannot refresh staking data: Services not fully initialized yet');
      // Don't show error to user as services might still be initializing
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Try to use sync service first if available
      if (syncService && state.autoSyncEnabled) {
        await syncService.manualSync(address, (data: StakingData) => {
          setState(prev => ({
            ...prev,
            stakedMiners: data.stakedMiners,
            stakedMinerCount: data.stakedMinerCount,
            pendingRewards: data.pendingRewards,
            estimatedRewards: data.pendingRewards,
            gemsPerSecond: data.gemsPerSecond,
            lastRewardsUpdate: data.lastSyncTimestamp,
            isLoading: false,
            error: null
          }));

          // Update local estimation
          setupRewardsEstimation(
            data.pendingRewards,
            data.gemsPerSecond,
            data.stakedMinerCount,
            data.lastSyncTimestamp
          );
        });
      }
      // Fall back to direct contract calls
      else if (stakingService) {
        // Get staked miners
        const miners = await stakingService.getStakedMiners(address);
        console.log('Staked miners:', miners);

        // Get staked miner count
        const count = await stakingService.getStakedMinerCount(address);
        console.log('Staked miner count:', count);

        // Get pending rewards
        const rewards = await stakingService.getPendingRewards(address);
        console.log('Pending rewards:', rewards);

        // Get GEMS per second rate for estimation
        const gemsPerSecond = await stakingService.getProductionRate();
        console.log('GEMS per second per miner:', gemsPerSecond);

        // Get user purchased slots
        const purchasedSlots = await stakingService.getUserPurchasedSlots(address);
        console.log('User purchased slots:', purchasedSlots);

        const timestamp = Date.now();

        setState(prev => ({
          ...prev,
          stakedMiners: miners,
          stakedMinerCount: count,
          pendingRewards: rewards,
          estimatedRewards: rewards,
          gemsPerSecond: gemsPerSecond,
          lastRewardsUpdate: timestamp,
          purchasedSlots: purchasedSlots,
          isLoading: false
        }));

        // Set up local rewards estimation
        setupRewardsEstimation(rewards, gemsPerSecond, count, timestamp);

        // Dispatch balance refresh event after staking data is updated
        setTimeout(() => {
          console.log('Dispatching balance refresh event from refreshStakingData');
          window.dispatchEvent(new Event(BALANCE_REFRESH_EVENT));
        }, 500); // Small delay to ensure state updates have propagated
      } else {
        throw new Error('Services not initialized');
      }

      // Always refresh available miners
      await fetchAvailableMiners();

    } catch (error) {
      console.error('Error fetching staking data:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to fetch staking data'
      }));
    }
  }, [address, stakingService, syncService, state.autoSyncEnabled, setupRewardsEstimation, fetchAvailableMiners]);

  // Stake a miner NFT
  const stakeMiner = useCallback(async (tokenId: number) => {
    if (!stakingService || !nftService) {
      throw new Error('Services not initialized');
    }

    const stakingContractAddress = getContractAddress('MiningMastersStaking');
    console.log(`Using staking contract address: ${stakingContractAddress}`);

    // First check if the NFT is already approved
    const isApproved = await nftService.isApprovedForStaking(tokenId, stakingContractAddress);

    if (!isApproved) {
      console.log(`NFT #${tokenId} not approved. Sending approval transaction...`);
      // If not approved, send approval transaction first
      const approveTx = await nftService.approveNFT(tokenId, stakingContractAddress);

      // Wait for approval transaction to be mined
      console.log('Waiting for approval transaction to be mined...');
      await approveTx.wait();
      console.log('Approval transaction mined successfully!');
    } else {
      console.log(`NFT #${tokenId} is already approved for staking`);
    }

    // Now that the NFT is approved, stake it
    console.log(`Staking NFT #${tokenId}...`);
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const tx = await stakingService.stakeMiner(tokenId);

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log('Staking transaction confirmed:', receipt);

      // Refresh staking data after successful transaction
      await refreshStakingData();

      // Trigger GEMS balance refresh after successful operation
      window.dispatchEvent(new Event(BALANCE_REFRESH_EVENT));

      return tx;
    } catch (error) {
      console.error('Error staking miner:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to stake miner'
      }));
      return null;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [stakingService, nftService, refreshStakingData]);

  // Unstake a miner NFT
  const unstakeMiner = useCallback(async (tokenId: number) => {
    if (!stakingService) {
      setState(prev => ({ ...prev, error: 'Staking service not initialized' }));
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const tx = await stakingService.unstakeMiner(tokenId);

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log('Unstaking transaction confirmed:', receipt);

      // Refresh staking data after successful transaction
      await refreshStakingData();

      // Trigger GEMS balance refresh after successful operation
      window.dispatchEvent(new Event(BALANCE_REFRESH_EVENT));

      return tx;
    } catch (error) {
      console.error('Error unstaking miner:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to unstake miner'
      }));
      return null;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [stakingService, refreshStakingData]);

  // Unstake multiple miners at once
  const unstakeMiners = useCallback(async (tokenIds: number[]) => {
    if (!stakingService) {
      setState(prev => ({ ...prev, error: 'Staking service not initialized' }));
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const tx = await stakingService.unstakeMiners(tokenIds);

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log('Bulk unstaking transaction confirmed:', receipt);

      // Refresh staking data after successful transaction
      await refreshStakingData();

      // Trigger GEMS balance refresh after successful operation
      window.dispatchEvent(new Event(BALANCE_REFRESH_EVENT));

      return tx;
    } catch (error) {
      console.error('Error unstaking multiple miners:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to unstake miners'
      }));
      return null;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [stakingService, refreshStakingData]);

  // Claim pending rewards
  const claimRewards = useCallback(async () => {
    if (!stakingService) {
      setState(prev => ({ ...prev, error: 'Staking service not initialized' }));
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const tx = await stakingService.claimRewards();

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log('Claim rewards transaction confirmed:', receipt);

      // Refresh staking data after successful transaction
      await refreshStakingData();

      // Trigger GEMS balance refresh after successful operation
      window.dispatchEvent(new Event(BALANCE_REFRESH_EVENT));

      return tx;
    } catch (error) {
      console.error('Error claiming rewards:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to claim rewards'
      }));
      return null;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [stakingService, refreshStakingData]);

  const getUserPurchasedSlots = useCallback(async () => {
    if (!stakingService || !address) {
      setState(prev => ({ ...prev, error: 'Staking service not initialized' }));
      return null;
    }
    return await stakingService.getUserPurchasedSlots(address);
  }, [stakingService, address]);


  // Track previous staked miners for deep comparison to avoid unnecessary fetches
  const prevStakedMinersRef = useRef<number[]>([]);

  // Refresh available miners after staking/unstaking - only on initial load or when staked miners ACTUALLY change
  useEffect(() => {
    // Skip if not connected
    if (!isConnected || !address) return;

    // Deep compare current and previous staked miners to detect real changes
    const currentMiners = state.stakedMiners;
    const prevMiners = prevStakedMinersRef.current;

    // Check if miners array length changed
    const lengthChanged = currentMiners.length !== prevMiners.length;

    // Check if any miner IDs changed (if lengths are the same)
    let contentChanged = false;
    if (!lengthChanged) {
      // Sort copies of arrays to ensure consistent comparison
      const sortedCurrent = [...currentMiners].sort((a, b) => a - b);
      const sortedPrev = [...prevMiners].sort((a, b) => a - b);

      for (let i = 0; i < sortedCurrent.length; i++) {
        if (sortedCurrent[i] !== sortedPrev[i]) {
          contentChanged = true;
          break;
        }
      }
    }

    // Initial load (prevMiners empty) or actual change in miners
    const initialLoad = prevMiners.length === 0 && currentMiners.length > 0;
    const shouldFetch = initialLoad || lengthChanged || contentChanged;

    if (shouldFetch) {
      console.log('Triggering NFT fetch - detected actual change in staked miners:', {
        initialLoad,
        lengthChanged,
        contentChanged,
        prevCount: prevMiners.length,
        currentCount: currentMiners.length
      });
      fetchAvailableMiners(true);

      // Update ref with current miners for future comparison
      prevStakedMinersRef.current = [...currentMiners];
    }
    // fetchAvailableMiners is intentionally omitted from dependencies to prevent loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stakedMiners, isConnected, address]);

  // Return the hook's public API
  return {
    ...state,
    stakeMiner,
    unstakeMiner,
    unstakeMiners,
    claimRewards,
    refreshStakingData,
    fetchAvailableMiners,
    getUserPurchasedSlots
  };
}

export default useStaking;
