import { describe, expect, it, vi } from "vitest";
import { Kernel } from "@ralphschuler/screeps-kernel";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { GameContext } from "@runtime/types/GameContext";
import type { CreepLike, RoomLike } from "@runtime/types/GameContext";

function createCreep(role: string, room: RoomLike, energy: { free: number; used: number }): CreepLike {
  return {
    name: `${role}-${Math.random().toString(16).slice(2)}`,
    memory: { role },
    room,
    store: {
      getFreeCapacity: vi.fn(() => energy.free),
      getUsedCapacity: vi.fn(() => energy.used)
    },
    pos: {
      findClosestByPath: <T>(targets: T[]): T | null => (targets.length > 0 ? targets[0] : null)
    },
    harvest: vi.fn(() => OK),
    transfer: vi.fn(() => OK),
    moveTo: vi.fn(() => OK),
    upgradeController: vi.fn(() => OK),
    withdraw: vi.fn(() => OK)
  };
}

const TEST_REALM = process.env.SCREEPS_TEST_REALM ?? "PTR";

describe(`Kernel (${TEST_REALM})`, () => {
  it("spawns missing creeps and stores evaluation", () => {
    const source = { id: "source" } as Source;
    const controller = { id: "controller" } as StructureController;

    const spawnStore = {
      getFreeCapacity: vi.fn(() => 300),
      getUsedCapacity: vi.fn(() => 0)
    };

    const spawnCreepMock = vi.fn(() => OK);
    const spawn = {
      name: "Spawn1",
      spawning: null,
      spawnCreep: spawnCreepMock,
      store: spawnStore,
      room: { controller, find: () => [] } as RoomLike
    } as unknown as StructureSpawn;

    const room: RoomLike = {
      controller,
      find: (type: FindConstant) => {
        if (type === FIND_SOURCES_ACTIVE) {
          return [source];
        }
        if (type === FIND_STRUCTURES) {
          return [spawn as unknown as AnyStructure];
        }
        return [];
      }
    };

    const harvester = createCreep("harvester", room, { free: 50, used: 0 });
    const upgrader = createCreep("upgrader", room, { free: 0, used: 50 });

    const cpuReadings = { value: 0 };
    const game: GameContext = {
      time: 123,
      cpu: {
        getUsed: () => cpuReadings.value,
        limit: 20,
        bucket: 1000
      },
      creeps: { harvester, upgrader },
      spawns: { Spawn1: spawn as unknown as StructureSpawn },
      rooms: { W1N1: room }
    };

    const memory = { creeps: {}, roles: {} } as unknown as Memory;
    const kernel = new Kernel({
      behavior: new BehaviorController({}),
      logger: { log: vi.fn(), warn: vi.fn() }
    });

    kernel.run(game, memory);
    cpuReadings.value = 5;

    expect(spawnCreepMock).toHaveBeenCalled();
    expect(memory.systemReport?.report.summary).toBeDefined();
    expect(memory.stats).toBeDefined();
    expect(memory.stats?.time).toBe(123);
    expect(memory.stats?.cpu).toBeDefined();
    expect(memory.stats?.creeps.count).toBe(2);
  });
});
