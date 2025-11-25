import { describe, expect, it, vi } from "vitest";
import { RoleControllerManager } from "@runtime/behavior/RoleControllerManager";
import type { CreepLike, GameContext, RoomLike } from "@runtime/types/GameContext";

describe("Regression: remote upgrader task loop", () => {
  it("switches between gather and upgrade tasks in remote room", () => {
    const controller = new RoleControllerManager({}, { log: vi.fn(), warn: vi.fn() });

    const targetRoom: RoomLike = {
      name: "W1N1",
      controller: { 
        id: "target-controller", 
        progress: 0, 
        progressTotal: 0,
        my: true 
      } as unknown as StructureController,
      find: (type: FindConstant) => {
        if (type === FIND_SOURCES_ACTIVE) {
          return [{
            id: "source-1" as Id<Source>,
            pos: { x: 25, y: 25 },
            energy: 3000,
            energyCapacity: 3000
          }];
        }
        if (type === FIND_STRUCTURES || type === FIND_CONSTRUCTION_SITES) {
          return [];
        }
        return [];
      }
    };

    const remoteUpgrader: CreepLike = {
      name: "remoteUpgrader-regression",
      memory: {
        role: "remoteUpgrader",
        task: "upgrade",
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
        y: 25,
        findClosestByPath: vi.fn(() => null) 
      },
      room: targetRoom,
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

    const summary = controller.execute(game, memory, roleCounts);

    // Creep starts with upgrade task but has no energy, so switches to gather
    expect(summary.tasksExecuted.gather).toBe(1);
    expect(remoteUpgrader.memory.task).toBe("gather");
  });
});
