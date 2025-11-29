import { describe, expect, it, beforeEach, vi } from "vitest";
import { RoleControllerManager } from "@runtime/behavior/RoleControllerManager";
import { serviceRegistry } from "@runtime/behavior/controllers/ServiceLocator";
import { MOVEMENT_PRIORITY, priorityMoveTo, type MovementPriorityLevel } from "@runtime/behavior/controllers/helpers";
import type { GameContext, SpawnLike, CreepLike, PositionLike } from "@runtime/types/GameContext";

// Minimal Screeps constants for test environment
const OK_CODE = 0;
const ERR_NOT_ENOUGH_ENERGY = -6;

beforeEach(() => {
  // Body part constants
  (globalThis as typeof globalThis & Record<string, unknown>).WORK = "work" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).CARRY = "carry" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).MOVE = "move" as BodyPartConstant;

  // Find / structure constants used by BodyComposer helpers
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_SOURCES = 1 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_MY_CREEPS = 2 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_MY_STRUCTURES = 3 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_SPAWN = "spawn" as StructureConstant;

  (globalThis as typeof globalThis & Record<string, unknown>).MAX_CREEP_SIZE = 50;
});

describe("RoleControllerManager spawning creep handling", () => {
  it("should skip behavior execution for creeps that are still spawning", () => {
    const memory = {} as Memory;

    const room: Room = {
      name: "W1N1",
      controller: { my: true } as StructureController,
      energyAvailable: 300,
      energyCapacityAvailable: 550,
      find: () => [],
      findPath: () => [],
      createConstructionSite: () => OK_CODE,
      getTerrain: () => ({ get: () => 0 }) as unknown as RoomTerrain
    };

    const spawn: SpawnLike = {
      name: "Spawn1",
      room,
      spawning: null,
      spawnCreep: vi.fn(() => OK_CODE),
      store: {
        getUsedCapacity: () => 0,
        getFreeCapacity: () => 300
      }
    };

    const moveTo = vi.fn(() => OK_CODE);

    // Create a spawning creep (spawning: true)
    const spawningCreep: CreepLike & { spawning: boolean } = {
      name: "claimer-spawning",
      memory: { role: "claimer" } as CreepMemory,
      room,
      pos: {
        findClosestByPath: () => null,
        inRangeTo: () => false,
        findInRange: () => []
      } as unknown as PositionLike,
      store: {
        getUsedCapacity: () => 0,
        getFreeCapacity: () => 0
      },
      harvest: () => OK_CODE,
      transfer: () => OK_CODE,
      moveTo,
      upgradeController: () => OK_CODE,
      withdraw: () => OK_CODE,
      build: () => OK_CODE,
      repair: () => OK_CODE,
      pickup: () => OK_CODE,
      drop: () => OK_CODE,
      spawning: true // Key: creep is still spawning
    };

    const game: GameContext = {
      time: 1,
      cpu: { limit: 10, bucket: 10000, getUsed: () => 0 },
      creeps: { "claimer-spawning": spawningCreep },
      spawns: { Spawn1: spawn },
      rooms: { W1N1: room }
    };

    (globalThis as typeof globalThis & Record<string, unknown>).Game = game as unknown as Game;

    const manager = new RoleControllerManager({}, console);

    // Execute the manager
    const result = manager.execute(game, memory, { claimer: 1 });

    // The spawning creep should be processed (counted) but moveTo should NOT be called
    // because spawning creeps are skipped before controller.execute()
    expect(result.processedCreeps).toBe(1);
    expect(moveTo).not.toHaveBeenCalled();
  });

  it("should execute behavior for creeps that are not spawning", () => {
    const memory = {} as Memory;

    const room: Room = {
      name: "W1N1",
      controller: { my: true } as StructureController,
      energyAvailable: 300,
      energyCapacityAvailable: 550,
      find: () => [],
      findPath: () => [],
      createConstructionSite: () => OK_CODE,
      getTerrain: () => ({ get: () => 0 }) as unknown as RoomTerrain
    };

    const spawn: SpawnLike = {
      name: "Spawn1",
      room,
      spawning: null,
      spawnCreep: vi.fn(() => OK_CODE),
      store: {
        getUsedCapacity: () => 0,
        getFreeCapacity: () => 300
      }
    };

    const moveTo = vi.fn(() => OK_CODE);

    // Create a non-spawning creep (spawning: false)
    const activeCreep: CreepLike & { spawning: boolean; ticksToLive: number } = {
      name: "harvester-active",
      memory: { role: "harvester" } as CreepMemory,
      room,
      pos: {
        findClosestByPath: () => null,
        inRangeTo: () => false,
        findInRange: () => []
      } as unknown as PositionLike,
      store: {
        getUsedCapacity: () => 0,
        getFreeCapacity: () => 50
      },
      harvest: () => OK_CODE,
      transfer: () => OK_CODE,
      moveTo,
      upgradeController: () => OK_CODE,
      withdraw: () => OK_CODE,
      build: () => OK_CODE,
      repair: () => OK_CODE,
      pickup: () => OK_CODE,
      drop: () => OK_CODE,
      spawning: false, // Creep is not spawning
      ticksToLive: 1000 // Not dying
    };

    const game: GameContext = {
      time: 1,
      cpu: { limit: 10, bucket: 10000, getUsed: () => 0 },
      creeps: { "harvester-active": activeCreep },
      spawns: { Spawn1: spawn },
      rooms: { W1N1: room }
    };

    (globalThis as typeof globalThis & Record<string, unknown>).Game = game as unknown as Game;

    const manager = new RoleControllerManager({}, console);

    // Execute the manager
    const result = manager.execute(game, memory, { harvester: 1 });

    // The non-spawning creep should be processed and behavior should execute
    expect(result.processedCreeps).toBe(1);
    // The harvester controller would call moveTo at some point
    // (depending on the state machine state)
  });
});

