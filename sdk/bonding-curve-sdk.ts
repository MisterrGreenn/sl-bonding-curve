import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  Keypair,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';

// Program ID - update this with your deployed program ID
export const PROGRAM_ID = new PublicKey('2RvPPes11jGU8CDZDPLZdKRGZEtWye5ZTJ4PZCKJuUoZ');

// Constants from the Rust program
export const INITIAL_PRICE_DIVIDER = 800_000;
export const INITIAL_LAMPORTS_FOR_POOL = 10_000_000; // 0.01 SOL
export const TOKEN_SELL_LIMIT_PERCENT = 8000; // 80%
export const PROPORTION = 1280;

// Type definitions
export interface CurveConfiguration {
  fees: number;
}

export interface LiquidityPool {
  creator: PublicKey;
  token: PublicKey;
  totalSupply: BN;
  reserveToken: BN;
  reserveSol: BN;
  bump: number;
}

// PDA helper functions
export const findCurveConfigurationPDA = (): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("CurveConfiguration")],
    PROGRAM_ID
  );
};

export const findLiquidityPoolPDA = (tokenMint: PublicKey): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("liquidity_pool"), tokenMint.toBuffer()],
    PROGRAM_ID
  );
};

export const findPoolSolVaultPDA = (tokenMint: PublicKey): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("liquidity_sol_vault"), tokenMint.toBuffer()],
    PROGRAM_ID
  );
};

// Main SDK class
export class BondingCurveSDK {
  private connection: Connection;
  private wallet: anchor.Wallet;

  constructor(connection: Connection, wallet: anchor.Wallet) {
    this.connection = connection;
    this.wallet = wallet;
  }

