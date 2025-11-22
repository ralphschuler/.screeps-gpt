import type { GameContext, RoomLike } from "@runtime/types/GameContext";
import { ColonyManager } from "@runtime/planning/ColonyManager";
import { ScoutManager } from "@runtime/scouting/ScoutManager";
import { profile } from "@ralphschuler/screeps-profiler";

/**
 * Player username for identifying owned rooms.
 * Injected at build time from PLAYER_USERNAME environment variable.
 */
const PLAYER_USERNAME = __PLAYER_USERNAME__;

/**
 * Room threat assessment
 */
export interface RoomThreat {
  room: string;
  hostileCount: number;
  severity: number;
}

/**
 * Resource distribution for inter-room transfers
 */
export interface ResourceDistribution {
  surplus: Array<{ room: string; amount: number }>;
  deficit: Array<{ room: string; needed: number }>;
}

/**
 * Empire-wide metrics
 */
export interface EmpireMetrics {
  totalRooms: number;
  roomsStable: number;
  cpuPerRoom: Map<string, number>;
  averageCpu: number;
  gcl: number;
  gclProgress: number;
}

/**
 * Empire manager memory structure
 */
export interface EmpireMemory {
  /** Last tick empire was updated */
  lastUpdate: number;
  /** CPU budget per room */
  cpuBudgets: Record<string, number>;
  /** Empire-wide threat tracking */
  threats: RoomThreat[];
  /** Resource transfer history */
  transferHistory: Array<{
    tick: number;
    from: string;
    to: string;
    resource: ResourceConstant;
    amount: number;
  }>;
}

/**
 * Empire manager configuration
 */
export interface EmpireManagerConfig {
  /** Target CPU per room */
  targetCpuPerRoom?: number;
  /** Minimum CPU bucket for expansion */
  minCpuBucketForExpansion?: number;
  /** Minimum RCL for room stability */
  minRclForStability?: number;
  /** Logger for debugging */
  logger?: Pick<Console, "log" | "warn">;
}

/**
 * Manages empire-wide coordination across multiple rooms.
 * Handles CPU allocation, threat coordination, resource balancing, and expansion management.
 *
 * @example
 * ```ts
 * const empire = new EmpireManager();
 * empire.run(Game, Memory);
 * ```
 */
@profile
export class EmpireManager {
  private readonly colonyManager: ColonyManager;
  private readonly scoutManager: ScoutManager;
  private readonly targetCpuPerRoom: number;
  private readonly minCpuBucketForExpansion: number;
  private readonly minRclForStability: number;
  private readonly logger: Pick<Console, "log" | "warn">;

  public constructor(config: EmpireManagerConfig = {}) {
    // Initialize colony manager without memory - will be set in run()
    this.colonyManager = new ColonyManager({ logger: config.logger });
    this.scoutManager = new ScoutManager(config.logger);
    this.targetCpuPerRoom = config.targetCpuPerRoom ?? 10;
    this.minCpuBucketForExpansion = config.minCpuBucketForExpansion ?? 5000;
    this.minRclForStability = config.minRclForStability ?? 3;
    this.logger = config.logger ?? console;
  }

  /**
   * Initialize empire memory if not present
   */
  public initializeMemory(memory: Memory): void {
    memory.empire ??= {
      lastUpdate: 0,
      cpuBudgets: {},
      threats: [],
      transferHistory: []
    } as EmpireMemory;

    // Initialize colony memory for expansion queue
    memory.colony ??= {
      expansionQueue: [],
      claimedRooms: [],
      shardMessages: [],
      lastExpansionCheck: 0
    };
  }

