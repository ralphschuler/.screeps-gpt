import type { GameContext, RoomLike } from "@runtime/types/GameContext";
import { BasePlanner } from "@runtime/planning/BasePlanner";

interface RoomConstructionState {
  planner: BasePlanner;
  lastPlannedRCL: number;
}

/**
 * Configuration options for ConstructionManager.
 */
export interface ConstructionManagerConfig {
  /** Logger instance (default: console) */
  logger?: Pick<Console, "log" | "warn">;
  /** Maximum construction sites to create per tick (default: 5) */
  maxSitesPerTick?: number;
  /** Maximum construction sites per room per tick (default: 1) */
  maxSitesPerRoom?: number;
  /** Enable visualization for all rooms (default: false) */
  enableVisualization?: boolean;
}

/**
 * Manages automatic construction site creation for all owned rooms.
 * Uses BasePlanner to determine optimal structure placement.
 * Uses dynamic layout that can identify and handle misplaced structures.
 */
export class ConstructionManager {
  private readonly roomPlanners: Map<string, RoomConstructionState> = new Map();
  private readonly maxSitesPerTick: number;
  private readonly maxSitesPerRoom: number;
  private readonly findMySpawns: FindConstant;
  private readonly findStructures: FindConstant;
  private readonly findConstructionSites: FindConstant;
  private readonly okCode: number;
  private readonly errFull: number;
  private readonly errRclNotEnough: number;
  private readonly enableVisualization: boolean;
  private readonly logger: Pick<Console, "log" | "warn">;

  /**
   * Create a ConstructionManager.
   *
   * @param configOrLogger - Config object or legacy logger argument
   * @param maxSitesPerTick - (Legacy) Maximum sites per tick
   * @param maxSitesPerRoom - (Legacy) Maximum sites per room per tick
   * @param findMySpawns - (Legacy) FindConstant for spawns
   * @param findStructures - (Legacy) FindConstant for structures
   * @param findConstructionSites - (Legacy) FindConstant for construction sites
   * @param okCode - (Legacy) OK return code
   * @param errFull - (Legacy) ERR_FULL return code
   * @param errRclNotEnough - (Legacy) ERR_RCL_NOT_ENOUGH return code
   */
  public constructor(
    configOrLogger: ConstructionManagerConfig | Pick<Console, "log" | "warn"> = {},
    maxSitesPerTick?: number,
    maxSitesPerRoom?: number,
    findMySpawns?: FindConstant,
    findStructures?: FindConstant,
    findConstructionSites?: FindConstant,
    okCode?: number,
    errFull?: number,
    errRclNotEnough?: number
  ) {
    // Detect if using legacy positional arguments
    // Legacy signature: (logger, maxSitesPerTick, maxSitesPerRoom, findMySpawns, ...)
    // New signature: (config) where config is { logger?, maxSitesPerTick?, ... }
    //
    // Detection logic:
    // - If configOrLogger has config-specific keys (enableVisualization, maxSitesPerTick, maxSitesPerRoom)
    //   it's a new-style config object
    // - If configOrLogger only has log/warn methods and maxSitesPerTick is provided as second arg,
    //   it's a legacy call
    const hasConfigKeys =
      configOrLogger !== null &&
      typeof configOrLogger === "object" &&
      ("enableVisualization" in configOrLogger ||
        "maxSitesPerTick" in configOrLogger ||
        "maxSitesPerRoom" in configOrLogger);

    const isLegacyCall =
      !hasConfigKeys &&
      configOrLogger !== null &&
      typeof configOrLogger === "object" &&
      (typeof (configOrLogger as Pick<Console, "log" | "warn">).log === "function" ||
        typeof (configOrLogger as Pick<Console, "log" | "warn">).warn === "function") &&
      maxSitesPerTick !== undefined;

    if (isLegacyCall) {
      // Legacy constructor signature
      this.logger = configOrLogger as Pick<Console, "log" | "warn">;
      this.maxSitesPerTick = maxSitesPerTick ?? 5;
      this.maxSitesPerRoom = maxSitesPerRoom ?? 1;
      this.findMySpawns = findMySpawns ?? (typeof FIND_MY_SPAWNS !== "undefined" ? FIND_MY_SPAWNS : 104);
      this.findStructures = findStructures ?? (typeof FIND_STRUCTURES !== "undefined" ? FIND_STRUCTURES : 107);
      this.findConstructionSites =
        findConstructionSites ?? (typeof FIND_MY_CONSTRUCTION_SITES !== "undefined" ? FIND_MY_CONSTRUCTION_SITES : 114);
      this.okCode = okCode ?? (typeof OK !== "undefined" ? OK : 0);
      this.errFull = errFull ?? (typeof ERR_FULL !== "undefined" ? ERR_FULL : -8);
      this.errRclNotEnough = errRclNotEnough ?? (typeof ERR_RCL_NOT_ENOUGH !== "undefined" ? ERR_RCL_NOT_ENOUGH : -14);
      this.enableVisualization = false;
    } else {
      // New config object signature
      const config = configOrLogger as ConstructionManagerConfig;
      this.logger = config.logger ?? console;
      this.maxSitesPerTick = config.maxSitesPerTick ?? 5;
      this.maxSitesPerRoom = config.maxSitesPerRoom ?? 1;
      this.enableVisualization = config.enableVisualization ?? false;
      this.findMySpawns = typeof FIND_MY_SPAWNS !== "undefined" ? FIND_MY_SPAWNS : 104;
      this.findStructures = typeof FIND_STRUCTURES !== "undefined" ? FIND_STRUCTURES : 107;
      this.findConstructionSites = typeof FIND_MY_CONSTRUCTION_SITES !== "undefined" ? FIND_MY_CONSTRUCTION_SITES : 114;
      this.okCode = typeof OK !== "undefined" ? OK : 0;
      this.errFull = typeof ERR_FULL !== "undefined" ? ERR_FULL : -8;
      this.errRclNotEnough = typeof ERR_RCL_NOT_ENOUGH !== "undefined" ? ERR_RCL_NOT_ENOUGH : -14;
    }
  }

