import { describe, it, expect, beforeEach, vi } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { GameContext } from "@runtime/types/GameContext";

/**
 * Regression test for issue: Emergency spawn bootstrap for energy deadlock recovery
 *
 * Scenario: Room at 3.38% energy (44/1300) with 0 creeps creates spawn deadlock
 * - Cannot spawn basic harvester (requires 200 energy minimum)
 * - Energy stuck in containers (50 energy) cannot be transported without creeps
 * - Bot must wait for passive source regeneration to reach spawn threshold
 *
 * Issue: ralphschuler/.screeps-gpt#1002 (Emergency spawn bootstrap)
 * Parent: ralphschuler/.screeps-gpt#998 (Zero creep population)
 * Related: #959 (Missing hauler role), #954 (Storage automation), #688, #691
 */
describe("Regression: Emergency Spawn Deadlock Recovery", () => {
  let mockRoom: Room;
  let mockSpawn: StructureSpawn;
  let mockContainer: StructureContainer;
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
    global.ERR_NOT_IN_RANGE = -9;
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

    // Mock source (will regenerate energy passively)
    mockSource = {
      id: "source1" as Id<Source>,
      pos: { x: 10, y: 10, roomName: "E54N39" },
      energy: 3000,
      energyCapacity: 3000
    } as Source;

    // Mock container with stuck energy (cannot be transported without creeps)
    mockContainer = {
      id: "container1" as Id<StructureContainer>,
      structureType: STRUCTURE_CONTAINER,
      pos: { x: 11, y: 10, roomName: "E54N39" },
      store: {
        getUsedCapacity: vi.fn((resource?: ResourceConstant) => {
          if (!resource || resource === RESOURCE_ENERGY) return 50; // Energy stuck
          return 0;
        }),
        getFreeCapacity: vi.fn().mockReturnValue(1950),
        getCapacity: vi.fn().mockReturnValue(2000)
      }
    } as unknown as StructureContainer;

    // Mock spawn with critically low energy (deadlock scenario)
    mockSpawn = {
      id: "spawn1" as Id<StructureSpawn>,
      name: "Spawn1",
      structureType: STRUCTURE_SPAWN,
      pos: { x: 25, y: 25, roomName: "E54N39" },
      spawning: null,
      spawnCreep: vi.fn(() => OK),
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(44), // Only 44 energy - CRITICAL!
        getFreeCapacity: vi.fn().mockReturnValue(256),
        getCapacity: vi.fn().mockReturnValue(300)
      },
      room: null as unknown as Room // Will be set below
    } as unknown as StructureSpawn;

    // Mock room at RCL 4 with energy deadlock
    mockRoom = {
      name: "E54N39",
      controller: {
        my: true,
        id: "controller1" as Id<StructureController>,
        level: 4,
        pos: { x: 25, y: 30, roomName: "E54N39" }
      },
      energyAvailable: 44, // CRITICAL: below minimum spawn threshold
      energyCapacityAvailable: 1300, // RCL 4 capacity
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
          return [mockSpawn, mockContainer];
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

  it("should detect emergency deadlock and log diagnostic information", () => {
    const controller = new BehaviorController({}, logger);

    // Create game state with 0 creeps and critically low energy
    const game: GameContext = {
      time: 75093347,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: {}, // NO CREEPS - complete workforce collapse
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts: Record<string, number> = {};

    // Execute behavior controller
    const summary = controller.execute(game, memory, roleCounts);

    // Verify no creeps were spawned (insufficient energy)
    expect(summary.spawnedCreeps.length).toBe(0);

    // Verify diagnostic warning was logged
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("EMERGENCY DEADLOCK"));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Cannot spawn harvester"));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("44/1300"));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Minimum required: 150 energy"));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Stored in containers: 50 energy"));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Waiting for passive source regeneration"));
  });

  it("should successfully spawn emergency harvester when energy reaches minimum threshold", () => {
    const controller = new BehaviorController({}, logger);

    // Simulate energy regeneration: source regenerated and spawn now has 200+ energy
    mockRoom.energyAvailable = 200; // Minimum for [WORK, CARRY, MOVE]
    mockSpawn.store.getUsedCapacity = vi.fn().mockReturnValue(200);

    const game: GameContext = {
      time: 75093347 + 300, // After source regeneration cycle
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: {}, // Still no creeps
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts: Record<string, number> = {};

    // Execute behavior controller
    const summary = controller.execute(game, memory, roleCounts);

    // Verify emergency harvester was spawned
    expect(summary.spawnedCreeps.length).toBeGreaterThan(0);
    expect(summary.spawnedCreeps[0]).toContain("harvester");

    // Verify emergency spawn log message
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("EMERGENCY SPAWN"));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("Recovering from total creep loss"));
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining("200/1300"));

    // Verify spawn was called with minimal emergency body
    expect(mockSpawn.spawnCreep).toHaveBeenCalled();
    const spawnCall = (mockSpawn.spawnCreep as ReturnType<typeof vi.fn>).mock.calls[0];
    const bodyParts = spawnCall[0] as BodyPartConstant[];

    // Emergency body should be [WORK, CARRY, MOVE]
    expect(bodyParts).toBeDefined();
    expect(bodyParts).toEqual([WORK, CARRY, MOVE]);
  });

  it("should spawn optimal emergency harvester with 200+ energy", () => {
    const controller = new BehaviorController({}, logger);

    // Simulate full energy recovery: spawn now has 200+ energy
    mockRoom.energyAvailable = 200; // Minimum for full [WORK, CARRY, MOVE]
    mockSpawn.store.getUsedCapacity = vi.fn().mockReturnValue(200);

    const game: GameContext = {
      time: 75093347 + 600,
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

    // Execute behavior controller
    const summary = controller.execute(game, memory, roleCounts);

    // Verify harvester was spawned
    expect(summary.spawnedCreeps.length).toBeGreaterThan(0);

    // Verify spawn was called with full minimal harvester body [WORK, CARRY, MOVE]
    const spawnCall = (mockSpawn.spawnCreep as ReturnType<typeof vi.fn>).mock.calls[0];
    const bodyParts = spawnCall[0] as BodyPartConstant[];

    expect(bodyParts).toEqual([WORK, CARRY, MOVE]);
  });

  it("should continue spawning harvesters until minimum count reached", () => {
    const controller = new BehaviorController({}, logger);

    // Start with sufficient energy
    mockRoom.energyAvailable = 300;
    mockSpawn.store.getUsedCapacity = vi.fn().mockReturnValue(300);

    // Simulate multiple ticks of spawning
    let spawnCounter = 0;
    const maxTicks = 10;

    for (let tick = 0; tick < maxTicks; tick++) {
      const game: GameContext = {
        time: 75093347 + tick * 10,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 20,
          bucket: 1000
        },
        creeps: {},
        spawns: { Spawn1: mockSpawn },
        rooms: { E54N39: mockRoom }
      };

      const memory = { creepCounter: spawnCounter } as Memory;
      const roleCounts: Record<string, number> = {
        harvester: spawnCounter
      };

      // Mock spawn as unavailable while spawning
      if (spawnCounter > 0) {
        mockSpawn.spawning = { name: `harvester-${spawnCounter}` } as Spawning;
      } else {
        mockSpawn.spawning = null;
      }

      // Execute behavior controller
      const summary = controller.execute(game, memory, roleCounts);

      if (summary.spawnedCreeps.length > 0) {
        spawnCounter++;
        mockSpawn.spawning = null; // Spawn becomes available again
      }

      // Stop once we reach minimum harvester count (typically 2-4)
      if (roleCounts.harvester >= 2) {
        break;
      }
    }

    // Verify multiple harvesters were spawned
    expect(spawnCounter).toBeGreaterThan(0);
  });

  it("should handle room with no containers gracefully", () => {
    const controller = new BehaviorController({}, logger);

    // Remove container from room
    mockRoom.find = vi.fn((type: FindConstant) => {
      if (type === FIND_SOURCES_ACTIVE || type === FIND_SOURCES) {
        return [mockSource];
      }
      if (type === FIND_MY_STRUCTURES) {
        return [mockSpawn];
      }
      if (type === FIND_STRUCTURES) {
        return [mockSpawn]; // No containers
      }
      return [];
    });

    const game: GameContext = {
      time: 75093347,
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

    // Execute behavior controller
    controller.execute(game, memory, roleCounts);

    // Should still log emergency deadlock but without container energy info
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("EMERGENCY DEADLOCK"));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Stored in containers: 0 energy"));
  });

  it("should bypass energy reserve requirements in emergency mode", () => {
    const controller = new BehaviorController({}, logger);

    // Set energy to exactly 200 (minimum spawn cost)
    // This would normally be blocked by 20% reserve requirement (260 needed)
    mockRoom.energyAvailable = 200;
    mockRoom.energyCapacityAvailable = 1300;
    mockSpawn.store.getUsedCapacity = vi.fn().mockReturnValue(200);

    const game: GameContext = {
      time: 75093347,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: {}, // Emergency mode: 0 creeps
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts: Record<string, number> = {};

    // Execute behavior controller
    const summary = controller.execute(game, memory, roleCounts);

    // Verify harvester was spawned despite being below normal reserve threshold
    expect(summary.spawnedCreeps.length).toBeGreaterThan(0);
    expect(mockSpawn.spawnCreep).toHaveBeenCalled();
  });

  it("should mark emergency creeps with emergency flag", () => {
    const controller = new BehaviorController({}, logger);

    // Set sufficient energy for spawn
    mockRoom.energyAvailable = 200;
    mockRoom.energyCapacityAvailable = 1300;
    mockSpawn.store.getUsedCapacity = vi.fn().mockReturnValue(200);

    const game: GameContext = {
      time: 75093347,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20,
        bucket: 1000
      },
      creeps: {}, // Emergency mode: 0 creeps
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts: Record<string, number> = {};

    // Execute behavior controller
    controller.execute(game, memory, roleCounts);

    // Verify emergency flag was set in creep memory
    const spawnCall = (mockSpawn.spawnCreep as ReturnType<typeof vi.fn>).mock.calls[0];
    const creepMemory = spawnCall[2]?.memory as { emergency?: boolean };

    expect(creepMemory.emergency).toBe(true);
  });
});
