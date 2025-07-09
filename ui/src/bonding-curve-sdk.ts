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

// Hardcoded instruction discriminators for our Anchor program
// These are calculated using anchor.utils.sha256.hash(`global:${name}`) and taking first 8 bytes
const INSTRUCTION_DISCRIMINATORS = {
  initialize: Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]),
  create_pool: Buffer.from([233, 146, 209, 142, 207, 104, 64, 188]),
  add_liquidity: Buffer.from([181, 157, 89, 67, 143, 182, 52, 72]),
  remove_liquidity: Buffer.from([80, 85, 209, 72, 24, 206, 177, 108]),
  buy: Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]),
  sell: Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]),
};

// Debug: Log discriminators
console.log('Instruction discriminators:', {
  initialize: Array.from(INSTRUCTION_DISCRIMINATORS.initialize),
  create_pool: Array.from(INSTRUCTION_DISCRIMINATORS.create_pool),
  add_liquidity: Array.from(INSTRUCTION_DISCRIMINATORS.add_liquidity),
  remove_liquidity: Array.from(INSTRUCTION_DISCRIMINATORS.remove_liquidity),
  buy: Array.from(INSTRUCTION_DISCRIMINATORS.buy),
  sell: Array.from(INSTRUCTION_DISCRIMINATORS.sell),
});

// Main SDK class
export class BondingCurveSDK {
  private connection: Connection;
  private wallet: any;

  constructor(connection: Connection, wallet: any) {
    this.connection = connection;
    this.wallet = wallet;
  }

  // Helper method to send and confirm transactions
  private async sendAndConfirmTransaction(ix: TransactionInstruction): Promise<string> {
    try {
      const tx = new Transaction().add(ix);
      const { blockhash } = await this.connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = this.wallet.publicKey;
      
      console.log('Sending transaction with instruction:', {
        programId: ix.programId.toString(),
        keys: ix.keys.map(k => ({ pubkey: k.pubkey.toString(), isSigner: k.isSigner, isWritable: k.isWritable })),
        dataLength: ix.data.length,
        data: Array.from(ix.data)
      });
      
      const signature = await this.wallet.sendTransaction(tx, this.connection);
      console.log('Transaction sent, signature:', signature);
      
      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight: (await this.connection.getLatestBlockhash()).lastValidBlockHeight
      });
      
      if (confirmation.value.err) {
        console.error('Transaction confirmation error:', confirmation.value.err);
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }
      
      console.log('Transaction confirmed successfully');
      return signature;
    } catch (error) {
      console.error('sendAndConfirmTransaction error:', error);
      throw error;
    }
  }

  // Initialize the curve configuration
  async initialize(fee: number): Promise<string> {
    const [curveConfigPDA] = findCurveConfigurationPDA();

    const data = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.initialize,
      Buffer.from(new Float64Array([fee]).buffer),
    ]);

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: curveConfigPDA, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    return await this.sendAndConfirmTransaction(ix);
  }

  // Create a new liquidity pool
  async createPool(tokenMint: PublicKey): Promise<string> {
    // Check if program exists
    const programAccount = await this.connection.getAccountInfo(PROGRAM_ID);
    if (!programAccount) {
      throw new Error(`Program ${PROGRAM_ID.toString()} not found. Make sure it's deployed to devnet.`);
    }
    
    const [poolPDA] = findLiquidityPoolPDA(tokenMint);
    const poolTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      poolPDA,
      true
    );

    console.log('Creating bonding curve with:', {
      programId: PROGRAM_ID.toString(),
      poolPDA: poolPDA.toString(),
      tokenMint: tokenMint.toString(),
      poolTokenAccount: poolTokenAccount.toString(),
      wallet: this.wallet.publicKey.toString(),
      discriminator: Array.from(INSTRUCTION_DISCRIMINATORS.create_pool),
      discriminatorLength: INSTRUCTION_DISCRIMINATORS.create_pool.length
    });

    const data = INSTRUCTION_DISCRIMINATORS.create_pool;
    console.log('Final instruction data:', {
      data: Array.from(data),
      length: data.length,
      buffer: data
    });

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
      data,
    });

    try {
      return await this.sendAndConfirmTransaction(ix);
    } catch (error) {
      console.error('Create pool error details:', error);
      throw error;
    }
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

    const data = INSTRUCTION_DISCRIMINATORS.add_liquidity;

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
      data,
    });

    const tx = new Transaction().add(ix);
    const signature = await this.wallet.sendTransaction(tx, this.connection);
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

    const data = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.remove_liquidity,
      Buffer.from([bump]),
    ]);

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
      data,
    });

    const tx = new Transaction().add(ix);
    const signature = await this.wallet.sendTransaction(tx, this.connection);
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

    const data = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.buy,
      amountInLamports.toArrayLike(Buffer, 'le', 8),
    ]);

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
      data,
    });

    const tx = new Transaction().add(ix);
    const signature = await this.wallet.sendTransaction(tx, this.connection);
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

    const data = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.sell,
      amountTokens.toArrayLike(Buffer, 'le', 8),
      Buffer.from([bump]),
    ]);

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
      data,
    });

    const tx = new Transaction().add(ix);
    const signature = await this.wallet.sendTransaction(tx, this.connection);
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

// Helper function to create and initialize a bonding curve (like pump.fun)
export async function createAndInitializePool(
  sdk: BondingCurveSDK,
  tokenMint: PublicKey,
): Promise<{ poolTx: string; liquidityTx: string }> {
  // Create bonding curve pool
  const poolTx = await sdk.createPool(tokenMint);
  console.log("Bonding curve pool created:", poolTx);

  // Seed the bonding curve with all tokens (this is what makes it a bonding curve)
  const liquidityTx = await sdk.addLiquidity(tokenMint);
  console.log("Bonding curve seeded with tokens:", liquidityTx);

  return { poolTx, liquidityTx };
}

// Export everything
export default BondingCurveSDK; 