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

  public async run(): Promise<void> {
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
        } catch (error: any) {
          console.error(`[${personality.name}] ❌ An error occurred during the turn:`, error.message);
        }

        this.actionCounter++;
        if (this.actionCounter % CONFIG.behaviorSettings.reportInterval === 0) {
          this.generateReport();
        }
        
        const delay = this.getRandomDelay();
        console.log(`[${personality.name}] 🕒 Waiting ${Math.round(delay / 1000)}s until next turn...\n`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private async executeTurn(personality: WalletPersonality): Promise<void> {
    const { address, name } = personality;
    const walletIndex = this.personalities.findIndex(p => p.address === address);

    if (!CONFIG.simulationMode) {
      const gasCheck = await this.blockchainService.analyzeGas();
      if (gasCheck.shouldWait) {
        console.log(`[${name}] ⛽ Gas price is too high (${gasCheck.recommendation}). Skipping turn.`);
        return;
      }
    }

    const stats: PlayerStats = await this.blockchainService.getPlayerStats(address);
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
    
    await this.blockchainService.executeTransaction(
      validatedDecision.action,
      walletIndex,
      { itemId: validatedDecision.itemId }
    );

    if (CONFIG.simulationMode) {
        const outcome = this.memoryManager.simulateOutcome(validatedDecision.action);
        const updatedMemory = this.memoryManager.updateMemory(memory, outcome);
        this.memories.set(address, updatedMemory);
    }
  }

  private validateAIDecision(decision: AIDecision, stats: PlayerStats, memory: GameMemory): AIDecision {
    const gold = parseInt(stats.gold);

    if (decision.action === 'fightMonster' && memory.consecutiveLosses >= CONFIG.guardrails.maxConsecutiveLosses) {
      console.log(`🛡️ GUARDRAIL OVERRIDE: Blocked fighting due to ${memory.consecutiveLosses} consecutive losses.`);
      return { action: 'train', reasoning: 'Forced training to break a losing streak (Safety Override).' };
    }

    if (decision.action === 'fightMonster' && gold < CONFIG.guardrails.minGoldForFight) {
      console.log(`🛡️ GUARDRAIL OVERRIDE: Blocked fighting with only ${gold} gold.`);
      return { action: 'train', reasoning: 'Gold is too low to risk a fight (Safety Override).' };
    }
    
    if (decision.action === 'buyItem' && decision.itemId !== undefined) {
      const item = CONFIG.itemShop[decision.itemId];
      if (item && gold < item.cost) {
        console.log(`🛡️ GUARDRAIL OVERRIDE: Cannot afford ${item.name}.`);
        return { action: 'train', reasoning: `Cannot afford the item, training instead (Safety Override).` };
      }
    }

    return decision;
  }

  private generatePersonalities(): WalletPersonality[] {
    const profiles = [
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
      // You can add up to 15 more unique profiles here
    ];
    
    const wallets = this.blockchainService.getWallets();
    return wallets.map((wallet, i) => {
      const profile = profiles[i % profiles.length];
      return {
        address: wallet.address,
        ...profile,
        riskTolerance: profile.risk as 'low' | 'medium' | 'high'
      };
    });
  }

  private displayStartupMessage(): void {
    const mode = CONFIG.simulationMode ? '🧪 SIMULATION' : '🔴 LIVE';
    console.log('='.repeat(70));
    console.log(`🚀 Starting Enhanced AI Bot [${mode}]`);
    console.log(`  - Wallets Loaded: ${this.blockchainService.getWalletCount()}`);
    console.log(`  - Contract: ${CONFIG.contractAddress}`);
    console.log(`  - AI Model: ${CONFIG.aiModel}`);
    console.log('='.repeat(70));
  }

  private setupGracefulShutdown(): void {
    const shutdown = () => {
      console.log('\n\n🛑 Shutting down gracefully...');
      this.memoryManager.saveMemories(this.memories);
      this.generateReport();
      console.log('👋 Goodbye!');
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
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
