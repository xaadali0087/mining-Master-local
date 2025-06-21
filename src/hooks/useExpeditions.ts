import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ethers } from 'ethers';
import { useRoninWallet } from '@/services/wallet/RoninWalletProvider';
import { getContractAddress } from '@/config/contracts';
import MiningExpeditionABI from '@/contracts/abis/MiningExpeditionABI.json';
import FoodSystemABI from '@/contracts/abis/FoodSystemABI.json';

// For operation tracking to prevent race conditions
let globalOperationCounter = 0;

// Debug flag to enable verbose logging
const DEBUG = true;

// Cooldown constants
const REFETCH_COOLDOWN_MS = 5000; // 5 seconds cooldown between fetches
const FETCH_DEBOUNCE_MS = 300; // 300ms debounce for fetch calls
const MEAL_DURATION_SECONDS = 6 * 60 * 60; // 6 hours in seconds

// Log with timestamp and optional operation ID
const logDebug = (message: string, opId?: number) => {
  if (!DEBUG) return;
  const timestamp = new Date().toISOString();
  const opIdStr = opId !== undefined ? `[Op:${opId}] ` : '';
  console.log(`[${timestamp}] ${opIdStr}${message}`);
};

export interface ExpeditionStatus {
  minerId: number;
  onExpedition: boolean;
  startTime: number;
  endTime: number; // seconds since epoch
  completed: boolean;
  eligibleForNewExpedition: boolean;
  fedStatus: {
    mealId: number;
    timestamp: number;
    isActive: boolean; // true if miner is currently fed with a meal
    expiryTime: number; // When the meal expires
  };
}

/**
 * Hook to manage expedition statuses for all staked miners
 * Includes sequential fetching with race condition prevention and caching for UI stability
 * @param refreshIntervalMs How often to auto-refresh (default: 60 seconds)
 */
