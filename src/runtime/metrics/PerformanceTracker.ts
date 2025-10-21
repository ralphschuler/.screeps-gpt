import type { BehaviorSummary, PerformanceSnapshot } from "@shared/contracts";

interface CpuLike {
  getUsed(): number;
  limit: number;
  bucket: number;
}

interface GameLike {
  time: number;
  cpu: CpuLike;
  creeps: Record<string, { memory: CreepMemory }>;
  rooms: Record<string, unknown>;
}

/**
 * Tracks per-tick CPU usage and basic execution metrics for later evaluation.
 */
export class PerformanceTracker {
  private context: { tick: number; startCpu: number } | null = null;

  public constructor(private readonly logger: Pick<Console, "log" | "warn"> = console) {}

  /**
   * Capture the starting CPU reading for the current tick.
   */
  public begin(game: GameLike): void {
    this.context = { tick: game.time, startCpu: game.cpu.getUsed() };
  }

  /**
   * Finalise the tick, returning a snapshot with CPU deltas and derived warnings.
   */
  public end(game: GameLike, execution: BehaviorSummary): PerformanceSnapshot {
    if (!this.context) {
      throw new Error("PerformanceTracker.begin must be called before end");
    }

    const cpuUsed = Math.max(0, game.cpu.getUsed() - this.context.startCpu);
    const warnings: string[] = [];

    if (cpuUsed > game.cpu.limit * 0.8) {
      warnings.push(`High CPU usage ${cpuUsed.toFixed(2)} / ${game.cpu.limit}`);
    }

    if (game.cpu.bucket < 500) {
      warnings.push(`CPU bucket critically low (${game.cpu.bucket})`);
    }

    if (warnings.length > 0) {
      for (const warning of warnings) {
        this.logger.warn?.(warning);
      }
    }

    const snapshot: PerformanceSnapshot = {
      tick: this.context.tick,
      cpuUsed,
      cpuLimit: game.cpu.limit,
      cpuBucket: game.cpu.bucket,
      creepCount: Object.keys(game.creeps).length,
      roomCount: Object.keys(game.rooms).length,
      spawnOrders: execution.spawnedCreeps.length,
      warnings,
      execution
    };

    this.context = null;
    return snapshot;
  }
}
