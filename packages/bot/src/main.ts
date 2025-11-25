/**
 * Screeps Bot - Main Entry Point
 *
 * This module serves as the application entry point for the Screeps AI bot.
 * It initializes core systems (kernel, profiler, event bus) and defines the main
 * game loop that executes every tick.
 *
 * Key responsibilities:
 * - Initialize and configure the runtime kernel
 * - Set up profiler for CPU monitoring (when enabled)
 * - Subscribe to runtime events for debugging
 * - Expose global utilities for console access (Profiler, Diagnostics, EventBus)
 * - Execute the main game loop with proper error handling
 *
 * @module main
 * @see {@link Kernel} for process scheduling and lifecycle management
 * @see {@link packages/README.md} for TSDoc documentation standards
 */

import { Kernel } from "@ralphschuler/screeps-kernel";
import type { GameContext } from "@runtime/types/GameContext";
import { init as initProfiler } from "@ralphschuler/screeps-profiler";
import { Diagnostics } from "@runtime/utils/Diagnostics";
import { logger } from "@runtime/utils/logger";
import { EventTypes } from "@ralphschuler/screeps-events";
import { globalEventBus } from "@runtime/events/globalEventBus";

// Import protocol modules to trigger @protocol decorator registration
import "@runtime/protocols";

// Import process modules to trigger @process decorator registration
import "@runtime/processes";

// Create kernel instance using screeps-kernel
const kernel = new Kernel({
  logger: console,
  cpuEmergencyThreshold: 0.9
});

// Subscribe to runtime events for monitoring and debugging
// These subscriptions are only active when profiler is enabled to minimize CPU overhead
if (__PROFILER_ENABLED__ === "true") {
  const eventLogger = logger.child({ source: "EventBus" });

  globalEventBus.subscribe(EventTypes.HOSTILE_DETECTED, event => {
    eventLogger.info(
      `Hostiles detected in ${event.data.roomName}: ` +
        `${event.data.hostileCount} hostiles from [${event.data.hostileUsernames.join(", ")}]`
    );
  });

  globalEventBus.subscribe(EventTypes.ENERGY_DEPLETED, event => {
    eventLogger.info(
      `Energy depleted in ${event.data.roomName}: ${event.data.structureType} ${event.data.structureId}`
    );
  });

  globalEventBus.subscribe(EventTypes.ENERGY_RESTORED, event => {
    eventLogger.info(
      `Energy restored in ${event.data.roomName}: ` +
        `${event.data.structureType} ${event.data.structureId} (${event.data.energyAmount} energy)`
    );
  });
}

// Initialize profiler and expose it globally for console access
const profilerInstance = initProfiler();
if (typeof global !== "undefined") {
  global.Profiler = profilerInstance;
  global.Diagnostics = Diagnostics;
  global.EventBus = globalEventBus;
} else if (typeof window !== "undefined") {
  window.Profiler = profilerInstance;
  window.Diagnostics = Diagnostics;
  window.EventBus = globalEventBus;
}

/**
 * Validates Game object at runtime to ensure it conforms to GameContext interface.
 * Replaces unsafe type casting with explicit runtime validation.
 * @param game - Game object from Screeps API
 * @returns Validated GameContext object
 * @throws {TypeError} if Game object is missing required properties
 */
function validateGameContext(game: Game): GameContext {
  if (!game.cpu) {
    throw new TypeError("Invalid Game object: missing cpu interface");
  }
  if (!game.creeps) {
    throw new TypeError("Invalid Game object: missing creeps");
  }
  if (!game.spawns) {
    throw new TypeError("Invalid Game object: missing spawns");
  }
  if (!game.rooms) {
    throw new TypeError("Invalid Game object: missing rooms");
  }
  // Type assertion is now safe after explicit runtime validation
  return game as GameContext;
}

/**
 * Ensures profiler is running if enabled at build time.
 * This function is idempotent and safe to call on every tick.
 * It handles Memory resets and code reloads gracefully.
 */
function ensureProfilerRunning(): void {
  if (!__PROFILER_ENABLED__) {
    return;
  }

  // Initialize Memory.profiler if not present (handles Memory resets)
  Memory.profiler ??= {
    data: {},
    total: 0
  };

  // Auto-start profiler if not already running
  // Check every tick to handle Memory resets gracefully
  if (Memory.profiler.start === undefined) {
    profilerInstance.start();
    logger.info(`Profiler auto-started data collection (tick: ${Game.time})`, { component: "Profiler" });
  }
}

/**
 * Main game loop executed by the Screeps runtime every tick.
 *
 * This function is the entry point for all bot logic. It performs:
 * 1. Profiler initialization (if enabled at build time)
 * 2. Memory.stats defensive initialization for telemetry
 * 3. Game context validation
 * 4. Kernel execution with all registered processes
 *
 * Errors are caught and logged to prevent the bot from crashing.
 * The kernel manages process scheduling and CPU budget protection.
 *
 * @example
 * ```typescript
 * // This function is called automatically by the Screeps runtime
 * // Export it from main.ts:
 * export { loop };
 * ```
 */
export const loop = (): void => {
  try {
    // Ensure profiler is running on every tick
    // This handles Memory resets and ensures continuous data collection
    ensureProfilerRunning();

    // Defensive initialization of Memory.stats to prevent telemetry blackout
    // This ensures stats structure exists on every tick, even if Memory is reset
    // between script loads. Critical for /api/user/stats endpoint to receive data.
    Memory.stats ??= {
      time: 0,
      cpu: { used: 0, limit: 0, bucket: 0 },
      creeps: { count: 0 },
      rooms: { count: 0 }
    };

    const gameContext = validateGameContext(Game);
    kernel.run(gameContext, Memory);
  } catch (error) {
    // Enhanced error handling with specific error classification
    // Use logger.errorObject() to safely serialize errors and prevent primitive conversion issues
    if (error instanceof TypeError) {
      logger.errorObject(error, "[Type Error]");
    } else if (error instanceof Error) {
      logger.errorObject(error, "[Runtime Error]");
    } else {
      logger.errorObject(error, "[Unknown Error]");
    }
  }
};
