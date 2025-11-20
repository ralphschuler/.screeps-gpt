import type { Profiler, ProfilerOptions } from "./types.js";
/**
 * Initialize the profiler and return the CLI interface
 *
 * @param options - Configuration options
 * @returns Profiler CLI interface
 *
 * @example
 * ```typescript
 * import { init } from '@ralphschuler/screeps-profiler';
 *
 * const profiler = init();
 * global.Profiler = profiler;
 *
 * // In console:
 * // Profiler.start()
 * // Profiler.status()
 * // Profiler.output()
 * // Profiler.stop()
 * ```
 */
export declare function init(_options?: ProfilerOptions): Profiler;
/**
 * Profile decorator for methods and classes
 *
 * Can be used as a method decorator or class decorator to automatically
 * track CPU usage of decorated functions.
 *
 * @example
 * ```typescript
 * import { profile } from '@ralphschuler/screeps-profiler';
 *
 * class MyClass {
 *   @profile
 *   myMethod() {
 *     // This method's CPU usage will be tracked
 *   }
 * }
 *
 * // Or profile an entire class
 * @profile
 * class MyProfiledClass {
 *   method1() { }
 *   method2() { }
 * }
 * ```
 */
export declare function profile(target: Function): void;
export declare function profile(
  target: object,
  key: string | symbol,
  _descriptor: TypedPropertyDescriptor<Function>
): void;
//# sourceMappingURL=Profiler.d.ts.map
