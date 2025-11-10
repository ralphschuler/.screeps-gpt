import { describe, expect, it, vi } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { CreepLike, GameContext, RoomLike } from "@runtime/types/GameContext";

function createGameContext(options: { time: number; hasSpawns: boolean }): GameContext {
  const dummyRoom: RoomLike = { name: "W0N0", controller: null, find: () => [] };
  const dummySpawn = {
    name: "spawn1",
    spawning: null,
    spawnCreep: vi.fn().mockReturnValue(OK),
    store: { getFreeCapacity: () => 300, getUsedCapacity: () => 0 },
    room: dummyRoom
  };

  return {
    time: options.time,
    cpu: {
      getUsed: () => 0,
      limit: 10,
      bucket: 1000
    },
    creeps: {},
    spawns: options.hasSpawns ? { spawn1: dummySpawn } : {},
    rooms: options.hasSpawns ? { W0N0: dummyRoom } : {}
  };
}

describe("BehaviorController", () => {
  describe("deterministic creep naming", () => {
    it("should generate deterministic creep names using memory counter", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });
      const game = createGameContext({ time: 100, hasSpawns: true });
      const memory = {} as Memory;
      const roleCounts = {};

      const result = controller.execute(game, memory, roleCounts);

      // Verify creep counter was initialized
      expect(memory.creepCounter).toBeDefined();
      expect(typeof memory.creepCounter).toBe("number");

      // Verify spawned creeps have deterministic names
      expect(result.spawnedCreeps.length).toBeGreaterThan(0);
      const firstCreepName = result.spawnedCreeps[0];
      expect(firstCreepName).toMatch(/^(harvester|upgrader|builder)-100-\d+$/);
      expect(firstCreepName).not.toContain("NaN");
    });

    it("should generate identical names across multiple runs with same initial state", () => {
      const game1 = createGameContext({ time: 100, hasSpawns: true });
      const memory1 = {} as Memory;
      const controller1 = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const result1 = controller1.execute(game1, memory1, {});
      const names1 = result1.spawnedCreeps;

      // Reset and run again with same initial state
      const game2 = createGameContext({ time: 100, hasSpawns: true });
      const memory2 = {} as Memory;
      const controller2 = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const result2 = controller2.execute(game2, memory2, {});
      const names2 = result2.spawnedCreeps;

      // Names should be identical when starting from same state
      expect(names1).toEqual(names2);
    });

    it("should increment counter for each spawned creep", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });
      const game = createGameContext({ time: 100, hasSpawns: true });
      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = {};

      const result = controller.execute(game, memory, roleCounts);

      // Counter should have incremented for each spawned creep
      expect(memory.creepCounter).toBe(result.spawnedCreeps.length);
      expect(memory.creepCounter).toBeGreaterThan(0);
    });

    it("should preserve counter across multiple ticks", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });
      const memory = {} as Memory;

      // First tick
      const game1 = createGameContext({ time: 100, hasSpawns: true });
      controller.execute(game1, memory, {});
      const counterAfterTick1 = memory.creepCounter;

      // Second tick - all roles satisfied, no new spawns
      const game2 = createGameContext({ time: 101, hasSpawns: true });
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2 };
      controller.execute(game2, memory, roleCounts);

      // Counter should remain unchanged when no spawning occurs
      expect(memory.creepCounter).toBe(counterAfterTick1);

      // Third tick - needs more harvesters (below minimum)
      const game3 = createGameContext({ time: 102, hasSpawns: true });
      controller.execute(game3, memory, { harvester: 3, upgrader: 3, builder: 2 });

      // Counter should increment
      expect(memory.creepCounter).toBeGreaterThan(counterAfterTick1);
    });

    it("should generate unique names for creeps spawned in same tick", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });
      const game = createGameContext({ time: 100, hasSpawns: true });
      const memory = {} as Memory;

      const result = controller.execute(game, memory, {});

      // All spawned names should be unique
      const uniqueNames = new Set(result.spawnedCreeps);
      expect(uniqueNames.size).toBe(result.spawnedCreeps.length);
    });
  });

  describe("role execution", () => {
    it("runs builder gather logic to withdraw energy when storage is available", () => {
      const controller = new BehaviorController({ useTaskSystem: false, log: vi.fn(), warn: vi.fn() });

      const container = {
        structureType: STRUCTURE_CONTAINER,
        store: {
          getFreeCapacity: vi.fn(() => 0),
          getUsedCapacity: vi.fn(() => 200)
        }
      } as unknown as AnyStoreStructure;

      const builderRoom: RoomLike = {
        name: "W0N0",
        controller: null,
        find: (type: FindConstant) => {
          if (type === FIND_STRUCTURES) {
            return [container];
          }
          if (type === FIND_CONSTRUCTION_SITES) {
            return [];
          }
          if (type === FIND_SOURCES_ACTIVE) {
            return [];
          }
          return [];
        }
      };

      const storeState = { free: 50, used: 0 };
      const withdraw = vi.fn(() => {
        storeState.free = 0;
        storeState.used = 50;
        return OK;
      });
      const builder: CreepLike = {
        name: "builder-alpha",
        memory: { role: "builder", task: "gather", version: 1 },
        store: {
          getFreeCapacity: vi.fn(() => storeState.free),
          getUsedCapacity: vi.fn(() => storeState.used)
        },
        pos: {
          findClosestByPath: vi.fn((objects: unknown[]) => (objects.length > 0 ? (objects[0] as never) : null))
        },
        room: builderRoom,
        harvest: vi.fn(() => OK),
        transfer: vi.fn(() => OK),
        moveTo: vi.fn(() => OK),
        upgradeController: vi.fn(() => OK),
        withdraw,
        build: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      };

      const game: GameContext = {
        time: 1,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: { builder },
        spawns: {},
        rooms: { W0N0: builderRoom }
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2 };

      const result = controller.execute(game, memory, roleCounts);

      expect(withdraw).toHaveBeenCalledTimes(1);
      expect(result.tasksExecuted.gather).toBe(1);
    });

    it("repairs structures when builder has no construction work", () => {
      const controller = new BehaviorController({ useTaskSystem: false, log: vi.fn(), warn: vi.fn() });

      const damagedRoad = {
        structureType: STRUCTURE_ROAD,
        hits: 100,
        hitsMax: 1000
      } as unknown as Structure;

      const builderRoom: RoomLike = {
        name: "W0N0",
        controller: {
          id: "controller",
          progress: 0,
          progressTotal: 0
        } as unknown as StructureController,
        find: (type: FindConstant) => {
          if (type === FIND_CONSTRUCTION_SITES) {
            return [];
          }
          if (type === FIND_STRUCTURES) {
            return [damagedRoad];
          }
          if (type === FIND_SOURCES_ACTIVE) {
            return [];
          }
          return [];
        }
      };

      const storeState = { free: 0, used: 50 };
      const repair = vi.fn(() => OK);
      const builder: CreepLike = {
        name: "builder-beta",
        memory: { role: "builder", task: "build", version: 1 },
        store: {
          getFreeCapacity: vi.fn(() => storeState.free),
          getUsedCapacity: vi.fn(() => storeState.used)
        },
        pos: {
          findClosestByPath: vi.fn((objects: unknown[]) => (objects.length > 0 ? (objects[0] as never) : null))
        },
        room: builderRoom,
        harvest: vi.fn(() => OK),
        transfer: vi.fn(() => OK),
        moveTo: vi.fn(() => OK),
        upgradeController: vi.fn(() => OK),
        withdraw: vi.fn(() => OK),
        build: vi.fn(() => OK),
        repair
      };

      const game: GameContext = {
        time: 2,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: { builder },
        spawns: {},
        rooms: { W0N0: builderRoom }
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2 };

      const result = controller.execute(game, memory, roleCounts);

      expect(repair).toHaveBeenCalledTimes(1);
      expect(result.tasksExecuted.maintain).toBe(1);
    });

    it("cycles remote miner through travel, mine, and return tasks", () => {
      const controller = new BehaviorController({ useTaskSystem: false, log: vi.fn(), warn: vi.fn() });

      const homeSpawn = {
        structureType: STRUCTURE_SPAWN,
        store: {
          getFreeCapacity: vi.fn(() => 300),
          getUsedCapacity: vi.fn(() => 0)
        }
      } as unknown as AnyStoreStructure;

      const source = { id: "source-1" } as Source;

      const homeRoom: RoomLike = {
        name: "W0N0",
        controller: {
          id: "ctrl-home",
          progress: 0,
          progressTotal: 0
        } as unknown as StructureController,
        find: (type: FindConstant) => {
          if (type === FIND_STRUCTURES) {
            return [homeSpawn];
          }
          return [];
        }
      };

      const remoteRoom: RoomLike = {
        name: "W1N1",
        controller: null,
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES_ACTIVE) {
            return [source];
          }
          return [];
        }
      };

      const storeState = { free: 50, used: 0 };
      const harvest = vi.fn(() => {
        storeState.free = Math.max(0, storeState.free - 10);
        storeState.used = Math.min(50, storeState.used + 10);
        return OK;
      });
      const transfer = vi.fn(() => {
        storeState.free = 50;
        storeState.used = 0;
        return OK;
      });
      const moveTo = vi.fn(() => OK);
      const remoteMiner: CreepLike = {
        name: "remoteMiner-alpha",
        memory: { role: "remoteMiner", task: "travel", version: 1, targetRoom: "W1N1" },
        store: {
          getFreeCapacity: vi.fn(() => storeState.free),
          getUsedCapacity: vi.fn(() => storeState.used)
        },
        pos: {
          findClosestByPath: vi.fn((objects: unknown[]) => (objects.length > 0 ? (objects[0] as never) : null))
        },
        room: homeRoom,
        harvest,
        transfer,
        moveTo,
        upgradeController: vi.fn(() => OK),
        withdraw: vi.fn(() => OK),
        build: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      };

      const game: GameContext = {
        time: 3,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: { remote: remoteMiner },
        spawns: {},
        rooms: { W0N0: homeRoom, W1N1: remoteRoom }
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2, remoteMiner: 1 };

      // Step 1: travel to remote room
      let result = controller.execute(game, memory, roleCounts);
      expect(moveTo).toHaveBeenCalled();
      expect(result.tasksExecuted.travel).toBe(1);
      expect(remoteMiner.memory.homeRoom).toBe("W0N0");

      // Step 2: arrive and mine
      remoteMiner.room = remoteRoom;
      result = controller.execute(game, memory, roleCounts);
      expect(harvest).toHaveBeenCalled();
      expect(result.tasksExecuted.mine).toBe(1);

      // Step 3: inventory full triggers return state
      storeState.free = 0;
      storeState.used = 50;
      result = controller.execute(game, memory, roleCounts);
      expect(result.tasksExecuted.return).toBe(1);
      expect(remoteMiner.memory.task).toBe("return");

      // Step 4: deliver energy at home room
      remoteMiner.room = homeRoom;
      result = controller.execute(game, memory, roleCounts);
      expect(transfer).toHaveBeenCalled();
      expect(result.tasksExecuted.return).toBeGreaterThanOrEqual(1);
      expect(remoteMiner.memory.task).toBe("travel");
    });
  });

  describe("energy source protection", () => {
    it("prevents upgraders from withdrawing energy from spawns", () => {
      const controller = new BehaviorController({ useTaskSystem: false, log: vi.fn(), warn: vi.fn() });

      const spawn = {
        structureType: STRUCTURE_SPAWN,
        store: {
          getFreeCapacity: vi.fn(() => 0),
          getUsedCapacity: vi.fn(() => 300)
        }
      } as unknown as AnyStoreStructure;

      const container = {
        structureType: STRUCTURE_CONTAINER,
        store: {
          getFreeCapacity: vi.fn(() => 0),
          getUsedCapacity: vi.fn(() => 200)
        }
      } as unknown as AnyStoreStructure;

      const upgraderRoom: RoomLike = {
        name: "W0N0",
        controller: {
          id: "controller",
          progress: 0,
          progressTotal: 0
        } as unknown as StructureController,
        find: (type: FindConstant, opts?: { filter?: (object: unknown) => boolean }) => {
          if (type === FIND_STRUCTURES) {
            const structures = [spawn, container];
            if (opts && opts.filter) {
              return structures.filter(opts.filter);
            }
            return structures;
          }
          if (type === FIND_SOURCES_ACTIVE) {
            return [];
          }
          if (type === FIND_DROPPED_RESOURCES) {
            return [];
          }
          return [];
        }
      };

      const withdraw = vi.fn(() => OK);
      const upgrader: CreepLike = {
        name: "upgrader-alpha",
        memory: { role: "upgrader", task: "recharge", version: 1 },
        store: {
          getFreeCapacity: vi.fn(() => 50),
          getUsedCapacity: vi.fn(() => 0)
        },
        pos: {
          findClosestByPath: vi.fn((objects: unknown[]) => (objects.length > 0 ? (objects[0] as never) : null))
        },
        room: upgraderRoom,
        harvest: vi.fn(() => OK),
        transfer: vi.fn(() => OK),
        moveTo: vi.fn(() => OK),
        upgradeController: vi.fn(() => OK),
        withdraw,
        pickup: vi.fn(() => OK),
        build: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      };

      const game: GameContext = {
        time: 1,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: { upgrader },
        spawns: {},
        rooms: { W0N0: upgraderRoom }
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2 };

      controller.execute(game, memory, roleCounts);

      // Verify that withdraw was called with the container, not the spawn
      expect(withdraw).toHaveBeenCalledTimes(1);
      expect(withdraw).toHaveBeenCalledWith(container, RESOURCE_ENERGY);
    });

    it("prevents upgraders from withdrawing energy from extensions", () => {
      const controller = new BehaviorController({ useTaskSystem: false, log: vi.fn(), warn: vi.fn() });

      const extension = {
        structureType: STRUCTURE_EXTENSION,
        store: {
          getFreeCapacity: vi.fn(() => 0),
          getUsedCapacity: vi.fn(() => 50)
        }
      } as unknown as AnyStoreStructure;

      const container = {
        structureType: STRUCTURE_CONTAINER,
        store: {
          getFreeCapacity: vi.fn(() => 0),
          getUsedCapacity: vi.fn(() => 200)
        }
      } as unknown as AnyStoreStructure;

      const upgraderRoom: RoomLike = {
        name: "W0N0",
        controller: {
          id: "controller",
          progress: 0,
          progressTotal: 0
        } as unknown as StructureController,
        find: (type: FindConstant, opts?: { filter?: (object: unknown) => boolean }) => {
          if (type === FIND_STRUCTURES) {
            const structures = [extension, container];
            if (opts && opts.filter) {
              return structures.filter(opts.filter);
            }
            return structures;
          }
          if (type === FIND_SOURCES_ACTIVE) {
            return [];
          }
          if (type === FIND_DROPPED_RESOURCES) {
            return [];
          }
          return [];
        }
      };

      const withdraw = vi.fn(() => OK);
      const upgrader: CreepLike = {
        name: "upgrader-beta",
        memory: { role: "upgrader", task: "recharge", version: 1 },
        store: {
          getFreeCapacity: vi.fn(() => 50),
          getUsedCapacity: vi.fn(() => 0)
        },
        pos: {
          findClosestByPath: vi.fn((objects: unknown[]) => (objects.length > 0 ? (objects[0] as never) : null))
        },
        room: upgraderRoom,
        harvest: vi.fn(() => OK),
        transfer: vi.fn(() => OK),
        moveTo: vi.fn(() => OK),
        upgradeController: vi.fn(() => OK),
        withdraw,
        pickup: vi.fn(() => OK),
        build: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      };

      const game: GameContext = {
        time: 1,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: { upgrader },
        spawns: {},
        rooms: { W0N0: upgraderRoom }
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2 };

      controller.execute(game, memory, roleCounts);

      // Verify that withdraw was called with the container, not the extension
      expect(withdraw).toHaveBeenCalledTimes(1);
      expect(withdraw).toHaveBeenCalledWith(container, RESOURCE_ENERGY);
    });

    it("prevents builders from withdrawing energy from spawns", () => {
      const controller = new BehaviorController({ useTaskSystem: false, log: vi.fn(), warn: vi.fn() });

      const spawn = {
        structureType: STRUCTURE_SPAWN,
        store: {
          getFreeCapacity: vi.fn(() => 0),
          getUsedCapacity: vi.fn(() => 300)
        }
      } as unknown as AnyStoreStructure;

      const storage = {
        structureType: STRUCTURE_STORAGE,
        store: {
          getFreeCapacity: vi.fn(() => 0),
          getUsedCapacity: vi.fn(() => 500)
        }
      } as unknown as AnyStoreStructure;

      const builderRoom: RoomLike = {
        name: "W0N0",
        controller: null,
        find: (type: FindConstant, opts?: { filter?: (object: unknown) => boolean }) => {
          if (type === FIND_STRUCTURES) {
            const structures = [spawn, storage];
            if (opts && opts.filter) {
              return structures.filter(opts.filter);
            }
            return structures;
          }
          if (type === FIND_CONSTRUCTION_SITES) {
            return [];
          }
          if (type === FIND_SOURCES_ACTIVE) {
            return [];
          }
          if (type === FIND_DROPPED_RESOURCES) {
            return [];
          }
          return [];
        }
      };

      const withdraw = vi.fn(() => OK);
      const builder: CreepLike = {
        name: "builder-gamma",
        memory: { role: "builder", task: "gather", version: 1 },
        store: {
          getFreeCapacity: vi.fn(() => 50),
          getUsedCapacity: vi.fn(() => 0)
        },
        pos: {
          findClosestByPath: vi.fn((objects: unknown[]) => (objects.length > 0 ? (objects[0] as never) : null))
        },
        room: builderRoom,
        harvest: vi.fn(() => OK),
        transfer: vi.fn(() => OK),
        moveTo: vi.fn(() => OK),
        upgradeController: vi.fn(() => OK),
        withdraw,
        pickup: vi.fn(() => OK),
        build: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      };

      const game: GameContext = {
        time: 1,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: { builder },
        spawns: {},
        rooms: { W0N0: builderRoom }
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2 };

      controller.execute(game, memory, roleCounts);

      // Verify that withdraw was called with the storage, not the spawn
      expect(withdraw).toHaveBeenCalledTimes(1);
      expect(withdraw).toHaveBeenCalledWith(storage, RESOURCE_ENERGY);
    });

    it("prevents builders from withdrawing energy from extensions", () => {
      const controller = new BehaviorController({ useTaskSystem: false, log: vi.fn(), warn: vi.fn() });

      const extension = {
        structureType: STRUCTURE_EXTENSION,
        store: {
          getFreeCapacity: vi.fn(() => 0),
          getUsedCapacity: vi.fn(() => 50)
        }
      } as unknown as AnyStoreStructure;

      const container = {
        structureType: STRUCTURE_CONTAINER,
        store: {
          getFreeCapacity: vi.fn(() => 0),
          getUsedCapacity: vi.fn(() => 200)
        }
      } as unknown as AnyStoreStructure;

      const builderRoom: RoomLike = {
        name: "W0N0",
        controller: null,
        find: (type: FindConstant, opts?: { filter?: (object: unknown) => boolean }) => {
          if (type === FIND_STRUCTURES) {
            const structures = [extension, container];
            if (opts && opts.filter) {
              return structures.filter(opts.filter);
            }
            return structures;
          }
          if (type === FIND_CONSTRUCTION_SITES) {
            return [];
          }
          if (type === FIND_SOURCES_ACTIVE) {
            return [];
          }
          if (type === FIND_DROPPED_RESOURCES) {
            return [];
          }
          return [];
        }
      };

      const withdraw = vi.fn(() => OK);
      const builder: CreepLike = {
        name: "builder-delta",
        memory: { role: "builder", task: "gather", version: 1 },
        store: {
          getFreeCapacity: vi.fn(() => 50),
          getUsedCapacity: vi.fn(() => 0)
        },
        pos: {
          findClosestByPath: vi.fn((objects: unknown[]) => (objects.length > 0 ? (objects[0] as never) : null))
        },
        room: builderRoom,
        harvest: vi.fn(() => OK),
        transfer: vi.fn(() => OK),
        moveTo: vi.fn(() => OK),
        upgradeController: vi.fn(() => OK),
        withdraw,
        pickup: vi.fn(() => OK),
        build: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      };

      const game: GameContext = {
        time: 1,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: { builder },
        spawns: {},
        rooms: { W0N0: builderRoom }
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2 };

      controller.execute(game, memory, roleCounts);

      // Verify that withdraw was called with the container, not the extension
      expect(withdraw).toHaveBeenCalledTimes(1);
      expect(withdraw).toHaveBeenCalledWith(container, RESOURCE_ENERGY);
    });

    it("allows upgraders to withdraw from storage when available", () => {
      const controller = new BehaviorController({ useTaskSystem: false, log: vi.fn(), warn: vi.fn() });

      const storage = {
        structureType: STRUCTURE_STORAGE,
        store: {
          getFreeCapacity: vi.fn(() => 0),
          getUsedCapacity: vi.fn(() => 1000)
        }
      } as unknown as AnyStoreStructure;

      const upgraderRoom: RoomLike = {
        name: "W0N0",
        controller: {
          id: "controller",
          progress: 0,
          progressTotal: 0
        } as unknown as StructureController,
        find: (type: FindConstant, opts?: { filter?: (object: unknown) => boolean }) => {
          if (type === FIND_STRUCTURES) {
            const structures = [storage];
            if (opts && opts.filter) {
              return structures.filter(opts.filter);
            }
            return structures;
          }
          if (type === FIND_SOURCES_ACTIVE) {
            return [];
          }
          if (type === FIND_DROPPED_RESOURCES) {
            return [];
          }
          return [];
        }
      };

      const withdraw = vi.fn(() => OK);
      const upgrader: CreepLike = {
        name: "upgrader-epsilon",
        memory: { role: "upgrader", task: "recharge", version: 1 },
        store: {
          getFreeCapacity: vi.fn(() => 50),
          getUsedCapacity: vi.fn(() => 0)
        },
        pos: {
          findClosestByPath: vi.fn((objects: unknown[]) => (objects.length > 0 ? (objects[0] as never) : null))
        },
        room: upgraderRoom,
        harvest: vi.fn(() => OK),
        transfer: vi.fn(() => OK),
        moveTo: vi.fn(() => OK),
        upgradeController: vi.fn(() => OK),
        withdraw,
        pickup: vi.fn(() => OK),
        build: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      };

      const game: GameContext = {
        time: 1,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: { upgrader },
        spawns: {},
        rooms: { W0N0: upgraderRoom }
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2 };

      controller.execute(game, memory, roleCounts);

      // Verify that withdraw was called with storage
      expect(withdraw).toHaveBeenCalledTimes(1);
      expect(withdraw).toHaveBeenCalledWith(storage, RESOURCE_ENERGY);
    });

    it("allows upgraders to pickup dropped energy when no storage or containers available", () => {
      const controller = new BehaviorController({ useTaskSystem: false, log: vi.fn(), warn: vi.fn() });

      const droppedEnergy = {
        resourceType: RESOURCE_ENERGY,
        amount: 100
      } as Resource;

      const upgraderRoom: RoomLike = {
        name: "W0N0",
        controller: {
          id: "controller",
          progress: 0,
          progressTotal: 0
        } as unknown as StructureController,
        find: (type: FindConstant, opts?: { filter?: (object: unknown) => boolean }) => {
          if (type === FIND_STRUCTURES) {
            return [];
          }
          if (type === FIND_DROPPED_RESOURCES) {
            const resources = [droppedEnergy];
            if (opts && opts.filter) {
              return resources.filter(opts.filter);
            }
            return resources;
          }
          if (type === FIND_SOURCES_ACTIVE) {
            return [];
          }
          return [];
        }
      };

      const pickup = vi.fn(() => OK);
      const upgrader: CreepLike = {
        name: "upgrader-zeta",
        memory: { role: "upgrader", task: "recharge", version: 1 },
        store: {
          getFreeCapacity: vi.fn(() => 50),
          getUsedCapacity: vi.fn(() => 0)
        },
        pos: {
          findClosestByPath: vi.fn((objects: unknown[]) => (objects.length > 0 ? (objects[0] as never) : null))
        },
        room: upgraderRoom,
        harvest: vi.fn(() => OK),
        transfer: vi.fn(() => OK),
        moveTo: vi.fn(() => OK),
        upgradeController: vi.fn(() => OK),
        withdraw: vi.fn(() => OK),
        pickup,
        build: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      };

      const game: GameContext = {
        time: 1,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: { upgrader },
        spawns: {},
        rooms: { W0N0: upgraderRoom }
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2 };

      controller.execute(game, memory, roleCounts);

      // Verify that pickup was called with dropped energy
      expect(pickup).toHaveBeenCalledTimes(1);
      expect(pickup).toHaveBeenCalledWith(droppedEnergy);
    });

    it("allows upgraders to harvest directly from sources when no other energy available", () => {
      const controller = new BehaviorController({ useTaskSystem: false, log: vi.fn(), warn: vi.fn() });

      const source = { id: "source-1" } as Source;

      const upgraderRoom: RoomLike = {
        name: "W0N0",
        controller: {
          id: "controller",
          progress: 0,
          progressTotal: 0
        } as unknown as StructureController,
        find: (type: FindConstant, opts?: { filter?: (object: unknown) => boolean }) => {
          if (type === FIND_STRUCTURES) {
            return [];
          }
          if (type === FIND_DROPPED_RESOURCES) {
            return [];
          }
          if (type === FIND_SOURCES_ACTIVE) {
            const sources = [source];
            if (opts && opts.filter) {
              return sources.filter(opts.filter);
            }
            return sources;
          }
          return [];
        }
      };

      const harvest = vi.fn(() => OK);
      const upgrader: CreepLike = {
        name: "upgrader-eta",
        memory: { role: "upgrader", task: "recharge", version: 1 },
        store: {
          getFreeCapacity: vi.fn(() => 50),
          getUsedCapacity: vi.fn(() => 0)
        },
        pos: {
          findClosestByPath: vi.fn((objects: unknown[]) => (objects.length > 0 ? (objects[0] as never) : null))
        },
        room: upgraderRoom,
        harvest,
        transfer: vi.fn(() => OK),
        moveTo: vi.fn(() => OK),
        upgradeController: vi.fn(() => OK),
        withdraw: vi.fn(() => OK),
        pickup: vi.fn(() => OK),
        build: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      };

      const game: GameContext = {
        time: 1,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: { upgrader },
        spawns: {},
        rooms: { W0N0: upgraderRoom }
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2 };

      controller.execute(game, memory, roleCounts);

      // Verify that harvest was called with the source
      expect(harvest).toHaveBeenCalledTimes(1);
      expect(harvest).toHaveBeenCalledWith(source);
    });
  });

  describe("harvester container filling", () => {
    it("should deliver energy to containers when spawn and extensions are full", () => {
      const controller = new BehaviorController({ useTaskSystem: false, log: vi.fn(), warn: vi.fn() });

      const spawn = {
        structureType: STRUCTURE_SPAWN,
        store: {
          getFreeCapacity: vi.fn(() => 0),
          getUsedCapacity: vi.fn(() => 300)
        }
      } as unknown as AnyStoreStructure;

      const container = {
        structureType: STRUCTURE_CONTAINER,
        store: {
          getFreeCapacity: vi.fn(() => 1500),
          getUsedCapacity: vi.fn(() => 500)
        }
      } as unknown as AnyStoreStructure;

      const harvesterRoom: RoomLike = {
        name: "W0N0",
        controller: {
          id: "controller",
          progress: 0,
          progressTotal: 0
        } as unknown as StructureController,
        find: (type: FindConstant, opts?: { filter?: (object: unknown) => boolean }) => {
          if (type === FIND_STRUCTURES) {
            const structures = [spawn, container];
            if (opts && opts.filter) {
              return structures.filter(opts.filter);
            }
            return structures;
          }
          if (type === FIND_SOURCES_ACTIVE) {
            return [];
          }
          return [];
        }
      };

      const transfer = vi.fn(() => OK);
      const harvester: CreepLike = {
        name: "harvester-theta",
        memory: { role: "harvester", task: "deliver", version: 1 },
        store: {
          getFreeCapacity: vi.fn(() => 0),
          getUsedCapacity: vi.fn(() => 50)
        },
        pos: {
          findClosestByPath: vi.fn((objects: unknown[]) => (objects.length > 0 ? (objects[0] as never) : null))
        },
        room: harvesterRoom,
        harvest: vi.fn(() => OK),
        transfer,
        moveTo: vi.fn(() => OK),
        upgradeController: vi.fn(() => OK),
        withdraw: vi.fn(() => OK),
        pickup: vi.fn(() => OK),
        build: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      };

      const game: GameContext = {
        time: 1,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: { harvester },
        spawns: {},
        rooms: { W0N0: harvesterRoom }
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2 };

      controller.execute(game, memory, roleCounts);

      // Verify that transfer was called with the container (not spawn, which is full)
      expect(transfer).toHaveBeenCalledTimes(1);
      expect(transfer).toHaveBeenCalledWith(container, RESOURCE_ENERGY);
    });

    it("should prioritize spawn and extensions over containers", () => {
      const controller = new BehaviorController({ useTaskSystem: false, log: vi.fn(), warn: vi.fn() });

      const spawn = {
        structureType: STRUCTURE_SPAWN,
        store: {
          getFreeCapacity: vi.fn(() => 100),
          getUsedCapacity: vi.fn(() => 200)
        }
      } as unknown as AnyStoreStructure;

      const container = {
        structureType: STRUCTURE_CONTAINER,
        store: {
          getFreeCapacity: vi.fn(() => 1500),
          getUsedCapacity: vi.fn(() => 500)
        }
      } as unknown as AnyStoreStructure;

      const harvesterRoom: RoomLike = {
        name: "W0N0",
        controller: {
          id: "controller",
          progress: 0,
          progressTotal: 0
        } as unknown as StructureController,
        find: (type: FindConstant, opts?: { filter?: (object: unknown) => boolean }) => {
          if (type === FIND_STRUCTURES) {
            const structures = [container, spawn]; // Container first to test priority
            if (opts && opts.filter) {
              return structures.filter(opts.filter);
            }
            return structures;
          }
          if (type === FIND_SOURCES_ACTIVE) {
            return [];
          }
          return [];
        }
      };

      const transfer = vi.fn(() => OK);
      const harvester: CreepLike = {
        name: "harvester-iota",
        memory: { role: "harvester", task: "deliver", version: 1 },
        store: {
          getFreeCapacity: vi.fn(() => 0),
          getUsedCapacity: vi.fn(() => 50)
        },
        pos: {
          findClosestByPath: vi.fn((objects: unknown[]) => (objects.length > 0 ? (objects[0] as never) : null))
        },
        room: harvesterRoom,
        harvest: vi.fn(() => OK),
        transfer,
        moveTo: vi.fn(() => OK),
        upgradeController: vi.fn(() => OK),
        withdraw: vi.fn(() => OK),
        pickup: vi.fn(() => OK),
        build: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      };

      const game: GameContext = {
        time: 1,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: { harvester },
        spawns: {},
        rooms: { W0N0: harvesterRoom }
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2 };

      controller.execute(game, memory, roleCounts);

      // Verify that transfer was called with the spawn (has capacity), not container
      expect(transfer).toHaveBeenCalledTimes(1);
      expect(transfer).toHaveBeenCalledWith(spawn, RESOURCE_ENERGY);
    });
  });

  describe("bootstrap phase integration", () => {
    it("should spawn more harvesters during bootstrap phase", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });
      const game = createGameContext({ time: 100, hasSpawns: true });
      const memory = {} as Memory;
      const roleCounts = {};

      // Execute with bootstrap phase active
      const result = controller.execute(game, memory, roleCounts, true);

      // Should spawn harvesters prioritized (6 harvesters, 1 upgrader, 0 builders)
      const harvesterSpawns = result.spawnedCreeps.filter(name => name.startsWith("harvester-"));
      const upgraderSpawns = result.spawnedCreeps.filter(name => name.startsWith("upgrader-"));
      const builderSpawns = result.spawnedCreeps.filter(name => name.startsWith("builder-"));

      expect(harvesterSpawns.length).toBeGreaterThan(0);
      expect(upgraderSpawns.length).toBeLessThanOrEqual(1);
      expect(builderSpawns.length).toBe(0);
    });

    it("should spawn normal role distribution when bootstrap is not active", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });
      const game = createGameContext({ time: 100, hasSpawns: true });
      const memory = {} as Memory;
      const roleCounts = {};

      // Execute without bootstrap phase (normal operation)
      const result = controller.execute(game, memory, roleCounts, false);

      // Should spawn at least one creep with normal minimums (default is 4 harvesters)
      // Note: Mock spawn can only spawn one creep per tick
      expect(result.spawnedCreeps.length).toBeGreaterThan(0);

      // First spawned should be harvester (highest priority, below minimum)
      const firstSpawn = result.spawnedCreeps[0];
      expect(firstSpawn).toContain("harvester-");
    });

    it("should respect bootstrap minimums when partially staffed", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });
      const game = createGameContext({ time: 100, hasSpawns: true });
      const memory = {} as Memory;
      const roleCounts = { harvester: 3, upgrader: 0, builder: 0 };

      // Execute with bootstrap phase active and some harvesters already present
      const result = controller.execute(game, memory, roleCounts, true);

      // Should spawn to reach bootstrap minimums (6 harvesters total)
      const harvesterSpawns = result.spawnedCreeps.filter(name => name.startsWith("harvester-"));
      expect(harvesterSpawns.length).toBeGreaterThanOrEqual(1);
      expect(harvesterSpawns.length).toBeLessThanOrEqual(3); // Fill gap to 6
    });

    it("should not spawn additional creeps when bootstrap minimums are met", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });
      const game = createGameContext({ time: 100, hasSpawns: true });
      const memory = {} as Memory;
      const roleCounts = { harvester: 6, upgrader: 1, builder: 0 };

      // Execute with bootstrap phase active but minimums already met
      const result = controller.execute(game, memory, roleCounts, true);

      // Should not spawn any new creeps
      expect(result.spawnedCreeps.length).toBe(0);
    });

    it("should default to normal operation when bootstrap flag is undefined", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });
      const game = createGameContext({ time: 100, hasSpawns: true });
      const memory = {} as Memory;
      const roleCounts = {};

      // Execute without specifying bootstrap flag (should default to false)
      const result = controller.execute(game, memory, roleCounts);

      // Should spawn at least one creep with normal minimums
      expect(result.spawnedCreeps.length).toBeGreaterThan(0);

      // First spawned should be harvester (highest priority, below minimum)
      const firstSpawn = result.spawnedCreeps[0];
      expect(firstSpawn).toContain("harvester-");
    });
  });
});
