import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import type { GameContext } from "@runtime/types/GameContext";
import type { BehaviorSummary } from "@shared/contracts";
import { BehaviorController } from "@runtime/behavior/BehaviorController";

/**
 * Behavior execution process that handles all creep behavior and spawning.
 * Responsibilities:
 * - Spawning creeps based on role minimums
 * - Executing creep behavior (harvesting, upgrading, building, etc.)
 * - Managing creep tasks and state
 * - CPU budget management for creep operations
 * 
 * Priority: 50 (standard) - Main gameplay process
 */
@registerProcess({ name: "BehaviorProcess", priority: 50, singleton: true })
export class BehaviorProcess {
  private readonly behavior: BehaviorController;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly cpuEmergencyThreshold: number;

  public constructor() {
    this.logger = console;
    this.behavior = new BehaviorController({
      cpuSafetyMargin: 0.8,
      maxCpuPerCreep: 1.5
    }, this.logger);
    this.cpuEmergencyThreshold = 0.9;
  }

  public run(ctx: ProcessContext<Memory>): void {
    const gameContext = ctx.game as GameContext;
    const memory = ctx.memory;

    // Skip if emergency reset or respawn occurred
    if (memory.emergencyReset || memory.needsRespawn) {
      return;
    }

    // CPU guard before behavior execution
    if (gameContext.cpu.getUsed() > gameContext.cpu.limit * this.cpuEmergencyThreshold) {
      this.logger.warn?.(
        `[BehaviorProcess] CPU threshold exceeded (${gameContext.cpu.getUsed().toFixed(2)}/${gameContext.cpu.limit}), ` +
          `aborting behavior execution`
      );
      return;
    }

    // Get role counts from memory (set by MemoryProcess)
    const roleCounts = memory.roles ?? {};

    // Get bootstrap role minimums if bootstrap is active
    const bootstrapStatus = memory.bootstrapStatus;
    const bootstrapMinimums = bootstrapStatus?.isActive
      ? {
          harvester: 2,
          upgrader: 1,
          builder: 1
        }
      : {};

    // Execute behavior (spawning and creep control)
    const behaviorSummary: BehaviorSummary = this.behavior.execute(
      gameContext,
      memory,
      roleCounts,
      bootstrapMinimums
    );

    // Store behavior summary in memory for metrics process
    memory.behaviorSummary = behaviorSummary;
  }
}
