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
  /**
   * Total energy stored in storage and containers in this room
   */
  energyStored?: number;
  /**
   * Active construction sites in this room
   */
  constructionSites?: number;
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
    byRole?: Record<string, number>;
  };
  memory?: {
    used: number;
  };
  structures?: {
    spawns?: number;
    extensions?: number;
    containers?: number;
    towers?: number;
    roads?: number;
  };
  constructionSites?: {
    count: number;
    byType?: Record<string, number>;
  };
  rooms: {
    count: number;
    [roomName: string]: number | RoomStats;
  };
  spawn?: {
    orders: number;
  };
  spawns?: number;
  activeSpawns?: number;
}

interface CreepLike {
  memory: {
    role?: string;
  };
}

interface StructureLike {
  structureType: string;
  store?: {
    energy?: number;
  };
}

interface SpawnLike {
  spawning: { name: string } | null;
}

interface ConstructionSiteLike {
  structureType: string;
}

interface GameLike {
  time: number;
  cpu: {
    getUsed(): number;
    limit: number;
    bucket: number;
  };
  creeps: Record<string, CreepLike>;
  spawns?: Record<string, SpawnLike>;
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
      find?: (type: number) => StructureLike[] | ConstructionSiteLike[];
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
  private diagnosticLoggingEnabled: boolean;
  private lastLogTick: number = 0;
  private readonly LOG_INTERVAL: number = 100; // Log every 100 ticks to avoid spam

  public constructor(options: { enableDiagnostics?: boolean } = {}) {
    this.diagnosticLoggingEnabled = options.enableDiagnostics ?? true;
  }

