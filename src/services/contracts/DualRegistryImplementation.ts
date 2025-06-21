/**
 * @title Dual Registry Implementation
 * @notice Implementation of the dual registry service for migration period
 * @dev Provides methods to interact with both old and new NFT registries with self-healing
 */

import { ethers } from 'ethers';
import RegistryService from './RegistryService';

/**
 * Self-healing utility class for registry integration
 */
export class RegistryHelper {
  private registryService: RegistryService;
  private provider: ethers.Provider;

  constructor(provider: ethers.Provider) {
    this.provider = provider;
    this.registryService = new RegistryService(provider);
  }

  /**
   * Check if a token is registered to an address with self-healing functionality
   * @param walletAddress - Owner's wallet address
   * @param tokenId - Token ID to check and potentially heal
   * @returns Promise resolving to boolean indicating registry status
   */
  async verifyAndHealRegistry(walletAddress: string, tokenId: number): Promise<boolean> {
    try {
      // First check if token is properly registered
      const isRegistered = await this.registryService.isTokenRegistered(walletAddress, tokenId);
      
      // If not registered, update the registry (self-healing)
      if (!isRegistered) {
        console.log(`Token #${tokenId} not in registry, performing self-healing...`);
        
        // Update token ownership in registry
        const tx = await this.registryService.updateTokenOwnership(tokenId, walletAddress);
        
        if (tx) {
          // Wait for transaction to be mined
          await tx.wait();
          console.log(`Registry updated for token #${tokenId}`);
          return true;
        } else {
          console.warn(`Failed to update registry for token #${tokenId}`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error(`Error during registry verification/healing for token #${tokenId}:`, error);
      return false;
    }
  }

  /**
   * Get signer from provider
   * @returns Ethers signer or null
   */
  async getSigner(): Promise<ethers.Signer | null> {
    if (!this.provider) {
      return null;
    }
    
    if ('getSigner' in this.provider) {
      try {
        return await (this.provider as ethers.BrowserProvider).getSigner();
      } catch (error) {
        console.error('Failed to get signer:', error);
        return null;
      }
    }
    
    return null;
  }
}

/**
 * How to use this in a component:
 * 
 * 1. Create the helper in your component:
 *    const [registryHelper, setRegistryHelper] = useState<RegistryHelper | null>(null);
 *    
 *    useEffect(() => {
 *      if (connector && connector.provider) {
 *        const provider = new ethers.BrowserProvider(connector.provider);
 *        setRegistryHelper(new RegistryHelper(provider));
 *      }
 *    }, [connector]);
 * 
 * 2. Use before staking or unstaking:
 *    if (registryHelper) {
 *      const walletAddress = await signer.getAddress();
 *      await registryHelper.verifyAndHealRegistry(walletAddress, tokenId);
 *    }
 */
