# Mining Masters Frontend-Contract Integration Plan

## Overview
This document outlines the strategy for integrating the Mining Masters frontend application with the Ronin blockchain smart contracts. The frontend is a standalone React/TypeScript application that communicates with deployed smart contracts through a well-defined interface layer.

## 1. Directory Structure

```
Front-End/
├── src/
│   ├── contracts/              # Contract interfaces and ABIs
│   │   ├── abis/               # JSON ABI files
│   │   ├── types/              # TypeScript interfaces 
│   │   └── versions.json       # Version compatibility tracking
│   ├── services/
│   │   ├── wallet/             # Wallet connection services
│   │   │   ├── WalletProvider.tsx
│   │   │   └── useWallet.ts    # Wallet hook
│   │   └── contracts/          # Contract service implementations
│   │       ├── GEMSService.ts
│   │       ├── MinerService.ts
│   │       ├── StakingService.ts
│   │       └── MiningService.ts
│   └── config/
│       └── contracts.ts        # Network-specific contract addresses
```

## 2. Implementation Plan

### 2.1 Contract Interface Layer

Create TypeScript interfaces that define the contract methods available to the frontend. Example:

```typescript
// src/contracts/types/IGEMSToken.ts
export interface IGEMSToken {
  balanceOf(address: string): Promise<bigint>;
  transfer(to: string, amount: bigint): Promise<boolean>;
  approve(spender: string, amount: bigint): Promise<boolean>;
  allowance(owner: string, spender: string): Promise<bigint>;
  totalSupply(): Promise<bigint>;
}
```

### 2.2 ABI Management

Store contract ABIs in JSON files and use them to create typesafe contract instances:

```typescript
// src/contracts/abis/GEMSTokenABI.json
[
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  // ...other ABI entries
]
```

### 2.3 Contract Services

Create service classes that abstract contract interactions:

```typescript
// src/services/contracts/GEMSService.ts
import { ethers } from 'ethers';
import GEMSTokenABI from '../../contracts/abis/GEMSTokenABI.json';
import { IGEMSToken } from '../../contracts/types/IGEMSToken';
import { getContractAddress } from '../../config/contracts';

export class GEMSService {
  private contract: ethers.Contract;
  
  constructor(provider: ethers.providers.Provider) {
    const address = getContractAddress('GEMS');
    this.contract = new ethers.Contract(address, GEMSTokenABI, provider);
  }
  
  async getBalance(address: string): Promise<string> {
    const balance = await this.contract.balanceOf(address);
    return ethers.utils.formatUnits(balance, 18);
  }
  
  // Other contract methods...
}
```

### 2.4 Wallet Connection

Implement a wallet provider that handles connections to Ronin wallet:

```typescript
// src/services/wallet/WalletProvider.tsx
import React, { createContext, useEffect, useState } from 'react';
import { ethers } from 'ethers';

export const WalletContext = createContext<{
  account: string | null;
  provider: ethers.providers.Web3Provider | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}>({
  account: null,
  provider: null,
  connect: async () => {},
  disconnect: () => {},
});

export const WalletProvider: React.FC = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  
  // Implementation details...
  
  return (
    <WalletContext.Provider value={{ account, provider, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
};
```

### 2.5 Configuration Management

Create a configuration system for contract addresses based on the current network:

```typescript
// src/config/contracts.ts
interface ContractAddresses {
  [key: string]: {
    [network: string]: string;
  };
}

const CONTRACT_ADDRESSES: ContractAddresses = {
  GEMS: {
    mainnet: '0x...',  // Ronin Mainnet address (Chain ID 2020)
    testnet: '0x...',  // Saigon Testnet address (Chain ID 2021)
  },
  Miner: {
    mainnet: '0x...',
    testnet: '0x...',
  },
  // Other contracts...
};

export function getContractAddress(contractName: string): string {
  const network = import.meta.env.VITE_NETWORK_ENV || 'testnet';
  return CONTRACT_ADDRESSES[contractName][network];
}
```

## 3. UI Integration Strategy

1. Replace mock data with actual contract calls in all UI components
2. Implement loading states for blockchain transactions
3. Add error handling for failed transactions
4. Create toast notifications for transaction status

## 4. Testing and Security

1. Create unit tests for each contract service
2. Test connection edge cases and error handling
3. Implement a mock provider for testing without a blockchain connection
4. Perform security review focusing on:
   - Private key handling
   - Transaction signing security
   - Input validation for contract interactions

## 5. Version Compatibility

Track contract version compatibility using a version.json file:

```json
{
  "GEMS": {
    "currentVersion": "1.0.0",
    "compatibleWithFrontend": "1.0.0",
    "breaking": [],
    "lastUpdated": "2025-05-20"
  },
  "Miner": {
    "currentVersion": "1.0.0",
    "compatibleWithFrontend": "1.0.0",
    "breaking": [],
    "lastUpdated": "2025-05-20"
  }
}
```

## Implementation Timeline

1. Setup contract interface layer (2 days)
2. Implement wallet connection (1 day)
3. Create contract services (3 days)
4. Configure network-specific addresses (1 day)
5. Update UI components with actual functionality (4 days)
6. Testing and security review (2 days)

Total: ~2 weeks