  /**
   * Collect performance metrics and store them in Memory.stats for the current tick.
   * This data is consumed by external monitoring systems via the Screeps API.
   */
  public collect(game: GameLike, memory: Memory, snapshot: PerformanceSnapshot): void {
    const startCpu = game.cpu.getUsed();
    const shouldLog = this.diagnosticLoggingEnabled && game.time - this.lastLogTick >= this.LOG_INTERVAL;

    if (shouldLog) {
      console.log(`[StatsCollector] Starting stats collection for tick ${game.time}`);
      this.lastLogTick = game.time;
    }

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

      // Collect creeps by role
      try {
        const creepsByRole: Record<string, number> = {};
        for (const creepName in game.creeps) {
          const creep = game.creeps[creepName];
          const role = creep.memory?.role ?? "unknown";
          creepsByRole[role] = (creepsByRole[role] ?? 0) + 1;
        }
        if (Object.keys(creepsByRole).length > 0) {
          stats.creeps.byRole = creepsByRole;
        }
      } catch (error) {
        if (shouldLog) {
          console.log(`[StatsCollector] Error collecting creeps by role: ${String(error)}`);
        }
      }

      // Collect memory usage (RawMemory available in actual game, not in tests)
      try {
        if (typeof RawMemory !== "undefined" && RawMemory.get) {
          const memoryString = RawMemory.get();
          stats.memory = {
            used: memoryString.length
          };
        }
      } catch (error) {
        if (shouldLog) {
          console.log(`[StatsCollector] Error collecting memory usage: ${String(error)}`);
        }
      }

      // Collect structure counts across all rooms
      try {
        const structures: Record<string, number> = {};
        for (const roomName in game.rooms) {
          const room = game.rooms[roomName];
          if (room.find) {
            const FIND_MY_STRUCTURES = 107; // FIND_MY_STRUCTURES constant
            const roomStructures = room.find(FIND_MY_STRUCTURES) as StructureLike[];
            for (const structure of roomStructures) {
              const type = structure.structureType;
              structures[type] = (structures[type] ?? 0) + 1;
            }
          }
        }
        if (Object.keys(structures).length > 0) {
          stats.structures = {
            spawns: structures.spawn ?? undefined,
            extensions: structures.extension ?? undefined,
            containers: structures.container ?? undefined,
            towers: structures.tower ?? undefined,
            roads: structures.road ?? undefined
          };
        }
      } catch (error) {
        if (shouldLog) {
          console.log(`[StatsCollector] Error collecting structure counts: ${String(error)}`);
        }
      }

      // Collect construction sites
      try {
        const constructionSitesByType: Record<string, number> = {};
        let totalSites = 0;
        for (const roomName in game.rooms) {
          const room = game.rooms[roomName];
          if (room.find) {
            const FIND_MY_CONSTRUCTION_SITES = 111; // FIND_MY_CONSTRUCTION_SITES constant
            const sites = room.find(FIND_MY_CONSTRUCTION_SITES) as ConstructionSiteLike[];
            totalSites += sites.length;
            for (const site of sites) {
              const type = site.structureType;
              constructionSitesByType[type] = (constructionSitesByType[type] ?? 0) + 1;
            }
          }
        }
        if (totalSites > 0) {
          stats.constructionSites = {
            count: totalSites,
            byType: Object.keys(constructionSitesByType).length > 0 ? constructionSitesByType : undefined
          };
        }
      } catch (error) {
        if (shouldLog) {
          console.log(`[StatsCollector] Error collecting construction sites: ${String(error)}`);
        }
      }

      // Collect spawn statistics
      try {
        if (game.spawns) {
          let totalSpawns = 0;
          let activeSpawns = 0;
          for (const spawnName in game.spawns) {
            const spawn = game.spawns[spawnName];
            totalSpawns++;
            if (spawn.spawning !== null) {
              activeSpawns++;
            }
          }
          if (totalSpawns > 0) {
            stats.spawns = totalSpawns;
            stats.activeSpawns = activeSpawns;
          }
        }
      } catch (error) {
        if (shouldLog) {
          console.log(`[StatsCollector] Error collecting spawn stats: ${String(error)}`);
        }
      }

      if (shouldLog) {
        console.log(
          `[StatsCollector] Base stats: time=${stats.time}, cpu=${stats.cpu.used.toFixed(2)}/${stats.cpu.limit}, ` +
            `bucket=${stats.cpu.bucket}, creeps=${stats.creeps.count}, rooms=${stats.rooms.count}`
        );
        if (stats.creeps.byRole) {
          console.log(`[StatsCollector] Creeps by role: ${JSON.stringify(stats.creeps.byRole)}`);
        }
        if (stats.memory) {
          console.log(`[StatsCollector] Memory used: ${stats.memory.used} bytes`);
        }
        if (stats.structures) {
          console.log(`[StatsCollector] Structures: ${JSON.stringify(stats.structures)}`);
        }
        if (stats.constructionSites) {
          console.log(`[StatsCollector] Construction sites: ${stats.constructionSites.count}`);
        }
        if (stats.spawns) {
          console.log(`[StatsCollector] Spawns: ${stats.activeSpawns}/${stats.spawns} active`);
        }
      }

      // Add per-room statistics with error handling
      let roomsProcessed = 0;
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

          // Calculate energy stored in storage and containers
          if (room.find) {
            try {
              const FIND_MY_STRUCTURES = 107;
              const structures = room.find(FIND_MY_STRUCTURES) as StructureLike[];
              let energyStored = 0;
              let constructionSites = 0;

              for (const structure of structures) {
                if (
                  (structure.structureType === "storage" || structure.structureType === "container") &&
                  structure.store?.energy
                ) {
                  energyStored += structure.store.energy;
                }
              }

              // Count construction sites in this room
              const FIND_MY_CONSTRUCTION_SITES = 111;
              const sites = room.find(FIND_MY_CONSTRUCTION_SITES) as ConstructionSiteLike[];
              constructionSites = sites.length;

              if (energyStored > 0) {
                roomStats.energyStored = energyStored;
              }
              if (constructionSites > 0) {
                roomStats.constructionSites = constructionSites;
              }
            } catch {
              // Silently fail for individual room metrics
            }
          }

          stats.rooms[roomName] = roomStats;
          roomsProcessed++;
        }

        if (shouldLog && roomsProcessed > 0) {
          console.log(`[StatsCollector] Processed ${roomsProcessed} room(s)`);
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

      // Validate write succeeded
      if (shouldLog) {
        const writeSuccessful = memory.stats !== undefined && memory.stats.time === game.time;
        console.log(`[StatsCollector] Memory.stats write: ${writeSuccessful ? "SUCCESS" : "FAILED"}`);

        if (writeSuccessful) {
          const statsSize = JSON.stringify(memory.stats).length;
          console.log(`[StatsCollector] Stats data size: ${statsSize} bytes`);
        }
      }

      const endCpu = game.cpu.getUsed();
      const cpuCost = endCpu - startCpu;

      if (shouldLog) {
        console.log(`[StatsCollector] Collection completed in ${cpuCost.toFixed(3)} CPU`);
      }
    } catch (error) {
      console.log(`[StatsCollector] CRITICAL: Failed to collect stats: ${String(error)}`);
      // Ensure Memory.stats exists even if collection fails
      memory.stats = {
        time: game?.time ?? 0,
        cpu: { used: 0, limit: 0, bucket: 0 },
        creeps: { count: 0 },
        rooms: { count: 0 }
      };

      if (shouldLog) {
        console.log(`[StatsCollector] Fallback stats written to Memory.stats`);
      }
    }
  }
}
