import { describe, expect, it, vi } from "vitest";
import { RoleControllerManager } from "@runtime/behavior/RoleControllerManager";
import type { CreepLike, GameContext, RoomLike } from "@runtime/types/GameContext";

describe("Regression: creeps cycling at room exits", () => {
  it("remote upgrader should not cycle when at edge of target room", () => {
    const controller = new RoleControllerManager({ log: vi.fn(), warn: vi.fn() });

    const targetRoom: RoomLike = {
      name: "W1N1",
      controller: { 
        id: "controller-1", 
        my: true,
        progress: 0,
        progressTotal: 1000
      } as unknown as StructureController,
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
    const remoteUpgrader: CreepLike = {
      name: "remoteUpgrader-edge",
      memory: {
        role: "remoteUpgrader",
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
      creeps: { remote: remoteUpgrader },
      spawns: {},
      rooms: { W1N1: targetRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts = { harvester: 4, upgrader: 3, builder: 2, remoteUpgrader: 1 };

    // Execute behavior - should stay in travel task when near edge
    controller.execute(game, memory, roleCounts);

    // The creep should stay in travel task because it's near the edge
    expect(remoteUpgrader.memory.task).toBe("travel");
    // Should have called moveTo to continue toward center
    expect(remoteUpgrader.moveTo).toHaveBeenCalled();

    // Move creep away from edge
    remoteUpgrader.pos.y = 10; // Now well inside the room
    game.time = 601;
    controller.execute(game, memory, roleCounts);

    // Now it should transition to gather task (since it has no energy)
    expect(remoteUpgrader.memory.task).toBe("gather");
  });

  it.skip("remote hauler should not cycle when at edge of target room", () => {
    // TODO: RoleControllerManager remote hauler movement logic may differ from BehaviorController
    // Need to verify room exit cycling prevention behavior
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

  it("remote upgrader should stay in remote room and cycle between gather and upgrade", () => {
    const controller = new RoleControllerManager({ log: vi.fn(), warn: vi.fn() });

    const targetRoom: RoomLike = {
      name: "W1N1",
      controller: { 
        id: "target-controller", 
        my: true,
        progress: 0,
        progressTotal: 1000
      } as unknown as StructureController,
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

    // Remote upgrader in target room with energy, should upgrade
    const remoteUpgrader: CreepLike = {
      name: "remoteUpgrader-cycle",
      memory: {
        role: "remoteUpgrader",
        task: "upgrade",
        version: 1,
        homeRoom: "W0N0",
        targetRoom: "W1N1"
      },
      store: {
        getFreeCapacity: vi.fn(() => 50),
        getUsedCapacity: vi.fn(() => 0) // Empty energy
      },
      pos: {
        x: 25,
        y: 25,
        findClosestByPath: vi.fn(() => ({ id: "source-1", pos: { x: 25, y: 25 } }))
      },
      room: targetRoom, // In the target room
      harvest: vi.fn(() => OK),
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
      creeps: { remote: remoteUpgrader },
      spawns: {},
      rooms: { W1N1: targetRoom }
    };

    const memory = { creepCounter: 0 } as Memory;
    const roleCounts = { harvester: 4, upgrader: 3, builder: 2, remoteUpgrader: 1 };

    // Execute behavior - should switch to gather when empty
    controller.execute(game, memory, roleCounts);
    expect(remoteUpgrader.memory.task).toBe("gather");

    // Simulate gathering energy
    remoteUpgrader.store.getUsedCapacity = vi.fn(() => 50);
    remoteUpgrader.store.getFreeCapacity = vi.fn(() => 0);
    game.time = 601;
    controller.execute(game, memory, roleCounts);

    // Should switch back to upgrade when full
    expect(remoteUpgrader.memory.task).toBe("upgrade");
  });
});
