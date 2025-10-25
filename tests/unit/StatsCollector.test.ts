import { describe, it, expect } from "vitest";
import { StatsCollector } from "@runtime/metrics/StatsCollector";
import type { PerformanceSnapshot } from "@shared/contracts";

describe("StatsCollector", () => {
  it("should collect basic CPU and creep statistics", () => {
    const collector = new StatsCollector();
    const game = {
      time: 12345,
      cpu: {
        getUsed: () => 5.5,
        limit: 10,
        bucket: 8500
      },
      creeps: {
        harvester1: {},
        harvester2: {},
        upgrader1: {}
      },
      rooms: {
        W1N1: {
          energyAvailable: 300,
          energyCapacityAvailable: 550,
          controller: {
            level: 3,
            progress: 25000,
            progressTotal: 45000
          }
        }
      }
    };

    const snapshot: PerformanceSnapshot = {
      tick: 12345,
      cpuUsed: 5.5,
      cpuLimit: 10,
      cpuBucket: 8500,
      creepCount: 3,
      roomCount: 1,
      spawnOrders: 0,
      warnings: [],
      execution: {
        processedCreeps: 3,
        spawnedCreeps: [],
        tasksExecuted: {}
      }
    };

    const memory = {} as Memory;
    collector.collect(game, memory, snapshot);

    expect(memory.stats).toBeDefined();
    expect(memory.stats?.time).toBe(12345);
    expect(memory.stats?.cpu).toEqual({
      used: 5.5,
      limit: 10,
      bucket: 8500
    });
    expect(memory.stats?.creeps).toEqual({
      count: 3
    });
    expect(memory.stats?.rooms?.count).toBe(1);
  });

  it("should collect per-room statistics", () => {
    const collector = new StatsCollector();
    const game = {
      time: 12346,
      cpu: {
        getUsed: () => 3.2,
        limit: 10,
        bucket: 9000
      },
      creeps: {
        harvester1: {}
      },
      rooms: {
        W1N1: {
          energyAvailable: 300,
          energyCapacityAvailable: 550,
          controller: {
            level: 3,
            progress: 25000,
            progressTotal: 45000
          }
        },
        W2N2: {
          energyAvailable: 800,
          energyCapacityAvailable: 1300,
          controller: {
            level: 5,
            progress: 100000,
            progressTotal: 135000
          }
        }
      }
    };

    const snapshot: PerformanceSnapshot = {
      tick: 12346,
      cpuUsed: 3.2,
      cpuLimit: 10,
      cpuBucket: 9000,
      creepCount: 1,
      roomCount: 2,
      spawnOrders: 0,
      warnings: [],
      execution: {
        processedCreeps: 1,
        spawnedCreeps: [],
        tasksExecuted: {}
      }
    };

    const memory = {} as Memory;
    collector.collect(game, memory, snapshot);

    expect(memory.stats?.rooms?.count).toBe(2);
    expect(memory.stats?.rooms?.W1N1).toEqual({
      energyAvailable: 300,
      energyCapacityAvailable: 550,
      controllerLevel: 3,
      controllerProgress: 25000,
      controllerProgressTotal: 45000
    });
    expect(memory.stats?.rooms?.W2N2).toEqual({
      energyAvailable: 800,
      energyCapacityAvailable: 1300,
      controllerLevel: 5,
      controllerProgress: 100000,
      controllerProgressTotal: 135000
    });
  });

  it("should collect spawn statistics when creeps are spawned", () => {
    const collector = new StatsCollector();
    const game = {
      time: 12347,
      cpu: {
        getUsed: () => 4.1,
        limit: 10,
        bucket: 8700
      },
      creeps: {
        harvester1: {},
        harvester2: {}
      },
      rooms: {
        W1N1: {
          energyAvailable: 200,
          energyCapacityAvailable: 550
        }
      }
    };

    const snapshot: PerformanceSnapshot = {
      tick: 12347,
      cpuUsed: 4.1,
      cpuLimit: 10,
      cpuBucket: 8700,
      creepCount: 2,
      roomCount: 1,
      spawnOrders: 2,
      warnings: [],
      execution: {
        processedCreeps: 2,
        spawnedCreeps: ["harvester1", "harvester2"],
        tasksExecuted: {}
      }
    };

    const memory = {} as Memory;
    collector.collect(game, memory, snapshot);

    expect(memory.stats?.spawn).toBeDefined();
    expect(memory.stats?.spawn?.orders).toBe(2);
  });

  it("should not include spawn statistics when no creeps are spawned", () => {
    const collector = new StatsCollector();
    const game = {
      time: 12348,
      cpu: {
        getUsed: () => 3.5,
        limit: 10,
        bucket: 8900
      },
      creeps: {
        harvester1: {}
      },
      rooms: {
        W1N1: {
          energyAvailable: 500,
          energyCapacityAvailable: 550
        }
      }
    };

    const snapshot: PerformanceSnapshot = {
      tick: 12348,
      cpuUsed: 3.5,
      cpuLimit: 10,
      cpuBucket: 8900,
      creepCount: 1,
      roomCount: 1,
      spawnOrders: 0,
      warnings: [],
      execution: {
        processedCreeps: 1,
        spawnedCreeps: [],
        tasksExecuted: {}
      }
    };

    const memory = {} as Memory;
    collector.collect(game, memory, snapshot);

    expect(memory.stats?.spawn).toBeUndefined();
  });

  it("should handle rooms without controllers", () => {
    const collector = new StatsCollector();
    const game = {
      time: 12349,
      cpu: {
        getUsed: () => 2.8,
        limit: 10,
        bucket: 9100
      },
      creeps: {},
      rooms: {
        W1N1: {
          energyAvailable: 300,
          energyCapacityAvailable: 300
        }
      }
    };

    const snapshot: PerformanceSnapshot = {
      tick: 12349,
      cpuUsed: 2.8,
      cpuLimit: 10,
      cpuBucket: 9100,
      creepCount: 0,
      roomCount: 1,
      spawnOrders: 0,
      warnings: [],
      execution: {
        processedCreeps: 0,
        spawnedCreeps: [],
        tasksExecuted: {}
      }
    };

    const memory = {} as Memory;
    collector.collect(game, memory, snapshot);

    expect(memory.stats?.rooms?.W1N1).toEqual({
      energyAvailable: 300,
      energyCapacityAvailable: 300
    });
    const roomStats = memory.stats?.rooms?.W1N1;
    if (typeof roomStats === "object") {
      expect(roomStats.controllerLevel).toBeUndefined();
    }
  });

  it("should overwrite previous stats on each collection", () => {
    const collector = new StatsCollector();
    const game = {
      time: 12350,
      cpu: {
        getUsed: () => 4.5,
        limit: 10,
        bucket: 8600
      },
      creeps: {
        harvester1: {},
        harvester2: {}
      },
      rooms: {
        W1N1: {
          energyAvailable: 400,
          energyCapacityAvailable: 550
        }
      }
    };

    const snapshot: PerformanceSnapshot = {
      tick: 12350,
      cpuUsed: 4.5,
      cpuLimit: 10,
      cpuBucket: 8600,
      creepCount: 2,
      roomCount: 1,
      spawnOrders: 1,
      warnings: [],
      execution: {
        processedCreeps: 2,
        spawnedCreeps: ["harvester2"],
        tasksExecuted: {}
      }
    };

    const memory = {
      stats: {
        time: 12349,
        cpu: { used: 3.0, limit: 10, bucket: 8500 },
        creeps: { count: 1 },
        rooms: { count: 1 }
      }
    } as Memory;

    collector.collect(game, memory, snapshot);

    expect(memory.stats.time).toBe(12350);
    expect(memory.stats.cpu.used).toBe(4.5);
    expect(memory.stats.creeps.count).toBe(2);
  });
});
