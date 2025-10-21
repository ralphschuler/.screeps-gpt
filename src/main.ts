import { createKernel } from "@runtime/bootstrap";
import type { GameContext } from "@runtime/types/GameContext";

const kernel = createKernel({
  repositorySignalProvider: () => Memory.systemReport?.report.repository
});

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
