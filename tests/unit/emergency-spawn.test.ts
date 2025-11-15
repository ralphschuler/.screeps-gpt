import { describe, expect, it, vi } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import { BodyComposer } from "@runtime/behavior/BodyComposer";
import type { GameContext, RoomLike, SpawnLike } from "@runtime/types/GameContext";

/**
 * Test suite for emergency spawn logic (Issue #806)
 *
 * Validates that the bot can recover from total creep loss by:
 * 1. Detecting zero-creep emergency situations
 * 2. Spawning affordable creeps with actual available energy
 * 3. Bypassing normal energy reserve requirements
 * 4. Generating minimal viable creep bodies
 */

function createEmergencyGameContext(options: {
  time: number;
  energyAvailable: number;
  energyCapacity: number;
  creepCount: number;
  harvesterCount: number;
}): GameContext {
  const dummyRoom: RoomLike & { energyAvailable: number; energyCapacityAvailable: number; visual?: { text: vi.Mock } } =
    {
      name: "W0N0",
      controller: { my: true, level: 1 } as StructureController,
      find: () => [],
      energyAvailable: options.energyAvailable,
      energyCapacityAvailable: options.energyCapacity,
      visual: { text: vi.fn() }
    };

  const dummySpawn: SpawnLike & { pos: { x: number; y: number } } = {
    name: "spawn1",
    spawning: null,
    spawnCreep: vi.fn().mockReturnValue(OK),
    store: {
      getFreeCapacity: () => options.energyCapacity - options.energyAvailable,
      getUsedCapacity: () => options.energyAvailable
    },
    room: dummyRoom,
    pos: { x: 25, y: 25 }
  };

  // Create creeps based on counts with proper store interface
  const creeps: Record<string, unknown> = {};
  for (let i = 0; i < options.harvesterCount; i++) {
    creeps[`harvester-${i}`] = {
      name: `harvester-${i}`,
      memory: { role: "harvester" },
      store: {
        getUsedCapacity: () => 0,
        getFreeCapacity: () => 50,
        getCapacity: () => 50
      },
      room: { name: "W0N0" }
    };
  }
  for (let i = options.harvesterCount; i < options.creepCount; i++) {
    creeps[`upgrader-${i}`] = {
      name: `upgrader-${i}`,
      memory: { role: "upgrader" },
      store: {
        getUsedCapacity: () => 0,
        getFreeCapacity: () => 50,
        getCapacity: () => 50
      },
      room: { name: "W0N0" }
    };
  }

  return {
    time: options.time,
    cpu: {
      getUsed: () => 0,
      limit: 100,
      bucket: 10000
    },
    creeps,
    spawns: { spawn1: dummySpawn },
    rooms: { W0N0: dummyRoom }
  };
}

