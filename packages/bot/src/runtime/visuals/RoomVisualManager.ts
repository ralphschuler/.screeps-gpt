import { profile } from "@ralphschuler/screeps-profiler";
import { WallUpgradeManager } from "@runtime/defense/WallUpgradeManager";
import { EnergyValidator } from "@runtime/energy/EnergyValidation";

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
   * Show wall upgrade progress
   * Default: true (if enabled)
   */
  showWallUpgrade?: boolean;

  /**
   * Show energy economy status
   * Default: true (if enabled)
   */
  showEnergyEconomy?: boolean;

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
      controller?: StructureController | null;
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
  private readonly wallUpgradeManager: WallUpgradeManager;
  private readonly energyValidator: EnergyValidator;

  public constructor(config: RoomVisualConfig = {}, wallUpgradeManager?: WallUpgradeManager) {
    this.config = {
      enabled: config.enabled ?? false,
      showCreepPaths: config.showCreepPaths ?? true,
      showEnergyFlow: config.showEnergyFlow ?? true,
      showConstructionTargets: config.showConstructionTargets ?? true,
      showSpawnQueue: config.showSpawnQueue ?? true,
      showCpuUsage: config.showCpuUsage ?? true,
      showWallUpgrade: config.showWallUpgrade ?? true,
      showEnergyEconomy: config.showEnergyEconomy ?? true,
      cpuBudget: config.cpuBudget ?? 2.0
    };
    this.wallUpgradeManager = wallUpgradeManager ?? new WallUpgradeManager();
    this.energyValidator = new EnergyValidator();
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

      if (this.config.showWallUpgrade) {
        this.renderWallUpgrade(room);
      }

      if (this.config.showEnergyEconomy) {
        this.renderEnergyEconomy(room);
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
   * Render wall upgrade progress information
   */
  private renderWallUpgrade(room: {
    visual: RoomVisual;
    name: string;
    controller?: StructureController | null;
    find<T>(type: number): T[];
  }): void {
    // Only show for rooms with a controller
    if (!room.controller) {
      return;
    }

    const progress = this.wallUpgradeManager.getUpgradeProgress(room);

    // Skip if no walls exist
    if (progress.wallCount === 0) {
      return;
    }

    // Format target hits for display (K = thousands, M = millions)
    const formatHits = (hits: number): string => {
      if (hits >= 1_000_000) {
        return `${(hits / 1_000_000).toFixed(1)}M`;
      }
      if (hits >= 1_000) {
        return `${(hits / 1_000).toFixed(0)}K`;
      }
      return hits.toString();
    };

    const targetStr = formatHits(progress.targetHits);
    const minStr = formatHits(progress.minHits);
    const maxStr = formatHits(progress.maxHits);

    // Calculate completion percentage
    const completionPercent =
      progress.targetHits > 0 ? Math.floor((progress.minHits / progress.targetHits) * 100) : 100;

    // Choose color based on completion
    let color = "#ff0000"; // Red for low completion
    if (completionPercent >= 90) {
      color = "#00ff00"; // Green for near completion
    } else if (completionPercent >= 60) {
      color = "#ffff00"; // Yellow for moderate
    } else if (completionPercent >= 30) {
      color = "#ff8800"; // Orange for low-moderate
    }

    // Display in top-left corner
    const y = 1;
    room.visual.text(`🛡️ Walls: ${minStr}/${targetStr} (${completionPercent}%)`, 1, y, {
      color,
      font: 0.5,
      align: "left",
      opacity: 0.9
    });

    // Show range if not all walls are equal
    if (progress.maxHits > progress.minHits) {
      room.visual.text(`   Range: ${minStr} - ${maxStr}`, 1, y + 0.6, {
        color: "#aaaaaa",
        font: 0.4,
        align: "left",
        opacity: 0.7
      });
    }

    // Show completion status
    if (progress.upgradeComplete) {
      room.visual.text(`   ✓ Stage Complete`, 1, y + 1.2, {
        color: "#00ff00",
        font: 0.4,
        align: "left",
        opacity: 0.8
      });
    }
  }

  /**
   * Render energy economy status
   */
  private renderEnergyEconomy(room: {
    visual: RoomVisual;
    name: string;
    energyAvailable: number;
    energyCapacityAvailable: number;
    controller?: StructureController | null;
    find<T>(type: number): T[];
  }): void {
    // Only show for owned rooms
    if (!room.controller?.my) {
      return;
    }

    // Safe cast: The duck-typed interface satisfies Room's requirements for EnergyValidator.
    // This pattern allows testing without full Room mocks while maintaining type safety at runtime.
    const actualRoom = room as unknown as Room;

    // Render energy status at position (1, 3) to avoid overlap with wall upgrade
    this.energyValidator.renderEnergyStatus(actualRoom, { x: 1, y: 3 });
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
