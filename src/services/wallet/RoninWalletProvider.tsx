import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import {
  ConnectorError,
  ConnectorErrorType,
  requestRoninWalletConnector
} from '@sky-mavis/tanto-connect';
import { getChainId } from '../../config/contracts';

// Define interface for wallet context
interface RoninWalletContextProps {
  connector: any;
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  isCorrectNetwork: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: (chainId: number) => Promise<void>;
}

// Create context with default values
const RoninWalletContext = createContext<RoninWalletContextProps>({
  connector: null,
  address: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  isCorrectNetwork: false,
  error: null,
  connect: async () => {},
  disconnect: () => {},
  switchChain: async () => {},
});

// Provider component
export const RoninWalletProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [connector, setConnector] = useState<any>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get expected chain ID from config
  const expectedChainId = getChainId();
  const isCorrectNetwork = chainId === expectedChainId;

  // Storage keys for persisting connection state
  const STORAGE_KEY_CONNECTED = 'ronin_wallet_connected';
  const STORAGE_KEY_ADDRESS = 'ronin_wallet_address';
  const STORAGE_KEY_CHAIN_ID = 'ronin_wallet_chain_id';

  // Initialize connector when component mounts
  useEffect(() => {
    const initConnector = async () => {
      try {
        // Check local storage first for persistent connection
        const persistedConnected = localStorage.getItem(STORAGE_KEY_CONNECTED) === 'true';
        const persistedAddress = localStorage.getItem(STORAGE_KEY_ADDRESS);
        const persistedChainId = localStorage.getItem(STORAGE_KEY_CHAIN_ID);
        
        console.log('Checking for persisted wallet connection:', {
          persistedConnected,
          persistedAddress,
          persistedChainId
        });
        
        // Get the connector
        const conn = await requestRoninWalletConnector();
        setConnector(conn);
        
        // If we have persisted connection data, try to use it
        if (persistedConnected && persistedAddress) {
          console.log('Found persisted wallet connection, restoring state');
          
          try {
            // Verify the address is still valid by checking current accounts
            const accounts = await conn.getAccounts();
            
            if (accounts && accounts.length > 0 && accounts.includes(persistedAddress)) {
              setAddress(persistedAddress);
              
              // Get chain ID from persisted value or from connector
              const connectedChainId = persistedChainId ? parseInt(persistedChainId) : await conn.getChainId();
              setChainId(connectedChainId);
              
              setIsConnected(true);
              console.log('Successfully restored wallet connection from persistent storage');
            } else {
              console.log('Persisted address no longer valid, clearing storage');
              localStorage.removeItem(STORAGE_KEY_CONNECTED);
              localStorage.removeItem(STORAGE_KEY_ADDRESS);
              localStorage.removeItem(STORAGE_KEY_CHAIN_ID);
            }
          } catch (error) {
            console.log('Error verifying persisted connection, clearing storage:', error);
            localStorage.removeItem(STORAGE_KEY_CONNECTED);
            localStorage.removeItem(STORAGE_KEY_ADDRESS);
            localStorage.removeItem(STORAGE_KEY_CHAIN_ID);
          }
        } else {
          // No persisted connection, check if user is already connected in this session
          try {
            const accounts = await conn.getAccounts();
            if (accounts && accounts.length > 0) {
              setAddress(accounts[0]);
              
              // Get chain ID
              const connectedChainId = await conn.getChainId();
              setChainId(connectedChainId);
              
              setIsConnected(true);
              
              // Save to local storage
              localStorage.setItem(STORAGE_KEY_CONNECTED, 'true');
              localStorage.setItem(STORAGE_KEY_ADDRESS, accounts[0]);
              localStorage.setItem(STORAGE_KEY_CHAIN_ID, connectedChainId.toString());
            }
          } catch (error) {
            // User has wallet but not connected
            console.log('Wallet available but not connected');
          }
        }
      } catch (error) {
        if (error instanceof ConnectorError) {
          if (error.name === ConnectorErrorType.PROVIDER_NOT_FOUND) {
            setError('Ronin Wallet not installed');
            console.error('Ronin Wallet not found');
          } else {
            setError(`Wallet connection error: ${error.message}`);
            console.error('Wallet connection error:', error);
          }
        }
      }
    };

    initConnector();
  }, []);

  // Connect to wallet
  const connect = async () => {
    if (!connector) {
      try {
        const conn = await requestRoninWalletConnector();
        setConnector(conn);
      } catch (error) {
        if (error instanceof ConnectorError) {
          if (error.name === ConnectorErrorType.PROVIDER_NOT_FOUND) {
            window.open('https://wallet.roninchain.com', '_blank');
            return;
          }
        }
        setError('Failed to initialize wallet connector');
        return;
      }
    }

    try {
      setIsConnecting(true);
      setError(null);
      
      const connectResult = await connector.connect();
      if (connectResult) {
        setAddress(connectResult.account);
        setChainId(connectResult.chainId);
        setIsConnected(true);
        
        // Save connection state to local storage for persistence
        localStorage.setItem(STORAGE_KEY_CONNECTED, 'true');
        localStorage.setItem(STORAGE_KEY_ADDRESS, connectResult.account);
        localStorage.setItem(STORAGE_KEY_CHAIN_ID, connectResult.chainId.toString());
        
        console.log('Wallet connected and saved to local storage');
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setError('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from wallet
  const disconnect = () => {
    setAddress(null);
    setChainId(null);
    setIsConnected(false);
    
    // Clear connection state from local storage
    localStorage.removeItem(STORAGE_KEY_CONNECTED);
    localStorage.removeItem(STORAGE_KEY_ADDRESS);
    localStorage.removeItem(STORAGE_KEY_CHAIN_ID);
    
    console.log('Wallet disconnected and removed from local storage');
  };

  // Switch chain
  const switchChain = async (chainId: number) => {
    try {
      if (!connector) {
        throw new Error('Wallet not initialized');
      }
      
      await connector.switchChain(chainId);
      setChainId(chainId);
    } catch (error) {
      console.error('Failed to switch chain:', error);
      setError('Failed to switch chain');
    }
  };

  const contextValue: RoninWalletContextProps = {
    connector,
    address,
    chainId,
    isConnected,
    isConnecting,
    isCorrectNetwork,
    error,
    connect,
    disconnect,
    switchChain,
  };

  return (
    <RoninWalletContext.Provider value={contextValue}>
      {children}
    </RoninWalletContext.Provider>
  );
};

// Custom hook to use the wallet context
export const useRoninWallet = () => {
  const context = useContext(RoninWalletContext);
  if (context === undefined) {
    throw new Error('useRoninWallet must be used within a RoninWalletProvider');
  }
  return context;
};

export default RoninWalletProvider;
