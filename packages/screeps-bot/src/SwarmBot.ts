/**
 * Swarm Bot - Main Controller
 *
 * Coordinates all subsystems for the ant colony-inspired bot.
 */

import { memoryManager } from "./memory/manager";
import { pheromoneManager } from "./logic/pheromone";
import {
  scheduler,
  createHighFrequencyTask,
  createMediumFrequencyTask,
  createLowFrequencyTask
} from "./core/scheduler";
import { profiler } from "./core/profiler";
import { logger } from "./core/logger";
import { roomManager } from "./core/roomNode";
import type { SwarmState, SwarmCreepMemory } from "./memory/schemas";

// Import role modules
import { runEconomyRole } from "./roles/economy";
import { runMilitaryRole } from "./roles/military";
import { runUtilityRole } from "./roles/utility";
import { runPowerRole, runPowerHarvester, runPowerCarrier } from "./roles/power";

// Import logic modules
import { runSpawnManager } from "./logic/spawn";
import { runDefenseManager, runSquadManager } from "./logic/defense";
import { runExpansionManager } from "./logic/expansion";
import { runNukeManager } from "./logic/nuke";
import { runPowerCreepManager } from "./logic/powerCreep";
import { runClusterManager } from "./logic/cluster";
import { runStrategicLayer, getStrategicStatus } from "./logic/overmind";
import { runMarketManager, getMarketSummary } from "./logic/market";
import { runMetaLayer, getMultiShardStatus } from "./intershard/metaLayer";

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
  /** Enable visualizations */
  enableVisualizations: boolean;
}