  // Initialize the curve configuration
  async initialize(fee: number): Promise<string> {
    const [curveConfigPDA] = findCurveConfigurationPDA();

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: curveConfigPDA, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([
        ...Buffer.from([0]), // Discriminator for initialize
        ...Buffer.from(new Float64Array([fee]).buffer), // fee as f64
      ]),
    });

    const tx = new Transaction().add(ix);
    const signature = await this.connection.sendTransaction(tx, [this.wallet.payer]);
    await this.connection.confirmTransaction(signature);
    
    return signature;
  }

  // Create a new liquidity pool
  async createPool(tokenMint: PublicKey): Promise<string> {
    const [poolPDA] = findLiquidityPoolPDA(tokenMint);
    const poolTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      poolPDA,
      true
    );

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: poolPDA, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: true },
        { pubkey: poolTokenAccount, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([1]), // Discriminator for createPool
    });

    const tx = new Transaction().add(ix);
    const signature = await this.connection.sendTransaction(tx, [this.wallet.payer]);
    await this.connection.confirmTransaction(signature);
    
    return signature;
  }

  // Add liquidity to the pool
  async addLiquidity(tokenMint: PublicKey): Promise<string> {
    const [poolPDA] = findLiquidityPoolPDA(tokenMint);
    const [poolSolVault] = findPoolSolVaultPDA(tokenMint);
    
    const poolTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      poolPDA,
      true
    );
    
    const userTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      this.wallet.publicKey
    );

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: poolPDA, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: true },
        { pubkey: poolTokenAccount, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: poolSolVault, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([2]), // Discriminator for addLiquidity
    });

    const tx = new Transaction().add(ix);
    const signature = await this.connection.sendTransaction(tx, [this.wallet.payer]);
    await this.connection.confirmTransaction(signature);
    
    return signature;
  }

  // Remove liquidity from the pool
  async removeLiquidity(tokenMint: PublicKey): Promise<string> {
    const [poolPDA] = findLiquidityPoolPDA(tokenMint);
    const [poolSolVault, bump] = findPoolSolVaultPDA(tokenMint);
    
    const poolTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      poolPDA,
      true
    );
    
    const userTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      this.wallet.publicKey
    );

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: poolPDA, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: true },
        { pubkey: poolTokenAccount, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: poolSolVault, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([3, bump]), // Discriminator for removeLiquidity + bump
    });

    const tx = new Transaction().add(ix);
    const signature = await this.connection.sendTransaction(tx, [this.wallet.payer]);
    await this.connection.confirmTransaction(signature);
    
    return signature;
  }

  // Buy tokens from the pool
  async buy(tokenMint: PublicKey, amountInLamports: BN): Promise<string> {
    const [curveConfigPDA] = findCurveConfigurationPDA();
    const [poolPDA] = findLiquidityPoolPDA(tokenMint);
    const [poolSolVault] = findPoolSolVaultPDA(tokenMint);
    
    const poolTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      poolPDA,
      true
    );
    
    const userTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      this.wallet.publicKey
    );

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: curveConfigPDA, isSigner: false, isWritable: true },
        { pubkey: poolPDA, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: true },
        { pubkey: poolTokenAccount, isSigner: false, isWritable: true },
        { pubkey: poolSolVault, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([
        Buffer.from([4]), // Discriminator for buy
        amountInLamports.toArrayLike(Buffer, 'le', 8), // amount as u64
      ]),
    });

    const tx = new Transaction().add(ix);
    const signature = await this.connection.sendTransaction(tx, [this.wallet.payer]);
    await this.connection.confirmTransaction(signature);
    
    return signature;
  }

  // Sell tokens to the pool
  async sell(tokenMint: PublicKey, amountTokens: BN): Promise<string> {
    const [curveConfigPDA] = findCurveConfigurationPDA();
    const [poolPDA] = findLiquidityPoolPDA(tokenMint);
    const [poolSolVault, bump] = findPoolSolVaultPDA(tokenMint);
    
    const poolTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      poolPDA,
      true
    );
    
    const userTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      this.wallet.publicKey
    );

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: curveConfigPDA, isSigner: false, isWritable: true },
        { pubkey: poolPDA, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: true },
        { pubkey: poolTokenAccount, isSigner: false, isWritable: true },
        { pubkey: poolSolVault, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([
        Buffer.from([5]), // Discriminator for sell
        amountTokens.toArrayLike(Buffer, 'le', 8), // amount as u64
        Buffer.from([bump]), // bump as u8
      ]),
    });

    const tx = new Transaction().add(ix);
    const signature = await this.connection.sendTransaction(tx, [this.wallet.payer]);
    await this.connection.confirmTransaction(signature);
    
    return signature;
  }

  // Get pool information
  async getPool(tokenMint: PublicKey): Promise<LiquidityPool | null> {
    try {
      const [poolPDA] = findLiquidityPoolPDA(tokenMint);
      const accountInfo = await this.connection.getAccountInfo(poolPDA);
      
      if (!accountInfo) {
        return null;
      }

      // Parse the account data
      const data = accountInfo.data;
      const pool: LiquidityPool = {
        creator: new PublicKey(data.slice(8, 40)),
        token: new PublicKey(data.slice(40, 72)),
        totalSupply: new BN(data.slice(72, 80), 'le'),
        reserveToken: new BN(data.slice(80, 88), 'le'),
        reserveSol: new BN(data.slice(88, 96), 'le'),
        bump: data[96],
      };
      
      return pool;
    } catch (error) {
      console.error("Error fetching pool:", error);
      return null;
    }
  }

  // Get curve configuration
  async getCurveConfiguration(): Promise<CurveConfiguration | null> {
    try {
      const [curveConfigPDA] = findCurveConfigurationPDA();
      const accountInfo = await this.connection.getAccountInfo(curveConfigPDA);
      
      if (!accountInfo) {
        return null;
      }

      // Parse the account data
      const data = accountInfo.data;
      const fees = new DataView(data.buffer, 8, 8).getFloat64(0, true);
      
      return { fees };
    } catch (error) {
      console.error("Error fetching curve configuration:", error);
      return null;
    }
  }

  // Calculate buy price (amount of SOL needed to buy X tokens)
  calculateBuyPrice(pool: LiquidityPool, tokenAmount: BN): BN {
    const boughtAmount = pool.totalSupply.sub(pool.reserveToken).toNumber() / 1e6 / 1e9;
    const tokenAmountFloat = tokenAmount.toNumber() / 1e9;
    
    const newBoughtAmount = boughtAmount + tokenAmountFloat;
    const solRequired = (newBoughtAmount * newBoughtAmount - boughtAmount * boughtAmount) / PROPORTION * 1e9;
    
    return new BN(Math.round(solRequired));
  }

  // Calculate sell return (amount of SOL received for selling X tokens)
  calculateSellReturn(pool: LiquidityPool, tokenAmount: BN): BN {
    const boughtAmount = pool.totalSupply.sub(pool.reserveToken).toNumber() / 1e6 / 1e9;
    const resultAmount = pool.totalSupply.sub(pool.reserveToken).sub(tokenAmount).toNumber() / 1e6 / 1e9;
    
    const solReturn = (boughtAmount * boughtAmount - resultAmount * resultAmount) / PROPORTION * 1e9;
    
    return new BN(Math.round(solReturn));
  }

  // Calculate tokens received for a given SOL amount
  calculateTokensForSol(pool: LiquidityPool, solAmount: BN): BN {
    const boughtAmount = pool.totalSupply.sub(pool.reserveToken).toNumber() / 1e6 / 1e9;
    const solAmountFloat = solAmount.toNumber() / 1e9;
    
    const rootVal = Math.sqrt(PROPORTION * solAmountFloat + boughtAmount * boughtAmount);
    const tokensOut = (rootVal - boughtAmount) * 1e6 * 1e9;
    
    return new BN(Math.round(tokensOut));
  }
}

// Helper function to create and initialize a pool with initial liquidity
export async function createAndInitializePool(
  sdk: BondingCurveSDK,
  tokenMint: PublicKey,
): Promise<{ poolTx: string; liquidityTx: string }> {
  // Create pool
  const poolTx = await sdk.createPool(tokenMint);
  console.log("Pool created:", poolTx);

  // Add initial liquidity
  const liquidityTx = await sdk.addLiquidity(tokenMint);
  console.log("Liquidity added:", liquidityTx);

  return { poolTx, liquidityTx };
}

// Export everything
export default BondingCurveSDK; 