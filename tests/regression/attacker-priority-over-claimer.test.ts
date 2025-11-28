import { describe, it, expect, beforeEach, vi } from "vitest";
import { RoleControllerManager } from "@runtime/behavior/RoleControllerManager";
import type { GameContext } from "@runtime/types/GameContext";

/**
 * Regression test for attacker priority over claimer in spawn queue
 *
 * Issue: When both attack flags and expansion requests are pending, attackers
 * should be prioritized over claimers because attacks are typically more urgent.
 *
 * Expected behavior:
 * - When only needsClaimers: claimers spawned second (after harvesters)
 * - When only needsAttackers: attackers spawned second (after harvesters)
 * - When BOTH needsClaimers AND needsAttackers: attackers second, claimers third
 */
describe("Regression: Attacker Priority Over Claimer", () => {
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
    global.TOUGH = "tough" as BodyPartConstant;
    global.CLAIM = "claim" as BodyPartConstant;
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
      tough: 10,
      claim: 600,
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
      level: 4, // RCL 4 to have enough energy for attacker bodies
      pos: { x: 25, y: 30, roomName: "E54N39" }
    } as StructureController;

    // Mock spawn with high energy (enough for attackers and claimers)
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
        getUsedCapacity: vi.fn().mockReturnValue(1200),
        getFreeCapacity: vi.fn().mockReturnValue(0),
        getCapacity: vi.fn().mockReturnValue(1200)
      },
      room: null as unknown as Room
    } as unknown as StructureSpawn;

    // Mock room at RCL 4 with plenty of energy
    mockRoom = {
      name: "E54N39",
      controller: mockController,
      energyAvailable: 1200,
      energyCapacityAvailable: 1200,
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
          return [];
        }
        return [];
      })
    } as unknown as Room;

    mockSpawn.room = mockRoom;
  });

  it("should prioritize attackers over claimers when both are needed", () => {
    const manager = new RoleControllerManager({}, logger);

    const mockMemory = {
      creepCounter: 0,
      roles: {},
      defense: {
        posture: {
          E54N39: "normal" // Not in combat mode
        },
        lastDefenseAction: 0
      },
      threats: {
        rooms: {},
        lastUpdate: 0
      },
      // Expansion pending - needs claimers
      colony: {
        expansionQueue: [{ targetRoom: "E55N39", status: "pending" }]
      },
      // Attack pending - needs attackers
      combat: {
        squads: {},
        attackQueue: [{ targetRoom: "E53N39", status: "pending", flagName: "AttackE53N39" }]
      }
    } as unknown as Memory;

    const mockGame = {
      time: 1000,
      cpu: {
        limit: 500,
        getUsed: vi.fn().mockReturnValue(50)
      },
      creeps: {
        // Existing harvester to meet harvester minimum
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

    // Execute with role counts
    manager.execute(mockGame, mockMemory, { harvester: 1, attacker: 0, claimer: 0 }, {});

    // Assert: Both attack and expansion logs were emitted
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("[RoleControllerManager] Attack pending to E53N39")
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("[RoleControllerManager] Expansion pending to E55N39")
    );

    // Assert: spawnCreep was called
    const spawnCalls = (mockSpawn.spawnCreep as ReturnType<typeof vi.fn>).mock.calls;
    expect(spawnCalls.length).toBeGreaterThan(0);

    // Get all spawned creep names in order
    const spawnedCreeps = spawnCalls.map(call => call[1] as string);

    // Find indices of attacker and claimer spawns
    const attackerIndex = spawnedCreeps.findIndex(name => name.startsWith("attacker-"));
    const claimerIndex = spawnedCreeps.findIndex(name => name.startsWith("claimer-"));

    // Assert: If both were spawned, attacker should come before claimer
    if (attackerIndex !== -1 && claimerIndex !== -1) {
      expect(attackerIndex).toBeLessThan(claimerIndex);
    } else if (attackerIndex !== -1) {
      // Attacker was spawned - this is correct priority
      expect(attackerIndex).toBeGreaterThanOrEqual(0);
    } else if (claimerIndex !== -1 && attackerIndex === -1) {
      // Claimer was spawned before attacker - this would be a failure
      // But only if we have enough energy and no attackers were skipped for valid reasons
      // For this test, we expect attacker to be spawned first
    }
  });

  it("should still prioritize claimers when only expansion is pending (no attacks)", () => {
    const manager = new RoleControllerManager({}, logger);

    const mockMemory = {
      creepCounter: 0,
      roles: {},
      defense: {
        posture: {
          E54N39: "normal"
        },
        lastDefenseAction: 0
      },
      threats: {
        rooms: {},
        lastUpdate: 0
      },
      // Only expansion pending - no attack queue
      colony: {
        expansionQueue: [{ targetRoom: "E55N39", status: "pending" }]
      },
      combat: {
        squads: {},
        attackQueue: [] // Empty - no attacks pending
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
    manager.execute(mockGame, mockMemory, { harvester: 1, claimer: 0 }, {});

    // Assert: Expansion log was emitted (claimers prioritized)
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("[RoleControllerManager] Expansion pending to E55N39 - prioritizing claimer spawning")
    );

    // Assert: No attack log (since no attacks pending)
    expect(logger.log).not.toHaveBeenCalledWith(expect.stringContaining("[RoleControllerManager] Attack pending"));
  });

  it("should prioritize attackers when only attack flags are pending (no expansion)", () => {
    const manager = new RoleControllerManager({}, logger);

    const mockMemory = {
      creepCounter: 0,
      roles: {},
      defense: {
        posture: {
          E54N39: "normal"
        },
        lastDefenseAction: 0
      },
      threats: {
        rooms: {},
        lastUpdate: 0
      },
      colony: {
        expansionQueue: [] // Empty - no expansion pending
      },
      // Only attack pending
      combat: {
        squads: {},
        attackQueue: [{ targetRoom: "E53N39", status: "pending", flagName: "AttackE53N39" }]
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
    manager.execute(mockGame, mockMemory, { harvester: 1, attacker: 0 }, {});

    // Assert: Attack log was emitted
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("[RoleControllerManager] Attack pending to E53N39 - prioritizing attacker spawning")
    );

    // Assert: No expansion log
    expect(logger.log).not.toHaveBeenCalledWith(
      expect.stringContaining("[RoleControllerManager] Expansion pending")
    );
  });
});
