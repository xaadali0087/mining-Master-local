/**
 * @title MiningMastersStaking Interface
 * @description TypeScript interface for the MiningMastersStaking contract
 * @dev Provides type-safe contract interactions for the Frontend using ethers.js v6
 */

import { ethers } from 'ethers';

/**
 * Staked Miner data structure that matches the contract's StakedMiner struct
 */
export interface StakedMiner {
  owner: string;
  stakedAt: bigint;
  isStaked: boolean;
}

/**
 * MiningMastersStaking interface matching the contract's public methods
 * Using ethers.js v6 types and conventions
 */
export interface IMiningMastersStaking {
  // Constants
  GEMS_PER_SECOND(): Promise<bigint>;
  MAX_MINERS_PER_WALLET(): Promise<bigint>;
  SCALING_FACTOR(): Promise<bigint>;
  
  // Staking functions
  stakeMiner(tokenId: bigint | number): Promise<ethers.TransactionResponse>;
  unstakeMiner(tokenId: bigint | number): Promise<ethers.TransactionResponse>;
  unstakeMiners(tokenIds: (bigint | number)[]): Promise<ethers.TransactionResponse>;
  
  // View functions
  stakedMiners(tokenId: bigint | number): Promise<[string, bigint, boolean]>; // Returns a tuple matching the struct
  userStakedMiners(user: string, index: bigint | number): Promise<bigint>;
  stakedMinerCount(user: string): Promise<bigint>;
  lastRewardCalculation(user: string): Promise<bigint>;
  pendingRewards(user: string): Promise<bigint>;
  
  // User operations
  getStakedMiners(user: string): Promise<bigint[]>;
  getStakedMinerCount(user: string): Promise<bigint>;
  getPendingRewards(user: string): Promise<bigint>;
  claimRewards(): Promise<ethers.TransactionResponse>;
  
  // Contract state functions
  paused(): Promise<boolean>;
}

/**
 * Default export for the contract interface
 */
export default IMiningMastersStaking;
