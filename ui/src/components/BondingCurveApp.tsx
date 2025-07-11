import React, { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import BondingCurveSDK, { createAndInitializePool } from '../bonding-curve-sdk';
import type { LiquidityPool } from '../bonding-curve-sdk';
import PoolManager from './PoolManager';
import TradingInterface from './TradingInterface';
import PoolInfo from './PoolInfo';
import './BondingCurveApp.css';

type TabType = 'launch' | 'trade' | 'portfolio';

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
  const [activeTab, setActiveTab] = useState<TabType>('launch');

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
      const interval = setInterval(getBalance, 5000);
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
      await sdk.initialize(0);
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

  const handleTokenSelect = (token: PublicKey) => {
    setSelectedToken(token);
    setActiveTab('trade');
  };

  if (!publicKey) {
    return (
      <div className="app-container">
        <div className="hero-section">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-text">Next Generation DeFi</span>
            </div>
            <h1 className="hero-title">
              Launch & Trade
              <span className="gradient-text">Bonding Curve</span>
              Tokens
            </h1>
            <p className="hero-description">
              Create and launch your own tokens with automatic price discovery through our advanced bonding curve mechanism. Fair launch, no presale, pure price discovery.
            </p>
            <div className="hero-cta">
              <WalletMultiButton className="connect-btn" />
            </div>
          </div>
          <div className="hero-visual">
            <div className="curve-animation">
              <svg viewBox="0 0 400 200" className="curve-svg">
                <defs>
                  <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
                <path
                  d="M 50 150 Q 200 50 350 75"
                  stroke="url(#curveGradient)"
                  strokeWidth="3"
                  fill="none"
                  className="curve-path"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo">
              <div className="logo-icon">⚡</div>
              <span className="logo-text">PumpDEX</span>
            </div>
          </div>
          
          <nav className="nav-tabs">
            <button
              className={`nav-tab ${activeTab === 'launch' ? 'active' : ''}`}
              onClick={() => setActiveTab('launch')}
            >
              <span className="tab-icon">🚀</span>
              Launch
            </button>
            <button
              className={`nav-tab ${activeTab === 'trade' ? 'active' : ''}`}
              onClick={() => setActiveTab('trade')}
            >
              <span className="tab-icon">💱</span>
              Trade
            </button>
            <button
              className={`nav-tab ${activeTab === 'portfolio' ? 'active' : ''}`}
              onClick={() => setActiveTab('portfolio')}
            >
              <span className="tab-icon">📊</span>
              Portfolio
            </button>
          </nav>

          <div className="header-actions">
            <div className="balance-display">
              <div className="balance-label">Balance</div>
              <div className="balance-amount">{balance.toFixed(4)} SOL</div>
            </div>
            <WalletMultiButton className="wallet-btn" />
          </div>
        </div>
      </header>

      {/* Messages */}
      {(error || success) && (
        <div className="message-container">
          {error && (
            <div className="message error-message">
              <span className="message-icon">❌</span>
              {error}
            </div>
          )}
          {success && (
            <div className="message success-message">
              <span className="message-icon">✅</span>
              {success}
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="main-content">
        {!isInitialized ? (
          <div className="init-section">
            <div className="init-card">
              <div className="init-icon">🔧</div>
              <h2>System Initialization Required</h2>
              <p>Initialize the bonding curve system to start launching and trading tokens.</p>
              <button 
                onClick={initializeSystem}
                disabled={loading}
                className="init-btn"
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Initializing...
                  </>
                ) : (
                  'Initialize System'
                )}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Launch Tab */}
            {activeTab === 'launch' && (
              <div className="tab-content launch-tab">
                <div className="tab-header">
                  <h2>🚀 Launch Your Token</h2>
                  <p>Create a new token with automatic bonding curve pricing</p>
                </div>
                
                <div className="launch-content">
                  <PoolManager 
                    sdk={sdk}
                    onTokenSelect={handleTokenSelect}
                    onMessage={showMessage}
                    refreshPool={refreshPool}
                  />
                </div>
              </div>
            )}

            {/* Trade Tab */}
            {activeTab === 'trade' && (
              <div className="tab-content trade-tab">
                <div className="tab-header">
                  <h2>💱 Trade Tokens</h2>
                  <p>Buy and sell tokens through the bonding curve</p>
                </div>
                
                {selectedToken && pool ? (
                  <div className="trade-content">
                    <div className="trade-panel">
                      <TradingInterface
                        sdk={sdk}
                        tokenMint={selectedToken}
                        pool={pool}
                        onMessage={showMessage}
                        onTradeComplete={refreshPool}
                      />
                    </div>
                    
                    <div className="info-panel">
                      <PoolInfo pool={pool} tokenMint={selectedToken} />
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">🔍</div>
                    <h3>No Token Selected</h3>
                    <p>Go to the Launch tab to create a token or select an existing one to trade.</p>
                    <button 
                      className="empty-btn"
                      onClick={() => setActiveTab('launch')}
                    >
                      Launch Token
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Portfolio Tab */}
            {activeTab === 'portfolio' && (
              <div className="tab-content portfolio-tab">
                <div className="tab-header">
                  <h2>📊 Your Portfolio</h2>
                  <p>Track your token holdings and trading history</p>
                </div>
                
                <div className="portfolio-content">
                  <div className="coming-soon">
                    <div className="coming-soon-icon">🚧</div>
                    <h3>Coming Soon</h3>
                    <p>Portfolio tracking and analytics features are in development.</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default BondingCurveApp; 