  /**
   * Main run loop - coordinates all empire-level operations
   */
  public run(game: GameContext, memory: Memory): void {
    this.initializeMemory(memory);
    this.scoutManager.initializeMemory(memory);

    // Set colony memory reference for expansion queue persistence
    const colonyMemory = memory.colony as import("@runtime/planning/ColonyManager").ColonyManagerMemory;
    this.colonyManager.setMemoryReference(colonyMemory);

    const rooms = this.getManagedRooms(game);

    if (rooms.length === 0) {
      return;
    }

    // Allocate CPU budget
    const cpuBudget = this.allocateCPU(rooms, game);
    const empireMemory = memory.empire as EmpireMemory;
    // Convert Map to plain object for ES2018 compatibility
    const cpuBudgets: Record<string, number> = {};
    for (const [roomName, budget] of cpuBudget) {
      cpuBudgets[roomName] = budget;
    }
    empireMemory.cpuBudgets = cpuBudgets;

    // Coordinate defense
    this.coordinateEmpireDefense(rooms, game);

    // Balance resources
    this.balanceEmpireResources(rooms);

    // Manage expansion
    this.manageExpansion(rooms, game, memory);

    // Identify occupied rooms for takeover planning
    this.identifyTakeoverTargets(memory);

    // Run colony manager
    this.colonyManager.run(game.rooms, game.time);
    this.colonyManager.saveToMemory();

    empireMemory.lastUpdate = game.time;
  }

  /**
   * Get all rooms under empire control
   */
  private getManagedRooms(game: GameContext): RoomLike[] {
    return Object.values(game.rooms).filter(room => {
      return room.controller?.my ?? false;
    });
  }

  /**
   * Allocate CPU budget across rooms
   */
  private allocateCPU(rooms: RoomLike[], game: GameContext): Map<string, number> {
    const budget = new Map<string, number>();
    const cpuPerRoom = game.cpu.limit / rooms.length;

    for (const room of rooms) {
      const rcl = room.controller?.level ?? 0;
      // Higher RCL rooms get slight priority
      const allocation = cpuPerRoom * (1 + rcl * 0.05);
      budget.set(room.name, allocation);
    }

    return budget;
  }

  /**
   * Coordinate empire-wide defense
   */
  private coordinateEmpireDefense(rooms: RoomLike[], game: GameContext): void {
    const threats = this.identifyThreats(rooms);

    if (threats.length > 0) {
      for (const threat of threats) {
        this.respondToThreat(threat, game);
      }
    }
  }

  /**
   * Identify threats across all rooms
   */
  private identifyThreats(rooms: RoomLike[]): RoomThreat[] {
    const threats: RoomThreat[] = [];

    for (const room of rooms) {
      const hostiles = room.find(FIND_HOSTILE_CREEPS);
      if (hostiles.length > 0) {
        threats.push({
          room: room.name,
          hostileCount: hostiles.length,
          severity: this.calculateThreatSeverity(hostiles)
        });
      }
    }

    return threats;
  }

  /**
   * Calculate threat severity based on hostile body parts
   */
  private calculateThreatSeverity(hostiles: Creep[]): number {
    const attackParts = hostiles.reduce(
      (sum, creep) => sum + creep.body.filter(p => p.type === ATTACK || p.type === RANGED_ATTACK).length,
      0
    );
    return attackParts;
  }

  /**
   * Respond to identified threat
   */
  private respondToThreat(threat: RoomThreat, game: GameContext): void {
    const room = game.rooms[threat.room];
    if (!room?.controller?.my) return;

    const controller = room.controller;

    if (threat.severity > 10 && controller.safeModeAvailable) {
      const result = controller.activateSafeMode();
      if (result === OK) {
        this.logger.log?.(`[EmpireManager] Safe mode activated in ${room.name}`);
      }
    } else {
      this.logger.warn?.(
        `[EmpireManager] Threat detected in ${threat.room}: ${threat.hostileCount} hostiles (severity: ${threat.severity})`
      );
    }
  }

  /**
   * Balance resources across empire
   */
  private balanceEmpireResources(rooms: RoomLike[]): void {
    const energySummary = this.summarizeEnergy(rooms);

    if (energySummary.surplus.length > 0 && energySummary.deficit.length > 0) {
      this.redistributeEnergy(energySummary, rooms);
    }
  }

  /**
   * Summarize energy distribution across rooms
   */
  private summarizeEnergy(rooms: RoomLike[]): ResourceDistribution {
    const surplus: Array<{ room: string; amount: number }> = [];
    const deficit: Array<{ room: string; needed: number }> = [];

    for (const room of rooms) {
      const storage = room.storage as StructureStorage | undefined;
      const terminal = room.terminal as StructureTerminal | undefined;

      if (storage?.store && terminal?.store) {
        const totalEnergy =
          (storage.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0) +
          (terminal.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0);

        // Consider room in surplus if >100k energy
        if (totalEnergy > 100000) {
          surplus.push({ room: room.name, amount: totalEnergy - 50000 });
        }
        // Consider room in deficit if <20k energy
        else if (totalEnergy < 20000) {
          deficit.push({ room: room.name, needed: 50000 - totalEnergy });
        }
      }
    }

    return { surplus, deficit };
  }

