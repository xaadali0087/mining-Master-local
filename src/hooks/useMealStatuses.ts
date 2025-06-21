import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useRoninWallet } from '@/services/wallet/RoninWalletProvider';
import { getContractAddress } from '@/config/contracts';

export interface MealStatus {
  id: number;
  canEat: boolean;
  timeUntil: number; // seconds remaining until available (0 if available)
}

/**
 * Fetches meal availability across ALL staked miners for the current wallet.
 * Re-computes every `refreshInterval` ms (default 30s).
 */
export function useMealStatuses(refreshInterval = 60000) { // Increased default interval to 60 seconds
  const { connector, address } = useRoninWallet();
  const [stakedMiners, setStakedMiners] = useState<number[]>([]);
  const [statuses, setStatuses] = useState<MealStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [lastValidStakedMiners, setLastValidStakedMiners] = useState<number[]>([]);

  // Track previous values to detect changes
  const [prevStatusesStr, setPrevStatusesStr] = useState<string>('[]');

  // Get staked miners directly from the contract - exactly as in batch-check-feeding.ts
  const fetchStakedMiners = useCallback(async () => {
    if (!connector || !address) {
      console.log('No wallet connector or address available - keeping last known state');
      return lastValidStakedMiners;
    }

    try {
      const provider = new ethers.BrowserProvider(connector.provider);
      const stakingAddress = getContractAddress('StakingProxy');
      if (!stakingAddress) {
        console.error('Staking contract address not found');
        return lastValidStakedMiners;
      }

      const stakingAbi = ['function getStakedMiners(address owner) view returns (uint256[])'];
      const stakingContract = new ethers.Contract(stakingAddress, stakingAbi, provider);

      // Get staked miners directly from the contract
      const miners = await stakingContract.getStakedMiners(address);
      const minerIds = miners.map((id: bigint) => Number(id));

      // Reduced logging
      // console.log(`[useMealStatuses] Retrieved ${minerIds.length} staked miners directly from contract`);

      // Only update if we have valid data
      if (minerIds.length > 0) {
        setStakedMiners(minerIds);
        setLastValidStakedMiners(minerIds);
        return minerIds;
      }
      return lastValidStakedMiners;
    } catch (error) {
      console.error('Error fetching staked miners:', error);
      return lastValidStakedMiners;
    }
  }, [connector, address, lastValidStakedMiners]);

  useEffect(() => {
    const currentStatusesStr = JSON.stringify(statuses.map(s => s.canEat));
    if (prevStatusesStr !== currentStatusesStr) {
      // Only log significant changes, not every change
      // console.log(`[${new Date().toISOString()}] Meal statuses changed:`, {
      //   canEat: statuses.filter(s => s.canEat).length,
      //   total: statuses.length
      // });
      setPrevStatusesStr(currentStatusesStr);
    }
  }, [statuses, prevStatusesStr]);

  const fetchStatuses = useCallback(async (force = false) => {
    // Avoid excessive refetching in short time periods
    const now = Date.now();
    if (!force && now - lastFetchTime < 15000) { // Increased to 15 second cooldown on frequent refetches
      // Skip without logging to reduce console noise
      return;
    }
    setLastFetchTime(now);
    try {
      setLoading(true);

      // Get the latest staked miners from our direct contract query
      const currentMiners = await fetchStakedMiners();

      if (!connector || currentMiners.length === 0) {
        console.log('[useMealStatuses] No staked miners found or wallet disconnected');
        setLoading(false);
        return;
      }
      const provider = new ethers.BrowserProvider(connector.provider);
      const foodAddress = getContractAddress('FoodSystemProxy');
      if (!foodAddress) return;
      const abi = [
        'function getMealCount() view returns (uint256)',
        'function canEatMeal(uint256 minerId, uint256 mealId) view returns (bool,uint256)'
      ];
      const food = new ethers.Contract(foodAddress, abi, provider);
      const mealCount: number = Number(await food.getMealCount());

      // Ensure FOOD_ITEMS length aligns but fallback to contract length
      const ids = [...Array(mealCount).keys()];

      const newStatuses: MealStatus[] = [];

      // Use a consistent timestamp for all calculations - not currently used but kept for future reference
      // const nowTimestamp = Math.floor(Date.now() / 1000);
      // Removed excessive logging and unused variable
      // console.log(`[${new Date().toISOString()}] Fetching meal statuses with timestamp ${timestamp}`);

      await Promise.all(ids.map(async (id) => {
        const results = await Promise.all(
          currentMiners.map((miner: number) => food.canEatMeal(miner, id))
        );

        let mealCanEat = true;
        let worstTimeUntil = 0;
        for (const [canEat, time] of results) {
          if (!canEat) {
            mealCanEat = false;
            const t = Number(time);
            if (t > worstTimeUntil) worstTimeUntil = t;
          }
        }
        newStatuses.push({ id, canEat: mealCanEat, timeUntil: worstTimeUntil });
      }));
      setStatuses(newStatuses);
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch meal statuses', e);
      setLoading(false);
    }
  }, [connector, lastFetchTime, fetchStakedMiners]);

  // Fetch staked miners initially and when dependencies change
  useEffect(() => {
    const getMiners = async () => {
      await fetchStakedMiners();
    };
    getMiners();
  }, [fetchStakedMiners, connector, address]);

  useEffect(() => {
    // Initial fetch after a slight delay to avoid immediate load
    const initialFetchTimer = setTimeout(() => fetchStatuses(true), 500);

    // Use a more stable interval refresh with a longer interval
    const t = setInterval(() => fetchStatuses(false), refreshInterval);

    // Clean up both timers on unmount
    return () => {
      clearTimeout(initialFetchTimer);
      clearInterval(t);
    };
  }, [refreshInterval]); // Remove fetchStatuses dependency to prevent recreation of interval

  // Expose a refetch method
  const refetch = useCallback(() => fetchStatuses(true), [fetchStatuses]);

  return {
    statuses,
    loading,
    refetch,
    stakedMinerCount: stakedMiners.length
  };
}
