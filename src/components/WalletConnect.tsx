/**
 * @title WalletConnect component
 * @notice Component for connecting to Ronin wallet
 * @dev Uses the useWallet hook to handle wallet connections
 */

import React from 'react';
import { useWallet } from '../hooks/useWallet';

export const WalletConnect: React.FC = () => {
  const { isConnected, connect, disconnect, isCorrectNetwork } = useWallet();

  return (
    <div className="flex items-center">
      {!isConnected ? (
        <button
          onClick={connect}
          className="bg-[#2a1a0a] hover:bg-[#3a2a1a] border border-amber-500/50 text-amber-400 font-winky px-4 py-2 rounded-lg transition-all duration-300 shadow-md hover:shadow-amber-900/20"
        >
          Connect Wallet
        </button>
      ) : !isCorrectNetwork ? (
        <div className="flex flex-col items-center">
          <button
            onClick={disconnect}
            className="bg-red-700 hover:bg-red-800 text-white font-winky px-4 py-2 rounded-lg transition-all duration-300 shadow-md"
          >
            Wrong Network
          </button>
          <p className="text-xs text-red-400 mt-1">Please switch to Ronin</p>
        </div>
      ) : (
        <button
          onClick={disconnect}
          className="bg-[#2a1a0a] hover:bg-[#3a2a1a] border border-amber-500/50 text-amber-400 font-winky px-4 py-2 rounded-lg transition-all duration-300 shadow-md hover:shadow-amber-900/20"
        >
          Disconnect
        </button>
      )}
    </div>
  );
};

export default WalletConnect;
