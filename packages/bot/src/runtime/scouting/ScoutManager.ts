import type { GameContext, RoomLike } from "@runtime/types/GameContext";
import { profile } from "@ralphschuler/screeps-profiler";

/**
 * Player username for identifying owned rooms.
 * Injected at build time from PLAYER_USERNAME environment variable.
 */
const PLAYER_USERNAME = __PLAYER_USERNAME__;

/**
 * Body part count for threat assessment
 */
export interface BodyPartCount {
  attack: number;
  rangedAttack: number;
  heal: number;
  tough: number;
  work: number;
}

/**
 * Hostile structure intelligence
 */
export interface HostileStructures {
  towers: number;
  ramparts: number;
  walls: number;
  spawns: number;
}

/**
 * Hostile creep composition
 */
export interface HostileCreeps {
  defenders: number;
  healers: number;
  totalBodyParts: BodyPartCount;
}

/**
 * Information about a remote room discovered by scouts
 */
export interface RemoteRoomData {
  /** Room name */
  roomName: string;

  /** Last tick this room was scouted */
  lastScouted: number;

  /** Whether this room is owned by another player */
  owned: boolean;

  /** Owner username if owned */
  owner?: string;

  /** Controller level if owned */
  controllerLevel?: number;

  /** Number of sources in the room */
  sourceCount: number;

  /** Source IDs and their positions */
  sources: Array<{ id: Id<Source>; x: number; y: number }>;

  /** Mineral type and position if available */
  mineral?: { type: MineralConstant; x: number; y: number; id: Id<Mineral> };

  /** Whether the room is reserved */
  reserved?: boolean;

  /** Username of reserver if reserved */
  reservedBy?: string;

  /** Ticks until reservation expires */
  reservationEndsAt?: number;

  /** Hostiles present in the room */
  hasHostiles: boolean;

  /** Number of hostile creeps */
  hostileCount: number;

  /** Whether the room has keeper lairs (SK room) */
  isSourceKeeper: boolean;

  /** Distance from home room (path cost) */
  pathDistance?: number;

  /** Hostile structures in the room (for combat assessment) */
  hostileStructures?: HostileStructures;

  /** Hostile creep composition (for combat assessment) */
  hostileCreeps?: HostileCreeps;

  /** Threat level assessment */
  threatLevel?: "none" | "low" | "medium" | "high" | "extreme";
}

/**
 * Memory structure for remote room scouting data
 */
export interface ScoutMemory {
  /** Map of room name to room data */
  rooms: Record<string, RemoteRoomData>;

  /** Last tick scouting was updated */
  lastUpdate: number;

  /** Rooms currently being scouted */
  activeScouts: Record<string, string>; // roomName -> creepName
}

/**
 * Manages scouting of remote rooms for resource harvesting opportunities.
 * Maintains persistent data about discovered rooms in Memory.
 */
@profile
export class ScoutManager {
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly scoutDataLifetime: number;

  public constructor(
    logger: Pick<Console, "log" | "warn"> = console,
    scoutDataLifetime: number = 10000 // Data expires after 10k ticks by default
  ) {
    this.logger = logger;
    this.scoutDataLifetime = scoutDataLifetime;
  }

  /**
   * Initialize scout memory if not present
   */
  public initializeMemory(memory: Memory): void {
    memory.scout ??= {
      rooms: {},
      lastUpdate: 0,
      activeScouts: {}
    } as ScoutMemory;
  }

