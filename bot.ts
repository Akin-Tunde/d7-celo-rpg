// ==================================================================================
// FILE: bot.ts
// An AI bot designed to play the on-chain RPG GameContract.
// ==================================================================================
// ==================================================================================
// FILE: bot.ts
// An AI bot designed to play the on-chain RPG GameContract.
// ==================================================================================
import { ethers } from 'ethers';
import axios from 'axios';
import * as dotenv from 'dotenv';

// ... the rest of your bot.ts code remains the same as the last version I provided ...

// Load environment variables from the .env file
dotenv.config();

// 1. CONTRACT ABI for GameContract
const CONTRACT_ABI = [
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

// 2. CONFIGURATION - Loads from your .env file
const CONFIG = {
  rpcUrl: process.env.RPC_URL || '',
  contractAddress: process.env.CONTRACT_ADDRESS || '',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  aiModel: 'anthropic/claude-3.5-sonnet',
  privateKeys: (process.env.PRIVATE_KEYS || '').split(',').map(pk => pk.trim()),
  behaviorSettings: {
    minDelayMs: 60000,  // 1 minute
    maxDelayMs: 300000, // 5 minutes
  }
};

// 3. TYPESCRIPT INTERFACES
interface WalletPersonality {
  address: string;
  name: string;
  background: string;
  style: string;
}

interface PlayerStats {
    name: string;
    level: string;
    experience: string;
    gold: string;
    strength: string;
    defense: string;
    exists: boolean;
}

interface AIDecision {
  action: 'createPlayer' | 'train' | 'fightMonster' | 'buyItem' | 'levelUp' | 'wait';
  itemId?: number;
  reasoning: string;
}

// 4. AI-ENHANCED BOT CLASS
class AIEnhancedBot {
  private provider: ethers.JsonRpcProvider;
  private wallets: ethers.Wallet[];
  private contracts: ethers.Contract[];
  private personalities: WalletPersonality[];

  constructor() {
    this.provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
    this.wallets = CONFIG.privateKeys.filter(pk => pk).map(pk => new ethers.Wallet(pk, this.provider));
    this.contracts = this.wallets.map(wallet => new ethers.Contract(CONFIG.contractAddress, CONTRACT_ABI, wallet));
    this.personalities = this.generatePersonalities();
    console.log(`🤖 AI-Enhanced RPG Bot initialized with ${this.wallets.length} wallets.`);
    this.displayPersonalities();
  }

  private generatePersonalities(): WalletPersonality[] {
    const names = ['Alex', 'Morgan', 'Jordan', 'Casey', 'Riley', 'Taylor', 'Jamie', 'Dakota', 'Avery', 'Peyton'];
    const backgrounds = [
        'a cautious and patient player who believes that slow and steady wins the race',
        'an impulsive and aggressive player who believes in high-risk, high-reward',
        'a smart and balanced player who follows a clear, logical path to victory',
        'a player obsessed with accumulating wealth, viewing stats as secondary to gold',
        'a completionist who wants to own every piece of gear, believing gear makes the player',
        'a player obsessed with gaining experience and leveling up above all else',
        'a player who is hesitant to engage in combat, preferring to test the waters first',
        'a true gambler who loves the thrill of the fight more than winning',
        'a player who believes the best offense is an unbreakable defense',
        'a player who tries to succeed with the absolute minimum, avoiding items'
    ];
    const styles = [
        'Methodical and Risk-Averse', 'Aggressive and Opportunistic', 'Balanced and Strategic',
        'Economist and Gold-Focused', 'Collector and Gear-Dependent', 'XP-Focused and Progression-Driven',
        'Cautious and Observant', 'Reckless and Unpredictable', 'Defensive and Resilient', 'Minimalist and Efficient'
    ];

    return this.wallets.map((wallet, i) => ({
      address: wallet.address,
      name: names[i % names.length]!,
      background: backgrounds[i % backgrounds.length]!,
      style: styles[i % styles.length]!,
    }));
  }

  private displayPersonalities() {
    console.log('\n👥 AI-Generated Personalities:\n');
    this.personalities.forEach((p, i) => {
      console.log(`  [${i}] ${p.name} (${p.address.slice(0, 8)}...) - Style: ${p.style}`);
    });
  }

  private async askAI(personality: WalletPersonality, stats: PlayerStats): Promise<AIDecision> {
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(0);
    const gasPriceGwei = ethers.formatUnits(gasPrice, 'gwei');

    const prompt = `
      You are an AI persona controlling a character in an RPG game. Your personality is:
      - Name: ${personality.name}
      - Background: ${personality.background}
      - Style: ${personality.style}

      Your character's current stats:
      - Level: ${stats.level}
      - Experience: ${stats.experience} / ${parseInt(stats.level) * 100}
      - Gold: ${stats.gold}
      - Strength: ${stats.strength}
      - Defense: ${stats.defense}
      - Current Gas Price: ${parseFloat(gasPriceGwei).toFixed(2)} gwei

      Shop Items Available:
      - itemId 0: Wooden Shield (Price: 50 Gold, +5 Defense)
      - itemId 1: Iron Sword (Price: 100 Gold, +10 Strength)
      - itemId 2: Steel Armor (Price: 250 Gold, +5 Strength, +20 Defense)

      Based *only* on your personality and stats, decide your next action. Your choices are:
      1. 'train': Safe action for guaranteed Gold and XP.
      2. 'fightMonster': Risky action for a chance at high Gold and XP, but you might lose Gold.
      3. 'buyItem': Spend Gold to buy an item and get a permanent stat boost. You must have enough Gold.
      4. 'levelUp': If you have enough XP, level up to increase your base stats.
      5. 'wait': Do nothing this turn to save on gas fees or observe.

      Your response MUST be a single, valid JSON object with "action", "itemId" (only for 'buyItem'), and "reasoning".
      Example: {"action": "fightMonster", "reasoning": "My strength is high, so I'll risk a fight for a big reward."}
    `;

    try {
      console.log(`\n🤔 Asking AI for a decision for ${personality.name}...`);
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        { model: CONFIG.aiModel, messages: [{ role: 'user', content: prompt }], response_format: { type: "json_object" } },
        { headers: { 'Authorization': `Bearer ${CONFIG.openRouterApiKey}`, 'Content-Type': 'application/json' } }
      );
      return JSON.parse(response.data.choices[0].message.content);
    } catch (error: any) {
      console.error(`❌ Error asking AI for ${personality.name}:`, error.response?.data || error.message);
      return { action: 'wait', reasoning: 'AI decision failed, waiting as a fallback.' };
    }
  }

  public async run() {
    if (this.wallets.length === 0) {
      console.error("❌ No valid private keys found. Please check your .env file.");
      return;
    }
    console.log('\n🚀 Starting AI Bot Main Loop... Press CTRL+C to stop.');
    
    while (true) {
      for (let i = 0; i < this.wallets.length; i++) {
        const personality = this.personalities[i];
        const contract = this.contracts[i];
        
        // This check ensures personality and contract are not undefined
        if (!personality || !contract) {
            console.error(`Could not find personality or contract for index ${i}. Skipping.`);
            continue;
        }

        let tx;

        try {
          const pData = await contract.players(personality.address);
          const stats: PlayerStats = {
              name: pData.name, level: pData.level.toString(), experience: pData.experience.toString(),
              gold: pData.gold.toString(), strength: pData.strength.toString(), defense: pData.defense.toString(),
              exists: pData.exists
          };

          if (!stats.exists) {
            console.log(`\n[${personality.name}] No character found. Creating one...`);
            tx = await contract.createPlayer(personality.name);
          } else {
            const decision = await this.askAI(personality, stats);
            console.log(`[${personality.name}] AI Decision: ${decision.action.toUpperCase()}. Reasoning: "${decision.reasoning}"`);

            if (decision.action === 'train') {
              tx = await contract.train();
            } else if (decision.action === 'fightMonster') {
              tx = await contract.fightMonster();
            } else if (decision.action === 'levelUp') {
              tx = await contract.levelUp();
            } else if (decision.action === 'buyItem' && decision.itemId !== undefined) {
              tx = await contract.buyItem(decision.itemId);
            } else {
              console.log(`[${personality.name}] ➡️ WAITING as per AI decision.`);
            }
          }

          if (tx) {
            console.log(`[${personality.name}] ➡️ Sending transaction...`);
            await tx.wait();
            console.log(`[${personality.name}] ✅ Transaction confirmed! Hash: ${tx.hash}`);
          }
        } catch (txError: any) {
           console.error(`[${personality.name}] ❌ An error occurred:`, txError.reason || txError.message);
        }
        
        const delay = Math.floor(Math.random() * (CONFIG.behaviorSettings.maxDelayMs - CONFIG.behaviorSettings.minDelayMs + 1)) + CONFIG.behaviorSettings.minDelayMs;
        console.log(`[${personality.name}] 🕒 Waiting for ${Math.round(delay / 1000)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

// 5. MAIN EXECUTION
async function main() {
  const bot = new AIEnhancedBot();
  bot.run();
}

main().catch(error => {
  console.error("FATAL: Failed to initialize and run bot:", error);
  process.exit(1);
});
