# Mining Masters - Testnet Integration Testing Guide

This guide will help you test the Mining Masters frontend integration with the Saigon testnet contracts.

## Prerequisites

1. **Ronin Wallet with Saigon Testnet Configuration**
   - Make sure your Ronin wallet is configured for Saigon testnet (Chain ID: 2021)
   - Follow the [Accessing Saigon Testnet guide](https://support.roninchain.com/hc/en-us/articles/14035929237787-Accessing-Saigon-Testnet)
   - Get testnet RON from the [Ronin Faucet](https://faucet.roninchain.com/)

2. **Miner NFTs**
   - You need at least one Miner NFT to test staking
   - Use the `mint-test-miners.ts` script to mint test NFTs to your wallet

3. **Frontend Dependencies**
   - Make sure you have all required dependencies installed
   ```bash
   npm install
   ```

## Running the Frontend with Testnet Configuration

We've added a convenient script to run the frontend with testnet configuration:

```bash
# Start the frontend with testnet configuration
npm run dev:testnet
```

This will automatically load the testnet contract addresses and network configuration.

## Testing Checklist

Follow this checklist to verify all frontend-contract integrations:

### 1. Wallet Connection
- [ ] Connect your Ronin wallet to the app
- [ ] Verify wallet address is displayed correctly
- [ ] Verify network is correctly identified as Saigon testnet

### 2. Miner NFT Display
- [ ] Verify your owned Miner NFTs are displayed correctly
- [ ] Check that NFT metadata (images, properties) is loaded properly
- [ ] Confirm NFT count matches your wallet's actual holdings

### 3. Staking Functionality
- [ ] Test staking a Miner NFT
- [ ] Verify the NFT appears in your staked miners list
- [ ] Check that the staking timestamp is recorded correctly
- [ ] Verify pending rewards start accumulating (using the getPendingRewards function)
- [ ] Test unstaking a Miner NFT
- [ ] Verify the NFT returns to your wallet after unstaking

### 4. GEMS Token Functionality
- [ ] Check your GEMS token balance displays correctly
- [ ] Verify claiming rewards adds GEMS to your balance
- [ ] Test the claim rewards function and verify transaction success

## Known Testnet Limitations

- Rate limiting is set to 100 GEMS per day per account and 10,000 GEMS per day contract-wide
- Testnet transactions might be slower than mainnet
- Some wallet interactions may require additional confirmations on testnet

## Troubleshooting

### Common Issues

1. **Wallet Connection Issues**
   - Make sure your Ronin wallet is properly configured for Saigon testnet
   - Check browser console for connection errors
   - Try disconnecting and reconnecting the wallet

2. **Contract Interaction Failures**
   - Verify you have enough testnet RON for gas fees
   - Check transaction parameters in browser console
   - Verify the contract addresses match those in the `.env.testnet` file

3. **NFT Display Issues**
   - Clear browser cache and reload
   - Check that IPFS gateway is accessible
   - Verify NFT metadata URI format in browser console

### Getting Help

If you encounter issues during testing:
1. Check the browser console for detailed error messages
2. Document the steps to reproduce the issue
3. Record any error messages and transaction hashes
4. Contact the development team with this information

## Minting Test NFTs

To mint test NFTs for integration testing, use the provided script:

```bash
# From the project root directory
cd ..
npx hardhat run scripts/mint-test-miners.ts --network saigon
```

This will mint test NFTs to your connected wallet address.