const DEFAULT_CONFIG: SwarmBotConfig = {
  enableProfiling: true,
  enableDebugLogging: false,
  pheromoneUpdateInterval: 5,
  strategicUpdateInterval: 20,
  enableVisualizations: true
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
    scheduler.registerTask(
      createHighFrequencyTask(
        "roomLoops",
        () => {
          roomManager.run();
        },
        100
      )
    );

    // High frequency: creep behaviors
    scheduler.registerTask(
      createHighFrequencyTask(
        "creepBehaviors",
        () => {
          this.runCreepBehaviors();
        },
        90
      )
    );

    // High frequency: spawn management
    scheduler.registerTask(
      createHighFrequencyTask(
        "spawnManagement",
        () => {
          this.runSpawnManagement();
        },
        85
      )
    );

    // High frequency: defense
    scheduler.registerTask(
      createHighFrequencyTask(
        "defense",
        () => {
          this.runDefense();
        },
        95
      )
    );

    // High frequency: power creeps
    scheduler.registerTask(
      createHighFrequencyTask(
        "powerCreeps",
        () => {
          this.runPowerCreeps();
        },
        80
      )
    );

    // Medium frequency: pheromone diffusion
    scheduler.registerTask(
      createMediumFrequencyTask(
        "pheromoneDiffusion",
        () => {
          this.runPheromoneDiffusion();
        },
        50
      )
    );

    // Medium frequency: cluster operations
    scheduler.registerTask(
      createMediumFrequencyTask(
        "clusterOperations",
        () => {
          this.runClusterOperations();
        },
        40
      )
    );

    // Medium frequency: squad management
    scheduler.registerTask(
      createMediumFrequencyTask(
        "squadManagement",
        () => {
          runSquadManager();
        },
        45
      )
    );

    // Low frequency: strategic decisions
    scheduler.registerTask(
      createLowFrequencyTask(
        "strategicDecisions",
        () => {
          this.runStrategicDecisions();
        },
        30
      )
    );

    // Low frequency: expansion
    scheduler.registerTask(
      createLowFrequencyTask(
        "expansion",
        () => {
          this.runExpansion();
        },
        25
      )
    );

    // Low frequency: nuke management
    scheduler.registerTask(
      createLowFrequencyTask(
        "nukeManagement",
        () => {
          this.runNukeManagement();
        },
        20
      )
    );

    // Low frequency: market
    scheduler.registerTask(
      createLowFrequencyTask(
        "market",
        () => {
          this.runMarket();
        },
        15
      )
    );

    // Low frequency: multi-shard
    scheduler.registerTask(
      createLowFrequencyTask(
        "multiShard",
        () => {
          this.runMultiShard();
        },
        10
      )
    );

    // Low frequency: cleanup
    scheduler.registerTask(
      createLowFrequencyTask(
        "memoryCleanup",
        () => {
          const cleaned = memoryManager.cleanDeadCreeps();
          if (cleaned > 0) {
            logger.debug(`Cleaned ${cleaned} dead creep memory entries`);
          }
        },
        5
      )
    );

    // Low frequency: visualizations
    if (this.config.enableVisualizations) {
      scheduler.registerTask(
        createLowFrequencyTask(
          "visualizations",
          () => {
            this.runVisualizations();
          },
          1
        )
      );
    }
  }

  /**
   * Get owned rooms and swarm states
   */
  private getOwnedRoomsAndSwarms(): { ownedRooms: string[]; swarms: Map<string, SwarmState> } {
    const ownedRooms: string[] = [];
    const swarms = new Map<string, SwarmState>();

    for (const roomName of Object.keys(Game.rooms)) {
      const room = Game.rooms[roomName];
      if (room?.controller?.my) {
        ownedRooms.push(roomName);
        const swarm = memoryManager.getOrInitSwarmState(roomName);
        swarms.set(roomName, swarm);
      }
    }

    return { ownedRooms, swarms };
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
        if (err instanceof Error) {
          logger.error(`Creep ${creep.name} behavior error: ${err.message}\n${err.stack}`);
        } else {
          logger.error(`Creep ${creep.name} behavior error: ${String(err)}`);
        }
      }
    }
  }

  /**
   * Run single creep behavior using role modules
   */
  private runCreep(creep: Creep): void {
    const memory = creep.memory as unknown as SwarmCreepMemory;
    const family = memory.family ?? "economy";

    switch (family) {
      case "economy":
        runEconomyRole(creep);
        break;
      case "military":
        runMilitaryRole(creep);
        break;
      case "utility":
        runUtilityRole(creep);
        break;
      case "power":
        // Power family creeps (not PowerCreeps)
        if (memory.role === "powerHarvester") {
          runPowerHarvester(creep);
        } else if (memory.role === "powerCarrier") {
          runPowerCarrier(creep);
        }
        break;
      default:
        runEconomyRole(creep);
    }
  }

  /**
   * Run spawn management for all owned rooms
   */
  private runSpawnManagement(): void {
    const { ownedRooms, swarms } = this.getOwnedRoomsAndSwarms();

    for (const roomName of ownedRooms) {
      const room = Game.rooms[roomName];
      const swarm = swarms.get(roomName);
      if (room && swarm) {
        runSpawnManager(room, swarm);
      }
    }
  }

  /**
   * Run defense for all owned rooms
   */
  private runDefense(): void {
    const { ownedRooms, swarms } = this.getOwnedRoomsAndSwarms();

    for (const roomName of ownedRooms) {
      const room = Game.rooms[roomName];
      const swarm = swarms.get(roomName);
      if (room && swarm) {
        runDefenseManager(room, swarm);
      }
    }
  }

  /**
   * Run power creeps
   */
  private runPowerCreeps(): void {
    const { ownedRooms, swarms } = this.getOwnedRoomsAndSwarms();

    // Run power creep manager
    runPowerCreepManager(ownedRooms, swarms);

    // Run individual power creeps
    for (const powerCreep of Object.values(Game.powerCreeps)) {
      if (powerCreep.ticksToLive === undefined) continue; // Not spawned

      try {
        runPowerRole(powerCreep);
      } catch (err) {
        if (err instanceof Error) {
          logger.error(`PowerCreep ${powerCreep.name} error: ${err.message}`);
        } else {
          logger.error(`PowerCreep ${powerCreep.name} error: ${String(err)}`);
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
    const { ownedRooms, swarms } = this.getOwnedRoomsAndSwarms();
    runClusterManager(ownedRooms, swarms);
  }

  /**
   * Run strategic decisions
   */
  private runStrategicDecisions(): void {
    const { ownedRooms, swarms } = this.getOwnedRoomsAndSwarms();
    runStrategicLayer(ownedRooms, swarms);
  }

  /**
   * Run expansion logic
   */
  private runExpansion(): void {
    const { ownedRooms, swarms } = this.getOwnedRoomsAndSwarms();
    runExpansionManager(ownedRooms, swarms);
  }

  /**
   * Run nuke management
   */
  private runNukeManagement(): void {
    const { ownedRooms, swarms } = this.getOwnedRoomsAndSwarms();
    runNukeManager(ownedRooms, swarms);
  }

  /**
   * Run market operations
   */
  private runMarket(): void {
    const { ownedRooms, swarms } = this.getOwnedRoomsAndSwarms();
    runMarketManager(ownedRooms, swarms);
  }

  /**
   * Run multi-shard operations
   */
  private runMultiShard(): void {
    const { ownedRooms, swarms } = this.getOwnedRoomsAndSwarms();
    runMetaLayer(ownedRooms, swarms);
  }

  /**
   * Run visualizations
   */
  private runVisualizations(): void {
    if (Game.time % 5 !== 0) return;

    const { swarms } = this.getOwnedRoomsAndSwarms();

    for (const [roomName, swarm] of swarms) {
      const room = Game.rooms[roomName];
      if (!room) continue;

      const visual = room.visual;

      // Display room state
      visual.text(`Stage: ${swarm.colonyLevel}`, 1, 1, { align: "left", font: 0.6 });
      visual.text(`Posture: ${swarm.posture}`, 1, 1.8, { align: "left", font: 0.6 });
      visual.text(`Danger: ${swarm.danger}`, 1, 2.6, { align: "left", font: 0.6 });

      // Display top pheromones
      const topPheromones = Object.entries(swarm.pheromones)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 3);

      let y = 3.4;
      for (const [name, value] of topPheromones) {
        visual.text(`${name}: ${(value as number).toFixed(1)}`, 1, y, { align: "left", font: 0.5 });
        y += 0.6;
      }
    }
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
    strategic: ReturnType<typeof getStrategicStatus>;
    market: ReturnType<typeof getMarketSummary>;
    multiShard: ReturnType<typeof getMultiShardStatus>;
  } {
    return {
      rooms: Object.values(Game.rooms).filter(r => r.controller?.my).length,
      creeps: Object.keys(Game.creeps).length,
      gcl: Game.gcl.level,
      gpl: Game.gpl.level,
      bucket: Game.cpu.bucket,
      avgCpu: profiler.getTotalRoomCpu(),
      strategic: getStrategicStatus(),
      market: getMarketSummary(),
      multiShard: getMultiShardStatus()
    };
  }

  /**
   * Reset all state
   */
  public reset(): void {
    this.initialized = false;
    memoryManager.initialize();
    logger.info("SwarmBot reset");
  }
}
