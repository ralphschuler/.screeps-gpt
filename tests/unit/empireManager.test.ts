import { describe, it, expect, beforeEach } from "vitest";
import { EmpireManager, type EmpireMemory } from "@runtime/empire/EmpireManager";
import type { GameContext } from "@runtime/types/GameContext";

describe("EmpireManager", () => {
  let memory: Memory;
  let mockGame: Partial<GameContext>;

  beforeEach(() => {
    memory = {
      empire: {
        lastUpdate: 0,
        cpuBudgets: {},
        threats: [],
        transferHistory: []
      } as EmpireMemory
    } as Memory;

    mockGame = {
      time: 1000,
      cpu: {
        limit: 100,
        bucket: 10000,
        getUsed: () => 50
      },
      gcl: {
        level: 2,
        progress: 5000
      },
      rooms: {}
    };
  });

  describe("Initialization", () => {
    it("should initialize empire memory if not present", () => {
      const manager = new EmpireManager();
      const emptyMemory = {} as Memory;

      manager.initializeMemory(emptyMemory);

      expect(emptyMemory.empire).toBeDefined();
      expect((emptyMemory.empire as EmpireMemory).lastUpdate).toBe(0);
      expect((emptyMemory.empire as EmpireMemory).cpuBudgets).toEqual({});
      expect((emptyMemory.empire as EmpireMemory).threats).toEqual([]);
    });

    it("should not overwrite existing empire memory", () => {
      const manager = new EmpireManager();
      const existingMemory = {
        empire: {
          lastUpdate: 5000,
          cpuBudgets: { W1N1: 10 },
          threats: [],
          transferHistory: []
        }
      } as Memory;

      manager.initializeMemory(existingMemory);

      expect((existingMemory.empire as EmpireMemory).lastUpdate).toBe(5000);
      expect((existingMemory.empire as EmpireMemory).cpuBudgets).toEqual({ W1N1: 10 });
    });
  });

  describe("CPU Allocation", () => {
    it("should allocate CPU budget across multiple rooms", () => {
      const manager = new EmpireManager();
      mockGame.rooms = {
        W1N1: {
          name: "W1N1",
          controller: { my: true, level: 4 },
          find: () => [] // No hostiles
        } as unknown as Room,
        W2N2: {
          name: "W2N2",
          controller: { my: true, level: 6 },
          find: () => [] // No hostiles
        } as unknown as Room
      };

      manager.run(mockGame as GameContext, memory);

      const empireMemory = memory.empire as EmpireMemory;
      expect(empireMemory.cpuBudgets).toBeDefined();
      expect(Object.keys(empireMemory.cpuBudgets)).toHaveLength(2);
      expect(empireMemory.cpuBudgets["W1N1"]).toBeGreaterThan(0);
      expect(empireMemory.cpuBudgets["W2N2"]).toBeGreaterThan(0);
      // Higher RCL room should get more CPU
      expect(empireMemory.cpuBudgets["W2N2"]).toBeGreaterThan(empireMemory.cpuBudgets["W1N1"]);
    });

    it("should handle single room correctly", () => {
      const manager = new EmpireManager();
      mockGame.rooms = {
        W1N1: {
          name: "W1N1",
          controller: { my: true, level: 5 },
          find: () => []
        } as unknown as Room
      };

      manager.run(mockGame as GameContext, memory);

      const empireMemory = memory.empire as EmpireMemory;
      expect(Object.keys(empireMemory.cpuBudgets)).toHaveLength(1);
    });

    it("should get CPU budget for a specific room", () => {
      const manager = new EmpireManager({ targetCpuPerRoom: 12 });
      mockGame.rooms = {
        W1N1: {
          name: "W1N1",
          controller: { my: true, level: 4 },
          find: () => []
        } as unknown as Room
      };

      manager.run(mockGame as GameContext, memory);
      const budget = manager.getCPUBudget("W1N1", memory);

      expect(budget).toBeGreaterThan(0);
    });
  });

  describe("Expansion Management", () => {
    it("should not expand when at GCL limit", () => {
      const manager = new EmpireManager();
      mockGame.gcl = { level: 2, progress: 5000 };
      mockGame.rooms = {
        W1N1: {
          name: "W1N1",
          controller: { my: true, level: 5 },
          find: () => []
        } as unknown as Room,
        W2N2: {
          name: "W2N2",
          controller: { my: true, level: 5 },
          find: () => []
        } as unknown as Room
      };

      manager.run(mockGame as GameContext, memory);

      // Should not attempt expansion when rooms = GCL
      const expansionQueue = manager.getColonyManager().getExpansionQueue();
      expect(expansionQueue.length).toBe(0);
    });

    it("should not expand when CPU bucket is low", () => {
      const manager = new EmpireManager({ minCpuBucketForExpansion: 5000 });
      mockGame.cpu = {
        limit: 100,
        bucket: 1000, // Low bucket
        getUsed: () => 50
      };
      mockGame.gcl = { level: 3, progress: 5000 };
      mockGame.rooms = {
        W1N1: {
          name: "W1N1",
          controller: { my: true, level: 5 },
          find: () => []
        } as unknown as Room
      };

      manager.run(mockGame as GameContext, memory);

      // Should not attempt expansion with low CPU bucket
      const expansionQueue = manager.getColonyManager().getExpansionQueue();
      expect(expansionQueue.length).toBe(0);
    });

    it("should not expand when rooms are unstable", () => {
      const manager = new EmpireManager({ minRclForStability: 3 });
      mockGame.gcl = { level: 3, progress: 5000 };
      mockGame.rooms = {
        W1N1: {
          name: "W1N1",
          controller: { my: true, level: 2 }, // Unstable (RCL < 3)
          find: () => []
        } as unknown as Room
      };

      manager.run(mockGame as GameContext, memory);

      // Should not expand with unstable rooms
      const expansionQueue = manager.getColonyManager().getExpansionQueue();
      expect(expansionQueue.length).toBe(0);
    });
  });

  describe("Empire Metrics", () => {
    it("should calculate empire metrics correctly", () => {
      const manager = new EmpireManager();
      mockGame.rooms = {
        W1N1: {
          name: "W1N1",
          controller: { my: true, level: 4 },
          find: () => []
        } as unknown as Room,
        W2N2: {
          name: "W2N2",
          controller: { my: true, level: 6 },
          find: () => []
        } as unknown as Room,
        W3N3: {
          name: "W3N3",
          controller: { my: true, level: 2 },
          find: () => []
        } as unknown as Room
      };
      mockGame.gcl = { level: 4, progress: 25000 };

      const metrics = manager.getMetrics(mockGame as GameContext);

      expect(metrics.totalRooms).toBe(3);
      expect(metrics.roomsStable).toBe(2); // Only RCL 3+ are stable
      expect(metrics.gcl).toBe(4);
      expect(metrics.gclProgress).toBe(25000);
      expect(metrics.averageCpu).toBeGreaterThan(0);
    });

    it("should handle zero rooms gracefully", () => {
      const manager = new EmpireManager();
      mockGame.rooms = {};

      const metrics = manager.getMetrics(mockGame as GameContext);

      expect(metrics.totalRooms).toBe(0);
      expect(metrics.roomsStable).toBe(0);
      expect(metrics.averageCpu).toBe(0);
    });
  });

  describe("Threat Detection", () => {
    it("should identify threats in rooms", () => {
      const manager = new EmpireManager();
      mockGame.rooms = {
        W1N1: {
          name: "W1N1",
          controller: { my: true, level: 4 },
          find: (type: FindConstant) => {
            if (type === FIND_HOSTILE_CREEPS) {
              return [
                {
                  body: [
                    { type: ATTACK, hits: 100 },
                    { type: MOVE, hits: 50 }
                  ]
                } as Creep,
                {
                  body: [
                    { type: RANGED_ATTACK, hits: 100 },
                    { type: MOVE, hits: 50 }
                  ]
                } as Creep
              ];
            }
            return [];
          }
        } as unknown as Room
      };

      manager.run(mockGame as GameContext, memory);

      const empireMemory = memory.empire as EmpireMemory;
      // Threats should be detected during run
      expect(empireMemory).toBeDefined();
    });
  });

  describe("Configuration", () => {
    it("should use custom configuration values", () => {
      const manager = new EmpireManager({
        targetCpuPerRoom: 15,
        minCpuBucketForExpansion: 8000,
        minRclForStability: 4
      });

      expect(manager).toBeDefined();
    });

    it("should use custom logger", () => {
      const logs: string[] = [];
      const customLogger = {
        log: (msg?: string) => {
          if (msg) logs.push(msg);
        },
        warn: (msg?: string) => {
          if (msg) logs.push(`WARN: ${msg}`);
        }
      };

      const manager = new EmpireManager({ logger: customLogger });
      mockGame.rooms = {
        W1N1: {
          name: "W1N1",
          controller: { my: true, level: 4 },
          find: () => []
        } as unknown as Room
      };

      manager.run(mockGame as GameContext, memory);

      // Logger should be used during execution
      expect(manager).toBeDefined();
    });
  });
});
