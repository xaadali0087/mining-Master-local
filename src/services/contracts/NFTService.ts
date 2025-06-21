/**
 * @title NFT Service
 * @notice Service for interacting with the Miner NFT contract
 * @dev Provides methods to fetch NFTs owned by an address
 */

import { ethers } from 'ethers';
import RegistryService from './RegistryService';

/**
 * Type definition for NFT objects
 */
export interface NFT {
  id: number | string;     // Token ID (can be number or string)
  tokenId?: string;        // Token ID as string for compatibility
  name?: string;           // Display name
  image?: string;          // Image URL
  tokenURI?: string;       // Token URI for metadata
  isApproved?: boolean;    // Whether token is approved for staking
}

/**
 * Standard ERC721 interface ABI for NFT operations
 */
const ERC721_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'function safeTransferFrom(address, address, uint256)',
  'function transferFrom(address, address, uint256)',
  'function approve(address, uint256)',
  'function getApproved(uint256) view returns (address)',
  'function isApprovedForAll(address, address) view returns (bool)',
  'function setApprovalForAll(address, bool)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function tokenURI(uint256) view returns (string)'
];

/**
 * ERC721Enumerable extension ABI for efficient token enumeration
 */
const ERC721_ENUMERABLE_ABI = [
  'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)',
  'function totalSupply() view returns (uint256)'
];

/**
 * Combined ABI with both ERC721 and ERC721Enumerable functions
 */
const ERC721_COMBINED_ABI = [...ERC721_ABI, ...ERC721_ENUMERABLE_ABI];

/**
 * Service for interacting with the Miner NFT contract
 */
export default class NFTService {
  private contract: ethers.Contract;
  private readonly contractAddress: string;
  private registryService: RegistryService | null = null;
  private useRegistry: boolean = false;

  /**
   * Constructor
   * @param provider - Ethers provider
   */
  constructor(provider: ethers.Provider) {
    // Get network-appropriate contract address from environment
    const network = import.meta.env.VITE_NETWORK_ENV || 'testnet';
    console.log(`NFTService - Network environment: ${network}`);

    // Get NFT contract address
    const envKey = network === 'mainnet' ? 'VITE_MAINNET_MINER_NFT_ADDRESS' : 'VITE_TESTNET_MINER_NFT_ADDRESS';
    let contractAddress = import.meta.env[envKey] || '';

    // Clean up the NFT address
    if (contractAddress && contractAddress.length > 42) {
      const addressMatch = contractAddress.match(/0x[a-fA-F0-9]{40}/);
      if (addressMatch) {
        const cleanedAddress = addressMatch[0];
        console.log(`Fixed malformed address format. Original: ${contractAddress}`);
        console.log(`Cleaned address: ${cleanedAddress}`);
        contractAddress = cleanedAddress;
      }
    }

    // Log the NFT contract address we're using
    if (contractAddress) {
      console.log(`Using MinerNFT contract at: ${contractAddress}`);
      this.contractAddress = contractAddress;

      // Create the contract instance with the right ABI
      // Use the full ABI to support possible ERC721Enumerable functions
      this.contract = new ethers.Contract(contractAddress, ERC721_COMBINED_ABI, provider);

      // Try to initialize the registry service (optional enhancement)
      try {
        this.registryService = new RegistryService(provider);
        this.useRegistry = this.registryService.hasAnyRegistry();

        if (this.useRegistry) {
          console.log('Registry service initialized - will use registry for efficient token enumeration');
        } else {
          console.log('No registry contracts available - will use direct NFT enumeration');
        }
      } catch (error) {
        console.warn('Failed to initialize registry service, will use direct NFT enumeration:', error);
        this.registryService = null;
        this.useRegistry = false;
      }
    } else {
      console.error('No MinerNFT contract address provided in environment variables');
      this.contractAddress = '';
      this.contract = new ethers.Contract('0x0000000000000000000000000000000000000000', ERC721_ABI, provider);
    }
  }

