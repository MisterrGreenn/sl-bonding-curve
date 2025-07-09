import React, { useState } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { 
  createMint, 
  mintTo, 
  getOrCreateAssociatedTokenAccount,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemptMint,
  getAssociatedTokenAddress
} from '@solana/spl-token';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Keypair, SystemProgram } from '@solana/web3.js';
import BondingCurveSDK, { createAndInitializePool } from '../bonding-curve-sdk';

interface PoolManagerProps {
  sdk: BondingCurveSDK | null;
  onTokenSelect: (token: PublicKey) => void;
  onMessage: (message: string, isError?: boolean) => void;
  refreshPool: () => void;
}

const PoolManager: React.FC<PoolManagerProps> = ({ sdk, onTokenSelect, onMessage, refreshPool }) => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [tokenMint, setTokenMint] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingPool, setIsCreatingPool] = useState(false);

  const createNewToken = async () => {
    if (!publicKey || !sendTransaction || !sdk) return;

    setIsCreating(true);
    try {
      // Generate a new keypair for the mint
      const mintKeypair = Keypair.generate();
      const mint = mintKeypair.publicKey;

      // Get the minimum rent for a mint account
      const mintRent = await getMinimumBalanceForRentExemptMint(connection);

      // Get associated token account address
      const userTokenAccountAddress = await getAssociatedTokenAddress(
        mint,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Create transaction with all instructions
      const transaction = new Transaction();

      // Create mint account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mint,
          space: MINT_SIZE,
          lamports: mintRent,
          programId: TOKEN_PROGRAM_ID,
        })
      );

      // Initialize mint
      transaction.add(
        createInitializeMintInstruction(
          mint,
          9, // decimals
          publicKey,
          publicKey,
          TOKEN_PROGRAM_ID
        )
      );

      // Create associated token account
      transaction.add(
        createAssociatedTokenAccountInstruction(
          publicKey,
          userTokenAccountAddress,
          publicKey,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      // Mint 1 billion tokens to the user
      const mintAmount = 1_000_000_000 * 10 ** 9; // 1 billion tokens
      transaction.add(
        createMintToInstruction(
          mint,
          userTokenAccountAddress,
          publicKey,
          mintAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      // Set recent blockhash
      transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      transaction.feePayer = publicKey;

      // Sign with mint keypair (we need to do this manually)
      transaction.partialSign(mintKeypair);

      // Send transaction
      const signature = await sendTransaction(transaction, connection);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      setTokenMint(mint.toString());
      onTokenSelect(mint);
      onMessage(`Token created: ${mint.toString()}`);
    } catch (error: any) {
      onMessage(`Failed to create token: ${error.message}`, true);
      console.error('Token creation error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const createPool = async () => {
    if (!sdk || !tokenMint) return;

    setIsCreatingPool(true);
    try {
      const tokenPubkey = new PublicKey(tokenMint);
      const { poolTx, liquidityTx } = await createAndInitializePool(sdk, tokenPubkey);
      
      onMessage(`Pool created and liquidity added! Pool: ${poolTx.slice(0, 8)}...`);
      refreshPool();
    } catch (error: any) {
      onMessage(`Failed to create pool: ${error.message}`, true);
    } finally {
      setIsCreatingPool(false);
    }
  };

  const selectExistingToken = () => {
    if (!tokenMint) return;
    
    try {
      const tokenPubkey = new PublicKey(tokenMint);
      onTokenSelect(tokenPubkey);
      onMessage(`Token selected: ${tokenMint}`);
    } catch (error) {
      onMessage('Invalid token address', true);
    }
  };

  return (
    <div className="card">
      <h2>Pool Manager</h2>
      
      <div className="form-section">
        <h3>Create New Token</h3>
        <p>Create a new SPL token with 1 billion supply</p>
        <button 
          onClick={createNewToken}
          disabled={isCreating || !publicKey}
          className="btn btn-primary"
        >
          {isCreating ? 'Creating Token...' : 'Create New Token'}
        </button>
      </div>

      <div className="form-section">
        <h3>Select Token</h3>
        <input
          type="text"
          placeholder="Token mint address"
          value={tokenMint}
          onChange={(e) => setTokenMint(e.target.value)}
          className="input"
        />
        <button 
          onClick={selectExistingToken}
          disabled={!tokenMint}
          className="btn btn-secondary"
        >
          Select Token
        </button>
      </div>

      {tokenMint && (
        <div className="form-section">
          <h3>Create Bonding Curve</h3>
          <p>Create a pump.fun style bonding curve for this token. This will seed the curve with all your tokens.</p>
          <button 
            onClick={createPool}
            disabled={isCreatingPool || !sdk}
            className="btn btn-primary"
          >
            {isCreatingPool ? 'Creating Bonding Curve...' : 'Create Bonding Curve'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PoolManager; 