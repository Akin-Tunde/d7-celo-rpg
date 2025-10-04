"use strict";
// src/core/BotEngine.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotEngine = void 0;
const config_1 = require("../config");
const AIService_1 = require("../features/ai/AIService");
const BlockchainService_1 = require("../features/blockchain/BlockchainService");
const BattleIntelligence_1 = require("../features/gameLogic/BattleIntelligence");
const MemoryManager_1 = require("../features/persistence/MemoryManager");
class BotEngine {
    constructor() {
        this.actionCounter = 0;
        this.startTime = Date.now();
        this.blockchainService = new BlockchainService_1.BlockchainService();
        this.aiService = new AIService_1.AIService();
        this.battleIntelligence = new BattleIntelligence_1.BattleIntelligence();
        this.memoryManager = new MemoryManager_1.MemoryManager();
        this.personalities = this.generatePersonalities();
        this.memories = this.memoryManager.loadMemories();
        this.setupGracefulShutdown();
        this.displayStartupMessage();
    }
    /**
     * Starts and runs the main operational loop of the bot.
     */
    async run() {
        if (this.blockchainService.getWalletCount() === 0) {
            console.error("❌ No valid private keys found. Please check your .env file.");
            return;
        }
        while (true) {
            for (let i = 0; i < this.blockchainService.getWalletCount(); i++) {
                const personality = this.personalities[i];
                console.log(`\n${'─'.repeat(70)}`);
                console.log(`[${personality.name}] Starting turn for wallet ${i + 1}...`);
                try {
                    await this.executeTurn(personality);
                }
                catch (error) {
                    console.error(`[${personality.name}] ❌ An error occurred during the turn:`, error.message);
                }
                this.actionCounter++;
                if (this.actionCounter % config_1.CONFIG.behaviorSettings.reportInterval === 0) {
                    this.generateReport();
                }
                const delay = this.getRandomDelay();
                console.log(`[${personality.name}] 🕒 Waiting ${Math.round(delay / 1000)}s until next turn...\n`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    /**
     * Executes a single, complete turn for a given personality.
     */
    async executeTurn(personality) {
        const { address, name } = personality;
        const walletIndex = this.personalities.findIndex(p => p.address === address);
        if (!config_1.CONFIG.simulationMode) {
            const gasCheck = await this.blockchainService.analyzeGas();
            if (gasCheck.shouldWait) {
                console.log(`[${name}] ⛽ Gas price is too high (${gasCheck.recommendation}). Skipping turn.`);
                return;
            }
        }
        const stats = await this.blockchainService.getPlayerStats(address);
        const memory = this.memories.get(address) || this.memoryManager.initializeMemory();
        if (!stats.exists) {
            console.log(`[${name}] 🆕 Player does not exist. Attempting to create...`);
            await this.blockchainService.executeTransaction('createPlayer', walletIndex, { playerName: name });
            return;
        }
        const strategicAnalysis = this.battleIntelligence.getStrategicAnalysis(stats, memory, personality);
        console.log(`[${name}] 🤖 Consulting AI with strategic analysis...`);
        const aiDecision = await this.aiService.getDecision(strategicAnalysis.prompt);
        const validatedDecision = this.validateAIDecision(aiDecision, stats, memory);
        console.log(`[${name}] 🎯 AI Decision: ${validatedDecision.action.toUpperCase()}`);
        console.log(`[${name}] 💭 "${validatedDecision.reasoning}"`);
        if (validatedDecision.action === 'wait') {
            console.log(`[${name}] ⏸️ Waiting as per AI strategy.`);
            return;
        }
        await this.blockchainService.executeTransaction(validatedDecision.action, walletIndex, { itemId: validatedDecision.itemId });
        if (config_1.CONFIG.simulationMode) {
            const outcome = this.memoryManager.simulateOutcome(validatedDecision.action);
            const updatedMemory = this.memoryManager.updateMemory(memory, outcome);
            this.memories.set(address, updatedMemory);
        }
    }
    /**
     * Applies hard-coded safety rules to an AI's decision.
     * Overrides the decision if it violates a critical guardrail.
     */
    validateAIDecision(decision, stats, memory) {
        const gold = parseInt(stats.gold);
        if (decision.action === 'fightMonster' && memory.consecutiveLosses >= config_1.CONFIG.guardrails.maxConsecutiveLosses) {
            console.log(`🛡️ GUARDRAIL OVERRIDE: Blocked fighting due to ${memory.consecutiveLosses} consecutive losses.`);
            return { action: 'train', reasoning: 'Forced training to break a losing streak (Safety Override).' };
        }
        if (decision.action === 'fightMonster' && gold < config_1.CONFIG.guardrails.minGoldForFight) {
            console.log(`🛡️ GUARDRAIL OVERRIDE: Blocked fighting with only ${gold} gold.`);
            return { action: 'train', reasoning: 'Gold is too low to risk a fight (Safety Override).' };
        }
        if (decision.action === 'buyItem' && decision.itemId !== undefined) {
            const item = config_1.CONFIG.itemShop[decision.itemId];
            if (item && gold < item.cost) {
                console.log(`🛡️ GUARDRAIL OVERRIDE: Cannot afford ${item.name}.`);
                return { action: 'train', reasoning: `Cannot afford the item, training instead (Safety Override).` };
            }
        }
        return decision;
    }
    /**
     * Creates and assigns the rich, culturally-driven personalities to the wallets.
     */
    // src/core/BotEngine.ts
    // ... (imports and other parts of the BotEngine class)
    /**
     * Creates and assigns the rich, culturally-driven personalities to the wallets.
     * This version contains a full roster of 20 unique profiles.
     */
    generatePersonalities() {
        const profiles = [
            // --- Original 5 ---
            {
                name: 'Bjorn', nationality: 'Vindr Clan (Norse-inspired)',
                background: 'a fearless raider who values strength and glory above all',
                style: 'Aggressive Berserker', risk: 'high',
                specialTrait: 'Aggression Bias: Prefers fighting over training, even at moderate risk. Ignores item ROI if an item grants Strength.'
            },
            {
                name: 'Kenji', nationality: 'Iron Lotus Shogunate (Samurai-inspired)',
                background: 'a disciplined warrior who follows a strict code of preparation and defense',
                style: 'Patient & Defensive', risk: 'medium',
                specialTrait: 'Honor & Defense: Prioritizes defensive items. Considers it dishonorable to fight with low gold reserves (< 50g).'
            },
            {
                name: 'Zahra', nationality: 'Golden Dune Confederacy (Merchant-inspired)',
                background: 'a shrewd trader who believes every action must yield a tangible profit',
                style: 'Hyper-Economist & ROI-Driven', risk: 'low',
                specialTrait: 'Profit Motive: All decisions must maximize gold. Will only buy items with the absolute highest ROI score.'
            },
            {
                name: 'Lysandra', nationality: 'Arcane Lyceum (Mage-inspired)',
                background: 'a scholar who sees combat as a distraction from the pursuit of power through knowledge',
                style: 'Training-Focused & Cautious', risk: 'low',
                specialTrait: 'Knowledge is Power: Strongly prefers training to build stats. Fights only when win probability is overwhelmingly high (>80%).'
            },
            {
                name: 'Roman', nationality: 'Argent Legion (Roman-inspired)',
                background: 'a balanced legionary who values efficiency and tactical superiority',
                style: 'Methodical & Balanced', risk: 'medium',
                specialTrait: 'Tactical Discipline: Aims for a 65-75% win rate. If win rate drops below 60%, will train until it recovers. Values balanced items (Str+Def).'
            },
            // --- New 15 Personalities ---
            {
                name: 'Finn', nationality: 'Free Traders Guild (Rogue-inspired)',
                background: 'an opportunist who takes calculated risks for big payoffs',
                style: 'Opportunist & High-Reward', risk: 'medium',
                specialTrait: 'High-Value Targeter: Focuses on actions with the highest potential gold reward, even if they are not the safest.'
            },
            {
                name: 'Isla', nationality: 'Silent Grove Sentinels (Druid-inspired)',
                background: 'a survivor who prioritizes not losing over winning',
                style: 'Loss-Averse & Resilient', risk: 'low',
                specialTrait: 'Survival Instinct: Will never fight if there is a significant chance of losing gold. Prefers guaranteed, small gains.'
            },
            {
                name: 'Javier', nationality: 'Sunstone Empire (Aztec-inspired)',
                background: 'a zealous warrior who believes momentum is a divine blessing',
                style: 'Streak-Follower & Momentum-Based', risk: 'high',
                specialTrait: 'Momentum Rider: Plays cautiously on a losing streak but becomes extremely aggressive and ignores risks on a winning streak.'
            },
            {
                name: 'Nico', nationality: 'The Jester\'s Court (Chaos-inspired)',
                background: 'a wildcard who thrives on unpredictability',
                style: 'Chaotic & Unpredictable', risk: 'high',
                specialTrait: 'Contrarian: May intentionally make a suboptimal or illogical decision if the situation seems too predictable.'
            },
            {
                name: 'Gideon', nationality: 'Stonewall Citadel (Dwarf-inspired)',
                background: 'a master craftsman who believes in impenetrable defenses',
                style: 'The Fortress & Defense-Focused', risk: 'low',
                specialTrait: 'Unbreakable Defense: Prioritizes Defense stat above all else. Will always buy the best defensive item available.'
            },
            {
                name: 'Seraphina', nationality: 'Celestial Conclave (Healer-inspired)',
                background: 'a pacifist who abhors conflict and seeks peaceful growth',
                style: 'Pacifist & Trainer', risk: 'low',
                specialTrait: 'Conflict Averse: Will avoid fighting unless it is the only possible action (e.g., cannot afford to train).'
            },
            {
                name: 'Orion', nationality: 'The Starforged (Sci-Fi inspired)',
                background: 'a cold analyst who acts purely on data',
                style: 'Data-Driven & Logical', risk: 'medium',
                specialTrait: 'Pure Logic: Ignores qualitative advice. Decision is based purely on the highest win probability and best ROI score.'
            },
            {
                name: 'Draven', nationality: 'Crimson Brotherhood (Assassin-inspired)',
                background: 'a glass cannon who believes a good offense is the only defense needed',
                style: 'All-Out-Offense', risk: 'high',
                specialTrait: 'Glass Cannon: Prioritizes Strength above all else. Will always buy the best offensive item, ignoring defense.'
            },
            {
                name: 'Elara', nationality: 'The Archivists (Librarian-inspired)',
                background: 'a completionist who wants to experience everything the world offers',
                style: 'Collector & Completionist', risk: 'medium',
                specialTrait: 'Gotta Have It All: Goal is to own every item in the shop, regardless of its ROI. Prioritizes buying unowned items.'
            },
            {
                name: 'Cassius', nationality: 'The Syndicate (Gambler-inspired)',
                background: 'a high-roller who lives for the thrill of the bet',
                style: 'High-Stakes Gambler', risk: 'high',
                specialTrait: 'The Thrill of the Gamble: Will sometimes take a very low-probability fight (<40%) just for the chance of a huge reward.'
            },
            {
                name: 'Peyton', nationality: 'The Minimalists',
                background: 'an ascetic who tries to succeed with the absolute minimum',
                style: 'Minimalist & Efficient', risk: 'medium',
                specialTrait: 'Efficiency over Expense: Actively avoids buying items. Tries to win with base stats and training alone.'
            },
            {
                name: 'Rowan', nationality: 'The Hearthguard (Vengeful-inspired)',
                background: 'a fierce protector who takes every loss personally',
                style: 'Vengeful & Retaliatory', risk: 'high',
                specialTrait: 'Vengeance Driven: After a loss, the desire to fight again immediately increases, ignoring normal risk assessment.'
            },
            {
                name: 'Leo', nationality: 'The Scouts Guild',
                background: 'a preparer who believes in extensive reconnaissance before action',
                style: 'Hyper-Cautious & Preparer', risk: 'low',
                specialTrait: 'Reconnaissance Protocol: Must train at least twice after every battle to "gather intel" before fighting again.'
            },
            {
                name: 'Blair', nationality: 'The Elitists',
                background: 'a perfectionist who strives for the best stats and a flawless record',
                style: 'Perfectionist & Stat-Maximizer', risk: 'medium',
                specialTrait: 'Pursuit of Perfection: Will train excessively to maintain a very high win rate (>85%). Avoids any action that could tarnish the record.'
            },
            {
                name: 'Cameron', nationality: 'The Grinders',
                background: 'an efficient player focused on gaining experience above all else',
                style: 'XP-Focused Grinder', risk: 'medium',
                specialTrait: 'XP Above All: Prioritizes actions that grant the most experience points, even if gold gain is suboptimal.'
            }
        ];
        const wallets = this.blockchainService.getWallets();
        return wallets.map((wallet, i) => {
            const profile = profiles[i % profiles.length];
            return {
                address: wallet.address,
                ...profile,
                riskTolerance: profile.risk
            };
        });
    }
    /**
     * Displays the initial startup message with key configuration details.
     */
    displayStartupMessage() {
        const mode = config_1.CONFIG.simulationMode ? '🧪 SIMULATION' : '🔴 LIVE';
        console.log('='.repeat(70));
        console.log(`🚀 Starting Enhanced AI Bot [${mode}]`);
        console.log(`  - Wallets Loaded: ${this.blockchainService.getWalletCount()}`);
        console.log(`  - Contract: ${config_1.CONFIG.contractAddress}`);
        console.log(`  - AI Model: ${config_1.CONFIG.aiSettings.aiModel}`); // Corrected line
        console.log('='.repeat(70));
    }
    /**
     * Sets up listeners to save memory and shut down the bot gracefully.
     */
    setupGracefulShutdown() {
        const shutdown = () => {
            console.log('\n\n🛑 Shutting down gracefully...');
            this.memoryManager.saveMemories(this.memories);
            this.generateReport();
            console.log('👋 Goodbye!');
            process.exit(0);
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        setInterval(() => this.memoryManager.saveMemories(this.memories), 300000); // Auto-save every 5 mins
    }
    /**
     * Generates a random delay within the configured min/max range.
     */
    getRandomDelay() {
        const { minDelayMs, maxDelayMs } = config_1.CONFIG.behaviorSettings;
        return Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
    }
    /**
     * Generates and prints a performance report to the console.
     */
    generateReport() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000 / 60);
        console.log('\n' + '='.repeat(70));
        console.log(`📊 BOT PERFORMANCE REPORT - Uptime: ${uptime} minutes`);
        this.personalities.forEach((p) => {
            const memory = this.memories.get(p.address) || this.memoryManager.initializeMemory();
            const winRate = memory.totalBattles > 0
                ? ((memory.battlesWon / memory.totalBattles) * 100).toFixed(1)
                : '0.0';
            const netGold = memory.goldEarned - memory.goldSpent;
            console.log(`\n[${p.name} - ${p.nationality}]`);
            console.log(`  - Actions: ${memory.totalActions} | Battles: ${memory.totalBattles}`);
            console.log(`  - Win Rate: ${winRate}% | Best Streak: ${memory.bestWinStreak} W`);
            console.log(`  - Net Gold: ${netGold > 0 ? '+' : ''}${netGold}`);
            console.log(`  - Items: ${memory.itemsPurchased.map(i => i.name).join(', ') || 'None'}`);
        });
        console.log('='.repeat(70) + '\n');
    }
}
exports.BotEngine = BotEngine;