  /**
   * Get layout statistics for a room.
   *
   * @param roomName - Room to get stats for
   * @param rcl - RCL to calculate stats for (default: 8)
   * @returns Layout statistics or null if room not planned
   */
  public getRoomLayoutStats(roomName: string, rcl: number = 8): ReturnType<BasePlanner["getLayoutStats"]> | null {
    const state = this.roomPlanners.get(roomName);
    if (!state) {
      return null;
    }
    return state.planner.getLayoutStats(rcl);
  }

  /**
   * Check all owned rooms and create construction sites as needed
   */
  public planConstructionSites(game: GameContext): number {
    let sitesCreated = 0;

    for (const roomName in game.rooms) {
      const room = game.rooms[roomName];

      // Only plan for rooms we own
      if (!room.controller?.my) {
        continue;
      }

      const created = this.planRoomConstruction(room);
      sitesCreated += created;

      // Limit total construction sites created per tick to avoid CPU spikes
      if (sitesCreated >= this.maxSitesPerTick) {
        break;
      }
    }

    return sitesCreated;
  }

  /**
   * Plan and create construction sites for a single room
   */
  private planRoomConstruction(room: RoomLike): number {
    const controller = room.controller;
    if (!controller?.my) {
      return 0;
    }

    const currentRCL = controller.level;

    // Get or create planner for this room
    let state = this.roomPlanners.get(room.name);
    if (!state) {
      state = {
        planner: new BasePlanner(room.name, {
          enableVisualization: this.enableVisualization
        }),
        lastPlannedRCL: 0
      };
      this.roomPlanners.set(room.name, state);
    }

    // Only replan if RCL has changed
    if (state.lastPlannedRCL === currentRCL) {
      return 0;
    }

    const terrain = room.getTerrain();
    const missing = state.planner.getMissingStructures(
      room,
      terrain,
      currentRCL,
      this.findMySpawns,
      this.findStructures,
      this.findConstructionSites
    );

    let sitesCreated = 0;
    for (const structure of missing) {
      // Limit sites per room
      if (sitesCreated >= this.maxSitesPerRoom) {
        break;
      }

      const result = room.createConstructionSite(structure.pos.x, structure.pos.y, structure.type);

      if (result === this.okCode) {
        sitesCreated++;
        this.logger.log?.(
          `[ConstructionManager] Created ${structure.type} site at ${room.name} (${structure.pos.x},${structure.pos.y})`
        );
      } else if (result !== this.errFull && result !== this.errRclNotEnough) {
        // Only log if it's not a common expected error
        this.logger.warn?.(`[ConstructionManager] Failed to create ${structure.type} at ${room.name}: ${result}`);
      }
    }

    // Only mark RCL as planned when all structures are built or queued
    // This ensures we continue planning across multiple ticks when maxSitesPerTick limits us
    if (missing.length === 0) {
      state.lastPlannedRCL = currentRCL;
    } else if (sitesCreated === 0 && missing.length > 0) {
      // If we couldn't create any sites but structures are missing,
      // still mark as planned to avoid infinite retries (e.g., all missing sites on walls)
      state.lastPlannedRCL = currentRCL;
    }

    return sitesCreated;
  }

