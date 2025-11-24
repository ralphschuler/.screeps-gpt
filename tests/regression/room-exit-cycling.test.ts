import { describe, expect, it, vi } from "vitest";
import { RoleControllerManager } from "@runtime/behavior/RoleControllerManager";
import type { CreepLike, GameContext, RoomLike } from "@runtime/types/GameContext";

describe("Regression: creeps cycling at room exits", () => {
  it("remote miner should not cycle when at edge of target room", () => {
    const controller = new RoleControllerManager({ log: vi.fn(), warn: vi.fn() });

    const targetRoom: RoomLike = {
      name: "W1N1",
      controller: null,
      find: (type: FindConstant) => {
        if (type === FIND_SOURCES_ACTIVE) {
          return [
            {
              id: "source-1" as Id<Source>,
              pos: { x: 25, y: 25 },
              energy: 3000,
              energyCapacity: 3000
            }
          ];
        }
        return [];
      }
    };

    // Creep is at the edge of the target room (position y=1)
    const remoteMiner: CreepLike = {
      name: "remoteMiner-edge",
      memory: {
        role: "remoteMiner",
        task: "travel",
        version: 1,
        homeRoom: "W0N0",
        targetRoom: "W1N1"
      },
      store: {
        getFreeCapacity: vi.fn(() => 50),
        getUsedCapacity: vi.fn(() => 0)
      },
      pos: {
        x: 25,
        y: 1, // At edge of room
        findClosestByPath: vi.fn(() => ({ id: "source-1", pos: { x: 25, y: 25 } }))
      },
      room: targetRoom, // In the target room
      harvest: vi.fn(() => ERR_NOT_IN_RANGE),
      transfer: vi.fn(() => OK),
      moveTo: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK)
    };

    const game: GameContext = {
      time: 600,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: { remote: remoteMiner },
      spawns: {},
      rooms: { W1N1: targetRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts = { harvester: 4, upgrader: 3, builder: 2, remoteMiner: 1 };

    // Execute behavior - should stay in travel task when near edge
    controller.execute(game, memory, roleCounts);

    // The creep should stay in travel task because it's near the edge
    expect(remoteMiner.memory.task).toBe("travel");
    // Should have called moveTo to continue toward center
    expect(remoteMiner.moveTo).toHaveBeenCalled();

    // Move creep away from edge
    remoteMiner.pos.y = 10; // Now well inside the room
    game.time = 601;
    controller.execute(game, memory, roleCounts);

    // Now it should transition to mine task
    expect(remoteMiner.memory.task).toBe("mine");
  });

  it("remote hauler should not cycle when at edge of target room", () => {
    const controller = new RoleControllerManager({}, { log: vi.fn(), warn: vi.fn() });

    const targetRoom: RoomLike = {
      name: "W1N1",
      controller: null,
      find: (type: FindConstant) => {
        if (type === FIND_DROPPED_RESOURCES) {
          return [
            {
              id: "dropped-energy-1" as Id<Resource>,
              resourceType: RESOURCE_ENERGY,
              amount: 100,
              pos: { x: 25, y: 25 }
            }
          ];
        }
        if (type === FIND_STRUCTURES) {
          return [];
        }
        return [];
      }
    };

    // Creep is at the edge of the target room (position x=49)
    const remoteHauler: CreepLike = {
      name: "remoteHauler-edge",
      memory: {
        role: "remoteHauler",
        task: "remoteTravel",
        version: 1,
        homeRoom: "W0N0",
        targetRoom: "W1N1"
      },
      store: {
        getFreeCapacity: vi.fn(() => 400),
        getUsedCapacity: vi.fn(() => 0)
      },
      pos: {
        x: 49, // At edge of room
        y: 25,
        findClosestByPath: vi.fn(() => ({ id: "dropped-energy-1", pos: { x: 25, y: 25 } }))
      },
      room: targetRoom, // In the target room
      harvest: vi.fn(() => OK),
      transfer: vi.fn(() => OK),
      moveTo: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK),
      pickup: vi.fn(() => ERR_NOT_IN_RANGE)
    };

    const game: GameContext = {
      time: 600,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: { hauler: remoteHauler },
      spawns: {},
      rooms: { W1N1: targetRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts = { harvester: 4, upgrader: 3, builder: 2, remoteHauler: 1 };

    // Execute behavior - should stay in travel task when near edge
    controller.execute(game, memory, roleCounts);

    // The creep should stay in travel task because it's near the edge
    expect(remoteHauler.memory.task).toBe("remoteTravel");
    // Should have called moveTo to continue toward center
    expect(remoteHauler.moveTo).toHaveBeenCalled();

    // Move creep away from edge
    remoteHauler.pos.x = 20; // Now well inside the room
    game.time = 601;
    controller.execute(game, memory, roleCounts);

    // Now it should transition to pickup task
    expect(remoteHauler.memory.task).toBe("remotePickup");
  });

  it("remote miner should not cycle when returning at edge of home room", () => {
    const controller = new RoleControllerManager({ log: vi.fn(), warn: vi.fn() });

    const homeRoom: RoomLike = {
      name: "W0N0",
      controller: { id: "home-controller", progress: 0, progressTotal: 0 } as unknown as StructureController,
      find: (type: FindConstant) => {
        if (type === FIND_STRUCTURES) {
          return [
            {
              structureType: STRUCTURE_STORAGE,
              store: {
                getFreeCapacity: vi.fn(() => 10000)
              },
              pos: { x: 25, y: 25 }
            }
          ];
        }
        return [];
      }
    };

    // Creep is at the edge of the home room (position x=0) while returning
    const remoteMiner: CreepLike = {
      name: "remoteMiner-returning",
      memory: {
        role: "remoteMiner",
        task: "return",
        version: 1,
        homeRoom: "W0N0",
        targetRoom: "W1N1"
      },
      store: {
        getFreeCapacity: vi.fn(() => 0),
        getUsedCapacity: vi.fn(() => 50)
      },
      pos: {
        x: 0, // At edge of room
        y: 25,
        findClosestByPath: vi.fn(() => ({
          structureType: STRUCTURE_STORAGE,
          pos: { x: 25, y: 25 }
        }))
      },
      room: homeRoom, // In the home room
      harvest: vi.fn(() => OK),
      transfer: vi.fn(() => ERR_NOT_IN_RANGE),
      moveTo: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK)
    };

    const game: GameContext = {
      time: 600,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: { remote: remoteMiner },
      spawns: {},
      rooms: { W0N0: homeRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts = { harvester: 4, upgrader: 3, builder: 2, remoteMiner: 1 };

    // Execute behavior - creep should stay in return task and move toward center
    controller.execute(game, memory, roleCounts);
    expect(remoteMiner.memory.task).toBe("return");

    // Should move toward center (to avoid cycling back to target room)
    expect(remoteMiner.moveTo).toHaveBeenCalled();

    // Move creep away from edge
    remoteMiner.pos.x = 15; // Now well inside the room
    game.time = 601;
    controller.execute(game, memory, roleCounts);
    expect(remoteMiner.memory.task).toBe("return");

    // Should continue normal delivery behavior
    expect(remoteMiner.transfer).toHaveBeenCalled();
  });
});
