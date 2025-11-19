/* eslint-disable @typescript-eslint/no-explicit-any */

/// <reference types="@types/screeps" />

import type { Profiler, ProfilerMemory, ProfilerCache, ProfilerOutputData, ProfilerOptions } from "./types.js";

/**
 * Performance Optimization: Cache profiler enabled state per tick
 * Avoids repeated Memory.profiler.start lookups on hot paths (thousands per tick)
 * Cleared automatically when profiler state changes via start/stop/clear
 */
let profilerEnabledCache: ProfilerCache | null = null;

/**
 * Global flag to control profiler compilation
 * Set at build time via esbuild define
 */
declare const __PROFILER_ENABLED__: boolean;

/**
 * Fast profiler state check with tick-based caching
 * Reduces Memory access overhead from thousands to ~1-2 per tick
 */
function isEnabledFast(): boolean {
  const currentTick = Game.time;

  // Cache hit - return cached value
  if (profilerEnabledCache && profilerEnabledCache.tick === currentTick) {
    return profilerEnabledCache.enabled;
  }

  // Cache miss - check Memory and update cache
  const enabled = Memory.profiler?.start !== undefined;
  profilerEnabledCache = { tick: currentTick, enabled };
  return enabled;
}

/**
 * Clear profiler state cache when state changes
 * Called by start(), stop(), clear() to invalidate cache
 */
function clearEnabledCache(): void {
  profilerEnabledCache = null;
}

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
export function init(_options: ProfilerOptions = {}): Profiler {
  const defaults: ProfilerMemory = {
    data: {},
    total: 0
  };

  if (!Memory.profiler) {
    Memory.profiler = defaults;
  }

  const cli: Profiler = {
    clear() {
      const running = isEnabled();
      // Create a new object to avoid mutating the defaults reference
      Memory.profiler = {
        data: {},
        total: 0
      };
      if (running) {
        Memory.profiler.start = Game.time;
      }
      // Clear cache when profiler state changes
      clearEnabledCache();
      return "Profiler Memory cleared";
    },

    output() {
      outputProfilerData();
      return "Done";
    },

    start() {
      if (!Memory.profiler) {
        Memory.profiler = { data: {}, total: 0 };
      }
      Memory.profiler.start = Game.time;
      // Clear cache when profiler state changes
      clearEnabledCache();
      return "Profiler started";
    },

    status() {
      if (isEnabled()) {
        return "Profiler is running";
      }
      return "Profiler is stopped";
    },

    stop() {
      if (!isEnabled()) {
        return "Profiler is not running";
      }
      if (!Memory.profiler || Memory.profiler.start === undefined) {
        return "Profiler is not running";
      }
      const timeRunning = Game.time - Memory.profiler.start;
      Memory.profiler.total += timeRunning;
      delete Memory.profiler.start;
      // Clear cache when profiler state changes
      clearEnabledCache();
      return "Profiler stopped";
    },

    toString() {
      return (
        "Profiler.start() - Starts the profiler\n" +
        "Profiler.stop() - Stops/Pauses the profiler\n" +
        "Profiler.status() - Returns whether is profiler is currently running or not\n" +
        "Profiler.output() - Pretty-prints the collected profiler data to the console\n" +
        this.status()
      );
    }
  };

  return cli;
}

/**
 * Wrap a function or method to track its CPU usage
 *
 * @internal
 */
function wrapFunction(obj: object, key: PropertyKey, className?: string): void {
  const descriptor = Reflect.getOwnPropertyDescriptor(obj, key);
  if (!descriptor || descriptor.get || descriptor.set) {
    return;
  }

  if (key === "constructor") {
    return;
  }

  const originalFunction = descriptor.value;
  if (!originalFunction || typeof originalFunction !== "function") {
    return;
  }

  // set a key for the object in memory
  if (!className) {
    className = obj.constructor ? `${obj.constructor.name}` : "";
  }
  const memKey = className + `:${String(key)}`;

  // set a tag so we don't wrap a function twice
  const savedName = `__${String(key)}__`;
  if (Reflect.has(obj, savedName)) {
    return;
  }

  Reflect.set(obj, savedName, originalFunction);

  ///////////

  Reflect.set(obj, key, function (this: any, ...args: any[]) {
    // OPTIMIZATION: Use cached profiler state to avoid repeated Memory lookups
    // isEnabledFast() caches result per tick, reducing overhead from thousands to 1-2 Memory accesses
    if (isEnabledFast()) {
      const start = Game.cpu.getUsed();
      const result = originalFunction.apply(this, args);
      const end = Game.cpu.getUsed();
      record(memKey, end - start);
      return result;
    }
    return originalFunction.apply(this, args);
  });
}

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
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function profile(target: Function): void;
export function profile(
  target: object,
  key: string | symbol,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  _descriptor: TypedPropertyDescriptor<Function>
): void;
export function profile(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  target: object | Function,
  key?: string | symbol,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  _descriptor?: TypedPropertyDescriptor<Function>
): void {
  // Check if profiler is enabled at build time
  if (typeof __PROFILER_ENABLED__ !== "undefined" && !__PROFILER_ENABLED__) {
    return;
  }

  if (key) {
    // case of method decorator
    wrapFunction(target, key);
    return;
  }

  // case of class decorator

  const ctor = target as any;
  if (!ctor.prototype) {
    return;
  }

  const className = ctor.name;
  Reflect.ownKeys(ctor.prototype).forEach(k => {
    wrapFunction(ctor.prototype, k, className);
  });
}

