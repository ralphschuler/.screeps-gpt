 
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { process as registerProcess, type ProcessContext } from "@ralphschuler/screeps-kernel";
import type { GameContext } from "@runtime/types/GameContext";
import type { RuntimeProtocols } from "@runtime/protocols";
import type { BehaviorSummary } from "@shared/contracts";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import { RoleControllerManager } from "@runtime/behavior/RoleControllerManager";

/**
 * Feature flag to enable modular role controllers.
 * Set to true to use the new RoleControllerManager architecture.
 * Set to false to use the legacy BehaviorController (for rollback if needed).
 */
const USE_MODULAR_CONTROLLERS = true;

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
  private readonly behavior: BehaviorController | RoleControllerManager;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly cpuEmergencyThreshold: number;

  public constructor() {
    this.logger = console;

    // Use modular role controllers if feature flag is enabled
    if (USE_MODULAR_CONTROLLERS) {
      this.behavior = new RoleControllerManager(
        {
          cpuSafetyMargin: 0.8,
          maxCpuPerCreep: 1.5
        },
        this.logger
      );
    } else {
      this.behavior = new BehaviorController(
        {
          cpuSafetyMargin: 0.8,
          maxCpuPerCreep: 1.5
        },
        this.logger
      );
    }

    this.cpuEmergencyThreshold = 0.9;
  }

  public run(ctx: ProcessContext<Memory, RuntimeProtocols>): void {
    const gameContext = ctx.game as GameContext;
    const memory = ctx.memory;

     
    // Skip if emergency reset or respawn occurred (check protocol instead of Memory)
    if (ctx.protocol.isEmergencyReset() || ctx.protocol.needsRespawn()) {
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

     
    // Get role counts from protocol (set by MemoryProcess)
    const roleCounts: Record<string, number> = ctx.protocol.getRoleCounts();

     
    // Get bootstrap role minimums if bootstrap is active (from protocol)
    const bootstrapMinimums: Record<string, number> = ctx.protocol.getBootstrapMinimums();

    // Execute behavior (spawning and creep control)
    const behaviorSummary: BehaviorSummary = this.behavior.execute(gameContext, memory, roleCounts, bootstrapMinimums);

     
    // Share behavior summary via protocol (for metrics process)
    ctx.protocol.setBehaviorSummary(behaviorSummary);
  }
}
