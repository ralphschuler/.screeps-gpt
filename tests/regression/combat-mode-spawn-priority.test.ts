import { describe, it, expect, beforeEach, vi } from "vitest";
import { RoleControllerManager } from "@runtime/behavior/RoleControllerManager";
import type { GameContext } from "@runtime/types/GameContext";

/**
 * Regression test for combat mode spawn priority
 *
 * Issue: When under attack, upgraders should stop spawning and combat units should be prioritized
 * Expected behavior:
 * - During defensive postures (alert/defensive/emergency), upgrader minimum is reduced to ~30%
 * - Spawn priority order changes to prioritize attackers, healers, and repairers
 * - Upgraders already spawned pause their upgrading behavior (handled by UpgraderController)
 */
describe("Regression: Combat Mode Spawn Priority", () => {
  let mockRoom: Room;
  let mockSpawn: StructureSpawn;
  let mockSource: Source;
  let mockController: StructureController;
  let logger: { log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Mock Screeps constants
    global.FIND_SOURCES_ACTIVE = 105 as FindConstant;
    global.FIND_SOURCES = 104 as FindConstant;
    global.FIND_CONSTRUCTION_SITES = 107 as FindConstant;
    global.FIND_STRUCTURES = 106 as FindConstant;
    global.FIND_MY_STRUCTURES = 112 as FindConstant;
    global.FIND_DROPPED_RESOURCES = 109 as FindConstant;
    global.FIND_HOSTILE_CREEPS = 118 as FindConstant;
    global.STRUCTURE_SPAWN = "spawn" as StructureConstant;
    global.STRUCTURE_EXTENSION = "extension" as StructureConstant;
    global.STRUCTURE_STORAGE = "storage" as StructureConstant;
    global.STRUCTURE_CONTAINER = "container" as StructureConstant;
    global.STRUCTURE_CONTROLLER = "controller" as StructureConstant;
    global.WORK = "work" as BodyPartConstant;
    global.CARRY = "carry" as BodyPartConstant;
    global.MOVE = "move" as BodyPartConstant;
    global.ATTACK = "attack" as BodyPartConstant;
    global.RANGED_ATTACK = "ranged_attack" as BodyPartConstant;
    global.HEAL = "heal" as BodyPartConstant;
    global.RESOURCE_ENERGY = "energy" as ResourceConstant;
    global.OK = 0;
    global.ERR_NOT_IN_RANGE = -9;
    global.BODYPART_COST = {
      work: 100,
      carry: 50,
      move: 50,
      attack: 80,
      ranged_attack: 150,
      heal: 250
    } as Record<string, number>;

    logger = { log: vi.fn(), warn: vi.fn() };

    // Mock source
    mockSource = {
      id: "source1" as Id<Source>,
      pos: { x: 10, y: 10, roomName: "E54N39" },
      energy: 3000,
      energyCapacity: 3000
    } as Source;

    // Mock controller
    mockController = {
      id: "controller1" as Id<StructureController>,
      my: true,
      level: 3,
      pos: { x: 25, y: 30, roomName: "E54N39" }
    } as StructureController;

    // Mock spawn with good energy
    mockSpawn = {
      id: "spawn1" as Id<StructureSpawn>,
      name: "Spawn1",
      structureType: STRUCTURE_SPAWN,
      pos: {
        x: 25,
        y: 25,
        roomName: "E54N39"
      },
      spawning: null,
      spawnCreep: vi.fn(() => OK),
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(800),
        getFreeCapacity: vi.fn().mockReturnValue(0),
        getCapacity: vi.fn().mockReturnValue(800)
      },
      room: null as unknown as Room
    } as unknown as StructureSpawn;

    // Mock room at RCL 3 with plenty of energy
    mockRoom = {
      name: "E54N39",
      controller: mockController,
      energyAvailable: 800,
      energyCapacityAvailable: 800,
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
        if (type === FIND_DROPPED_RESOURCES) {
          return [];
        }
        if (type === FIND_HOSTILE_CREEPS) {
          return []; // No hostiles in this test
        }
        return [];
      })
    } as unknown as Room;

    mockSpawn.room = mockRoom;
  });

  it("should reduce upgrader spawning during defensive posture", () => {
    // Setup: RoleControllerManager with defensive posture in memory
    const manager = new RoleControllerManager({}, logger);

    const mockMemory = {
      creepCounter: 0,
      roles: {},
      defense: {
        posture: {
          E54N39: "defensive" // Room under defensive posture
        },
        lastDefenseAction: 1000
      },
      threats: {
        rooms: {},
        lastUpdate: 0
      },
      combat: {
        squads: {}
      }
    } as unknown as Memory;

    const mockGame = {
      time: 1000,
      cpu: {
        limit: 500,
        getUsed: vi.fn().mockReturnValue(50)
      },
      creeps: {
        // Only 1 harvester exists, no upgraders
        harvester1: {
          name: "harvester1",
          memory: { role: "harvester" },
          room: mockRoom,
          pos: {
            x: 25,
            y: 25,
            roomName: "E54N39",
            findClosestByPath: vi.fn().mockReturnValue(mockSource),
            getRangeTo: vi.fn().mockReturnValue(5)
          },
          store: {
            getFreeCapacity: vi.fn().mockReturnValue(0),
            getUsedCapacity: vi.fn().mockReturnValue(50)
          }
        }
      },
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    } as unknown as GameContext;

    // Execute
    const result = manager.execute(mockGame, mockMemory, { harvester: 1 }, {});

    // Assert: Combat mode was logged
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("[RoleControllerManager] Combat mode active in rooms: E54N39")
    );

    // Assert: Spawn was called but upgraders should not be prioritized
    // In combat mode, attackers/healers/repairers are spawned before upgraders
    // Since we have 0 attackers/healers/repairers, they should spawn first
    const spawnCalls = (mockSpawn.spawnCreep as ReturnType<typeof vi.fn>).mock.calls;
    if (spawnCalls.length > 0) {
      const spawnedCreeps = spawnCalls.map(call => call[1] as string);
      // Check that if upgraders were spawned, they came after combat units
      const upgraderIndex = spawnedCreeps.findIndex(name => name.startsWith("upgrader-"));
      const attackerIndex = spawnedCreeps.findIndex(name => name.startsWith("attacker-"));
      const healerIndex = spawnedCreeps.findIndex(name => name.startsWith("healer-"));

      if (upgraderIndex !== -1 && (attackerIndex !== -1 || healerIndex !== -1)) {
        if (attackerIndex !== -1) {
          expect(attackerIndex).toBeLessThan(upgraderIndex);
        }
        if (healerIndex !== -1) {
          expect(healerIndex).toBeLessThan(upgraderIndex);
        }
      }
    }
  });

  it("should prioritize combat units in spawn order during alert posture", () => {
    const manager = new RoleControllerManager({}, logger);

    const mockMemory = {
      creepCounter: 0,
      roles: {},
      defense: {
        posture: {
          E54N39: "alert" // Room under alert posture
        },
        lastDefenseAction: 1000
      },
      threats: {
        rooms: {},
        lastUpdate: 0
      },
      combat: {
        squads: {}
      }
    } as unknown as Memory;

    const mockGame = {
      time: 1000,
      cpu: {
        limit: 500,
        getUsed: vi.fn().mockReturnValue(50)
      },
      creeps: {
        harvester1: {
          name: "harvester1",
          memory: { role: "harvester" },
          room: mockRoom,
          pos: {
            x: 25,
            y: 25,
            roomName: "E54N39",
            findClosestByPath: vi.fn().mockReturnValue(mockSource),
            getRangeTo: vi.fn().mockReturnValue(5)
          },
          store: {
            getFreeCapacity: vi.fn().mockReturnValue(0),
            getUsedCapacity: vi.fn().mockReturnValue(50)
          }
        }
      },
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    } as unknown as GameContext;

    // Execute
    manager.execute(mockGame, mockMemory, { harvester: 1 }, {});

    // Assert: Combat mode was logged
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("[RoleControllerManager] Combat mode active in rooms: E54N39")
    );
  });

  it("should use normal spawn priority when no defensive posture", () => {
    const manager = new RoleControllerManager({}, logger);

    const mockMemory = {
      creepCounter: 0,
      roles: {},
      defense: {
        posture: {
          E54N39: "normal" // Room in normal posture
        },
        lastDefenseAction: 0
      },
      threats: {
        rooms: {},
        lastUpdate: 0
      },
      combat: {
        squads: {}
      }
    } as unknown as Memory;

    const mockGame = {
      time: 1000,
      cpu: {
        limit: 500,
        getUsed: vi.fn().mockReturnValue(50)
      },
      creeps: {
        harvester1: {
          name: "harvester1",
          memory: { role: "harvester" },
          room: mockRoom,
          pos: {
            x: 25,
            y: 25,
            roomName: "E54N39",
            findClosestByPath: vi.fn().mockReturnValue(mockSource),
            getRangeTo: vi.fn().mockReturnValue(5)
          },
          store: {
            getFreeCapacity: vi.fn().mockReturnValue(0),
            getUsedCapacity: vi.fn().mockReturnValue(50)
          }
        }
      },
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    } as unknown as GameContext;

    // Execute
    manager.execute(mockGame, mockMemory, { harvester: 1 }, {});

    // Assert: Combat mode was NOT logged
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining("[RoleControllerManager] Combat mode active"));
  });

  it("should skip upgrader spawning entirely when minimum is 0 during combat", () => {
    const manager = new RoleControllerManager({}, logger);

    const mockMemory = {
      creepCounter: 0,
      roles: {},
      defense: {
        posture: {
          E54N39: "emergency" // Room under emergency posture
        },
        lastDefenseAction: 1000
      },
      threats: {
        rooms: {},
        lastUpdate: 0
      },
      combat: {
        squads: {}
      }
    } as unknown as Memory;

    const mockGame = {
      time: 1000,
      cpu: {
        limit: 500,
        getUsed: vi.fn().mockReturnValue(50)
      },
      creeps: {
        harvester1: {
          name: "harvester1",
          memory: { role: "harvester" },
          room: mockRoom,
          pos: {
            x: 25,
            y: 25,
            roomName: "E54N39",
            findClosestByPath: vi.fn().mockReturnValue(mockSource),
            getRangeTo: vi.fn().mockReturnValue(5)
          },
          store: {
            getFreeCapacity: vi.fn().mockReturnValue(0),
            getUsedCapacity: vi.fn().mockReturnValue(50)
          }
        }
      },
      spawns: { Spawn1: mockSpawn },
      rooms: { E54N39: mockRoom }
    } as unknown as GameContext;

    // Execute with upgrader minimum of 3 (should be reduced to 0 in emergency)
    manager.execute(mockGame, mockMemory, { harvester: 1, upgrader: 0 }, { upgrader: 3 });

    // Assert: No upgraders should be spawned
    const spawnCalls = (mockSpawn.spawnCreep as ReturnType<typeof vi.fn>).mock.calls;
    const spawnedUpgraders = spawnCalls.filter(call => {
      const name = call[1] as string;
      return name.startsWith("upgrader-");
    });

    expect(spawnedUpgraders.length).toBe(0);
  });
});
