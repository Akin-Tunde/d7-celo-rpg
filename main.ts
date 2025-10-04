// src/main.ts

import { BotEngine } from './core/BotEngine';

/**
 * The main entry point for the application.
 * This asynchronous function initializes and runs the bot.
 */
async function main() {
  // A simple header to show when the script starts
  console.log('='.repeat(70));
  console.log('            🎮 Enhanced AI RPG Bot - Initializing... 🎮');
  console.log('='.repeat(70));
  
  try {
    // 1. Create a new instance of the main BotEngine.
    //    The engine's constructor will handle all the setup, including
    //    loading configuration and initializing all required services.
    const bot = new BotEngine();

    // 2. Start the bot's main operational loop.
    //    This method will run indefinitely until the process is stopped.
    await bot.run();
    
  } catch (error) {
    // This is a top-level catch block for any catastrophic errors that might
    // occur during the initial setup of the BotEngine itself.
    console.error("💥 A FATAL ERROR occurred during bot initialization:", error);
    
    // Exit the process with a non-zero exit code to indicate failure.
    process.exit(1);
  }
}

// Execute the main function to start the bot.
main();
