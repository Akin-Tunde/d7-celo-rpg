// src/features/gameLogic/BattleIntelligence.ts

import { CONFIG } from '../../config';
import { WalletPersonality } from '../ai/types';
import { PlayerStats } from '../blockchain/types';
import { GameMemory } from '../persistence/types';
import { BattlePrediction, ItemROIAnalysis, StrategicAnalysis } from './types';

export class BattleIntelligence {

  /**
   * The main public method that performs all analyses and returns a comprehensive report.
   */
  public getStrategicAnalysis(stats: PlayerStats, memory: GameMemory, personality: WalletPersonality): StrategicAnalysis {
    const battlePrediction = this.predictBattleOutcome(stats, memory);
    const itemAnalyses = CONFIG.itemShop.map(item => this.analyzeItemROI(item.id, stats, memory));
    
    // This method builds the detailed prompt for the AI.
    const prompt = this.buildEnhancedPrompt(stats, memory, personality, battlePrediction, itemAnalyses);

    return { prompt };
  }

  /**
   * Predicts the outcome of the next battle based on current stats and history.
   */
  private predictBattleOutcome(stats: PlayerStats, memory: GameMemory): BattlePrediction {
    const factors: string[] = [];
    let winProb = 0.5; // Start with a 50/50 chance

    const strength = parseInt(stats.strength);
    const defense = parseInt(stats.defense);
    const powerScore = strength + defense;

    // 1. Power Score Factor
    const powerBonus = (powerScore - 20) * 0.005; // Each point above 20 adds 0.5%
    winProb += powerBonus;
    if (powerScore > 30) factors.push(`Strong Power Score (${powerScore})`);

    // 2. Historical Win Rate Factor
    const totalBattles = memory.battlesWon + memory.battlesLost;
    if (totalBattles > 5) {
      const historicalWinRate = memory.battlesWon / totalBattles;
      const historyBonus = (historicalWinRate - 0.5) * 0.2; // Adjusts up to +/- 10%
      winProb += historyBonus;
      factors.push(`Historical Win Rate: ${(historicalWinRate * 100).toFixed(0)}%`);
    }

    // 3. Momentum Factor (Streaks)
    if (memory.consecutiveWins >= 2) {
      winProb += memory.consecutiveWins * 0.05; // 5% bonus for each win in a streak
      factors.push(`🔥 Hot Streak (${memory.consecutiveWins} wins)`);
    }
    if (memory.consecutiveLosses >= 2) {
      winProb -= memory.consecutiveLosses * 0.07; // 7% penalty for each loss
      factors.push(`❄️ Cold Streak (${memory.consecutiveLosses} losses)`);
    }

    // Clamp probability between a realistic 5% and 95%
    winProb = Math.max(0.05, Math.min(0.95, winProb));

    const riskLevel = winProb > 0.7 ? 'low' : winProb > 0.45 ? 'medium' : 'high';
    const recommendation = riskLevel === 'low' ? 'Favorable odds' : riskLevel === 'medium' ? 'Calculated risk' : 'High risk, not recommended';

    return {
      winProbability: winProb,
      expectedGoldChange: (winProb * 40) - ((1 - winProb) * 20), // Simplified EV calculation
      expectedXpChange: (winProb * 25) + 5,
      riskLevel,
      recommendation,
      contributingFactors: factors,
    };
  }

  /**
   * Analyzes the Return on Investment (ROI) for a given shop item.
   */
  private analyzeItemROI(itemId: number, stats: PlayerStats, memory: GameMemory): ItemROIAnalysis {
    const item = CONFIG.itemShop[itemId];
    if (!item) throw new Error(`Item with ID ${itemId} not found in config.`);

    const isOwned = memory.itemsPurchased.some(p => p.id === itemId);
    const isAffordable = parseInt(stats.gold) >= item.cost;
    
    // Estimate power increase and its effect on win rate
    const currentPower = parseInt(stats.strength) + parseInt(stats.defense);
    const newPower = currentPower + item.strength + item.defense;
    const powerIncrease = newPower / currentPower - 1; // e.g., 0.1 for 10% increase
    const expectedWinRateIncrease = powerIncrease * 0.5; // Assume 10% power increase = 5% win rate increase

    // Calculate how many battles it takes to earn the item's cost back
    const avgGoldPerBattleIncrease = expectedWinRateIncrease * 60; // (Win gold - Loss gold)
    const paybackBattles = avgGoldPerBattleIncrease > 0 ? Math.ceil(item.cost / avgGoldPerBattleIncrease) : 999;
    
    // A simple score combining cost and power boost
    const roiScore = (item.strength + item.defense) / item.cost * 100;
    
    return {
      itemId: item.id,
      itemName: item.name,
      isOwned,
      isAffordable,
      expectedWinRateIncrease,
      paybackBattles,
      roiScore,
      recommendation: roiScore > 1 ? 'High Value' : roiScore > 0.5 ? 'Good Value' : 'Low Value',
    };
  }
  
  /**
   * Constructs the final, detailed prompt to be sent to the AI model.
   */
  private buildEnhancedPrompt(
    stats: PlayerStats,
    memory: GameMemory,
    personality: WalletPersonality,
    prediction: BattlePrediction,
    analyses: ItemROIAnalysis[]
  ): string {
    // This function combines all the data into a clear, structured block of text for the AI.
    // It should be comprehensive, including stats, history, predictions, ROI, and available actions.
    
    const winRate = (memory.battlesWon + memory.battlesLost) > 0 
      ? (memory.battlesWon / (memory.battlesWon + memory.battlesLost) * 100).toFixed(1)
      : 'N/A';
      
    const itemsOwned = memory.itemsPurchased.map(i => i.name).join(', ') || 'None';
    
    // Using a template literal to build a rich, multi-line string.
    return `
You are an AI game player with the personality of "${personality.name}".
Your style: ${personality.style}.
Your background: ${personality.background}.

--- STATUS ---
Level: ${stats.level}
Gold: ${stats.gold}
XP: ${stats.experience}
Strength: ${stats.strength}
Defense: ${stats.defense}
Items: ${itemsOwned}

--- HISTORY & PERFORMANCE ---
Win Rate: ${winRate}% (${memory.battlesWon}W / ${memory.battlesLost}L)
Current Streak: ${memory.consecutiveWins > 0 ? `${memory.consecutiveWins} Wins` : `${memory.consecutiveLosses} Losses`}
Best Win Streak: ${memory.bestWinStreak}

--- BATTLE INTELLIGENCE (PREDICTION) ---
Next Battle Win Probability: ${(prediction.winProbability * 100).toFixed(1)}%
Risk Level: ${prediction.riskLevel.toUpperCase()}
Recommendation: ${prediction.recommendation}
Factors: ${prediction.contributingFactors.join(', ')}

--- SHOP ANALYSIS (ROI) ---
${analyses.map(item => 
    item.isOwned 
      ? `[✓] ${item.itemName} (Owned)`
      : `[${item.id}] ${item.itemName} (${item.cost}g) - ROI Score: ${item.roiScore.toFixed(2)} - ${item.isAffordable ? 'CAN AFFORD' : 'CANNOT AFFORD'}`
).join('\n')}

--- DECISION ---
Based on your personality and all the data above, what is your next action?
Your response MUST be a valid JSON object with "action" and "reasoning" fields.
Example for fighting: {"action": "fightMonster", "reasoning": "The odds are in my favor and I need gold."}
Example for buying: {"action": "buyItem", "itemId": 1, "reasoning": "The Iron Sword is a high-value item I can afford."}
`;
  }
      }
