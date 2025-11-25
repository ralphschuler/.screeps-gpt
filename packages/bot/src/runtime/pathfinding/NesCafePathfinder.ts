/**
 * Pathfinding implementation using screeps-pathfinding library by NesCafe62
 * @see https://github.com/NesCafe62/screeps-pathfinding
 *
 * This provides advanced traffic management, priority-based movement,
 * and optimized pathfinding with features like:
 * - Traffic management (push creeps out of the way or swap with them)
 * - Priority option (higher priority moves execute first)
 * - Move off exit behavior
 * - Fix path for heuristicWeight > 1
 * - Terrain and cost matrix caching
 */
import type { PathfindingOptions, PathfindingProvider, PathfindingResult } from "./PathfindingProvider";
import { PathCache } from "./PathCache";

/**
 * Extended options specific to screeps-pathfinding
 */
export interface NesCafePathfindingOptions extends PathfindingOptions {
  /** Priority for creep movement (higher priority moves first, default: 0) */
  priority?: number;
  /** Forces path finish position to be on non-exit tile (default: true) */
  moveOffExit?: boolean;
  /** Try to move creep off road when finished moving (default: false) */
  moveOffRoad?: boolean;
  /** Treat containers as roads for moveOffRoad (default: true) */
  moveOffContainer?: boolean;
  /** Use find route for long-range movement (default: true) */
  findRoute?: boolean;
  /** Ignore structures when pathfinding (default: false) */
  ignoreStructures?: boolean;
  /** Ignore roads when pathfinding (default: false) */
  ignoreRoads?: boolean;
  /** Prefer off-road movement (default: false) */
  offRoads?: boolean;
  /** Ignore tunnels when pathfinding (default: false) */
  ignoreTunnels?: boolean;
  /** Ignore containers when pathfinding (default: false) */
  ignoreContainers?: boolean;
  /** Cost for walking on containers (default: 5) */
  containerCost?: number;
  /** Route callback for find route between rooms */
  routeCallback?: (roomName: string) => number;
  /** Heuristic weight for pathfinding (default: 1.2) */
  heuristicWeight?: number;
  /** Fix path for heuristicWeight > 1 (default: true) */
  fixPath?: boolean;
  /** Allow incomplete path (default: true) */
  allowIncomplete?: boolean;
  /** Maximum cost for pathfinding */
  maxCost?: number;
  /** Flee from target instead of moving towards it */
  flee?: boolean;
  /** Rooms to avoid globally */
  avoidRooms?: string[];
  /** Visualize path style */
  visualizePathStyle?: PolyStyle;
  /** Event callback when creep enters a new room */
  onRoomEnter?: (creep: Creep, roomName: string) => void;
}

/**
 * Interface for the screeps-pathfinding PathingManager class
 * This describes the API exposed by the library
 */
interface IPathingManager {
  moveTo(creep: Creep, target: RoomPosition | { pos: RoomPosition }, options?: NesCafePathfindingOptions): number;
  moveOffRoad(
    creep: Creep,
    options?: { priority?: number; moveOffContainer?: boolean; moveOffExit?: boolean }
  ): boolean;
  findPath(
    startPos: RoomPosition,
    targetPos: RoomPosition,
    options?: NesCafePathfindingOptions
  ): {
    path: RoomPosition[];
    ops: number;
    cost: number;
    incomplete: boolean;
  };
  runMoves(): void;
  runMovesRoom(roomName: string): void;
  reservePos(pos: RoomPosition, priority: number): number;
  clearMatrixCache(): void;
  clearMatrixCacheRoom(roomName: string): void;
  getMoveDirection(creep: Creep): DirectionConstant | undefined;
  getCreepPath(creep: Creep): string | undefined;
}

/**
 * Interface for utility functions from pathing.utils
 */
interface IPathingUtils {
  isPosExit(pos: { x: number; y: number }): boolean;
  isPosEqual(pos1: RoomPosition, pos2: RoomPosition): boolean;
  getRange(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number;
  lookInRange<T extends keyof AllLookAtTypes>(
    pos: RoomPosition,
    room: Room,
    lookType: T,
    range: number
  ): LookForAtAreaResultArray<AllLookAtTypes[T], T>;
}

// Custom return codes from screeps-pathfinding
const IN_RANGE = 1;
const IN_ROOM = 2;

/**
 * Advanced pathfinding implementation using screeps-pathfinding library
 * Provides priority-based movement and traffic management
 *
 * @param pathCache - Shared PathCache instance. Required to prevent cache fragmentation.
 */
export class NesCafePathfinder implements PathfindingProvider {
  private readonly pathCache: PathCache;
  private pathingManager: IPathingManager | null = null;
  private pathingUtils: IPathingUtils | null = null;
  private initialized = false;
  private initError: Error | null = null;