  /**
   * Get misplaced structures for a room that should be removed.
   * This enables dynamic layout management by identifying structures
   * that are not in planned positions.
   *
   * @param room - Room to check for misplaced structures
   * @returns Array of misplaced structures with reasons
   */
  public getMisplacedStructures(room: RoomLike): ReturnType<BasePlanner["getMisplacedStructures"]> {
    const state = this.roomPlanners.get(room.name);
    if (!state) {
      return [];
    }

    const terrain = room.getTerrain();
    const currentRCL = room.controller?.level ?? 0;

    return state.planner.getMisplacedStructures(room, terrain, currentRCL, this.findMySpawns, this.findStructures);
  }

  /**
   * Check and optionally destroy misplaced structures in a room.
   * This method identifies structures not in planned positions and can remove them.
   *
   * @param room - Room to check for misplaced structures
   * @param destroyMisplaced - If true, destroy misplaced structures (default: false)
   * @returns Object with misplaced structures and count of destroyed structures
   */
  public handleMisplacedStructures(
    room: RoomLike,
    destroyMisplaced: boolean = false
  ): { misplaced: ReturnType<BasePlanner["getMisplacedStructures"]>; destroyed: number } {
    const misplaced = this.getMisplacedStructures(room);
    let destroyed = 0;

    if (destroyMisplaced && misplaced.length > 0) {
      for (const item of misplaced) {
        // Only destroy if structure is player-owned and has a destroy method
        const structure = item.structure as Structure & { my?: boolean; destroy?: () => number };
        if (structure.my && typeof structure.destroy === "function") {
          const result = structure.destroy();
          if (result === this.okCode) {
            destroyed++;
            this.logger.log?.(
              `[ConstructionManager] Destroyed misplaced ${item.structure.structureType} at ${room.name} (${item.structure.pos.x},${item.structure.pos.y}): ${item.reason}`
            );
          } else {
            this.logger.warn?.(
              `[ConstructionManager] Failed to destroy ${item.structure.structureType} at ${room.name}: ${result}`
            );
          }
        }
      }
    }

    return { misplaced, destroyed };
  }

  /**
   * Reset planning state for a room (useful when room is lost/reclaimed)
   */
  public resetRoom(roomName: string): void {
    this.roomPlanners.delete(roomName);
  }

  /**
   * Visualize planned layouts for all managed rooms.
   *
   * @param game - Game context with rooms
   * @param rcl - RCL to show layouts for (default: current room RCL)
   * @param showLabels - Show structure type labels (default: false)
   * @returns Total structures visualized across all rooms
   */
  public visualizeAll(game: GameContext, rcl?: number, showLabels: boolean = false): number {
    let totalVisualized = 0;

    for (const [roomName, state] of this.roomPlanners) {
      const room = game.rooms[roomName];
      if (!room?.visual) {
        continue;
      }

      const targetRCL = rcl ?? room.controller?.level ?? 8;
      totalVisualized += state.planner.visualize(room, targetRCL, showLabels);
    }

    return totalVisualized;
  }

  /**
   * Get the BasePlanner for a specific room.
   *
   * @param roomName - Room name to get planner for
   * @returns BasePlanner instance or undefined if room not managed
   */
  public getPlanner(roomName: string): BasePlanner | undefined {
    return this.roomPlanners.get(roomName)?.planner;
  }
}
