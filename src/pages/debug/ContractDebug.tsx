import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useRoninWallet } from '../../services/wallet/RoninWalletProvider';

// ERC721 minimal ABI for basic interactions
const MINIMAL_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)'
];

// ERC721Enumerable extension
const ENUMERABLE_ABI = [
  'function tokenOfOwnerByIndex(address,uint256) view returns (uint256)',
  'function totalSupply() view returns (uint256)'
];

// Combined ABI
const COMBINED_ABI = [...MINIMAL_ABI, ...ENUMERABLE_ABI];

export default function ContractDebug() {
  const { connector, isConnected, address } = useRoninWallet();
  const [logs, setLogs] = useState<string[]>([]);
  const [contractAddress, setContractAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Get contract address from environment variables and detect network
  useEffect(() => {
    const detectNetwork = async () => {
      try {
        if (connector && isConnected) {
          const provider = new ethers.BrowserProvider(connector.provider);
          const network = await provider.getNetwork();
          const chainId = Number(network.chainId);
          
          // Determine if testnet or mainnet based on chainId
          // Ronin Mainnet: 2020, Saigon Testnet: 2021
          const isTestnet = chainId === 2021;
          const networkName = isTestnet ? 'testnet' : 'mainnet';
          
          addLog(`✅ Connected to Ronin ${isTestnet ? 'Saigon testnet' : 'mainnet'} (Chain ID: ${chainId})`);
          
          // Get the appropriate contract address based on detected network
          const envKey = isTestnet ? 'VITE_TESTNET_MINER_NFT_ADDRESS' : 'VITE_MAINNET_MINER_NFT_ADDRESS';
          let configuredAddress = import.meta.env[envKey] || '';
          
          // Clean up the address - in case there's a comment attached to it without a space
          if (configuredAddress && configuredAddress.length > 42) {
            // Extract just the address part (0x + 40 hex chars)
            const addressMatch = configuredAddress.match(/0x[a-fA-F0-9]{40}/);
            if (addressMatch) {
              const cleanedAddress = addressMatch[0];
              addLog(`🛠️ Fixed malformed address format. Original: ${configuredAddress}`);
              addLog(`🛠️ Cleaned address: ${cleanedAddress}`);
              configuredAddress = cleanedAddress;
            }
          }
          
          if (configuredAddress) {
            setContractAddress(configuredAddress);
            addLog(`🔍 Using ${networkName} environment, contract address: ${configuredAddress}`);
            
            // Validate the address format
            if (!ethers.isAddress(configuredAddress)) {
              addLog(`⚠️ Warning: The configured address does not appear to be a valid Ethereum address`);
            }
          } else {
            addLog(`❌ No contract address configured for ${networkName} in environment variables`);
          }
        } else {
          // Fallback to environment variable if wallet not connected
          const network = import.meta.env.VITE_NETWORK || 'testnet';
          const envKey = network === 'mainnet' ? 'VITE_MAINNET_MINER_NFT_ADDRESS' : 'VITE_TESTNET_MINER_NFT_ADDRESS';
          let address = import.meta.env[envKey] || '';
          
          // Clean up the address here too
          if (address && address.length > 42) {
            const addressMatch = address.match(/0x[a-fA-F0-9]{40}/);
            if (addressMatch) {
              address = addressMatch[0];
              addLog(`🛠️ Fixed malformed address in environment variable`);
            }
          }
          
          setContractAddress(address);
          addLog(`⚠️ Wallet not connected. Using configured ${network} environment, contract address: ${address}`);
        }
      } catch (error) {
        addLog(`❌ Error detecting network: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    
    detectNetwork();
  }, [connector, isConnected]);
  
  // Helper function to add logs
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
  };
  
  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };
  
  // Manually set contract address
  const updateContractAddress = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContractAddress(e.target.value);
  };
  
  // Test basic contract interaction
  const testBasicInteraction = async () => {
    if (!isConnected || !connector) {
      addLog('❌ Error: Wallet not connected');
      return;
    }
    
    setIsLoading(true);
    addLog(`🔍 Testing basic interaction with contract at ${contractAddress}...`);
    
    try {
      const provider = new ethers.BrowserProvider(connector.provider);
      const contract = new ethers.Contract(contractAddress, MINIMAL_ABI, provider);
      
      // Try to get contract name and symbol
      addLog('Attempting to get contract name...');
      const name = await contract.name();
      addLog(`✅ Contract name: ${name}`);
      
      const symbol = await contract.symbol();
      addLog(`✅ Contract symbol: ${symbol}`);
      
      // If we get here, basic interaction works
      addLog('✅ Basic contract interaction successful!');
    } catch (error) {
      addLog(`❌ Error in basic interaction: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Test balance of
  const testBalanceOf = async () => {
    if (!isConnected || !connector || !address) {
      addLog('❌ Error: Wallet not connected');
      return;
    }
    
    setIsLoading(true);
    addLog(`🔍 Testing balanceOf for address ${address}...`);
    
    try {
      const provider = new ethers.BrowserProvider(connector.provider);
      const contract = new ethers.Contract(contractAddress, MINIMAL_ABI, provider);
      
      // Try to get balance
      const balance = await contract.balanceOf(address);
      addLog(`✅ NFT balance: ${balance} tokens`);
      
      // If balance > 0, try to get all token IDs
      if (balance > 0) {
        addLog('Attempting to use ERC721Enumerable to get all token IDs...');
        
        try {
          const enumContract = new ethers.Contract(contractAddress, COMBINED_ABI, provider);
          const tokenIds = [];
          const fetchPromises = [];
          
          // Create array of promises to fetch all tokens in parallel
          for (let i = 0; i < Number(balance); i++) {
            fetchPromises.push((async (idx) => {
              try {
                return await enumContract.tokenOfOwnerByIndex(address, idx);
              } catch (err) {
                addLog(`❌ Error fetching token at index ${idx}: ${err instanceof Error ? err.message : String(err)}`);
                return null;
              }
            })(i));
          }
          
          // Wait for all promises to resolve
          const results = await Promise.all(fetchPromises);
          
          // Filter out null results and store valid token IDs
          for (const result of results) {
            if (result !== null) {
              tokenIds.push(result);
            }
          }
          
          if (tokenIds.length > 0) {
            addLog(`✅ Found ${tokenIds.length} tokens using ERC721Enumerable:`);
            addLog(`📋 Token IDs: ${tokenIds.join(', ')}`);
            
            // Verify first token to confirm ownership
            const firstTokenId = tokenIds[0];
            const owner = await contract.ownerOf(firstTokenId);
            addLog(`✅ Verified token ${firstTokenId} is owned by: ${owner}`);
            
            // Check if owner matches connected address
            if (owner.toLowerCase() === address.toLowerCase()) {
              addLog('✅ Owner verification successful!');
            } else {
              addLog('❌ Owner verification failed!');
            }
          } else {
            addLog('❌ No valid token IDs found using ERC721Enumerable');
          }
        } catch (enumError) {
          addLog(`❌ ERC721Enumerable interaction failed: ${enumError instanceof Error ? enumError.message : String(enumError)}`);
          
          // Try alternative approach: scan token IDs
          addLog('Trying alternative approach: scanning token IDs 1-20...');
          const foundTokens = [];
          
          for (let i = 1; i <= 20; i++) {
            try {
              const owner = await contract.ownerOf(i);
              if (owner.toLowerCase() === address.toLowerCase()) {
                foundTokens.push(i);
                addLog(`✅ Found your token: ID ${i}`);
              }
            } catch (e) {
              // Skip errors
            }
          }
          
          if (foundTokens.length > 0) {
            addLog(`\u2705 Found ${foundTokens.length} tokens by scanning: ${foundTokens.join(', ')}`);
          } else {
            addLog('\u274c No tokens found using scan method');
          }
        }
      }
    } catch (error) {
      addLog(`❌ Error in balanceOf: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="p-6 max-w-4xl mx-auto bg-[#1a0d00] rounded-xl border border-amber-500/40 mt-8">
      <h1 className="text-2xl font-bold text-amber-400 mb-6 font-winky">NFT Contract Diagnostics</h1>
      
      <div className="mb-6 p-4 bg-[#2a1a0a] rounded-lg border border-amber-500/20">
        <div className="mb-4">
          <label className="block text-amber-400 mb-2 font-winky">Contract Address:</label>
          <input 
            type="text" 
            value={contractAddress} 
            onChange={updateContractAddress}
            className="w-full p-2 bg-[#1a0d00] border border-amber-500/40 rounded-md text-amber-200"
          />
        </div>
        
        <div className="flex space-x-4">
          <button 
            onClick={testBasicInteraction}
            disabled={isLoading || !contractAddress || !isConnected}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-4 py-2 rounded-lg transition-all duration-300 font-winky disabled:opacity-50"
          >
            Test Contract Basics
          </button>
          
          <button 
            onClick={testBalanceOf}
            disabled={isLoading || !contractAddress || !isConnected}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-4 py-2 rounded-lg transition-all duration-300 font-winky disabled:opacity-50"
          >
            Test NFT Balance
          </button>
          
          <button 
            onClick={clearLogs}
            className="bg-gray-700 hover:bg-gray-800 text-white font-semibold px-4 py-2 rounded-lg transition-all duration-300 font-winky"
          >
            Clear Logs
          </button>
        </div>
      </div>
      
      <div className="p-4 bg-[#1a0d00] border border-amber-500/20 rounded-lg h-96 overflow-y-auto">
        <h2 className="text-xl font-bold text-amber-400 mb-2 font-winky">Diagnostic Logs</h2>
        <div className="font-mono text-sm space-y-1">
          {logs.length === 0 ? (
            <p className="text-amber-300/50 italic">No logs yet. Run a test to see results.</p>
          ) : (
            logs.map((log, index) => (
              <div 
                key={index} 
                className={`p-1 ${log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : 'text-amber-300'}`}
              >
                {log}
              </div>
            ))
          )}
        </div>
      </div>
      
      {!isConnected && (
        <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400">
          ⚠️ Wallet not connected. Please connect your wallet first to run tests.
        </div>
      )}
    </div>
  );
}