  /**
   * Redistribute energy from surplus to deficit rooms
   */
  private redistributeEnergy(distribution: ResourceDistribution, rooms: RoomLike[]): void {
    if (distribution.surplus.length === 0 || distribution.deficit.length === 0) {
      return;
    }

    const sourceRoomName = distribution.surplus[0].room;
    const targetRoomName = distribution.deficit[0].room;

    const sourceRoom = rooms.find(r => r.name === sourceRoomName);
    const terminal = sourceRoom?.terminal as StructureTerminal | undefined;
    if (!terminal || terminal.cooldown > 0) {
      return;
    }

    const transferAmount = Math.min(10000, distribution.surplus[0].amount, distribution.deficit[0].needed);
    const result = terminal.send(RESOURCE_ENERGY, transferAmount, targetRoomName, "Empire support");

    if (result === OK) {
      this.logger.log?.(
        `[EmpireManager] Transferred ${transferAmount} energy from ${sourceRoomName} to ${targetRoomName}`
      );
    }
  }

  /**
   * Manage empire expansion
   */
  private manageExpansion(rooms: RoomLike[], game: GameContext, memory: Memory): void {
    if (this.shouldExpand(rooms, game)) {
      const targetRoom = this.identifyExpansionTarget(memory, rooms);
      if (targetRoom) {
        this.initiateExpansion(targetRoom, game);
      }
    }
  }

  /**
   * Determine if empire should expand
   */
  private shouldExpand(rooms: RoomLike[], game: GameContext): boolean {
    const gcl = game.gcl as { level: number };
    const activeRooms = rooms.length;

    // Don't expand if at GCL limit
    if (activeRooms >= gcl.level) return false;

    // Don't expand if CPU bucket is low
    if (game.cpu.bucket < this.minCpuBucketForExpansion) return false;

    // Don't expand if any room is struggling
    const strugglingRooms = rooms.filter(r => {
      const rcl = r.controller?.level ?? 0;
      return rcl < this.minRclForStability;
    });

    return strugglingRooms.length === 0;
  }

  /**
   * Identify best expansion target from scout data
   */
  private identifyExpansionTarget(memory: Memory, rooms: RoomLike[]): string | null {
    const scouts = this.scoutManager.getAllRooms(memory);

    // Filter for unowned rooms with at least 1 source
    const candidates = scouts.filter(report => {
      return !report.owned && report.sourceCount >= 1 && (report.controllerLevel ?? 0) === 0 && !report.hasHostiles;
    });

    if (candidates.length === 0) return null;

    // Prefer rooms closer to existing empire
    return this.selectClosestRoom(candidates, rooms);
  }

  /**
   * Identify occupied rooms for takeover planning
   */
  private identifyTakeoverTargets(memory: Memory): void {
    const scouts = this.scoutManager.getAllRooms(memory);

    // Find owned rooms by other players
    const occupiedRooms = scouts.filter(report => {
      return (
        report.owned &&
        report.owner !== undefined &&
        report.owner !== PLAYER_USERNAME && // Not our own rooms
        report.sourceCount >= 1 &&
        report.controllerLevel !== undefined &&
        report.controllerLevel > 0
      );
    });

    if (occupiedRooms.length === 0) return;

    // Initialize takeover planning memory
    memory.takeover ??= {
      targets: [],
      lastUpdate: 0
    };

    // Update takeover targets list
    for (const room of occupiedRooms) {
      // Check if already in takeover list
      const existing = (memory.takeover.targets as Array<{ roomName: string }>).find(
        t => t.roomName === room.roomName
      );

      if (!existing) {
        const target = {
          roomName: room.roomName,
          owner: room.owner,
          controllerLevel: room.controllerLevel,
          sourceCount: room.sourceCount,
          threatLevel: room.threatLevel ?? "unknown",
          hostileStructures: room.hostileStructures,
          hostileCreeps: room.hostileCreeps,
          discoveredAt: (typeof Game !== "undefined" ? Game.time : 0),
          status: "identified" as const,
          priority: this.calculateTakeoverPriority(room)
        };

        (memory.takeover.targets as Array<typeof target>).push(target);

        this.logger.log?.(
          `[EmpireManager] 🎯 Identified takeover target: ${room.roomName} ` +
            `(Owner: ${room.owner}, RCL: ${room.controllerLevel}, Threat: ${room.threatLevel}, Priority: ${target.priority})`
        );
      }
    }

    memory.takeover.lastUpdate = typeof Game !== "undefined" ? Game.time : 0;
  }

