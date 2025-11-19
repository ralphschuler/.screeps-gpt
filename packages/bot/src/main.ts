import { createKernel } from "@runtime/bootstrap";
import type { GameContext } from "@runtime/types/GameContext";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import { init as initProfiler } from "@ralphschuler/screeps-profiler";
import { Diagnostics } from "@runtime/utils/Diagnostics";

// Task system is enabled by default (v0.32.0+)
// Can be disabled via TASK_SYSTEM_ENABLED=false or Memory flag
// Memory access is safe here as it's initialized by the Screeps engine before loop() is called
const taskSystemEnabled =
  process.env.TASK_SYSTEM_ENABLED === "false"
    ? false
    : process.env.TASK_SYSTEM_ENABLED === "true"
      ? true
      : typeof Memory !== "undefined" && Memory.experimentalFeatures?.taskSystem === false
        ? false
        : true; // Default to enabled

const kernel = createKernel({
  repositorySignalProvider: () => {
    return Memory.systemReport?.report?.repository;
  },
  behavior: new BehaviorController({
    useTaskSystem: taskSystemEnabled,
    cpuSafetyMargin: 0.8,
    maxCpuPerCreep: 1.5
  })
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

// Auto-start profiler if __PROFILER_ENABLED__ is true and not already running
// This ensures profiler data collection begins automatically on deployment
let profilerAutoStarted = false;

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

export const loop = (): void => {
  try {
    // Ensure Memory.profiler is initialized on first tick
    // This must happen inside loop() as Memory is not available at module load time
    if (__PROFILER_ENABLED__ && !profilerAutoStarted) {
      // Initialize Memory.profiler if not present using nullish coalescing assignment
      Memory.profiler ??= {
        data: {},
        total: 0
      };

      // Auto-start profiler if not already running
      if (Memory.profiler.start === undefined) {
        profilerInstance.start();
        console.log("[Profiler] Auto-started profiler data collection");
        profilerAutoStarted = true;
      } else {
        // Already running, no need to check again
        profilerAutoStarted = true;
      }
    }

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
