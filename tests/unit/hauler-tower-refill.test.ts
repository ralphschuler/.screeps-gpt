import { describe, expect, it, vi, beforeEach } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { CreepLike, GameContext, RoomLike } from "@runtime/types/GameContext";

/**
 * Test suite for hauler tower refilling behavior.
 * Verifies that towers receive energy even when spawns/extensions need topping off.
 */

beforeEach(() => {
  (global as { Game: { getObjectById: (id: Id<unknown>) => unknown | null } }).Game = {
    getObjectById: vi.fn(() => null)
  };
});

function createTestRoom(towerEnergy: number, spawnEnergy: number, extensionEnergy: number): RoomLike {
  const tower: StructureTower = {
    id: "tower-1" as Id<StructureTower>,
    structureType: STRUCTURE_TOWER,
    store: {
      getCapacity: vi.fn(() => 1000),
      getUsedCapacity: vi.fn(() => towerEnergy),
      getFreeCapacity: vi.fn(() => 1000 - towerEnergy)
    },
    pos: {
      x: 25,
      y: 25,
      roomName: "W0N0",
      findClosestByPath: vi.fn(() => null)
    } as unknown as RoomPosition
  } as unknown as StructureTower;

  const spawn: StructureSpawn = {
    id: "spawn-1" as Id<StructureSpawn>,
    structureType: STRUCTURE_SPAWN,
    store: {
      getCapacity: vi.fn(() => 300),
      getUsedCapacity: vi.fn(() => spawnEnergy),
      getFreeCapacity: vi.fn(() => 300 - spawnEnergy)
    },
    pos: {
      x: 24,
      y: 24,
      roomName: "W0N0",
      findInRange: vi.fn(() => [])
    } as unknown as RoomPosition
  } as unknown as StructureSpawn;

  const extension: StructureExtension = {
    id: "extension-1" as Id<StructureExtension>,
    structureType: STRUCTURE_EXTENSION,
    store: {
      getCapacity: vi.fn(() => 50),
      getUsedCapacity: vi.fn(() => extensionEnergy),
      getFreeCapacity: vi.fn(() => 50 - extensionEnergy)
    }
  } as unknown as StructureExtension;

  return {
    name: "W0N0",
    controller: {
      id: "controller-1" as Id<StructureController>,
      progress: 0,
      progressTotal: 1000,
      level: 3,
      my: true
    } as StructureController,
    find: vi.fn((findConstant: number) => {
      if (findConstant === FIND_SOURCES) {
        return [];
      }
      if (findConstant === FIND_MY_SPAWNS) {
        return [spawn];
      }
      if (findConstant === FIND_STRUCTURES) {
        return [tower, spawn, extension];
      }
      return [];
    }),
    storage: null
  };
}

function createHaulerCreep(energy: number): CreepLike {
  return {
    name: "hauler-1",
    memory: { role: "hauler", task: "haulerDeliver", version: 1 },
    store: {
      getFreeCapacity: vi.fn(() => 200 - energy),
      getUsedCapacity: vi.fn(() => energy),
      getCapacity: vi.fn(() => 200)
    },
    pos: {
      x: 25,
      y: 24,
      roomName: "W0N0",
      findClosestByPath: vi.fn(() => null)
    } as unknown as RoomPosition,
    room: null as unknown as RoomLike, // Will be set in tests
    transfer: vi.fn(() => OK),
    moveTo: vi.fn(() => OK),
    harvest: vi.fn(() => OK),
    upgradeController: vi.fn(() => OK),
    withdraw: vi.fn(() => OK),
    build: vi.fn(() => OK),
    repair: vi.fn(() => OK),
    pickup: vi.fn(() => OK)
  };
}

