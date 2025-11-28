/// <reference types="@types/screeps" />

/**
 * @ralphschuler/screeps-profiler
 *
 * CPU profiling library for Screeps with decorator support and build-time optimization.
 *
 * This library provides comprehensive CPU profiling capabilities for Screeps:
 * - Decorator-based profiling for automatic tracking
 * - CLI interface for runtime control
 * - Tick-based caching for minimal overhead
 * - Build-time enable/disable support
 * - Memory-efficient data storage
 *
 * @example
 * ```typescript
 * import { init, profile } from '@ralphschuler/screeps-profiler';
 *
 * // Initialize and expose profiler globally
 * const profiler = init();
 * global.Profiler = profiler;
 *
 * // Use decorator to profile specific methods
 * class MyCreepLogic {
 *   @profile
 *   run(creep: Creep) {
 *     // This method's CPU usage will be tracked
 *   }
 * }
 *
 * // Or profile entire classes
 * @profile
 * class MyRoomLogic {
 *   plan() { }
 *   execute() { }
 * }
 *
 * // Control profiler from console:
 * // Profiler.start()    - Begin profiling
 * // Profiler.status()   - Check if running
 * // Profiler.output()   - Display results
 * // Profiler.stop()     - Stop profiling
 * // Profiler.clear()    - Clear all data
 * ```
 *
 * @example Build-time configuration
 * ```typescript
 * // Disable profiler at build time for zero overhead:
 * // PROFILER_ENABLED=false npm run build
 *
 * // The profile decorator becomes a no-op when disabled,
 * // adding zero runtime overhead to your code.
 * ```
 */

export { init, profile } from "./Profiler.js";

export type {
  Profiler,
  ProfilerMemory,
  ProfilerData,
  ProfilerOutputData,
  ProfilerOptions,
  ProfilerCache
} from "./types.js";

// Extend global types for console access
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      Profiler?: import("./types.js").Profiler;
    }
  }

  interface Window {
    Profiler?: import("./types.js").Profiler;
  }

  // Allow direct global access
  let Profiler: import("./types.js").Profiler | undefined;

  // Declare the build-time constant
  // Note: The value is a string "true" or "false", not a boolean
  const __PROFILER_ENABLED__: "true" | "false";
}

export {};
