/**
 * @ralphschuler/screeps-bot
 * 
 * Reference implementation of a modular Screeps bot using kernel and standalone packages.
 * 
 * Architecture:
 * - Uses @ralphschuler/screeps-kernel for process orchestration
 * - Processes registered with @process decorator
 * - Demonstrates integration of all screeps-* packages
 */

import { Kernel } from "@ralphschuler/screeps-kernel";
import { Logger } from "@ralphschuler/screeps-logger";

// Import processes to trigger decorator registration
import "./processes/HarvesterProcess";
import "./processes/BuilderProcess";

// Extend Memory interface for custom properties
declare global {
  interface CreepMemory {
    role?: string;
  }
}

/**
 * Initialize the bot
 */
function initializeBot(): { kernel: Kernel; logger: Logger } {
  // Create logger
  const logger = new Logger({ minLevel: "info" });

  // Create kernel
  const kernel = new Kernel({ logger });

  logger.info("[Bot] Modular bot initialized with kernel");

  return { kernel, logger };
}

// Initialize on first load
const bot = initializeBot();

/**
 * Main game loop
 * 
 * Called every tick by the Screeps engine
 */
export const loop = (): void => {
  try {
    // Run kernel (executes all registered processes)
    bot.kernel.run(Game, Memory);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    bot.logger.error(`[Bot] Fatal error: ${err.message}`);
    if (err.stack) {
      bot.logger.error(err.stack);
    }
  }
};
