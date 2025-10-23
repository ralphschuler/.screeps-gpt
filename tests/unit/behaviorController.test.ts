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
      const roleCounts = { harvester: 2, upgrader: 1, builder: 1 };
      controller.execute(game2, memory, roleCounts);

      // Counter should remain unchanged when no spawning occurs
      expect(memory.creepCounter).toBe(counterAfterTick1);

      // Third tick - needs more harvesters
      const game3 = createGameContext({ time: 102, hasSpawns: true });
      controller.execute(game3, memory, { harvester: 1, upgrader: 1, builder: 1 });

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
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

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
      const roleCounts = { harvester: 2, upgrader: 1, builder: 1 };

      const result = controller.execute(game, memory, roleCounts);

      expect(withdraw).toHaveBeenCalledTimes(1);
      expect(result.tasksExecuted.gather).toBe(1);
    });

    it("repairs structures when builder has no construction work", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

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
      const roleCounts = { harvester: 2, upgrader: 1, builder: 1 };

      const result = controller.execute(game, memory, roleCounts);

      expect(repair).toHaveBeenCalledTimes(1);
      expect(result.tasksExecuted.maintain).toBe(1);
    });

    it("cycles remote miner through travel, mine, and return tasks", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

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
      const roleCounts = { harvester: 2, upgrader: 1, builder: 1, remoteMiner: 1 };

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
});
