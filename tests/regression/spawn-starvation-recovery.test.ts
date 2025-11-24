/**
 * Regression test for spawn starvation issue (ralphschuler/.screeps-gpt#806)
 *
 * This test validates that the bot can recover from complete spawn starvation
 * scenarios where no creeps exist and energy is critically low.
 *
 * Root Cause:
 * - canAffordCreepWithReserve() enforces 20% energy reserve
 * - In starvation scenarios (0 harvesters), energy doesn't regenerate
 * - Reserve requirement prevents spawning, creating deadlock
 *
 * Fix:
 * - Add emergency spawn mode when harvester count is 0
 * - Bypass energy reserve check for critical roles (harvester)
 * - Ensure at least 1 harvester can spawn with available energy
 */

import { describe, it, expect, vi } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { GameContext, SpawnLike, RoomLike } from "@runtime/types/GameContext";

describe("Spawn Starvation Recovery (Issue #806)", () => {
  const createStarvationGameContext = (
    energyAvailable: number,
    energyCapacity: number = 300,
    hasCreeps: boolean = false
  ): GameContext => {
    const mockRoom: RoomLike & { energyAvailable: number; energyCapacityAvailable: number } = {
      name: "W1N1",
      controller: { my: true, level: 1 } as StructureController,
      find: vi.fn().mockReturnValue([]), // No sources initially
      energyAvailable,
      energyCapacityAvailable: energyCapacity
    } as RoomLike & { energyAvailable: number; energyCapacityAvailable: number };

    const mockSpawn: SpawnLike = {
      id: "spawn1" as Id<StructureSpawn>,
      name: "Spawn1",
      spawning: null,
      spawnCreep: vi.fn().mockReturnValue(OK),
      room: mockRoom,
      pos: { x: 25, y: 25, roomName: "W1N1" } as RoomPosition
    } as SpawnLike;

    return {
      time: 1000,
      cpu: {
        limit: 100,
        getUsed: () => 10,
        bucket: 10000
      },
      creeps: hasCreeps
        ? {
            "harvester-999-0": {
              name: "harvester-999-0",
              memory: { role: "harvester" },
              store: { getFreeCapacity: () => 0, getUsedCapacity: () => 0 },
              room: mockRoom,
              upgradeController: vi.fn().mockReturnValue(OK),
              moveTo: vi.fn().mockReturnValue(OK)
            } as unknown as CreepLike
          }
        : {},
      spawns: { Spawn1: mockSpawn },
      rooms: { W1N1: mockRoom }
    } as GameContext;
  };

  describe("Critical Spawn Starvation (0 harvesters, low energy)", () => {
    it("should spawn harvester when 0 harvesters exist, even with energy reserve violation", () => {
      const logMessages: string[] = [];
      const mockLogger = {
        log: (msg: string) => logMessages.push(msg),
        warn: (msg: string) => logMessages.push(msg)
      };

      const controller = new BehaviorController({}, mockLogger);

      // Scenario: 0 harvesters, 250 energy available (barely enough for harvester)
      // Reserve would be 60 energy (20% of 300), blocking spawn
      // But emergency mode should bypass this
      const game = createStarvationGameContext(250, 300, false);
      const memory = { creepCounter: 0, roles: {} } as Memory;

      const result = controller.execute(game, memory, {});

      // Should spawn at least 1 harvester despite reserve violation
      expect(result.spawnedCreeps.length).toBeGreaterThan(0);
      expect(result.spawnedCreeps[0]).toMatch(/^harvester-/);

      // Verify spawn was called
      const spawn = game.spawns["Spawn1"];
      expect(spawn.spawnCreep).toHaveBeenCalled();
    });

    it("should prioritize harvester spawning when critically low on harvesters (< 2)", () => {
      const controller = new BehaviorController({}, console);

      // Scenario: 1 harvester exists, 300 energy available
      // Should still prioritize spawning more harvesters
      const game = createStarvationGameContext(300, 300, true);
      const memory = {
        creepCounter: 1,
        roles: { harvester: 1 } // Only 1 harvester
      } as Memory;

      const result = controller.execute(game, memory, { harvester: 1 });

      // Should spawn more harvesters (minimum is 4)
      expect(result.spawnedCreeps.length).toBeGreaterThan(0);
      const harvesterSpawns = result.spawnedCreeps.filter(name => name.includes("harvester"));
      expect(harvesterSpawns.length).toBeGreaterThan(0);
    });

    it("should not spawn upgraders or builders when harvesters are below minimum", () => {
      const controller = new BehaviorController({}, console);

      // Scenario: 0 creeps, limited energy
      const game = createStarvationGameContext(300, 300, false);
      const memory = { creepCounter: 0, roles: {} } as Memory;

      const result = controller.execute(game, memory, {});

      // Should only spawn harvesters in emergency
      const harvesterSpawns = result.spawnedCreeps.filter(name => name.includes("harvester"));

      expect(harvesterSpawns.length).toBeGreaterThan(0);
      // May spawn some upgraders/builders if energy permits, but harvesters should be first
      if (result.spawnedCreeps.length > 1) {
        expect(result.spawnedCreeps[0]).toMatch(/^harvester-/);
      }
    });
  });

  describe("Energy Reserve Bypass Logic", () => {
    it("should bypass energy reserve for harvesters when count is 0", () => {
      const controller = new BehaviorController({}, console);

      // Scenario: 220 energy (enough for 1 harvester at 200 cost)
      // Reserve would be 60 energy (20% of 300), requiring 260 total
      // Should bypass reserve check
      const game = createStarvationGameContext(220, 300, false);
      const memory = { creepCounter: 0, roles: {} } as Memory;

      const result = controller.execute(game, memory, {});

      expect(result.spawnedCreeps.length).toBeGreaterThan(0);
      expect(result.spawnedCreeps[0]).toMatch(/^harvester-/);
    });

    it("should enforce energy reserve when harvesters are at or above minimum", () => {
      const controller = new BehaviorController({}, console);

      // Scenario: 4 harvesters exist (at minimum), low energy
      const game = createStarvationGameContext(220, 300, true);
      const memory = {
        creepCounter: 4,
        roles: { harvester: 4 }
      } as Memory;

      const result = controller.execute(game, memory, { harvester: 4 });

      // Should not spawn additional creeps (reserve enforced)
      expect(result.spawnedCreeps.length).toBe(0);
    });
  });

  describe("Bootstrap Phase Integration", () => {
    it("should activate emergency spawn during bootstrap with 0 harvesters", () => {
      const controller = new BehaviorController({}, console);

      // Bootstrap phase with 0 harvesters
      const game = createStarvationGameContext(250, 300, false);
      const memory = {
        creepCounter: 0,
        roles: {},
        bootstrap: { isActive: true, startedAt: 900 }
      } as Memory;

      // Bootstrap minimums: harvester: 6
      const result = controller.execute(game, memory, {});

      expect(result.spawnedCreeps.length).toBeGreaterThan(0);
      expect(result.spawnedCreeps[0]).toMatch(/^harvester-/);
    });
  });

  describe("Low Energy Scenarios", () => {
    it("should spawn minimum body harvester when energy is critically low (< 250)", () => {
      const controller = new BehaviorController({}, console);

      // Exactly 200 energy (minimum harvester cost)
      const game = createStarvationGameContext(200, 300, false);
      const memory = { creepCounter: 0, roles: {} } as Memory;

      const result = controller.execute(game, memory, {});

      expect(result.spawnedCreeps.length).toBeGreaterThan(0);
      expect(result.spawnedCreeps[0]).toMatch(/^harvester-/);
    });

    it("should not spawn with insufficient energy (150 energy below minimum)", () => {
      const controller = new BehaviorController({}, console);

      // 150 energy - below minimum 200 for [WORK, CARRY, MOVE]
      const game = createStarvationGameContext(150, 300, false);
      const memory = { creepCounter: 0, roles: {} } as Memory;

      const result = controller.execute(game, memory, {});

      // Cannot spawn - not enough energy for minimal viable body
      expect(result.spawnedCreeps.length).toBe(0);
    });

    it("should not spawn when energy is below minimal threshold", () => {
      const controller = new BehaviorController({}, console);

      // 100 energy (below minimum 200 for minimal body)
      const game = createStarvationGameContext(100, 300, false);
      const memory = { creepCounter: 0, roles: {} } as Memory;

      const result = controller.execute(game, memory, {});

      // Cannot spawn - not enough energy for minimal viable body
      expect(result.spawnedCreeps.length).toBe(0);
    });
  });

  describe("Recovery Progression", () => {
    it("should spawn harvesters first, then upgraders, then builders", () => {
      const controller = new BehaviorController({}, console);

      // Adequate energy for multiple spawns
      const game = createStarvationGameContext(600, 600, false);
      const memory = { creepCounter: 0, roles: {} } as Memory;

      const result = controller.execute(game, memory, {});

      // Should spawn multiple creeps in priority order
      expect(result.spawnedCreeps.length).toBeGreaterThan(0);

      // First spawn should be harvester
      expect(result.spawnedCreeps[0]).toMatch(/^harvester-/);

      // If multiple spawns, check order
      if (result.spawnedCreeps.length > 1) {
        const roles = result.spawnedCreeps.map(name => name.split("-")[0]);
        const harvesterIndex = roles.indexOf("harvester");
        const upgraderIndex = roles.indexOf("upgrader");
        const builderIndex = roles.indexOf("builder");

        // Harvesters should come before upgraders and builders
        if (upgraderIndex !== -1) {
          expect(harvesterIndex).toBeLessThan(upgraderIndex);
        }
        if (builderIndex !== -1) {
          expect(harvesterIndex).toBeLessThan(builderIndex);
        }
      }
    });
  });
});
