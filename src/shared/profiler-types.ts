/**
 * Shared profiler types used across runtime and monitoring scripts
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
  summary?: {
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
  };
  error?: string;
}
