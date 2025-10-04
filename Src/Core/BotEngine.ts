// src/core/BotEngine.ts

import { CONFIG } from '../config';
import { AIService } from '../features/ai/AIService';
import { AIDecision, WalletPersonality } from '../features/ai/types';
import { BlockchainService } from '../features/blockchain/BlockchainService';
import { PlayerStats } from '../features/blockchain/types';
import { BattleIntelligence } from '../features/gameLogic/BattleIntelligence';
import { MemoryManager } from '../features/persistence/MemoryManager';
import { GameMemory } from '../features/persistence/types';

export class BotEngine {
  private readonly blockchainService: BlockchainService;
  private readonly aiService: AIService;
  private readonly battleIntelligence: BattleIntelligence;
  private readonly memoryManager: MemoryManager;

  private personalities: WalletPersonality[];
  private memories: Map<string, GameMemory>;
  private actionCounter: number = 0;
  private startTime: number = Date.now();

  constructor() {
    this.blockchainService = new BlockchainService();
    this.aiService = new AIService();
    this.battleIntelligence = new BattleIntelligence();
    this.memoryManager = new MemoryManager();

    this.personalities = this.generatePersonalities();
    this.memories = this.memoryManager.loadMemories();
    this.setupGracefulShutdown();

    this.displayStartupMessage();
  }