  /**
   * Scout a room and update memory with discovered information
   */
  public scoutRoom(room: RoomLike, memory: Memory, game: GameContext): RemoteRoomData | null {
    this.initializeMemory(memory);

    const scoutMemory = memory.scout as ScoutMemory;
    const roomName = room.name;

    // Gather room intelligence
    const data: RemoteRoomData = {
      roomName,
      lastScouted: game.time,
      owned: false,
      sourceCount: 0,
      sources: [],
      hasHostiles: false,
      hostileCount: 0,
      isSourceKeeper: false
    };

    // Check controller ownership
    if (room.controller) {
      if (room.controller.owner) {
        data.owned = true;
        data.owner = room.controller.owner.username;
        data.controllerLevel = room.controller.level;
      }

      if (room.controller.reservation) {
        data.reserved = true;
        data.reservedBy = room.controller.reservation.username;
        data.reservationEndsAt = game.time + (room.controller.reservation.ticksToEnd || 0);
      }
    }

    // Find sources
    const sources = room.find(FIND_SOURCES) as Source[];
    data.sourceCount = sources.length;
    data.sources = sources.map(source => ({
      id: source.id,
      x: source.pos.x,
      y: source.pos.y
    }));

    // Find mineral
    const minerals = room.find(FIND_MINERALS) as Mineral[];
    if (minerals.length > 0) {
      const mineral = minerals[0];
      data.mineral = {
        type: mineral.mineralType,
        x: mineral.pos.x,
        y: mineral.pos.y,
        id: mineral.id
      };
    }

    // Check for hostiles
    const hostiles = room.find(FIND_HOSTILE_CREEPS) as Creep[];
    data.hasHostiles = hostiles.length > 0;
    data.hostileCount = hostiles.length;

    // Check for source keeper structures (SK rooms)
    const keeperLairs = room.find(FIND_STRUCTURES, {
      filter: (s: Structure) => s.structureType === STRUCTURE_KEEPER_LAIR
    }) as StructureKeeperLair[];
    data.isSourceKeeper = keeperLairs.length > 0;

    // Collect hostile intelligence for combat assessment
    if (data.owned && data.owner && data.owner !== PLAYER_USERNAME) {
      data.hostileStructures = this.analyzeHostileStructures(room);
      data.hostileCreeps = this.analyzeHostileCreeps(hostiles);
      data.threatLevel = this.calculateThreatLevel(data.hostileStructures, data.hostileCreeps);
    } else if (!data.owned && !data.reserved) {
      data.threatLevel = "none";
    }

    // Store in memory
    scoutMemory.rooms[roomName] = data;
    scoutMemory.lastUpdate = game.time;

    this.logger.log?.(
      `[ScoutManager] Scouted ${roomName}: ${data.sourceCount} sources, ` +
        `owned=${data.owned}, SK=${data.isSourceKeeper}, hostiles=${data.hostileCount}, threat=${data.threatLevel ?? "unknown"}`
    );

    return data;
  }

  /**
   * Get room data from memory
   */
  public getRoomData(roomName: string, memory: Memory): RemoteRoomData | null {
    this.initializeMemory(memory);
    const scoutMemory = memory.scout as ScoutMemory;
    return scoutMemory.rooms[roomName] ?? null;
  }

  /**
   * Get all scouted rooms
   */
  public getAllRooms(memory: Memory): RemoteRoomData[] {
    this.initializeMemory(memory);
    const scoutMemory = memory.scout as ScoutMemory;

    // Handle corrupted or missing rooms data
    if (!scoutMemory.rooms || typeof scoutMemory.rooms !== "object") {
      scoutMemory.rooms = {};
      return [];
    }

    return Object.values(scoutMemory.rooms);
  }

  /**
   * Find the best remote harvesting target from scouted rooms
   */
  public findBestRemoteTarget(homeRoom: string, memory: Memory, game: GameContext): RemoteRoomData | null {
    const rooms = this.getAllRooms(memory);

    // Filter suitable rooms
    const candidates = rooms.filter(room => {
      // Skip if data is too old
      if (game.time - room.lastScouted > this.scoutDataLifetime) {
        return false;
      }

      // Skip owned rooms (unless it's our own)
      if (room.owned && room.owner !== PLAYER_USERNAME) {
        return false;
      }

      // Skip SK rooms for now (require special handling)
      if (room.isSourceKeeper) {
        return false;
      }

      // Skip if has many hostiles
      if (room.hostileCount > 0) {
        return false;
      }

      // Must have sources
      if (room.sourceCount === 0) {
        return false;
      }

      return true;
    });

    if (candidates.length === 0) {
      return null;
    }

    // Sort by distance (if available) and source count
    candidates.sort((a, b) => {
      const distA = a.pathDistance ?? 999;
      const distB = b.pathDistance ?? 999;

      if (distA !== distB) {
        return distA - distB;
      }

      return b.sourceCount - a.sourceCount;
    });

    return candidates[0];
  }

