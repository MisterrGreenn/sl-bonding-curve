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
import './PoolManager.css';

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
    <div className="pool-manager">
      <div className="manager-section">
        <div className="section-header">
          <div className="section-icon">🪙</div>
          <div className="section-title">
            <h3>Create New Token</h3>
            <p>Generate a new SPL token with 1 billion supply</p>
          </div>
        </div>
        
        <div className="section-content">
          <div className="token-info">
            <div className="info-item">
              <span className="label">Supply:</span>
              <span className="value">1,000,000,000 tokens</span>
            </div>
            <div className="info-item">
              <span className="label">Decimals:</span>
              <span className="value">9</span>
            </div>
            <div className="info-item">
              <span className="label">Standard:</span>
              <span className="value">SPL Token</span>
            </div>
          </div>
          
          <button 
            onClick={createNewToken}
            disabled={isCreating || !publicKey}
            className="action-btn primary"
          >
            {isCreating ? (
              <>
                <span className="btn-spinner"></span>
                Creating Token...
              </>
            ) : (
              <>
                <span className="btn-icon">🚀</span>
                Create New Token
              </>
            )}
          </button>
        </div>
      </div>

      <div className="manager-section">
        <div className="section-header">
          <div className="section-icon">📍</div>
          <div className="section-title">
            <h3>Select Existing Token</h3>
            <p>Enter the mint address of an existing token</p>
          </div>
        </div>
        
        <div className="section-content">
          <div className="input-container">
            <input
              type="text"
              placeholder="Enter token mint address..."
              value={tokenMint}
              onChange={(e) => setTokenMint(e.target.value)}
              className="modern-input"
            />
            <button 
              onClick={selectExistingToken}
              disabled={!tokenMint}
              className="action-btn secondary"
            >
              Select Token
            </button>
          </div>
        </div>
      </div>

      {tokenMint && (
        <div className="manager-section highlight">
          <div className="section-header">
            <div className="section-icon">🌊</div>
            <div className="section-title">
              <h3>Launch Bonding Curve</h3>
              <p>Create a pump.fun style bonding curve for your token</p>
            </div>
          </div>
          
          <div className="section-content">
            <div className="launch-preview">
              <div className="preview-item">
                <span className="preview-label">Token Address:</span>
                <span className="preview-value">{tokenMint.slice(0, 8)}...{tokenMint.slice(-8)}</span>
              </div>
              <div className="preview-item">
                <span className="preview-label">Curve Type:</span>
                <span className="preview-value">Quadratic Bonding Curve</span>
              </div>
              <div className="preview-item">
                <span className="preview-label">Initial Price:</span>
                <span className="preview-value">Dynamic (starts low)</span>
              </div>
            </div>
            
            <div className="launch-warning">
              <div className="warning-icon">⚠️</div>
              <div className="warning-text">
                <strong>Important:</strong> This will seed the bonding curve with all your tokens. 
                Trading will be enabled immediately after launch.
              </div>
            </div>
            
            <button 
              onClick={createPool}
              disabled={isCreatingPool || !sdk}
              className="action-btn primary launch-btn"
            >
              {isCreatingPool ? (
                <>
                  <span className="btn-spinner"></span>
                  Launching Bonding Curve...
                </>
              ) : (
                <>
                  <span className="btn-icon">🎯</span>
                  Launch Bonding Curve
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoolManager; 