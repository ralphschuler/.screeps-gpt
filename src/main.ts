import { createKernel } from "@runtime/bootstrap";
import type { GameContext } from "@runtime/types/GameContext";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import * as Profiler from "@profiler";

// Read task system enablement from environment variable or Memory flag
const taskSystemEnabled =
  process.env.TASK_SYSTEM_ENABLED === "true" || Memory.experimentalFeatures?.taskSystem === true;

const kernel = createKernel({
  repositorySignalProvider: () => Memory.systemReport?.report.repository,
  behavior: new BehaviorController({
    useTaskSystem: taskSystemEnabled,
    cpuSafetyMargin: 0.8,
    maxCpuPerCreep: 1.5
  })
});

// Initialize profiler and expose it globally for console access
if (typeof global !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (global as any).Profiler = Profiler.init();
} else if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (window as any).Profiler = Profiler.init();
}

export const loop = (): void => {
  try {
    kernel.run(Game as unknown as GameContext, Memory);
  } catch (error) {
    console.log(`Unhandled error in loop: ${String(error)}`);
    if (error instanceof Error && error.stack) {
      console.log(error.stack);
    }
  }
};
