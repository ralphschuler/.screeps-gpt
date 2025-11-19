/// <reference types="@types/screeps" />

/**
 * @ralphschuler/screeps-metrics
 *
 * Comprehensive metrics collection library for Screeps using official game APIs.
 *
 * This library provides tools for collecting and monitoring various metrics from
 * the Screeps game environment including:
 * - CPU usage and limits
 * - Heap memory statistics
 * - GCL/GPL progress
 * - Room-level metrics
 * - Resource availability
 *
 * @example
 * ```typescript
 * import { MetricsCollector } from '@ralphschuler/screeps-metrics';
 *
 * // Create collector with all metrics enabled
 * const collector = new MetricsCollector();
 *
 * // Collect metrics snapshot
 * const snapshot = collector.collect();
 *
 * // Access specific metrics
 * console.log(`CPU: ${snapshot.cpu.used}/${snapshot.cpu.limit}`);
 * console.log(`Bucket: ${snapshot.cpu.bucket}`);
 * console.log(`GCL: ${snapshot.gcl.level} (${snapshot.gcl.progressPercent}%)`);
 * console.log(`Heap: ${snapshot.heap.usedHeapSize} / ${snapshot.heap.heapSizeLimit}`);
 *
 * // Collect only specific metrics
 * const cpuCollector = new MetricsCollector({
 *   collectCpu: true,
 *   collectHeap: false,
 *   collectGcl: false,
 *   collectGpl: false,
 *   collectRooms: false,
 *   collectResources: false
 * });
 * ```
 */

export { MetricsCollector } from "./MetricsCollector.js";

export type {
  MetricsSnapshot,
  MetricsOptions,
  CpuMetrics,
  HeapMetrics,
  GclMetrics,
  GplMetrics,
  RoomMetrics,
  ResourceMetrics
} from "./types.js";
