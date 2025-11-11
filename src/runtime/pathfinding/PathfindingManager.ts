import type { PathfindingOptions, PathfindingProvider } from "./PathfindingProvider";
import { DefaultPathfinder } from "./DefaultPathfinder";
import { CartographerPathfinder } from "./CartographerPathfinder";

/**
 * Configuration for pathfinding system
 */
export interface PathfindingConfig {
  /** Pathfinding provider to use: "default" or "cartographer" (default: "default") */
  provider?: "default" | "cartographer";
  /** Whether to enable path caching (default: true) */
  enableCaching?: boolean;
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

  public constructor(config: PathfindingConfig = {}) {
    this.logger = config.logger ?? console;
    this.enableCaching = config.enableCaching ?? true;

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
        return new CartographerPathfinder();
      case "default":
      default:
        return new DefaultPathfinder();
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
}
