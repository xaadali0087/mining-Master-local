/**
 * @title useWallet hook
 * @notice Custom React hook for using the wallet context in components
 * @dev Provides a clean interface to the WalletContext
 */

import { useContext } from 'react';
import { WalletContext } from '../services/wallet/WalletProvider';

/**
 * Hook for accessing wallet context values in components
 * @returns The current wallet context values
 */
export function useWallet() {
  const context = useContext(WalletContext);
  
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  
  return context;
}

export default useWallet;
