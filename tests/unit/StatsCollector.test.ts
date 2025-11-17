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
        harvester1: { memory: { role: "harvester" } },
        harvester2: { memory: { role: "harvester" } },
        upgrader1: { memory: { role: "upgrader" } }
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
      count: 3,
      byRole: {
        harvester: 2,
        upgrader: 1
      }
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

  it("should support diagnostic logging when enabled", () => {
    const collector = new StatsCollector({ enableDiagnostics: true });
    const game = {
      time: 12351,
      cpu: {
        getUsed: () => 5.0,
        limit: 10,
        bucket: 8500
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
        }
      }
    };

    const snapshot: PerformanceSnapshot = {
      tick: 12351,
      cpuUsed: 5.0,
      cpuLimit: 10,
      cpuBucket: 8500,
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

    // Verify stats are still collected correctly
    expect(memory.stats).toBeDefined();
    expect(memory.stats?.time).toBe(12351);
    expect(memory.stats?.cpu.used).toBe(5.0);
    expect(memory.stats?.rooms?.count).toBe(1);
  });

  it("should allow disabling diagnostic logging", () => {
    const collector = new StatsCollector({ enableDiagnostics: false });
    const game = {
      time: 12352,
      cpu: {
        getUsed: () => 4.0,
        limit: 10,
        bucket: 8600
      },
      creeps: {},
      rooms: {}
    };

    const snapshot: PerformanceSnapshot = {
      tick: 12352,
      cpuUsed: 4.0,
      cpuLimit: 10,
      cpuBucket: 8600,
      creepCount: 0,
      roomCount: 0,
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

    // Verify stats are still collected correctly
    expect(memory.stats).toBeDefined();
    expect(memory.stats?.time).toBe(12352);
  });

  it("should collect spawn utilization metrics", () => {
    const collector = new StatsCollector();
    const game = {
      time: 12353,
      cpu: {
        getUsed: () => 4.5,
        limit: 10,
        bucket: 8700
      },
      creeps: {
        harvester1: { memory: { role: "harvester" } }
      },
      spawns: {
        Spawn1: { spawning: { name: "harvester2" } },
        Spawn2: { spawning: null }
      },
      rooms: {
        W1N1: {
          energyAvailable: 300,
          energyCapacityAvailable: 550
        }
      }
    };

    const snapshot: PerformanceSnapshot = {
      tick: 12353,
      cpuUsed: 4.5,
      cpuLimit: 10,
      cpuBucket: 8700,
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

    expect(memory.stats?.spawns).toBeDefined();
    expect(memory.stats?.spawns).toBe(2);
    expect(memory.stats?.activeSpawns).toBe(1);
  });

  it("should collect energy storage per room", () => {
    const collector = new StatsCollector();
    const game = {
      time: 12354,
      cpu: {
        getUsed: () => 5.0,
        limit: 10,
        bucket: 8800
      },
      creeps: {
        harvester1: { memory: { role: "harvester" } }
      },
      rooms: {
        W1N1: {
          energyAvailable: 300,
          energyCapacityAvailable: 550,
          controller: {
            level: 3,
            progress: 25000,
            progressTotal: 45000
          },
          find: (type: number) => {
            if (type === 107) {
              // FIND_MY_STRUCTURES
              return [
                { structureType: "storage", store: { energy: 5000 } },
                { structureType: "container", store: { energy: 2000 } },
                { structureType: "extension", store: { energy: 50 } }
              ];
            }
            if (type === 111) {
              // FIND_MY_CONSTRUCTION_SITES
              return [{ structureType: "road" }, { structureType: "extension" }];
            }
            return [];
          }
        }
      }
    };

    const snapshot: PerformanceSnapshot = {
      tick: 12354,
      cpuUsed: 5.0,
      cpuLimit: 10,
      cpuBucket: 8800,
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

    const roomStats = memory.stats?.rooms?.W1N1;
    expect(roomStats).toBeDefined();
    if (typeof roomStats === "object") {
      expect(roomStats.energyStored).toBe(7000); // 5000 + 2000
      expect(roomStats.constructionSites).toBe(2);
    }
  });

  it("should not include optional room metrics when zero", () => {
    const collector = new StatsCollector();
    const game = {
      time: 12355,
      cpu: {
        getUsed: () => 3.5,
        limit: 10,
        bucket: 9000
      },
      creeps: {
        harvester1: { memory: { role: "harvester" } }
      },
      rooms: {
        W1N1: {
          energyAvailable: 300,
          energyCapacityAvailable: 550,
          find: (type: number) => {
            if (type === 107) {
              // FIND_MY_STRUCTURES - no storage/containers
              return [{ structureType: "extension", store: { energy: 50 } }];
            }
            if (type === 111) {
              // FIND_MY_CONSTRUCTION_SITES - no sites
              return [];
            }
            return [];
          }
        }
      }
    };

    const snapshot: PerformanceSnapshot = {
      tick: 12355,
      cpuUsed: 3.5,
      cpuLimit: 10,
      cpuBucket: 9000,
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

    const roomStats = memory.stats?.rooms?.W1N1;
    expect(roomStats).toBeDefined();
    if (typeof roomStats === "object") {
      expect(roomStats.energyStored).toBeUndefined();
      expect(roomStats.constructionSites).toBeUndefined();
    }
  });

  it("should initialize Memory.stats defensively when undefined", () => {
    const collector = new StatsCollector({ enableDiagnostics: false });
    const game = {
      time: 12357,
      cpu: {
        getUsed: () => 5.5,
        limit: 10,
        bucket: 8500
      },
      creeps: {
        harvester1: { memory: { role: "harvester" } }
      },
      rooms: {
        W1N1: {
          energyAvailable: 300,
          energyCapacityAvailable: 550
        }
      }
    };

    const snapshot: PerformanceSnapshot = {
      tick: 12357,
      cpuUsed: 5.5,
      cpuLimit: 10,
      cpuBucket: 8500,
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

    // Memory.stats is undefined - should be initialized defensively
    const memory = {} as Memory;
    expect(memory.stats).toBeUndefined();

    collector.collect(game, memory, snapshot);

    // Verify defensive initialization created the structure
    expect(memory.stats).toBeDefined();
    expect(memory.stats?.time).toBe(12357);
    expect(memory.stats?.cpu.used).toBe(5.5);
    expect(memory.stats?.creeps.count).toBe(1);
  });

  it("should populate Memory.stats with real data, not zeros (regression test for issue #684)", () => {
    const collector = new StatsCollector({ enableDiagnostics: false });
    const game = {
      time: 12358,
      cpu: {
        getUsed: () => 6.5,
        limit: 20,
        bucket: 9500
      },
      creeps: {
        harvester1: { memory: { role: "harvester" } },
        upgrader1: { memory: { role: "upgrader" } }
      },
      rooms: {
        E54N39: {
          energyAvailable: 800,
          energyCapacityAvailable: 1050,
          controller: {
            level: 4,
            progress: 17981,
            progressTotal: 405000
          }
        }
      }
    };

    const snapshot: PerformanceSnapshot = {
      tick: 12358,
      cpuUsed: 6.5,
      cpuLimit: 20,
      cpuBucket: 9500,
      creepCount: 2,
      roomCount: 1,
      spawnOrders: 0,
      warnings: [],
      execution: {
        processedCreeps: 2,
        spawnedCreeps: [],
        tasksExecuted: {}
      }
    };

    const memory = {} as Memory;
    collector.collect(game, memory, snapshot);

    // REGRESSION TEST: Verify stats are NOT zeros (issue #684 root cause)
    expect(memory.stats).toBeDefined();
    expect(memory.stats?.time).toBe(12358);
    expect(memory.stats?.time).not.toBe(0); // Should be real game time, not zero

    expect(memory.stats?.cpu.used).toBe(6.5);
    expect(memory.stats?.cpu.used).not.toBe(0); // Should be real CPU usage, not zero

    expect(memory.stats?.cpu.limit).toBe(20);
    expect(memory.stats?.cpu.limit).not.toBe(0); // Should be real CPU limit, not zero

    expect(memory.stats?.cpu.bucket).toBe(9500);
    expect(memory.stats?.cpu.bucket).not.toBe(0); // Should be real bucket value, not zero

    expect(memory.stats?.creeps.count).toBe(2);
    expect(memory.stats?.creeps.count).not.toBe(0); // Should be real creep count, not zero

    expect(memory.stats?.rooms.count).toBe(1);
    expect(memory.stats?.rooms.count).not.toBe(0); // Should be real room count, not zero

    // Verify room-specific data is collected
    const roomStats = memory.stats?.rooms?.E54N39;
    expect(roomStats).toBeDefined();
    if (typeof roomStats === "object") {
      expect(roomStats.energyAvailable).toBe(800);
      expect(roomStats.energyCapacityAvailable).toBe(1050);
      expect(roomStats.controllerLevel).toBe(4);
    }
  });

  it("should collect complete telemetry for baseline establishment", () => {
    const collector = new StatsCollector();
    const game = {
      time: 12356,
      cpu: {
        getUsed: () => 6.5,
        limit: 20,
        bucket: 9500
      },
      creeps: {
        harvester1: { memory: { role: "harvester" } },
        harvester2: { memory: { role: "harvester" } },
        upgrader1: { memory: { role: "upgrader" } },
        builder1: { memory: { role: "builder" } }
      },
      spawns: {
        Spawn1: { spawning: { name: "harvester3" } },
        Spawn2: { spawning: null }
      },
      rooms: {
        E54N39: {
          energyAvailable: 800,
          energyCapacityAvailable: 800,
          controller: {
            level: 3,
            progress: 125731,
            progressTotal: 135000
          },
          find: (type: number) => {
            if (type === 107) {
              return [
                { structureType: "storage", store: { energy: 15000 } },
                { structureType: "container", store: { energy: 2000 } },
                { structureType: "extension", store: {} },
                { structureType: "tower", store: { energy: 500 } },
                { structureType: "spawn", store: {} }
              ];
            }
            if (type === 111) {
              return [{ structureType: "extension" }, { structureType: "road" }];
            }
            return [];
          }
        }
      }
    };

    const snapshot: PerformanceSnapshot = {
      tick: 12356,
      cpuUsed: 6.5,
      cpuLimit: 20,
      cpuBucket: 9500,
      creepCount: 4,
      roomCount: 1,
      spawnOrders: 0,
      warnings: [],
      execution: {
        processedCreeps: 4,
        spawnedCreeps: [],
        tasksExecuted: {}
      }
    };

    const memory = {} as Memory;
    collector.collect(game, memory, snapshot);

    // Validate complete baseline-ready structure
    expect(memory.stats).toBeDefined();

    // CPU metrics for baseline
    expect(memory.stats?.cpu.used).toBe(6.5);
    expect(memory.stats?.cpu.limit).toBe(20);
    expect(memory.stats?.cpu.bucket).toBe(9500);

    // Creep metrics by role for baseline
    expect(memory.stats?.creeps.count).toBe(4);
    expect(memory.stats?.creeps.byRole).toEqual({
      harvester: 2,
      upgrader: 1,
      builder: 1
    });

    // Spawn utilization for baseline
    expect(memory.stats?.spawns).toBe(2);
    expect(memory.stats?.activeSpawns).toBe(1);

    // Structure counts for baseline
    expect(memory.stats?.structures).toBeDefined();
    expect(memory.stats?.structures?.spawns).toBe(1);
    expect(memory.stats?.structures?.extensions).toBe(1);
    expect(memory.stats?.structures?.containers).toBe(1);
    expect(memory.stats?.structures?.towers).toBe(1);

    // Construction sites for baseline
    expect(memory.stats?.constructionSites).toEqual({
      count: 2,
      byType: { extension: 1, road: 1 }
    });

    // Room-specific metrics for baseline
    const roomStats = memory.stats?.rooms?.E54N39;
    expect(roomStats).toBeDefined();
    if (typeof roomStats === "object") {
      expect(roomStats.energyAvailable).toBe(800);
      expect(roomStats.energyCapacityAvailable).toBe(800);
      expect(roomStats.controllerLevel).toBe(3);
      expect(roomStats.controllerProgress).toBe(125731);
      expect(roomStats.controllerProgressTotal).toBe(135000);
      expect(roomStats.energyStored).toBe(17000); // 15000 + 2000
      expect(roomStats.constructionSites).toBe(2);
    }
  });
});
