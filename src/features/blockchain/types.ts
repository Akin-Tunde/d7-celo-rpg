// src/features/blockchain/types.ts

/**
 * Represents the complete stats of a player character as stored in the smart contract.
 * All numeric values are kept as strings to handle large numbers (BigNumber) safely.
 */
export interface PlayerStats {
  name: string;
  level: string;
  experience: string;
  gold: string;
  strength: string;
  defense: string;
  exists: boolean;
}

/**
 * Contains the result of an Ethereum balance check for a wallet.
 */
export interface BalanceCheck {
  hasSufficientBalance: boolean;
  balanceEth: string;      // The current balance in ETH
  requiredEth: string;     // The estimated required balance for a transaction in ETH
  deficitEth?: string;     // The shortfall, if any
}

/**

 * Contains the result of a gas price analysis.
 */
export interface GasAnalysis {
  currentGwei: number;
  shouldWait: boolean;
  recommendation: string;
}

/**
 * A flexible options object for executing different types of transactions.
 */
export interface TransactionOptions {
  playerName?: string;
  itemId?: number;
}
