import { Kernel } from "@ralphschuler/screeps-kernel";
import type { GameContext } from "@runtime/types/GameContext";
import { init as initProfiler } from "@ralphschuler/screeps-profiler";
import { Diagnostics } from "@runtime/utils/Diagnostics";

// Import process modules to trigger @process decorator registration
import "@runtime/processes";

// Create kernel instance using screeps-kernel
const kernel = new Kernel({
  logger: console,
  cpuEmergencyThreshold: 0.9
});

// Initialize profiler and expose it globally for console access
const profilerInstance = initProfiler();
if (typeof global !== "undefined") {
  global.Profiler = profilerInstance;
  global.Diagnostics = Diagnostics;
} else if (typeof window !== "undefined") {
  window.Profiler = profilerInstance;
  window.Diagnostics = Diagnostics;
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
    console.log(`[Profiler] Auto-started profiler data collection (tick: ${Game.time})`);
  }
}

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
    if (error instanceof TypeError) {
      console.log(`[Type Error] ${error.message}`);
      if (error.stack) console.log(error.stack);
    } else if (error instanceof Error) {
      console.log(`[Runtime Error] ${error.message}`);
      if (error.stack) console.log(error.stack);
    } else {
      console.log(`[Unknown Error] ${String(error)}`);
    }
  }
};
