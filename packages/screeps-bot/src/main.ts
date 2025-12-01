/**
 * Screeps Bot - Main Entry Point
 *
 * This module serves as the application entry point for the Screeps AI bot.
 * It initializes the SwarmBot controller and runs the main game loop.
 *
 * @module main
 */

import { SwarmBot } from "./SwarmBot";

// Create bot instance with default configuration
const bot = new SwarmBot({
  enableProfiling: true,
  enableDebugLogging: false,
  pheromoneUpdateInterval: 5,
  strategicUpdateInterval: 20,
  enableVisualizations: true
});

/**
 * Main game loop executed by the Screeps runtime every tick.
 *
 * This function is the entry point for all bot logic. It delegates
 * to the SwarmBot controller which coordinates all subsystems.
 *
 * @example
 * ```typescript
 * // This function is called automatically by the Screeps runtime
 * // Export it from main.ts:
 * export { loop };
 * ```
 */
export const loop = (): void => {
  bot.run();
};
