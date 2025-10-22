import { describe, expect, it, vi } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { GameContext, CreepLike, SpawnLike, RoomLike } from "@runtime/types/GameContext";

/**
 * Helper function to create a mock room with sources and controller
 */
function createRoom(options: { hasSources?: boolean; hasController?: boolean } = {}): RoomLike {
  const source = { id: "source1" } as Source;
  const controller = { id: "controller1" } as StructureController;

  return {
    controller: options.hasController !== false ? controller : undefined,
    find: vi.fn((type: FindConstant) => {
      if (type === FIND_SOURCES_ACTIVE && options.hasSources !== false) {
        return [source];
      }
      if (type === FIND_STRUCTURES) {
        return [];
      }
      return [];
    })
  };
}

/**
 * Helper function to create a mock creep with specified role and energy levels
 */
function createCreep(
  role: string,
  room: RoomLike,
  energyLevels: { free: number; used: number }
): CreepLike {
  return {
    name: `${role}-${Math.random().toString(16).slice(2)}`,
    memory: { role },
    room,
    store: {
      getFreeCapacity: vi.fn(() => energyLevels.free),
      getUsedCapacity: vi.fn(() => energyLevels.used)
    },
    pos: {
      findClosestByPath: vi.fn(<T>(targets: T[]): T | null => (targets.length > 0 ? targets[0] : null))
    },
    harvest: vi.fn(() => OK),
    transfer: vi.fn(() => OK),
    moveTo: vi.fn(() => OK),
    upgradeController: vi.fn(() => OK),
    withdraw: vi.fn(() => OK)
  };
}

/**
 * Helper function to create a mock spawn
 */
function createSpawn(isSpawning = false, room?: RoomLike): SpawnLike {
  return {
    name: "Spawn1",
    spawning: isSpawning ? ({} as Spawning) : null,
    spawnCreep: vi.fn(() => OK),
    store: {
      getFreeCapacity: vi.fn(() => 300),
      getUsedCapacity: vi.fn(() => 0)
    },
    room: room ?? createRoom()
  };
}

/**
 * Helper function to create a minimal game context for testing
 */
function createGameContext(options: {
  creeps?: Record<string, CreepLike>;
  spawns?: Record<string, SpawnLike>;
  time?: number;
}): GameContext {
  return {
    time: options.time ?? 100,
    cpu: {
      getUsed: vi.fn(() => 0),
      limit: 20,
      bucket: 1000
    },
    creeps: options.creeps ?? {},
    spawns: options.spawns ?? {},
    rooms: {}
  };
}

