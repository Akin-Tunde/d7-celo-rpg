// src/features/ai/types.ts

/**
 * Defines the "character" and playstyle of a single AI-controlled wallet.
 * This information is used to construct the AI's prompt and guide its behavior.
 */
export interface WalletPersonality {
  address: string;
  name: string;
  background: string;
  style: string;
  riskTolerance: 'low' | 'medium' | 'high';
}

/**
 * Represents the structured decision made by the AI model.
 * The AI's output is validated against this interface to ensure it is usable.
 */
export interface AIDecision {
  /**
   * The specific game action the AI has chosen to take.
   */
  action: 'createPlayer' | 'train' | 'fightMonster' | 'buyItem' | 'levelUp' | 'wait';

  /**
   * The unique identifier for an item, required only when the action is 'buyItem'.
   */
  itemId?: number;

  /**
   * The AI's explanation for why it chose this action, in its own words.
   * This is crucial for logging, debugging, and understanding the AI's thought process.
   */
  reasoning: string;

  /**
   * An optional confidence score (0.0 to 1.0) from the AI about its decision.
   */
  confidence?: number;
}
