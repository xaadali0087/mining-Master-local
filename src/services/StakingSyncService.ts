/**
 * @title StakingSyncService
 * @notice Service for automatically synchronizing staking data with the blockchain
 * @dev Provides real-time data synchronization for staked miners and pending rewards
 */

import { ethers } from 'ethers';
import StakingContractABI from '../contracts/abis/StakingContractABI.json';
import { getContractAddress } from '../config/contracts';

// Minimum time between full blockchain synchronizations
export const MIN_SYNC_INTERVAL = 30000; // 30 seconds

// Interface for staking data
export interface StakingData {
  stakedMiners: number[];
  stakedMinerCount: number;
  pendingRewards: string;
  gemsPerSecond: string;
  lastSyncTimestamp: number;
  userAddress: string;
}

// Interface for owned NFTs
export interface OwnedNFT {
  id: number;
  name: string;
  image: string;
}

/**
 * Service class for automatic blockchain data synchronization
 */
export class StakingSyncService {
  private lastSyncTimestamp: number = 0;
  private syncInterval: NodeJS.Timeout | null = null;
  private provider: ethers.Provider;
  private stakingContract: ethers.Contract;
  private nftContract: ethers.Contract;
  
  /**
   * Create a new StakingSyncService instance
   * @param provider Ethers provider
   */
  constructor(provider: ethers.Provider) {
    try {
      // Get contract addresses
      const stakingAddress = getContractAddress('MiningMastersStaking');
      const nftAddress = getContractAddress('MinerNFT');
      
      console.log('Initializing contracts with addresses:', {
        stakingAddress, 
        nftAddress
      });
      
      // Initialize contracts
      this.stakingContract = new ethers.Contract(
        stakingAddress,
        StakingContractABI,
        provider
      );
      
      // For the NFT contract, use the same ABI since we only need basic ERC721 functions
      this.nftContract = new ethers.Contract(
        nftAddress,
        [
          // Basic ERC721 functions we need
          'function balanceOf(address owner) view returns (uint256)',
          'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
        ],
        provider
      );
      
      this.provider = provider;
    } catch (error) {
      console.error('Failed to initialize StakingSyncService:', error);
      // Create fallback contracts to prevent crashes
      // Using the fallback provider to make sure we have something valid
      const fallbackProvider = provider || new ethers.JsonRpcProvider('http://localhost:8545');
      
      this.stakingContract = new ethers.Contract(
        '0x0000000000000000000000000000000000000000',
        StakingContractABI,
        fallbackProvider
      );
      
      this.nftContract = new ethers.Contract(
        '0x0000000000000000000000000000000000000000',
        [
          'function balanceOf(address owner) view returns (uint256)',
          'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
        ],
        fallbackProvider
      );
      
      this.provider = fallbackProvider;
    }
  }
  
  /**
   * Gets all staking data for a wallet address
   * @param walletAddress User's wallet address
   * @returns Promise with staking data
   */
  async getStakingData(walletAddress: string): Promise<StakingData> {
    try {
      console.log('Fetching staking data for wallet:', walletAddress);
      
      // Get staked miners
      const stakedMiners = await this.stakingContract.getStakedMiners(walletAddress);
      console.log('Staked miners fetched:', stakedMiners);
      
      // Use the length of stakedMiners array as the count (more reliable)
      // This fixes the discrepancy between stakedMiners.length and stakedMinerCount
      const stakedMinerCount = stakedMiners.length;
      console.log('Using staked miner count from array length:', stakedMinerCount);
      
      // Get pending rewards
      const pendingRewards = await this.stakingContract.getPendingRewards(walletAddress);
      const formattedRewards = ethers.formatUnits(pendingRewards, 18);
      console.log('Pending rewards:', formattedRewards);
      
      // Get GEMS per second production rate
      const gemsPerSecond = await this.stakingContract.GEMS_PER_SECOND();
      const formattedRate = ethers.formatUnits(gemsPerSecond, 18);
      console.log('GEMS per second rate:', formattedRate);
      
      // Update last sync timestamp
      this.lastSyncTimestamp = Date.now();
      
      // Return the staking data
      return {
        stakedMiners: stakedMiners.map((id: bigint) => Number(id)),
        stakedMinerCount: Number(stakedMinerCount),
        pendingRewards: formattedRewards,
        gemsPerSecond: formattedRate,
        lastSyncTimestamp: this.lastSyncTimestamp,
        userAddress: walletAddress
      };
    } catch (error) {
      console.error('Error fetching staking data:', error);
      
      // Return fallback data to prevent UI crashes
      return {
        stakedMiners: [],
        stakedMinerCount: 0,
        pendingRewards: '0',
        gemsPerSecond: '0',
        lastSyncTimestamp: Date.now(),
        userAddress: walletAddress
      };
    }
  }
  