  /**
   * Calculate priority for room takeover based on strategic value and difficulty
   */
  private calculateTakeoverPriority(
    room: import("@runtime/scouting/ScoutManager").RemoteRoomData
  ): number {
    let priority = 50; // Base priority

    // Increase priority for valuable rooms
    if (room.sourceCount >= 2) {
      priority += 20;
    }

    // Decrease priority for high-level rooms (harder to take)
    const rcl = room.controllerLevel ?? 0;
    priority -= rcl * 5;

    // Decrease priority based on threat level
    switch (room.threatLevel) {
      case "low":
        priority -= 5;
        break;
      case "medium":
        priority -= 15;
        break;
      case "high":
        priority -= 30;
        break;
      case "extreme":
        priority -= 50;
        break;
    }

    // Decrease priority for heavy defenses
    if (room.hostileStructures) {
      priority -= room.hostileStructures.towers * 10;
      priority -= room.hostileStructures.spawns * 5;
    }

    // Ensure priority is reasonable
    return Math.max(0, Math.min(100, priority));
  }

  /**
   * Select closest room to existing empire
   */
  private selectClosestRoom(
    candidates: Array<{ roomName: string; pathDistance?: number }>,
    _rooms: RoomLike[]
  ): string {
    if (candidates.length === 0) return "";

    // Simple heuristic: return first candidate with known path distance
    const withDistance = candidates.filter(c => c.pathDistance !== undefined);
    if (withDistance.length > 0) {
      withDistance.sort((a, b) => (a.pathDistance ?? 0) - (b.pathDistance ?? 0));
      return withDistance[0].roomName;
    }

    return candidates[0].roomName;
  }

  /**
   * Initiate expansion to target room
   */
  private initiateExpansion(targetRoom: string, game: GameContext): void {
    this.colonyManager.requestExpansion(targetRoom, "Empire expansion", game.time, 75);
    this.logger.log?.(`[EmpireManager] Initiating expansion to ${targetRoom}`);
  }

  /**
   * Get CPU budget for a room
   */
  public getCPUBudget(roomName: string, memory: Memory): number {
    this.initializeMemory(memory);
    const empireMemory = memory.empire as EmpireMemory;
    return empireMemory.cpuBudgets[roomName] ?? this.targetCpuPerRoom;
  }

  /**
   * Get empire metrics
   */
  public getMetrics(game: GameContext): EmpireMetrics {
    const rooms = this.getManagedRooms(game);
    const cpuPerRoom = new Map<string, number>();
    let totalCpu = 0;

    // Simple estimation: divide current CPU by room count
    const estimatedCpuPerRoom = rooms.length > 0 ? game.cpu.getUsed() / rooms.length : 0;
    for (const room of rooms) {
      cpuPerRoom.set(room.name, estimatedCpuPerRoom);
      totalCpu += estimatedCpuPerRoom;
    }

    const roomsStable = rooms.filter(r => (r.controller?.level ?? 0) >= this.minRclForStability).length;

    const gcl = game.gcl as { level: number; progress: number };

    return {
      totalRooms: rooms.length,
      roomsStable,
      cpuPerRoom,
      averageCpu: rooms.length > 0 ? totalCpu / rooms.length : 0,
      gcl: gcl.level,
      gclProgress: gcl.progress
    };
  }

  /**
   * Get colony manager for testing purposes
   */
  public getColonyManager(): ColonyManager {
    return this.colonyManager;
  }
}
