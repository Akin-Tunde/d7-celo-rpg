// src/features/persistence/types.ts

/**
 * Records the outcome of a single, specific action taken by the bot.
 * A list of these is kept to track recent history.
 */
export interface ActionOutcome {
  action: string;
  success: boolean;
  goldChange: number;
  expChange: number;
  timestamp: number;
  details?: string;
}

/**
 * Represents the complete "memory" or state for a single wallet.
 * This is the primary object that gets saved to and loaded from disk.
 */
export interface GameMemory {
  totalActions: number;
  totalBattles: number;
  battlesWon: number;
  battlesLost: number;
  goldEarned: number;
  goldSpent: number;
  itemsPurchased: Array<{ id: number; name: string; cost: number }>;
  recentActions: ActionOutcome[]; // A log of the last ~30 actions
  consecutiveWins: number;
  consecutiveLosses: number;
  bestWinStreak: number;
}
