import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import { Kernel as LegacyKernel, type KernelConfig as LegacyKernelConfig } from "@runtime/bootstrap/kernel";
import type { GameContext } from "@runtime/types/GameContext";
import { BehaviorController } from "@runtime/behavior/BehaviorController";

/**
 * Main process that orchestrates all bot runtime logic.
 * This wraps the existing Kernel implementation to integrate with screeps-kernel.
 * Priority: 50 (standard execution priority)
 */
@registerProcess({ name: "MainProcess", priority: 50, singleton: true })
export class MainProcess {
  private readonly kernel: LegacyKernel;

  public constructor() {
    const repositorySignalProvider = () => {
      return Memory.systemReport?.report?.repository;
    };

    // Configure the kernel with role-based system
    // The task system has been removed; only the role-based system is available
    const config: LegacyKernelConfig = {
      repositorySignalProvider,
      behavior: new BehaviorController({
        cpuSafetyMargin: 0.8,
        maxCpuPerCreep: 1.5
      }),
      logger: console
    };

    this.kernel = new LegacyKernel(config);
  }

  public run(ctx: ProcessContext<Memory>): void {
    // Cast game context to the more specific GameContext type
    const gameContext = ctx.game as GameContext;
    this.kernel.run(gameContext, ctx.memory);
  }
}
