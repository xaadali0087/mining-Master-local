/**
 * @title Simple Registry Healer
 * @notice Utility for registry self-healing during migration without ERC721Enumerable
 * @dev Uses registry services directly for token verification
 */

import { ethers } from 'ethers';
import RegistryService from './RegistryService';

/**
 * A lightweight utility for registry self-healing that doesn't depend on ERC721Enumerable
 */
export class SimpleRegistryHealer {
  private registryService: RegistryService;
  private provider: ethers.Provider;
  private nftContractAddress: string | null = null;
  private nftContract: ethers.Contract | null = null;
  
  /**
   * Create a new SimpleRegistryHealer
   * @param provider - Ethers provider
   */
  constructor(provider: ethers.Provider) {
    this.provider = provider;
    this.registryService = new RegistryService(provider);
    
    // Initialize NFT contract for checking ownership
    try {
      // Get NFT contract address from environment
      const network = import.meta.env.VITE_NETWORK_ENV || 'testnet';
      const envKey = network === 'mainnet' ? 'VITE_MAINNET_MINER_NFT_ADDRESS' : 'VITE_TESTNET_MINER_NFT_ADDRESS';
      const contractAddress = import.meta.env[envKey] || '';
      
      if (contractAddress && ethers.isAddress(contractAddress)) {
        this.nftContractAddress = contractAddress;
        
        // Simple ABI for just checking ownership
        const ownershipABI = [
          'function ownerOf(uint256) view returns (address)'
        ];
        
        this.nftContract = new ethers.Contract(contractAddress, ownershipABI, provider);
        console.log(`SimpleRegistryHealer: Connected to NFT contract at ${contractAddress}`);
      }
    } catch (error) {
      console.warn('Failed to initialize NFT contract in SimpleRegistryHealer:', error);
    }
  }
  
  /**
   * Check if a token is registered to an address and heal if needed
   * @param tokenId - Token ID to check
   * @param ownerAddress - Current owner address
   * @returns Promise<boolean> - True if token is now correctly registered
   */
  async verifyAndHeal(tokenId: number, ownerAddress: string): Promise<boolean> {
    try {
      // First verify token exists and user actually owns it to avoid unnecessary registry updates
      if (this.nftContract) {
        try {
          const actualOwner = await this.nftContract.ownerOf(tokenId);
          
          if (actualOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
            console.log(`Token #${tokenId} is not owned by ${ownerAddress}, skipping registry healing`);
            return false;
          }
        } catch (error) {
          console.warn(`Error checking ownership of token #${tokenId}:`, error);
          // Continue with registry check anyway
        }
      }
      
      // Check if token is already registered correctly
      const isRegistered = await this.registryService.isTokenRegistered(ownerAddress, tokenId);
      
      // If already registered, nothing to do
      if (isRegistered) {
        console.log(`Token #${tokenId} already registered correctly to ${ownerAddress}`);
        return true;
      }
      
      console.log(`Token #${tokenId} not registered to ${ownerAddress}, healing...`);
      
      // Get signer for transaction
      const signer = await this.getSigner();
      if (!signer) {
        console.error('No signer available for registry update');
        return false;
      }
      
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
  
  /**
   * Get a signer for transactions
   * @returns Ethers signer or null
   */
  async getSigner(): Promise<ethers.Signer | null> {
    try {
      if (!this.provider) {
        return null;
      }
      
      // Try to get signer from provider
      if ('getSigner' in this.provider) {
        return await (this.provider as ethers.BrowserProvider).getSigner();
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get signer:', error);
      return null;
    }
  }
}

export default SimpleRegistryHealer;
