import { describe, expect, it, vi, beforeEach } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { GameContext } from "@runtime/types/GameContext";

/**
 * Regression test for Issue #1027: Spawn idle despite available energy
 *
 * Problem: Spawn completely idle (0 active spawns) despite having sufficient
 * energy (800/1300 = 61.5%) and healthy CPU bucket (5262), causing wasted
 * economic cycles and constraining game progression.
 *
 * Root Cause: Spawn logic only spawns creeps to meet minimum thresholds.
 * When all role minimums are satisfied and no dynamic adjustments trigger,
 * spawning stops even with abundant energy and CPU.
 *
 * Expected Behavior: Spawn should scale workforce proactively when:
 * - Energy capacity is high (>90%) and bucket is healthy
 * - Low RCL rooms (1-2) should aggressively spawn to accelerate progression
 */
describe("Spawn Idle with Full Energy (Regression #1027)", () => {
  beforeEach(() => {
    // Setup global constants for Screeps API
    global.FIND_SOURCES = 105 as FindConstant;
    global.FIND_SOURCES_ACTIVE = 110 as FindConstant;
    global.FIND_STRUCTURES = 106 as FindConstant;
    global.FIND_CONSTRUCTION_SITES = 107 as FindConstant;
    global.FIND_MY_STRUCTURES = 112 as FindConstant;
    global.FIND_MY_SPAWNS = 113 as FindConstant;
    global.STRUCTURE_CONTAINER = "container" as StructureConstant;
    global.STRUCTURE_SPAWN = "spawn" as StructureConstant;
    global.STRUCTURE_EXTENSION = "extension" as StructureConstant;
    global.STRUCTURE_TOWER = "tower" as StructureConstant;
    global.OK = 0;
    global.WORK = "work" as BodyPartConstant;
    global.CARRY = "carry" as BodyPartConstant;
    global.MOVE = "move" as BodyPartConstant;
    global.BODYPART_COST = {
      work: 100,
      carry: 50,
      move: 50
    } as Record<BodyPartConstant, number>;
  });

  it("should spawn upgraders when energy is maxed at RCL2", () => {
    const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });

    const source = {
      id: "source1" as Id<Source>,
      energy: 3000,
      pos: {
        findInRange: vi.fn(() => []) // No containers
      }
    };

    const room = {
      name: "E54N39",
      controller: { my: true, level: 2 } as StructureController,
      find: vi.fn((type: FindConstant) => {
        if (type === FIND_SOURCES) return [source];
        if (type === FIND_CONSTRUCTION_SITES) return [];
        if (type === FIND_STRUCTURES) return [];
        return [];
      }),
      energyAvailable: 300, // 100% energy capacity
      energyCapacityAvailable: 300
    } as unknown as Room;

    const spawn = {
      name: "Spawn1",
      spawning: null,
      spawnCreep: vi.fn().mockReturnValue(OK),
      store: { getFreeCapacity: () => 0, getUsedCapacity: () => 300 },
      room
    };

    const game: GameContext = {
      time: 100,
      cpu: { getUsed: () => 2.63, limit: 20, bucket: 2211 }, // Healthy CPU
      creeps: {
        // Current workforce: 7 creeps (meets minimums: 2 harvesters, 3 upgraders, 2 builders)
        "harvester-1": {
          memory: { role: "harvester" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "harvester-2": {
          memory: { role: "harvester" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "upgrader-1": {
          memory: { role: "upgrader" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "upgrader-2": {
          memory: { role: "upgrader" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "upgrader-3": {
          memory: { role: "upgrader" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "builder-1": {
          memory: { role: "builder" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "builder-2": {
          memory: { role: "builder" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep
      },
      spawns: { Spawn1: spawn },
      rooms: { E54N39: room }
    };

    const memory = {} as Memory;
    const roleCounts = {
      harvester: 2,
      upgrader: 3,
      builder: 2
    };

    const result = controller.execute(game, memory, roleCounts);

    // Should spawn additional upgraders when energy is maxed at RCL2
    // With 90%+ energy, RCL2 should scale upgraders to 4 (from default 3)
    expect(result.spawnedCreeps.length).toBeGreaterThan(0);
    expect(spawn.spawnCreep).toHaveBeenCalled();

    // Verify at least one upgrader was spawned
    const spawnCalls = spawn.spawnCreep.mock.calls;
    const upgraderSpawned = spawnCalls.some(
      call => call[1].includes("upgrader") || (call[2]?.memory as { role?: string })?.role === "upgrader"
    );
    expect(upgraderSpawned).toBe(true);
  });

  it("should spawn additional upgraders when energy is maxed at RCL2", () => {
    const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });

    const source = {
      id: "source1" as Id<Source>,
      energy: 3000,
      pos: {
        findInRange: vi.fn(() => [])
      }
    };

    const room = {
      name: "E54N39",
      controller: { my: true, level: 2, progressTotal: 45000, progress: 99 } as StructureController,
      find: vi.fn((type: FindConstant) => {
        if (type === FIND_SOURCES) return [source];
        if (type === FIND_CONSTRUCTION_SITES) return [];
        if (type === FIND_STRUCTURES) return [];
        return [];
      }),
      energyAvailable: 300,
      energyCapacityAvailable: 300
    } as unknown as Room;

    const spawn = {
      name: "Spawn1",
      spawning: null,
      spawnCreep: vi.fn().mockReturnValue(OK),
      store: { getFreeCapacity: () => 0, getUsedCapacity: () => 300 },
      room
    };

    const game: GameContext = {
      time: 75124692,
      cpu: { getUsed: () => 2.8, limit: 20, bucket: 2211 },
      creeps: {
        "harvester-1": {
          memory: { role: "harvester" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "harvester-2": {
          memory: { role: "harvester" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "upgrader-1": {
          memory: { role: "upgrader" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "upgrader-2": {
          memory: { role: "upgrader" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "upgrader-3": {
          memory: { role: "upgrader" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "builder-1": {
          memory: { role: "builder" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "builder-2": {
          memory: { role: "builder" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep
      },
      spawns: { Spawn1: spawn },
      rooms: { E54N39: room }
    };

    const memory = {} as Memory;
    const roleCounts = {
      harvester: 2,
      upgrader: 3,
      builder: 2
    };

    const result = controller.execute(game, memory, roleCounts);

    // With full energy, spawn should be active
    expect(result.spawnedCreeps.length).toBeGreaterThan(0);
    expect(spawn.spawnCreep).toHaveBeenCalled();
  });

  it("should not spawn when workforce is optimal and energy is low", () => {
    const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });

    const source = {
      id: "source1" as Id<Source>,
      energy: 3000,
      pos: {
        findInRange: vi.fn(() => [])
      }
    };

    const room = {
      name: "E54N39",
      controller: { my: true, level: 2 } as StructureController,
      find: vi.fn((type: FindConstant) => {
        if (type === FIND_SOURCES) return [source];
        if (type === FIND_CONSTRUCTION_SITES) return [];
        if (type === FIND_STRUCTURES) return [];
        return [];
      }),
      energyAvailable: 100, // Low energy (33%)
      energyCapacityAvailable: 300
    } as unknown as Room;

    const spawn = {
      name: "Spawn1",
      spawning: null,
      spawnCreep: vi.fn().mockReturnValue(OK),
      store: { getFreeCapacity: () => 200, getUsedCapacity: () => 100 },
      room
    };

    const game: GameContext = {
      time: 100,
      cpu: { getUsed: () => 2.0, limit: 20, bucket: 2211 },
      creeps: {
        "harvester-1": {
          memory: { role: "harvester" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "harvester-2": {
          memory: { role: "harvester" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "upgrader-1": {
          memory: { role: "upgrader" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "upgrader-2": {
          memory: { role: "upgrader" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "upgrader-3": {
          memory: { role: "upgrader" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "builder-1": {
          memory: { role: "builder" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "builder-2": {
          memory: { role: "builder" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep
      },
      spawns: { Spawn1: spawn },
      rooms: { E54N39: room }
    };

    const memory = {} as Memory;
    const roleCounts = {
      harvester: 2,
      upgrader: 3,
      builder: 2
    };

    controller.execute(game, memory, roleCounts);

    // Should NOT spawn when energy is low (only 33% capacity)
    // Energy reserve requirements should prevent spawning
    expect(spawn.spawnCreep).not.toHaveBeenCalled();
  });

  it("should handle RCL4 with high energy similar to RCL2", () => {
    const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });

    const source = {
      id: "source1" as Id<Source>,
      energy: 3000,
      pos: {
        findInRange: vi.fn(() => [])
      }
    };

    const room = {
      name: "E54N39",
      controller: { my: true, level: 4 } as StructureController,
      find: vi.fn((type: FindConstant) => {
        if (type === FIND_SOURCES) return [source];
        if (type === FIND_CONSTRUCTION_SITES)
          return [
            { structureType: "road" } as ConstructionSite,
            { structureType: "road" } as ConstructionSite,
            { structureType: "wall" } as ConstructionSite
          ];
        if (type === FIND_STRUCTURES) return [];
        return [];
      }),
      energyAvailable: 1200, // High energy (92%)
      energyCapacityAvailable: 1300
    } as unknown as Room;

    const spawn = {
      name: "Spawn1",
      spawning: null,
      spawnCreep: vi.fn().mockReturnValue(OK),
      store: { getFreeCapacity: () => 100, getUsedCapacity: () => 1200 },
      room
    };

    const game: GameContext = {
      time: 75110477,
      cpu: { getUsed: () => 2.63, limit: 20, bucket: 5262 },
      creeps: {
        "harvester-1": {
          memory: { role: "harvester" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "harvester-2": {
          memory: { role: "harvester" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "upgrader-1": {
          memory: { role: "upgrader" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "upgrader-2": {
          memory: { role: "upgrader" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep,
        "builder-1": {
          memory: { role: "builder" },
          store: { getUsedCapacity: () => 0, getFreeCapacity: () => 50 },
          room
        } as Creep
      },
      spawns: { Spawn1: spawn },
      rooms: { E54N39: room }
    };

    const memory = {} as Memory;
    const roleCounts = {
      harvester: 2,
      upgrader: 2,
      builder: 1
    };

    const result = controller.execute(game, memory, roleCounts);

    // Should spawn additional creeps (upgraders or builders) when energy is high
    // RCL4 with >90% energy should scale upgraders to 5
    expect(result.spawnedCreeps.length).toBeGreaterThan(0);
    expect(spawn.spawnCreep).toHaveBeenCalled();
  });
});