/**
 * Check if profiler is currently enabled
 *
 * @internal
 */
function isEnabled(): boolean {
  return Memory.profiler?.start !== undefined;
}

/**
 * Record CPU usage for a function
 *
 * @internal
 */
function record(key: string | symbol, time: number): void {
  if (!Memory.profiler) {
    Memory.profiler = {
      data: {},
      total: 0
    };
  }

  const keyStr = String(key);
  if (!Memory.profiler.data[keyStr]) {
    Memory.profiler.data[keyStr] = {
      calls: 0,
      time: 0
    };
  }
  Memory.profiler.data[keyStr].calls++;
  Memory.profiler.data[keyStr].time += time;
}

/**
 * Output profiler data to console
 *
 * @internal
 */
function outputProfilerData(): void {
  if (!Memory.profiler) {
    console.log("No profiler data available");
    return;
  }

  let totalTicks = Memory.profiler.total;
  if (Memory.profiler.start) {
    totalTicks += Game.time - Memory.profiler.start;
  }

  if (totalTicks === 0) {
    console.log("No profiling data collected yet");
    return;
  }

  ///////
  // Process data
  let totalCpu = 0; // running count of average total CPU use per tick
  let calls: number;
  let time: number;
  let result: Partial<ProfilerOutputData>;
  const data = Reflect.ownKeys(Memory.profiler?.data ?? {})
    .map(key => {
      const keyStr = String(key);
      const entry = Memory.profiler?.data?.[keyStr];
      if (!entry) return null;
      calls = entry.calls;
      time = entry.time;
      result = {};
      result.name = keyStr;
      result.calls = calls;
      result.cpuPerCall = time / calls;
      result.callsPerTick = calls / totalTicks;
      result.cpuPerTick = time / totalTicks;
      totalCpu += result.cpuPerTick;
      return result as ProfilerOutputData;
    })
    .filter((d): d is ProfilerOutputData => d !== null);

  data.sort((lhs, rhs) => rhs.cpuPerTick - lhs.cpuPerTick);

  ///////
  // Format data
  let output = "";

  // get function name max length
  const longestName = Math.max(...data.map(d => d.name.length), 8) + 2;

  //// Header line
  output += padRight("Function", longestName);
  output += padLeft("Tot Calls", 12);
  output += padLeft("CPU/Call", 12);
  output += padLeft("Calls/Tick", 12);
  output += padLeft("CPU/Tick", 12);
  output += padLeft("% of Tot\n", 12);

  ////  Data lines
  data.forEach(d => {
    output += padRight(`${d.name}`, longestName);
    output += padLeft(`${d.calls}`, 12);
    output += padLeft(`${d.cpuPerCall.toFixed(2)}ms`, 12);
    output += padLeft(`${d.callsPerTick.toFixed(2)}`, 12);
    output += padLeft(`${d.cpuPerTick.toFixed(2)}ms`, 12);
    output += padLeft(`${((d.cpuPerTick / totalCpu) * 100).toFixed(0)} %\n`, 12);
  });

  //// Footer line
  output += `${totalTicks} total ticks measured`;
  output += `\t\t\t${totalCpu.toFixed(2)} average CPU profiled per tick`;
  console.log(output);
}

/**
 * Helper function for left padding strings
 *
 * @internal
 */
function padLeft(str: string, length: number): string {
  return str.padStart(length, " ");
}

/**
 * Helper function for right padding strings
 *
 * @internal
 */
function padRight(str: string, length: number): string {
  return str.padEnd(length, " ");
}
