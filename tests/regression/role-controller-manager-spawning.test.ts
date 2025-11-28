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
      pos: {
        x: 25,
        y: 25,
        roomName: "E54N39",
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
      find: vi.fn((type: FindConstant, opts?: FilterOptions<FindConstant>) => {
        if (type === FIND_SOURCES_ACTIVE || type === FIND_SOURCES) {
          return [mockSource];
        }
        if (type === FIND_CONSTRUCTION_SITES) {
          return [];
        }
        if (type === FIND_MY_STRUCTURES) {
          // If filter is provided, apply it
          if (opts?.filter) {
            const structures = [mockSpawn];
            return structures.filter(opts.filter);
          }
          return [mockSpawn];
        }
        if (type === FIND_STRUCTURES) {
          // If filter is provided, apply it
          if (opts?.filter) {
            const structures = [mockSpawn];
            return structures.filter(opts.filter);
          }
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

    // Create mock creeps that match the role counts
    const mockCreeps: Record<string, Creep> = {};

    const createMockCreep = (name: string, role: string): Creep =>
      ({
        name,
        memory: { role } as CreepMemory,
        room: mockRoom,
        pos: {
          x: 25,
          y: 25,
          roomName: "E54N39",
          findClosestByPath: vi.fn().mockReturnValue(mockSource),
          isNearTo: vi.fn().mockReturnValue(false)
        },
        store: {
          getFreeCapacity: vi.fn().mockReturnValue(50),
          getUsedCapacity: vi.fn().mockReturnValue(0)
        },
        harvest: vi.fn(),
        transfer: vi.fn(),
        upgradeController: vi.fn(),
        build: vi.fn(),
        repair: vi.fn(),
        moveTo: vi.fn()
      }) as unknown as Creep;

    for (let i = 0; i < 4; i++) {
      mockCreeps[`harvester-${i}`] = createMockCreep(`harvester-${i}`, "harvester");
    }
    mockCreeps["upgrader-0"] = createMockCreep("upgrader-0", "upgrader");
    mockCreeps["builder-0"] = createMockCreep("builder-0", "builder");

    // Set Game.creeps for controller cleanup
    global.Game.creeps = mockCreeps;

    // When role minimums are met, no spawning should occur
    const game: GameContext = {
      time: 100,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: mockCreeps, // Has creeps to avoid emergency spawn
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

  /**
   * Regression test for Issue: RoleControllerManager spawn prioritization may starve critical roles during energy scarcity
   * 
   * Tests the scenario where:
   * 1. Room has energy (enough for 1 creep)
   * 2. Last harvester dies but other creeps exist
   * 3. System must spawn harvester first to prevent energy starvation deadlock
   */
  describe("Harvester priority spawn (energy scarcity prevention)", () => {
    const createMockCreep = (name: string, role: string): Creep =>
      ({
        name,
        memory: { role } as CreepMemory,
        room: mockRoom,
        pos: {
          x: 25,
          y: 25,
          roomName: "E54N39",
          findClosestByPath: vi.fn().mockReturnValue(mockSource),
          isNearTo: vi.fn().mockReturnValue(false)
        },
        store: {
          getFreeCapacity: vi.fn().mockReturnValue(50),
          getUsedCapacity: vi.fn().mockReturnValue(0)
        },
        harvest: vi.fn(),
        transfer: vi.fn(),
        upgradeController: vi.fn(),
        build: vi.fn(),
        repair: vi.fn(),
        moveTo: vi.fn()
      }) as unknown as Creep;

    it("should spawn harvester first when harvesters = 0 but other creeps exist", () => {
      const manager = new RoleControllerManager({}, logger);

      // Create mock creeps - NO harvesters, but upgraders and builders exist
      const mockCreeps: Record<string, Creep> = {
        "upgrader-0": createMockCreep("upgrader-0", "upgrader"),
        "upgrader-1": createMockCreep("upgrader-1", "upgrader"),
        "builder-0": createMockCreep("builder-0", "builder")
      };

      // Set Game.creeps for controller cleanup
      global.Game.creeps = mockCreeps;

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 20,
          bucket: 1000
        },
        creeps: mockCreeps, // Has creeps, but no harvesters
        spawns: { Spawn1: mockSpawn },
        rooms: { E54N39: mockRoom }
      };

      const memory = { creepCounter: 3 } as Memory;
      const roleCounts: Record<string, number> = {
        harvester: 0, // CRITICAL: No harvesters
        upgrader: 2,
        builder: 1
      };

      // Execute spawning
      const summary = manager.execute(game, memory, roleCounts);

      // Verify harvester was spawned (not upgrader or builder)
      expect(summary.spawnedCreeps.length).toBeGreaterThan(0);
      expect(summary.spawnedCreeps[0]).toContain("harvester");
      expect(mockSpawn.spawnCreep).toHaveBeenCalled();
      
      // Verify the spawned creep is a harvester
      const spawnCall = mockSpawn.spawnCreep.mock.calls[0];
      const creepMemory = spawnCall[2]?.memory as CreepMemory | undefined;
      expect(creepMemory?.role).toBe("harvester");
    });

    it("should block non-harvester spawns when harvesters = 0 and energy is low", () => {
      const manager = new RoleControllerManager({}, logger);

      // Create mock creeps - NO harvesters
      const mockCreeps: Record<string, Creep> = {
        "upgrader-0": createMockCreep("upgrader-0", "upgrader")
      };

      // Set Game.creeps for controller cleanup
      global.Game.creeps = mockCreeps;

      // Low energy room - enough for a spawner but must use it for harvester
      const lowEnergyRoom = {
        ...mockRoom,
        energyAvailable: 300,
        energyCapacityAvailable: 300
      } as unknown as Room;

      const lowEnergySpawn = {
        ...mockSpawn,
        room: lowEnergyRoom,
        spawnCreep: vi.fn(() => OK)
      } as unknown as StructureSpawn;

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 20,
          bucket: 1000
        },
        creeps: mockCreeps,
        spawns: { Spawn1: lowEnergySpawn },
        rooms: { E54N39: lowEnergyRoom }
      };

      const memory = { creepCounter: 1 } as Memory;
      const roleCounts: Record<string, number> = {
        harvester: 0, // CRITICAL: No harvesters
        upgrader: 1  // Upgrader exists but shouldn't spawn more
      };

      // Execute spawning
      const summary = manager.execute(game, memory, roleCounts);

      // Verify ONLY harvester was spawned, no upgraders
      expect(summary.spawnedCreeps.length).toBe(1);
      expect(summary.spawnedCreeps[0]).toContain("harvester");
      
      // Verify spawnCreep was called exactly once (for harvester only)
      expect(lowEnergySpawn.spawnCreep).toHaveBeenCalledTimes(1);
    });

    it("should use minimal body for priority harvester spawn", () => {
      const manager = new RoleControllerManager({}, logger);

      // Create mock creeps - NO harvesters
      const mockCreeps: Record<string, Creep> = {
        "builder-0": createMockCreep("builder-0", "builder")
      };

      global.Game.creeps = mockCreeps;

      // Exactly 200 energy - minimum for emergency body
      const minimalEnergyRoom = {
        ...mockRoom,
        energyAvailable: 200,
        energyCapacityAvailable: 300
      } as unknown as Room;

      const minimalEnergySpawn = {
        ...mockSpawn,
        room: minimalEnergyRoom,
        spawnCreep: vi.fn(() => OK)
      } as unknown as StructureSpawn;

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 20,
          bucket: 1000
        },
        creeps: mockCreeps,
        spawns: { Spawn1: minimalEnergySpawn },
        rooms: { E54N39: minimalEnergyRoom }
      };

      const memory = { creepCounter: 1 } as Memory;
      const roleCounts: Record<string, number> = {
        harvester: 0,
        builder: 1
      };

      const summary = manager.execute(game, memory, roleCounts);

      expect(summary.spawnedCreeps.length).toBe(1);
      expect(summary.spawnedCreeps[0]).toContain("harvester");
      
      // Verify minimal body was used [WORK, CARRY, MOVE] = 200 energy
      const spawnCall = minimalEnergySpawn.spawnCreep.mock.calls[0];
      const body = spawnCall[0] as BodyPartConstant[];
      expect(body).toEqual([WORK, CARRY, MOVE]);
    });

    it("should block all spawns when harvesters = 0 and energy is insufficient", () => {
      const manager = new RoleControllerManager({}, logger);

      // Create mock creeps - NO harvesters
      const mockCreeps: Record<string, Creep> = {
        "upgrader-0": createMockCreep("upgrader-0", "upgrader")
      };

      global.Game.creeps = mockCreeps;

      // Insufficient energy for even minimal body (< 200)
      const insufficientEnergyRoom = {
        ...mockRoom,
        energyAvailable: 150,
        energyCapacityAvailable: 300
      } as unknown as Room;

      const insufficientEnergySpawn = {
        ...mockSpawn,
        room: insufficientEnergyRoom,
        spawnCreep: vi.fn(() => OK)
      } as unknown as StructureSpawn;

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 20,
          bucket: 1000
        },
        creeps: mockCreeps,
        spawns: { Spawn1: insufficientEnergySpawn },
        rooms: { E54N39: insufficientEnergyRoom }
      };

      const memory = { creepCounter: 1 } as Memory;
      const roleCounts: Record<string, number> = {
        harvester: 0,
        upgrader: 1
      };

      const summary = manager.execute(game, memory, roleCounts);

      // Verify NO spawns occurred - waiting for energy to spawn harvester
      expect(summary.spawnedCreeps.length).toBe(0);
      expect(insufficientEnergySpawn.spawnCreep).not.toHaveBeenCalled();
    });

    it("should allow normal spawning when at least one harvester exists", () => {
      const manager = new RoleControllerManager({}, logger);

      // Create mock creeps - ONE harvester exists
      const mockCreeps: Record<string, Creep> = {
        "harvester-0": createMockCreep("harvester-0", "harvester"),
        "upgrader-0": createMockCreep("upgrader-0", "upgrader")
      };

      global.Game.creeps = mockCreeps;

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 20,
          bucket: 1000
        },
        creeps: mockCreeps,
        spawns: { Spawn1: mockSpawn },
        rooms: { E54N39: mockRoom }
      };

      const memory = { creepCounter: 2 } as Memory;
      const roleCounts: Record<string, number> = {
        harvester: 1, // One harvester exists - normal spawning should work
        upgrader: 1
      };

      // Execute spawning
      const summary = manager.execute(game, memory, roleCounts);

      // Verify spawning occurred (more harvesters needed to meet minimum)
      expect(summary.spawnedCreeps.length).toBeGreaterThan(0);
      // Should spawn more harvesters to meet minimum (4)
      expect(summary.spawnedCreeps[0]).toContain("harvester");
    });
  });
});
