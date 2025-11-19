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
//# sourceMappingURL=index.js.map