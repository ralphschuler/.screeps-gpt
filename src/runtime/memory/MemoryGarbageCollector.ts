import { profile } from "@profiler";

/**
 * Configuration options for memory garbage collection
 */
export interface GarbageCollectorConfig {
  /**
   * Number of ticks to retain room data for inactive rooms
   * @default 10000
   */
  roomDataRetentionTicks?: number;

  /**
   * Number of ticks to retain historical stats data
   * @default 1000
   */
  statsRetentionTicks?: number;

  /**
   * Number of ticks to retain system evaluation reports
   * @default 500
   */
  reportRetentionTicks?: number;

  /**
   * Maximum number of items to clean per tick (CPU throttling)
   * @default 10
   */
  maxCleanupPerTick?: number;
}

/**
 * Tracks memory cleanup operations for reporting
 */
export interface CleanupResult {
  roomDataCleaned: number;
  statsEntriesCleaned: number;
  reportsRotated: number;
  totalBytesSaved: number;
}

/**
 * Handles automated garbage collection for Memory to prevent overflow
 * and maintain optimal memory utilization.
 */
@profile
export class MemoryGarbageCollector {
  private readonly config: Required<GarbageCollectorConfig>;

  public constructor(
    config: GarbageCollectorConfig = {},
    private readonly logger: Pick<Console, "log"> = console
  ) {
    this.config = {
      roomDataRetentionTicks: config.roomDataRetentionTicks ?? 10000,
      statsRetentionTicks: config.statsRetentionTicks ?? 1000,
      reportRetentionTicks: config.reportRetentionTicks ?? 500,
      maxCleanupPerTick: config.maxCleanupPerTick ?? 10
    };
  }

  /**
   * Perform incremental garbage collection on Memory.
   * Uses CPU throttling to avoid spikes.
   */
  public collect(game: { time: number; rooms: Record<string, unknown> }, memory: Memory): CleanupResult {
    const result: CleanupResult = {
      roomDataCleaned: 0,
      statsEntriesCleaned: 0,
      reportsRotated: 0,
      totalBytesSaved: 0
    };

    // Clean orphaned room data
    result.roomDataCleaned = this.cleanOrphanedRoomData(game, memory);

    // Rotate old system reports
    result.reportsRotated = this.rotateSystemReports(game.time, memory);

    if (result.roomDataCleaned > 0 || result.reportsRotated > 0) {
      this.logger.log(`[GC] Cleaned ${result.roomDataCleaned} room(s), rotated ${result.reportsRotated} report(s)`);
    }

    return result;
  }

  /**
   * Remove room data for rooms that are no longer visible or controlled.
   * Uses incremental cleanup to avoid CPU spikes.
   */
  private cleanOrphanedRoomData(game: { time: number; rooms: Record<string, unknown> }, memory: Memory): number {
    if (!memory.rooms) {
      return 0;
    }

    let cleaned = 0;
    let processed = 0;
    const roomNames = Object.keys(memory.rooms);

    for (const roomName of roomNames) {
      // CPU throttling
      if (processed >= this.config.maxCleanupPerTick) {
        break;
      }
      processed++;

      // Keep data for visible rooms
      if (roomName in game.rooms) {
        continue;
      }

      // For invisible rooms, check retention period
      const roomData = memory.rooms[roomName] as { lastSeen?: number } | undefined;
      const lastSeen = roomData?.lastSeen ?? 0;
      const age = game.time - lastSeen;

      if (age > this.config.roomDataRetentionTicks) {
        delete memory.rooms[roomName];
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Rotate old system evaluation reports to prevent Memory bloat.
   * Keeps only the most recent report within retention period.
   */
  private rotateSystemReports(currentTick: number, memory: Memory): number {
    if (!memory.systemReport) {
      return 0;
    }

    const reportAge = currentTick - memory.systemReport.lastGenerated;

    // If report is too old, clear it but keep the structure
    if (reportAge > this.config.reportRetentionTicks) {
      const oldTick = memory.systemReport.lastGenerated;
      delete memory.systemReport.report;
      this.logger.log(`[GC] Rotated system report from tick ${oldTick} (age: ${reportAge} ticks)`);
      return 1;
    }

    return 0;
  }

  /**
   * Get current memory usage estimate.
   * Note: This is an approximation based on JSON serialization.
   */
  public getMemoryUsage(memory: Memory): number {
    try {
      return JSON.stringify(memory).length;
    } catch (error) {
      this.logger.log(`[GC] Failed to estimate memory usage: ${String(error)}`);
      return 0;
    }
  }
}
