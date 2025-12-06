/**
 * Profiler types for monitoring and analysis utilities
 *
 * These types are used by profiler monitoring scripts to fetch, analyze,
 * and report on profiler data from the Screeps runtime.
 */

/**
 * Memory structure for storing profiler data
 * This matches the structure in the screeps-profiler package
 */
export interface ProfilerMemory {
  /** Profiling data for each tracked function */
  data: { [name: string]: ProfilerData };
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
 * Snapshot of profiler state captured at a specific time
 * Used for monitoring and health checks
 */
export interface ProfilerSnapshot {
  /** ISO timestamp when the snapshot was fetched */
  fetchedAt: string;
  /** Source of the snapshot (console, api, etc.) */
  source: string;
  /** Whether the profiler is currently enabled/running */
  isEnabled: boolean;
  /** Whether the profiler has collected any data */
  hasData: boolean;
  /** Error message if fetch failed */
  error?: string;
  /** Raw profiler memory data */
  profilerMemory?: ProfilerMemory;
  /** Analyzed summary statistics */
  summary?: ProfilerSummary;
}

/**
 * Analyzed summary of profiler data
 */
export interface ProfilerSummary {
  /** Total number of ticks profiled */
  totalTicks: number;
  /** Number of unique functions tracked */
  totalFunctions: number;
  /** Average CPU used per tick across all functions */
  averageCpuPerTick: number;
  /** Top CPU consuming functions */
  topCpuConsumers: ProfilerConsumer[];
}

/**
 * Analysis of a single profiled function's CPU consumption
 */
export interface ProfilerConsumer {
  /** Function name */
  name: string;
  /** Total number of calls */
  calls: number;
  /** Average CPU time per call */
  cpuPerCall: number;
  /** Average calls per tick */
  callsPerTick: number;
  /** Average CPU consumed per tick */
  cpuPerTick: number;
  /** Percentage of total CPU consumed */
  percentOfTotal: number;
}

/**
 * Calculate summary statistics from profiler memory
 * @param profilerMemory - Raw profiler memory data
 * @returns Analyzed summary statistics
 */
export function calculateProfilerSummary(profilerMemory: ProfilerMemory): ProfilerSummary {
  const totalTicks = profilerMemory.total || 1; // Avoid division by zero
  const functionNames = Object.keys(profilerMemory.data);
  const totalFunctions = functionNames.length;

  // Calculate total CPU and per-function stats
  let totalCpu = 0;
  const consumers: ProfilerConsumer[] = [];

  for (const [name, data] of Object.entries(profilerMemory.data)) {
    totalCpu += data.time;

    const cpuPerCall = data.calls > 0 ? data.time / data.calls : 0;
    const callsPerTick = data.calls / totalTicks;
    const cpuPerTick = data.time / totalTicks;

    consumers.push({
      name,
      calls: data.calls,
      cpuPerCall,
      callsPerTick,
      cpuPerTick,
      percentOfTotal: 0 // Will be calculated after we know total
    });
  }

  // Calculate percentage of total for each consumer
  for (const consumer of consumers) {
    consumer.percentOfTotal = totalCpu > 0 ? (consumer.cpuPerTick / (totalCpu / totalTicks)) * 100 : 0;
  }

  // Sort by CPU per tick descending
  consumers.sort((a, b) => b.cpuPerTick - a.cpuPerTick);

  // Take top 10 consumers
  const topCpuConsumers = consumers.slice(0, 10);

  return {
    totalTicks,
    totalFunctions,
    averageCpuPerTick: totalCpu / totalTicks,
    topCpuConsumers
  };
}
