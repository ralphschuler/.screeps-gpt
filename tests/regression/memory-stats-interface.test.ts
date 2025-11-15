import { describe, it, expect } from "vitest";

/**
 * Regression test for Memory.stats interface conflict
 *
 * Issue: profiler/typings.d.ts declared `interface Memory` without `declare global`,
 * creating a conflicting local interface that prevented TypeScript from recognizing
 * Memory.stats as a valid property.
 *
 * Solution: Removed the conflicting Memory interface declaration from profiler/typings.d.ts
 * and ensured all Memory interface extensions use `declare global`.
 *
 * This test verifies that Memory.stats is properly recognized by TypeScript.
 */
describe("Memory Interface - Stats Property", () => {
  it("should recognize Memory.stats as a valid property", () => {
    // Create a minimal Memory object with stats
    const memory: Memory = {
      stats: {
        time: 12345,
        cpu: {
          used: 5.5,
          limit: 10,
          bucket: 8500
        },
        creeps: {
          count: 3
        },
        rooms: {
          count: 1,
          W1N1: {
            energyAvailable: 300,
            energyCapacityAvailable: 550,
            controllerLevel: 3,
            controllerProgress: 25000,
            controllerProgressTotal: 45000
          }
        }
      }
    };

    // TypeScript should compile this without errors
    expect(memory.stats).toBeDefined();
    expect(memory.stats?.time).toBe(12345);
    expect(memory.stats?.cpu.used).toBe(5.5);
    expect(memory.stats?.creeps.count).toBe(3);
    expect(memory.stats?.rooms.count).toBe(1);
  });

  it("should allow optional stats property", () => {
    // Memory.stats should be optional
    const memory: Memory = {};

    expect(memory.stats).toBeUndefined();
  });

  it("should support profiler property alongside stats", () => {
    // Verify that both profiler and stats properties can coexist
    const memory: Memory = {
      profiler: {
        data: {},
        total: 0
      },
      stats: {
        time: 12345,
        cpu: { used: 5.5, limit: 10, bucket: 8500 },
        creeps: { count: 3 },
        rooms: { count: 1 }
      }
    };

    expect(memory.profiler).toBeDefined();
    expect(memory.stats).toBeDefined();
    expect(memory.profiler?.total).toBe(0);
    expect(memory.stats?.time).toBe(12345);
  });

  it("should allow stats with spawn orders", () => {
    const memory: Memory = {
      stats: {
        time: 12345,
        cpu: { used: 5.5, limit: 10, bucket: 8500 },
        creeps: { count: 3 },
        rooms: { count: 1 },
        spawn: {
          orders: 2
        }
      }
    };

    expect(memory.stats?.spawn?.orders).toBe(2);
  });

  it("should allow accessing nested room stats", () => {
    const memory: Memory = {
      stats: {
        time: 12345,
        cpu: { used: 5.5, limit: 10, bucket: 8500 },
        creeps: { count: 3 },
        rooms: {
          count: 2,
          W1N1: {
            energyAvailable: 300,
            energyCapacityAvailable: 550,
            controllerLevel: 3,
            controllerProgress: 25000,
            controllerProgressTotal: 45000
          },
          W2N2: {
            energyAvailable: 800,
            energyCapacityAvailable: 1300
          }
        }
      }
    };

    const w1n1Stats = memory.stats?.rooms?.W1N1;
    expect(w1n1Stats).toBeDefined();

    if (typeof w1n1Stats === "object" && "energyAvailable" in w1n1Stats) {
      expect(w1n1Stats.energyAvailable).toBe(300);
      expect(w1n1Stats.controllerLevel).toBe(3);
    }

    const w2n2Stats = memory.stats?.rooms?.W2N2;
    if (typeof w2n2Stats === "object" && "energyAvailable" in w2n2Stats) {
      expect(w2n2Stats.energyAvailable).toBe(800);
      expect(w2n2Stats.controllerLevel).toBeUndefined();
    }
  });
});
