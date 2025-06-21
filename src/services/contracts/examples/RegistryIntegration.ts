/**
 * @title Registry Integration Example
 * @notice Example code showing how to integrate the RegistryService in your frontend
 * @dev Provides examples for checking both registries and implementing self-healing
 */

import { ethers } from 'ethers';
import RegistryService from '../RegistryService';

// Example NFT contract ABI (minimal for this example)
const NFT_ABI = [
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)'
];

/**
 * Example class showing how to integrate the RegistryService
 * You can copy these methods into your existing service classes
 */
export class RegistryIntegrationExample {
  private provider: ethers.Provider;
  private registryService: RegistryService;
  private nftContract: ethers.Contract;
  
  constructor(provider: ethers.Provider) {
    this.provider = provider;
    this.registryService = new RegistryService(provider);
    
    // Get appropriate NFT contract address based on network
    const network = import.meta.env.VITE_NETWORK_ENV || 'testnet';
    const envKey = network === 'mainnet' ? 'VITE_MAINNET_MINER_NFT_ADDRESS' : 'VITE_TESTNET_MINER_NFT_ADDRESS';
    const nftAddress = import.meta.env[envKey];
    
    if (!nftAddress) {
      throw new Error(`Missing NFT contract address in environment variables`);
    }
    
    // Initialize NFT contract
    this.nftContract = new ethers.Contract(nftAddress, NFT_ABI, provider);
  }
  
  /**
   * Check if a token is owned by an address with registry verification
   * @param ownerAddress - Address to check
   * @param tokenId - Token ID to check
   * @returns Boolean indicating ownership status
   */
  async verifyTokenOwnership(ownerAddress: string, tokenId: number): Promise<boolean> {
    try {
      // First check direct ownership from the NFT contract
      const currentOwner = await this.nftContract.ownerOf(tokenId);
      const isDirectOwner = currentOwner.toLowerCase() === ownerAddress.toLowerCase();
      
      if (!isDirectOwner) {
        return false; // User doesn't own this token
      }
      
      // Check if token is properly registered
      const isRegistered = await this.registryService.isTokenRegistered(ownerAddress, tokenId);
      
      // Self-healing: If user owns the token but it's not registered correctly
      if (isDirectOwner && !isRegistered) {
        console.log(`Token #${tokenId} not registered correctly, updating registry...`);
        await this.updateTokenRegistry(tokenId, ownerAddress);
      }
      
      return true;
    } catch (error) {
      console.error(`Error verifying token #${tokenId} ownership:`, error);
      return false;
    }
  }
  
  /**
   * Get all NFTs owned by an address using only the registry service
   * @param ownerAddress - Address to check
   * @returns Array of token info objects
   */
  async getOwnedNFTs(ownerAddress: string): Promise<Array<{id: number, name: string, image: string}>> {
    try {
      // Since we don't have ERC721Enumerable, we need to rely on the registry service
      // Get tokens from both old and new registries
      const registryTokenIds = await this.registryService.getTokensOfOwner(ownerAddress);
      console.log(`Found ${registryTokenIds.length} tokens in registry for ${ownerAddress}`);
      
      if (registryTokenIds.length === 0) {
        return [];
      }
      
      const tokens = [];
      
      // Process each token from the registry with verification
      for (const tokenId of registryTokenIds) {
        const tokenIdNumber = Number(tokenId);
        
        try {
          // Verify on-chain ownership
          const actualOwner = await this.nftContract.ownerOf(tokenIdNumber);
          
          // Self-healing: If registry data doesn't match chain data, update it
          if (actualOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
            console.warn(`Registry data stale for token #${tokenIdNumber}, updating...`);
            await this.updateTokenRegistry(tokenIdNumber, actualOwner);
            continue; // Skip this token since user doesn't actually own it
          }
          
          // Add verified token to results
          tokens.push({
            id: tokenIdNumber,
            name: `Miner #${tokenIdNumber}`,
            image: '/images/Miner.png'
          });
        } catch (error) {
          console.warn(`Error processing registry token #${tokenIdNumber}:`, error);
          // If we can't verify ownership (e.g., token was burned or transferred)
          // Update the registry to reflect this
          try {
            // For errors like 'token doesn't exist' we still want to update the registry
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('owner query for nonexistent token')) {
              console.log(`Token #${tokenIdNumber} no longer exists, removing from registry...`);
              await this.updateTokenRegistry(tokenIdNumber, ethers.ZeroAddress); // Use zero address to indicate burning
            }
          } catch (updateError) {
            console.error(`Failed to update registry for non-existent token #${tokenIdNumber}:`, updateError);
          }
        }
      }
      
      return tokens;
    } catch (error) {
      console.error('Error fetching owned NFTs:', error);
      return [];
    }
  }
  
  /**
   * Update token registry with current ownership
   * @param tokenId - Token ID to update
   * @param currentOwner - Current owner of the token
   * @returns Boolean indicating success
   */
  private async updateTokenRegistry(tokenId: number, currentOwner: string): Promise<boolean> {
    try {
      // Check if we have a signer
      const signer = await this.getSigner();
      if (!signer) {
        console.error('No signer available for registry update');
        return false;
      }
      
      // Update token ownership in the registry
      const tx = await this.registryService.updateTokenOwnership(tokenId, currentOwner);
      if (!tx) {
        return false;
      }
      
      // Wait for transaction to be mined
      await tx.wait();
      console.log(`Successfully updated registry for token #${tokenId}`);
      return true;
    } catch (error) {
      console.error(`Failed to update registry for token #${tokenId}:`, error);
      return false;
    }
  }
  
  /**
   * Get a signer for sending transactions
   * @private
   * @returns Ethers signer or null
   */
  private async getSigner(): Promise<ethers.Signer | null> {
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

// Example usage:
// 
// import { RegistryIntegrationExample } from './RegistryIntegration';
// 
// // In your component
// const provider = new ethers.BrowserProvider(window.ethereum);
// const registryIntegration = new RegistryIntegrationExample(provider);
// 
// // Get all NFTs owned by the user
// const userAddress = '0x...';
// const nfts = await registryIntegration.getOwnedNFTs(userAddress);
// 
// // Check if user owns a specific token
// const tokenId = 123;
// const isOwner = await registryIntegration.verifyTokenOwnership(userAddress, tokenId);
