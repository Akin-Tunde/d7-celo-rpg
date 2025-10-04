// src/features/blockchain/BlockchainService.ts

import { ethers, Contract, Wallet, JsonRpcProvider, TransactionResponse, TransactionReceipt } from 'ethers';
import { CONFIG, CONTRACT_ABI } from '../../config';
import { PlayerStats, GasAnalysis, TransactionOptions } from './types';

export class BlockchainService {
  private readonly provider: JsonRpcProvider;
  private readonly wallets: Wallet[];
  private readonly contracts: Contract[];

  constructor() {
    this.provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
    this.wallets = CONFIG.privateKeys.filter(pk => pk).map(pk => new ethers.Wallet(pk, this.provider));
    this.contracts = this.wallets.map(wallet => new ethers.Contract(CONFIG.contractAddress, CONTRACT_ABI, wallet));
    
    // Optional: Add a listener for blockchain events to update memory in real-time
    this.setupEventListeners();
  }

  /**
   * Fetches the player stats for a given address directly from the smart contract.
   * @param address The wallet address of the player.
   * @returns A promise that resolves to the player's stats.
   */
  public async getPlayerStats(address: string): Promise<PlayerStats> {
    // We use the first contract instance (read-only) for fetching public data.
    const contract = this.contracts[0];
    const pData = await contract.players(address);

    return {
      name: pData.name,
      level: pData.level.toString(),
      experience: pData.experience.toString(),
      gold: pData.gold.toString(),
      strength: pData.strength.toString(),
      defense: pData.defense.toString(),
      exists: pData.exists,
    };
  }

  /**
   * Executes a game action by sending a transaction to the smart contract.
   * This method includes pre-flight checks for gas and balance.
   */
  public async executeTransaction(
    action: 'createPlayer' | 'train' | 'fightMonster' | 'buyItem' | 'levelUp',
    walletIndex: number,
    options: TransactionOptions = {}
  ): Promise<TransactionReceipt | null> {
    const wallet = this.wallets[walletIndex];
    const contract = this.contracts[walletIndex];
    const actionName = `${action.charAt(0).toUpperCase()}${action.slice(1)}`;

    console.log(`[Blockchain] 📡 Preparing to execute transaction: ${actionName}`);

    // Pre-flight checks (only in live mode)
    if (!CONFIG.simulationMode) {
      await this.performPreFlightChecks(wallet.address);
    }

    let tx: TransactionResponse;

    for (let attempt = 1; attempt <= CONFIG.behaviorSettings.maxRetries; attempt++) {
      try {
        if (CONFIG.simulationMode) {
          console.log(`[Blockchain] 🧪 SIMULATION: Would execute '${actionName}' now.`);
          await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
          return null; // No receipt in simulation
        }

        // Construct and send the actual transaction
        switch (action) {
          case 'createPlayer':
            tx = await contract.createPlayer(options.playerName || 'Adventurer');
            break;
          case 'train':
            tx = await contract.train();
            break;
          case 'fightMonster':
            tx = await contract.fightMonster();
            break;
          case 'levelUp':
            tx = await contract.levelUp();
            break;
          case 'buyItem':
            if (options.itemId === undefined) throw new Error('itemId is required for buyItem');
            tx = await contract.buyItem(options.itemId);
            break;
          default:
            throw new Error(`Unknown action: ${action}`);
        }

        console.log(`[Blockchain] ⏳ Transaction sent for ${actionName}. Hash: ${tx.hash.slice(0, 12)}... Waiting for confirmation...`);
        const receipt = await tx.wait(); // Wait for 1 confirmation
        console.log(`[Blockchain] ✅ Success! Gas used: ${receipt?.gasUsed.toString()}`);
        return receipt;

      } catch (error: any) {
        const errorMsg = error.reason || error.message || 'Unknown transaction error';
        console.warn(`[Blockchain] ⚠️ Attempt ${attempt}/${CONFIG.behaviorSettings.maxRetries} for ${actionName} failed: ${errorMsg}`);
        
        if (this.isNonRetryableError(errorMsg)) {
          throw new Error(`Non-retryable error for ${actionName}: ${errorMsg}`);
        }
        if (attempt === CONFIG.behaviorSettings.maxRetries) {
          throw new Error(`Action ${actionName} failed after all retries.`);
        }

        await new Promise(resolve => setTimeout(resolve, 3000 * attempt)); // Exponential backoff
      }
    }
    return null;
  }
  
  /**
   * Analyzes the current gas price on the network.
   */
  public async analyzeGas(): Promise<GasAnalysis> {
    try {
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || 0n;
      const currentGwei = parseFloat(ethers.formatUnits(gasPrice, 'gwei'));
      
      const { gasThresholdGwei } = CONFIG.behaviorSettings;
      const shouldWait = currentGwei > gasThresholdGwei;
      
      return {
        currentGwei,
        shouldWait,
        recommendation: `${currentGwei.toFixed(2)} Gwei (Threshold: ${gasThresholdGwei} Gwei)`,
      };
    } catch (error) {
      console.error("Error fetching gas price:", error);
      return { currentGwei: 999, shouldWait: true, recommendation: 'Error fetching gas data' };
    }
  }

  // --- Helper Methods ---

  public getWalletCount(): number {
    return this.wallets.length;
  }
  
  public getWallets(): Wallet[] {
    return this.wallets;
  }

  private async performPreFlightChecks(walletAddress: string): Promise<void> {
    // Balance Check
    const balance = await this.provider.getBalance(walletAddress);
    const minBalance = ethers.parseEther(CONFIG.behaviorSettings.minBalanceEth);
    if (balance < minBalance) {
      throw new Error(`Insufficient balance. Have ${ethers.formatEther(balance)} ETH, need at least ${CONFIG.behaviorSettings.minBalanceEth} ETH.`);
    }

    // Gas Check
    const gas = await this.analyzeGas();
    if (gas.currentGwei > CONFIG.guardrails.maxGasGwei) {
      throw new Error(`Gas price is critically high: ${gas.recommendation}. Aborting transaction.`);
    }
    console.log(`[Blockchain] ✅ Pre-flight checks passed. Balance: ${ethers.formatEther(balance).slice(0, 6)} ETH, Gas: ${gas.currentGwei.toFixed(2)} Gwei.`);
  }

  private isNonRetryableError(errorMsg: string): boolean {
    const lowerError = errorMsg.toLowerCase();
    const nonRetryableKeywords = [
      'insufficient funds',
      'nonce too low',
      'replacement fee too low',
      'already exists', // Custom contract logic
      'not enough gold', // Custom contract logic
    ];
    return nonRetryableKeywords.some(keyword => lowerError.includes(keyword));
  }
  
  private setupEventListeners(): void {
    if (CONFIG.simulationMode) return;
    
    // This is a simplified example. A full implementation would connect
    // this event to the MemoryManager to update state in real-time.
    this.contracts.forEach((contract, i) => {
        const walletAddress = this.wallets[i].address;
        contract.on("BattleOutcome", (playerAddr, won, goldChange) => {
            if (playerAddr.toLowerCase() === walletAddress.toLowerCase()) {
                console.log(`[Event] ⚔️ Battle outcome for ${walletAddress.slice(0,6)}: ${won ? 'Win' : 'Loss'}, Gold change: ${goldChange.toString()}`);
            }
        });
    });
  }
      }
