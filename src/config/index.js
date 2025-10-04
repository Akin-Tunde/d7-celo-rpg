"use strict";
// src/config/index.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = exports.CONTRACT_ABI = void 0;
const dotenv = __importStar(require("dotenv"));
// Load environment variables from the .env file at the project root
dotenv.config();
/**
 * The Application Binary Interface (ABI) for the smart contract.
 * This tells our code how to interact with the functions and events on the contract.
 */
exports.CONTRACT_ABI = [
    "event PlayerCreated(address indexed playerAddress, string name, uint256 timestamp)",
    "event PlayerLeveledUp(address indexed playerAddress, uint256 newLevel)",
    "event ItemPurchased(address indexed playerAddress, uint256 itemId, string itemName)",
    "event BattleOutcome(address indexed playerAddress, bool won, uint256 goldChange, uint256 expChange)",
    "function createPlayer(string memory _name) public",
    "function train() public",
    "function levelUp() public",
    "function buyItem(uint256 _itemId) public",
    "function fightMonster() public",
    "function getPlayerStats(address _playerAddress) public view returns (string, uint256, uint256, uint256, uint256, uint256)",
    "function players(address) public view returns (string name, uint256 level, uint256 experience, uint256 gold, uint256 strength, uint256 defense, bool exists)"
];
/**
 * The main configuration object for the entire bot.
 * All settings are centralized here for easy management.
 */
exports.CONFIG = {
    // --- Core Connection Settings ---
    rpcUrl: process.env.RPC_URL || '',
    contractAddress: process.env.CONTRACT_ADDRESS || '',
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    privateKeys: (process.env.PRIVATE_KEYS || '').split(',').map(pk => pk.trim()).filter(pk => pk),
    // --- Operational Mode ---
    simulationMode: process.env.SIMULATION_MODE === 'true',
    // --- Bot Behavior Tuning ---
    behaviorSettings: {
        minDelayMs: 60000, // 1 minute
        maxDelayMs: 300000, // 5 minutes
        gasThresholdGwei: 50, // Skip turns if gas is above this
        minBalanceEth: '0.000001', // Warn if wallet balance drops below this
        maxRetries: 3, // Max transaction retries
        reportInterval: 25, // Generate a performance report every 25 actions
    },
    // --- AI Model Tuning ---
    aiSettings: {
        aiModel: 'anthropic/claude-3.5-sonnet',
        temperature: 0.8, // Higher value = more creative/less predictable
        maxTokens: 1024, // Max length of the AI's response prompt
        timeout: 30000, // 30 seconds
        maxRetries: 3, // Max retries for the AI API call
    },
    // --- In-Game Static Data ---
    itemShop: [
        { id: 0, name: 'Wooden Shield', cost: 50, strength: 0, defense: 5 },
        { id: 1, name: 'Iron Sword', cost: 100, strength: 10, defense: 0 },
        { id: 2, name: 'Steel Armor', cost: 250, strength: 5, defense: 20 },
    ], // Cast to the ItemData type for type safety
    // --- Safety Guardrails ---
    guardrails: {
        maxConsecutiveLosses: 5, // Force 'train' action after this many losses
        minGoldForFight: 20, // Do not allow fighting if gold is below this
        maxGasGwei: 100, // Never send a transaction if gas is above this
        itemPurchaseThreshold: 0.8, // Minimum ROI score to consider buying an item
    }
};
// --- Sanity Checks ---
// A simple check to ensure critical environment variables are loaded.
if (!exports.CONFIG.rpcUrl || !exports.CONFIG.contractAddress || exports.CONFIG.privateKeys.length === 0) {
    console.warn("⚠️  WARNING: One or more critical environment variables (RPC_URL, CONTRACT_ADDRESS, PRIVATE_KEYS) are missing from your .env file.");
}
