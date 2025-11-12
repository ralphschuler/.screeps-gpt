import { describe, it, expect, beforeEach } from "vitest";
import { Kernel } from "@runtime/bootstrap/kernel";
import type { GameContext } from "@runtime/types/GameContext";

/**
 * Regression test for issue #550 (and #523, #331, #345)
 *
 * Ensures Memory.stats is consistently populated on every kernel execution,
 * preventing telemetry blackout regressions where /api/user/stats returns empty data.
 *
 * Root Cause: Memory.stats must be written on EVERY tick for the Screeps API
 * to sync it to /api/user/stats endpoint. If stats collection is skipped for
 * any reason (CPU timeout, early return, exception), telemetry goes dark.
 */
describe("Regression: Stats Collection Blackout (#550, #523)", () => {
  let memory: Memory;
  let game: GameContext;

  beforeEach(() => {
    // Reset memory to simulate fresh state
    memory = {} as Memory;

    // Create minimal game context
    game = {
      time: 12345,
      cpu: {
        getUsed: () => 5.0,
        limit: 100,
        bucket: 9500,
        tickLimit: 500,
        shardLimits: {}
      },
      creeps: {},
      spawns: {},
      rooms: {
        W1N1: {
          name: "W1N1",
          energyAvailable: 300,
          energyCapacityAvailable: 550,
          controller: {
            level: 3,
            progress: 25000,
            progressTotal: 45000,
            my: true
          }
        }
      },
      flags: {},
      structures: {},
      constructionSites: {}
    } as GameContext;
  });

  it("should populate Memory.stats on successful kernel execution", () => {
    const kernel = new Kernel();
    kernel.run(game, memory);

    expect(memory.stats).toBeDefined();
    expect(memory.stats?.time).toBe(game.time);
    expect(memory.stats?.cpu).toBeDefined();
    expect(memory.stats?.cpu?.used).toBeGreaterThanOrEqual(0);
    expect(memory.stats?.cpu?.limit).toBe(game.cpu.limit);
    expect(memory.stats?.cpu?.bucket).toBe(game.cpu.bucket);
    expect(memory.stats?.rooms).toBeDefined();
    expect(memory.stats?.creeps).toBeDefined();
  });

  it("should populate Memory.stats even when CPU threshold is exceeded", () => {
    // Simulate CPU emergency scenario
    game.cpu.getUsed = () => 95; // 95% of 100 limit (exceeds 90% threshold)

    const kernel = new Kernel({ cpuEmergencyThreshold: 0.9 });
    kernel.run(game, memory);

    // Stats MUST be collected even in emergency CPU abort
    expect(memory.stats).toBeDefined();
    expect(memory.stats?.time).toBe(game.time);
    expect(memory.stats?.cpu?.used).toBeGreaterThanOrEqual(0);
  });

  it("should populate Memory.stats even when memory corruption is detected", () => {
    // Simulate corrupted memory that triggers self-healing
    memory.creeps = null as unknown as Memory["creeps"]; // Corruption

    const kernel = new Kernel({ enableSelfHealing: true });
    kernel.run(game, memory);

    // Stats MUST be collected even after emergency reset
    expect(memory.stats).toBeDefined();
    expect(memory.stats?.time).toBe(game.time);
  });

  it("should populate Memory.stats even when respawn is needed", () => {
    // Simulate respawn condition (no spawns, no creeps, no construction sites)
    game.spawns = {};
    game.creeps = {};
    game.constructionSites = {};
    memory.respawn = {
      lastCheck: game.time - 100,
      respawnDetected: false
    };

    const kernel = new Kernel();
    kernel.run(game, memory);

    // Stats MUST be collected even when respawn is detected
    expect(memory.stats).toBeDefined();
    expect(memory.stats?.time).toBe(game.time);
  });

  it("should update Memory.stats with current tick data on each execution", () => {
    const kernel = new Kernel();

    // First execution
    kernel.run(game, memory);
    const firstTickStats = memory.stats;
    expect(firstTickStats?.time).toBe(12345);

    // Second execution with new tick
    game.time = 12346;
    kernel.run(game, memory);
    const secondTickStats = memory.stats;

    expect(secondTickStats?.time).toBe(12346);
    expect(secondTickStats?.time).not.toBe(firstTickStats?.time);
  });

  it("should ensure stats contain all required telemetry fields", () => {
    const kernel = new Kernel();
    kernel.run(game, memory);

    expect(memory.stats).toBeDefined();
    const stats = memory.stats!;

    // Required fields for monitoring
    expect(stats.time).toBeDefined();
    expect(stats.cpu).toBeDefined();
    expect(stats.cpu.used).toBeTypeOf("number");
    expect(stats.cpu.limit).toBeTypeOf("number");
    expect(stats.cpu.bucket).toBeTypeOf("number");
    expect(stats.rooms).toBeDefined();
    expect(stats.rooms.count).toBeTypeOf("number");
    expect(stats.creeps).toBeDefined();
    expect(stats.creeps.count).toBeTypeOf("number");
  });

  it("should include per-room statistics in Memory.stats", () => {
    const kernel = new Kernel();
    kernel.run(game, memory);

    expect(memory.stats?.rooms?.W1N1).toBeDefined();
    const roomStats = memory.stats?.rooms?.W1N1;

    if (typeof roomStats === "object" && roomStats !== null) {
      expect(roomStats.energyAvailable).toBe(300);
      expect(roomStats.energyCapacityAvailable).toBe(550);
      expect(roomStats.controllerLevel).toBe(3);
      expect(roomStats.controllerProgress).toBe(25000);
      expect(roomStats.controllerProgressTotal).toBe(45000);
    } else {
      throw new Error("Room stats should be an object");
    }
  });

  it("should maintain consistent stats format across multiple ticks", () => {
    const kernel = new Kernel();

    // Execute multiple ticks
    for (let i = 0; i < 5; i++) {
      game.time = 12345 + i;
      kernel.run(game, memory);

      expect(memory.stats).toBeDefined();
      expect(memory.stats?.time).toBe(game.time);

      // Verify structure consistency
      expect(memory.stats?.cpu).toBeDefined();
      expect(memory.stats?.rooms).toBeDefined();
      expect(memory.stats?.creeps).toBeDefined();
    }
  });
});
