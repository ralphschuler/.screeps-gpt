/// <reference types="@types/screeps" />

/**
 * CPU metrics snapshot
 */
export interface CpuMetrics {
  /** Current CPU used this tick */
  used: number;
  /** CPU limit for this account */
  limit: number;
  /** CPU bucket amount (0-10000) */
  bucket: number;
  /** Maximum amount of CPU per tick (usually 500) */
  tickLimit?: number;
  /** Shard-specific CPU limits if available */
  shardLimits?: Record<string, number>;
}

/**
 * Heap memory statistics
 */
export interface HeapMetrics {
  /** Total heap size in bytes */
  totalHeapSize: number;
  /** Total available heap size in bytes */
  totalHeapSizeExecutable: number;
  /** Total physical size in bytes */
  totalPhysicalSize: number;
  /** Total available heap size in bytes */
  totalAvailableSize: number;
  /** Used heap size in bytes */
  usedHeapSize: number;
  /** Heap size limit in bytes */
  heapSizeLimit: number;
  /** Malloced memory in bytes */
  mallocedMemory: number;
  /** Peak malloced memory in bytes */
  peakMallocedMemory: number;
  /** Does ZAP garbage value */
  doesZapGarbage: number;
  /** External memory in bytes (Screeps-specific) */
  externalMemory?: number;
}

/**
 * GCL (Global Control Level) metrics
 */
export interface GclMetrics {
  /** Current GCL level */
  level: number;
  /** Current progress toward next level */
  progress: number;
  /** Total progress needed for next level */
  progressTotal: number;
  /** Percentage progress toward next level (0-100) */
  progressPercent: number;
}

/**
 * GPL (Global Power Level) metrics
 */
export interface GplMetrics {
  /** Current GPL level */
  level: number;
  /** Current progress toward next level */
  progress: number;
  /** Total progress needed for next level */
  progressTotal: number;
  /** Percentage progress toward next level (0-100) */
  progressPercent: number;
}

/**
 * Room-level metrics
 */
export interface RoomMetrics {
  /** Room name */
  name: string;
  /** Controller level (0-8) */
  controllerLevel: number | null;
  /** Energy available in the room */
  energyAvailable: number;
  /** Maximum energy capacity in the room */
  energyCapacityAvailable: number;
  /** Number of creeps in the room */
  creepCount: number;
  /** Number of hostile creeps in the room */
  hostileCreepCount: number;
  /** Number of sources in the room */
  sourceCount: number;
  /** Number of structures in the room */
  structureCount: number;
}

/**
 * Resource metrics
 */
export interface ResourceMetrics {
  /** Total energy across all rooms */
  totalEnergy: number;
  /** Credits available */
  credits: number;
  /** Pixels available */
  pixels: number;
  /** CPU unlocks available */
  cpuUnlocks: number;
  /** Access keys available */
  accessKeys: number;
}

/**
 * Complete metrics snapshot
 */
export interface MetricsSnapshot {
  /** Game tick when snapshot was taken */
  tick: number;
  /** CPU metrics */
  cpu: CpuMetrics;
  /** Heap memory metrics */
  heap: HeapMetrics;
  /** GCL metrics */
  gcl: GclMetrics;
  /** GPL metrics if available */
  gpl: GplMetrics | null;
  /** Room metrics by room name */
  rooms: Record<string, RoomMetrics>;
  /** Resource metrics */
  resources: ResourceMetrics;
  /** Total number of creeps */
  totalCreeps: number;
  /** Total number of owned rooms */
  totalRooms: number;
}

/**
 * Configuration options for metrics collection
 */
export interface MetricsOptions {
  /** Whether to collect CPU metrics (default: true) */
  collectCpu?: boolean;
  /** Whether to collect heap metrics (default: true) */
  collectHeap?: boolean;
  /** Whether to collect GCL metrics (default: true) */
  collectGcl?: boolean;
  /** Whether to collect GPL metrics (default: true) */
  collectGpl?: boolean;
  /** Whether to collect room metrics (default: true) */
  collectRooms?: boolean;
  /** Whether to collect resource metrics (default: true) */
  collectResources?: boolean;
}
