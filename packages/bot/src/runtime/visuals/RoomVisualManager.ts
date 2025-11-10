import { profile } from "@profiler";

/**
 * Configuration options for room visuals
 */
export interface RoomVisualConfig {
  /**
   * Enable/disable all visuals
   * Default: false (to minimize CPU usage)
   */
  enabled?: boolean;

  /**
   * Show creep paths and movement intentions
   * Default: true (if enabled)
   */
  showCreepPaths?: boolean;

  /**
   * Show energy harvesting operations
   * Default: true (if enabled)
   */
  showEnergyFlow?: boolean;

  /**
   * Show construction and repair targets
   * Default: true (if enabled)
   */
  showConstructionTargets?: boolean;

  /**
   * Show spawn queue and production status
   * Default: true (if enabled)
   */
  showSpawnQueue?: boolean;

  /**
   * Show CPU usage per room
   * Default: true (if enabled)
   */
  showCpuUsage?: boolean;

  /**
   * Maximum CPU budget for visuals per tick
   * Default: 2.0
   */
  cpuBudget?: number;
}

interface GameLike {
  time: number;
  cpu: {
    getUsed(): number;
  };
  rooms: Record<
    string,
    {
      visual: RoomVisual;
      find<T>(type: number): T[];
      name: string;
    }
  >;
  creeps: Record<
    string,
    {
      pos: RoomPosition;
      room: { name: string };
      memory: CreepMemory;
      name: string;
    }
  >;
}

/**
 * Manages room visuals for operational visibility in Screeps.
 * Provides visual feedback for creep activities, energy flow, construction,
 * spawn queue, and CPU usage to aid debugging and monitoring.
 */
@profile
export class RoomVisualManager {
  private readonly config: Required<RoomVisualConfig>;

  public constructor(config: RoomVisualConfig = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      showCreepPaths: config.showCreepPaths ?? true,
      showEnergyFlow: config.showEnergyFlow ?? true,
      showConstructionTargets: config.showConstructionTargets ?? true,
      showSpawnQueue: config.showSpawnQueue ?? true,
      showCpuUsage: config.showCpuUsage ?? true,
      cpuBudget: config.cpuBudget ?? 2.0
    };
  }

  /**
   * Render visuals for all rooms based on configuration.
   * Returns early if visuals are disabled or CPU budget is exhausted.
   */
  public render(game: GameLike): void {
    if (!this.config.enabled) {
      return;
    }

    const startCpu = game.cpu.getUsed();

    // Process each room
    for (const roomName in game.rooms) {
      // Check CPU budget before processing each room
      const cpuUsed = game.cpu.getUsed() - startCpu;
      if (cpuUsed >= this.config.cpuBudget) {
        break;
      }

      const room = game.rooms[roomName];

      if (this.config.showCreepPaths) {
        this.renderCreepPaths(game, room);
      }

      if (this.config.showEnergyFlow) {
        this.renderEnergyFlow(game, room);
      }

      if (this.config.showConstructionTargets) {
        this.renderConstructionTargets(room);
      }

      if (this.config.showSpawnQueue) {
        this.renderSpawnQueue(room);
      }

      if (this.config.showCpuUsage) {
        this.renderCpuUsage(game, room);
      }
    }
  }

  /**
   * Render creep paths and movement intentions
   */
  private renderCreepPaths(game: GameLike, room: { visual: RoomVisual; name: string }): void {
    for (const creepName in game.creeps) {
      const creep = game.creeps[creepName];
      if (creep.room.name !== room.name) {
        continue;
      }

      // Draw a circle at creep position with role color
      const roleColor = this.getRoleColor(creep.memory.role);
      room.visual.circle(creep.pos, {
        radius: 0.45,
        fill: "transparent",
        stroke: roleColor,
        strokeWidth: 0.15,
        opacity: 0.8
      });

      // Show creep name above position
      room.visual.text(creep.name, creep.pos.x, creep.pos.y - 0.6, {
        color: roleColor,
        font: 0.4,
        opacity: 0.8
      });
    }
  }

  /**
   * Render energy harvesting operations
   */
  private renderEnergyFlow(
    game: GameLike,
    room: { visual: RoomVisual; name: string; find<T>(type: number): T[] }
  ): void {
    // Draw lines from harvesters to sources
    for (const creepName in game.creeps) {
      const creep = game.creeps[creepName];
      if (creep.room.name !== room.name || creep.memory.role !== "harvester") {
        continue;
      }

      // Find sources
      const sources = room.find<Source>(FIND_SOURCES);
      if (sources.length > 0) {
        // Draw line to nearest source
        const nearestSource = sources.reduce((closest, source) => {
          const dist = Math.hypot(creep.pos.x - source.pos.x, creep.pos.y - source.pos.y);
          const closestDist = Math.hypot(creep.pos.x - closest.pos.x, creep.pos.y - closest.pos.y);
          return dist < closestDist ? source : closest;
        });

        room.visual.line(creep.pos, nearestSource.pos, {
          color: "#ffaa00",
          width: 0.15,
          opacity: 0.5,
          lineStyle: "dashed"
        });
      }
    }
  }

  /**
   * Render construction and repair targets
   */
  private renderConstructionTargets(room: { visual: RoomVisual; find<T>(type: number): T[] }): void {
    // Find my construction sites
    const constructionSites = room.find<ConstructionSite>(FIND_MY_CONSTRUCTION_SITES);

    for (const site of constructionSites) {
      const progress = site.progress / site.progressTotal;
      room.visual.circle(site.pos, {
        radius: 0.55,
        fill: "transparent",
        stroke: "#00ff00",
        strokeWidth: 0.1,
        opacity: 0.6
      });

      room.visual.text(`${Math.floor(progress * 100)}%`, site.pos.x, site.pos.y + 0.3, {
        color: "#00ff00",
        font: 0.4,
        opacity: 0.8
      });
    }
  }

  /**
   * Render spawn queue and production status
   */
  private renderSpawnQueue(room: { visual: RoomVisual; find<T>(type: number): T[] }): void {
    // Find spawns
    const spawns = room.find<StructureSpawn>(FIND_MY_SPAWNS);

    for (const spawn of spawns) {
      if (spawn.spawning) {
        const spawningCreep = spawn.spawning.name;
        const progress = spawn.spawning.needTime - spawn.spawning.remainingTime;
        const total = spawn.spawning.needTime;
        const percentage = Math.floor((progress / total) * 100);

        room.visual.text(`🏭 ${spawningCreep} ${percentage}%`, spawn.pos.x, spawn.pos.y - 1, {
          color: "#00ffff",
          font: 0.5,
          opacity: 0.9
        });
      }
    }
  }

  /**
   * Render CPU usage per room
   */
  private renderCpuUsage(game: GameLike, room: { visual: RoomVisual; name: string }): void {
    // Show CPU usage in top-right corner of room
    room.visual.text(`CPU: ${game.cpu.getUsed().toFixed(2)}`, 48, 1, {
      color: "#ffffff",
      font: 0.6,
      align: "right",
      opacity: 0.8
    });

    room.visual.text(`Tick: ${game.time}`, 48, 2, {
      color: "#ffffff",
      font: 0.5,
      align: "right",
      opacity: 0.7
    });
  }

  /**
   * Get color for creep role
   */
  private getRoleColor(role: string): string {
    const roleColors: Record<string, string> = {
      harvester: "#ffaa00",
      upgrader: "#0088ff",
      builder: "#00ff00",
      repairer: "#ff8800",
      courier: "#ff00ff",
      default: "#ffffff"
    };

    return roleColors[role] ?? roleColors.default;
  }
}