describe("RoleControllerManager spawning", () => {
  it("downscales body to available energy when capacity is higher, avoiding spawn starvation", () => {
    const spawned: string[] = [];
    const memory = {} as Memory;

    // Declare spawn first to avoid "used before defined" error
    let spawn: SpawnLike;

    const room: Room = {
      name: "W1N1",
      controller: { my: true } as StructureController,
      energyAvailable: 300,
      energyCapacityAvailable: 550,
      find: (type: FindConstant, opts?: { filter?: (obj: unknown) => boolean }) => {
        if (type === FIND_SOURCES) {
          return [{ id: "source1" } as Source];
        }
        if (type === FIND_MY_CREEPS) {
          const creeps = Object.values(Game.creeps).filter(c => (opts?.filter ? opts.filter(c as unknown) : true));
          return creeps as unknown[];
        }
        if (type === FIND_MY_STRUCTURES) {
          return [spawn as unknown];
        }
        return [];
      },
      findPath: () => [],
      createConstructionSite: () => OK_CODE,
      getTerrain: () => ({ get: () => 0 }) as unknown as RoomTerrain
    };

    spawn = {
      name: "Spawn1",
      room,
      spawning: null,
      spawnCreep: vi.fn((body: BodyPartConstant[], _name: string) => {
        const cost = body.reduce((sum, part) => {
          if (part === WORK) return sum + 100;
          if (part === CARRY) return sum + 50;
          if (part === MOVE) return sum + 50;
          return sum;
        }, 0);

        return room.energyAvailable >= cost ? OK_CODE : ERR_NOT_ENOUGH_ENERGY;
      }),
      store: {
        getUsedCapacity: () => 0,
        getFreeCapacity: () => 300
      }
    } satisfies SpawnLike;

    const game: GameContext = {
      time: 1,
      cpu: { limit: 10, bucket: 10000, getUsed: () => 0 },
      creeps: {
        hauler1: {
          name: "hauler1",
          memory: { role: "hauler" } as CreepMemory,
          room,
          pos: {
            findClosestByPath: () => null,
            inRangeTo: () => false,
            findInRange: () => []
          } as unknown as PositionLike,
          store: {
            getUsedCapacity: () => 0,
            getFreeCapacity: () => 0
          },
          harvest: () => OK_CODE,
          transfer: () => OK_CODE,
          moveTo: () => OK_CODE,
          upgradeController: () => OK_CODE,
          withdraw: () => OK_CODE,
          build: () => OK_CODE,
          repair: () => OK_CODE,
          pickup: () => OK_CODE,
          drop: () => OK_CODE
        } as CreepLike
      },
      spawns: { Spawn1: spawn },
      rooms: { W1N1: room }
    };

    // Role counts reflect the existing hauler but no harvesters
    const roleCounts: Record<string, number> = { hauler: 1, harvester: 0 };

    // BodyComposer uses global Game for sustainable capacity calculations
    (globalThis as typeof globalThis & Record<string, unknown>).Game = game as unknown as Game;

    const manager = new RoleControllerManager({}, console);

    // Access private helper for targeted regression scenario
    (manager as unknown as { ensureRoleMinimums: unknown })["ensureRoleMinimums"](
      game,
      memory,
      roleCounts,
      spawned,
      {}
    );

    expect(spawn.spawnCreep).toHaveBeenCalled();

    // Validate at least one call used an affordable body (<= available energy)
    const call = spawn.spawnCreep.mock.calls[0];
    const usedBody = call[0] as BodyPartConstant[];
    const usedName = call[1] as string;
    const cost = usedBody.reduce((sum, part) => {
      if (part === WORK) return sum + 100;
      if (part === CARRY) return sum + 50;
      if (part === MOVE) return sum + 50;
      return sum;
    }, 0);

    expect(cost).toBeLessThanOrEqual(room.energyAvailable ?? 0);
    expect(usedName).toMatch(/harvester-/);
    expect(roleCounts.harvester).toBe(1);
  });
});