  /**
   * Starts and runs the main operational loop of the bot.
   */
  public async run(): Promise<void> {
    if (this.blockchainService.getWalletCount() === 0) {
      console.error("❌ No valid private keys found. Please check your .env file.");
      return;
    }

    while (true) {
      for (let i = 0; i < this.blockchainService.getWalletCount(); i++) {
        const personality = this.personalities[i];
        const { address } = personality;

        console.log(`\n${'─'.repeat(70)}`);
        console.log(`[${personality.name}] Starting turn for wallet ${i + 1}...`);

        try {
          await this.executeTurn(personality);
        } catch (error: any) {
          console.error(`[${personality.name}] ❌ An error occurred during the turn:`, error.message);
          if (error.message.includes('Insufficient balance')) {
            console.error(`[${personality.name}] 🚨 CRITICAL: Wallet has insufficient ETH! Skipping future turns for this wallet.`);
          }
        }

        // Report every N actions
        this.actionCounter++;
        if (this.actionCounter % CONFIG.behaviorSettings.reportInterval === 0) {
          this.generateReport();
        }
        
        // Wait for a random delay before the next wallet's turn
        const delay = this.getRandomDelay();
        console.log(`[${personality.name}] 🕒 Waiting ${Math.round(delay / 1000)}s until next turn...\n`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Executes a single, complete turn for a given personality.
   */
  private async executeTurn(personality: WalletPersonality): Promise<void> {
    const { address, name } = personality;
    const walletIndex = this.personalities.findIndex(p => p.address === address);

    // 1. Initial Gas Check (skip turn if gas is too high in live mode)
    if (!CONFIG.simulationMode) {
      const gasCheck = await this.blockchainService.analyzeGas();
      if (gasCheck.shouldWait) {
        console.log(`[${name}] ⛽ Gas price is too high (${gasCheck.recommendation}). Skipping turn.`);
        return;
      }
    }

    // 2. Fetch Current State
    const stats: PlayerStats = await this.blockchainService.getPlayerStats(address);
    const memory = this.memories.get(address) || this.memoryManager.initializeMemory(address);

    // 3. Handle Player Creation if Necessary
    if (!stats.exists) {
      console.log(`[${name}] 🆕 Player does not exist. Attempting to create...`);
      await this.blockchainService.executeTransaction('createPlayer', walletIndex, { playerName: name });
      return; // End turn after creation
    }

    // 4. Get Strategic Analysis
    const strategicAnalysis = this.battleIntelligence.getStrategicAnalysis(stats, memory, personality);

    // 5. Consult AI for a Decision
    console.log(`[${name}] 🤖 Consulting AI with strategic analysis...`);
    const aiDecision = await this.aiService.getDecision(strategicAnalysis);

    // 6. Validate AI Decision with Guardrails
    const validatedDecision = this.validateAIDecision(aiDecision, stats, memory);
    console.log(`[${name}] 🎯 AI Decision: ${validatedDecision.action.toUpperCase()}`);
    console.log(`[${name}] 💭 "${validatedDecision.reasoning}"`);

    // 7. Execute Action
    if (validatedDecision.action === 'wait') {
      console.log(`[${name}] ⏸️ Waiting as per AI strategy.`);
      return;
    }
    
    await this.blockchainService.executeTransaction(
      validatedDecision.action,
      walletIndex,
      { itemId: validatedDecision.itemId }
    );

    // 8. Update Memory (Note: Blockchain events should be the primary source of truth for outcomes)
    // For simulation, we manually update memory. In live mode, events handle this.
    if (CONFIG.simulationMode) {
        const outcome = this.memoryManager.simulateOutcome(validatedDecision.action);
        const updatedMemory = this.memoryManager.updateMemory(memory, outcome);
        this.memories.set(address, updatedMemory);
    }
  }

  /**
   * Applies hard-coded safety rules to an AI's decision.
   * Overrides the decision if it violates a critical guardrail.
   */
  private validateAIDecision(decision: AIDecision, stats: PlayerStats, memory: GameMemory): AIDecision {
    const gold = parseInt(stats.gold);

    // GUARDRAIL: Force training after too many consecutive losses
    if (decision.action === 'fightMonster' && memory.consecutiveLosses >= CONFIG.guardrails.maxConsecutiveLosses) {
      console.log(`🛡️ GUARDRAIL OVERRIDE: Blocked fighting due to ${memory.consecutiveLosses} consecutive losses.`);
      return { action: 'train', reasoning: 'Forced training to break a losing streak (Safety Override).' };
    }

    // GUARDRAIL: Block fighting with insufficient gold
    if (decision.action === 'fightMonster' && gold < CONFIG.guardrails.minGoldForFight) {
      console.log(`🛡️ GUARDRAIL OVERRIDE: Blocked fighting with only ${gold} gold.`);
      return { action: 'train', reasoning: 'Gold is too low to risk a fight (Safety Override).' };
    }
    
    // GUARDRAIL: Prevent buying an unaffordable item
    if (decision.action === 'buyItem' && decision.itemId !== undefined) {
      const item = CONFIG.itemShop[decision.itemId];
      if (item && gold < item.cost) {
        console.log(`🛡️ GUARDRAIL OVERRIDE: Cannot afford ${item.name}.`);
        return { action: 'train', reasoning: `Cannot afford the item, training instead (Safety Override).` };
      }
    }

    // Add other validations (e.g., checking for sufficient XP to level up) here...

    return decision; // Decision is valid
  }

  // --- Helper and Setup Methods ---

  private displayStartupMessage(): void {
    const mode = CONFIG.simulationMode ? '🧪 SIMULATION' : '🔴 LIVE';
    console.log('='.repeat(70));
    console.log(`🚀 Starting Enhanced AI Bot [${mode}]`);
    console.log(`  - Wallets Loaded: ${this.blockchainService.getWalletCount()}`);
    console.log(`  - Contract: ${CONFIG.contractAddress}`);
    console.log(`  - AI Model: ${CONFIG.aiModel}`);
    console.log('='.repeat(70));
  }

  private generatePersonalities(): WalletPersonality[] {
    // This logic can be moved to a dedicated service or kept here for simplicity
    const profiles = [
        { name: 'Alex', background: 'a cautious player', style: 'Methodical & Risk-Averse', risk: 'low' },
        { name: 'Morgan', background: 'an aggressive player', style: 'Aggressive & Opportunistic', risk: 'high' },
        // ... include all 10 profiles
    ];
    
    const wallets = this.blockchainService.getWallets();
    return wallets.map((wallet, i) => ({
      address: wallet.address,
      ...profiles[i % profiles.length],
      riskTolerance: profiles[i % profiles.length].risk as 'low' | 'medium' | 'high'
    }));
  }

  private setupGracefulShutdown(): void {
    const shutdown = () => {
      console.log('\n\n🛑 Shutting down gracefully...');
      this.memoryManager.saveMemories(this.memories);
      this.generateReport();
      console.log('👋 Goodbye!');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);  // Catches CTRL+C
    process.on('SIGTERM', shutdown); // Catches kill commands

    // Auto-save every 5 minutes as a fallback
    setInterval(() => this.memoryManager.saveMemories(this.memories), 300000);
  }
  
  private getRandomDelay(): number {
    const { minDelayMs, maxDelayMs } = CONFIG.behaviorSettings;
    return Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
  }
  
  private generateReport(): void {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000 / 60);
    console.log('\n' + '='.repeat(70));
    console.log(`📊 BOT PERFORMANCE REPORT - Uptime: ${uptime} minutes`);
    // ... logic to iterate through memories and print stats for each personality
    console.log('='.repeat(70) + '\n');
  }
}
