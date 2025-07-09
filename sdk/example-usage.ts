import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createMint, mintTo, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import BondingCurveSDK, { createAndInitializePool } from './bonding-curve-sdk';

async function main() {
  // Setup connection to Solana (use devnet for testing)
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Create a wallet (in production, this would be the user's wallet)
  const wallet = Keypair.generate();
  
  // Airdrop some SOL for testing (only works on devnet/testnet)
  console.log('Requesting airdrop...');
  const airdropSignature = await connection.requestAirdrop(
    wallet.publicKey,
    2 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdropSignature);
  console.log('Airdrop confirmed');

  // Create an Anchor wallet wrapper
  const anchorWallet = new anchor.Wallet(wallet);
  
  // Initialize the SDK
  const sdk = new BondingCurveSDK(connection, anchorWallet);
  
  try {
    // Step 1: Initialize the curve configuration (only needs to be done once per deployment)
    console.log('Initializing curve configuration...');
    const initTx = await sdk.initialize(0); // 0% fee for this example
    console.log('Curve configuration initialized:', initTx);
    
    // Step 2: Create a test token
    console.log('Creating test token...');
    const tokenMint = await createMint(
      connection,
      wallet,
      wallet.publicKey,
      wallet.publicKey,
      9 // 9 decimals
    );
    console.log('Token created:', tokenMint.toString());
    
    // Step 3: Create associated token account for the user
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet,
      tokenMint,
      wallet.publicKey
    );
    
    // Step 4: Mint some tokens to the user (for initial liquidity)
    const mintAmount = 1_000_000 * 10 ** 9; // 1 million tokens
    await mintTo(
      connection,
      wallet,
      tokenMint,
      userTokenAccount.address,
      wallet.publicKey,
      mintAmount
    );
    console.log('Minted tokens to user account');
    
    // Step 5: Create pool and add initial liquidity
    console.log('Creating pool and adding liquidity...');
    const { poolTx, liquidityTx } = await createAndInitializePool(sdk, tokenMint);
    console.log('Pool created and liquidity added');
    
    // Step 6: Get pool information
    const pool = await sdk.getPool(tokenMint);
    if (pool) {
      console.log('Pool Info:');
      console.log('- Creator:', pool.creator.toString());
      console.log('- Token:', pool.token.toString());
      console.log('- Total Supply:', pool.totalSupply.toString());
      console.log('- Reserve Token:', pool.reserveToken.toString());
      console.log('- Reserve SOL:', pool.reserveSol.toString());
    }
    
    // Step 7: Buy tokens
    console.log('\nBuying tokens...');
    const buyAmount = new BN(0.1 * LAMPORTS_PER_SOL); // Buy with 0.1 SOL
    const buyTx = await sdk.buy(tokenMint, buyAmount);
    console.log('Buy transaction:', buyTx);
    
    // Check pool state after buy
    const poolAfterBuy = await sdk.getPool(tokenMint);
    if (poolAfterBuy) {
      console.log('\nPool after buy:');
      console.log('- Reserve Token:', poolAfterBuy.reserveToken.toString());
      console.log('- Reserve SOL:', poolAfterBuy.reserveSol.toString());
      
      // Calculate how many tokens we got
      const tokensBought = pool!.reserveToken.sub(poolAfterBuy.reserveToken);
      console.log('- Tokens bought:', tokensBought.toString());
    }
    
    // Step 8: Sell tokens
    console.log('\nSelling tokens...');
    const sellAmount = new BN(1000 * 10 ** 9); // Sell 1000 tokens
    const sellTx = await sdk.sell(tokenMint, sellAmount);
    console.log('Sell transaction:', sellTx);
    
    // Check pool state after sell
    const poolAfterSell = await sdk.getPool(tokenMint);
    if (poolAfterSell) {
      console.log('\nPool after sell:');
      console.log('- Reserve Token:', poolAfterSell.reserveToken.toString());
      console.log('- Reserve SOL:', poolAfterSell.reserveSol.toString());
      
      // Calculate how much SOL we got
      const solReceived = poolAfterBuy!.reserveSol.sub(poolAfterSell.reserveSol);
      console.log('- SOL received:', solReceived.toString(), 'lamports');
    }
    
    // Step 9: Price calculations
    console.log('\nPrice calculations:');
    const testBuyAmount = new BN(0.5 * LAMPORTS_PER_SOL);
    const expectedTokens = sdk.calculateTokensForSol(poolAfterSell!, testBuyAmount);
    console.log(`- ${testBuyAmount.toString()} lamports would buy: ${expectedTokens.toString()} tokens`);
    
    const testSellAmount = new BN(10000 * 10 ** 9);
    const expectedSol = sdk.calculateSellReturn(poolAfterSell!, testSellAmount);
    console.log(`- Selling ${testSellAmount.toString()} tokens would return: ${expectedSol.toString()} lamports`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
main().catch(console.error); 