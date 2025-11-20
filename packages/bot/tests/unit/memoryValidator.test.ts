import { describe, it, expect } from "vitest";
import { MemoryValidator } from "../../src/runtime/memory/MemoryValidator";

describe("MemoryValidator", () => {
  describe("validateStats", () => {
    it("should validate a complete valid stats object", () => {
      const validStats = {
        time: 12345,
        lastTimeoutTick: 12300,
        cpu: {
          used: 10.5,
          limit: 20,
          bucket: 9500
        },
        creeps: {
          count: 5
        },
        rooms: {
          count: 2,
          W1N1: {
            energyAvailable: 300,
            energyCapacityAvailable: 550,
            controllerLevel: 3,
            controllerProgress: 1500,
            controllerProgressTotal: 45000
          },
          W2N2: 1
        },
        spawn: {
          orders: 2
        }
      };

      const result = MemoryValidator.validateStats(validStats);
      expect(result).not.toBeNull();
      expect(result?.time).toBe(12345);
      expect(result?.lastTimeoutTick).toBe(12300);
      expect(result?.cpu.used).toBe(10.5);
      expect(result?.spawn?.orders).toBe(2);
    });

    it("should validate stats without optional lastTimeoutTick", () => {
      const validStats = {
        time: 1000,
        cpu: {
          used: 5,
          limit: 20,
          bucket: 10000
        },
        creeps: {
          count: 0
        },
        rooms: {
          count: 1
        }
      };

      const result = MemoryValidator.validateStats(validStats);
      expect(result).not.toBeNull();
      expect(result?.lastTimeoutTick).toBeUndefined();
    });

    it("should validate stats without optional spawn field", () => {
      const validStats = {
        time: 1000,
        cpu: {
          used: 5,
          limit: 20,
          bucket: 10000
        },
        creeps: {
          count: 0
        },
        rooms: {
          count: 1
        }
      };

      const result = MemoryValidator.validateStats(validStats);
      expect(result).not.toBeNull();
      expect(result?.spawn).toBeUndefined();
    });

    it("should reject stats with missing required time field", () => {
      const invalidStats = {
        cpu: {
          used: 5,
          limit: 20,
          bucket: 10000
        },
        creeps: {
          count: 0
        },
        rooms: {
          count: 1
        }
      };

      const result = MemoryValidator.validateStats(invalidStats);
      expect(result).toBeNull();
    });

    it("should reject stats with missing cpu field", () => {
      const invalidStats = {
        time: 1000,
        creeps: {
          count: 0
        },
        rooms: {
          count: 1
        }
      };

      const result = MemoryValidator.validateStats(invalidStats);
      expect(result).toBeNull();
    });

    it("should reject stats with incomplete cpu object", () => {
      const invalidStats = {
        time: 1000,
        cpu: {
          used: 5,
          limit: 20
          // missing bucket
        },
        creeps: {
          count: 0
        },
        rooms: {
          count: 1
        }
      };

      const result = MemoryValidator.validateStats(invalidStats);
      expect(result).toBeNull();
    });

    it("should reject stats with wrong type for time", () => {
      const invalidStats = {
        time: "not a number",
        cpu: {
          used: 5,
          limit: 20,
          bucket: 10000
        },
        creeps: {
          count: 0
        },
        rooms: {
          count: 1
        }
      };

      const result = MemoryValidator.validateStats(invalidStats);
      expect(result).toBeNull();
    });

    it("should validate complex room stats with mixed types", () => {
      const validStats = {
        time: 5000,
        cpu: { used: 10, limit: 20, bucket: 9000 },
        creeps: { count: 3 },
        rooms: {
          count: 3,
          W1N1: {
            energyAvailable: 300,
            energyCapacityAvailable: 550
          },
          W2N2: 100,
          W3N3: {
            energyAvailable: 500,
            energyCapacityAvailable: 1300,
            controllerLevel: 5,
            controllerProgress: 50000,
            controllerProgressTotal: 135000
          }
        }
      };

      const result = MemoryValidator.validateStats(validStats);
      expect(result).not.toBeNull();
      expect(result?.rooms.count).toBe(3);
    });

    it("should reject null or undefined input", () => {
      expect(MemoryValidator.validateStats(null)).toBeNull();
      expect(MemoryValidator.validateStats(undefined)).toBeNull();
    });

    it("should reject non-object input", () => {
      expect(MemoryValidator.validateStats("string")).toBeNull();
      expect(MemoryValidator.validateStats(123)).toBeNull();
      expect(MemoryValidator.validateStats(true)).toBeNull();
    });
  });

  describe("validateAndRepairStats", () => {
    it("should initialize missing stats with defaults", () => {
      const memory: Memory = {} as Memory;
      const currentTick = 1000;

      const result = MemoryValidator.validateAndRepairStats(memory, currentTick);

      expect(result).toBe(true);
      expect(memory.stats).toBeDefined();
      expect(memory.stats?.time).toBe(currentTick);
      expect(memory.stats?.cpu).toEqual({ used: 0, limit: 0, bucket: 0 });
      expect(memory.stats?.creeps).toEqual({ count: 0 });
      expect(memory.stats?.rooms).toEqual({ count: 0 });
    });

    it("should preserve valid stats", () => {
      const validStats = {
        time: 12345,
        lastTimeoutTick: 12300,
        cpu: { used: 10, limit: 20, bucket: 9500 },
        creeps: { count: 5 },
        rooms: { count: 2, W1N1: 1 }
      };
      const memory: Memory = { stats: validStats } as Memory;

      const result = MemoryValidator.validateAndRepairStats(memory, 12345);

      expect(result).toBe(true);
      expect(memory.stats).toEqual(validStats);
    });

    it("should repair corrupted stats while preserving lastTimeoutTick", () => {
      const memory: Memory = {
        stats: {
          time: 1000,
          lastTimeoutTick: 950,
          cpu: { used: 5 } // incomplete
        } as Memory["stats"]
      } as Memory;

      const result = MemoryValidator.validateAndRepairStats(memory, 1000);

      expect(result).toBe(true);
      expect(memory.stats?.lastTimeoutTick).toBe(950);
      expect(memory.stats?.cpu).toEqual({ used: 0, limit: 0, bucket: 0 });
      expect(memory.stats?.creeps).toEqual({ count: 0 });
      expect(memory.stats?.rooms).toEqual({ count: 0 });
    });

    it("should handle stats with only lastTimeoutTick defined", () => {
      const memory: Memory = {
        stats: { lastTimeoutTick: 500 } as Memory["stats"]
      } as Memory;

      const result = MemoryValidator.validateAndRepairStats(memory, 1000);

      expect(result).toBe(true);
      expect(memory.stats?.lastTimeoutTick).toBe(500);
      expect(memory.stats?.time).toBe(1000);
    });
  });
});
