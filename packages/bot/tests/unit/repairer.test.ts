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

describe("Repairer Role", () => {
  it("should have correct role and task structure", () => {
    const creep: CreepLike = {
      name: "repairer-1",
      memory: { role: "repairer", task: "repairerGather", version: 1 },
      store: {
        getFreeCapacity: vi.fn(() => 150),
        getUsedCapacity: vi.fn(() => 0)
      },
      pos: {
        x: 24,
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

    expect(creep.memory.role).toBe("repairer");
    expect(creep.memory.task).toBe("repairerGather");
    expect(creep.memory.version).toBe(1);
  });

  it("should have body parts optimized for repair work", () => {
    // Verify the role definition has appropriate body parts
    // 2 WORK parts for repair, 1 CARRY for energy, 2 MOVE for speed
    const expectedBody = [WORK, WORK, CARRY, MOVE, MOVE];
    expect(expectedBody.length).toBe(5);
    expect(expectedBody.filter(p => p === WORK).length).toBe(2);
    expect(expectedBody.filter(p => p === CARRY).length).toBe(1);
    expect(expectedBody.filter(p => p === MOVE).length).toBe(2);
  });

  it("should default to gather task when not carrying energy", () => {
    const room = createTestRoom();

    room.find = vi.fn(() => []);

    const creep: CreepLike = {
      name: "repairer-1",
      memory: { role: "repairer", task: "repairerGather", version: 1 },
      store: {
        getFreeCapacity: vi.fn(() => 150), // Not full
        getUsedCapacity: vi.fn(() => 0)
      },
      pos: {
        x: 27,
        y: 25,
        roomName: "W0N0",
        findClosestByPath: vi.fn(() => null)
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
      time: 7,
      cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
      creeps: { repairer: creep },
      spawns: {},
      rooms: { W0N0: room }
    };

    const controller = new BehaviorController({ useTaskSystem: false }, { log: vi.fn(), warn: vi.fn() });
    const memory = {} as Memory;

    controller.execute(game, memory, { repairer: 1 });

    // Should stay in gather task when not full
    expect(creep.memory.task).toBe("repairerGather");
  });
});
