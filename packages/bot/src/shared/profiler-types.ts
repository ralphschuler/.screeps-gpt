/**
 * Shared profiler types and utilities used across runtime and monitoring scripts
 */

export interface ProfilerData {
  calls: number;
  time: number;
}

export interface ProfilerMemory {
  data: { [name: string]: ProfilerData };
  start?: number;
  total: number;
}

export interface ProfilerSnapshot {
  fetchedAt: string;
  source: string;
  isEnabled: boolean;
  hasData: boolean;
  profilerMemory?: ProfilerMemory;
  summary?: ProfilerSummary;
  error?: string;
}

export interface ProfilerSummary {
  totalTicks: number;
  totalFunctions: number;
  averageCpuPerTick: number;
  topCpuConsumers: Array<{
    name: string;
    calls: number;
    cpuPerCall: number;
    callsPerTick: number;
    cpuPerTick: number;
    percentOfTotal: number;
  }>;
}

/**
 * Configuration constants for profiler processing
 */
export const PROFILER_CONFIG = {
  /** Maximum number of top CPU consumers to include in summary */
  MAX_TOP_CONSUMERS: 20
} as const;

/**
 * Calculate profiler summary metrics from profiler memory data
 * @param profilerMemory - The profiler memory data
 * @param currentTick - Optional current game tick for accurate calculation when profiler is running
 * @returns Summary metrics including top CPU consumers
 */
export function calculateProfilerSummary(profilerMemory: ProfilerMemory, currentTick?: number): ProfilerSummary {
  let totalTicks = profilerMemory.total;
  if (profilerMemory.start && currentTick) {
    // Profiler is currently running - calculate actual ticks
    totalTicks += currentTick - profilerMemory.start;
  } else if (profilerMemory.start) {
    // Profiler is running but we don't have current tick
    // Note: This is a limitation when data is fetched without Game.time context
    // The summary will be based on profilerMemory.total only
  }

  // Calculate average CPU per tick
  let totalCpu = 0;
  const functions: Array<{
    name: string;
    calls: number;
    cpuPerCall: number;
    callsPerTick: number;
    cpuPerTick: number;
  }> = [];

  for (const [name, data] of Object.entries(profilerMemory.data)) {
    const cpuPerCall = data.time / data.calls;
    const callsPerTick = data.calls / totalTicks;
    const cpuPerTick = data.time / totalTicks;

    totalCpu += cpuPerTick;

    functions.push({
      name,
      calls: data.calls,
      cpuPerCall,
      callsPerTick,
      cpuPerTick
    });
  }

  // Sort by CPU per tick (descending)
  functions.sort((a, b) => b.cpuPerTick - a.cpuPerTick);

  // Take top N CPU consumers and add percentage
  const topCpuConsumers = functions.slice(0, PROFILER_CONFIG.MAX_TOP_CONSUMERS).map(func => ({
    ...func,
    percentOfTotal: totalCpu > 0 ? (func.cpuPerTick / totalCpu) * 100 : 0
  }));

  return {
    totalTicks,
    totalFunctions: functions.length,
    averageCpuPerTick: totalCpu,
    topCpuConsumers
  };
}
