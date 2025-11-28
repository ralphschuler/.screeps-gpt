/**
 * Regression test for robust emergency spawn logic with minimal body fallback
 *
 * Scenario: Bot completely failed to spawn any creeps for 3+ days despite having
 * a functional spawn structure. Emergency spawn logic must be bulletproof to prevent
 * total workforce collapse.
 *
 * Issue: ralphschuler/.screeps-gpt#1294 (Bot dead for 3+ days)
 * Related: ralphschuler/.screeps-gpt#1190, ralphschuler/.screeps-gpt#1221
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RoleControllerManager } from "@runtime/behavior/RoleControllerManager";
import type { GameContext } from "@runtime/types/GameContext";

describe("Emergency Spawn Resilience", () => {
  let mockRoom: Room;
  let mockSpawn: StructureSpawn;
  let mockSource: Source;
  let logger: { log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Mock Screeps constants
    global.FIND_SOURCES_ACTIVE = 105 as FindConstant;
    global.FIND_SOURCES = 104 as FindConstant;
    global.FIND_CONSTRUCTION_SITES = 107 as FindConstant;
    global.FIND_STRUCTURES = 106 as FindConstant;
    global.FIND_MY_STRUCTURES = 112 as FindConstant;
    global.FIND_DROPPED_RESOURCES = 106 as FindConstant;
    global.STRUCTURE_SPAWN = "spawn" as StructureConstant;
    global.STRUCTURE_EXTENSION = "extension" as StructureConstant;
    global.STRUCTURE_STORAGE = "storage" as StructureConstant;
    global.STRUCTURE_CONTAINER = "container" as StructureConstant;
    global.STRUCTURE_CONTROLLER = "controller" as StructureConstant;
    global.WORK = "work" as BodyPartConstant;
    global.CARRY = "carry" as BodyPartConstant;
    global.MOVE = "move" as BodyPartConstant;
    global.RESOURCE_ENERGY = "energy" as ResourceConstant;
    global.OK = 0;
    global.ERR_NOT_ENOUGH_ENERGY = -6;
    global.ERR_BUSY = -4;
    global.BODYPART_COST = {
      [WORK]: 100,
      [CARRY]: 50,
      [MOVE]: 50
    } as Record<BodyPartConstant, number>;

    logger = { log: vi.fn(), warn: vi.fn() };

    // Mock Game global
    global.Game = {
      time: 75093347,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20
      },
      creeps: {},
      getObjectById: vi.fn()
    } as unknown as Game;

    // Mock source
    mockSource = {
      id: "source1" as Id<Source>,
      pos: { x: 10, y: 10, roomName: "E54N39" },
      energy: 3000,
      energyCapacity: 3000
    } as Source;

    // Mock spawn
    mockSpawn = {
      id: "spawn1" as Id<StructureSpawn>,
      name: "Spawn1",
      structureType: STRUCTURE_SPAWN,
      pos: { x: 25, y: 25, roomName: "E54N39" },
      spawning: null,
      spawnCreep: vi.fn(() => OK),
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(300),
        getFreeCapacity: vi.fn().mockReturnValue(0),
        getCapacity: vi.fn().mockReturnValue(300)
      },
      room: null as unknown as Room
    } as unknown as StructureSpawn;

    // Mock room at RCL 2
    mockRoom = {
      name: "E54N39",
      controller: {
        my: true,
        id: "controller1" as Id<StructureController>,
        level: 2,
        pos: { x: 25, y: 30, roomName: "E54N39" }
      },
      energyAvailable: 300,
      energyCapacityAvailable: 300,
      storage: null,
      find: vi.fn((type: FindConstant) => {
        if (type === FIND_SOURCES_ACTIVE || type === FIND_SOURCES) {
          return [mockSource];
        }
        if (type === FIND_CONSTRUCTION_SITES) {
          return [];
        }
        if (type === FIND_MY_STRUCTURES) {
          return [mockSpawn];
        }
        if (type === FIND_STRUCTURES) {
          return [mockSpawn];
        }
        if (type === FIND_DROPPED_RESOURCES) {
          return [];
        }
        return [];
      })
    } as unknown as Room;

    // Link spawn to room
    mockSpawn.room = mockRoom;
  });

  it("spawns minimal harvester with 200 energy", () => {
    const manager = new RoleControllerManager({}, logger);

    // Set exactly 200 energy available
    mockRoom.energyAvailable = 200;
    mockSpawn.store.getUsedCapacity = vi.fn().mockReturnValue(200);

    const game: GameContext = {
      time: 75093347,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: {}, // NO CREEPS - emergency situation
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts: Record<string, number> = {};

    // Execute manager
    const summary = manager.execute(game, memory, roleCounts);

    // Verify emergency harvester was spawned
    expect(summary.spawnedCreeps.length).toBe(1);
    expect(summary.spawnedCreeps[0]).toContain("emergency-harvester");

    // Verify spawn was called with minimal body [WORK, CARRY, MOVE]
    expect(mockSpawn.spawnCreep).toHaveBeenCalled();
    const spawnCall = (mockSpawn.spawnCreep as ReturnType<typeof vi.fn>).mock.calls[0];
    const bodyParts = spawnCall[0] as BodyPartConstant[];

    expect(bodyParts).toEqual([WORK, CARRY, MOVE]);

    // Verify emergency log message
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("[EMERGENCY] Total workforce collapse detected"));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("[EMERGENCY] Spawned emergency-harvester"));
  });

  it("spawns minimal harvester with 250 energy", () => {
    const manager = new RoleControllerManager({}, logger);

    // Set 250 energy available
    mockRoom.energyAvailable = 250;
    mockSpawn.store.getUsedCapacity = vi.fn().mockReturnValue(250);

    const game: GameContext = {
      time: 75093347,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: {}, // NO CREEPS - emergency situation
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts: Record<string, number> = {};

    // Execute manager
    const summary = manager.execute(game, memory, roleCounts);

    // Verify emergency harvester was spawned
    expect(summary.spawnedCreeps.length).toBe(1);

    // Verify spawn was called with minimal body [WORK, CARRY, MOVE]
    const spawnCall = (mockSpawn.spawnCreep as ReturnType<typeof vi.fn>).mock.calls[0];
    const bodyParts = spawnCall[0] as BodyPartConstant[];

    expect(bodyParts).toEqual([WORK, CARRY, MOVE]);
  });

  it("logs warning when energy < 200", () => {
    const manager = new RoleControllerManager({}, logger);

    // Set insufficient energy (below 200)
    mockRoom.energyAvailable = 100;
    mockSpawn.store.getUsedCapacity = vi.fn().mockReturnValue(100);

    const game: GameContext = {
      time: 75093347,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: {}, // NO CREEPS - emergency situation
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts: Record<string, number> = {};

    // Execute manager
    const summary = manager.execute(game, memory, roleCounts);

    // Verify no creeps were spawned
    expect(summary.spawnedCreeps.length).toBe(0);

    // Verify warning was logged
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("[EMERGENCY] Insufficient energy (100)"));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("need 200"));
  });

  it("prioritizes emergency spawn over normal queue", () => {
    const manager = new RoleControllerManager({}, logger);

    // Set sufficient energy
    mockRoom.energyAvailable = 300;
    mockSpawn.store.getUsedCapacity = vi.fn().mockReturnValue(300);

    const game: GameContext = {
      time: 75093347,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: {}, // NO CREEPS - emergency situation
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts: Record<string, number> = {};

    // Execute manager
    const summary = manager.execute(game, memory, roleCounts);

    // Verify emergency harvester was spawned
    expect(summary.spawnedCreeps.length).toBe(1);
    expect(summary.spawnedCreeps[0]).toContain("emergency-harvester");

    // Verify spawn was called exactly once (emergency spawn only, normal queue skipped)
    expect(mockSpawn.spawnCreep).toHaveBeenCalledTimes(1);
  });

  it("does not trigger emergency spawn when creeps exist", () => {
    const manager = new RoleControllerManager({}, logger);

    // Set sufficient energy
    mockRoom.energyAvailable = 300;
    mockSpawn.store.getUsedCapacity = vi.fn().mockReturnValue(300);

    const mockCreep = {
      name: "harvester-1",
      memory: { role: "harvester" } as CreepMemory,
      room: mockRoom,
      pos: {
        findClosestByPath: vi.fn().mockReturnValue(mockSource)
      },
      store: {
        getFreeCapacity: vi.fn().mockReturnValue(50),
        getUsedCapacity: vi.fn().mockReturnValue(0)
      },
      harvest: vi.fn()
    } as unknown as Creep;

    const game: GameContext = {
      time: 75093347,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: {
        "harvester-1": mockCreep
      },
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    };

    const memory = { creepCounter: 1 } as Memory;
    const roleCounts: Record<string, number> = { harvester: 1 };

    // Execute manager
    manager.execute(game, memory, roleCounts);

    // Verify emergency log message was NOT logged
    expect(logger.log).not.toHaveBeenCalledWith(
      expect.stringContaining("[EMERGENCY] Total workforce collapse detected")
    );
  });

  it("handles no available spawn gracefully", () => {
    const manager = new RoleControllerManager({}, logger);

    // Make spawn unavailable (busy spawning)
    mockSpawn.spawning = { name: "some-creep" } as Spawning;

    const game: GameContext = {
      time: 75093347,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: {}, // NO CREEPS - emergency situation
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts: Record<string, number> = {};

    // Execute manager
    const summary = manager.execute(game, memory, roleCounts);

    // Verify no creeps were spawned
    expect(summary.spawnedCreeps.length).toBe(0);

    // Verify warning was logged
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("[EMERGENCY] No spawn available"));
  });

  it("logs failure when spawn returns error", () => {
    const manager = new RoleControllerManager({}, logger);

    // Make spawn fail
    mockSpawn.spawnCreep = vi.fn(() => ERR_BUSY);

    const game: GameContext = {
      time: 75093347,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: {}, // NO CREEPS - emergency situation
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts: Record<string, number> = {};

    // Execute manager
    const summary = manager.execute(game, memory, roleCounts);

    // Verify no creeps were spawned
    expect(summary.spawnedCreeps.length).toBe(0);

    // Verify failure warning was logged
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("[EMERGENCY]"));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("may need manual intervention"));
  });
});
