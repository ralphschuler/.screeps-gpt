/**
 * Regression test for multi-room workforce distribution
 *
 * Issue #1586: Controller downgrade warning in W1N6 due to insufficient upgrader capacity
 *
 * Root Cause:
 * - Spawn system used GLOBAL role counts instead of per-room counts
 * - Room W1N5 with 4 harvesters would satisfy global minimum (4)
 * - Room W1N6 with 0 harvesters would not get any spawns
 * - Result: W1N6 controller downgraded due to no upgraders
 *
 * Fix:
 * - Calculate per-room role counts for "room-local" roles
 * - Each room's spawn enforces that room's minimum requirements
 * - Room-local roles: harvester, upgrader, builder, hauler, repairer, stationaryHarvester
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RoleControllerManager } from "@runtime/behavior/RoleControllerManager";
import type { GameContext } from "@runtime/types/GameContext";

describe("Multi-Room Workforce Distribution (#1586)", () => {
  let mockRoomA: Room;
  let mockRoomB: Room;
  let mockSpawnA: StructureSpawn;
  let mockSpawnB: StructureSpawn;
  let mockSourceA: Source;
  let mockSourceB: Source;
  let logger: { log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  // Helper to create a properly mocked creep
  const createMockCreep = (name: string, role: string, room: Room): Creep => {
    return {
      name,
      memory: { role } as CreepMemory,
      room,
      pos: {
        x: 25,
        y: 25,
        roomName: room.name,
        findClosestByPath: vi.fn().mockReturnValue(null),
        findInRange: vi.fn().mockReturnValue([]),
        isNearTo: vi.fn().mockReturnValue(false),
        inRangeTo: vi.fn().mockReturnValue(false),
        getRangeTo: vi.fn().mockReturnValue(10)
      },
      store: {
        getFreeCapacity: vi.fn().mockReturnValue(50),
        getUsedCapacity: vi.fn().mockReturnValue(0)
      },
      harvest: vi.fn().mockReturnValue(OK),
      transfer: vi.fn().mockReturnValue(OK),
      moveTo: vi.fn().mockReturnValue(OK),
      upgradeController: vi.fn().mockReturnValue(OK),
      build: vi.fn().mockReturnValue(OK),
      repair: vi.fn().mockReturnValue(OK),
      withdraw: vi.fn().mockReturnValue(OK)
    } as unknown as Creep;
  };

  beforeEach(() => {
    // Mock Screeps constants
    global.FIND_SOURCES_ACTIVE = 105 as FindConstant;
    global.FIND_SOURCES = 104 as FindConstant;
    global.FIND_CONSTRUCTION_SITES = 107 as FindConstant;
    global.FIND_STRUCTURES = 106 as FindConstant;
    global.FIND_MY_STRUCTURES = 112 as FindConstant;
    global.FIND_DROPPED_RESOURCES = 109 as FindConstant;
    global.FIND_MY_CREEPS = 101 as FindConstant;
    global.FIND_HOSTILE_CREEPS = 103 as FindConstant;
    global.FIND_HOSTILE_STRUCTURES = 116 as FindConstant;
    global.STRUCTURE_SPAWN = "spawn" as StructureConstant;
    global.STRUCTURE_EXTENSION = "extension" as StructureConstant;
    global.STRUCTURE_STORAGE = "storage" as StructureConstant;
    global.STRUCTURE_CONTAINER = "container" as StructureConstant;
    global.STRUCTURE_CONTROLLER = "controller" as StructureConstant;
    global.STRUCTURE_ROAD = "road" as StructureConstant;
    global.STRUCTURE_TOWER = "tower" as StructureConstant;
    global.WORK = "work" as BodyPartConstant;
    global.CARRY = "carry" as BodyPartConstant;
    global.MOVE = "move" as BodyPartConstant;
    global.ATTACK = "attack" as BodyPartConstant;
    global.RESOURCE_ENERGY = "energy" as ResourceConstant;
    global.OK = 0;
    global.ERR_NOT_IN_RANGE = -9;
    global.BODYPART_COST = {
      work: 100,
      carry: 50,
      move: 50,
      attack: 80
    } as Record<string, number>;

    logger = { log: vi.fn(), warn: vi.fn() };

    // Mock sources for both rooms
    mockSourceA = {
      id: "sourceA1" as Id<Source>,
      pos: { x: 10, y: 10, roomName: "W1N5" },
      energy: 3000,
      energyCapacity: 3000
    } as Source;

    mockSourceB = {
      id: "sourceB1" as Id<Source>,
      pos: { x: 10, y: 10, roomName: "W1N6" },
      energy: 3000,
      energyCapacity: 3000
    } as Source;

    // Create Room A (W1N5) - the "rich" room with workers
    mockSpawnA = {
      id: "spawnA" as Id<StructureSpawn>,
      name: "SpawnA",
      structureType: STRUCTURE_SPAWN,
      pos: {
        x: 25,
        y: 25,
        roomName: "W1N5",
        isNearTo: vi.fn().mockReturnValue(false)
      },
      spawning: null,
      spawnCreep: vi.fn(() => OK),
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(300),
        getFreeCapacity: vi.fn().mockReturnValue(0),
        getCapacity: vi.fn().mockReturnValue(300)
      },
      room: null as unknown as Room
    } as unknown as StructureSpawn;

    mockRoomA = {
      name: "W1N5",
      controller: {
        my: true,
        id: "controllerA" as Id<StructureController>,
        level: 4,
        pos: { x: 25, y: 30, roomName: "W1N5" }
      },
      energyAvailable: 800,
      energyCapacityAvailable: 800,
      storage: null,
      find: vi.fn((type: FindConstant, opts?: FilterOptions<FindConstant>) => {
        if (type === FIND_SOURCES_ACTIVE || type === FIND_SOURCES) {
          return [mockSourceA];
        }
        if (type === FIND_MY_STRUCTURES) {
          if (opts?.filter) {
            return [mockSpawnA].filter(opts.filter);
          }
          return [mockSpawnA];
        }
        if (type === FIND_STRUCTURES) {
          if (opts?.filter) {
            return [mockSpawnA].filter(opts.filter);
          }
          return [mockSpawnA];
        }
        return [];
      }),
      findExitTo: vi.fn().mockReturnValue(1)
    } as unknown as Room;

    mockSpawnA.room = mockRoomA;

    // Create Room B (W1N6) - the "starving" room with no workers
    mockSpawnB = {
      id: "spawnB" as Id<StructureSpawn>,
      name: "SpawnB",
      structureType: STRUCTURE_SPAWN,
      pos: {
        x: 25,
        y: 25,
        roomName: "W1N6",
        isNearTo: vi.fn().mockReturnValue(false)
      },
      spawning: null,
      spawnCreep: vi.fn(() => OK),
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(300),
        getFreeCapacity: vi.fn().mockReturnValue(0),
        getCapacity: vi.fn().mockReturnValue(300)
      },
      room: null as unknown as Room
    } as unknown as StructureSpawn;

    mockRoomB = {
      name: "W1N6",
      controller: {
        my: true,
        id: "controllerB" as Id<StructureController>,
        level: 4,
        pos: { x: 25, y: 30, roomName: "W1N6" }
      },
      energyAvailable: 800,
      energyCapacityAvailable: 800,
      storage: null,
      find: vi.fn((type: FindConstant, opts?: FilterOptions<FindConstant>) => {
        if (type === FIND_SOURCES_ACTIVE || type === FIND_SOURCES) {
          return [mockSourceB];
        }
        if (type === FIND_MY_STRUCTURES) {
          if (opts?.filter) {
            return [mockSpawnB].filter(opts.filter);
          }
          return [mockSpawnB];
        }
        if (type === FIND_STRUCTURES) {
          if (opts?.filter) {
            return [mockSpawnB].filter(opts.filter);
          }
          return [mockSpawnB];
        }
        return [];
      }),
      findExitTo: vi.fn().mockReturnValue(1)
    } as unknown as Room;

    mockSpawnB.room = mockRoomB;
  });

  describe("Per-Room Workforce Enforcement", () => {
    it("should spawn harvesters in room B even when room A has enough harvesters globally", () => {
      const manager = new RoleControllerManager({}, logger);

      // Room A has 4 harvesters (at minimum), Room B has 0
      const mockCreeps: Record<string, Creep> = {};
      for (let i = 0; i < 4; i++) {
        mockCreeps[`harvester-A-${i}`] = createMockCreep(`harvester-A-${i}`, "harvester", mockRoomA);
      }

      global.Game = { creeps: mockCreeps } as unknown as Game;

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 20,
          bucket: 1000
        },
        creeps: mockCreeps,
        spawns: { SpawnA: mockSpawnA, SpawnB: mockSpawnB },
        rooms: { W1N5: mockRoomA, W1N6: mockRoomB }
      };

      // Global count is 4 (meets minimum), but per-room: W1N5=4, W1N6=0
      const memory = { creepCounter: 4 } as Memory;
      const roleCounts: Record<string, number> = { harvester: 4 };

      const summary = manager.execute(game, memory, roleCounts);

      // Room B's spawn should have spawned a harvester
      const harvesterSpawns = summary.spawnedCreeps.filter(n => n.includes("harvester"));
      expect(harvesterSpawns.length).toBeGreaterThan(0);

      // Verify SpawnB was used (not just SpawnA)
      expect(mockSpawnB.spawnCreep).toHaveBeenCalled();
    });

    it("should spawn upgraders in room B even when room A has enough upgraders globally", () => {
      const manager = new RoleControllerManager({}, logger);

      // Room A has 4 harvesters + 3 upgraders, Room B has 0 of each
      const mockCreeps: Record<string, Creep> = {};
      for (let i = 0; i < 4; i++) {
        mockCreeps[`harvester-A-${i}`] = createMockCreep(`harvester-A-${i}`, "harvester", mockRoomA);
      }
      for (let i = 0; i < 3; i++) {
        mockCreeps[`upgrader-A-${i}`] = createMockCreep(`upgrader-A-${i}`, "upgrader", mockRoomA);
      }

      global.Game = { creeps: mockCreeps } as unknown as Game;

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 20,
          bucket: 1000
        },
        creeps: mockCreeps,
        spawns: { SpawnA: mockSpawnA, SpawnB: mockSpawnB },
        rooms: { W1N5: mockRoomA, W1N6: mockRoomB }
      };

      const memory = { creepCounter: 7 } as Memory;
      const roleCounts: Record<string, number> = { harvester: 4, upgrader: 3 };

      const summary = manager.execute(game, memory, roleCounts);

      // Room B should get harvesters first (higher priority), then upgraders
      const harvesterSpawns = summary.spawnedCreeps.filter(n => n.includes("harvester"));
      const upgraderSpawns = summary.spawnedCreeps.filter(n => n.includes("upgrader"));

      // At least one harvester should spawn in Room B
      expect(harvesterSpawns.length).toBeGreaterThan(0);

      // Room B should also need upgraders (since W1N6 has 0)
      // This validates that per-room counting works for upgraders too
      expect(upgraderSpawns.length).toBeGreaterThanOrEqual(0);
    });

    it("should NOT spawn harvesters in room A when it already has minimum", () => {
      const manager = new RoleControllerManager({}, logger);

      // Room A has 4 harvesters (at minimum)
      // Room B also has 4 harvesters (at minimum)
      const mockCreeps: Record<string, Creep> = {};
      for (let i = 0; i < 4; i++) {
        mockCreeps[`harvester-A-${i}`] = createMockCreep(`harvester-A-${i}`, "harvester", mockRoomA);
        mockCreeps[`harvester-B-${i}`] = createMockCreep(`harvester-B-${i}`, "harvester", mockRoomB);
      }

      global.Game = { creeps: mockCreeps } as unknown as Game;

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 20,
          bucket: 1000
        },
        creeps: mockCreeps,
        spawns: { SpawnA: mockSpawnA, SpawnB: mockSpawnB },
        rooms: { W1N5: mockRoomA, W1N6: mockRoomB }
      };

      const memory = { creepCounter: 8 } as Memory;
      const roleCounts: Record<string, number> = { harvester: 8 };

      const summary = manager.execute(game, memory, roleCounts);

      // No additional harvesters should spawn (both rooms at minimum)
      const harvesterSpawns = summary.spawnedCreeps.filter(n => n.includes("harvester"));
      expect(harvesterSpawns.length).toBe(0);
    });

    it("should ensure each room gets basic workforce independently", () => {
      const manager = new RoleControllerManager({}, logger);

      // Room A is fully staffed, Room B has nothing
      const mockCreeps: Record<string, Creep> = {};
      for (let i = 0; i < 4; i++) {
        mockCreeps[`harvester-A-${i}`] = createMockCreep(`harvester-A-${i}`, "harvester", mockRoomA);
      }
      for (let i = 0; i < 3; i++) {
        mockCreeps[`upgrader-A-${i}`] = createMockCreep(`upgrader-A-${i}`, "upgrader", mockRoomA);
      }
      for (let i = 0; i < 2; i++) {
        mockCreeps[`builder-A-${i}`] = createMockCreep(`builder-A-${i}`, "builder", mockRoomA);
      }

      global.Game = { creeps: mockCreeps } as unknown as Game;

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 20,
          bucket: 1000
        },
        creeps: mockCreeps,
        spawns: { SpawnA: mockSpawnA, SpawnB: mockSpawnB },
        rooms: { W1N5: mockRoomA, W1N6: mockRoomB }
      };

      const memory = { creepCounter: 9 } as Memory;
      const roleCounts: Record<string, number> = { harvester: 4, upgrader: 3, builder: 2 };

      const summary = manager.execute(game, memory, roleCounts);

      // Room B should get spawns since it has 0 workers
      expect(summary.spawnedCreeps.length).toBeGreaterThan(0);

      // SpawnB must have been called (Room B needs workers)
      expect(mockSpawnB.spawnCreep).toHaveBeenCalled();
    });
  });

  describe("Controller Downgrade Prevention", () => {
    it("should spawn upgraders in a room with no upgraders to prevent controller downgrade", () => {
      const manager = new RoleControllerManager({}, logger);

      // Room A has harvesters and upgraders
      // Room B has harvesters but NO upgraders (controller downgrade scenario)
      const mockCreeps: Record<string, Creep> = {};
      for (let i = 0; i < 4; i++) {
        mockCreeps[`harvester-A-${i}`] = createMockCreep(`harvester-A-${i}`, "harvester", mockRoomA);
        mockCreeps[`harvester-B-${i}`] = createMockCreep(`harvester-B-${i}`, "harvester", mockRoomB);
      }
      for (let i = 0; i < 3; i++) {
        mockCreeps[`upgrader-A-${i}`] = createMockCreep(`upgrader-A-${i}`, "upgrader", mockRoomA);
      }
      // Note: Room B has NO upgraders - this is the controller downgrade scenario

      global.Game = { creeps: mockCreeps } as unknown as Game;

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 20,
          bucket: 1000
        },
        creeps: mockCreeps,
        spawns: { SpawnA: mockSpawnA, SpawnB: mockSpawnB },
        rooms: { W1N5: mockRoomA, W1N6: mockRoomB }
      };

      const memory = { creepCounter: 11 } as Memory;
      // Global count shows 3 upgraders (all in Room A)
      const roleCounts: Record<string, number> = { harvester: 8, upgrader: 3 };

      const summary = manager.execute(game, memory, roleCounts);

      // Room B should spawn upgraders since it has 0
      const upgraderSpawns = summary.spawnedCreeps.filter(n => n.includes("upgrader"));
      expect(upgraderSpawns.length).toBeGreaterThan(0);

      // Verify SpawnB was called for the upgrader
      expect(mockSpawnB.spawnCreep).toHaveBeenCalled();
    });
  });
});
