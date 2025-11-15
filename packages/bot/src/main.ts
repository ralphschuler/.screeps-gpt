import { createKernel } from "@runtime/bootstrap";
import type { GameContext } from "@runtime/types/GameContext";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import { init as initProfiler } from "@profiler";
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
    const systemReport = Memory.systemReport;
    if (!systemReport) return undefined;
    return systemReport.report.repository;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).Profiler = profilerInstance;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).Diagnostics = Diagnostics;
} else if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Profiler = profilerInstance;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Diagnostics = Diagnostics;
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
    // Auto-start profiler on first tick if enabled and not running
    // Check if profiler is not already running by inspecting Memory.profiler.start
    if (__PROFILER_ENABLED__ && !profilerAutoStarted) {
      if (typeof Memory !== "undefined" && Memory.profiler?.start === undefined) {
        profilerInstance.start();
        console.log("[Profiler] Auto-started profiler data collection");
        profilerAutoStarted = true;
      } else {
        // Already running, no need to check again
        profilerAutoStarted = true;
      }
    }

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
