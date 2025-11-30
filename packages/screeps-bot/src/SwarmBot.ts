/**
 * Swarm Bot - Main Controller
 *
 * Coordinates all subsystems for the ant colony-inspired bot.
 */

import { memoryManager } from "./memory/manager";
import { pheromoneManager } from "./logic/pheromone";
import { scheduler, createHighFrequencyTask, createMediumFrequencyTask, createLowFrequencyTask } from "./core/scheduler";
import { profiler } from "./core/profiler";
import { logger } from "./core/logger";
import { roomManager } from "./core/roomNode";
import type { SwarmState } from "./memory/schemas";

/**
 * Swarm bot configuration
 */
export interface SwarmBotConfig {
  /** Enable profiling */
  enableProfiling: boolean;
  /** Enable debug logging */
  enableDebugLogging: boolean;
  /** Pheromone update interval */
  pheromoneUpdateInterval: number;
  /** Strategic update interval */
  strategicUpdateInterval: number;
}

const DEFAULT_CONFIG: SwarmBotConfig = {
  enableProfiling: true,
  enableDebugLogging: false,
  pheromoneUpdateInterval: 5,
  strategicUpdateInterval: 20
};

/**
 * Main Swarm Bot controller
 */
export class SwarmBot {
  private config: SwarmBotConfig;
  private initialized = false;

