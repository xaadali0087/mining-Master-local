import { useState, useEffect } from 'react';
import { useGEMSService } from '../services/contracts/GEMSService';
import { useRoninWallet } from '../services/wallet/RoninWalletProvider';

type WalletConnectorProps = {
  onConnect?: (address: string, chainId: number) => void;
  onDisconnect?: () => void;
  className?: string;
};

/**
 * WalletConnector component for connecting to Ronin Wallet
 * Following Sky Mavis official documentation for Ronin Wallet integration
 */
export const BALANCE_REFRESH_EVENT = 'miningmasters:refresh-balance';

export function WalletConnector({ 
  onConnect, 
  onDisconnect,
  className = '' 
}: WalletConnectorProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gemsBalance, setGemsBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  
  // Use the GEMS service to get token balance
  const { getBalance } = useGEMSService();
  
  // Use the RoninWallet provider for connection state
  const { isConnected, address: connectedAddress, connect: walletConnect, disconnect: walletDisconnect } = useRoninWallet();

  // Initial setup when component mounts
  useEffect(() => {
    // Fetch GEMS balance if wallet is already connected
    if (isConnected && connectedAddress) {
      fetchGemsBalance();
    }
  }, [isConnected, connectedAddress]);

  // Connect to Ronin Wallet
  const connectRoninWallet = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      // Use the RoninWalletProvider's connect method
      await walletConnect();
      
      // Call onConnect callback if provided and we have an address
      if (isConnected && connectedAddress) {
        onConnect?.(connectedAddress, 2021); // Using testnet chain ID by default
        
        // Fetch GEMS balance
        fetchGemsBalance();
      }
    } catch (error) {
      console.error('Failed to connect to Ronin Wallet:', error);
      setError('Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Fetch GEMS balance
  const fetchGemsBalance = async (forceRefresh = false) => {
    if (!isConnected || !connectedAddress) {
      console.log('Cannot fetch GEMS balance - not connected');
      setGemsBalance('0');
      return;
    }
    
    try {
      setIsLoadingBalance(true);
      console.log(`Fetching GEMS balance for address: ${connectedAddress}${forceRefresh ? ' (forced refresh)' : ''}`);
      
      // Use the forceRefresh parameter to bypass cache when needed
      const balance = await getBalance(undefined, forceRefresh);
      
      console.log('Received GEMS balance:', balance);
      if (balance !== '0' || forceRefresh) {
        // Only update UI if we got a non-zero balance or explicitly forced refresh
        setGemsBalance(balance);
      }
    } catch (error) {
      console.error('Error fetching GEMS balance:', error);
      // Don't set to '0' on error to avoid UI flashing, unless force refreshing
      if (forceRefresh) setGemsBalance('0');
    } finally {
      setIsLoadingBalance(false);
    }
  };
  
  // Create an event listener for balance refresh events
  useEffect(() => {
    // Create event handler
    const handleBalanceRefresh = () => {
      console.log('Balance refresh event received');
      // Force refresh from blockchain when this event is triggered (e.g., after staking/unstaking)
      fetchGemsBalance(true);
    };
    
    // Add event listener
    window.addEventListener(BALANCE_REFRESH_EVENT, handleBalanceRefresh);
    
    // Clean up
    return () => {
      window.removeEventListener(BALANCE_REFRESH_EVENT, handleBalanceRefresh);
    };
  }, [fetchGemsBalance]);

  // Disconnect from Ronin Wallet
  const disconnectWallet = () => {
    walletDisconnect();
    setGemsBalance('0');
    onDisconnect?.();
  };

  // Note: Chain switching functionality is available but not used in this component.
  // It's implemented in the RoninWalletProvider for app-wide use.

  // Format address for display (0x1234...5678)
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Get wallet address part of the button text
  const getWalletAddressPart = () => {
    if (isConnecting) return 'Connecting...';
    if (isConnected && connectedAddress) {
      return formatAddress(connectedAddress);
    }
    return 'Connect Wallet';
  };
  
  // Get GEMS balance part of the button text
  const getGEMSBalancePart = () => {
    if (!connectedAddress) return null;
    if (isLoadingBalance) {
      return 'Loading...';
    }
    return `${parseFloat(gemsBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })} GEMS`;
  };

  // Effect to update balance when wallet is connected
  useEffect(() => {
    if (isConnected && connectedAddress) {
      console.log('Wallet connected, setting up GEMS balance tracking');
      // Fetch balance immediately with forced refresh
      fetchGemsBalance(true);
      
      // Set up interval to refresh balance every 5 seconds
      // This matches the cache duration in GEMSService
      const intervalId = setInterval(() => fetchGemsBalance(false), 5000);
      
      return () => {
        console.log('Clearing GEMS balance interval');
        clearInterval(intervalId);
      };
    }
  }, [connectedAddress, isConnected]);
  
  // Also update balance when gemsService changes
  useEffect(() => {
    if (isConnected && connectedAddress) {
      fetchGemsBalance();
    }
  }, [getBalance]);

  return (
    <div>
      {isConnected && connectedAddress ? (
        <div className={`flex items-center gap-2 ${className}`}>
          <button 
            onClick={disconnectWallet}
            className="flex items-center bg-[#2a1a0c] px-4 py-2 rounded-full border border-amber-500 text-amber-400 font-winky transition hover:bg-amber-900"
            data-component-name="WalletConnector"
          >
            <span className="whitespace-nowrap mr-2">{getWalletAddressPart()}</span>
            {connectedAddress && (
              <>
                <span className="mx-1">|</span>
                <img
                  src="/images/Mine.png"
                  alt="Gem"
                  className="size-5 mx-1 object-contain"
                  data-component-name="WalletConnector"
                />
                <span className="whitespace-nowrap">{getGEMSBalancePart()}</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <button
          onClick={connectRoninWallet}
          disabled={isConnecting}
          className={`flex items-center bg-[#2a1a0c] px-4 py-2 rounded-full border border-amber-500 text-amber-400 font-winky transition hover:bg-amber-900 ${isConnecting ? 'opacity-70 cursor-not-allowed' : ''} ${className}`}
          data-component-name="WalletConnector"
        >
          {getWalletAddressPart()}
        </button>
      )}
      
      {error && (
        <div className="text-red-500 text-sm mt-1">
          {error}
        </div>
      )}
    </div>
  );
}

export default WalletConnector;
