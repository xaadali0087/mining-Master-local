/**
 * @title GEMSService
 * @notice Service class for interacting with the GEMS token contract on Ronin blockchain
 * @dev Uses ethers.js v6 as recommended by Sky Mavis documentation
 */

import { ethers } from 'ethers';
import { useState, useEffect, useCallback } from 'react';
import { getContractAddress } from '../../config/contracts';
import { useRoninWallet } from '../wallet/RoninWalletProvider';

// Minimal ERC20 ABI for balance checking
const ERC20_ABI = [
  // Read-only functions
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  
  // Authenticated functions
  "function transfer(address to, uint amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  
  // Events
  "event Transfer(address indexed from, address indexed to, uint amount)"
];

/**
 * Class for interacting with the GEMS token contract on Ronin blockchain
 */
export class GEMSService {
  private contractAddress: string;
  private provider: ethers.Provider;
  private signer: ethers.Signer | null = null;
  
  /**
   * Creates a new GEMSService instance
   * @param provider - Ethers provider
   */
  constructor(provider: ethers.Provider) {
    this.provider = provider;
    // Get contract address based on the current network
    this.contractAddress = getContractAddress('GEMSToken');
  }
  
  /**
   * Set the signer for authenticated transactions
   * @param signer - Ethers signer
   */
  setSigner(signer: ethers.Signer) {
    this.signer = signer;
  }
  
  /**
   * Get contract instance with appropriate connection
   * @private
   * @throws Error if contract address is invalid
   */
  private getContract() {
    // Validate contract address
    if (!this.contractAddress || this.contractAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('GEMS token contract address not properly configured');
    }
    
    // Create and return contract instance
    return new ethers.Contract(
      this.contractAddress,
      ERC20_ABI,
      this.signer || this.provider
    );
  }
  
  // Static cache for balances
  private static balanceCache: { [address: string]: { balance: string, timestamp: number } } = {};
  private static CACHE_DURATION = 5000; // 5 seconds
  
  /**
   * Gets the GEMS token balance for the connected wallet or a specific address
   * @param address - Optional wallet address to check. If not provided, uses the signer address.
   * @param forceRefresh - Force a refresh from the blockchain instead of using cache
   * @returns Formatted balance in GEMS
   */
  async getBalance(address?: string, forceRefresh = false): Promise<string> {
    // Define targetAddress outside try block so it's accessible in catch
    let targetAddress = address;
    
    try {
      const contract = this.getContract();
      
      // If no address is provided, use the connected wallet address
      if (!targetAddress && this.signer) {
        targetAddress = await this.signer.getAddress();
      }
      
      if (!targetAddress) {
        throw new Error('No address provided and no wallet connected');
      }
      
      // Check cache first if not forcing refresh
      const now = Date.now();
      const cachedData = GEMSService.balanceCache[targetAddress];
      
      if (!forceRefresh && cachedData && (now - cachedData.timestamp < GEMSService.CACHE_DURATION)) {
        console.log('Using cached GEMS balance for', targetAddress);
        return cachedData.balance;
      }
      
      // Get fresh balance from blockchain
      const balance = await contract.balanceOf(targetAddress);
      const decimals = await contract.decimals();
      
      // Format balance with proper decimals
      const formattedBalance = ethers.formatUnits(balance, decimals);
      
      // Update cache
      GEMSService.balanceCache[targetAddress] = { 
        balance: formattedBalance, 
        timestamp: now 
      };
      
      return formattedBalance;
    } catch (error) {
      console.error('Error fetching GEMS balance:', error);
      
      // Return cached balance if available, even if expired
      const cachedData = targetAddress ? GEMSService.balanceCache[targetAddress] : null;
      if (cachedData && cachedData.balance) {
        console.log('Returning expired cached balance due to error');
        return cachedData.balance;
      }
      
      // Return 0 as last resort
      return '0';
    }
  }
  
  /**
   * Gets the token decimals
   */
  async getDecimals(): Promise<number> {
    try {
      const contract = this.getContract();
      const decimals = await contract.decimals();
      return decimals;
    } catch (error) {
      console.error('Error fetching token decimals:', error);
      return 18; // Default to 18 decimals
    }
  }
  
  /**
   * Transfers GEMS tokens to another address
   * @param to - Recipient address
   * @param amount - Amount to transfer (in GEMS)
   * @returns Transaction response
   */
  async transfer(to: string, amount: string): Promise<ethers.TransactionResponse> {
    if (!this.signer) {
      throw new Error('Signer required for transfer operation');
    }
    
    const contract = this.getContract();
    const decimals = await this.getDecimals();
    const amountInWei = ethers.parseUnits(amount, decimals);
    
    return await contract.transfer(to, amountInWei);
  }
}

/**
 * Hook for accessing the GEMSService
 * @returns GEMSService instance and methods
 */
export function useGEMSService() {
  const { connector, address, isConnected } = useRoninWallet();
  const [gemsService, setGemsService] = useState<GEMSService | null>(null);
  
  // Initialize the GEMS service when wallet is connected
  useEffect(() => {
    const initService = async () => {
      if (!connector || !isConnected) {
        setGemsService(null);
        return;
      }
      
      try {
        const provider = new ethers.BrowserProvider(connector.provider);
        const service = new GEMSService(provider);
        
        if (isConnected && address) {
          const signer = await provider.getSigner();
          service.setSigner(signer);
        }
        
        setGemsService(service);
      } catch (error) {
        console.error('Error initializing GEMS service:', error);
        setGemsService(null);
      }
    };
    
    initService();
  }, [connector, address, isConnected]);
  
  // Function to get balance
  const getBalance = useCallback(async (address?: string, forceRefresh = false): Promise<string> => {
    if (!gemsService || !isConnected) return '0';
    
    try {
      return await gemsService.getBalance(address, forceRefresh);
    } catch (error) {
      console.error('Error getting GEMS balance:', error);
      return '0';
    }
  }, [gemsService, isConnected]);
  
  // Function to transfer tokens
  const transfer = useCallback(async (to: string, amount: string): Promise<ethers.TransactionResponse> => {
    if (!gemsService || !isConnected) {
      throw new Error('GEMS service not initialized or wallet not connected');
    }
    
    return await gemsService.transfer(to, amount);
  }, [gemsService, isConnected]);
  
  // Function to get token decimals
  const getDecimals = useCallback(async (): Promise<number> => {
    if (!gemsService) return 18; // Default
    return await gemsService.getDecimals();
  }, [gemsService]);
  
  return {
    isReady: !!gemsService && isConnected,
    getBalance,
    transfer,
    getDecimals
  };
}

export default GEMSService;
