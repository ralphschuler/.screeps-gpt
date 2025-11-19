import type { PathfindingOptions, PathfindingProvider } from "./PathfindingProvider";
import { DefaultPathfinder } from "./DefaultPathfinder";
import { CartographerPathfinder } from "./CartographerPathfinder";
import { PathCache, type PathCacheConfig, type PathCacheMetrics } from "./PathCache";

/**
 * Configuration for pathfinding system
 */
export interface PathfindingConfig {
  /** Pathfinding provider to use: "default" or "cartographer" (default: "default") */
  provider?: "default" | "cartographer";
  /** Whether to enable path caching (default: true) */
  enableCaching?: boolean;
  /** Configuration for path cache */
  cacheConfig?: PathCacheConfig;
  /** Logger for debugging */
  logger?: Pick<Console, "log" | "warn">;
}

/**
 * Central manager for pathfinding operations
 * Provides abstraction layer over different pathfinding implementations
 */
export class PathfindingManager {
  private readonly provider: PathfindingProvider;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly enableCaching: boolean;
  private readonly pathCache: PathCache | null;

  public constructor(config: PathfindingConfig = {}) {
    this.logger = config.logger ?? console;
    this.enableCaching = config.enableCaching ?? true;

    // Initialize path cache if enabled
    this.pathCache = this.enableCaching ? new PathCache(config.cacheConfig) : null;

    // Initialize selected provider
    const providerName = config.provider ?? "default";
    this.provider = this.createProvider(providerName);

    this.logger.log?.(`PathfindingManager initialized with provider: ${this.provider.getName()}`);
  }

  /**
   * Create pathfinding provider based on configuration
   */
  private createProvider(providerName: "default" | "cartographer"): PathfindingProvider {
    switch (providerName) {
      case "cartographer":
        return new CartographerPathfinder(this.pathCache ?? undefined);
      case "default":
      default:
        return new DefaultPathfinder(this.pathCache ?? undefined);
    }
  }

  /**
   * Move a creep to a target using the configured pathfinding provider
   */
  public moveTo(
    creep: Creep,
    target: RoomPosition | { pos: RoomPosition },
    opts: PathfindingOptions = {}
  ): ScreepsReturnCode {
    // Apply default reusePath if caching is enabled and not specified
    const options: PathfindingOptions = {
      ...opts,
      reusePath: this.enableCaching && opts.reusePath === undefined ? 5 : opts.reusePath
    };

    return this.provider.moveTo(creep, target, options);
  }

  /**
   * Find a path from origin to goal
   */
  public findPath(origin: RoomPosition, goal: RoomPosition | { pos: RoomPosition }, opts: PathfindingOptions = {}) {
    return this.provider.findPath(origin, goal, opts);
  }

  /**
   * Get the name of the current pathfinding provider
   */
  public getProviderName(): string {
    return this.provider.getName();
  }

  /**
   * Get cache metrics (if caching is enabled)
   */
  public getCacheMetrics(): PathCacheMetrics | null {
    return this.pathCache?.getMetrics() ?? null;
  }

  /**
   * Reset cache metrics
   */
  public resetCacheMetrics(): void {
    this.pathCache?.resetMetrics();
  }

  /**
   * Invalidate all cached paths in a specific room
   */
  public invalidateRoom(roomName: string): void {
    this.pathCache?.invalidateRoom(roomName);
  }

  /**
   * Invalidate structure-based caches for a room
   * (call this when structures are built/destroyed)
   */
  public invalidateStructures(roomName: string): void {
    this.pathCache?.invalidateStructures(roomName);
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.pathCache?.clear();
  }
}
