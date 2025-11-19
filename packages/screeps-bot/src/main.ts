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

/// <reference types="@types/screeps" />

import { Kernel } from "@ralphschuler/screeps-kernel";
import { Logger } from "@ralphschuler/screeps-logger";

// Import processes to trigger decorator registration
import "./processes/RoomProcess";      // Priority 70 - Room strategy (decision trees)
import "./processes/TowerProcess";     // Priority 60 - Tower defense (state machines)
import "./processes/HarvesterProcess"; // Priority 50 - Energy harvesting (state machines)
import "./processes/BuilderProcess";   // Priority 40 - Construction (decision trees)
import "./processes/ScoutProcess";     // Priority 20 - Exploration (async tasks)

// Extend Memory interface for custom properties
declare global {
  interface CreepMemory {
    role?: string;
  }
  
  interface RoomMemory {
    lastScouted?: number;
    sources?: Id<Source>[];
    controller?: Id<StructureController> | null;
    hostiles?: number;
  }
}

/**
 * Initialize the bot
 */
function initializeBot(): { kernel: Kernel; logger: Logger } {
  // Create logger
  const logger = new Logger({ minLevel: "info" });

  // Create logger adapter for kernel (kernel expects simpler interface)
  const kernelLogger = {
    log: (message: string) => logger.info(message),
    warn: (message: string) => logger.warn(message),
    error: (message: string) => logger.error(message)
  };

  // Create kernel
  const kernel = new Kernel({ logger: kernelLogger });

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
