/**
 * @title Registry Healer
 * @notice Simple utility for registry self-healing during migration
 * @dev Uses both old and new registries for token ownership verification
 */

import { ethers } from 'ethers';
import RegistryService from './RegistryService';

/**
 * Simple utility class for registry self-healing during migration
 */
export class RegistryHealer {
  private registryService: RegistryService;
  
  /**
   * Create a new RegistryHealer
   * @param provider - Ethers provider
   */
  constructor(provider: ethers.Provider) {
    this.registryService = new RegistryService(provider);
  }
  
  /**
   * Heal token registry if needed
   * @param tokenId - Token ID to heal
   * @param ownerAddress - Current owner address
   * @returns True if healing was successful or not needed
   */
  public async healRegistry(tokenId: number, ownerAddress: string): Promise<boolean> {
    try {
      // Check if token is already registered correctly
      const isRegistered = await this.registryService.isTokenRegistered(ownerAddress, tokenId);
      
      // If already registered, nothing to do
      if (isRegistered) {
        console.log(`Token #${tokenId} already registered correctly to ${ownerAddress}`);
        return true;
      }
      
      console.log(`Token #${tokenId} not registered to ${ownerAddress}, healing...`);
      
      // Update the registry
      const tx = await this.registryService.updateTokenOwnership(tokenId, ownerAddress);
      if (!tx) {
        console.warn(`Failed to update registry for token #${tokenId}`);
        return false;
      }
      
      // Wait for transaction to complete
      await tx.wait();
      console.log(`Successfully healed registry for token #${tokenId}`);
      return true;
    } catch (error) {
      console.error(`Error healing registry for token #${tokenId}:`, error);
      return false;
    }
  }
}

export default RegistryHealer;
