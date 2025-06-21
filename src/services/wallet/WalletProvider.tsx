import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { getChainId } from '../../config/contracts';

/**
 * Interface for wallet context values
 */
interface WalletContextType {
  account: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  isConnecting: boolean;
  isConnected: boolean;
  chainId: number | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isCorrectNetwork: boolean;
}

/**
 * Default wallet context values
 */
const defaultWalletContext: WalletContextType = {
  account: null,
  provider: null,
  signer: null,
  isConnecting: false,
  isConnected: false,
  chainId: null,
  connect: async () => {},
  disconnect: () => {},
  isCorrectNetwork: false,
};

/**
 * Wallet context for providing wallet state throughout the app
 */
export const WalletContext = createContext<WalletContextType>(defaultWalletContext);

/**
 * Ronin wallet provider component
 */
export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

  // Expected Ronin chain ID (from config: 2020 for mainnet, 2021 for testnet)
  const expectedChainId = getChainId();

  /**
   * Check if window.ethereum exists and is Ronin wallet
   */
  const isRoninWalletAvailable = (): boolean => {
    return window.ethereum && window.ethereum.isRonin;
  };

  /**
   * Initialize provider from window.ethereum
   */
  const initializeProvider = () => {
    if (isRoninWalletAvailable()) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);
      return provider;
    }
    return null;
  };

  /**
   * Connect to Ronin wallet
   */
  const connect = async (): Promise<void> => {
    if (!isRoninWalletAvailable()) {
      // Alert user to install Ronin wallet if not available
      window.open('https://wallet.roninchain.com', '_blank');
      return;
    }

    try {
      setIsConnecting(true);
      
      // Initialize provider
      const provider = initializeProvider();
      if (!provider) {
        throw new Error('Failed to initialize provider');
      }

      // Request accounts
      const accounts = await provider.send('eth_requestAccounts', []);
      
      // Get network information
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      setChainId(chainId);
      setIsCorrectNetwork(chainId === expectedChainId);

      // Get signer
      const signer = await provider.getSigner();
      setSigner(signer);

      // Set account if accounts were returned
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Error connecting to wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Disconnect from wallet
   */
  const disconnect = (): void => {
    setAccount(null);
    setSigner(null);
    setIsConnected(false);
    setChainId(null);
    setIsCorrectNetwork(false);
  };

  /**
   * Check if already connected on mount
   */
  useEffect(() => {
    const checkConnection = async () => {
      if (isRoninWalletAvailable()) {
        try {
          const provider = initializeProvider();
          if (provider) {
            const accounts = await provider.send('eth_accounts', []);
            if (accounts && accounts.length > 0) {
              setAccount(accounts[0]);
              
              const network = await provider.getNetwork();
              const chainId = Number(network.chainId);
              setChainId(chainId);
              setIsCorrectNetwork(chainId === expectedChainId);
              
              const signer = await provider.getSigner();
              setSigner(signer);
              
              setIsConnected(true);
            }
          }
        } catch (error) {
          console.error('Error checking wallet connection:', error);
        }
      }
    };

    checkConnection();
  }, [expectedChainId]);

  /**
   * Set up event listeners for wallet events
   */
  useEffect(() => {
    if (isRoninWalletAvailable()) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected
          disconnect();
        } else {
          // Account changed
          setAccount(accounts[0]);
          setIsConnected(true);
        }
      };

      const handleChainChanged = (chainIdHex: string) => {
        // Chain changed, reload page as recommended by MetaMask/Ronin
        window.location.reload();
      };

      const handleDisconnect = (error: { code: number; message: string }) => {
        disconnect();
      };

      // Add event listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('disconnect', handleDisconnect);

      // Clean up listeners
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('disconnect', handleDisconnect);
      };
    }
  }, []);

  // Context value
  const value: WalletContextType = {
    account,
    provider,
    signer,
    isConnecting,
    isConnected,
    chainId,
    connect,
    disconnect,
    isCorrectNetwork,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

/**
 * Type declaration for window.ethereum
 */
declare global {
  interface Window {
    ethereum?: {
      isRonin?: boolean;
      request: (request: { method: string; params?: Array<any> }) => Promise<any>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}