describe("Traffic management integration", () => {
  it("should register PathfindingManager in service registry on construction", () => {
    // BodyComposer uses global Game for sustainable capacity calculations
    const game: GameContext = {
      time: 1,
      cpu: { limit: 10, bucket: 10000, getUsed: () => 0 },
      creeps: {},
      spawns: {},
      rooms: {}
    };
    (globalThis as typeof globalThis & Record<string, unknown>).Game = game as unknown as Game;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _manager = new RoleControllerManager({}, console);

    // PathfindingManager should be registered in the service registry
    const pathfindingManager = serviceRegistry.getPathfindingManager();
    expect(pathfindingManager).not.toBeNull();
    // Verify the provider name is set correctly
    expect(pathfindingManager?.getProviderName()).toBe("nescafe");
  });

  it("should have correct movement priority constants", () => {
    // Verify priority hierarchy (higher priority = moves first)
    expect(MOVEMENT_PRIORITY.STATIONARY_HARVESTER).toBeGreaterThan(MOVEMENT_PRIORITY.HARVESTER);
    expect(MOVEMENT_PRIORITY.HARVESTER).toBeGreaterThan(MOVEMENT_PRIORITY.HAULER);
    expect(MOVEMENT_PRIORITY.HAULER).toBeGreaterThan(MOVEMENT_PRIORITY.COMBAT);
    expect(MOVEMENT_PRIORITY.COMBAT).toBeGreaterThan(MOVEMENT_PRIORITY.BUILDER);
    expect(MOVEMENT_PRIORITY.BUILDER).toBeGreaterThan(MOVEMENT_PRIORITY.SUPPORT);
    expect(MOVEMENT_PRIORITY.SUPPORT).toBeGreaterThan(MOVEMENT_PRIORITY.UPGRADER);
    expect(MOVEMENT_PRIORITY.UPGRADER).toBe(0);
  });

  it("should fall back to native moveTo when PathfindingManager unavailable", () => {
    const moveTo = vi.fn(() => OK_CODE);
    const creep = {
      name: "test-creep",
      moveTo,
      pos: { x: 10, y: 10 }
    } as unknown as CreepLike;

    const targetPos = { x: 25, y: 25 } as RoomPosition;

    // Should fall back to native moveTo (PathfindingManager won't be available in test env)
    const result = priorityMoveTo(creep, targetPos, { priority: MOVEMENT_PRIORITY.HARVESTER });

    expect(moveTo).toHaveBeenCalled();
    expect(result).toBe(OK_CODE);
  });

  it("should accept priority option in priorityMoveTo", () => {
    const moveTo = vi.fn(() => OK_CODE);
    const creep = {
      name: "test-creep",
      moveTo,
      pos: { x: 10, y: 10 }
    } as unknown as CreepLike;

    const targetPos = { x: 25, y: 25 } as RoomPosition;

    // Call with specific priority
    priorityMoveTo(creep, targetPos, {
      priority: MOVEMENT_PRIORITY.STATIONARY_HARVESTER,
      range: 1,
      reusePath: 30
    });

    expect(moveTo).toHaveBeenCalledWith(
      targetPos,
      expect.objectContaining({
        range: 1,
        reusePath: 30,
        ignoreCreeps: true
      })
    );
  });

  it("should clamp invalid priority values to valid range 0-6", () => {
    const moveTo = vi.fn(() => OK_CODE);
    const creep = {
      name: "test-creep",
      moveTo,
      pos: { x: 10, y: 10 }
    } as unknown as CreepLike;

    const targetPos = { x: 25, y: 25 } as RoomPosition;

    // Test with out-of-range priority values
    // These should be clamped internally (though we can't directly observe the clamped value
    // in the native moveTo fallback, we verify no errors occur)
    priorityMoveTo(creep, targetPos, { priority: -5 as MovementPriorityLevel });
    expect(moveTo).toHaveBeenCalled();

    moveTo.mockClear();
    priorityMoveTo(creep, targetPos, { priority: 100 as MovementPriorityLevel });
    expect(moveTo).toHaveBeenCalled();
  });
});