describe("BehaviorController", () => {
  describe("Auto-spawning System", () => {
    it("spawns harvesters when below minimum", () => {
      const spawn = createSpawn();
      const game = createGameContext({ spawns: { Spawn1: spawn } });
      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const result = controller.execute(game, memory, {});

      expect(result.spawnedCreeps.length).toBeGreaterThan(0);
      expect(result.spawnedCreeps.some(name => name.startsWith("harvester"))).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(spawn.spawnCreep).toHaveBeenCalled();
    });

    it("spawns upgraders when below minimum", () => {
      const spawn = createSpawn();
      const game = createGameContext({ spawns: { Spawn1: spawn } });
      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      // Execute to spawn minimum creeps
      controller.execute(game, memory, {});

      // Verify upgrader was spawned
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const spawnCalls = (spawn.spawnCreep as ReturnType<typeof vi.fn>).mock.calls;
      const upgraderSpawned = spawnCalls.some(call => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const name = call[1];
        return typeof name === "string" && name.startsWith("upgrader");
      });
      expect(upgraderSpawned).toBe(true);
    });

    it("does not spawn when role minimum is already satisfied", () => {
      const spawn = createSpawn();
      const room = createRoom();
      const harvester1 = createCreep("harvester", room, { free: 50, used: 0 });
      const harvester2 = createCreep("harvester", room, { free: 50, used: 0 });
      const upgrader = createCreep("upgrader", room, { free: 0, used: 50 });

      const game = createGameContext({
        spawns: { Spawn1: spawn },
        creeps: { harvester1, harvester2, upgrader }
      });

      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const result = controller.execute(game, memory, {
        harvester: 2,
        upgrader: 1
      });

      expect(result.spawnedCreeps.length).toBe(0);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(spawn.spawnCreep).not.toHaveBeenCalled();
    });

    it("warns when no spawn is available", () => {
      const warn = vi.fn();
      const game = createGameContext({ spawns: {} });
      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn });

      controller.execute(game, memory, {});

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("No available spawns"));
    });

    it("does not use busy spawns", () => {
      const busySpawn = createSpawn(true);
      const game = createGameContext({ spawns: { Spawn1: busySpawn } });
      const memory = {} as Memory;
      const warn = vi.fn();
      const controller = new BehaviorController({ log: vi.fn(), warn });

      controller.execute(game, memory, {});

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(busySpawn.spawnCreep).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("No available spawns"));
    });

    it("handles spawn failures gracefully", () => {
      const spawn = createSpawn();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      (spawn.spawnCreep as ReturnType<typeof vi.fn>).mockReturnValue(ERR_NOT_ENOUGH_ENERGY);

      const warn = vi.fn();
      const game = createGameContext({ spawns: { Spawn1: spawn } });
      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn });

      controller.execute(game, memory, {});

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Failed to spawn"));
    });
  });

  describe("Harvester Behavior", () => {
    it("harvests energy when storage has capacity", () => {
      const room = createRoom({ hasSources: true });
      const harvester = createCreep("harvester", room, { free: 50, used: 0 });
      const game = createGameContext({ creeps: { harvester } });
      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const result = controller.execute(game, memory, { harvester: 1 });

      expect(result.tasksExecuted["harvest"]).toBe(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(harvester.harvest).toHaveBeenCalled();
    });

    it("moves to source when not in range", () => {
      const room = createRoom({ hasSources: true });
      const harvester = createCreep("harvester", room, { free: 50, used: 0 });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      (harvester.harvest as ReturnType<typeof vi.fn>).mockReturnValue(ERR_NOT_IN_RANGE);

      const game = createGameContext({ creeps: { harvester } });
      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      controller.execute(game, memory, { harvester: 1 });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(harvester.moveTo).toHaveBeenCalled();
    });

    it("delivers energy to spawn when full", () => {
      const spawn = createSpawn();
      const room = createRoom();
      // Mock room.find to return spawn as a structure
      // eslint-disable-next-line @typescript-eslint/unbound-method
      (room.find as ReturnType<typeof vi.fn>).mockImplementation((type: FindConstant) => {
        if (type === FIND_STRUCTURES) {
          return [spawn as unknown as AnyStructure];
        }
        return [];
      });

      const harvester = createCreep("harvester", room, { free: 0, used: 50 });
      const game = createGameContext({ creeps: { harvester }, spawns: { Spawn1: spawn } });
      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const result = controller.execute(game, memory, { harvester: 1 });

      expect(result.tasksExecuted["supply"]).toBe(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(harvester.transfer).toHaveBeenCalled();
    });

    it("upgrades controller when full and no spawn needs energy", () => {
      const room = createRoom({ hasController: true });
      const harvester = createCreep("harvester", room, { free: 0, used: 50 });
      const game = createGameContext({ creeps: { harvester } });
      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const result = controller.execute(game, memory, { harvester: 1 });

      expect(result.tasksExecuted["upgrade"]).toBe(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(harvester.upgradeController).toHaveBeenCalled();
    });
  });

  describe("Upgrader Behavior", () => {
    it("withdraws energy from spawn when empty", () => {
      const spawn = createSpawn();
      const room = createRoom();
      // Mock room.find to return spawn as a structure
      // eslint-disable-next-line @typescript-eslint/unbound-method
      (room.find as ReturnType<typeof vi.fn>).mockImplementation((type: FindConstant) => {
        if (type === FIND_STRUCTURES) {
          return [spawn as unknown as AnyStructure];
        }
        return [];
      });

      const upgrader = createCreep("upgrader", room, { free: 50, used: 0 });
      const game = createGameContext({ creeps: { upgrader }, spawns: { Spawn1: spawn } });
      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const result = controller.execute(game, memory, { upgrader: 1 });

      expect(result.tasksExecuted["recharge"]).toBe(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(upgrader.withdraw).toHaveBeenCalled();
    });

    it("upgrades controller when has energy", () => {
      const room = createRoom({ hasController: true });
      const upgrader = createCreep("upgrader", room, { free: 0, used: 50 });
      const game = createGameContext({ creeps: { upgrader } });
      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const result = controller.execute(game, memory, { upgrader: 1 });

      expect(result.tasksExecuted["upgrade"]).toBe(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(upgrader.upgradeController).toHaveBeenCalled();
    });

    it("moves to controller when not in range", () => {
      const room = createRoom({ hasController: true });
      const upgrader = createCreep("upgrader", room, { free: 0, used: 50 });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      (upgrader.upgradeController as ReturnType<typeof vi.fn>).mockReturnValue(ERR_NOT_IN_RANGE);

      const game = createGameContext({ creeps: { upgrader } });
      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      controller.execute(game, memory, { upgrader: 1 });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(upgrader.moveTo).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("handles unknown role gracefully", () => {
      const warn = vi.fn();
      const room = createRoom();
      const unknownCreep = createCreep("unknown", room, { free: 50, used: 0 });
      const game = createGameContext({ creeps: { unknownCreep } });
      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn });

      const result = controller.execute(game, memory, { unknown: 1 });

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Unknown role"));
      expect(result.processedCreeps).toBe(1);
      expect(Object.keys(result.tasksExecuted).length).toBe(0);
    });
  });

  describe("Summary Reporting", () => {
    it("reports correct number of processed creeps", () => {
      const room = createRoom();
      const harvester = createCreep("harvester", room, { free: 50, used: 0 });
      const upgrader = createCreep("upgrader", room, { free: 0, used: 50 });
      const game = createGameContext({ creeps: { harvester, upgrader } });
      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const result = controller.execute(game, memory, { harvester: 1, upgrader: 1 });

      expect(result.processedCreeps).toBe(2);
    });

    it("tracks tasks executed by type", () => {
      const room = createRoom({ hasSources: true, hasController: true });
      const harvester = createCreep("harvester", room, { free: 50, used: 0 });
      const upgrader = createCreep("upgrader", room, { free: 0, used: 50 });
      const game = createGameContext({ creeps: { harvester, upgrader } });
      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const result = controller.execute(game, memory, { harvester: 1, upgrader: 1 });

      expect(result.tasksExecuted["harvest"]).toBe(1);
      expect(result.tasksExecuted["upgrade"]).toBe(1);
    });

    it("updates memory with current role counts", () => {
      const room = createRoom();
      const harvester = createCreep("harvester", room, { free: 50, used: 0 });
      const game = createGameContext({ creeps: { harvester } });
      const memory = {} as Memory;
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      controller.execute(game, memory, { harvester: 1 });

      expect(memory.roles).toEqual({ harvester: 1 });
    });
  });
});
