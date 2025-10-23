import { describe, expect, it, vi } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { GameContext } from "@runtime/types/GameContext";

function createGameContext(options: { time: number; hasSpawns: boolean }): GameContext {
  const dummySpawn = {
    name: "spawn1",
    spawning: null,
    spawnCreep: vi.fn().mockReturnValue(OK),
    store: { getFreeCapacity: () => 300, getUsedCapacity: () => 0 },
    room: { controller: null, find: () => [] }
  };

  return {
    time: options.time,
    cpu: {
      getUsed: () => 0,
      limit: 10,
      bucket: 1000
    },
    creeps: {},
    spawns: options.hasSpawns ? { spawn1: dummySpawn } : {},
    rooms: {}
  };
}

describe("BehaviorController", () => {
  describe("deterministic creep naming", () => {
    it("should generate deterministic creep names using memory counter", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });
      const game = createGameContext({ time: 100, hasSpawns: true });
      const memory = {} as Memory;
      const roleCounts = {};

      const result = controller.execute(game, memory, roleCounts);

      // Verify creep counter was initialized
      expect(memory.creepCounter).toBeDefined();
      expect(typeof memory.creepCounter).toBe("number");

      // Verify spawned creeps have deterministic names
      expect(result.spawnedCreeps.length).toBeGreaterThan(0);
      const firstCreepName = result.spawnedCreeps[0];
      expect(firstCreepName).toMatch(/^(harvester|upgrader)-100-\d+$/);
      expect(firstCreepName).not.toContain("NaN");
    });

    it("should generate identical names across multiple runs with same initial state", () => {
      const game1 = createGameContext({ time: 100, hasSpawns: true });
      const memory1 = {} as Memory;
      const controller1 = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const result1 = controller1.execute(game1, memory1, {});
      const names1 = result1.spawnedCreeps;

      // Reset and run again with same initial state
      const game2 = createGameContext({ time: 100, hasSpawns: true });
      const memory2 = {} as Memory;
      const controller2 = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const result2 = controller2.execute(game2, memory2, {});
      const names2 = result2.spawnedCreeps;

      // Names should be identical when starting from same state
      expect(names1).toEqual(names2);
    });

    it("should increment counter for each spawned creep", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });
      const game = createGameContext({ time: 100, hasSpawns: true });
      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = {};

      const result = controller.execute(game, memory, roleCounts);

      // Counter should have incremented for each spawned creep
      expect(memory.creepCounter).toBe(result.spawnedCreeps.length);
      expect(memory.creepCounter).toBeGreaterThan(0);
    });

    it("should preserve counter across multiple ticks", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });
      const memory = {} as Memory;

      // First tick
      const game1 = createGameContext({ time: 100, hasSpawns: true });
      controller.execute(game1, memory, {});
      const counterAfterTick1 = memory.creepCounter;

      // Second tick - all roles satisfied, no new spawns
      const game2 = createGameContext({ time: 101, hasSpawns: true });
      const roleCounts = { harvester: 2, upgrader: 1 };
      controller.execute(game2, memory, roleCounts);

      // Counter should remain unchanged when no spawning occurs
      expect(memory.creepCounter).toBe(counterAfterTick1);

      // Third tick - needs more harvesters
      const game3 = createGameContext({ time: 102, hasSpawns: true });
      controller.execute(game3, memory, { harvester: 1, upgrader: 1 });

      // Counter should increment
      expect(memory.creepCounter).toBeGreaterThan(counterAfterTick1);
    });

    it("should generate unique names for creeps spawned in same tick", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });
      const game = createGameContext({ time: 100, hasSpawns: true });
      const memory = {} as Memory;

      const result = controller.execute(game, memory, {});

      // All spawned names should be unique
      const uniqueNames = new Set(result.spawnedCreeps);
      expect(uniqueNames.size).toBe(result.spawnedCreeps.length);
    });
  });
});
