import { describe, expect, it, vi } from "vitest";
import { RoleControllerManager } from "@runtime/behavior/RoleControllerManager";
import type { CreepLike, GameContext, RoomLike } from "@runtime/types/GameContext";

describe("Scout Behavior", () => {
  it("should initialize home room and target rooms on first run", () => {
    const controller = new RoleControllerManager({}, { log: vi.fn(), warn: vi.fn() });

    const homeRoom: RoomLike = {
      name: "W5N5",
      controller: { my: true, level: 2 },
      find: () => []
    };

    const scout: CreepLike = {
      name: "scout-test",
      memory: {
        role: "scout",
        task: "scout",
        version: 1,
        homeRoom: "",
        targetRooms: [],
        currentTargetIndex: 0
      },
      store: {
        getFreeCapacity: vi.fn(() => 0),
        getUsedCapacity: vi.fn(() => 0)
      },
      pos: {
        findClosestByPath: vi.fn(() => null),
        getRangeTo: vi.fn(() => 10)
      },
      room: homeRoom,
      harvest: vi.fn(() => OK),
      transfer: vi.fn(() => OK),
      moveTo: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK),
      pickup: vi.fn(() => OK)
    };

    const game: GameContext = {
      time: 1000,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: { scout: scout },
      spawns: {},
      rooms: { W5N5: homeRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts = { harvester: 4, upgrader: 3, builder: 2, scout: 1 };

    controller.execute(game, memory, roleCounts);

    // After first execution, scout should have initialized home room
    expect(scout.memory.homeRoom).toBe("W5N5");
    // Scout should have generated target rooms list (8 adjacent rooms)
    expect(scout.memory.targetRooms).toBeDefined();
    expect((scout.memory.targetRooms as string[]).length).toBe(8);
  });

  it("should move to target room when not there", () => {
    const controller = new RoleControllerManager({}, { log: vi.fn(), warn: vi.fn() });

    const homeRoom: RoomLike = {
      name: "W5N5",
      controller: { my: true, level: 2 },
      find: () => []
    };

    const scout: CreepLike = {
      name: "scout-test",
      memory: {
        role: "scout",
        task: "scout",
        version: 1,
        homeRoom: "W5N5",
        targetRooms: ["W4N5", "W6N5", "W5N4", "W5N6", "W4N4", "W6N6", "W4N6", "W6N4"],
        currentTargetIndex: 0
      },
      store: {
        getFreeCapacity: vi.fn(() => 0),
        getUsedCapacity: vi.fn(() => 0)
      },
      pos: {
        findClosestByPath: vi.fn(() => null),
        getRangeTo: vi.fn(() => 10)
      },
      room: homeRoom,
      harvest: vi.fn(() => OK),
      transfer: vi.fn(() => OK),
      moveTo: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK),
      pickup: vi.fn(() => OK)
    };

    const game: GameContext = {
      time: 1000,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: { scout: scout },
      spawns: {},
      rooms: { W5N5: homeRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts = { harvester: 4, upgrader: 3, builder: 2, scout: 1 };

    controller.execute(game, memory, roleCounts);

    // Scout should call moveTo to travel to target room
    expect(scout.moveTo).toHaveBeenCalled();
  });

  it("should move to room center when in target room", () => {
    const controller = new RoleControllerManager({}, { log: vi.fn(), warn: vi.fn() });

    const targetRoom: RoomLike = {
      name: "W4N5",
      controller: null,
      find: () => []
    };

    const scout: CreepLike = {
      name: "scout-test",
      memory: {
        role: "scout",
        task: "scout",
        version: 1,
        homeRoom: "W5N5",
        targetRooms: ["W4N5", "W6N5", "W5N4", "W5N6", "W4N4", "W6N6", "W4N6", "W6N4"],
        currentTargetIndex: 0
      },
      store: {
        getFreeCapacity: vi.fn(() => 0),
        getUsedCapacity: vi.fn(() => 0)
      },
      pos: {
        findClosestByPath: vi.fn(() => null),
        getRangeTo: vi.fn(() => 10)
      },
      room: targetRoom,
      harvest: vi.fn(() => OK),
      transfer: vi.fn(() => OK),
      moveTo: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK),
      pickup: vi.fn(() => OK)
    };

    const game: GameContext = {
      time: 1000,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: { scout: scout },
      spawns: {},
      rooms: { W4N5: targetRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts = { harvester: 4, upgrader: 3, builder: 2, scout: 1 };

    controller.execute(game, memory, roleCounts);

    // Scout should move to center of room when far from it
    expect(scout.moveTo).toHaveBeenCalled();
  });

  it("should cycle to next target room after brief stay at center", () => {
    const controller = new RoleControllerManager({}, { log: vi.fn(), warn: vi.fn() });

    const targetRoom: RoomLike = {
      name: "W4N5",
      controller: null,
      find: () => []
    };

    const scout: CreepLike = {
      name: "scout-test",
      memory: {
        role: "scout",
        task: "scout",
        version: 1,
        homeRoom: "W5N5",
        targetRooms: ["W4N5", "W6N5", "W5N4", "W5N6", "W4N4", "W6N6", "W4N6", "W6N4"],
        currentTargetIndex: 0,
        lastRoomSwitchTick: 1000
      },
      store: {
        getFreeCapacity: vi.fn(() => 0),
        getUsedCapacity: vi.fn(() => 0)
      },
      pos: {
        findClosestByPath: vi.fn(() => null),
        getRangeTo: vi.fn(() => 2) // Close to center
      },
      room: targetRoom,
      harvest: vi.fn(() => OK),
      transfer: vi.fn(() => OK),
      moveTo: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK),
      pickup: vi.fn(() => OK)
    };

    const game: GameContext = {
      time: 1005, // 5 ticks have passed since lastRoomSwitchTick (1000)
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: { scout: scout },
      spawns: {},
      rooms: { W4N5: targetRoom }
    };

    // Set global Game.time for the runScout function
    Game.time = 1005;

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts = { harvester: 4, upgrader: 3, builder: 2, scout: 1 };

    controller.execute(game, memory, roleCounts);

    // Scout should increment target index when near center and enough ticks have passed
    expect(scout.memory.currentTargetIndex).toBe(1);
  });

  it("should spawn scout at RCL 2+", () => {
    const controller = new RoleControllerManager({}, { log: vi.fn(), warn: vi.fn() });

    const homeRoom: RoomLike = {
      name: "W5N5",
      controller: { my: true, level: 2 },
      find: () => [],
      energyAvailable: 300,
      energyCapacityAvailable: 300
    };

    const spawn = {
      name: "Spawn1",
      spawning: null,
      spawnCreep: vi.fn(() => OK),
      room: homeRoom
    };

    const harvester: CreepLike = {
      name: "harvester1",
      memory: {
        role: "harvester",
        task: "harvest",
        version: 1
      },
      store: {
        getFreeCapacity: vi.fn(() => 50),
        getUsedCapacity: vi.fn(() => 0)
      },
      pos: { findClosestByPath: vi.fn(() => null) },
      room: homeRoom,
      harvest: vi.fn(() => OK),
      transfer: vi.fn(() => OK),
      moveTo: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK),
      pickup: vi.fn(() => OK)
    };

    const game: GameContext = {
      time: 1000,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: { harvester1: harvester },
      spawns: { Spawn1: spawn },
      rooms: { W5N5: homeRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts = { harvester: 4, upgrader: 3, builder: 2, scout: 0 };

    const summary = controller.execute(game, memory, roleCounts);

    // Scout should be spawned at RCL 2
    expect(summary.spawnedCreeps.length).toBeGreaterThan(0);
    expect(summary.spawnedCreeps.some((name: string) => name.includes("scout"))).toBe(true);
  });
});
