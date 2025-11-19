/// <reference types="@types/screeps" />

/**
 * @ralphschuler/screeps-perf
 *
 * Drop-in, zero configuration performance optimization library for Screeps.
 *
 * This library provides three main optimizations:
 * 1. Array method optimizations - Faster for-loop based implementations
 * 2. Automatic creep memory cleanup - Removes memory for dead creeps
 * 3. Path finding cache - Caches expensive findPath results
 *
 * @example
 * ```typescript
 * import { setupPerformanceOptimizations } from '@ralphschuler/screeps-perf';
 *
 * // Enable all optimizations (recommended for main.js)
 * const perf = setupPerformanceOptimizations();
 *
 * // Or configure specific optimizations
 * const perf = setupPerformanceOptimizations({
 *   speedUpArrayFunctions: true,
 *   cleanUpCreepMemory: true,
 *   optimizePathFinding: true
 * });
 *
 * // Access original findPath when needed
 * const originalPath = perf.originalFindPath.call(room, fromPos, toPos);
 * ```
 */

import { optimizeArrayMethods } from "./ArrayOptimizer.js";
import { setupCreepMemoryCleaner } from "./CreepMemoryCleaner.js";
import { setupPathOptimization, getOriginalFindPath } from "./PathCache.js";
import type { PerformanceOptions, PerformanceModule } from "./types.js";

let isSetup = false;
let originalFindPath: typeof Room.prototype.findPath;

/**
 * Sets up performance optimizations for Screeps
 *
 * This function should be called once at the start of your main.js file,
 * before any other code that might use the optimized functions.
 *
 * @param options - Configuration options for enabling/disabling specific optimizations
 * @returns Module with access to original implementations when needed
 *
 * @example
 * ```typescript
 * // In main.js
 * import { setupPerformanceOptimizations } from '@ralphschuler/screeps-perf';
 *
 * const perf = setupPerformanceOptimizations();
 *
 * export function loop() {
 *   // Your game logic here
 * }
 * ```
 */
export function setupPerformanceOptimizations(options: PerformanceOptions = {}): PerformanceModule {
  if (!isSetup) {
    // Set default options
    const config: Required<PerformanceOptions> = {
      speedUpArrayFunctions: options.speedUpArrayFunctions ?? true,
      cleanUpCreepMemory: options.cleanUpCreepMemory ?? true,
      optimizePathFinding: options.optimizePathFinding ?? true
    };

    // Initialize memory structures
    if (!Memory.screepsPerf) {
      Memory.screepsPerf = {
        lastMemoryCleanUp: Game.time
      };
    }

    // Apply optimizations based on configuration
    if (config.speedUpArrayFunctions) {
      optimizeArrayMethods();
    }

    if (config.cleanUpCreepMemory) {
      setupCreepMemoryCleaner();
    }

    if (config.optimizePathFinding) {
      originalFindPath = setupPathOptimization();
    } else {
      // Store reference even if not optimizing
      originalFindPath = Room.prototype.findPath;
    }

    isSetup = true;
  }

  return {
    originalFindPath: originalFindPath || getOriginalFindPath()
  };
}

// Export types for consumers
export type { PerformanceOptions, PerformanceModule } from "./types.js";

// Export individual modules for advanced usage
export { optimizeArrayMethods } from "./ArrayOptimizer.js";
export { setupCreepMemoryCleaner, cleanUpCreepMemory } from "./CreepMemoryCleaner.js";
export { setupPathOptimization, getOriginalFindPath } from "./PathCache.js";
