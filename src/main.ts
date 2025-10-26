import { createKernel } from "@runtime/bootstrap";
import type { GameContext } from "@runtime/types/GameContext";
import * as Profiler from "@profiler";

const kernel = createKernel({
  repositorySignalProvider: () => Memory.systemReport?.report.repository
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