export function useExpeditions(refreshIntervalMs = 60000) {
  // We'll use a ref for tracking current operation ID instead of state to avoid re-renders
  const currentOpIdRef = useRef<number>(0);
  
  // Primary states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [statuses, setStatuses] = useState<ExpeditionStatus[]>([]);
  
  // Cache state to prevent UI flickering during connection issues - used for final status output
  const [lastValidStakedMiners, setLastValidStakedMiners] = useState<number[]>([]);
  
  // Cooldown timer to prevent excessive refetching
  const lastFetchTimeRef = useRef<number>(0);
  const fetchInProgressRef = useRef<boolean>(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  
  // Access wallet info
  const { connector, address, chainId } = useRoninWallet();
  
  // Stable refs to prevent dependency issues
  const walletRef = useRef({ connector, address, chainId });
  
  // Update refs when wallet info changes
  useEffect(() => {
    walletRef.current = { connector, address, chainId };
  }, [connector, address, chainId]);
  
  // Create a debounced version of the fetch function to prevent multiple simultaneous calls
  const debouncedFetchRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sequential fetch logic with race condition prevention
  const fetchStatuses = useCallback(async (force = false) => {
    // Cancel any pending debounced fetch
    if (debouncedFetchRef.current) {
      clearTimeout(debouncedFetchRef.current);
      debouncedFetchRef.current = null;
    }
    
    // Create a debounced version to prevent multiple calls in quick succession
    debouncedFetchRef.current = setTimeout(async () => {
      // Get current wallet data from ref to avoid dependency issues
      const { connector, address } = walletRef.current;
      
      // Skip if there's no wallet connection
      if (!connector || !address) {
        logDebug('No wallet connection, skipping fetch');
        setError(new Error('Wallet not connected'));
        // Do not reset statuses to empty to avoid UI flickering
        // Instead keep last valid data but mark as not initialized
        setInitialized(false);
        return;
      }
      
      // Skip if another fetch is already in progress
      if (fetchInProgressRef.current) {
        logDebug('Fetch already in progress, skipping');
        return;
      }
      
      // Handle cooldown unless forced
      const now = Date.now();
      if (!force && now - lastFetchTimeRef.current < REFETCH_COOLDOWN_MS) {
        logDebug(`Skipping fetch due to cooldown (${now - lastFetchTimeRef.current}ms < ${REFETCH_COOLDOWN_MS}ms)`);
        return;
      }
      
      // Mark fetch as in progress
      fetchInProgressRef.current = true;
      
      // Start a new operation and track its ID
      const opId = ++globalOperationCounter;
      currentOpIdRef.current = opId;
      lastFetchTimeRef.current = now;
    
    logDebug(`Starting expedition status fetch operation ${opId} at ${new Date().toISOString()}`);
    setLoading(true);
    setError(null);
    
    try {
      // Create provider and get contracts
      const provider = await connector.getProvider();
      // Use BrowserProvider for ethers v6
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      
      // Get consistent contract addresses for all operations
      const stakingAddress = getContractAddress('StakingSystem');
      const miningAddress = getContractAddress('MiningSystem');
      const foodAddress = getContractAddress('FoodSystem');
      
      logDebug(`Using contracts: Staking=${stakingAddress}, Mining=${miningAddress}, Food=${foodAddress}`, opId);
      
      // Create contract instances
      const stakingContract = new ethers.Contract(
        stakingAddress,
        [
          'function getStakedMiners(address owner) view returns (uint256[])',
        ],
        signer
      );
      
      const miningContract = new ethers.Contract(
        miningAddress,
        (MiningExpeditionABI as any).abi,
        signer
      );
      
      // Get meal cooldown directly from food contract
      const foodContract = new ethers.Contract(
        foodAddress,
        (FoodSystemABI as any).abi,
        signer
      );
      
      // Use a consistent timestamp for all calculations in this fetch operation
      const currentTimestampSeconds = Math.floor(now / 1000);
      const nowDate = new Date();
      logDebug(`Using consistent timestamp for calculations: ${currentTimestampSeconds} (${nowDate.toISOString()})`, opId);
      logDebug(`CRITICAL Debug - Current JS timestamp: ${currentTimestampSeconds}, formatted: ${nowDate.toLocaleString()}`, opId);
      
      // Get meal cooldown duration once - no need to fetch for each miner
      let mealCooldownSecs = MEAL_DURATION_SECONDS; // Default to 6 hours if not fetched
      try {
        const rawCooldown = await foodContract.MEAL_COOLDOWN();
        mealCooldownSecs = Number(rawCooldown);
        logDebug(`Fetched meal cooldown duration: ${mealCooldownSecs/3600} hours`, opId);
      } catch (error) {
        logDebug(`Error fetching meal cooldown, using default: ${error instanceof Error ? error.message : error}`, opId);
      }
      
      // Get staked miners with fallback to last valid list on error
      let stakedMiners: number[] = [];
      try {
        // Get staked miners
        const stakedMinersResult = await stakingContract.getStakedMiners(address);
        stakedMiners = stakedMinersResult.map((bn: ethers.BigNumberish) => Number(bn));
        
        if (stakedMiners.length > 0) {
          setLastValidStakedMiners(stakedMiners);
          logDebug(`Found ${stakedMiners.length} staked miners: ${stakedMiners.join(', ')}`, opId);
        } else {
          logDebug('No staked miners found', opId);
        }
      } catch (err) {
        // Log the specific error for debugging
        logDebug(`Error fetching staked miners: ${err instanceof Error ? err.message : String(err)}`, opId);
        
        // Fall back to cached miners to prevent UI flickering
        stakedMiners = lastValidStakedMiners;
        logDebug(`Using cached list with ${stakedMiners.length} miners: ${stakedMiners.join(', ')}`, opId);
      }
      
      // Create new statuses array to collect results
      const newStatuses: ExpeditionStatus[] = [];
      
      // Process miners sequentially to avoid race conditions
      for (const minerId of stakedMiners) {
        // Skip processing if this operation was superseded by a newer one
        if (opId !== globalOperationCounter) {
          logDebug(`Operation ${opId} was superseded, aborting`, opId);
          return;
        }
        
        try {
          logDebug(`Processing miner ${minerId}`, opId);
          
          // Create fallback/stub values in case of contract errors
          let startTimeValue = 0;
          let endTimeValue = 0;
          let completedValue = false;
          let isOnExpedition = false;
          
          // CRITICAL FIX: First try to get expedition data
          try {
            const expeditionData = await miningContract.expeditions(minerId);
            startTimeValue = Number(expeditionData.startTime);
            endTimeValue = Number(expeditionData.endTime);
            completedValue = expeditionData.completed;
            
            // Determine if miner is on expedition (active)
            isOnExpedition = startTimeValue > 0 && endTimeValue > 0 && !completedValue;
            logDebug(`Miner ${minerId} expedition data: start=${startTimeValue}, end=${endTimeValue}, completed=${completedValue}`, opId);
          } catch (expErr) {
            // If expeditions call fails, use default values
            logDebug(`Error fetching expedition data for miner ${minerId}: ${expErr instanceof Error ? expErr.message : String(expErr)}`, opId);
          }
          
          // Fetch meal info with robust error handling
          let mealId = 0;
          let mealTimestamp = 0;
          let fed = false;
          
          try {
            // Try to get meal status from contract
            const mealInfo = await foodContract.getMinerMealStatus(minerId);
            mealId = Number(mealInfo.mealId);
            mealTimestamp = Number(mealInfo.timestamp);
            
            // Skipping time since meal calculation since we use direct comparison now
            
            // ======= CONTRACT-ALIGNED MEAL ELIGIBILITY LOGIC =======
            // CRITICAL FIX: Use the SAME logic as the MiningExpedition contract!
            // Step 1: Understand what the contract is actually checking
            // From MiningExpeditionUpgradeable._startExpeditionInternal:
            // require(mealTimestamp > 0, "Miner has not eaten");
            
            // The contract ONLY checks if mealTimestamp > 0
            // It doesn't care about meal expiry at all!
            
            // Step 2: Apply contract's exact logic to determine if miner is "fed"
            const mealEverConsumed = mealTimestamp > 0;
            
            // Step 3: Still calculate expiry for UI display purposes only
            const mealExpiryTime = mealTimestamp + mealCooldownSecs;
            const mealActiveByExpiry = mealExpiryTime > currentTimestampSeconds;
            
            // Step 4: Set fed status based on contract's check ONLY
            // This ensures that UI and contract are in sync
            fed = mealEverConsumed; // This is the key fix
            
            // Step 5: Log any discrepancies for monitoring
            if (mealEverConsumed !== mealActiveByExpiry) {
              logDebug(`⚠️ MISMATCH: Miner ${minerId} contract eligibility (${mealEverConsumed}) vs UI logic (${mealActiveByExpiry})`, opId);
              logDebug(`  • Meal timestamp: ${mealTimestamp} (${new Date(mealTimestamp * 1000).toLocaleString()})`, opId);
              logDebug(`  • Expiry time: ${mealExpiryTime} (${new Date(mealExpiryTime * 1000).toLocaleString()})`, opId);
              logDebug(`  • Current time: ${currentTimestampSeconds} (${new Date(currentTimestampSeconds * 1000).toLocaleString()})`, opId);
              logDebug(`  • UI would show it as ${mealActiveByExpiry ? 'ELIGIBLE' : 'INELIGIBLE'}`, opId);
              logDebug(`  • Contract would show it as ${mealEverConsumed ? 'ELIGIBLE' : 'INELIGIBLE'}`, opId);
            }
            
            // VERBOSE LOGGING: Show exact numeric comparison for meal expiry calculation
            logDebug(`MEAL CALC for Miner ${minerId}:`, opId);
            logDebug(`  Meal ID: ${mealId}`, opId);
            logDebug(`  Meal timestamp: ${mealTimestamp} (${new Date(mealTimestamp * 1000).toLocaleString()})`, opId);
            logDebug(`  Current timestamp: ${currentTimestampSeconds} (${new Date(currentTimestampSeconds * 1000).toLocaleString()})`, opId);
            logDebug(`  Meal cooldown: ${mealCooldownSecs/3600}h (${mealCooldownSecs}s)`, opId);
            logDebug(`  Meal expiry: ${mealExpiryTime} (${new Date(mealExpiryTime * 1000).toLocaleString()})`, opId);
            logDebug(`  Raw meal timestamp check (contract): ${mealTimestamp} > 0 = ${mealEverConsumed}`, opId);
            logDebug(`  Expiry check (UI only): ${mealExpiryTime} > ${currentTimestampSeconds} = ${mealActiveByExpiry}`, opId);
            logDebug(`  Fed status (using contract logic): ${fed}`, opId);
            
            // Log detailed meal status for debugging - be very explicit about each state
            if (mealTimestamp > 0) {
              const hoursSinceMeal = Math.floor((currentTimestampSeconds - mealTimestamp) / 3600);
              const minutesSinceMeal = Math.floor(((currentTimestampSeconds - mealTimestamp) % 3600) / 60);
              logDebug(`Miner ${minerId} last fed ${hoursSinceMeal}h ${minutesSinceMeal}m ago, contract eligible=${mealEverConsumed}, expiry=${new Date(mealTimestamp + mealCooldownSecs * 1000).toISOString()}`, opId);
            }
          } catch (mealErr) {
            // Default to assuming not fed if we can't fetch the meal status
            logDebug(`Error fetching meal status for miner ${minerId}: ${mealErr instanceof Error ? mealErr.message : String(mealErr)}`, opId);
            // Keep default values (not fed)
          }
          
          // Calculate meal expiry time based on meal cooldown (not meal duration)
          const mealExpiryTime = mealTimestamp + mealCooldownSecs;
          
          // Is the meal currently active? (same as "fed" now)
          const isMealActive = fed;
          
          // For expedition eligibility, we need to check if the miner is NOT currently active on a meal
          // i.e., we need to feed the miner before starting expedition
          const needsFeeding = !fed;
          
          if (minerId === 119) {
            logDebug(`Miner 119 details: mealId=${mealId}, timestamp=${mealTimestamp}, ` +
              `expiry=${mealExpiryTime}, now=${currentTimestampSeconds}, ` +
              `active=${isMealActive}, diff=${mealExpiryTime - currentTimestampSeconds}s`, opId);
          }
          
          // Log detailed feeding info
          logDebug(`Miner ${minerId} feeding status: mealId=${mealId}, timestamp=${mealTimestamp}, ` +
            `expiry=${new Date(mealExpiryTime * 1000).toISOString()}, ` +
            `active=${isMealActive}`, opId);
          
          // Determine expedition eligibility
          // NOTE: Miner must meet ALL criteria to be eligible:
          // 1. Not currently on expedition
          // 2. Has an active meal (i.e., is properly fed)
          const eligibleForNewExpedition = !isOnExpedition && isMealActive;
          
          if (!eligibleForNewExpedition) {
            logDebug(`Miner ${minerId} ineligible: onExpedition=${isOnExpedition}, ` +
              `needsFeeding=${needsFeeding} (meal expires ${new Date(mealTimestamp + mealCooldownSecs * 1000).toISOString()}), ` +
              `fed=${isMealActive}`, opId);
          }
          
          // Create status object
          const status: ExpeditionStatus = {
            minerId,
            onExpedition: isOnExpedition,
            startTime: startTimeValue,
            endTime: endTimeValue,
            completed: completedValue,
            eligibleForNewExpedition,
            fedStatus: {
              mealId,
              timestamp: mealTimestamp,
              isActive: isMealActive,
              expiryTime: mealExpiryTime
            }
          };
          
          newStatuses.push(status);
        } catch (err) {
          logDebug(`Error processing miner ${minerId}: ${err}`, opId);
          // Skip this miner but continue with others
        }
      }
      
      // Only complete the operation if it hasn't been superseded
      if (opId === globalOperationCounter) {
        setInitialized(true);
        
        // We no longer need to cache last valid statuses as we're using the current statuses directly
        // We have robust fallback logic in place with lastValidStakedMiners
        
        if (stakedMiners.length > 0) {
          setLastValidStakedMiners(stakedMiners);
        }
        
        // Update primary state
        logDebug(`[Op:${opId}] Setting ${newStatuses.length} expedition statuses for ${stakedMiners.length} staked miners`, opId);
        setStatuses(newStatuses);
        
        // Calculate how long until we can fetch again (for UI feedback)
        setCooldownTime(now + REFETCH_COOLDOWN_MS);
      } else {
        logDebug(`[Op:${opId}] Operation ${opId} completed but was superseded, discarding results`, opId);
      }
    } catch (err) {
      // Only update error if this is still the current operation
      if (opId === globalOperationCounter) {
        console.error('Error fetching expedition statuses:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      // Only update loading state if this is still the current operation
      if (opId === globalOperationCounter) {
        setLoading(false);
      }
      
      // Mark fetch as complete regardless of outcome
      fetchInProgressRef.current = false;
    }
    
    // Clear the debounced function ref
    debouncedFetchRef.current = null;
    
    }, FETCH_DEBOUNCE_MS); // End of setTimeout debounce wrapper
    
    // Return early - the actual work happens asynchronously in the timeout
    return;
  }, []); // Empty dependency array since we're using refs for all dependencies
  
  // Initial fetch and refresh interval
  useEffect(() => {
    // Force refresh immediately on mount
    fetchStatuses(true);
    
    // Set up refresh interval
    const intervalId = setInterval(() => fetchStatuses(), refreshIntervalMs);
    
    // Clean up on unmount
    return () => {
      // Clear any pending debounced fetch
      if (debouncedFetchRef.current) {
        clearTimeout(debouncedFetchRef.current);
        debouncedFetchRef.current = null;
      }
      
      // Clear the interval
      clearInterval(intervalId);
      
      // Increment operation counter to cancel any in-flight operations
      globalOperationCounter++;
    };
  }, [fetchStatuses, refreshIntervalMs]); // Removed connector and address dependencies since we use refs
  
  // Trigger a fetch when wallet connection changes
  useEffect(() => {
    if (!connector) {
      logDebug('Wallet disconnected, clearing status data');
      setStatuses([]);
      setInitialized(false);
    } else {
      // Force a refresh when wallet connects to ensure we get fresh data
      fetchStatuses(true);
    }
  }, [connector, fetchStatuses]);
  
  // Derived state - calculate if any miners are on expedition
  const anyOnExpedition = useMemo(() => {
    return initialized && statuses.some(s => s.onExpedition);
  }, [initialized, statuses]);
  
  // Derived state - calculate latest expedition end time
  const latestEndTime = useMemo(() => {
    if (statuses.length === 0) return 0;
    return Math.max(...statuses.map(s => s.endTime));
  }, [statuses]);
  
  // Derived state - calculate miners ready to complete expedition
  const readyToComplete = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return statuses.filter(s => s.onExpedition && s.endTime <= now && !s.completed);
  }, [statuses]);
  
  // Derived state - calculate miners eligible for expedition
  const eligibleMiners = useMemo(() => {
    return statuses.filter(s => s.eligibleForNewExpedition).map(s => s.minerId);
  }, [statuses]);
  
  // Derived state - calculate all miners eligibility status
  const allMinersEligible = useMemo(() => {
    if (statuses.length === 0) return false;
    return statuses.every(s => s.eligibleForNewExpedition);
  }, [statuses]);
  
  // Derived state - calculate if all miners are properly fed
  // This is the key connection point to our EatButton component's feeding status
  const allMinersFed = useMemo(() => {
    if (statuses.length === 0) return false;
    const result = statuses.every(s => s.fedStatus?.isActive === true);
    logDebug(`All miners fed check: ${result} (${statuses.length} miners total)`); 
    return result;
  }, [statuses]);
  
  // Function to force a refresh
  const forceRefresh = useCallback(() => {
    logDebug('Force refreshing expedition statuses');
    fetchStatuses(true);
  }, [fetchStatuses]);
  
  // Log detailed state changes for debugging feeding and eligibility issues
  useEffect(() => {
    if (DEBUG && statuses.length > 0) {
      console.log('📊 Expedition status check:', {
        totalMiners: statuses.length,
        fedMiners: statuses.filter(s => s?.fedStatus?.isActive).length,
        eligibleMiners: statuses.filter(s => s.eligibleForNewExpedition).length,
        allMinersFed: statuses.every(s => s?.fedStatus?.isActive),
        allMinersEligible: statuses.every(s => s.eligibleForNewExpedition),
        timestamp: new Date().toISOString(),
        minerDetails: statuses.map(s => ({
          minerId: s.minerId,
          mealId: s.fedStatus?.mealId,
          mealTimestamp: s.fedStatus?.timestamp,
          mealActive: s.fedStatus?.isActive,
          eligibleForExpedition: s.eligibleForNewExpedition
        }))
      });
    }
  }, [statuses]);

  return {
    loading,
    error,
    statuses,
    anyOnExpedition,
    latestEndTime,
    initialized,
    forceRefresh,
    cooldownTime,
    allMinersEligible,
    allMinersFed,
    readyToComplete, // Restored for ReturnFromMines component
    eligibleMiners,   // Exposing for components that need it
    refetch: forceRefresh, // Alias for compatibility
  };
}
