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

interface PerformanceTrackerOptions {
  highCpuThreshold?: number;
  criticalCpuThreshold?: number;
  lowBucketThreshold?: number;
}

/**
 * Tracks per-tick CPU usage and basic execution metrics for later evaluation.
 */
export class PerformanceTracker {
  private context: { tick: number; startCpu: number } | null = null;
  private readonly options: Required<PerformanceTrackerOptions>;

  public constructor(
    options: PerformanceTrackerOptions = {},
    private readonly logger: Pick<Console, "log" | "warn"> = console
  ) {
    this.options = {
      highCpuThreshold: options.highCpuThreshold ?? 0.7,
      criticalCpuThreshold: options.criticalCpuThreshold ?? 0.9,
      lowBucketThreshold: options.lowBucketThreshold ?? 500
    };
  }

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

    const cpuRatio = cpuUsed / game.cpu.limit;

    if (cpuRatio > this.options.criticalCpuThreshold) {
      warnings.push(
        `CRITICAL: CPU usage ${cpuUsed.toFixed(2)} exceeds ${(this.options.criticalCpuThreshold * 100).toFixed(0)}% of limit ${game.cpu.limit} - timeout risk`
      );
    } else if (cpuRatio > this.options.highCpuThreshold) {
      warnings.push(`High CPU usage ${cpuUsed.toFixed(2)} / ${game.cpu.limit}`);
    }

    if (game.cpu.bucket < this.options.lowBucketThreshold) {
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
