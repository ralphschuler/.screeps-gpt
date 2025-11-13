import { StatsCollector } from "@runtime/metrics/StatsCollector";
import type { PerformanceSnapshot } from "@shared/contracts";

/**
 * Console-accessible diagnostics for validating stats collection pipeline.
 * Provides manual testing tools when automated monitoring detects failures.
 *
 * @example
 * ```
 * // In Screeps console:
 * Diagnostics.testStatsCollection()
 * Diagnostics.validateMemoryStats()
 * Diagnostics.getLastSnapshot()
 * ```
 */
export class Diagnostics {
  /**
   * Manually test stats collection pipeline.
   * Creates a StatsCollector instance and attempts to collect stats.
   *
   * @returns Status message indicating success or failure
   *
   * @example
   * ```
   * // In Screeps console:
   * Diagnostics.testStatsCollection()
   * // Returns: "✅ Stats collection successful. Keys: time, cpu, rooms, creeps"
   * ```
   */
  public static testStatsCollection(): string {
    try {
      // Validate Game object availability
      if (typeof Game === "undefined") {
        return "❌ Game object not available - cannot test stats collection";
      }

      // Validate Memory object availability
      if (typeof Memory === "undefined") {
        return "❌ Memory object not available - cannot test stats collection";
      }

      // Create minimal PerformanceSnapshot for testing
      const snapshot: PerformanceSnapshot = {
        tick: Game.time,
        cpuUsed: Game.cpu.getUsed(),
        cpuLimit: Game.cpu.limit,
        cpuBucket: Game.cpu.bucket,
        creepCount: Object.keys(Game.creeps).length,
        roomCount: Object.keys(Game.rooms).length,
        spawnOrders: 0,
        warnings: [],
        execution: {
          processedCreeps: 0,
          spawnedCreeps: [],
          tasksExecuted: {}
        }
      };

      // Create game context for StatsCollector
      const gameContext = {
        time: Game.time,
        cpu: {
          getUsed: () => Game.cpu.getUsed(),
          limit: Game.cpu.limit,
          bucket: Game.cpu.bucket
        },
        creeps: Game.creeps,
        rooms: Game.rooms
      };

      // Collect stats
      const collector = new StatsCollector();
      collector.collect(gameContext, Memory, snapshot);

      // Validate collection success
      if (Memory.stats && Object.keys(Memory.stats).length > 0) {
        const keys = Object.keys(Memory.stats);
        return `✅ Stats collection successful. Keys: ${keys.join(", ")}`;
      } else {
        return "❌ Stats collection failed - Memory.stats is empty";
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `❌ Stats collection error: ${errorMessage}`;
    }
  }

  /**
   * Validate Memory.stats structure and content.
   * Checks for expected keys and reports missing or invalid data.
   *
   * @returns Validation status message
   *
   * @example
   * ```
   * // In Screeps console:
   * Diagnostics.validateMemoryStats()
   * // Returns: "✅ Memory.stats structure valid. Size: 523 bytes"
   * ```
   */
  public static validateMemoryStats(): string {
    try {
      // Validate Memory object availability
      if (typeof Memory === "undefined") {
        return "❌ Memory object not available";
      }

      // Check if Memory.stats exists
      if (!Memory.stats) {
        return "❌ Memory.stats is undefined";
      }

      // Check for expected top-level keys
      const expectedKeys = ["time", "cpu", "rooms", "creeps"];
      const actualKeys = Object.keys(Memory.stats);
      const missingKeys = expectedKeys.filter(key => !actualKeys.includes(key));

      if (missingKeys.length > 0) {
        return `⚠️ Missing keys: ${missingKeys.join(", ")}`;
      }

      // Validate CPU stats structure
      if (!Memory.stats.cpu || typeof Memory.stats.cpu !== "object") {
        return "⚠️ Memory.stats.cpu is missing or invalid";
      }

      const cpuKeys = ["used", "limit", "bucket"];
      const cpuMissingKeys = cpuKeys.filter(key => !(key in Memory.stats.cpu));
      if (cpuMissingKeys.length > 0) {
        return `⚠️ Missing CPU keys: ${cpuMissingKeys.join(", ")}`;
      }

      // Validate rooms stats structure
      if (!Memory.stats.rooms || typeof Memory.stats.rooms !== "object") {
        return "⚠️ Memory.stats.rooms is missing or invalid";
      }

      // Validate creeps stats structure
      if (!Memory.stats.creeps || typeof Memory.stats.creeps !== "object") {
        return "⚠️ Memory.stats.creeps is missing or invalid";
      }

      // Calculate size
      const size = JSON.stringify(Memory.stats).length;

      return `✅ Memory.stats structure valid. Size: ${size} bytes`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `❌ Validation error: ${errorMessage}`;
    }
  }

  /**
   * Get the latest PerformanceSnapshot data from Memory.systemReport.
   * Provides access to evaluation metrics without code changes.
   *
   * @returns PerformanceSnapshot object or error message
   *
   * @example
   * ```
   * // In Screeps console:
   * Diagnostics.getLastSnapshot()
   * // Returns: { tick: 12345, cpuUsed: 45.2, ... }
   * ```
   */
  public static getLastSnapshot(): object | string {
    try {
      // Validate Memory object availability
      if (typeof Memory === "undefined") {
        return "❌ Memory object not available";
      }

      // Check if systemReport exists
      if (!Memory.systemReport) {
        return "❌ No PerformanceSnapshot data available - Memory.systemReport is undefined";
      }

      // Return the full systemReport including report and metadata
      return {
        lastGenerated: Memory.systemReport.lastGenerated,
        report: Memory.systemReport.report
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `❌ Error retrieving snapshot: ${errorMessage}`;
    }
  }

  /**
   * Get comprehensive diagnostic information about the current game state.
   * Useful for debugging stats collection issues.
   *
   * @returns Diagnostic information object or error message
   *
   * @example
   * ```
   * // In Screeps console:
   * Diagnostics.getSystemInfo()
   * ```
   */
  public static getSystemInfo(): object | string {
    try {
      if (typeof Game === "undefined" || typeof Memory === "undefined") {
        return "❌ Game or Memory objects not available";
      }

      return {
        game: {
          time: Game.time,
          cpu: {
            used: Game.cpu.getUsed(),
            limit: Game.cpu.limit,
            bucket: Game.cpu.bucket
          },
          creepCount: Object.keys(Game.creeps).length,
          roomCount: Object.keys(Game.rooms).length,
          spawnCount: Object.keys(Game.spawns).length
        },
        memory: {
          hasStats: !!Memory.stats,
          hasSystemReport: !!Memory.systemReport,
          statsKeys: Memory.stats ? Object.keys(Memory.stats) : []
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `❌ Error retrieving system info: ${errorMessage}`;
    }
  }
}
