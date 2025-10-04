// src/features/gameLogic/types.ts
// CORRECTED VERSION

export interface ItemData {
  id: number;
  name: string;
  cost: number;
  strength: number;
  defense: number;
}

export interface BattlePrediction {
  winProbability: number;
  expectedGoldChange: number;
  expectedXpChange: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
  contributingFactors: string[];
}

export interface ItemROIAnalysis {
  itemId: number;
  itemName: string;
  cost: number; // <-- THIS PROPERTY WAS MISSING
  isOwned: boolean;
  isAffordable: boolean;
  expectedWinRateIncrease: number;
  paybackBattles: number;
  roiScore: number;
  recommendation: string;
}

export interface StrategicAnalysis {
  prompt: string;
}