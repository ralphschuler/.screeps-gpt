import { describe, expect, it, vi } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { CreepLike, GameContext, RoomLike } from "@runtime/types/GameContext";

describe("Regression: remote miner return loop", () => {
  it("resets to travel when energy is exhausted after returning home", () => {
    const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

    const homeRoom: RoomLike = {
      name: "W0N0",
      controller: { id: "home-controller", progress: 0, progressTotal: 0 } as unknown as StructureController,
      find: (type: FindConstant) => {
        if (type === FIND_STRUCTURES || type === FIND_SOURCES_ACTIVE || type === FIND_CONSTRUCTION_SITES) {
          return [];
        }
        return [];
      }
    };

    const remoteMiner: CreepLike = {
      name: "remoteMiner-regression",
      memory: {
        role: "remoteMiner",
        task: "return",
        version: 1,
        homeRoom: "W0N0",
        targetRoom: "W1N1"
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

    const summary = controller.execute(game, memory, roleCounts);

    expect(summary.tasksExecuted.return).toBe(1);
    expect(remoteMiner.memory.task).toBe("travel");
  });
});
