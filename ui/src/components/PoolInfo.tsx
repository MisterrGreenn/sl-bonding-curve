import React from 'react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import type { LiquidityPool } from '../bonding-curve-sdk';

interface PoolInfoProps {
  pool: LiquidityPool;
  tokenMint: PublicKey | null;
}

const PoolInfo: React.FC<PoolInfoProps> = ({ pool, tokenMint }) => {
  const calculateProgress = () => {
    try {
      // Work with BN values directly to avoid overflow
      const totalSupply = pool.totalSupply;
      const reserveToken = pool.reserveToken;
      
      // Safety check to prevent division by zero
      if (totalSupply.isZero()) {
        return "0.00";
      }
      
      const sold = totalSupply.sub(reserveToken);
      
      // Convert to percentages using BN math
      const progressBN = sold.mul(new BN("10000")).div(totalSupply); // multiply by 10000 for 2 decimal places
      return (progressBN.toNumber() / 100).toFixed(2);
    } catch (error) {
      console.error('Error calculating progress:', error);
      return "0.00";
    }
  };

  const calculateCurrentPrice = () => {
    try {
      // Current price based on tokens sold
      const tokensSold = pool.totalSupply.sub(pool.reserveToken);
      
      // Safety check
      if (tokensSold.isZero()) {
        return 0;
      }
      
      // Convert to readable format by dividing by 1e15 (1e6 * 1e9)
      const tokensSoldInReadable = tokensSold.div(new BN("1000000000000000"));
      
      // Price = (tokens_sold^2) / PROPORTION
      // Since we're working with small numbers now, we can safely convert to number
      const tokensSoldNum = tokensSoldInReadable.toNumber();
      const currentPrice = (tokensSoldNum * tokensSoldNum) / 1280 * 1e9;
      return currentPrice;
    } catch (error) {
      console.error('Error calculating current price:', error);
      return 0;
    }
  };

  const formatNumber = (num: number) => {
    if (isNaN(num) || !isFinite(num)) return "0.00";
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const safeToNumber = (bn: BN, divisor: string) => {
    try {
      return bn.div(new BN(divisor)).toNumber();
    } catch (error) {
      console.error('Error converting BN to number:', error);
      return 0;
    }
  };

  try {
    return (
      <div className="card">
        <h2>Pool Information</h2>
        
        <div className="pool-header">
          <h3>Token: {tokenMint?.toString().slice(0, 8)}...</h3>
          <div className="creator-info">
            <span className="label">Creator:</span>
            <span className="value">{pool.creator.toString().slice(0, 8)}...</span>
          </div>
        </div>

      <div className="pool-stats">
        <div className="stat-row">
          <span className="label">Total Supply:</span>
          <span className="value">{formatNumber(safeToNumber(pool.totalSupply, "1000000000"))}</span>
        </div>
        
        <div className="stat-row">
          <span className="label">Tokens Sold:</span>
          <span className="value">{formatNumber(safeToNumber(pool.totalSupply.sub(pool.reserveToken), "1000000000"))}</span>
        </div>
        
        <div className="stat-row">
          <span className="label">Tokens in Pool:</span>
          <span className="value">{formatNumber(safeToNumber(pool.reserveToken, "1000000000"))}</span>
        </div>
        
        <div className="stat-row">
          <span className="label">SOL in Pool:</span>
          <span className="value">{safeToNumber(pool.reserveSol, LAMPORTS_PER_SOL.toString()).toFixed(6)} SOL</span>
        </div>
        
        <div className="stat-row">
          <span className="label">Current Price:</span>
          <span className="value">{(calculateCurrentPrice() / LAMPORTS_PER_SOL).toFixed(8)} SOL</span>
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-header">
          <span>Progress to Completion</span>
          <span>{calculateProgress()}%</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${calculateProgress()}%` }}
          ></div>
        </div>
      </div>

      <div className="pool-details">
        <h4>Pool Details</h4>
        <div className="detail-row">
          <span className="label">Pool Address:</span>
          <span className="value monospace">{pool.creator.toString()}</span>
        </div>
        <div className="detail-row">
          <span className="label">Token Address:</span>
          <span className="value monospace">{tokenMint?.toString()}</span>
        </div>
        <div className="detail-row">
          <span className="label">Pool Bump:</span>
          <span className="value">{pool.bump}</span>
        </div>
      </div>

      <div className="bonding-curve-info">
        <h4>Bonding Curve Formula</h4>
        <div className="formula">
          <code>Price = (TokensSold² / 1280) * 10⁹</code>
        </div>
        <p className="formula-description">
          This quadratic bonding curve means token prices increase exponentially as more tokens are sold.
        </p>
              </div>
      </div>
    );
  } catch (error) {
    console.error('Error rendering PoolInfo:', error);
    return (
      <div className="card">
        <h2>Pool Information</h2>
        <div className="error-message">
          <p>Error loading pool information. Please try again.</p>
        </div>
      </div>
    );
  }
};

export default PoolInfo; 