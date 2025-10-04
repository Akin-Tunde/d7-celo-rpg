// src/features/gameLogic/types.ts

/**
 * Defines the static properties of an item available in the in-game shop.
 */
export interface ItemData {
  id: number;
  name: string;
  cost: number;
  strength: number;
  defense: number;
}

/**
 * Contains the predicted outcome of a potential battle.
 */
export interface BattlePrediction {
  winProbability: number;
  expectedGoldChange: number;
  expectedXpChange: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
  contributingFactors: string[];
}

/**
 * Contains the economic analysis of purchasing a single item.
 */
export interface ItemROIAnalysis {
  itemId: number;
  itemName: string;
  isOwned: boolean;
  isAffordable: boolean;
  expectedWinRateIncrease: number;
  paybackBattles: number; // How many battles to earn back the cost
  roiScore: number; // A calculated score for how good the investment is
  recommendation: string;
}

/**
 * A comprehensive package of all strategic analysis.
 * This object is passed to the AIService to construct the final prompt.
 */
export interface StrategicAnalysis {
  prompt: string;
  // You could also return the structured data if you prefer to build the prompt in the AIService
  // battlePrediction: BattlePrediction;
  // itemAnalyses: ItemROIAnalysis[];
  // ... other stats
}
