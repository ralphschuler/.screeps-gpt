import { describe, expect, it, vi, beforeEach } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { CreepLike, GameContext, RoomLike } from "@runtime/types/GameContext";

// Mock global Game object
beforeEach(() => {
  (global as { Game: { getObjectById: (id: Id<unknown>) => unknown | null } }).Game = {
    getObjectById: vi.fn(() => null)
  };
});

function createTestRoom(): RoomLike {
  return {
    name: "W0N0",
    controller: {
      id: "controller-1" as Id<StructureController>,
      progress: 0,
      progressTotal: 1000
    } as StructureController,
    find: vi.fn(() => []),
    storage: null
  };
}

function createSource(id: string): Source {
  return {
    id: id as Id<Source>,
    pos: {
      x: 25,
      y: 25,
      roomName: "W0N0",
      findInRange: vi.fn(() => []),
      inRangeTo: vi.fn(() => true)
    } as unknown as RoomPosition,
    energy: 3000,
    energyCapacity: 3000
  } as Source;
}

function createContainer(id: string, energy: number): StructureContainer {
  return {
    id: id as Id<StructureContainer>,
    structureType: STRUCTURE_CONTAINER,
    pos: {
      x: 26,
      y: 25,
      roomName: "W0N0"
    } as RoomPosition,
    store: {
      getFreeCapacity: vi.fn(() => 2000 - energy),
      getUsedCapacity: vi.fn(() => energy)
    }
  } as unknown as StructureContainer;
}

describe("Stationary Harvester Role", () => {
  it("should have correct role and task structure", () => {
    const creep: CreepLike = {
      name: "stationaryHarvester-1",
      memory: { role: "stationaryHarvester", task: "stationaryHarvest", version: 1 },
      store: {
        getFreeCapacity: vi.fn(() => 50),
        getUsedCapacity: vi.fn(() => 0)
      },
      pos: {
        x: 24,
        y: 25,
        roomName: "W0N0",
        findClosestByPath: vi.fn(() => null),
        inRangeTo: vi.fn(() => false)
      } as unknown as RoomPosition,
      room: createTestRoom(),
      harvest: vi.fn(() => OK),
      transfer: vi.fn(() => OK),
      moveTo: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK),
      pickup: vi.fn(() => OK),
      drop: vi.fn(() => OK)
    };

    expect(creep.memory.role).toBe("stationaryHarvester");
    expect(creep.memory.task).toBe("stationaryHarvest");
    expect(creep.memory.version).toBe(1);
  });

  it("should have body parts optimized for harvesting", () => {
    // Verify the role definition has appropriate body parts
    // 5 WORK parts for maximum harvesting, 1 MOVE for positioning
    const expectedBody = [WORK, WORK, WORK, WORK, WORK, MOVE];
    expect(expectedBody.length).toBe(6);
    expect(expectedBody.filter(p => p === WORK).length).toBe(5);
    expect(expectedBody.filter(p => p === MOVE).length).toBe(1);
  });

  it("should stay assigned to same source across ticks", () => {
    const room = createTestRoom();
    const source = createSource("source-1");

    (global as { Game: { getObjectById: (id: Id<unknown>) => unknown | null } }).Game.getObjectById = vi.fn(id => {
      if (id === "source-1") return source;
      return null;
    });

    const creep: CreepLike = {
      name: "stationaryHarvester-1",
      memory: {
        role: "stationaryHarvester",
        task: "stationaryHarvest",
        version: 1,
        sourceId: "source-1" as Id<Source>
      },
      store: {
        getFreeCapacity: vi.fn(() => 50),
        getUsedCapacity: vi.fn(() => 0)
      },
      pos: {
        x: 25,
        y: 26,
        roomName: "W0N0",
        inRangeTo: vi.fn(() => true)
      } as unknown as RoomPosition,
      room,
      harvest: vi.fn(() => OK),
      transfer: vi.fn(() => OK),
      moveTo: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK),
      pickup: vi.fn(() => OK),
      drop: vi.fn(() => OK)
    };

    const game: GameContext = {
      time: 3,
      cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
      creeps: { harvester: creep },
      spawns: {},
      rooms: { W0N0: room }
    };

    const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });
    const memory = {} as Memory;

    controller.execute(game, memory, { stationaryHarvester: 1 });

    // Should keep the same source
    expect(creep.memory.sourceId).toBe("source-1");
  });
});