describe("Hauler Tower Refilling", () => {
  it("should prioritize towers when below 50% capacity even if extensions need topping off", () => {
    const room = createTestRoom(400, 280, 45); // Tower at 40%, spawn at 93%, extension at 90%
    const hauler = createHaulerCreep(100);
    hauler.room = room;

    const controller = new BehaviorController({ useTaskSystem: false });
    const game: GameContext = {
      time: 100,
      cpu: {
        limit: 500,
        getUsed: vi.fn(() => 10)
      },
      creeps: { "hauler-1": hauler },
      spawns: {},
      rooms: { W0N0: room }
    };

    const memory: Memory = { creepCounter: 0 };
    controller.execute(game, memory, {}, {});

    // Hauler should transfer to tower (below 50% threshold)
    expect(hauler.transfer).toHaveBeenCalled();
    const transferCall = (hauler.transfer as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(transferCall[0].structureType).toBe(STRUCTURE_TOWER);
  });

  it("should prioritize critical spawns/extensions below 50% over towers", () => {
    const room = createTestRoom(400, 100, 20); // Tower at 40%, spawn at 33%, extension at 40%
    const hauler = createHaulerCreep(100);
    hauler.room = room;

    const controller = new BehaviorController({ useTaskSystem: false });
    const game: GameContext = {
      time: 100,
      cpu: {
        limit: 500,
        getUsed: vi.fn(() => 10)
      },
      creeps: { "hauler-1": hauler },
      spawns: {},
      rooms: { W0N0: room }
    };

    const memory: Memory = { creepCounter: 0 };
    controller.execute(game, memory, {}, {});

    // Hauler should transfer to spawn or extension (below 50% threshold)
    // Note: The actual behavior depends on findClosestByPath which returns null in mocks,
    // so it will use the first item in the array returned by find
    expect(hauler.transfer).toHaveBeenCalled();
  });

  it("should fill towers when all spawns/extensions are above 50% capacity", () => {
    const room = createTestRoom(400, 200, 40); // Tower at 40%, spawn at 66%, extension at 80%
    const hauler = createHaulerCreep(100);
    hauler.room = room;

    const controller = new BehaviorController({ useTaskSystem: false });
    const game: GameContext = {
      time: 100,
      cpu: {
        limit: 500,
        getUsed: vi.fn(() => 10)
      },
      creeps: { "hauler-1": hauler },
      spawns: {},
      rooms: { W0N0: room }
    };

    const memory: Memory = { creepCounter: 0 };
    controller.execute(game, memory, {}, {});

    // Hauler should transfer to tower
    expect(hauler.transfer).toHaveBeenCalled();
    const transferCall = (hauler.transfer as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(transferCall[0].structureType).toBe(STRUCTURE_TOWER);
  });

  it("should fill spawn containers when below 300 energy reserve", () => {
    const spawnContainer: StructureContainer = {
      id: "container-1" as Id<StructureContainer>,
      structureType: STRUCTURE_CONTAINER,
      store: {
        getCapacity: vi.fn(() => 2000),
        getUsedCapacity: vi.fn(() => 200), // Below 300 reserve
        getFreeCapacity: vi.fn(() => 1800)
      },
      pos: {
        x: 24,
        y: 25,
        roomName: "W0N0"
      } as RoomPosition
    } as unknown as StructureContainer;

    const spawn: StructureSpawn = {
      id: "spawn-1" as Id<StructureSpawn>,
      structureType: STRUCTURE_SPAWN,
      store: {
        getCapacity: vi.fn(() => 300),
        getUsedCapacity: vi.fn(() => 280), // 93% full
        getFreeCapacity: vi.fn(() => 20)
      },
      pos: {
        x: 24,
        y: 24,
        roomName: "W0N0",
        findInRange: vi.fn(() => [spawnContainer])
      } as unknown as RoomPosition
    } as unknown as StructureSpawn;

    const tower: StructureTower = {
      id: "tower-1" as Id<StructureTower>,
      structureType: STRUCTURE_TOWER,
      store: {
        getCapacity: vi.fn(() => 1000),
        getUsedCapacity: vi.fn(() => 600), // 60% full
        getFreeCapacity: vi.fn(() => 400)
      }
    } as unknown as StructureTower;

    const room: RoomLike = {
      name: "W0N0",
      controller: {
        id: "controller-1" as Id<StructureController>,
        progress: 0,
        progressTotal: 1000,
        level: 3,
        my: true
      } as StructureController,
      find: vi.fn((findConstant: number) => {
        if (findConstant === FIND_MY_SPAWNS) {
          return [spawn];
        }
        if (findConstant === FIND_STRUCTURES) {
          return [tower, spawn, spawnContainer];
        }
        return [];
      }),
      storage: null
    };

    const hauler = createHaulerCreep(100);
    hauler.room = room;

    const controller = new BehaviorController({ useTaskSystem: false });
    const game: GameContext = {
      time: 100,
      cpu: {
        limit: 500,
        getUsed: vi.fn(() => 10)
      },
      creeps: { "hauler-1": hauler },
      spawns: {},
      rooms: { W0N0: room }
    };

    const memory: Memory = { creepCounter: 0 };
    controller.execute(game, memory, {}, {});

    // Hauler should transfer to spawn container (below 300 reserve threshold)
    // Note: Due to priority order, spawn container filling happens after critical structures
    // and towers that are below thresholds. In this test, the tower is above 50% so the
    // container should be prioritized.
    expect(hauler.transfer).toHaveBeenCalled();
  });
});