  /**
   * Clean up old scout data to prevent memory bloat
   */
  public cleanupOldData(memory: Memory, game: GameContext): number {
    this.initializeMemory(memory);
    const scoutMemory = memory.scout as ScoutMemory;

    let removed = 0;
    for (const roomName in scoutMemory.rooms) {
      const room = scoutMemory.rooms[roomName];
      if (game.time - room.lastScouted > this.scoutDataLifetime) {
        delete scoutMemory.rooms[roomName];
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.log?.(`[ScoutManager] Cleaned up ${removed} old room entries`);
    }

    return removed;
  }

  /**
   * Calculate and update path distance from home room to target room
   */
  public updatePathDistance(homeRoom: string, targetRoom: string, memory: Memory): void {
    this.initializeMemory(memory);
    const scoutMemory = memory.scout as ScoutMemory;

    if (!scoutMemory.rooms[targetRoom]) {
      return;
    }

    // Calculate path cost between rooms
    const route = Game.map.findRoute(homeRoom, targetRoom);
    if (route === ERR_NO_PATH) {
      scoutMemory.rooms[targetRoom].pathDistance = 999;
      return;
    }

    scoutMemory.rooms[targetRoom].pathDistance = route.length;
  }

  /**
   * Get rooms that need to be re-scouted (data is old)
   */
  public getRoomsNeedingRescouting(memory: Memory, game: GameContext): string[] {
    this.initializeMemory(memory);
    const scoutMemory = memory.scout as ScoutMemory;

    const needsRescouting: string[] = [];
    for (const roomName in scoutMemory.rooms) {
      const room = scoutMemory.rooms[roomName];
      const age = game.time - room.lastScouted;

      // Re-scout if data is more than half the lifetime
      if (age > this.scoutDataLifetime / 2) {
        needsRescouting.push(roomName);
      }
    }

    return needsRescouting;
  }

  /**
   * Analyze hostile structures in a room for combat assessment
   */
  private analyzeHostileStructures(room: RoomLike): HostileStructures {
    // Use FIND_STRUCTURES and filter for hostile structures manually
    // This is more compatible with test mocks and provides the same results
    const allStructures = room.find(FIND_STRUCTURES) as Structure[];

    const analysis: HostileStructures = {
      towers: 0,
      ramparts: 0,
      walls: 0,
      spawns: 0
    };

    for (const structure of allStructures) {
      // Only count structures owned by other players (not owned by us)
      if ("owner" in structure && structure.owner && structure.owner.username !== PLAYER_USERNAME) {
        switch (structure.structureType) {
          case STRUCTURE_TOWER:
            analysis.towers++;
            break;
          case STRUCTURE_RAMPART:
            analysis.ramparts++;
            break;
          case STRUCTURE_SPAWN:
            analysis.spawns++;
            break;
        }
      } else if (structure.structureType === STRUCTURE_WALL) {
        // Walls don't have owners, so count them all
        analysis.walls++;
      }
    }

    return analysis;
  }

  /**
   * Analyze hostile creep composition for combat assessment
   */
  private analyzeHostileCreeps(hostiles: Creep[]): HostileCreeps {
    const bodyParts: BodyPartCount = {
      attack: 0,
      rangedAttack: 0,
      heal: 0,
      tough: 0,
      work: 0
    };

    let defenders = 0;
    let healers = 0;

    for (const hostile of hostiles) {
      let hasAttack = false;
      let hasHeal = false;

      for (const part of hostile.body) {
        switch (part.type) {
          case ATTACK:
            bodyParts.attack++;
            hasAttack = true;
            break;
          case RANGED_ATTACK:
            bodyParts.rangedAttack++;
            hasAttack = true;
            break;
          case HEAL:
            bodyParts.heal++;
            hasHeal = true;
            break;
          case TOUGH:
            bodyParts.tough++;
            break;
          case WORK:
            bodyParts.work++;
            break;
        }
      }

      if (hasAttack) defenders++;
      if (hasHeal) healers++;
    }

    return {
      defenders,
      healers,
      totalBodyParts: bodyParts
    };
  }

  /**
   * Calculate threat level based on hostile structures and creeps
   */
  private calculateThreatLevel(
    structures: HostileStructures,
    creeps: HostileCreeps
  ): "low" | "medium" | "high" | "extreme" {
    let threatScore = 0;

    // Structure threat scoring
    threatScore += structures.towers * 50; // Towers are very dangerous
    threatScore += structures.spawns * 20; // Spawns indicate established presence
    threatScore += structures.ramparts * 5;
    threatScore += structures.walls * 2;

    // Creep threat scoring
    threatScore += creeps.defenders * 15;
    threatScore += creeps.healers * 20; // Healers significantly increase threat
    threatScore += creeps.totalBodyParts.attack * 8;
    threatScore += creeps.totalBodyParts.rangedAttack * 6;
    threatScore += creeps.totalBodyParts.heal * 10;

    // Classify threat level
    if (threatScore === 0) return "low";
    if (threatScore < 100) return "low";
    if (threatScore < 300) return "medium";
    if (threatScore < 600) return "high";
    return "extreme";
  }
}
