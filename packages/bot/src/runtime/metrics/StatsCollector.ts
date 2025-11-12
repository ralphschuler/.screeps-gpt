import type { PerformanceSnapshot } from "@shared/contracts";
import { profile } from "@profiler";

interface RoomStats {
  energyAvailable: number;
  energyCapacityAvailable: number;
  controllerLevel?: number;
  controllerProgress?: number;
  /**
   * The total progress required to reach the next controller level (RCL).
   * Useful for monitoring RCL advancement in this room.
   */
  controllerProgressTotal?: number;
}

interface StatsData {
  time: number;
  cpu: {
    used: number;
    limit: number;
    bucket: number;
  };
  creeps: {
    count: number;
  };
  rooms: {
    count: number;
    [roomName: string]: number | RoomStats;
  };
  spawn?: {
    orders: number;
  };
}

interface GameLike {
  time: number;
  cpu: {
    getUsed(): number;
    limit: number;
    bucket: number;
  };
  creeps: Record<string, unknown>;
  rooms: Record<
    string,
    {
      energyAvailable: number;
      energyCapacityAvailable: number;
      controller?: {
        level: number;
        progress: number;
        progressTotal: number;
      };
    }
  >;
}

/**
 * Collects and stores performance statistics to Memory.stats for external monitoring.
 * The Screeps API endpoint /api/user/stats retrieves data from Memory.stats for
 * PTR telemetry and automated monitoring workflows.
 *
 * @example
 * ```ts
 * import { StatsCollector } from "./runtime/metrics/StatsCollector";
 * // Assume `game`, `memory`, and `snapshot` are provided by the runtime
 * const statsCollector = new StatsCollector();
 * statsCollector.collect(game, memory, snapshot);
 * ```
 */
@profile
export class StatsCollector {
  /**
   * Collect performance metrics and store them in Memory.stats for the current tick.
   * This data is consumed by external monitoring systems via the Screeps API.
   */
  public collect(game: GameLike, memory: Memory, snapshot: PerformanceSnapshot): void {
    try {
      const stats: StatsData = {
        time: game.time,
        cpu: {
          used: snapshot.cpuUsed,
          limit: snapshot.cpuLimit,
          bucket: snapshot.cpuBucket
        },
        creeps: {
          count: snapshot.creepCount
        },
        rooms: {
          count: snapshot.roomCount
        }
      };

      // Add per-room statistics with error handling
      try {
        for (const roomName in game.rooms) {
          const room = game.rooms[roomName];
          const roomStats: RoomStats = {
            energyAvailable: room.energyAvailable,
            energyCapacityAvailable: room.energyCapacityAvailable
          };

          if (room.controller) {
            roomStats.controllerLevel = room.controller.level;
            roomStats.controllerProgress = room.controller.progress;
            roomStats.controllerProgressTotal = room.controller.progressTotal;
          }

          stats.rooms[roomName] = roomStats;
        }
      } catch (roomError) {
        console.log(`[StatsCollector] Error collecting room stats: ${String(roomError)}`);
      }

      // Add spawn statistics if available
      if (snapshot.spawnOrders > 0) {
        stats.spawn = {
          orders: snapshot.spawnOrders
        };
      }

      // Store stats in Memory for API access
      memory.stats = stats;

      // Verify stats were written successfully
      if (!memory.stats || typeof memory.stats !== "object") {
        console.log("[StatsCollector] WARNING: Memory.stats was not written correctly");
      }
    } catch (error) {
      console.log(`[StatsCollector] CRITICAL: Failed to collect stats: ${String(error)}`);
      // Ensure Memory.stats exists even if collection fails
      memory.stats ??= {
        time: game.time,
        cpu: { used: 0, limit: 0, bucket: 0 },
        creeps: { count: 0 },
        rooms: { count: 0 }
      };
    }
  }
}
