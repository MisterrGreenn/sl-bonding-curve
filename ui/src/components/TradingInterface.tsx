import React, { useState, useEffect } from 'react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import BondingCurveSDK from '../bonding-curve-sdk';
import type { LiquidityPool } from '../bonding-curve-sdk';
import './TradingInterface.css';

interface TradingInterfaceProps {
  sdk: BondingCurveSDK | null;
  tokenMint: PublicKey;
  pool: LiquidityPool;
  onMessage: (message: string, isError?: boolean) => void;
  onTradeComplete: () => void;
}

const TradingInterface: React.FC<TradingInterfaceProps> = ({ 
  sdk, 
  tokenMint, 
  pool, 
  onMessage, 
  onTradeComplete 
}) => {
  const [buyAmount, setBuyAmount] = useState<string>('');
  const [sellAmount, setSellAmount] = useState<string>('');
  const [expectedTokens, setExpectedTokens] = useState<string>('');
  const [expectedSol, setExpectedSol] = useState<string>('');
  const [isTrading, setIsTrading] = useState(false);
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');

  // Calculate expected tokens when buy amount changes
  useEffect(() => {
    if (buyAmount && sdk && pool) {
      try {
        const solAmount = new BN(parseFloat(buyAmount) * LAMPORTS_PER_SOL);
        const tokens = sdk.calculateTokensForSol(pool, solAmount);
        // Safe conversion by dividing first
        const tokensReadable = tokens.div(new BN("1000000000")).toNumber();
        setExpectedTokens(tokensReadable.toFixed(6));
      } catch (error) {
        setExpectedTokens('');
      }
    } else {
      setExpectedTokens('');
    }
  }, [buyAmount, sdk, pool]);

  // Calculate expected SOL when sell amount changes
  useEffect(() => {
    if (sellAmount && sdk && pool) {
      try {
        const tokenAmount = new BN(parseFloat(sellAmount) * 1e9);
        const sol = sdk.calculateSellReturn(pool, tokenAmount);
        // Safe conversion by dividing first
        const solReadable = sol.div(new BN(LAMPORTS_PER_SOL)).toNumber();
        setExpectedSol(solReadable.toFixed(6));
      } catch (error) {
        setExpectedSol('');
      }
    } else {
      setExpectedSol('');
    }
  }, [sellAmount, sdk, pool]);

  const handleBuy = async () => {
    if (!sdk || !buyAmount) return;

    setIsTrading(true);
    try {
      const solAmount = new BN(parseFloat(buyAmount) * LAMPORTS_PER_SOL);
      const tx = await sdk.buy(tokenMint, solAmount);
      
      onMessage(`Buy successful! Transaction: ${tx.slice(0, 8)}...`);
      setBuyAmount('');
      setExpectedTokens('');
      onTradeComplete();
    } catch (error: any) {
      onMessage(`Buy failed: ${error.message}`, true);
    } finally {
      setIsTrading(false);
    }
  };

  const handleSell = async () => {
    if (!sdk || !sellAmount) return;

    setIsTrading(true);
    try {
      const tokenAmount = new BN(parseFloat(sellAmount) * 1e9);
      const tx = await sdk.sell(tokenMint, tokenAmount);
      
      onMessage(`Sell successful! Transaction: ${tx.slice(0, 8)}...`);
      setSellAmount('');
      setExpectedSol('');
      onTradeComplete();
    } catch (error: any) {
      onMessage(`Sell failed: ${error.message}`, true);
    } finally {
      setIsTrading(false);
    }
  };

  try {
    return (
      <div className="trading-interface">
        <div className="trading-header">
          <div className="trading-icon">💱</div>
          <div className="trading-title">
            <h2>Trading Interface</h2>
            <p>Buy and sell tokens through the bonding curve</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="trading-tabs">
          <button 
            className={`trading-tab ${activeTab === 'buy' ? 'active' : ''}`}
            onClick={() => setActiveTab('buy')}
          >
            <span className="tab-icon">📈</span>
            Buy Tokens
          </button>
          <button 
            className={`trading-tab ${activeTab === 'sell' ? 'active' : ''}`}
            onClick={() => setActiveTab('sell')}
          >
            <span className="tab-icon">📉</span>
            Sell Tokens
          </button>
        </div>

        {/* Buy Interface */}
        {activeTab === 'buy' && (
          <div className="trade-form">
            <div className="form-section">
              <label className="input-label">SOL Amount</label>
              <input
                type="number"
                placeholder="0.0"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                className="trade-input"
                step="0.001"
                min="0"
              />
            </div>

            <div className="quick-amounts">
              <button onClick={() => setBuyAmount('0.01')} className="quick-btn">0.01 SOL</button>
              <button onClick={() => setBuyAmount('0.1')} className="quick-btn">0.1 SOL</button>
              <button onClick={() => setBuyAmount('0.5')} className="quick-btn">0.5 SOL</button>
              <button onClick={() => setBuyAmount('1')} className="quick-btn">1 SOL</button>
            </div>

            {expectedTokens && (
              <div className="estimate-box">
                <div className="estimate-label">Expected tokens</div>
                <div className="estimate-value">~{expectedTokens}</div>
              </div>
            )}

            <button
              onClick={handleBuy}
              disabled={!buyAmount || isTrading}
              className="trade-btn primary"
            >
              {isTrading ? (
                <>
                  <span className="btn-spinner"></span>
                  Buying...
                </>
              ) : (
                <>
                  <span className="btn-icon">🚀</span>
                  Buy Tokens
                </>
              )}
            </button>
          </div>
        )}

        {/* Sell Interface */}
        {activeTab === 'sell' && (
          <div className="trade-form">
            <div className="form-section">
              <label className="input-label">Token Amount</label>
              <input
                type="number"
                placeholder="0"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                className="trade-input"
                step="1"
                min="0"
              />
            </div>

            <div className="quick-amounts">
              <button onClick={() => setSellAmount('100')} className="quick-btn">100</button>
              <button onClick={() => setSellAmount('1000')} className="quick-btn">1K</button>
              <button onClick={() => setSellAmount('10000')} className="quick-btn">10K</button>
              <button onClick={() => setSellAmount('100000')} className="quick-btn">100K</button>
            </div>

            {expectedSol && (
              <div className="estimate-box">
                <div className="estimate-label">Expected SOL</div>
                <div className="estimate-value">~{expectedSol}</div>
              </div>
            )}

            <button
              onClick={handleSell}
              disabled={!sellAmount || isTrading}
              className="trade-btn secondary"
            >
              {isTrading ? (
                <>
                  <span className="btn-spinner"></span>
                  Selling...
                </>
              ) : (
                <>
                  <span className="btn-icon">💸</span>
                  Sell Tokens
                </>
              )}
            </button>
          </div>
        )}

        {/* Pool State */}
        <div className="pool-state">
          <h4>Current Pool State</h4>
          <div className="state-grid">
            <div className="state-item">
              <span className="state-label">Tokens Sold</span>
              <span className="state-value">{pool.totalSupply.sub(pool.reserveToken).div(new BN("1000000000")).toNumber().toFixed(0)}</span>
            </div>
            <div className="state-item">
              <span className="state-label">SOL in Pool</span>
              <span className="state-value">{pool.reserveSol.div(new BN(LAMPORTS_PER_SOL)).toNumber().toFixed(4)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error rendering TradingInterface:', error);
    return (
      <div className="trading-interface">
        <div className="trading-header">
          <div className="trading-icon">⚠️</div>
          <div className="trading-title">
            <h2>Trading Interface</h2>
            <p>Error loading trading interface</p>
          </div>
        </div>
        <div className="error-message">
          <p>Unable to load trading interface. Please try again.</p>
        </div>
      </div>
    );
  }
};

export default TradingInterface; 