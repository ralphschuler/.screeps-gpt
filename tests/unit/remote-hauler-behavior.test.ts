import { describe, expect, it, vi } from "vitest";
import { RoleControllerManager } from "@runtime/behavior/RoleControllerManager";
import type { CreepLike, GameContext, RoomLike } from "@runtime/types/GameContext";

describe("RemoteHauler Behavior", () => {
  it("should transition from travel to pickup when reaching target room", () => {
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

    const remoteHauler: CreepLike = {
      name: "remoteHauler-test",
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
      pos: { findClosestByPath: vi.fn(() => null) },
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
      time: 600,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: { hauler: remoteHauler },
      spawns: {},
      rooms: { W1N1: targetRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts = { harvester: 4, upgrader: 3, builder: 2, remoteHauler: 1 };

    const summary = controller.execute(game, memory, roleCounts);

    expect(summary.tasksExecuted.remotePickup).toBe(1);
    expect(remoteHauler.memory.task).toBe("remotePickup");
  });

  it("should transition from pickup to return when full", () => {
    const controller = new RoleControllerManager({}, { log: vi.fn(), warn: vi.fn() });

    const targetRoom: RoomLike = {
      name: "W1N1",
      controller: null,
      find: () => []
    };

    const remoteHauler: CreepLike = {
      name: "remoteHauler-test",
      memory: {
        role: "remoteHauler",
        task: "remotePickup",
        version: 1,
        homeRoom: "W0N0",
        targetRoom: "W1N1"
      },
      store: {
        getFreeCapacity: vi.fn(() => 0), // Full
        getUsedCapacity: vi.fn(() => 400)
      },
      pos: { findClosestByPath: vi.fn(() => null) },
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
      time: 700,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: { hauler: remoteHauler },
      spawns: {},
      rooms: { W1N1: targetRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts = { harvester: 4, upgrader: 3, builder: 2, remoteHauler: 1 };

    const summary = controller.execute(game, memory, roleCounts);

    expect(summary.tasksExecuted.remoteReturn).toBe(1);
    expect(remoteHauler.memory.task).toBe("remoteReturn");
  });

  it("should deliver energy to storage when returning home", () => {
    const controller = new RoleControllerManager({}, { log: vi.fn(), warn: vi.fn() });

    const homeRoom: RoomLike = {
      name: "W0N0",
      controller: { id: "controller-id", progress: 0, progressTotal: 0 } as unknown as StructureController,
      find: (type: FindConstant) => {
        if (type === FIND_STRUCTURES) {
          return [
            {
              structureType: STRUCTURE_STORAGE,
              store: {
                getFreeCapacity: vi.fn(() => 10000)
              }
            }
          ];
        }
        return [];
      }
    };

    const remoteHauler: CreepLike = {
      name: "remoteHauler-test",
      memory: {
        role: "remoteHauler",
        task: "remoteReturn",
        version: 1,
        homeRoom: "W0N0",
        targetRoom: "W1N1"
      },
      store: {
        getFreeCapacity: vi.fn(() => 0),
        getUsedCapacity: vi.fn(() => 400)
      },
      pos: { findClosestByPath: vi.fn(() => ({ structureType: STRUCTURE_STORAGE })) },
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
      time: 800,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: { hauler: remoteHauler },
      spawns: {},
      rooms: { W0N0: homeRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts = { harvester: 4, upgrader: 3, builder: 2, remoteHauler: 1 };

    controller.execute(game, memory, roleCounts);

    expect(remoteHauler.transfer).toHaveBeenCalledWith(expect.anything(), RESOURCE_ENERGY);
  });
});