  /**
   * Gets all owned NFTs for a wallet
   * @param walletAddress User's wallet address
   * @returns Promise with owned NFTs
   */
  async getOwnedNFTs(walletAddress: string): Promise<OwnedNFT[]> {
    try {
      // Get balance
      const balance = await this.nftContract.balanceOf(walletAddress);
      
      // Get all token IDs
      const nfts: OwnedNFT[] = [];
      for (let i = 0; i < Number(balance); i++) {
        const tokenId = await this.nftContract.tokenOfOwnerByIndex(walletAddress, i);
        
        // Create NFT object with minimal data
        // In a real implementation, you might fetch more data from the NFT contract
        nfts.push({
          id: Number(tokenId),
          name: `Miner #${String(Number(tokenId)).padStart(3, '0')}`,
          image: "/images/Miner.png"
        });
      }
      
      return nfts;
    } catch (error) {
      console.error('Error fetching owned NFTs:', error);
      throw error;
    }
  }
  
  /**
   * Sets up automatic synchronization of staking data
   * @param walletAddress User's wallet address
   * @param callback Function to call with updated data
   * @param intervalMs How often to sync (minimum 30 seconds)
   * @returns Cleanup function to stop syncing
   */
  setupAutoSync(
    walletAddress: string, 
    callback: (data: StakingData) => void,
    intervalMs: number = 60000 // Default to 60 seconds
  ): () => void {
    // Ensure minimum interval
    const syncIntervalMs = Math.max(intervalMs, MIN_SYNC_INTERVAL);
    
    // Clear any existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    // Immediately fetch data
    this.getStakingData(walletAddress)
      .then(data => callback(data))
      .catch(err => console.error('Error in initial staking data sync:', err));
    
    // Set up interval for future updates
    this.syncInterval = setInterval(() => {
      this.getStakingData(walletAddress)
        .then(data => callback(data))
        .catch(err => console.error('Error in staking data sync:', err));
    }, syncIntervalMs);
    
    // Return cleanup function
    return () => {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
    };
  }
  
  /**
   * Manually triggers a synchronization if enough time has passed
   * @param walletAddress User's wallet address
   * @param callback Function to call with updated data
   * @returns Promise that resolves when sync is complete
   */
  async manualSync(
    walletAddress: string,
    callback: (data: StakingData) => void
  ): Promise<void> {
    // Only sync if it's been at least MIN_SYNC_INTERVAL since last sync
    const now = Date.now();
    if (now - this.lastSyncTimestamp >= MIN_SYNC_INTERVAL) {
      try {
        console.log('Starting manual sync for wallet:', walletAddress);
        const data = await this.getStakingData(walletAddress);
        callback(data);
        console.log('Manual sync completed successfully');
      } catch (error) {
        console.error('Error in manual sync:', error);
        // Call callback with fallback data to prevent UI crashes
        callback({
          stakedMiners: [],
          stakedMinerCount: 0,
          pendingRewards: '0',
          gemsPerSecond: '0',
          lastSyncTimestamp: Date.now(),
          userAddress: walletAddress
        });
      }
    } else {
      console.log(`Skipping manual sync - last sync was ${(now - this.lastSyncTimestamp) / 1000} seconds ago`);
    }
  }
  
  /**
   * Estimate pending rewards based on local calculation
   * @param baseRewards Base rewards from last blockchain sync
   * @param gemsPerSecond Production rate per miner per second
   * @param minerCount Number of staked miners
   * @param lastUpdateTime Timestamp of last blockchain update
   * @returns Estimated current rewards
   */
  estimateCurrentRewards(
    baseRewards: string,
    gemsPerSecond: string,
    minerCount: number,
    lastUpdateTime: number
  ): string {
    if (minerCount === 0) return baseRewards;
    
    // Calculate time elapsed since last update (in seconds)
    const elapsed = (Date.now() - lastUpdateTime) / 1000;
    
    // Calculate additional rewards based on production rate and number of miners
    const rate = Number(gemsPerSecond);
    const additionalRewards = rate * minerCount * elapsed;
    
    // Add to base rewards
    const updatedRewards = Number(baseRewards) + additionalRewards;
    
    return updatedRewards.toString();
  }
}

export default StakingSyncService;
