"use strict";
// src/features/persistence/MemoryManager.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class MemoryManager {
    constructor() {
        // Resolve paths relative to the project's root directory
        this.memoryFilePath = path_1.default.join(process.cwd(), 'bot-memories.json');
        this.tempMemoryPath = path_1.default.join(process.cwd(), 'bot-memories.tmp.json');
    }
    /**
     * Loads the bot memories from the JSON file on disk.
     * If the file doesn't exist, it returns an empty map.
     * @returns A Map where keys are wallet addresses and values are their GameMemory.
     */
    loadMemories() {
        try {
            if (fs_1.default.existsSync(this.memoryFilePath)) {
                const data = fs_1.default.readFileSync(this.memoryFilePath, 'utf-8');
                const parsedData = JSON.parse(data);
                // The stored format is an array of [key, value] pairs, perfect for the Map constructor.
                if (Array.isArray(parsedData)) {
                    console.log(`[Memory] ✅ Successfully loaded memories for ${parsedData.length} wallets from disk.`);
                    return new Map(parsedData);
                }
            }
            console.log('[Memory] 📝 No existing memory file found. Starting with a clean slate.');
            return new Map();
        }
        catch (error) {
            console.error('[Memory] ⚠️ Failed to load memories:', error);
            console.log('[Memory] Starting with empty memories as a fallback.');
            return new Map();
        }
    }
    /**
     * Saves the current state of all wallet memories to the JSON file.
     * Uses an atomic write operation to prevent data corruption.
     * @param memories - The Map containing all wallet memories.
     */
    saveMemories(memories) {
        try {
            // Convert the Map to an array so it can be serialized to JSON.
            const data = JSON.stringify(Array.from(memories.entries()), null, 2);
            // Atomic write: First, write to a temporary file.
            fs_1.default.writeFileSync(this.tempMemoryPath, data, { encoding: 'utf-8' });
            // If the write was successful, rename the temp file to the final file name.
            // This is an atomic operation on most filesystems, preventing corrupted states.
            fs_1.default.renameSync(this.tempMemoryPath, this.memoryFilePath);
            console.log(`[Memory] 💾 Memories for ${memories.size} wallets saved successfully.`);
        }
        catch (error) {
            console.error('[Memory] ❌ Failed to save memories:', error);
            // Clean up the temporary file if it exists
            if (fs_1.default.existsSync(this.tempMemoryPath)) {
                fs_1.default.unlinkSync(this.tempMemoryPath);
            }
        }
    }
    /**
     * Creates a fresh, empty memory object for a new wallet.
     */
    initializeMemory() {
        return {
            totalActions: 0,
            totalBattles: 0,
            battlesWon: 0,
            battlesLost: 0,
            goldEarned: 0,
            goldSpent: 0,
            itemsPurchased: [],
            recentActions: [],
            consecutiveWins: 0,
            consecutiveLosses: 0,
            bestWinStreak: 0,
        };
    }
    /**
     * Updates a memory object with the outcome of a new action.
     * This is a pure function; it returns a new, updated memory object.
     */
    updateMemory(currentMemory, outcome) {
        const newMemory = { ...currentMemory };
        newMemory.totalActions++;
        newMemory.recentActions.push(outcome);
        // Keep only the last 30 actions for history
        if (newMemory.recentActions.length > 30) {
            newMemory.recentActions = newMemory.recentActions.slice(-30);
        }
        // Update battle-specific stats
        if (outcome.action === 'fightMonster') {
            newMemory.totalBattles++;
            if (outcome.success) {
                newMemory.battlesWon++;
                newMemory.consecutiveWins++;
                newMemory.consecutiveLosses = 0;
                newMemory.bestWinStreak = Math.max(newMemory.bestWinStreak, newMemory.consecutiveWins);
            }
            else {
                newMemory.battlesLost++;
                newMemory.consecutiveLosses++;
                newMemory.consecutiveWins = 0;
            }
        }
        // Update gold stats
        if (outcome.goldChange > 0)
            newMemory.goldEarned += outcome.goldChange;
        if (outcome.goldChange < 0)
            newMemory.goldSpent += Math.abs(outcome.goldChange);
        return newMemory;
    }
    /**
     * Simulates a fake outcome for an action.
     * ONLY to be used in simulation mode.
     */
    simulateOutcome(action) {
        // In a real scenario, you'd have more complex simulation logic here.
        const won = Math.random() > 0.4; // 60% win rate
        switch (action) {
            case 'fightMonster':
                return { action, success: won, goldChange: won ? 40 : -20, expChange: won ? 25 : 5, timestamp: Date.now() };
            case 'train':
                return { action, success: true, goldChange: 15, expChange: 10, timestamp: Date.now() };
            default:
                return { action, success: true, goldChange: 0, expChange: 0, timestamp: Date.now() };
        }
    }
}
exports.MemoryManager = MemoryManager;
