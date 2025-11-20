/// <reference types="@types/screeps" />

import type {
  MetricsSnapshot,
  MetricsOptions,
  CpuMetrics,
  HeapMetrics,
  GclMetrics,
  GplMetrics,
  RoomMetrics,
  ResourceMetrics
} from "./types.js";

/**
 * Collects comprehensive metrics from the Screeps game environment
 *
 * This class provides methods to collect various metrics using official
 * Screeps APIs including CPU usage, heap statistics, GCL/GPL progress,
 * room status, and resource availability.
 *
 * @example
 * ```typescript
 * import { MetricsCollector } from '@ralphschuler/screeps-metrics';
 *
 * const collector = new MetricsCollector();
 * const snapshot = collector.collect();
 *
 * console.log(`CPU Used: ${snapshot.cpu.used}/${snapshot.cpu.limit}`);
 * console.log(`GCL: ${snapshot.gcl.level} (${snapshot.gcl.progressPercent}%)`);
 * ```
 */
export class MetricsCollector {
  private options: Required<MetricsOptions>;

  /**
   * Creates a new metrics collector
   *
   * @param options - Configuration options for what metrics to collect
   */
  public constructor(options: MetricsOptions = {}) {
    this.options = {
      collectCpu: options.collectCpu ?? true,
      collectHeap: options.collectHeap ?? true,
      collectGcl: options.collectGcl ?? true,
      collectGpl: options.collectGpl ?? true,
      collectRooms: options.collectRooms ?? true,
      collectResources: options.collectResources ?? true
    };
  }

  /**
   * Collects a complete metrics snapshot
   *
   * @returns Complete metrics snapshot based on configured options
   */
  public collect(): MetricsSnapshot {
    const tick = Game.time;
    const cpu = this.options.collectCpu ? this.collectCpuMetrics() : this.getEmptyCpuMetrics();
    const heap = this.options.collectHeap ? this.collectHeapMetrics() : this.getEmptyHeapMetrics();
    const gcl = this.options.collectGcl ? this.collectGclMetrics() : this.getEmptyGclMetrics();
    const gpl = this.options.collectGpl ? this.collectGplMetrics() : null;
    const rooms = this.options.collectRooms ? this.collectRoomMetrics() : {};
    const resources = this.options.collectResources ? this.collectResourceMetrics() : this.getEmptyResourceMetrics();

    return {
      tick,
      cpu,
      heap,
      gcl,
      gpl,
      rooms,
      resources,
      totalCreeps: Object.keys(Game.creeps).length,
      totalRooms: Object.keys(Game.rooms).length
    };
  }

  /**
   * Collects CPU metrics
   *
   * @returns CPU metrics including usage, limits, and bucket
   */
  public collectCpuMetrics(): CpuMetrics {
    const metrics: CpuMetrics = {
      used: Game.cpu.getUsed(),
      limit: Game.cpu.limit,
      bucket: Game.cpu.bucket
    };

    // Add optional metrics if available
    if (typeof Game.cpu.tickLimit !== "undefined") {
      metrics.tickLimit = Game.cpu.tickLimit;
    }

    if (typeof Game.cpu.shardLimits !== "undefined") {
      metrics.shardLimits = { ...Game.cpu.shardLimits };
    }

    return metrics;
  }

  /**
   * Collects heap memory statistics
   *
   * @returns Heap memory metrics if available, otherwise empty metrics
   */
  public collectHeapMetrics(): HeapMetrics {
    if (typeof Game.cpu.getHeapStatistics === "undefined") {
      return this.getEmptyHeapMetrics();
    }

    const heapStats = Game.cpu.getHeapStatistics();

    return {
      totalHeapSize: heapStats.total_heap_size,
      totalHeapSizeExecutable: heapStats.total_heap_size_executable,
      totalPhysicalSize: heapStats.total_physical_size,
      totalAvailableSize: heapStats.total_available_size,
      usedHeapSize: heapStats.used_heap_size,
      heapSizeLimit: heapStats.heap_size_limit,
      mallocedMemory: heapStats.malloced_memory,
      peakMallocedMemory: heapStats.peak_malloced_memory,
      doesZapGarbage: heapStats.does_zap_garbage,
      numberOfNativeContexts: heapStats.number_of_native_contexts,
      numberOfDetachedContexts: heapStats.number_of_detached_contexts,
      externalMemory: heapStats.externally_allocated_size
    };
  }

