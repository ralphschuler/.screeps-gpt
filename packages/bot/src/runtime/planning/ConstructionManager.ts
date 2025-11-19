import type { GameContext, RoomLike } from "@runtime/types/GameContext";
import { BasePlanner } from "@runtime/planning/BasePlanner";

interface RoomConstructionState {
  planner: BasePlanner;
  lastPlannedRCL: number;
}

/**
 * Manages automatic construction site creation for all owned rooms.
 * Uses BasePlanner to determine optimal structure placement.
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

  public constructor(
    private readonly logger: Pick<Console, "log" | "warn"> = console,
    maxSitesPerTick: number = 5,
    maxSitesPerRoom: number = 1,
    findMySpawns?: FindConstant,
    findStructures?: FindConstant,
    findConstructionSites?: FindConstant,
    okCode?: number,
    errFull?: number,
    errRclNotEnough?: number
  ) {
    this.maxSitesPerTick = maxSitesPerTick;
    this.maxSitesPerRoom = maxSitesPerRoom;
    // Use lazy evaluation - only access global constants if not provided
    this.findMySpawns = findMySpawns ?? (typeof FIND_MY_SPAWNS !== "undefined" ? FIND_MY_SPAWNS : 104);
    this.findStructures = findStructures ?? (typeof FIND_STRUCTURES !== "undefined" ? FIND_STRUCTURES : 107);
    this.findConstructionSites =
      findConstructionSites ?? (typeof FIND_MY_CONSTRUCTION_SITES !== "undefined" ? FIND_MY_CONSTRUCTION_SITES : 114);
    this.okCode = okCode ?? (typeof OK !== "undefined" ? OK : 0);
    this.errFull = errFull ?? (typeof ERR_FULL !== "undefined" ? ERR_FULL : -8);
    this.errRclNotEnough = errRclNotEnough ?? (typeof ERR_RCL_NOT_ENOUGH !== "undefined" ? ERR_RCL_NOT_ENOUGH : -14);
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
        planner: new BasePlanner(room.name),
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
   * Reset planning state for a room (useful when room is lost/reclaimed)
   */
  public resetRoom(roomName: string): void {
    this.roomPlanners.delete(roomName);
  }
}
