import { describe, it, expect, beforeEach } from "vitest";
import { Diagnostics } from "@runtime/utils/Diagnostics";

describe("Diagnostics", () => {
  describe("testStatsCollection", () => {
    beforeEach(() => {
      // Reset global Game and Memory before each test
      global.Game = {
        time: 12345,
        cpu: {
          getUsed: () => 10.5,
          limit: 100,
          bucket: 9500
        },
        creeps: {
          harvester1: { name: "harvester1" }
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
      } as unknown as Game;

      global.Memory = {} as Memory;
    });

    it("should successfully collect stats and return success message", () => {
      const result = Diagnostics.testStatsCollection();

      expect(result).toContain("✅ Stats collection successful");
      expect(result).toContain("time");
      expect(result).toContain("cpu");
      expect(result).toContain("rooms");
      expect(result).toContain("creeps");
      expect(Memory.stats).toBeDefined();
    });

    it("should populate Memory.stats with expected structure", () => {
      Diagnostics.testStatsCollection();

      expect(Memory.stats).toBeDefined();
      expect(Memory.stats?.time).toBe(12345);
      expect(Memory.stats?.cpu).toBeDefined();
      expect(Memory.stats?.cpu?.used).toBeGreaterThanOrEqual(0);
      expect(Memory.stats?.cpu?.limit).toBe(100);
      expect(Memory.stats?.cpu?.bucket).toBe(9500);
      expect(Memory.stats?.rooms).toBeDefined();
      expect(Memory.stats?.creeps).toBeDefined();
    });

    it("should handle Game object unavailability", () => {
      // @ts-expect-error - Testing undefined Game
      global.Game = undefined;

      const result = Diagnostics.testStatsCollection();

      expect(result).toContain("❌");
      expect(result).toContain("Game object not available");
    });

    it("should handle Memory object unavailability", () => {
      // @ts-expect-error - Testing undefined Memory
      global.Memory = undefined;

      const result = Diagnostics.testStatsCollection();

      expect(result).toContain("❌");
      expect(result).toContain("Memory object not available");
    });

    it("should handle errors during stats collection", () => {
      // Create a broken Game object that will cause an error
      global.Game = {
        time: 12345,
        cpu: {
          getUsed: () => {
            throw new Error("CPU error");
          },
          limit: 100,
          bucket: 9500
        }
      } as unknown as Game;

      const result = Diagnostics.testStatsCollection();

      expect(result).toContain("❌");
      expect(result).toContain("error");
    });
  });

  describe("validateMemoryStats", () => {
    beforeEach(() => {
      global.Memory = {} as Memory;
    });

    it("should validate complete and valid Memory.stats structure", () => {
      Memory.stats = {
        time: 12345,
        cpu: {
          used: 10.5,
          limit: 100,
          bucket: 9500
        },
        rooms: {
          count: 1,
          W1N1: {
            energyAvailable: 300,
            energyCapacityAvailable: 550
          }
        },
        creeps: {
          count: 5
        }
      };

      const result = Diagnostics.validateMemoryStats();

      expect(result).toContain("✅");
      expect(result).toContain("Memory.stats structure valid");
      expect(result).toContain("bytes");
    });

    it("should detect undefined Memory.stats", () => {
      Memory.stats = undefined;

      const result = Diagnostics.validateMemoryStats();

      expect(result).toContain("❌");
      expect(result).toContain("Memory.stats is undefined");
    });

    it("should detect missing top-level keys", () => {
      Memory.stats = {
        time: 12345,
        cpu: {
          used: 10.5,
          limit: 100,
          bucket: 9500
        }
        // Missing rooms and creeps
      } as Memory["stats"];

      const result = Diagnostics.validateMemoryStats();

      expect(result).toContain("⚠️");
      expect(result).toContain("Missing keys");
      expect(result).toContain("rooms");
      expect(result).toContain("creeps");
    });

    it("should detect invalid CPU structure", () => {
      Memory.stats = {
        time: 12345,
        cpu: null as unknown as Memory["stats"]["cpu"],
        rooms: { count: 0 },
        creeps: { count: 0 }
      } as Memory["stats"];

      const result = Diagnostics.validateMemoryStats();

      expect(result).toContain("⚠️");
      expect(result).toContain("cpu");
      expect(result).toContain("invalid");
    });

    it("should detect missing CPU keys", () => {
      Memory.stats = {
        time: 12345,
        cpu: {
          used: 10.5
          // Missing limit and bucket
        } as Memory["stats"]["cpu"],
        rooms: { count: 0 },
        creeps: { count: 0 }
      } as Memory["stats"];

      const result = Diagnostics.validateMemoryStats();

      expect(result).toContain("⚠️");
      expect(result).toContain("Missing CPU keys");
      expect(result).toContain("limit");
      expect(result).toContain("bucket");
    });

    it("should detect invalid rooms structure", () => {
      Memory.stats = {
        time: 12345,
        cpu: {
          used: 10.5,
          limit: 100,
          bucket: 9500
        },
        rooms: null as unknown as Memory["stats"]["rooms"],
        creeps: { count: 0 }
      } as Memory["stats"];

      const result = Diagnostics.validateMemoryStats();

      expect(result).toContain("⚠️");
      expect(result).toContain("rooms");
      expect(result).toContain("invalid");
    });

    it("should detect invalid creeps structure", () => {
      Memory.stats = {
        time: 12345,
        cpu: {
          used: 10.5,
          limit: 100,
          bucket: 9500
        },
        rooms: { count: 0 },
        creeps: null as unknown as Memory["stats"]["creeps"]
      } as Memory["stats"];

      const result = Diagnostics.validateMemoryStats();

      expect(result).toContain("⚠️");
      expect(result).toContain("creeps");
      expect(result).toContain("invalid");
    });

    it("should handle Memory object unavailability", () => {
      // @ts-expect-error - Testing undefined Memory
      global.Memory = undefined;

      const result = Diagnostics.validateMemoryStats();

      expect(result).toContain("❌");
      expect(result).toContain("Memory object not available");
    });
  });

  describe("getLastSnapshot", () => {
    beforeEach(() => {
      global.Memory = {} as Memory;
    });

    it("should return systemReport when available", () => {
      Memory.systemReport = {
        lastGenerated: 12345,
        report: {
          tick: 12345,
          summary: "System healthy",
          findings: []
        }
      };

      const result = Diagnostics.getLastSnapshot();

      expect(result).toBeTypeOf("object");
      expect(result).toHaveProperty("lastGenerated");
      expect(result).toHaveProperty("report");
      if (typeof result === "object" && result !== null) {
        expect((result as { lastGenerated: number }).lastGenerated).toBe(12345);
        expect((result as { report: { tick: number } }).report.tick).toBe(12345);
      }
    });

    it("should detect missing systemReport", () => {
      Memory.systemReport = undefined;

      const result = Diagnostics.getLastSnapshot();

      expect(result).toBeTypeOf("string");
      expect(result).toContain("❌");
      expect(result).toContain("No PerformanceSnapshot data available");
    });

    it("should handle Memory object unavailability", () => {
      // @ts-expect-error - Testing undefined Memory
      global.Memory = undefined;

      const result = Diagnostics.getLastSnapshot();

      expect(result).toContain("❌");
      expect(result).toContain("Memory object not available");
    });
  });

  describe("getSystemInfo", () => {
    beforeEach(() => {
      global.Game = {
        time: 12345,
        cpu: {
          getUsed: () => 10.5,
          limit: 100,
          bucket: 9500
        },
        creeps: {
          harvester1: { name: "harvester1" },
          upgrader1: { name: "upgrader1" }
        },
        rooms: {
          W1N1: { name: "W1N1" }
        },
        spawns: {
          Spawn1: { name: "Spawn1" }
        }
      } as unknown as Game;

      global.Memory = {
        stats: {
          time: 12345,
          cpu: { used: 10, limit: 100, bucket: 9500 },
          rooms: { count: 1 },
          creeps: { count: 2 }
        },
        systemReport: {
          lastGenerated: 12345,
          report: { tick: 12345, summary: "OK", findings: [] }
        }
      } as Memory;
    });

    it("should return comprehensive system information", () => {
      const result = Diagnostics.getSystemInfo();

      expect(result).toBeTypeOf("object");
      if (typeof result === "object" && result !== null) {
        const info = result as {
          game: { time: number; cpu: { used: number; limit: number; bucket: number } };
          memory: { hasStats: boolean; hasSystemReport: boolean };
        };

        expect(info.game).toBeDefined();
        expect(info.game.time).toBe(12345);
        expect(info.game.cpu.used).toBe(10.5);
        expect(info.game.cpu.limit).toBe(100);
        expect(info.game.cpu.bucket).toBe(9500);

        expect(info.memory).toBeDefined();
        expect(info.memory.hasStats).toBe(true);
        expect(info.memory.hasSystemReport).toBe(true);
      }
    });

    it("should handle Game object unavailability", () => {
      // @ts-expect-error - Testing undefined Game
      global.Game = undefined;

      const result = Diagnostics.getSystemInfo();

      expect(result).toContain("❌");
      expect(result).toContain("Game or Memory objects not available");
    });

    it("should handle Memory object unavailability", () => {
      // @ts-expect-error - Testing undefined Memory
      global.Memory = undefined;

      const result = Diagnostics.getSystemInfo();

      expect(result).toContain("❌");
      expect(result).toContain("Game or Memory objects not available");
    });

    it("should handle missing Memory.stats and Memory.systemReport", () => {
      global.Memory = {} as Memory;

      const result = Diagnostics.getSystemInfo();

      if (typeof result === "object" && result !== null) {
        const info = result as { memory: { hasStats: boolean; hasSystemReport: boolean; statsKeys: string[] } };
        expect(info.memory.hasStats).toBe(false);
        expect(info.memory.hasSystemReport).toBe(false);
        expect(info.memory.statsKeys).toEqual([]);
      }
    });
  });
});
