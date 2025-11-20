import { describe, it, expect, beforeEach, vi } from "vitest";

// Setup Screeps global mocks before importing the module
const mockHeapStats = {
  total_heap_size: 50000000,
  total_heap_size_executable: 5000000,
  total_physical_size: 45000000,
  total_available_size: 48000000,
  used_heap_size: 25000000,
  heap_size_limit: 52428800,
  malloced_memory: 10000000,
  peak_malloced_memory: 15000000,
  does_zap_garbage: 0,
  number_of_native_contexts: 1,
  number_of_detached_contexts: 0,
  externally_allocated_size: 1000000
};

const mockGame = {
  time: 1000,
  cpu: {
    getUsed: vi.fn(() => 15.5),
    limit: 20,
    bucket: 5000,
    tickLimit: 500,
    shardLimits: { shard0: 10, shard1: 10 },
    getHeapStatistics: vi.fn(() => mockHeapStats)
  },
  gcl: {
    level: 5,
    progress: 50000,
    progressTotal: 100000
  },
  gpl: {
    level: 2,
    progress: 1000,
    progressTotal: 5000
  },
  creeps: {
    harvester1: { name: "harvester1" },
    upgrader1: { name: "upgrader1" },
    builder1: { name: "builder1" }
  },
  rooms: {
    W1N1: {
      energyAvailable: 300,
      energyCapacityAvailable: 550,
      controller: {
        level: 3,
        my: true
      },
      find: vi.fn((type: number) => {
        if (type === FIND_MY_CREEPS) return [{}, {}];
        if (type === FIND_HOSTILE_CREEPS) return [{}];
        if (type === FIND_SOURCES) return [{}, {}];
        if (type === FIND_STRUCTURES) return [{}, {}, {}, {}, {}];
        return [];
      })
    } as unknown as Room,
    W2N1: {
      energyAvailable: 500,
      energyCapacityAvailable: 800,
      controller: {
        level: 5,
        my: true
      },
      find: vi.fn((type: number) => {
        if (type === FIND_MY_CREEPS) return [{}, {}, {}];
        if (type === FIND_HOSTILE_CREEPS) return [];
        if (type === FIND_SOURCES) return [{}, {}];
        if (type === FIND_STRUCTURES) return [{}, {}, {}, {}, {}, {}, {}];
        return [];
      })
    } as unknown as Room
  },
  resources: {
    [RESOURCE_CREDITS]: 1000,
    [RESOURCE_PIXEL]: 50,
    [RESOURCE_CPU_UNLOCK]: 2,
    [RESOURCE_ACCESS_KEY]: 1
  }
};

// Define Screeps constants
const FIND_MY_CREEPS = 101;
const FIND_HOSTILE_CREEPS = 102;
const FIND_SOURCES = 105;
const FIND_STRUCTURES = 107;
const RESOURCE_CREDITS = "credits";
const RESOURCE_PIXEL = "pixel";
const RESOURCE_CPU_UNLOCK = "cpuUnlock";
const RESOURCE_ACCESS_KEY = "accessKey";

// Setup global mocks
global.Game = mockGame as unknown as Game;
global.FIND_MY_CREEPS = FIND_MY_CREEPS;
global.FIND_HOSTILE_CREEPS = FIND_HOSTILE_CREEPS;
global.FIND_SOURCES = FIND_SOURCES;
global.FIND_STRUCTURES = FIND_STRUCTURES;
global.RESOURCE_CREDITS = RESOURCE_CREDITS as ResourceConstant;
global.RESOURCE_PIXEL = RESOURCE_PIXEL as ResourceConstant;
global.RESOURCE_CPU_UNLOCK = RESOURCE_CPU_UNLOCK as ResourceConstant;
global.RESOURCE_ACCESS_KEY = RESOURCE_ACCESS_KEY as ResourceConstant;

// Now import the module after mocks are setup
import { MetricsCollector } from "../src/MetricsCollector";
import type { MetricsSnapshot } from "../src/types";