  public constructor(config: Partial<SwarmBotConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the bot
   */
  public initialize(): void {
    if (this.initialized) return;

    // Initialize memory
    memoryManager.initialize();

    // Configure profiler
    profiler.setEnabled(this.config.enableProfiling);

    // Register scheduled tasks
    this.registerTasks();

    this.initialized = true;
    logger.info("SwarmBot initialized");
  }

  /**
   * Register scheduled tasks
   */
  private registerTasks(): void {
    // High frequency: room loops
    scheduler.registerTask(createHighFrequencyTask("roomLoops", () => {
      roomManager.run();
    }, 100));

    // High frequency: creep behaviors
    scheduler.registerTask(createHighFrequencyTask("creepBehaviors", () => {
      this.runCreepBehaviors();
    }, 90));

    // Medium frequency: pheromone diffusion
    scheduler.registerTask(createMediumFrequencyTask("pheromoneDiffusion", () => {
      this.runPheromoneDiffusion();
    }, 50));

    // Medium frequency: cluster operations
    scheduler.registerTask(createMediumFrequencyTask("clusterOperations", () => {
      this.runClusterOperations();
    }, 40));

    // Low frequency: strategic decisions
    scheduler.registerTask(createLowFrequencyTask("strategicDecisions", () => {
      this.runStrategicDecisions();
    }, 30));

    // Low frequency: cleanup
    scheduler.registerTask(createLowFrequencyTask("memoryCleanup", () => {
      const cleaned = memoryManager.cleanDeadCreeps();
      if (cleaned > 0) {
        logger.debug(`Cleaned ${cleaned} dead creep memory entries`);
      }
    }, 10));
  }

  /**
   * Main loop - call every tick
   */
  public run(): void {
    const cpuStart = Game.cpu.getUsed();

    // Initialize on first run
    if (!this.initialized) {
      this.initialize();
    }

    // Run scheduler
    scheduler.run();

    // Finalize profiler
    profiler.finalizeTick();

    // Update overmind lastRun
    const overmind = memoryManager.getOvermind();
    overmind.lastRun = Game.time;

    // Log tick summary if debug enabled
    if (this.config.enableDebugLogging && Game.time % 100 === 0) {
      const cpuUsed = Game.cpu.getUsed() - cpuStart;
      logger.debug(`Tick ${Game.time}: ${cpuUsed.toFixed(2)} CPU, bucket: ${Game.cpu.bucket}`);
    }
  }

  /**
   * Run creep behaviors
   */
  private runCreepBehaviors(): void {
    for (const creep of Object.values(Game.creeps)) {
      if (creep.spawning) continue;

      try {
        this.runCreep(creep);
      } catch (err) {
        logger.error(`Creep ${creep.name} behavior error: ${err}`);
      }
    }
  }

  /**
   * Run single creep behavior
   */
  private runCreep(creep: Creep): void {
    const memory = creep.memory as Record<string, unknown>;
    const role = memory["role"] as string | undefined;

    if (!role) {
      // Default to harvester behavior for unassigned creeps
      this.runBasicHarvester(creep);
      return;
    }

    // Basic role dispatch - will be expanded with role modules
    switch (role) {
      case "harvester":
      case "larvaWorker":
        this.runBasicHarvester(creep);
        break;
      case "upgrader":
        this.runBasicUpgrader(creep);
        break;
      case "builder":
        this.runBasicBuilder(creep);
        break;
      case "hauler":
        this.runBasicHauler(creep);
        break;
      default:
        this.runBasicHarvester(creep);
    }
  }

  /**
   * Basic harvester behavior
   */
  private runBasicHarvester(creep: Creep): void {
    const memory = creep.memory as Record<string, unknown>;

    if (creep.store.getFreeCapacity() === 0) {
      memory["working"] = true;
    }
    if (creep.store.getUsedCapacity() === 0) {
      memory["working"] = false;
    }

    if (memory["working"]) {
      // Deliver energy
      const target = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
        filter: s =>
          (s.structureType === STRUCTURE_SPAWN ||
            s.structureType === STRUCTURE_EXTENSION ||
            s.structureType === STRUCTURE_TOWER) &&
          "store" in s &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      }) as AnyStoreStructure | null;

      if (target) {
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      } else if (creep.room.controller) {
        // Fallback to upgrading
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      }
    } else {
      // Harvest energy
      const source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
      if (source) {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
        }
      }
    }
  }

  /**
   * Basic upgrader behavior
   */
  private runBasicUpgrader(creep: Creep): void {
    const memory = creep.memory as Record<string, unknown>;

    if (creep.store.getUsedCapacity() === 0) {
      memory["working"] = false;
    }
    if (creep.store.getFreeCapacity() === 0) {
      memory["working"] = true;
    }

    if (memory["working"]) {
      if (creep.room.controller) {
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      }
    } else {
      // Get energy from storage or source
      if (creep.room.storage && creep.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        if (creep.withdraw(creep.room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.storage, { visualizePathStyle: { stroke: "#ffaa00" } });
        }
      } else {
        const source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
        if (source) {
          if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
          }
        }
      }
    }
  }

  /**
   * Basic builder behavior
   */
  private runBasicBuilder(creep: Creep): void {
    const memory = creep.memory as Record<string, unknown>;

    if (creep.store.getUsedCapacity() === 0) {
      memory["working"] = false;
    }
    if (creep.store.getFreeCapacity() === 0) {
      memory["working"] = true;
    }

    if (memory["working"]) {
      const site = creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES);
      if (site) {
        if (creep.build(site) === ERR_NOT_IN_RANGE) {
          creep.moveTo(site, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      } else {
        // Fallback to upgrading
        this.runBasicUpgrader(creep);
      }
    } else {
      // Get energy
      if (creep.room.storage && creep.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        if (creep.withdraw(creep.room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.storage, { visualizePathStyle: { stroke: "#ffaa00" } });
        }
      } else {
        const source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
        if (source) {
          if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
          }
        }
      }
    }
  }

  /**
   * Basic hauler behavior
   */
  private runBasicHauler(creep: Creep): void {
    const memory = creep.memory as Record<string, unknown>;

    if (creep.store.getUsedCapacity() === 0) {
      memory["working"] = false;
    }
    if (creep.store.getFreeCapacity() === 0) {
      memory["working"] = true;
    }

    if (memory["working"]) {
      // Deliver to spawns/extensions/towers
      const target = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
        filter: s =>
          (s.structureType === STRUCTURE_SPAWN ||
            s.structureType === STRUCTURE_EXTENSION ||
            s.structureType === STRUCTURE_TOWER) &&
          "store" in s &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      }) as AnyStoreStructure | null;

      if (target) {
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      } else if (creep.room.storage) {
        // Deliver to storage
        if (creep.transfer(creep.room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.storage, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      }
    } else {
      // Pick up dropped resources or withdraw from containers
      const dropped = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
        filter: r => r.resourceType === RESOURCE_ENERGY
      });

      if (dropped) {
        if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) {
          creep.moveTo(dropped, { visualizePathStyle: { stroke: "#ffaa00" } });
        }
      } else {
        // Withdraw from containers
        const container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: s =>
            s.structureType === STRUCTURE_CONTAINER &&
            (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 0
        }) as StructureContainer | null;

        if (container) {
          if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(container, { visualizePathStyle: { stroke: "#ffaa00" } });
          }
        }
      }
    }
  }

  /**
   * Run pheromone diffusion
   */
  private runPheromoneDiffusion(): void {
    const rooms = new Map<string, SwarmState>();

    for (const roomName of Object.keys(Game.rooms)) {
      const swarm = memoryManager.getSwarmState(roomName);
      if (swarm) {
        rooms.set(roomName, swarm);
      }
    }

    pheromoneManager.applyDiffusion(rooms);
  }

  /**
   * Run cluster operations
   */
  private runClusterOperations(): void {
    // Cluster operations will be implemented in cluster module
  }

  /**
   * Run strategic decisions
   */
  private runStrategicDecisions(): void {
    // Strategic decisions will be implemented in overmind module
  }

  /**
   * Get current stats
   */
  public getStats(): {
    rooms: number;
    creeps: number;
    gcl: number;
    gpl: number;
    bucket: number;
    avgCpu: number;
  } {
    return {
      rooms: Object.values(Game.rooms).filter(r => r.controller?.my).length,
      creeps: Object.keys(Game.creeps).length,
      gcl: Game.gcl.level,
      gpl: Game.gpl.level,
      bucket: Game.cpu.bucket,
      avgCpu: profiler.getTotalRoomCpu()
    };
  }
}
