/**
 * @title Contract Address Configuration
 * @notice Manages contract addresses for different network environments
 * @dev Maps contract names to their deployed addresses on mainnet and testnet
 */

// Network IDs for Ronin blockchain
// Mainnet: 2020
// Saigon testnet: 2021

/**
 * Contract address mapping structure
 */
interface ContractAddresses {
  [key: string]: {
    [network: string]: string;
  };
}

/**
 * Contract addresses for different networks
 * Contract addresses are loaded from environment variables:
 * - Testnet addresses: VITE_TESTNET_GEMS_TOKEN_ADDRESS, VITE_TESTNET_MINER_NFT_ADDRESS, VITE_TESTNET_STAKING_PROXY_ADDRESS
 * - Mainnet addresses will use similar variables when mainnet deployment is ready
 */
const CONTRACT_ADDRESSES: ContractAddresses = {
  // GEMS Token contract
  GEMSToken: {
    // Mainnet address should be updated after mainnet deployment
    mainnet: import.meta.env.VITE_MAINNET_GEMS_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000',
    // Saigon testnet address from environment variables
    testnet: import.meta.env.VITE_TESTNET_GEMS_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000',
  },

  // Miner NFT contract
  MinerNFT: {
    mainnet: import.meta.env.VITE_MAINNET_MINER_NFT_ADDRESS || '0x0000000000000000000000000000000000000000',
    testnet: import.meta.env.VITE_TESTNET_MINER_NFT_ADDRESS || '0x0000000000000000000000000000000000000000',
  },

  // Mining Masters Staking contract
  MiningMastersStaking: {
    mainnet: import.meta.env.VITE_MAINNET_STAKING_PROXY_ADDRESS || '0x0000000000000000000000000000000000000000',
    testnet: import.meta.env.VITE_TESTNET_STAKING_PROXY_ADDRESS || '0x0000000000000000000000000000000000000000',
  },

  // Alias for StakingProxy (used by StakingService)
  StakingProxy: {
    mainnet: import.meta.env.VITE_MAINNET_STAKING_PROXY_ADDRESS || '0x0000000000000000000000000000000000000000',
    testnet: import.meta.env.VITE_TESTNET_STAKING_PROXY_ADDRESS || '0x0000000000000000000000000000000000000000',
  },

  // Food System proxy contract
  FoodSystemProxy: {
    mainnet: import.meta.env.VITE_MAINNET_FOOD_SYSTEM_PROXY_ADDRESS || '0x0000000000000000000000000000000000000000',
    testnet: import.meta.env.VITE_TESTNET_FOOD_SYSTEM_PROXY_ADDRESS || '0x0000000000000000000000000000000000000000',
  },

  // RewardSpendingBatch contract
  RewardSpendingBatch: {
    mainnet: import.meta.env.VITE_MAINNET_REWARD_SPENDING_BATCH_ADDRESS || '0x0000000000000000000000000000000000000000',
    testnet: import.meta.env.VITE_TESTNET_REWARD_SPENDING_BATCH_ADDRESS || '0x0000000000000000000000000000000000000000',
  },

  // Mining Expedition proxy contract
  MiningExpeditionProxy: {
    mainnet: import.meta.env.VITE_MAINNET_MINING_EXPEDITION_PROXY_ADDRESS || '0x0000000000000000000000000000000000000000',
    testnet: import.meta.env.VITE_TESTNET_MINING_EXPEDITION_PROXY_ADDRESS || '0x0000000000000000000000000000000000000000',
  }
};

/**
 * Gets the correct contract address based on the current network environment
 * @param contractName - Name of the contract to get the address for
 * @param debug - Optional flag to enable debug logging
 * @returns The contract address for the current network
 */
export function getContractAddress(contractName: string, debug: boolean = false): string {
  // Get the current network from environment variables
  // Default to testnet for development safety
  const network = import.meta.env.VITE_NETWORK_ENV || 'testnet';

  // Only log if debug is enabled
  if (debug) {
    console.log(`Using network: ${network} for contract ${contractName}`);
    console.log(`Network env value: ${import.meta.env.VITE_NETWORK_ENV}`);
  }

  // Map contract aliases to actual configuration keys
  const contractMap: { [key: string]: string } = {
    // Add contract name mappings here
    'StakingSystem': 'MiningMastersStaking',
    'StakingProxy': 'StakingProxy',  // Direct mapping
    'MinerNFT': 'MinerNFT',  // Direct mapping
    'MiningSystem': 'MiningExpeditionProxy',
    'FoodSystem': 'FoodSystemProxy'
  };

  // Resolve the actual contract key to use
  const contractKey = contractMap[contractName] || contractName;

  // Check if the contract exists in our configuration
  if (!CONTRACT_ADDRESSES[contractKey]) {
    throw new Error(`Contract ${contractName} (mapped to ${contractKey}) not found in address configuration`);
  }

  // Check if the network is configured for this contract
  if (!CONTRACT_ADDRESSES[contractKey][network]) {
    throw new Error(`Network ${network} not configured for contract ${contractName} (mapped to ${contractKey})`);
  }

  // Get the raw address from configuration
  let address = CONTRACT_ADDRESSES[contractKey][network];

  // Clean up the address in case there's a comment attached to it without a space
  if (address && address.length > 42) {
    // Extract just the address part (0x + 40 hex chars)
    const addressMatch = address.match(/0x[a-fA-F0-9]{40}/);
    if (addressMatch) {
      const cleanedAddress = addressMatch[0];
      if (debug) {
        console.log(`Fixed malformed contract address: ${contractName} on ${network}`);
        console.log(`Original: ${address}`);
        console.log(`Cleaned: ${cleanedAddress}`);
      }
      address = cleanedAddress;
    }
  }

  return address;
}

/**
 * Gets the Ronin network chain ID based on the environment
 * @returns The chain ID (2020 for mainnet, 2021 for testnet)
 */
export function getChainId(): number {
  const network = import.meta.env.VITE_NETWORK_ENV || 'testnet';
  return network === 'mainnet' ? 2020 : 2021;
}

export default {
  getContractAddress,
  getChainId
};