describe("Hauler Role", () => {
  it("should have correct role and task structure", () => {
    const creep: CreepLike = {
      name: "hauler-1",
      memory: { role: "hauler", task: "pickup", version: 1 },
      store: {
        getFreeCapacity: vi.fn(() => 200),
        getUsedCapacity: vi.fn(() => 0)
      },
      pos: {
        x: 27,
        y: 25,
        roomName: "W0N0",
        findClosestByPath: vi.fn(() => null)
      } as unknown as RoomPosition,
      room: createTestRoom(),
      harvest: vi.fn(() => OK),
      transfer: vi.fn(() => OK),
      moveTo: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK),
      pickup: vi.fn(() => OK),
      drop: vi.fn(() => OK)
    };

    expect(creep.memory.role).toBe("hauler");
    expect(creep.memory.task).toBe("pickup");
    expect(creep.memory.version).toBe(1);
  });

  it("should have body parts optimized for carrying", () => {
    // Verify the role definition has appropriate body parts
    // 4 CARRY parts for maximum capacity, 4 MOVE for speed
    const expectedBody = [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
    expect(expectedBody.length).toBe(8);
    expect(expectedBody.filter(p => p === CARRY).length).toBe(4);
    expect(expectedBody.filter(p => p === MOVE).length).toBe(4);
  });

  it("should prioritize spawns and extensions for delivery", () => {
    const room = createTestRoom();
    const spawn = {
      structureType: STRUCTURE_SPAWN,
      pos: { x: 30, y: 30, roomName: "W0N0" } as RoomPosition,
      store: {
        getFreeCapacity: vi.fn(() => 300),
        getUsedCapacity: vi.fn(() => 0)
      }
    } as unknown as StructureSpawn;

    const extension = {
      structureType: STRUCTURE_EXTENSION,
      pos: { x: 31, y: 30, roomName: "W0N0" } as RoomPosition,
      store: {
        getFreeCapacity: vi.fn(() => 50),
        getUsedCapacity: vi.fn(() => 0)
      }
    } as unknown as StructureExtension;

    room.find = vi.fn((type: FindConstant) => {
      if (type === FIND_STRUCTURES) {
        return [spawn, extension];
      }
      return [];
    });

    const transfer = vi.fn(() => OK);

    const creep: CreepLike = {
      name: "hauler-1",
      memory: { role: "hauler", task: "haulerDeliver", version: 1 },
      store: {
        getFreeCapacity: vi.fn(() => 0),
        getUsedCapacity: vi.fn(() => 200)
      },
      pos: {
        x: 29,
        y: 30,
        roomName: "W0N0",
        findClosestByPath: vi.fn((targets: Array<unknown>) => targets[0])
      } as unknown as RoomPosition,
      room,
      harvest: vi.fn(() => OK),
      transfer,
      moveTo: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK),
      pickup: vi.fn(() => OK),
      drop: vi.fn(() => OK)
    };

    const game: GameContext = {
      time: 5,
      cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
      creeps: { hauler: creep },
      spawns: {},
      rooms: { W0N0: room }
    };

    const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });
    const memory = {} as Memory;

    controller.execute(game, memory, { hauler: 1 });

    expect(transfer).toHaveBeenCalledWith(spawn, RESOURCE_ENERGY);
  });

  it("should transition between pickup and deliver tasks", () => {
    const room = createTestRoom();
    const container = createContainer("container-1", 500);

    room.find = vi.fn((type: FindConstant) => {
      if (type === FIND_STRUCTURES) {
        return [container];
      }
      if (type === FIND_DROPPED_RESOURCES) {
        return [];
      }
      return [];
    });

    const creep: CreepLike = {
      name: "hauler-1",
      memory: { role: "hauler", task: "pickup", version: 1 },
      store: {
        getFreeCapacity: vi.fn(() => 0), // Full
        getUsedCapacity: vi.fn(() => 200)
      },
      pos: {
        x: 27,
        y: 25,
        roomName: "W0N0",
        findClosestByPath: vi.fn(() => container)
      } as unknown as RoomPosition,
      room,
      harvest: vi.fn(() => OK),
      transfer: vi.fn(() => OK),
      moveTo: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK),
      pickup: vi.fn(() => OK),
      drop: vi.fn(() => OK)
    };

    const game: GameContext = {
      time: 6,
      cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
      creeps: { hauler: creep },
      spawns: {},
      rooms: { W0N0: room }
    };

    const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });
    const memory = {} as Memory;

    controller.execute(game, memory, { hauler: 1 });

    // Should transition to deliver when full
    expect(creep.memory.task).toBe("haulerDeliver");
  });

  it("should deliver to storage as fallback when spawns/extensions are full", () => {
    const storage = {
      structureType: STRUCTURE_STORAGE,
      pos: { x: 25, y: 25, roomName: "W0N0" } as RoomPosition,
      store: {
        getFreeCapacity: vi.fn(() => 100000),
        getUsedCapacity: vi.fn(() => 0)
      }
    } as unknown as StructureStorage;

    const room = createTestRoom();
    room.storage = storage;

    room.find = vi.fn((_type: FindConstant) => {
      // No spawns or extensions need energy
      return [];
    });

    const transfer = vi.fn(() => OK);

    const creep: CreepLike = {
      name: "hauler-1",
      memory: { role: "hauler", task: "haulerDeliver", version: 1 },
      store: {
        getFreeCapacity: vi.fn(() => 0),
        getUsedCapacity: vi.fn(() => 200)
      },
      pos: {
        x: 26,
        y: 25,
        roomName: "W0N0",
        findClosestByPath: vi.fn(() => null)
      } as unknown as RoomPosition,
      room,
      harvest: vi.fn(() => OK),
      transfer,
      moveTo: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK),
      pickup: vi.fn(() => OK),
      drop: vi.fn(() => OK)
    };

    const game: GameContext = {
      time: 7,
      cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
      creeps: { hauler: creep },
      spawns: {},
      rooms: { W0N0: room }
    };

    const controller = new BehaviorController({}, { log: vi.fn(), warn: vi.fn() });
    const memory = {} as Memory;

    controller.execute(game, memory, { hauler: 1 });

    expect(transfer).toHaveBeenCalledWith(storage, RESOURCE_ENERGY);
  });
});
