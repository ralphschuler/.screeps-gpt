import { describe, expect, it, vi } from "vitest";
import { Kernel } from "@runtime/bootstrap/kernel";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { CreepLike, GameContext, RoomLike } from "@runtime/types/GameContext";

function createCreep(role: string, room: RoomLike, store: { free: number; used: number }): CreepLike {
  return {
    name: `${role}-${Math.random().toString(16).slice(2)}`,
    memory: { role, task: role === "harvester" ? "harvest" : "recharge", version: 1 },
    store: {
      getFreeCapacity: vi.fn(() => store.free),
      getUsedCapacity: vi.fn(() => store.used)
    },
    pos: {
      findClosestByPath: vi.fn((objects: unknown[]) => (objects.length > 0 ? (objects[0] as never) : null))
    },
    room,
    harvest: vi.fn(() => OK),
    transfer: vi.fn(() => OK),
    moveTo: vi.fn(() => OK),
    upgradeController: vi.fn(() => OK),
    withdraw: vi.fn(() => OK),
    build: vi.fn(() => OK),
    repair: vi.fn(() => OK)
  };
}

describe("BehaviorController role integration", () => {
  it("spawns missing builder creeps alongside economy roles", () => {
    const controllerRoom: RoomLike = {
      name: "W0N0",
      controller: { id: "controller", progress: 0, progressTotal: 0 } as unknown as StructureController,
      find: (type: FindConstant) => {
        if (type === FIND_SOURCES_ACTIVE) {
          return [];
        }
        if (type === FIND_STRUCTURES || type === FIND_CONSTRUCTION_SITES) {
          return [];
        }
        return [];
      }
    };

    const spawnCreep = vi.fn(() => OK);
    const spawn = {
      name: "Spawn1",
      spawning: null,
      spawnCreep,
      store: { getFreeCapacity: () => 300, getUsedCapacity: () => 0 },
      room: controllerRoom
    } as unknown as StructureSpawn;

    const creeps: Record<string, CreepLike> = {
      harvester: createCreep("harvester", controllerRoom, { free: 0, used: 50 }),
      upgrader: createCreep("upgrader", controllerRoom, { free: 0, used: 50 })
    };

    const game: GameContext = {
      time: 250,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps,
      spawns: { Spawn1: spawn },
      rooms: { W0N0: controllerRoom }
    };

    const memory = { creeps: {}, roles: {} } as unknown as Memory;
    const kernel = new Kernel({
      behavior: new BehaviorController({}),
      logger: { log: vi.fn(), warn: vi.fn() }
    });

    kernel.run(game, memory);

    const calls = spawnCreep.mock.calls as Array<[BodyPartConstant[], string, SpawnOptions | undefined]>;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const builderSpawned = calls.some(([, name]) => name.startsWith("builder-"));
    expect(builderSpawned).toBe(true);
    const builderCall = calls.find(([, name]) => name.startsWith("builder-"));
    expect(builderCall?.[0]).toEqual([WORK, CARRY, MOVE, MOVE]);
    expect(memory.roles?.builder).toBe(1);
  });
});