  /**
   * Collects GCL (Global Control Level) metrics
   *
   * @returns GCL metrics including level, progress, and percentage
   */
  public collectGclMetrics(): GclMetrics {
    const progressPercent = Game.gcl.progressTotal > 0 ? (Game.gcl.progress / Game.gcl.progressTotal) * 100 : 0;

    return {
      level: Game.gcl.level,
      progress: Game.gcl.progress,
      progressTotal: Game.gcl.progressTotal,
      progressPercent: Math.round(progressPercent * 100) / 100
    };
  }

  /**
   * Collects GPL (Global Power Level) metrics
   *
   * @returns GPL metrics if available, otherwise null
   */
  public collectGplMetrics(): GplMetrics | null {
    if (typeof Game.gpl === "undefined") {
      return null;
    }

    const progressPercent = Game.gpl.progressTotal > 0 ? (Game.gpl.progress / Game.gpl.progressTotal) * 100 : 0;

    return {
      level: Game.gpl.level,
      progress: Game.gpl.progress,
      progressTotal: Game.gpl.progressTotal,
      progressPercent: Math.round(progressPercent * 100) / 100
    };
  }

  /**
   * Collects metrics for all visible rooms
   *
   * @returns Room metrics by room name
   */
  public collectRoomMetrics(): Record<string, RoomMetrics> {
    const roomMetrics: Record<string, RoomMetrics> = {};

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (!room) continue;

      const creeps = room.find(FIND_MY_CREEPS);
      const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
      const sources = room.find(FIND_SOURCES);
      const structures = room.find(FIND_STRUCTURES);

      roomMetrics[roomName] = {
        name: roomName,
        controllerLevel: room.controller?.level ?? null,
        energyAvailable: room.energyAvailable,
        energyCapacityAvailable: room.energyCapacityAvailable,
        creepCount: creeps.length,
        hostileCreepCount: hostileCreeps.length,
        sourceCount: sources.length,
        structureCount: structures.length
      };
    }

    return roomMetrics;
  }

  /**
   * Collects resource metrics
   *
   * @returns Resource metrics including energy, credits, pixels, etc.
   */
  public collectResourceMetrics(): ResourceMetrics {
    const resources = Game.resources;

    return {
      totalEnergy: this.calculateTotalEnergy(),
      credits: (resources as Record<string, number>)["credits"] ?? 0,
      pixels: (resources as Record<string, number>)["pixel"] ?? 0,
      cpuUnlocks: (resources as Record<string, number>)["cpuUnlock"] ?? 0,
      accessKeys: (resources as Record<string, number>)["accessKey"] ?? 0
    };
  }

  /**
   * Calculates total energy across all owned rooms
   *
   * @returns Total energy amount
   */
  private calculateTotalEnergy(): number {
    let total = 0;

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room && room.controller && room.controller.my) {
        total += room.energyAvailable;
      }
    }

    return total;
  }

  /**
   * Returns empty CPU metrics
   */
  private getEmptyCpuMetrics(): CpuMetrics {
    return {
      used: 0,
      limit: 0,
      bucket: 0
    };
  }

  /**
   * Returns empty heap metrics
   */
  private getEmptyHeapMetrics(): HeapMetrics {
    return {
      totalHeapSize: 0,
      totalHeapSizeExecutable: 0,
      totalPhysicalSize: 0,
      totalAvailableSize: 0,
      usedHeapSize: 0,
      heapSizeLimit: 0,
      mallocedMemory: 0,
      peakMallocedMemory: 0,
      doesZapGarbage: 0
    };
  }

  /**
   * Returns empty GCL metrics
   */
  private getEmptyGclMetrics(): GclMetrics {
    return {
      level: 0,
      progress: 0,
      progressTotal: 0,
      progressPercent: 0
    };
  }

  /**
   * Returns empty resource metrics
   */
  private getEmptyResourceMetrics(): ResourceMetrics {
    return {
      totalEnergy: 0,
      credits: 0,
      pixels: 0,
      cpuUnlocks: 0,
      accessKeys: 0
    };
  }
}
