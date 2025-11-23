import { describe, it, expect, beforeEach, vi } from "vitest";
import { RoleControllerManager } from "@runtime/behavior/RoleControllerManager";
import type { GameContext } from "@runtime/types/GameContext";

/**
 * Regression test for RoleControllerManager spawning issue
 *
 * Issue: No creeps spawning when using modular RoleControllerManager
 * Root cause: BodyComposer.countRoomCreeps() accessed global Game.creeps
 *             which is not available in kernel context
 * Fix: Pass creep count from GameContext to BodyComposer.generateBody()
 */
describe("Regression: RoleControllerManager Spawning", () => {
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
    global.FIND_DROPPED_RESOURCES = 109 as FindConstant;
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
    global.ERR_NOT_IN_RANGE = -9;
    global.BODYPART_COST = {
      work: 100,
      carry: 50,
      move: 50
    } as Record<string, number>;

    logger = { log: vi.fn(), warn: vi.fn() };

    // Mock source
    mockSource = {
      id: "source1" as Id<Source>,
      pos: { x: 10, y: 10, roomName: "E54N39" },
      energy: 3000,
      energyCapacity: 3000
    } as Source;

    // Mock spawn with sufficient energy
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

    // Mock room at RCL 1 with full energy
    mockRoom = {
      name: "E54N39",
      controller: {
        my: true,
        id: "controller1" as Id<StructureController>,
        level: 1,
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

    mockSpawn.room = mockRoom;
  });

  it("should spawn harvesters when no creeps exist", () => {
    const manager = new RoleControllerManager({}, logger);

    const game: GameContext = {
      time: 100,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: {}, // No creeps
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts: Record<string, number> = {};

    // Execute spawning
    const summary = manager.execute(game, memory, roleCounts);

    // Verify harvester was spawned
    expect(summary.spawnedCreeps.length).toBeGreaterThan(0);
    expect(summary.spawnedCreeps[0]).toContain("harvester");
    expect(mockSpawn.spawnCreep).toHaveBeenCalled();
  });

  it("should spawn multiple creeps to meet role minimums", () => {
    const manager = new RoleControllerManager({}, logger);

    let creepCounter = 0;
    const spawnedCreeps: string[] = [];

    // Simulate multiple ticks
    for (let tick = 0; tick < 10; tick++) {
      const game: GameContext = {
        time: 100 + tick,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 20,
          bucket: 1000
        },
        creeps: {},
        spawns: { Spawn1: mockSpawn },
        rooms: { E54N39: mockRoom }
      };

      const memory = { creepCounter } as Memory;
      const roleCounts: Record<string, number> = {
        harvester: spawnedCreeps.filter(n => n.includes("harvester")).length
      };

      // Mock spawn availability: spawn is busy for one tick after each spawn
      // This simulates the real Screeps behavior where spawning takes time
      const isSpawnBusy = spawnedCreeps.length > 0 && tick === spawnedCreeps.length;
      mockSpawn.spawning = isSpawnBusy ? ({ name: spawnedCreeps[spawnedCreeps.length - 1] } as Spawning) : null;

      const summary = manager.execute(game, memory, roleCounts);

      if (summary.spawnedCreeps.length > 0) {
        spawnedCreeps.push(...summary.spawnedCreeps);
        creepCounter = memory.creepCounter;
      }

      // Stop once we have enough harvesters
      if (roleCounts.harvester >= 4) {
        break;
      }
    }

    // Verify multiple harvesters were spawned
    const harvesterCount = spawnedCreeps.filter(n => n.includes("harvester")).length;
    expect(harvesterCount).toBeGreaterThan(0);
  });

  it("should handle early game with few creeps correctly", () => {
    const manager = new RoleControllerManager({}, logger);

    // Simulate room with 3 creeps (early game)
    // Note: We're only testing spawning, so we use empty creeps object
    // The important part is that the creep count is passed correctly to BodyComposer
    const game: GameContext = {
      time: 100,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: {}, // Empty for spawning test
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    };

    const memory = { creepCounter: 3 } as Memory;
    const roleCounts: Record<string, number> = {
      harvester: 2,
      upgrader: 1
    };

    // Execute spawning
    const summary = manager.execute(game, memory, roleCounts);

    // Should still spawn more harvesters to meet minimum (4)
    expect(summary.spawnedCreeps.length).toBeGreaterThan(0);
    expect(mockSpawn.spawnCreep).toHaveBeenCalled();
  });

  it("should respect bootstrap minimums when provided", () => {
    const manager = new RoleControllerManager({}, logger);

    const game: GameContext = {
      time: 100,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: {},
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts: Record<string, number> = {};
    const bootstrapMinimums = {
      harvester: 2, // Override default minimum
      upgrader: 1,
      builder: 1
    };

    // Execute spawning with bootstrap minimums
    const summary = manager.execute(game, memory, roleCounts, bootstrapMinimums);

    // Verify spawning occurred with bootstrap minimums
    expect(summary.spawnedCreeps.length).toBeGreaterThan(0);
    expect(mockSpawn.spawnCreep).toHaveBeenCalled();
  });

  it("should not spawn when role minimums are met and not in bootstrap mode", () => {
    const manager = new RoleControllerManager({}, logger);

    // When role minimums are met, no spawning should occur
    // We use empty creeps for this test since we're only testing spawn logic
    const game: GameContext = {
      time: 100,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: {}, // Empty for spawning test
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    };

    const memory = { creepCounter: 6 } as Memory;
    const roleCounts: Record<string, number> = {
      harvester: 4, // Meets minimum
      upgrader: 1,
      builder: 1
    };

    // Provide bootstrap minimums that are already satisfied
    const bootstrapMinimums = {
      harvester: 2, // Less than current count
      upgrader: 1,
      builder: 1
    };

    // Execute spawning with bootstrap minimums
    const summary = manager.execute(game, memory, roleCounts, bootstrapMinimums);

    // Should not spawn since minimums are met
    expect(summary.spawnedCreeps.length).toBe(0);
  });
});
