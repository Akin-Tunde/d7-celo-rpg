"use strict";
// src/features/gameLogic/BattleIntelligence.ts
// FINAL CORRECTED VERSION
Object.defineProperty(exports, "__esModule", { value: true });
exports.BattleIntelligence = void 0;
const config_1 = require("../../config");
class BattleIntelligence {
    getStrategicAnalysis(stats, memory, personality) {
        const battlePrediction = this.predictBattleOutcome(stats, memory);
        const itemAnalyses = config_1.CONFIG.itemShop.map(item => this.analyzeItemROI(item.id, stats, memory));
        const prompt = this.buildEnhancedPrompt(stats, memory, personality, battlePrediction, itemAnalyses);
        return { prompt };
    }
    predictBattleOutcome(stats, memory) {
        const factors = [];
        let winProb = 0.5;
        const strength = parseInt(stats.strength);
        const defense = parseInt(stats.defense);
        const powerScore = strength + defense;
        const powerBonus = (powerScore - 20) * 0.005;
        winProb += powerBonus;
        if (powerScore > 30)
            factors.push(`Strong Power Score (${powerScore})`);
        const totalBattles = memory.battlesWon + memory.battlesLost;
        if (totalBattles > 5) {
            const historicalWinRate = memory.battlesWon / totalBattles;
            const historyBonus = (historicalWinRate - 0.5) * 0.2;
            winProb += historyBonus;
            factors.push(`Historical Win Rate: ${(historicalWinRate * 100).toFixed(0)}%`);
        }
        if (memory.consecutiveWins >= 2) {
            winProb += memory.consecutiveWins * 0.05;
            factors.push(`🔥 Hot Streak (${memory.consecutiveWins} wins)`);
        }
        if (memory.consecutiveLosses >= 2) {
            winProb -= memory.consecutiveLosses * 0.07;
            factors.push(`❄️ Cold Streak (${memory.consecutiveLosses} losses)`);
        }
        winProb = Math.max(0.05, Math.min(0.95, winProb));
        const riskLevel = winProb > 0.7 ? 'low' : winProb > 0.45 ? 'medium' : 'high';
        const recommendation = riskLevel === 'low' ? 'Favorable odds' : riskLevel === 'medium' ? 'Calculated risk' : 'High risk, not recommended';
        return {
            winProbability: winProb,
            expectedGoldChange: (winProb * 40) - ((1 - winProb) * 20),
            expectedXpChange: (winProb * 25) + 5,
            riskLevel,
            recommendation,
            contributingFactors: factors,
        };
    }
    analyzeItemROI(itemId, stats, memory) {
        const item = config_1.CONFIG.itemShop[itemId];
        if (!item)
            throw new Error(`Item with ID ${itemId} not found in config.`);
        const isOwned = memory.itemsPurchased.some(p => p.id === itemId);
        const isAffordable = parseInt(stats.gold) >= item.cost;
        const currentPower = parseInt(stats.strength) + parseInt(stats.defense);
        const newPower = currentPower + item.strength + item.defense;
        const powerIncrease = newPower / currentPower - 1;
        const expectedWinRateIncrease = powerIncrease * 0.5;
        const avgGoldPerBattleIncrease = expectedWinRateIncrease * 60;
        const paybackBattles = avgGoldPerBattleIncrease > 0 ? Math.ceil(item.cost / avgGoldPerBattleIncrease) : 999;
        const roiScore = (item.strength + item.defense) / item.cost * 100;
        return {
            itemId: item.id,
            itemName: item.name,
            // FIX #1: The 'cost' property is now correctly included in the return object.
            cost: item.cost,
            isOwned,
            isAffordable,
            expectedWinRateIncrease,
            paybackBattles,
            roiScore,
            recommendation: roiScore > 1 ? 'High Value' : roiScore > 0.5 ? 'Good Value' : 'Low Value',
        };
    }
    buildEnhancedPrompt(stats, memory, personality, prediction, analyses) {
        const winRate = (memory.battlesWon + memory.battlesLost) > 0
            ? (memory.battlesWon / (memory.battlesWon + memory.battlesLost) * 100).toFixed(1)
            : 'N/A';
        const itemsOwned = memory.itemsPurchased.map(i => i.name).join(', ') || 'None';
        return `
You are an AI game player. Your identity is:
Name: "${personality.name}"
Style: ${personality.style}
Background: ${personality.background}

--- STRATEGIC & CULTURAL DIRECTIVE ---
Your Nationality: ${personality.nationality}
Your Core Trait: "${personality.specialTrait}"
**This trait is the most important part of your identity. You MUST let this rule heavily influence your final decision, sometimes even overriding pure logic.**

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
${analyses.map(item => item.isOwned
            ? `[✓] ${item.itemName} (Owned)`
            // FIX #2: Changed 'item.id' to the correct 'item.itemId' to match the interface.
            : `[${item.itemId}] ${item.itemName} (${item.cost}g) - ROI Score: ${item.roiScore.toFixed(2)} - ${item.isAffordable ? 'CAN AFFORD' : 'CANNOT AFFORD'}`).join('\n')}

--- DECISION ---
Based on your personality and, most importantly, your CULTURAL DIRECTIVE, what is your next action?
Your response MUST be a valid JSON object with "action" and "reasoning" fields.
Example for fighting: {"action": "fightMonster", "reasoning": "My clan values glory, and these odds are a worthy challenge."}
Example for training: {"action": "train", "reasoning": "My code of honor requires me to be better prepared before battle."}
`;
    }
}
exports.BattleIntelligence = BattleIntelligence;
