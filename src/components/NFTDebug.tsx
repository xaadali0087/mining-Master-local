import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useRoninWallet } from '../services/wallet/RoninWalletProvider';

// Basic ERC721 ABI
const ERC721_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)',
  'function totalSupply() view returns (uint256)'
];

// MinerNFTRegistry ABI
const REGISTRY_ABI = [
  'function tokensOfOwner(address owner) view returns (uint256[])',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function isTokenRegistered(address owner, uint256 tokenId) view returns (bool)'
];

const NFTDebug: React.FC = () => {
  const { address, connector } = useRoninWallet();
  const [debugOutput, setDebugOutput] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Add a log message to the debug output
  const log = (message: string) => {
    setDebugOutput(prev => [...prev, message]);
  };

  // Clear the debug output
  const clearLogs = () => {
    setDebugOutput([]);
  };

  // Get network-appropriate NFT contract address
  const getNFTContractAddress = (): string => {
    const network = import.meta.env.VITE_NETWORK_ENV || 'testnet';
    log(`Using network: ${network}`);
    
    const envKey = network === 'mainnet' 
      ? 'VITE_MAINNET_MINER_NFT_ADDRESS' 
      : 'VITE_TESTNET_MINER_NFT_ADDRESS';
    
    const address = import.meta.env[envKey] || '';
    log(`Using NFT contract address: ${address}`);
    return address;
  };
  
  // Get network-appropriate NFT Registry contract address
  const getRegistryContractAddress = (): string => {
    const network = import.meta.env.VITE_NETWORK_ENV || 'testnet';
    
    const envKey = network === 'mainnet' 
      ? 'VITE_MAINNET_MINER_REGISTRY_ADDRESS' 
      : 'VITE_TESTNET_MINER_REGISTRY_ADDRESS';
    
    const address = import.meta.env[envKey] || '';
    log(`Using NFT Registry contract address: ${address}`);
    return address;
  };

  // Check NFT balance using direct contract call
  const checkBalance = async () => {
    if (!address || !connector) {
      log('Wallet not connected');
      return;
    }

    setIsLoading(true);
    clearLogs();
    
    try {
      log('=== Starting NFT Ownership Check ===');
      log(`Your wallet: ${address}`);
      
      const contractAddress = getNFTContractAddress();
      if (!contractAddress) {
        log('Error: NFT contract address not configured');
        return;
      }
      
      // Create provider and connect to NFT contract
      // Use the appropriate RPC URL based on the network
      const network = import.meta.env.VITE_NETWORK_ENV || 'testnet';
      const rpcUrl = network === 'mainnet' 
        ? import.meta.env.VITE_RONIN_MAINNET_RPC || 'https://api.roninchain.com/rpc'
        : import.meta.env.VITE_RONIN_TESTNET_RPC || 'https://saigon-api.roninchain.com/rpc';
      
      log(`Using RPC URL: ${rpcUrl}`);
      
      // Initialize the provider with the RPC URL
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const nftContract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
      log(`Connected to NFT contract at ${contractAddress}`);
      
      // Get balance
      const balance = await nftContract.balanceOf(address);
      log(`NFT Balance: ${balance.toString()}`);
      
      if (balance === 0n) {
        log('You don\'t own any NFTs');
        return;
      }
      
      // Try MinerNFTRegistry first (most reliable method)
      log('\nAttempting to use MinerNFTRegistry...');
      const registryAddress = getRegistryContractAddress();
      
      if (registryAddress) {
        try {
          const registryContract = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
          log(`Connected to registry contract at ${registryAddress}`);
          
          const ownedTokens = await registryContract.tokensOfOwner(address);
          log(`Registry returned ${ownedTokens.length} tokens`);
          
          if (ownedTokens.length > 0) {
            log('Your tokens from registry:');
            for (let i = 0; i < ownedTokens.length; i++) {
              log(`✅ Token #${ownedTokens[i].toString()}`);
            }
            log(`✅ Successfully found ${ownedTokens.length} tokens via Registry`);
          } else {
            log('Registry returned 0 tokens. Falling back to other methods...');
          }
        } catch (registryError) {
          log(`❌ Registry method failed: ${registryError instanceof Error ? registryError.message : String(registryError)}`);
          log('Falling back to other methods...');
        }
      } else {
        log('Registry address not configured, skipping registry method.');
      }
      
      // Try ERC721Enumerable next
      log('\nAttempting to use ERC721Enumerable...');
      try {
        for (let i = 0n; i < balance; i++) {
          try {
            const tokenId = await nftContract.tokenOfOwnerByIndex(address, i);
            log(`✅ Found token #${tokenId.toString()} at index ${i}`);
          } catch (e) {
            log(`❌ Error at index ${i}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      } catch (enumError) {
        log(`❌ Enumeration failed: ${enumError instanceof Error ? enumError.message : String(enumError)}`);
      }
      
      // Try fallback method - scan through recent tokens
      log('\nTrying fallback method - scanning recent tokens...');
      try {
        const totalSupply = await nftContract.totalSupply();
        log(`Total NFT supply: ${totalSupply.toString()}`);
        
        // Check the last 100 tokens (most likely to be owned)
        const maxTokensToCheck = 100;
        const startTokenId = Number(totalSupply) > maxTokensToCheck 
          ? Number(totalSupply) - maxTokensToCheck 
          : 0;
        
        log(`Scanning tokens from ID ${startTokenId} to ${Number(totalSupply)}`);
        
        const ownedTokens: bigint[] = [];
        for (let tokenId = Number(totalSupply); tokenId >= startTokenId; tokenId--) {
          try {
            const owner = await nftContract.ownerOf(tokenId);
            if (owner.toLowerCase() === address.toLowerCase()) {
              log(`✅ Found owned token #${tokenId}`);
              ownedTokens.push(BigInt(tokenId));
              
              // If we found enough tokens to match balance, we can stop
              if (ownedTokens.length >= Number(balance)) {
                break;
              }
            }
          } catch (e) {
            // Token might not exist, just continue
          }
        }
        
        log(`\nFound ${ownedTokens.length}/${balance.toString()} tokens via fallback method`);
        if (ownedTokens.length > 0) {
          log('\nYour owned tokens:');
          ownedTokens.forEach(id => log(`Token ID: ${id.toString()}`));
        }
      } catch (fallbackError) {
        log(`❌ Fallback method failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
      }
      
    } catch (error) {
      log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg mt-4">
      <h2 className="text-xl font-bold mb-4">NFT Debug</h2>
      
      <button 
        onClick={checkBalance}
        disabled={isLoading || !address}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
      >
        {isLoading ? 'Checking...' : 'Check NFT Ownership'}
      </button>
      
      <div className="mt-4 overflow-auto h-80 bg-gray-900 p-4 rounded-lg">
        <pre className="text-xs text-gray-300 font-mono">
          {debugOutput.length ? debugOutput.join('\n') : 'Connect wallet and click "Check NFT Ownership"'}
        </pre>
      </div>
    </div>
  );
};

export default NFTDebug;
