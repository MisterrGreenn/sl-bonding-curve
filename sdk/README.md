# Solana Bonding Curve SDK

A TypeScript SDK for interacting with the Solana Bonding Curve Program.

## Overview

This SDK provides a simple interface to interact with a bonding curve program on Solana. The bonding curve implements a quadratic pricing mechanism where:
- Token price increases as more tokens are bought
- Token price decreases as tokens are sold back to the pool

## Installation

```bash
npm install @sl-bonding-curve/sdk
```

## Usage

### Basic Setup

```typescript
import { Connection } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import BondingCurveSDK from '@sl-bonding-curve/sdk';

// Setup connection
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Create wallet (use your wallet adapter in production)
const wallet = new anchor.Wallet(yourKeypair);

// Initialize SDK
const sdk = new BondingCurveSDK(connection, wallet);
```

### Core Functions

#### 1. Initialize Curve Configuration
```typescript
// Initialize with 1% fee
const initTx = await sdk.initialize(1.0);
```

#### 2. Create a Liquidity Pool
```typescript
const poolTx = await sdk.createPool(tokenMintPublicKey);
```

#### 3. Add Initial Liquidity
```typescript
// Adds all user tokens + 0.01 SOL to the pool
const liquidityTx = await sdk.addLiquidity(tokenMintPublicKey);
```

#### 4. Buy Tokens
```typescript
import { BN } from '@coral-xyz/anchor';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

// Buy with 0.5 SOL
const buyAmount = new BN(0.5 * LAMPORTS_PER_SOL);
const buyTx = await sdk.buy(tokenMintPublicKey, buyAmount);
```

#### 5. Sell Tokens
```typescript
// Sell 1000 tokens (with 9 decimals)
const sellAmount = new BN(1000 * 10 ** 9);
const sellTx = await sdk.sell(tokenMintPublicKey, sellAmount);
```

#### 6. Get Pool Information
```typescript
const pool = await sdk.getPool(tokenMintPublicKey);
if (pool) {
  console.log('Pool creator:', pool.creator.toString());
  console.log('Total supply:', pool.totalSupply.toString());
  console.log('Token reserves:', pool.reserveToken.toString());
  console.log('SOL reserves:', pool.reserveSol.toString());
}
```

### Price Calculations

The SDK provides helper functions to calculate prices before executing trades:

```typescript
// Calculate how many tokens you'll get for a given SOL amount
const solAmount = new BN(1 * LAMPORTS_PER_SOL);
const expectedTokens = sdk.calculateTokensForSol(pool, solAmount);

// Calculate how much SOL you'll get for selling tokens
const tokenAmount = new BN(5000 * 10 ** 9);
const expectedSol = sdk.calculateSellReturn(pool, tokenAmount);

// Calculate how much SOL is needed to buy a specific amount of tokens
const desiredTokens = new BN(10000 * 10 ** 9);
const requiredSol = sdk.calculateBuyPrice(pool, desiredTokens);
```

## Bonding Curve Math

The program uses a quadratic bonding curve with the following formula:

```
Price = k * Supply²
```

Where:
- `k` is the bonding curve constant (PROPORTION = 1280)
- Supply is the amount of tokens that have been sold from the pool

### Key Constants

- `INITIAL_PRICE_DIVIDER`: 800,000
- `INITIAL_LAMPORTS_FOR_POOL`: 10,000,000 (0.01 SOL)
- `TOKEN_SELL_LIMIT_PERCENT`: 8000 (80%)
- `PROPORTION`: 1280

## Complete Example

See `example-usage.ts` for a complete working example that demonstrates:
1. Initializing the curve configuration
2. Creating a token
3. Creating a pool
4. Adding liquidity
5. Buying tokens
6. Selling tokens
7. Calculating prices

## Running the Example

```bash
# Install dependencies
npm install

# Run the example (requires devnet SOL)
npx ts-node example-usage.ts
```

## Security Notes

1. The pool creator can remove liquidity at any time
2. Only 80% of tokens can be sold back to the pool
3. The initial liquidity requires 0.01 SOL minimum
4. Always verify pool parameters before trading

## Error Handling

The SDK will throw errors for common issues:
- Insufficient funds
- Invalid amounts
- Pool not found
- Token amount too big to sell
- Not enough SOL/tokens in vault

Always wrap SDK calls in try-catch blocks for proper error handling.

## License

MIT 