  public constructor(pathCache: PathCache) {
    this.pathCache = pathCache;
  }

  /**
   * Lazy initialization of the pathfinding manager
   * This is done lazily because the library depends on Screeps globals
   */
  private ensureInitialized(): boolean {
    if (this.initialized) {
      return this.pathingManager !== null;
    }

    this.initialized = true;

    try {
      // screeps-pathfinding is a CommonJS module that exports the PathingManager instance
      // It also sets global.Pathing and extends Creep/PowerCreep prototypes
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.pathingManager = require("screeps-pathfinding") as IPathingManager;

      // Load utility functions
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.pathingUtils = require("screeps-pathfinding/pathing.utils") as IPathingUtils;

      return true;
    } catch (error) {
      this.initError = error instanceof Error ? error : new Error(String(error));
      console.log(`[NesCafePathfinder] Failed to load screeps-pathfinding: ${this.initError.message}`);
      return false;
    }
  }

  public getName(): string {
    return "nescafe";
  }

  /**
   * Check if the library was successfully loaded
   */
  public isAvailable(): boolean {
    return this.ensureInitialized();
  }

  /**
   * Get the initialization error if any
   */
  public getInitError(): Error | null {
    return this.initError;
  }

  public findPath(
    origin: RoomPosition,
    goal: RoomPosition | { pos: RoomPosition },
    opts: NesCafePathfindingOptions = {}
  ): PathfindingResult {
    const goalPos = goal instanceof RoomPosition ? goal : goal.pos;
    const range = opts.range ?? 1;
    const currentTick = Game.time;

    // Check cache first
    const cached = this.pathCache.getPath(origin, goalPos, currentTick, { range });
    if (cached && !cached.incomplete) {
      return {
        path: cached.path,
        ops: cached.ops,
        cost: 0, // Cache hit has minimal CPU cost
        incomplete: false
      };
    }

    // Ensure library is loaded
    if (!this.ensureInitialized() || !this.pathingManager) {
      // Fallback to native PathFinder if library fails to load
      return this.fallbackFindPath(origin, goalPos, opts);
    }

    // Cache miss - perform pathfinding
    const cpuStart = Game.cpu.getUsed();

    const result = this.pathingManager.findPath(origin, goalPos, {
      ...opts,
      range
    });

    const cpuCost = Game.cpu.getUsed() - cpuStart;

    // Cache successful paths
    if (!result.incomplete) {
      this.pathCache.setPath(origin, goalPos, result.path, currentTick, {
        ops: result.ops,
        cpuCost,
        incomplete: result.incomplete,
        range
      });
    }

    return {
      path: result.path,
      ops: result.ops,
      cost: cpuCost,
      incomplete: result.incomplete
    };
  }

  /**
   * Fallback to native PathFinder when screeps-pathfinding is not available
   */
  private fallbackFindPath(origin: RoomPosition, goalPos: RoomPosition, opts: PathfindingOptions): PathfindingResult {
    const cpuStart = Game.cpu.getUsed();
    const range = opts.range ?? 1;
    const currentTick = Game.time;

    const result = PathFinder.search(
      origin,
      { pos: goalPos, range },
      {
        roomCallback: opts.costCallback,
        plainCost: opts.plainCost,
        swampCost: opts.swampCost,
        maxOps: opts.maxOps,
        maxRooms: opts.maxRooms
      }
    );

    const cpuCost = Game.cpu.getUsed() - cpuStart;

    // Cache successful paths (same as main findPath)
    if (!result.incomplete) {
      this.pathCache.setPath(origin, goalPos, result.path, currentTick, {
        ops: result.ops,
        cpuCost,
        incomplete: result.incomplete,
        range
      });
    }

    return {
      path: result.path,
      ops: result.ops,
      cost: cpuCost,
      incomplete: result.incomplete
    };
  }

