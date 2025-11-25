import { NesCafePathfinder, type NesCafePathfindingOptions } from "./NesCafePathfinder";
import { PathCache, type PathCacheConfig, type PathCacheMetrics } from "./PathCache";

/**
 * Configuration for pathfinding system
 */
export interface PathfindingConfig {
  /** Whether to enable path caching (default: true) */
  enableCaching?: boolean;
  /** Configuration for path cache */
  cacheConfig?: PathCacheConfig;
  /** Logger for debugging */
  logger?: Pick<Console, "log" | "warn">;
}

/**
 * Central manager for pathfinding operations
 * Uses screeps-pathfinding library for advanced traffic management and priority-based movement
 * @see https://github.com/NesCafe62/screeps-pathfinding
 *
 * Key features:
 * - Traffic management (push creeps out of the way or swap with them)
 * - Priority-based movement (higher priority moves execute first)
 * - Move off exit behavior
 * - Terrain and cost matrix caching
 *
 * Usage:
 * 1. Call moveTo() for each creep during your tick
 * 2. Call runMoves() at the end of your tick to execute all scheduled moves
 */
export class PathfindingManager {
  private readonly provider: NesCafePathfinder;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly enableCaching: boolean;
  private readonly pathCache: PathCache | null;

  public constructor(config: PathfindingConfig = {}) {
    this.logger = config.logger ?? console;
    this.enableCaching = config.enableCaching ?? true;

    // Initialize path cache if enabled
    this.pathCache = this.enableCaching ? new PathCache(config.cacheConfig) : null;

    // Initialize the NesCafe pathfinding provider
    const cache = this.pathCache ?? new PathCache();
    this.provider = new NesCafePathfinder(cache);

    this.logger.log?.(`PathfindingManager initialized with provider: ${this.provider.getName()}`);
  }

  /**
   * Move a creep to a target using the pathfinding provider
   * Note: For traffic management to work properly, call runMoves() at the end of each tick
   *
   * @param creep - The creep to move
   * @param target - Target position or object with pos property
   * @param opts - Pathfinding options including priority for traffic management
   */
  public moveTo(
    creep: Creep,
    target: RoomPosition | { pos: RoomPosition },
    opts: NesCafePathfindingOptions = {}
  ): ScreepsReturnCode {
    // Apply default reusePath if caching is enabled and not specified
    const options: NesCafePathfindingOptions = {
      ...opts,
      reusePath: this.enableCaching && opts.reusePath === undefined ? 5 : opts.reusePath
    };

    return this.provider.moveTo(creep, target, options);
  }

  /**
   * Find a path from origin to goal
   */
  public findPath(
    origin: RoomPosition,
    goal: RoomPosition | { pos: RoomPosition },
    opts: NesCafePathfindingOptions = {}
  ) {
    return this.provider.findPath(origin, goal, opts);
  }

  /**
   * Run all scheduled moves for the current tick
   * This enables traffic management - higher priority creeps will move first,
   * and lower priority creeps will be pushed out of the way
   *
   * Must be called at the end of each tick after all moveTo() calls
   */
  public runMoves(): void {
    this.provider.runMoves();
  }

  /**
   * Run moves for a specific room only
   * Useful for processing rooms individually
   *
   * @param roomName - The room to process moves for
   */
  public runMovesRoom(roomName: string): void {
    this.provider.runMovesRoom(roomName);
  }

  /**
   * Move creep off road if currently standing on one
   * Useful for creeps that are working and should not block roads
   *
   * @param creep - The creep to move
   * @param options - Movement options
   * @returns true if creep is on road and move was scheduled
   */
  public moveOffRoad(
    creep: Creep,
    options?: {
      target?: RoomPosition;
      range?: number;
      priority?: number;
      moveOffContainer?: boolean;
      moveOffExit?: boolean;
    }
  ): boolean {
    return this.provider.moveOffRoad(creep, options);
  }

  /**
   * Reserve a position for priority-based movement
   * Prevents other creeps from moving to this position
   *
   * @param pos - The position to reserve
   * @param priority - Priority for the reservation
   */
  public reservePos(pos: RoomPosition, priority: number): ScreepsReturnCode {
    return this.provider.reservePos(pos, priority);
  }

  /**
   * Get the direction a creep is planned to move this tick
   *
   * @param creep - The creep to check
   * @returns Direction constant or undefined if no move planned
   */
  public getMoveDirection(creep: Creep): DirectionConstant | undefined {
    return this.provider.getMoveDirection(creep);
  }

  /**
   * Get the serialized path for a creep
   *
   * @param creep - The creep to get path for
   * @returns Serialized path string or undefined
   */
  public getCreepPath(creep: Creep): string | undefined {
    return this.provider.getCreepPath(creep);
  }

  /**
   * Clear the internal cost matrix cache
   * Call when room structures change significantly
   */
  public clearMatrixCache(): void {
    this.provider.clearMatrixCache();
  }

  /**
   * Clear cost matrix cache for a specific room
   *
   * @param roomName - The room to clear cache for
   */
  public clearMatrixCacheRoom(roomName: string): void {
    this.provider.clearMatrixCacheRoom(roomName);
  }

  /**
   * Check if a position is on the room edge (exit tile)
   *
   * @param pos - Position to check
   */
  public isPosExit(pos: { x: number; y: number }): boolean {
    return this.provider.isPosExit(pos);
  }

  /**
   * Get the name of the current pathfinding provider
   */
  public getProviderName(): string {
    return this.provider.getName();
  }

  /**
   * Check if the pathfinding library is available
   * Returns false if screeps-pathfinding failed to load
   */
  public isAvailable(): boolean {
    return this.provider.isAvailable();
  }

  /**
   * Get cache metrics (if caching is enabled)
   * @returns Cache metrics or null if caching is disabled
   */
  public getCacheMetrics(): PathCacheMetrics | null {
    return this.pathCache?.getMetrics() ?? null;
  }

  /**
   * Reset cache metrics
   * Note: Silently does nothing if caching is disabled
   */
  public resetCacheMetrics(): void {
    this.pathCache?.resetMetrics();
  }

  /**
   * Invalidate all cached paths in a specific room
   * Note: Silently does nothing if caching is disabled
   */
  public invalidateRoom(roomName: string): void {
    this.pathCache?.invalidateRoom(roomName);
  }

  /**
   * Invalidate structure-based caches for a room
   * (call this when structures are built/destroyed)
   * Note: Silently does nothing if caching is disabled
   */
  public invalidateStructures(roomName: string): void {
    this.pathCache?.invalidateStructures(roomName);
  }

  /**
   * Clear all caches
   * Note: Silently does nothing if caching is disabled
   */
  public clearCache(): void {
    this.pathCache?.clear();
  }
}