describe("MetricsCollector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create collector with default options", () => {
      const collector = new MetricsCollector();
      expect(collector).toBeInstanceOf(MetricsCollector);
    });

    it("should create collector with custom options", () => {
      const collector = new MetricsCollector({
        collectCpu: true,
        collectHeap: false,
        collectGcl: true,
        collectGpl: false,
        collectRooms: false,
        collectResources: true
      });
      expect(collector).toBeInstanceOf(MetricsCollector);
    });
  });

  describe("collect", () => {
    it("should collect complete metrics snapshot with default options", () => {
      const collector = new MetricsCollector();
      const snapshot = collector.collect();

      expect(snapshot).toBeDefined();
      expect(snapshot.tick).toBe(1000);
      expect(snapshot.cpu).toBeDefined();
      expect(snapshot.heap).toBeDefined();
      expect(snapshot.gcl).toBeDefined();
      expect(snapshot.gpl).toBeDefined();
      expect(snapshot.rooms).toBeDefined();
      expect(snapshot.resources).toBeDefined();
      expect(snapshot.totalCreeps).toBe(3);
      expect(snapshot.totalRooms).toBe(2);
    });

    it("should respect disabled options", () => {
      const collector = new MetricsCollector({
        collectCpu: false,
        collectHeap: false,
        collectGcl: false,
        collectGpl: false,
        collectRooms: false,
        collectResources: false
      });
      const snapshot = collector.collect();

      expect(snapshot.cpu.used).toBe(0);
      expect(snapshot.heap.usedHeapSize).toBe(0);
      expect(snapshot.gcl.level).toBe(0);
      expect(snapshot.gpl).toBeNull();
      expect(Object.keys(snapshot.rooms)).toHaveLength(0);
      expect(snapshot.resources.totalEnergy).toBe(0);
    });
  });

  describe("collectCpuMetrics", () => {
    it("should collect CPU metrics", () => {
      const collector = new MetricsCollector();
      const cpuMetrics = collector.collectCpuMetrics();

      expect(cpuMetrics.used).toBe(15.5);
      expect(cpuMetrics.limit).toBe(20);
      expect(cpuMetrics.bucket).toBe(5000);
      expect(cpuMetrics.tickLimit).toBe(500);
      expect(cpuMetrics.shardLimits).toEqual({ shard0: 10, shard1: 10 });
    });

    it("should handle missing optional CPU properties", () => {
      const originalTickLimit = mockGame.cpu.tickLimit;
      const originalShardLimits = mockGame.cpu.shardLimits;

      // @ts-expect-error - testing undefined case
      mockGame.cpu.tickLimit = undefined;
      // @ts-expect-error - testing undefined case
      mockGame.cpu.shardLimits = undefined;

      const collector = new MetricsCollector();
      const cpuMetrics = collector.collectCpuMetrics();

      expect(cpuMetrics.used).toBe(15.5);
      expect(cpuMetrics.limit).toBe(20);
      expect(cpuMetrics.bucket).toBe(5000);
      expect(cpuMetrics.tickLimit).toBeUndefined();
      expect(cpuMetrics.shardLimits).toBeUndefined();

      // Restore original values
      mockGame.cpu.tickLimit = originalTickLimit;
      mockGame.cpu.shardLimits = originalShardLimits;
    });
  });

  describe("collectHeapMetrics", () => {
    it("should collect heap metrics when available", () => {
      const collector = new MetricsCollector();
      const heapMetrics = collector.collectHeapMetrics();

      expect(heapMetrics.totalHeapSize).toBe(50000000);
      expect(heapMetrics.usedHeapSize).toBe(25000000);
      expect(heapMetrics.heapSizeLimit).toBe(52428800);
      expect(heapMetrics.mallocedMemory).toBe(10000000);
      expect(heapMetrics.peakMallocedMemory).toBe(15000000);
      expect(heapMetrics.numberOfNativeContexts).toBe(1);
      expect(heapMetrics.numberOfDetachedContexts).toBe(0);
      expect(heapMetrics.externalMemory).toBe(1000000);
    });

    it("should return empty metrics when getHeapStatistics is unavailable", () => {
      const originalGetHeapStatistics = mockGame.cpu.getHeapStatistics;
      // @ts-expect-error - testing undefined case
      mockGame.cpu.getHeapStatistics = undefined;

      const collector = new MetricsCollector();
      const heapMetrics = collector.collectHeapMetrics();

      expect(heapMetrics.totalHeapSize).toBe(0);
      expect(heapMetrics.usedHeapSize).toBe(0);
      expect(heapMetrics.heapSizeLimit).toBe(0);

      // Restore original value
      mockGame.cpu.getHeapStatistics = originalGetHeapStatistics;
    });
  });

  describe("collectGclMetrics", () => {
    it("should collect GCL metrics with correct percentage", () => {
      const collector = new MetricsCollector();
      const gclMetrics = collector.collectGclMetrics();

      expect(gclMetrics.level).toBe(5);
      expect(gclMetrics.progress).toBe(50000);
      expect(gclMetrics.progressTotal).toBe(100000);
      expect(gclMetrics.progressPercent).toBe(50);
    });

    it("should handle zero progressTotal", () => {
      const originalProgressTotal = mockGame.gcl.progressTotal;
      mockGame.gcl.progressTotal = 0;

      const collector = new MetricsCollector();
      const gclMetrics = collector.collectGclMetrics();

      expect(gclMetrics.progressPercent).toBe(0);

      // Restore original value
      mockGame.gcl.progressTotal = originalProgressTotal;
    });
  });

  describe("collectGplMetrics", () => {
    it("should collect GPL metrics with correct percentage", () => {
      const collector = new MetricsCollector();
      const gplMetrics = collector.collectGplMetrics();

      expect(gplMetrics).not.toBeNull();
      expect(gplMetrics?.level).toBe(2);
      expect(gplMetrics?.progress).toBe(1000);
      expect(gplMetrics?.progressTotal).toBe(5000);
      expect(gplMetrics?.progressPercent).toBe(20);
    });

    it("should return null when GPL is unavailable", () => {
      const originalGpl = mockGame.gpl;
      // @ts-expect-error - testing undefined case
      mockGame.gpl = undefined;

      const collector = new MetricsCollector();
      const gplMetrics = collector.collectGplMetrics();

      expect(gplMetrics).toBeNull();

      // Restore original value
      mockGame.gpl = originalGpl;
    });
  });

  describe("collectRoomMetrics", () => {
    it("should collect metrics for all rooms", () => {
      const collector = new MetricsCollector();
      const roomMetrics = collector.collectRoomMetrics();

      expect(Object.keys(roomMetrics)).toHaveLength(2);
      expect(roomMetrics.W1N1).toBeDefined();
      expect(roomMetrics.W2N1).toBeDefined();
    });

    it("should collect correct room data", () => {
      const collector = new MetricsCollector();
      const roomMetrics = collector.collectRoomMetrics();

      const w1n1 = roomMetrics.W1N1;
      expect(w1n1.name).toBe("W1N1");
      expect(w1n1.controllerLevel).toBe(3);
      expect(w1n1.energyAvailable).toBe(300);
      expect(w1n1.energyCapacityAvailable).toBe(550);
      expect(w1n1.creepCount).toBe(2);
      expect(w1n1.hostileCreepCount).toBe(1);
      expect(w1n1.sourceCount).toBe(2);
      expect(w1n1.structureCount).toBe(5);
    });
  });

  describe("collectResourceMetrics", () => {
    it("should collect resource metrics", () => {
      const collector = new MetricsCollector();
      const resourceMetrics = collector.collectResourceMetrics();

      expect(resourceMetrics.totalEnergy).toBe(800); // 300 + 500 from owned rooms
      expect(resourceMetrics.credits).toBe(1000);
      expect(resourceMetrics.pixels).toBe(50);
      expect(resourceMetrics.cpuUnlocks).toBe(2);
      expect(resourceMetrics.accessKeys).toBe(1);
    });

    it("should handle missing resource types", () => {
      const originalResources = mockGame.resources;
      mockGame.resources = {};

      const collector = new MetricsCollector();
      const resourceMetrics = collector.collectResourceMetrics();

      expect(resourceMetrics.credits).toBe(0);
      expect(resourceMetrics.pixels).toBe(0);
      expect(resourceMetrics.cpuUnlocks).toBe(0);
      expect(resourceMetrics.accessKeys).toBe(0);

      // Restore original value
      mockGame.resources = originalResources;
    });
  });
});
