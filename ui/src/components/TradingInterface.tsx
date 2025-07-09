import React, { useState, useEffect } from 'react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import BondingCurveSDK from '../bonding-curve-sdk';
import type { LiquidityPool } from '../bonding-curve-sdk';

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

  const handleQuickAmount = (percentage: number) => {
    if (activeTab === 'buy') {
      // Quick buy amounts: 0.01, 0.1, 0.5, 1 SOL
      const amounts = [0.01, 0.1, 0.5, 1.0];
      setBuyAmount(amounts[percentage].toString());
    } else {
      // Quick sell amounts based on current token balance (placeholder values)
      const amounts = [100, 1000, 10000, 100000];
      setSellAmount(amounts[percentage].toString());
    }
  };

  try {
    return (
      <div className="card">
        <h2>Trading Interface</h2>
      
      {/* Tab Selection */}
      <div className="tab-container">
        <button 
          className={`tab ${activeTab === 'buy' ? 'active' : ''}`}
          onClick={() => setActiveTab('buy')}
        >
          Buy Tokens
        </button>
        <button 
          className={`tab ${activeTab === 'sell' ? 'active' : ''}`}
          onClick={() => setActiveTab('sell')}
        >
          Sell Tokens
        </button>
      </div>

      {/* Buy Interface */}
      {activeTab === 'buy' && (
        <div className="trading-form">
          <h3>Buy Tokens</h3>
          
          <div className="input-group">
            <label>SOL Amount</label>
            <input
              type="number"
              placeholder="0.0"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              className="input"
              step="0.001"
              min="0"
            />
          </div>

          <div className="quick-amounts">
            <button onClick={() => setBuyAmount('0.01')} className="btn btn-small">0.01 SOL</button>
            <button onClick={() => setBuyAmount('0.1')} className="btn btn-small">0.1 SOL</button>
            <button onClick={() => setBuyAmount('0.5')} className="btn btn-small">0.5 SOL</button>
            <button onClick={() => setBuyAmount('1')} className="btn btn-small">1 SOL</button>
          </div>

          {expectedTokens && (
            <div className="estimate">
              <span>Expected tokens: ~{expectedTokens}</span>
            </div>
          )}

          <button
            onClick={handleBuy}
            disabled={!buyAmount || isTrading}
            className="btn btn-primary btn-large"
          >
            {isTrading ? 'Buying...' : 'Buy Tokens'}
          </button>
        </div>
      )}

      {/* Sell Interface */}
      {activeTab === 'sell' && (
        <div className="trading-form">
          <h3>Sell Tokens</h3>
          
          <div className="input-group">
            <label>Token Amount</label>
            <input
              type="number"
              placeholder="0"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              className="input"
              step="1"
              min="0"
            />
          </div>

          <div className="quick-amounts">
            <button onClick={() => setSellAmount('100')} className="btn btn-small">100</button>
            <button onClick={() => setSellAmount('1000')} className="btn btn-small">1K</button>
            <button onClick={() => setSellAmount('10000')} className="btn btn-small">10K</button>
            <button onClick={() => setSellAmount('100000')} className="btn btn-small">100K</button>
          </div>

          {expectedSol && (
            <div className="estimate">
              <span>Expected SOL: ~{expectedSol}</span>
            </div>
          )}

          <button
            onClick={handleSell}
            disabled={!sellAmount || isTrading}
            className="btn btn-primary btn-large"
          >
            {isTrading ? 'Selling...' : 'Sell Tokens'}
          </button>
        </div>
      )}

      {/* Current Price Info */}
      <div className="price-info">
        <h4>Current Pool State</h4>
        <div className="price-stats">
          <div className="stat">
            <span className="label">Tokens Sold:</span>
            <span className="value">{pool.totalSupply.sub(pool.reserveToken).div(new BN("1000000000")).toNumber().toFixed(0)}</span>
          </div>
          <div className="stat">
            <span className="label">SOL in Pool:</span>
            <span className="value">{pool.reserveSol.div(new BN(LAMPORTS_PER_SOL)).toNumber().toFixed(4)}</span>
          </div>
        </div>
      </div>
    </div>
  );
  } catch (error) {
    console.error('Error rendering TradingInterface:', error);
    return (
      <div className="card">
        <h2>Trading Interface</h2>
        <div className="error-message">
          <p>Error loading trading interface. Please try again.</p>
        </div>
      </div>
    );
  }
};

export default TradingInterface; 