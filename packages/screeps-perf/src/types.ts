/**
 * Configuration options for the screeps-perf library
 */
export interface PerformanceOptions {
  /**
   * Enable optimized array functions (filter, forEach, map)
   * Uses for-loops instead of native implementations for better performance
   * @default true
   */
  speedUpArrayFunctions?: boolean;

  /**
   * Enable automatic cleanup of creep memory for dead creeps
   * Runs periodically to remove memory entries for non-existent creeps
   * @default true
   */
  cleanUpCreepMemory?: boolean;

  /**
   * Enable path finding result caching
   * Caches Room.findPath results to avoid expensive recalculations
   * @default true
   */
  optimizePathFinding?: boolean;
}

/**
 * Return value from the performance setup function
 */
export interface PerformanceModule {
  /**
   * Original Room.prototype.findPath function before optimization
   * Use this when you need uncached pathfinding results
   */
  originalFindPath: typeof Room.prototype.findPath;
}

/**
 * Memory structure for path optimizer
 */
export interface PathOptimizerMemory {
  lastCleaned: number;
  [pathIdentifier: string]:
    | {
        tick: number;
        path: string;
        used: number;
      }
    | number;
}

/**
 * Memory structure for screeps-perf
 */
export interface ScreepsPerfMemory {
  lastMemoryCleanUp: number;
}

declare global {
  interface Memory {
    pathOptimizer?: PathOptimizerMemory;
    screepsPerf?: ScreepsPerfMemory;
  }

  interface Room {
    _cleanedUp?: boolean;
  }
}
