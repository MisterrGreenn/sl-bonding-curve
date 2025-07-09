import React, { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { createMint, mintTo, getOrCreateAssociatedTokenAccount, getAccount } from '@solana/spl-token';
import BondingCurveSDK, { createAndInitializePool } from '../bonding-curve-sdk';
import type { LiquidityPool } from '../bonding-curve-sdk';
import PoolManager from './PoolManager';
import TradingInterface from './TradingInterface';
import PoolInfo from './PoolInfo';
import './BondingCurveApp.css';

const BondingCurveApp: React.FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [sdk, setSdk] = useState<BondingCurveSDK | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedToken, setSelectedToken] = useState<PublicKey | null>(null);
  const [pool, setPool] = useState<LiquidityPool | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Initialize SDK when wallet connects
  useEffect(() => {
    if (publicKey) {
      const newSdk = new BondingCurveSDK(connection, { publicKey, sendTransaction });
      setSdk(newSdk);
      checkInitialization(newSdk);
    } else {
      setSdk(null);
      setIsInitialized(false);
    }
  }, [publicKey, sendTransaction, connection]);

  // Get wallet balance
  useEffect(() => {
    if (publicKey && connection) {
      const getBalance = async () => {
        try {
          const balance = await connection.getBalance(publicKey);
          setBalance(balance / LAMPORTS_PER_SOL);
        } catch (err) {
          console.error('Error fetching balance:', err);
        }
      };
      getBalance();
      const interval = setInterval(getBalance, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  }, [publicKey, connection]);

  // Load pool data when token is selected
  useEffect(() => {
    if (selectedToken && sdk) {
      loadPoolData();
    }
  }, [selectedToken, sdk]);

  const checkInitialization = async (sdkInstance: BondingCurveSDK) => {
    try {
      const config = await sdkInstance.getCurveConfiguration();
      setIsInitialized(config !== null);
    } catch (err) {
      console.error('Error checking initialization:', err);
      setIsInitialized(false);
    }
  };

  const initializeSystem = async () => {
    if (!sdk) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await sdk.initialize(0); // 0% fee
      setIsInitialized(true);
      setSuccess('System initialized successfully!');
    } catch (err: any) {
      setError(`Failed to initialize: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadPoolData = async () => {
    if (!sdk || !selectedToken) return;
    
    try {
      const poolData = await sdk.getPool(selectedToken);
      setPool(poolData);
    } catch (err) {
      console.error('Error loading pool data:', err);
    }
  };

  const refreshPool = useCallback(() => {
    if (selectedToken) {
      loadPoolData();
    }
  }, [selectedToken, sdk]);

  const showMessage = (message: string, isError = false) => {
    if (isError) {
      setError(message);
      setSuccess('');
    } else {
      setSuccess(message);
      setError('');
    }
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 5000);
  };

  if (!publicKey) {
    return (
      <div className="bonding-curve-app">
        <header className="header">
          <h1>🚀 Bonding Curve DEX</h1>
          <p>Connect your wallet to start trading</p>
        </header>
        
        <div className="connect-section">
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  return (
    <div className="bonding-curve-app">
      <header className="header">
        <h1>🚀 Bonding Curve DEX</h1>
        <div className="header-info">
          <div className="balance">
            Balance: {balance.toFixed(4)} SOL
          </div>
          <WalletMultiButton />
        </div>
      </header>

      {error && (
        <div className="message error">
          {error}
        </div>
      )}

      {success && (
        <div className="message success">
          {success}
        </div>
      )}

      {!isInitialized ? (
        <div className="initialization-section">
          <div className="card">
            <h2>System Initialization Required</h2>
            <p>The bonding curve system needs to be initialized before use.</p>
            <button 
              onClick={initializeSystem}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Initializing...' : 'Initialize System'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="main-content">
            <div className="left-panel">
              <PoolManager 
                sdk={sdk}
                onTokenSelect={setSelectedToken}
                onMessage={showMessage}
                refreshPool={refreshPool}
              />
              
              {pool && (
                <div className="pool-info-container">
                  <PoolInfo pool={pool} tokenMint={selectedToken} />
                </div>
              )}
            </div>

            <div className="right-panel">
              {selectedToken && pool && (
                <TradingInterface
                  sdk={sdk}
                  tokenMint={selectedToken}
                  pool={pool}
                  onMessage={showMessage}
                  onTradeComplete={refreshPool}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BondingCurveApp; 