  public moveTo(
    creep: Creep,
    target: RoomPosition | { pos: RoomPosition },
    opts: NesCafePathfindingOptions = {}
  ): ScreepsReturnCode {
    const targetPos = target instanceof RoomPosition ? target : target.pos;

    // Ensure library is loaded
    if (!this.ensureInitialized() || !this.pathingManager) {
      // Fallback to native moveTo
      return creep.moveTo(targetPos, {
        range: opts.range,
        reusePath: opts.reusePath,
        ignoreCreeps: opts.ignoreCreeps,
        maxRooms: opts.maxRooms,
        maxOps: opts.maxOps,
        costCallback: opts.costCallback,
        plainCost: opts.plainCost,
        swampCost: opts.swampCost
      });
    }

    // Use screeps-pathfinding's moveTo
    const result = this.pathingManager.moveTo(creep, target, {
      range: opts.range ?? 1,
      priority: opts.priority ?? 0,
      moveOffExit: opts.moveOffExit,
      moveOffRoad: opts.moveOffRoad,
      findRoute: opts.findRoute,
      ignoreRoads: opts.ignoreRoads,
      offRoads: opts.offRoads,
      ignoreContainers: opts.ignoreContainers,
      containerCost: opts.containerCost,
      heuristicWeight: opts.heuristicWeight,
      fixPath: opts.fixPath,
      allowIncomplete: opts.allowIncomplete,
      maxOps: opts.maxOps,
      maxRooms: opts.maxRooms,
      maxCost: opts.maxCost,
      flee: opts.flee,
      avoidRooms: opts.avoidRooms,
      visualizePathStyle: opts.visualizePathStyle,
      costCallback: opts.costCallback,
      routeCallback: opts.routeCallback,
      plainCost: opts.plainCost,
      swampCost: opts.swampCost
    });

    // Map screeps-pathfinding result codes to Screeps return codes
    if (result === IN_RANGE) {
      return OK; // Treat IN_RANGE as successful (creep is at destination)
    }
    if (result === IN_ROOM) {
      return OK; // Treat IN_ROOM as successful (creep is in target room)
    }

    return result as ScreepsReturnCode;
  }

  /**
   * Run all scheduled moves for the current tick
   * Must be called at the end of each tick to execute traffic management
   */
  public runMoves(): void {
    if (this.ensureInitialized() && this.pathingManager) {
      this.pathingManager.runMoves();
    }
  }

  /**
   * Run moves for a specific room only
   * @param roomName - The room to process moves for
   */
  public runMovesRoom(roomName: string): void {
    if (this.ensureInitialized() && this.pathingManager) {
      this.pathingManager.runMovesRoom(roomName);
    }
  }

  /**
   * Move creep off road if currently on one
   * @param creep - The creep to move
   * @param options - Movement options
   * @returns true if creep is on road and move was scheduled
   */
  public moveOffRoad(
    creep: Creep,
    options: {
      target?: RoomPosition;
      range?: number;
      priority?: number;
      moveOffContainer?: boolean;
      moveOffExit?: boolean;
    } = {}
  ): boolean {
    if (this.ensureInitialized() && this.pathingManager) {
      return this.pathingManager.moveOffRoad(creep, options);
    }
    return false;
  }

  /**
   * Reserve a position for priority-based movement
   * @param pos - The position to reserve
   * @param priority - Priority for the reservation
   */
  public reservePos(pos: RoomPosition, priority: number): ScreepsReturnCode {
    if (this.ensureInitialized() && this.pathingManager) {
      return this.pathingManager.reservePos(pos, priority) as ScreepsReturnCode;
    }
    return ERR_NOT_FOUND;
  }

  /**
   * Get the direction a creep is planned to move
   * @param creep - The creep to check
   * @returns Direction constant or undefined if no move planned
   */
  public getMoveDirection(creep: Creep): DirectionConstant | undefined {
    if (this.ensureInitialized() && this.pathingManager) {
      return this.pathingManager.getMoveDirection(creep);
    }
    return undefined;
  }

  /**
   * Get the serialized path for a creep
   * @param creep - The creep to get path for
   * @returns Serialized path string or undefined
   */
  public getCreepPath(creep: Creep): string | undefined {
    if (this.ensureInitialized() && this.pathingManager) {
      return this.pathingManager.getCreepPath(creep);
    }
    return undefined;
  }

  /**
   * Clear the internal cost matrix cache
   */
  public clearMatrixCache(): void {
    if (this.ensureInitialized() && this.pathingManager) {
      this.pathingManager.clearMatrixCache();
    }
  }

  /**
   * Clear cost matrix cache for a specific room
   * @param roomName - The room to clear cache for
   */
  public clearMatrixCacheRoom(roomName: string): void {
    if (this.ensureInitialized() && this.pathingManager) {
      this.pathingManager.clearMatrixCacheRoom(roomName);
    }
  }

  /**
   * Check if a position is on the room edge (exit tile)
   */
  public isPosExit(pos: { x: number; y: number }): boolean {
    if (this.ensureInitialized() && this.pathingUtils) {
      return this.pathingUtils.isPosExit(pos);
    }
    // Fallback implementation
    const { x, y } = pos;
    return x <= 0 || y <= 0 || x >= 49 || y >= 49;
  }
}