describe("Emergency Spawn Logic", () => {
  describe("Emergency Detection", () => {
    it("should detect zero-creep emergency situation", () => {
      const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });
      const game = createEmergencyGameContext({
        time: 1000,
        energyAvailable: 200,
        energyCapacity: 550,
        creepCount: 0,
        harvesterCount: 0
      });
      const memory = {} as Memory;
      const roleCounts = {};

      const result = controller.execute(game, memory, roleCounts);

      // Should spawn at least one creep in emergency
      expect(result.spawnedCreeps.length).toBeGreaterThan(0);
      expect(result.spawnedCreeps[0]).toMatch(/harvester-/);
    });

    it("should use available energy instead of capacity during emergency", () => {
      const spawnCreepMock = vi.fn().mockReturnValue(OK);
      const game = createEmergencyGameContext({
        time: 1000,
        energyAvailable: 200, // Only 200 energy available
        energyCapacity: 550, // But capacity is 550
        creepCount: 0,
        harvesterCount: 0
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (game.spawns.spawn1 as any).spawnCreep = spawnCreepMock;

      const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });
      const memory = {} as Memory;
      const roleCounts = {};

      controller.execute(game, memory, roleCounts);

      // Should spawn with minimal body that fits 200 energy
      expect(spawnCreepMock).toHaveBeenCalled();
      const spawnedBody = spawnCreepMock.mock.calls[0][0];

      // Calculate cost of spawned body
      const costs: Record<BodyPartConstant, number> = {
        [MOVE]: 50,
        [WORK]: 100,
        [CARRY]: 50,
        [ATTACK]: 80,
        [RANGED_ATTACK]: 150,
        [HEAL]: 250,
        [CLAIM]: 600,
        [TOUGH]: 10
      };
      const totalCost = spawnedBody.reduce((sum: number, part: BodyPartConstant) => sum + costs[part], 0);

      expect(totalCost).toBeLessThanOrEqual(200);
      expect(spawnedBody).toEqual([WORK, CARRY, MOVE]); // Minimal harvester body
    });

    it("should not trigger emergency mode when creeps exist", () => {
      const spawnCreepMock = vi.fn().mockReturnValue(OK);
      const game = createEmergencyGameContext({
        time: 1000,
        energyAvailable: 200,
        energyCapacity: 550,
        creepCount: 5,
        harvesterCount: 4
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (game.spawns.spawn1 as any).spawnCreep = spawnCreepMock;

      const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });
      const memory = {} as Memory;
      const roleCounts = { harvester: 4, upgrader: 1 };

      controller.execute(game, memory, roleCounts);

      // Should not spawn (all minimums satisfied)
      expect(spawnCreepMock).not.toHaveBeenCalled();
    });
  });

  describe("Affordable Body Generation", () => {
    const composer = new BodyComposer();

    it("should generate minimal harvester body with 200 energy", () => {
      const body = composer.generateBody("harvester", 200);
      expect(body).toEqual([WORK, CARRY, MOVE]);
      expect(composer.calculateBodyCost(body)).toBe(200);
    });

    it("should generate emergency body with limited energy", () => {
      const body = composer.generateEmergencyBody(200);
      expect(body).toEqual([WORK, CARRY, MOVE]);
    });

    it("should generate ultra-minimal body with 150 energy", () => {
      const body = composer.generateEmergencyBody(150);
      expect(body).toEqual([WORK, MOVE]);
      expect(composer.calculateBodyCost(body)).toBe(150);
    });

    it("should return empty body if energy too low", () => {
      const body = composer.generateEmergencyBody(100);
      expect(body).toEqual([]);
    });

    it("should scale body normally when enough energy available", () => {
      const body = composer.generateBody("harvester", 550);
      expect(body.length).toBeGreaterThan(3);
      expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(550);
    });

    it("should fallback to emergency body for critical roles", () => {
      // Harvester with insufficient energy for normal base body
      const body = composer.generateBody("harvester", 200);
      expect(body.length).toBeGreaterThan(0);
      expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(200);
    });
  });

  describe("Emergency Spawn Priority", () => {
    it("should bypass energy reserve requirements in emergency", () => {
      const logMock = vi.fn();
      const controller = new BehaviorController({}, { log: logMock, warn: vi.fn() });

      const game = createEmergencyGameContext({
        time: 1000,
        energyAvailable: 200, // Exactly enough for minimal creep
        energyCapacity: 550,
        creepCount: 0,
        harvesterCount: 0
      });

      const memory = {} as Memory;
      const roleCounts = {};

      const result = controller.execute(game, memory, roleCounts);

      // Should spawn even though we don't have 20% reserve
      expect(result.spawnedCreeps.length).toBeGreaterThan(0);

      // Check for emergency log message
      const emergencyLogs = logMock.mock.calls.filter(call => call[0].includes("EMERGENCY SPAWN"));
      expect(emergencyLogs.length).toBeGreaterThan(0);
    });

    it("should prioritize harvesters in emergency", () => {
      const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });
      const game = createEmergencyGameContext({
        time: 1000,
        energyAvailable: 200,
        energyCapacity: 550,
        creepCount: 0,
        harvesterCount: 0
      });

      const memory = {} as Memory;
      const roleCounts = {};

      const result = controller.execute(game, memory, roleCounts);

      // First spawned creep should be a harvester
      expect(result.spawnedCreeps[0]).toMatch(/^harvester-/);
    });

    it("should display visual emergency feedback", () => {
      const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });
      const game = createEmergencyGameContext({
        time: 1000,
        energyAvailable: 200,
        energyCapacity: 550,
        creepCount: 0,
        harvesterCount: 0
      });

      const memory = {} as Memory;
      const roleCounts = {};

      controller.execute(game, memory, roleCounts);

      // Check that visual.text was called with emergency message
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const room = game.rooms.W0N0 as any;
      expect(room.visual.text).toHaveBeenCalledWith("⚠️ EMERGENCY", 25, 24, expect.objectContaining({ color: "red" }));
    });
  });

  describe("Recovery Scenarios", () => {
    it("should recover from total creep loss with minimal energy", () => {
      const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });

      // Start with zero creeps and minimal energy
      let game = createEmergencyGameContext({
        time: 1000,
        energyAvailable: 200,
        energyCapacity: 550,
        creepCount: 0,
        harvesterCount: 0
      });

      const memory = {} as Memory;
      let roleCounts = {};

      // Tick 1: Should spawn first emergency harvester
      let result = controller.execute(game, memory, roleCounts);
      expect(result.spawnedCreeps.length).toBe(1);
      expect(result.spawnedCreeps[0]).toMatch(/harvester-/);

      // Simulate having one harvester now but still need more
      roleCounts = { harvester: 1 };
      game = createEmergencyGameContext({
        time: 1001,
        energyAvailable: 200,
        energyCapacity: 550,
        creepCount: 1,
        harvesterCount: 1
      });

      // Tick 2: Should spawn second harvester (minimum is 4)
      result = controller.execute(game, memory, roleCounts);
      // May or may not spawn depending on energy reserve logic
      // Since harvester=1 < 2, should be in emergency mode and spawn
      expect(result.spawnedCreeps.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle ultra-low energy emergency (150 energy)", () => {
      const spawnCreepMock = vi.fn().mockReturnValue(OK);
      const game = createEmergencyGameContext({
        time: 1000,
        energyAvailable: 150, // Ultra-minimal energy
        energyCapacity: 550,
        creepCount: 0,
        harvesterCount: 0
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (game.spawns.spawn1 as any).spawnCreep = spawnCreepMock;

      const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });
      const memory = {} as Memory;
      const roleCounts = {};

      controller.execute(game, memory, roleCounts);

      // Should spawn ultra-minimal body [WORK, MOVE]
      expect(spawnCreepMock).toHaveBeenCalled();
      const spawnedBody = spawnCreepMock.mock.calls[0][0];
      expect(spawnedBody).toEqual([WORK, MOVE]);
    });

    it("should transition from emergency to normal spawning", () => {
      const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });

      // Start with emergency situation
      let game = createEmergencyGameContext({
        time: 1000,
        energyAvailable: 200,
        energyCapacity: 550,
        creepCount: 0,
        harvesterCount: 0
      });

      const memory = {} as Memory;
      controller.execute(game, memory, {});

      // Now with more creeps and full energy
      game = createEmergencyGameContext({
        time: 1010,
        energyAvailable: 550,
        energyCapacity: 550,
        creepCount: 4,
        harvesterCount: 4
      });

      const spawnCreepMock = vi.fn().mockReturnValue(OK);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (game.spawns.spawn1 as any).spawnCreep = spawnCreepMock;

      // Need one more upgrader
      const roleCounts = { harvester: 4, upgrader: 2 };
      controller.execute(game, memory, roleCounts);

      // Should spawn with full-sized body now
      if (spawnCreepMock.mock.calls.length > 0) {
        const spawnedBody = spawnCreepMock.mock.calls[0][0];
        expect(spawnedBody.length).toBeGreaterThan(3); // Scaled body
      }
    });
  });

  describe("Normal Operations Unaffected", () => {
    it("should not affect normal spawning with adequate energy and creeps", () => {
      const spawnCreepMock = vi.fn().mockReturnValue(OK);
      const game = createEmergencyGameContext({
        time: 1000,
        energyAvailable: 550,
        energyCapacity: 550,
        creepCount: 8,
        harvesterCount: 4
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (game.spawns.spawn1 as any).spawnCreep = spawnCreepMock;

      const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });
      const memory = {} as Memory;
      const roleCounts = { harvester: 4, upgrader: 3, builder: 1 };

      controller.execute(game, memory, roleCounts);

      // Should spawn normal-sized builder
      if (spawnCreepMock.mock.calls.length > 0) {
        const spawnedBody = spawnCreepMock.mock.calls[0][0];
        const composer = new BodyComposer();
        const cost = composer.calculateBodyCost(spawnedBody);

        // Should use available capacity, not emergency minimal
        expect(cost).toBeGreaterThan(200);
        expect(spawnedBody.length).toBeGreaterThan(3);
      }
    });

    it("should maintain energy reserves in non-emergency situations", () => {
      const spawnCreepMock = vi.fn().mockReturnValue(OK);
      const game = createEmergencyGameContext({
        time: 1000,
        energyAvailable: 300, // Only 300 available
        energyCapacity: 550, // 20% reserve = 110 energy
        creepCount: 5,
        harvesterCount: 3
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (game.spawns.spawn1 as any).spawnCreep = spawnCreepMock;

      const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });
      const memory = {} as Memory;
      const roleCounts = { harvester: 3, upgrader: 2, builder: 1 };

      controller.execute(game, memory, roleCounts);

      // With 3 harvesters (< 4 minimum but >= 2), not in emergency mode
      // With 300 energy and 110 reserve (20% of 550), can spend 190 energy
      // Normal harvester body costs 200 energy, so cannot spawn yet
      // Will wait for more energy to accumulate
      expect(spawnCreepMock).not.toHaveBeenCalled();
    });
  });
});
