/**
 * @title Dual Registry Service
 * @notice Service for interacting with both old and new MinerNFT Registry contracts
 * @dev Provides methods to check token ownership across both registries during migration
 */

import { ethers } from 'ethers';

/**
 * MinerNFTRegistry ABI for registry operations
 */
const NFT_REGISTRY_ABI = [
  'function tokensOfOwner(address owner) view returns (uint256[])',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function isTokenRegistered(address owner, uint256 tokenId) view returns (bool)',
  'function updateTokenOwnership(address from, address to, uint256 tokenId) external'
];

/**
 * Service for interacting with multiple MinerNFT Registry contracts during migration
 */
export default class DualRegistryService {
  private oldRegistryContract: ethers.Contract | null = null;
  private newRegistryContract: ethers.Contract | null = null;
  private readonly oldRegistryAddress: string | null = null;
  private readonly newRegistryAddress: string | null = null;
  private hasOldRegistry: boolean = false;
  private hasNewRegistry: boolean = false;

  /**
   * Constructor
   * @param provider - Ethers provider
   */
  constructor(provider: ethers.Provider) {
    // Get network-appropriate contract addresses from environment
    const network = import.meta.env.VITE_NETWORK_ENV || 'testnet';
    console.log(`DualRegistryService - Network environment: ${network}`);

    // Get Registry contract addresses
    if (network === 'mainnet') {
      // For mainnet we use both old and new registries
      const oldRegistryEnvKey = 'VITE_MAINNET_MINER_REGISTRY_OLD_ADDRESS';
      const newRegistryEnvKey = 'VITE_MAINNET_MINER_REGISTRY_ADDRESS';

      this.oldRegistryAddress = import.meta.env[oldRegistryEnvKey] || '';
      this.newRegistryAddress = import.meta.env[newRegistryEnvKey] || '';

      if (this.oldRegistryAddress) {
        console.log(`Using old registry at: ${this.oldRegistryAddress}`);
        this.oldRegistryContract = new ethers.Contract(this.oldRegistryAddress, NFT_REGISTRY_ABI, provider);
        this.hasOldRegistry = true;
      }

      if (this.newRegistryAddress) {
        console.log(`Using new registry at: ${this.newRegistryAddress}`);
        this.newRegistryContract = new ethers.Contract(this.newRegistryAddress, NFT_REGISTRY_ABI, provider);
        this.hasNewRegistry = true;
      }
    } else {
      // For testnet we only use the new registry
      const registryEnvKey = 'VITE_TESTNET_MINER_REGISTRY_ADDRESS';
      this.newRegistryAddress = import.meta.env[registryEnvKey] || '';

      if (this.newRegistryAddress) {
        console.log(`Using testnet registry at: ${this.newRegistryAddress}`);
        this.newRegistryContract = new ethers.Contract(this.newRegistryAddress, NFT_REGISTRY_ABI, provider);
        this.hasNewRegistry = true;
      }
    }
  }

  /**
   * Check if a token is registered to an owner in either registry
   * @param ownerAddress - Address to check
   * @param tokenId - Token ID to check
   * @returns Boolean indicating if the token is registered to the owner
   */
  async isTokenRegistered(ownerAddress: string, tokenId: number): Promise<boolean> {
    try {
      // Check new registry first
      if (this.hasNewRegistry && this.newRegistryContract) {
        try {
          const isRegisteredInNew = await this.newRegistryContract.isTokenRegistered(ownerAddress, tokenId);
          if (isRegisteredInNew) {
            return true;
          }
        } catch (error) {
          console.error(`Error checking new registry for token ${tokenId}:`, error);
        }
      }

      // Fall back to old registry if available
      if (this.hasOldRegistry && this.oldRegistryContract) {
        try {
          const isRegisteredInOld = await this.oldRegistryContract.isTokenRegistered(ownerAddress, tokenId);
          return isRegisteredInOld;
        } catch (error) {
          console.error(`Error checking old registry for token ${tokenId}:`, error);
        }
      }

      return false;
    } catch (error) {
      console.error(`Error checking token registration status for ${tokenId}:`, error);
      return false;
    }
  }

  /**
   * Get all tokens owned by an address from both registries
   * @param ownerAddress - Address to check
   * @returns Array of token IDs owned by the address
   */
  async getTokensOfOwner(ownerAddress: string): Promise<number[]> {
    const tokens: number[] = [];
    const processedTokens = new Set<number>();

    try {
      // Try new registry first
      if (this.hasNewRegistry && this.newRegistryContract) {
        try {
          const newTokens = await this.newRegistryContract.tokensOfOwner(ownerAddress);
          for (const token of newTokens) {
            const tokenId = Number(token);
            tokens.push(tokenId);
            processedTokens.add(tokenId);
          }
        } catch (error) {
          console.error('Error fetching tokens from new registry:', error);
        }
      }

      // Check old registry for any additional tokens
      if (this.hasOldRegistry && this.oldRegistryContract) {
        try {
          const oldTokens = await this.oldRegistryContract.tokensOfOwner(ownerAddress);
          for (const token of oldTokens) {
            const tokenId = Number(token);
            // Only add tokens we haven't already found in the new registry
            if (!processedTokens.has(tokenId)) {
              tokens.push(tokenId);
              processedTokens.add(tokenId);
            }
          }
        } catch (error) {
          console.error('Error fetching tokens from old registry:', error);
        }
      }

      return tokens;
    } catch (error) {
      console.error('Error fetching tokens from registries:', error);
      return [];
    }
  }

  /**
   * Update token ownership in the new registry
   * @param tokenId - Token ID to update
   * @returns Transaction response or null if failed
   */
  async updateTokenOwnership(tokenId: number): Promise<ethers.TransactionResponse | null> {
    if (!this.hasNewRegistry || !this.newRegistryContract) {
      console.error('New registry not available');
      return null;
    }

    try {
      const signer = await this.getSigner();
      if (!signer) {
        console.error('No signer available');
        return null;
      }

      const registryWithSigner = this.newRegistryContract.connect(signer) as ethers.Contract;
      const tx = await registryWithSigner.updateTokenOwnership(ethers.ZeroAddress, signer.getAddress(), tokenId);
      return tx;
    } catch (error) {
      console.error(`Error updating token ${tokenId} in registry:`, error);
      return null;
    }
  }

  /**
   * Get a signer for transactions
   * @private
   * @returns Ethers signer or null if not available
   */
  private async getSigner(): Promise<ethers.Signer | null> {
    // Use the new registry contract as our contract reference for getting a signer
    const contract = this.newRegistryContract;
    if (!contract || !contract.runner) {
      return null;
    }

    if ('getSigner' in contract.runner) {
      try {
        return await (contract.runner as ethers.BrowserProvider).getSigner();
      } catch (error) {
        console.error('Failed to get signer:', error);
        return null;
      }
    } else if ('sendTransaction' in contract.runner) {
      return contract.runner as ethers.Signer;
    }

    return null;
  }
}
