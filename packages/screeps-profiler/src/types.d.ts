/**
 * Type definitions for the Screeps profiler
 */
/**
 * Memory structure for storing profiler data
 */
export interface ProfilerMemory {
  /** Profiling data for each tracked function */
  data: {
    [name: string]: ProfilerData;
  };
  /** Tick when profiling was started (undefined when stopped) */
  start?: number;
  /** Total number of ticks profiled across all sessions */
  total: number;
}
/**
 * Performance data for a single profiled function
 */
export interface ProfilerData {
  /** Number of times the function was called */
  calls: number;
  /** Total CPU time consumed across all calls */
  time: number;
}
/**
 * Output data structure for formatted profiler results
 */
export interface ProfilerOutputData {
  /** Function name */
  name: string;
  /** Total number of calls */
  calls: number;
  /** Average CPU per call */
  cpuPerCall: number;
  /** Average calls per tick */
  callsPerTick: number;
  /** Average CPU per tick */
  cpuPerTick: number;
}
/**
 * Profiler CLI interface for controlling profiling
 */
export interface Profiler {
  /** Clear all profiler data */
  clear(): string;
  /** Output profiler data to console */
  output(): string;
  /** Start profiling */
  start(): string;
  /** Check profiler status */
  status(): string;
  /** Stop profiling */
  stop(): string;
  /** Get help text */
  toString(): string;
}
/**
 * Options for configuring the profiler
 */
export interface ProfilerOptions {
  /** Whether profiling is enabled (typically controlled by __PROFILER_ENABLED__) */
  enabled?: boolean;
}
/**
 * Internal cache structure for profiler state
 */
export interface ProfilerCache {
  tick: number;
  enabled: boolean;
}
declare global {
  interface Memory {
    profiler?: ProfilerMemory;
  }
}
//# sourceMappingURL=types.d.ts.map
