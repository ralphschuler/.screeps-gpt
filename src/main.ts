import { createKernel } from "@runtime/bootstrap";
import type { GameContext } from "@runtime/types/GameContext";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import { init as initProfiler } from "@profiler";

// Read task system enablement from environment variable or Memory flag
// Memory access is safe here as it's initialized by the Screeps engine before loop() is called
const taskSystemEnabled =
  process.env.TASK_SYSTEM_ENABLED === "true" ||
  (typeof Memory !== "undefined" && Memory.experimentalFeatures?.taskSystem === true);

const kernel = createKernel({
  repositorySignalProvider: () => Memory.systemReport?.report.repository,
  behavior: new BehaviorController({
    useTaskSystem: taskSystemEnabled,
    cpuSafetyMargin: 0.8,
    maxCpuPerCreep: 1.5
  })
});

// Initialize profiler and expose it globally for console access
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const profilerInstance = initProfiler();
if (typeof global !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (global as any).Profiler = profilerInstance;
} else if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (window as any).Profiler = profilerInstance;
}

// Auto-start profiler if __PROFILER_ENABLED__ is true and not already running
// This ensures profiler data collection begins automatically on deployment
let profilerAutoStarted = false;

export const loop = (): void => {
  try {
    // Auto-start profiler on first tick if enabled and not running
    // Check if profiler is not already running by inspecting Memory.profiler.start
    if (__PROFILER_ENABLED__ && !profilerAutoStarted) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (typeof Memory !== "undefined" && (!Memory.profiler || Memory.profiler.start === undefined)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        profilerInstance.start();
        console.log("[Profiler] Auto-started profiler data collection");
        profilerAutoStarted = true;
      } else {
        // Already running, no need to check again
        profilerAutoStarted = true;
      }
    }

    kernel.run(Game as unknown as GameContext, Memory);
  } catch (error) {
    console.log(`Unhandled error in loop: ${String(error)}`);
    if (error instanceof Error && error.stack) {
      console.log(error.stack);
    }
  }
};