  /**
   * Approve the staking contract to transfer a specific NFT
   * @param tokenId - Token ID to approve
   * @param stakingContractAddress - Address of the staking contract
   * @returns Transaction response
   */
  async approveNFT(tokenId: number, stakingContractAddress: string): Promise<ethers.TransactionResponse> {
    try {
      console.log(`Approving staking contract ${stakingContractAddress} to transfer NFT #${tokenId}...`);
      console.log(`Using NFT contract at: ${this.contractAddress}`);

      // First get a signer for the transaction
      let signer;
      if (this.contract.runner && 'getSigner' in this.contract.runner) {
        try {
          signer = await (this.contract.runner as ethers.BrowserProvider).getSigner();
        } catch (error) {
          console.error('Failed to get signer:', error);
          throw new Error('Could not get signer from browser provider');
        }
      } else if (this.contract.runner && 'sendTransaction' in this.contract.runner) {
        signer = this.contract.runner;
      } else {
        throw new Error('No signer available');
      }

      // Get a contract instance with the signer
      const contractWithSigner = this.contract.connect(signer) as ethers.Contract;

      // Approve the staking contract to transfer this NFT
      const tx = await contractWithSigner['approve'](stakingContractAddress, tokenId);
      console.log(`Approval transaction submitted: ${tx.hash}`);

      return tx;
    } catch (error) {
      console.error('Error approving NFT:', error);
      throw new Error(`Failed to approve NFT: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a token is approved for the staking contract
   * @param tokenId - Token ID to check
   * @param stakingContractAddress - Address of the staking contract
   * @returns Boolean indicating if the token is approved
   */
  async isApprovedForStaking(tokenId: number, stakingContractAddress: string): Promise<boolean> {
    try {
      const approved = await this.contract.getApproved(tokenId);
      return approved.toLowerCase() === stakingContractAddress.toLowerCase();
    } catch (error) {
      console.error('Error checking approval status:', error);
      return false;
    }
  }

  /**
   * Get all NFTs owned by an address
   * @param ownerAddress - Address to check for NFT ownership
   * @returns Array of NFTs owned by the address
   */
  async getOwnedNFTs(ownerAddress: string): Promise<NFT[]> {
    try {
      console.log(`Fetching NFTs owned by ${ownerAddress}...`);
      console.log(`Using contract at: ${this.contractAddress}`);

      // First get the balance to know how many NFTs they own
      const balance = await this.contract.balanceOf(ownerAddress);
      const balanceNumber = Number(balance);
      console.log(`Wallet owns ${balanceNumber} NFTs`);

      if (balanceNumber === 0) {
        return [];
      }

      // Strategy 1: Try to use Registry if available (most efficient)
      if (this.useRegistry && this.registryService) {
        try {
          console.log('Attempting to use registry for token enumeration...');
          const tokenIds = await this.registryService.getTokensOfOwner(ownerAddress);

          if (tokenIds.length > 0) {
            console.log(`Registry returned ${tokenIds.length} tokens`);
            const nfts: NFT[] = [];

            // Verify ownership and fetch metadata for each token
            for (const tokenId of tokenIds) {
              try {
                // Double-check ownership on the NFT contract
                const currentOwner = await this.contract.ownerOf(tokenId);

                if (currentOwner.toLowerCase() === ownerAddress.toLowerCase()) {
                  let tokenURI = "";
                  try {
                    tokenURI = await this.contract.tokenURI(tokenId);
                  } catch (uriError) {
                    console.warn(`Failed to get tokenURI for token ${tokenId}:`, uriError);
                  }

                  nfts.push({
                    id: tokenId,
                    tokenId: tokenId.toString(),
                    name: `Miner #${String(tokenId).padStart(3, '0')}`,
                    image: "/images/Miner.png",
                    tokenURI,
                    isApproved: false
                  });
                } else {
                  console.warn(`Token ${tokenId} registry data is stale - owner mismatch`);
                  // NOTE: We're not automatically updating the registry here to avoid multiple wallet confirmations
                  // Registry will be updated through contract events instead
                }
              } catch (error) {
                console.warn(`Error processing token ${tokenId} from registry:`, error);
              }
            }

            if (nfts.length > 0) {
              console.log(`Successfully fetched ${nfts.length} NFTs via registry`);
              return nfts;
            }
          }
        } catch (registryError) {
          console.warn('Registry enumeration failed, falling back to direct methods:', registryError);
        }
      }

      // Strategy 2: Try to use ERC721Enumerable's tokenOfOwnerByIndex
      try {
        console.log(`Attempting to use ERC721Enumerable method...`);
        const nfts: NFT[] = [];

        for (let i = 0; i < balanceNumber; i++) {
          const tokenId = await this.contract.tokenOfOwnerByIndex(ownerAddress, i);
          console.log(`Found owned token #${tokenId}`);

          let tokenURI = "";
          try {
            tokenURI = await this.contract.tokenURI(tokenId);
          } catch (uriError) {
            console.warn(`Failed to get tokenURI for token ${tokenId}:`, uriError);
          }

          nfts.push({
            id: tokenId,
            tokenId: tokenId.toString(),
            name: `Miner #${String(tokenId).padStart(3, '0')}`,
            image: "/images/Miner.png",
            tokenURI,
            isApproved: false
          });
        }

        console.log(`Successfully fetched ${nfts.length} owned NFTs via ERC721Enumerable`);
        return nfts;
      } catch (enumError) {
        console.error('Error using ERC721Enumerable method:', enumError);
        console.log('Falling back to direct ownership checks...');

        // Strategy 3: Fallback method - Check token ownership directly
        const validResults: NFT[] = [];

        try {
          // Get total supply to know the upper bound for our search
          const totalSupply = await this.contract.totalSupply();
          console.log(`Total NFT supply: ${totalSupply}`);

          // Check ownership for recent tokens first (more likely to be owned)
          // Start from the newest tokens (highest IDs) and work backwards
          const maxTokensToCheck = 200; // Increase to 200 to improve chances of finding all tokens
          const startTokenId = Number(totalSupply) > maxTokensToCheck ?
            Number(totalSupply) - maxTokensToCheck : 0;

          console.log(`Scanning tokens from ID ${startTokenId} to ${Number(totalSupply)}`);

          for (let tokenId = Number(totalSupply); tokenId >= startTokenId; tokenId--) {
            try {
              // This is a simple approach and might not work for all NFT contracts
              // Some contracts might have non-sequential IDs or gaps
              const owner = await this.contract.ownerOf(tokenId);
              if (owner.toLowerCase() === ownerAddress.toLowerCase()) {
                console.log(`Found owned token #${tokenId}`);

                let tokenURI = "";
                try {
                  tokenURI = await this.contract.tokenURI(tokenId);
                } catch (uriError) {
                  console.warn(`Failed to get tokenURI for token ${tokenId}:`, uriError);
                }

                validResults.push({
                  id: tokenId,
                  tokenId: tokenId.toString(),
                  name: `Miner #${String(tokenId).padStart(3, '0')}`,
                  image: "/images/Miner.png",
                  tokenURI,
                  isApproved: false
                });

                // If we found enough NFTs to match balance, we can stop
                if (validResults.length >= balanceNumber) {
                  break;
                }
              }
            } catch (e) {
              // Token might not exist or be burned, just continue
              console.log(`Token #${tokenId} check failed, might not exist`);
            }
          }
        } catch (fallbackError) {
          console.error("Even fallback method failed:", fallbackError);
        }

        console.log(`Successfully fetched ${validResults.length} owned NFTs via fallback method`);
        return validResults;
      }
    } catch (error) {
      console.error('Error fetching owned NFTs:', error);
      throw new Error(`Failed to fetch owned NFTs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if an NFT is approved for a specific operator
   * @param tokenId - Token ID to check
   * @param operatorAddress - Address of the operator
   * @returns Boolean indicating if approved
   */
  async isApprovedFor(tokenId: number, operatorAddress: string): Promise<boolean> {
    try {
      const approved = await this.contract.getApproved(tokenId);
      return approved.toLowerCase() === operatorAddress.toLowerCase();
    } catch (error) {
      console.error('Error checking approval status:', error);
      return false;
    }
  }

  /**
   * Check if an address owns a specific NFT
   * @param ownerAddress - Address to check
   * @param tokenId - Token ID to check ownership for
   * @returns Boolean indicating if the address owns the NFT
   */
  async ownsNFT(ownerAddress: string, tokenId: number): Promise<boolean> {
    try {
      const owner = await this.contract.ownerOf(tokenId);
      return owner.toLowerCase() === ownerAddress.toLowerCase();
    } catch (error) {
      // If the token doesn't exist or there's an error, return false
      return false;
    }
  }

  /**
   * Get all token IDs that exist in the contract
   * Useful for admin views or exploration
   * @param limit - Maximum number of tokens to fetch
   * @returns Array of token IDs
   */
  async getAllTokenIds(limit: number = 100): Promise<number[]> {
    try {
      const totalSupply = await this.contract.totalSupply();
      const maxTokens = Math.min(Number(totalSupply), limit);

      const tokenIds: number[] = [];
      for (let i = 0; i < maxTokens; i++) {
        try {
          // This is a simple approach and might not work for all NFT contracts
          // Some contracts might have non-sequential IDs or gaps
          const tokenId = i + 1; // Assuming token IDs start at 1
          await this.contract.ownerOf(tokenId); // Check if token exists
          tokenIds.push(tokenId);
        } catch (error) {
          // Skip tokens that don't exist
          continue;
        }
      }

      return tokenIds;
    } catch (error) {
      console.error('Error fetching all token IDs:', error);
      throw new Error('Failed to fetch token IDs');
    }
  }
}
