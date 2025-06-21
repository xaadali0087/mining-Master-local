/**
 * @title Registry Service
 * @notice Service for interacting with the MinerNFT Registry contracts
 * @dev Handles both old and new registry contracts during migration period
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
 * Service for interacting with MinerNFT Registry contracts
 */
export default class RegistryService {
  private newRegistryContract: ethers.Contract | null = null;
  private oldRegistryContract: ethers.Contract | null = null;
  private readonly newRegistryAddress: string | null = null;
  private readonly oldRegistryAddress: string | null = null;

  // Track which registries are active
  private hasNewRegistry: boolean = false;
  private hasOldRegistry: boolean = false;

  // Network we're connected to
  private readonly network: string;

  /**
   * Constructor
   * @param provider - Ethers provider
   */
  constructor(provider: ethers.Provider) {
    // Get network-appropriate contract addresses from environment
    this.network = import.meta.env.VITE_NETWORK_ENV || 'testnet';
    console.log(`RegistryService - Network environment: ${this.network}`);

    // Initialize registry contracts based on network
    if (this.network === 'mainnet') {
      // On mainnet, we need to check both old and new registries
      // Get the new registry address
      const newRegistryAddress = import.meta.env.VITE_MAINNET_MINER_REGISTRY_ADDRESS || '';
      if (newRegistryAddress && ethers.isAddress(newRegistryAddress)) {
        this.newRegistryAddress = newRegistryAddress;
        this.newRegistryContract = new ethers.Contract(newRegistryAddress, NFT_REGISTRY_ABI, provider);
        this.hasNewRegistry = true;
        console.log(`Connected to new registry at: ${newRegistryAddress}`);
      }

      // Also get the old registry address if available
      // The frontend can store this as VITE_MAINNET_MINER_REGISTRY_OLD_ADDRESS
      const oldRegistryAddress = import.meta.env.VITE_MAINNET_MINER_REGISTRY_OLD_ADDRESS || '';
      if (oldRegistryAddress && ethers.isAddress(oldRegistryAddress)) {
        this.oldRegistryAddress = oldRegistryAddress;
        this.oldRegistryContract = new ethers.Contract(oldRegistryAddress, NFT_REGISTRY_ABI, provider);
        this.hasOldRegistry = true;
        console.log(`Connected to old registry at: ${oldRegistryAddress}`);
      }
    } else {
      // On testnet, we only use the new registry
      const registryAddress = import.meta.env.VITE_TESTNET_MINER_REGISTRY_ADDRESS || '';
      if (registryAddress && ethers.isAddress(registryAddress)) {
        this.newRegistryAddress = registryAddress;
        this.newRegistryContract = new ethers.Contract(registryAddress, NFT_REGISTRY_ABI, provider);
        this.hasNewRegistry = true;
        console.log(`Connected to testnet registry at: ${registryAddress}`);
      }
    }

    // Log registry status
    if (!this.hasNewRegistry && !this.hasOldRegistry) {
      console.warn('No registry contracts connected. Registry features will not be available.');
    }
  }

  /**
   * Check if a token is registered to an address in either registry
   * @param ownerAddress - Address to check
   * @param tokenId - Token ID to check registration for
   * @returns Boolean indicating if the token is registered
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
          console.warn(`Error checking new registry for token ${tokenId}:`, error);
        }
      }

      // If not found in new registry, check old registry
      if (this.hasOldRegistry && this.oldRegistryContract) {
        try {
          const isRegisteredInOld = await this.oldRegistryContract.isTokenRegistered(ownerAddress, tokenId);
          return isRegisteredInOld;
        } catch (error) {
          console.warn(`Error checking old registry for token ${tokenId}:`, error);
        }
      }

      // Not found in either registry
      return false;
    } catch (error) {
      console.error(`Registry service error checking token ${tokenId}:`, error);
      return false;
    }
  }

  /**
   * Get all tokens registered to an address from both registries
   * @param ownerAddress - Address to check
   * @returns Array of token IDs
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
          console.log(`Found ${newTokens.length} tokens in new registry`);
        } catch (error) {
          console.warn('Error fetching tokens from new registry:', error);
        }
      }

      // Then check old registry for any additional tokens
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
          console.log(`Found ${oldTokens.length} tokens in old registry, ${tokens.length} unique tokens total`);
        } catch (error) {
          console.warn('Error fetching tokens from old registry:', error);
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
   * @param currentOwner - Current owner of the token
   * @returns Transaction response or null if failed
   */
  async updateTokenOwnership(tokenId: number, currentOwner: string): Promise<ethers.TransactionResponse | null> {
    if (!this.hasNewRegistry || !this.newRegistryContract) {
      console.error('New registry not available for updating');
      return null;
    }

    try {
      const signer = await this.getSigner();
      if (!signer) {
        console.error('No signer available for registry update');
        return null;
      }

      // Connect the registry contract with a signer
      const registryWithSigner = this.newRegistryContract.connect(signer) as ethers.Contract;

      // Update the token ownership
      // For NFTs that changed owners, update from the previous owner to the current owner
      // For newly discovered tokens, update from the zero address to the current owner
      const from = ethers.ZeroAddress; // Default is zero address (like a mint)
      const tx = await registryWithSigner.updateTokenOwnership(from, currentOwner, tokenId);

      console.log(`Token #${tokenId} update transaction submitted: ${tx.hash}`);
      return tx;
    } catch (error) {
      console.error(`Error updating token #${tokenId} in registry:`, error);
      return null;
    }
  }

  /**
   * Get a signer for transactions
   * @private
   * @returns Ethers signer or null if not available
   */
  private async getSigner(): Promise<ethers.Signer | null> {
    // Use the new registry contract for getting a signer
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

  /**
   * Check if any registry is available
   * @returns Boolean indicating if registry services are available
   */
  hasAnyRegistry(): boolean {
    return this.hasNewRegistry || this.hasOldRegistry;
  }
}
