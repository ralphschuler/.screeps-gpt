/**
 * Pathfinding options for movement operations
 */
export interface PathfindingOptions {
  /** Target range for pathfinding (default: 1) */
  range?: number;
  /** Number of ticks to reuse a cached path (default: 5) */
  reusePath?: number;
  /** Whether to ignore other creeps when pathfinding (default: false) */
  ignoreCreeps?: boolean;
  /** Maximum number of rooms to search (default: 16) */
  maxRooms?: number;
  /** Maximum operations for pathfinding (default: 2000) */
  maxOps?: number;
  /** Cost matrix callback */
  costCallback?: (roomName: string, costMatrix: CostMatrix) => CostMatrix | void;
  /** Plain terrain cost (default: 1) */
  plainCost?: number;
  /** Swamp terrain cost (default: 5) */
  swampCost?: number;
}

/**
 * Result of a pathfinding operation
 */
export interface PathfindingResult {
  /** The calculated path */
  path: RoomPosition[];
  /** Operations used for pathfinding */
  ops: number;
  /** CPU cost of pathfinding */
  cost: number;
  /** Whether pathfinding was successful */
  incomplete: boolean;
}

/**
 * Abstract interface for pathfinding providers
 * Allows switching between different pathfinding implementations
 */
export interface PathfindingProvider {
  /**
   * Find a path from origin to goal
   */
  findPath(
    origin: RoomPosition,
    goal: RoomPosition | { pos: RoomPosition },
    opts?: PathfindingOptions
  ): PathfindingResult;

  /**
   * Move a creep using this pathfinding provider
   * @returns Movement result code
   */
  moveTo(creep: Creep, target: RoomPosition | { pos: RoomPosition }, opts?: PathfindingOptions): ScreepsReturnCode;

  /**
   * Get provider name for debugging/metrics
   */
  getName(): string;
}
