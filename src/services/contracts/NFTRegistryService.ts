import { ethers } from 'ethers';
import { NFT } from './NFTServiceFixed';

// ABI for MinerNFTRegistry - include only the functions we need
const NFT_REGISTRY_ABI = [
  'function tokensOfOwner(address owner) view returns (uint256[])',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function isTokenRegistered(address owner, uint256 tokenId) view returns (bool)',
  'function updateTokenOwnership(uint256 tokenId) external'
];

// ABI for MinerNFT - needed to fetch tokenURI
const MINER_NFT_ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)'
];

/**
 * Service for interacting with the MinerNFTRegistry contract
 * This provides a reliable way to enumerate NFTs without depending on ERC721Enumerable
 */
export class NFTRegistryService {
  private provider: ethers.Provider | null = null;
  private signer: ethers.Signer | null = null;
  private registryContract: ethers.Contract | null = null;
  private nftContract: ethers.Contract | null = null;
  private isInitialized = false;
  private registryAddress: string;
  private nftAddress: string;
  
  /**
   * Constructor for NFTRegistryService
   * @param registryAddress Address of the MinerNFTRegistry contract
   * @param nftAddress Address of the MinerNFT contract
   */
  constructor(registryAddress: string, nftAddress: string) {
    this.registryAddress = registryAddress;
    this.nftAddress = nftAddress;
  }
  
  /**
   * Initialize the service with provider and signer
   * @param provider The Ethereum provider
   * @param signer The Ethereum signer
   */
  public initialize(provider: ethers.Provider, signer: ethers.Signer): void {
    this.provider = provider;
    this.signer = signer;
    this.registryContract = new ethers.Contract(this.registryAddress, NFT_REGISTRY_ABI, this.signer);
    this.nftContract = new ethers.Contract(this.nftAddress, MINER_NFT_ABI, this.signer);
    this.isInitialized = true;
  }
  
  /**
   * Get all NFTs owned by a specific address using the registry
   * @param ownerAddress The address to check ownership for
   * @returns Array of NFT objects
   */
  public async getUserOwnedNFTs(ownerAddress: string): Promise<NFT[]> {
    if (!this.isInitialized || !this.registryContract || !this.nftContract) {
      console.error('NFTRegistryService not initialized');
      return [];
    }
    
    try {
      console.log(`Fetching NFTs for ${ownerAddress} using NFTRegistry`);
      
      // Get all token IDs owned by the address from the registry
      const tokenIds = await this.registryContract.tokensOfOwner(ownerAddress);
      console.log(`Registry returned ${tokenIds.length} tokens`);
      
      // For each token ID, create an NFT object
      const nfts: NFT[] = [];
      
      for (const tokenId of tokenIds) {
        try {
          // Verify actual ownership on the NFT contract
          const actualOwner = await this.nftContract.ownerOf(tokenId);
          
          // If the registry data is outdated, update it
          if (actualOwner.toLowerCase() !== ownerAddress.toLowerCase()) {
            console.log(`Ownership mismatch for token ${tokenId}, updating registry`);
            await this.registryContract.updateTokenOwnership(tokenId);
            continue; // Skip this token as it's not owned by the user
          }
          
          // Get token metadata
          const tokenURI = await this.nftContract.tokenURI(tokenId);
          
          nfts.push({
            id: tokenId.toString(),
            tokenId: tokenId.toString(),
            tokenURI,
            isApproved: false // This will be set separately if needed
          });
        } catch (error) {
          console.error(`Error processing token ${tokenId}:`, error);
        }
      }
      
      return nfts;
    } catch (error) {
      console.error('Error fetching NFTs from registry:', error);
      return [];
    }
  }
  
  /**
   * Update token ownership in the registry
   * Call this after transfers to keep the registry up to date
   * @param tokenId The token ID to update
   */
  public async updateTokenOwnership(tokenId: string): Promise<void> {
    if (!this.isInitialized || !this.registryContract) {
      console.error('NFTRegistryService not initialized');
      return;
    }
    
    try {
      const tx = await this.registryContract.updateTokenOwnership(tokenId);
      await tx.wait();
      console.log(`Updated ownership for token ${tokenId} in registry`);
    } catch (error) {
      console.error(`Error updating token ${tokenId} in registry:`, error);
    }
  }
  
  /**
   * Check if a specific token is registered to an owner
   * @param ownerAddress The owner address
   * @param tokenId The token ID
   * @returns True if the token is registered to the owner
   */
  public async isTokenRegistered(ownerAddress: string, tokenId: string): Promise<boolean> {
    if (!this.isInitialized || !this.registryContract) {
      console.error('NFTRegistryService not initialized');
      return false;
    }
    
    try {
      return await this.registryContract.isTokenRegistered(ownerAddress, tokenId);
    } catch (error) {
      console.error(`Error checking if token ${tokenId} is registered:`, error);
      return false;
    }
  }
}

/**
 * Hook to use the NFTRegistryService
 * This provides an initialized instance of the service
 */
// export const useNFTRegistryService = () => {
//   const { provider, signer, chainId } = useRoninWalletContext();
  
//   // Select the right addresses based on network
//   const network = import.meta.env.VITE_NETWORK_ENV || 'mainnet';
//   const registryAddress = network === 'mainnet' 
//     ? import.meta.env.VITE_MAINNET_MINER_REGISTRY_ADDRESS
//     : import.meta.env.VITE_TESTNET_MINER_REGISTRY_ADDRESS;
  
//   const nftAddress = network === 'mainnet'
//     ? import.meta.env.VITE_MAINNET_MINER_NFT_ADDRESS
//     : import.meta.env.VITE_TESTNET_MINER_NFT_ADDRESS;
    
//   const service = new NFTRegistryService(registryAddress, nftAddress);
  
//   if (provider && signer) {
//     service.initialize(provider, signer);
//   }
  
//   return service;
// };
