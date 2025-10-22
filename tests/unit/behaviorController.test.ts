import { describe, expect, it, vi, beforeEach } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { GameContext, CreepLike, SpawnLike, RoomLike } from "@runtime/types/GameContext";

const createMockCreep = (role: string, energy: { free: number; used: number }, room: RoomLike): CreepLike => ({
  name: `${role}-test-${Date.now()}`,
  memory: { role, task: "idle", version: 1 },
  store: {
    getFreeCapacity: vi.fn(() => energy.free),
    getUsedCapacity: vi.fn(() => energy.used)
  },
  pos: {
    findClosestByPath: vi.fn(objects => objects?.[0] ?? null)
  },
  room,
  harvest: vi.fn(() => OK),
  transfer: vi.fn(() => OK),
  moveTo: vi.fn(() => OK),
  upgradeController: vi.fn(() => OK),
  withdraw: vi.fn(() => OK)
});

const createMockSpawn = (isSpawning = false): SpawnLike => ({
  name: "Spawn1",
  spawning: isSpawning ? ({ name: "test" } as Spawning) : null,
  spawnCreep: vi.fn(() => OK),
  store: {
    getFreeCapacity: vi.fn(() => 300),
    getUsedCapacity: vi.fn(() => 0)
  },
  room: {} as RoomLike
});

const createMockRoom = (): RoomLike => ({
  controller: { id: "controller" } as StructureController,
  find: vi.fn((type: FindConstant) => {
    if (type === FIND_SOURCES_ACTIVE) {
      return [{ id: "source1" }, { id: "source2" }] as Source[];
    }
    if (type === FIND_STRUCTURES) {
      return [
        {
          structureType: STRUCTURE_SPAWN,
          store: { getFreeCapacity: () => 100 }
        },
        {
          structureType: STRUCTURE_EXTENSION,
          store: { getFreeCapacity: () => 50 }
        }
      ] as AnyStructure[];
    }
    return [];
  })
});

describe("BehaviorController - Starter Bot MVP", () => {
  let controller: BehaviorController;
  let mockGame: GameContext;
  let mockMemory: Memory;
  let mockRoom: RoomLike;

  beforeEach(() => {
    controller = new BehaviorController();
    mockRoom = createMockRoom();
    mockGame = {
      time: 1000,
      creeps: {},
      spawns: { Spawn1: createMockSpawn() },
      rooms: { W1N1: mockRoom },
      cpu: {
        getUsed: () => 5,
        limit: 20,
        bucket: 1000
      }
    };
    mockMemory = {
      creeps: {},
      roles: {}
    } as Memory;
  });

  describe("Auto-spawning system", () => {
    it("spawns harvester creeps when below minimum", () => {
      const roleCounts = { harvester: 0, upgrader: 1 };

      controller.execute(mockGame, mockMemory, roleCounts);

      const spawn = mockGame.spawns.Spawn1;
      const spawnCreep = spawn.spawnCreep;
      expect(spawnCreep).toHaveBeenCalledWith([WORK, CARRY, MOVE], expect.stringMatching(/harvester-\d+-\d+/), {
        memory: { role: "harvester", task: "harvest", version: 1 }
      });
    });

    it("spawns upgrader creeps when below minimum", () => {
      const roleCounts = { harvester: 2, upgrader: 0 };

      controller.execute(mockGame, mockMemory, roleCounts);

      const spawn = mockGame.spawns.Spawn1;
      const spawnCreep = spawn.spawnCreep;
      expect(spawnCreep).toHaveBeenCalledWith([WORK, CARRY, MOVE], expect.stringMatching(/upgrader-\d+-\d+/), {
        memory: { role: "upgrader", task: "upgrade", version: 1 }
      });
    });

    it("does not spawn when spawn is busy", () => {
      mockGame.spawns.Spawn1 = createMockSpawn(true); // spawn is busy
      const roleCounts = { harvester: 0, upgrader: 0 };

      controller.execute(mockGame, mockMemory, roleCounts);

      const spawnCreep = mockGame.spawns.Spawn1.spawnCreep;
      expect(spawnCreep).not.toHaveBeenCalled();
    });

    it("does not spawn when role minimums are met", () => {
      const roleCounts = { harvester: 2, upgrader: 1 };

      controller.execute(mockGame, mockMemory, roleCounts);

      const spawnCreep = mockGame.spawns.Spawn1.spawnCreep;
      expect(spawnCreep).not.toHaveBeenCalled();
    });
  });

  describe("Auto-harvesting behavior", () => {
    it("harvester creep harvests when energy capacity available", () => {
      const creep = createMockCreep("harvester", { free: 50, used: 0 }, mockRoom);
      mockGame.creeps.harvester1 = creep;

      controller.execute(mockGame, mockMemory, {});

      const harvest = creep.harvest;
      expect(harvest).toHaveBeenCalled();
    });

    it("harvester moves to source when not in range", () => {
      const creep = createMockCreep("harvester", { free: 50, used: 0 }, mockRoom);
      creep.harvest = vi.fn(() => ERR_NOT_IN_RANGE);
      mockGame.creeps.harvester1 = creep;

      controller.execute(mockGame, mockMemory, {});

      const moveTo = creep.moveTo;
      expect(moveTo).toHaveBeenCalled();
    });

    it("harvester transfers energy to structures when full", () => {
      const creep = createMockCreep("harvester", { free: 0, used: 50 }, mockRoom);
      mockGame.creeps.harvester1 = creep;

      controller.execute(mockGame, mockMemory, {});

      const transfer = creep.transfer;
      expect(transfer).toHaveBeenCalled();
    });

    it("harvester upgrades controller when no transfer targets available", () => {
      const creep = createMockCreep("harvester", { free: 0, used: 50 }, mockRoom);
      // Mock room with no available structures for transfer
      const roomWithNoStructures = {
        ...mockRoom,
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES_ACTIVE) return [{ id: "source1" }];
          if (type === FIND_STRUCTURES) return []; // No structures to transfer to
          return [];
        })
      };
      creep.room = roomWithNoStructures;
      mockGame.creeps.harvester1 = creep;

      controller.execute(mockGame, mockMemory, {});

      const upgradeController = creep.upgradeController;
      expect(upgradeController).toHaveBeenCalled();
    });
  });

  describe("Auto-upgrading functionality", () => {
    it("upgrader withdraws energy when empty", () => {
      const creep = createMockCreep("upgrader", { free: 50, used: 0 }, mockRoom);
      mockGame.creeps.upgrader1 = creep;

      controller.execute(mockGame, mockMemory, {});

      const withdraw = creep.withdraw;
      expect(withdraw).toHaveBeenCalled();
    });

    it("upgrader upgrades controller when has energy", () => {
      const creep = createMockCreep("upgrader", { free: 0, used: 50 }, mockRoom);
      mockGame.creeps.upgrader1 = creep;

      controller.execute(mockGame, mockMemory, {});

      const upgradeController = creep.upgradeController;
      expect(upgradeController).toHaveBeenCalled();
    });

    it("upgrader moves to controller when not in range", () => {
      const creep = createMockCreep("upgrader", { free: 0, used: 50 }, mockRoom);
      creep.upgradeController = vi.fn(() => ERR_NOT_IN_RANGE);
      mockGame.creeps.upgrader1 = creep;

      controller.execute(mockGame, mockMemory, {});

      const moveTo = creep.moveTo;
      expect(moveTo).toHaveBeenCalled();
    });
  });

  describe("Basic room management and error handling", () => {
    it("handles unknown creep roles gracefully", () => {
      const creep = createMockCreep("unknown_role", { free: 50, used: 0 }, mockRoom);
      mockGame.creeps.unknown1 = creep;
      const logger = { log: vi.fn(), warn: vi.fn() };
      const controllerWithLogger = new BehaviorController(logger);

      const result = controllerWithLogger.execute(mockGame, mockMemory, {});

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Unknown role 'unknown_role'"));
      expect(result.processedCreeps).toBe(1);
    });

    it("updates role counts in memory", () => {
      const roleCounts = { harvester: 2, upgrader: 1 };

      controller.execute(mockGame, mockMemory, roleCounts);

      expect(mockMemory.roles).toEqual(roleCounts);
    });

    it("returns comprehensive execution summary", () => {
      const creep1 = createMockCreep("harvester", { free: 50, used: 0 }, mockRoom);
      const creep2 = createMockCreep("upgrader", { free: 0, used: 50 }, mockRoom);
      mockGame.creeps = { harvester1: creep1, upgrader1: creep2 };

      const result = controller.execute(mockGame, mockMemory, {});

      expect(result).toMatchObject({
        processedCreeps: 2,
        spawnedCreeps: expect.any(Array) as unknown[],
        tasksExecuted: expect.any(Object) as Record<string, unknown>
      });
      expect(result.tasksExecuted.harvest).toBeGreaterThan(0);
      expect(result.tasksExecuted.upgrade).toBeGreaterThan(0);
    });

    it("handles spawn failures gracefully", () => {
      const spawn = mockGame.spawns.Spawn1;
      spawn.spawnCreep = vi.fn(() => ERR_NOT_ENOUGH_ENERGY);
      const logger = { log: vi.fn(), warn: vi.fn() };
      const controllerWithLogger = new BehaviorController(logger);

      controllerWithLogger.execute(mockGame, mockMemory, { harvester: 0 });

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Failed to spawn harvester"));
    });
  });

  describe("Starter bot integration", () => {
    it("maintains energy collection → controller upgrade cycle", () => {
      // Set up a scenario with both harvesters and upgraders
      const harvester = createMockCreep("harvester", { free: 0, used: 50 }, mockRoom);
      const upgrader = createMockCreep("upgrader", { free: 0, used: 50 }, mockRoom);
      mockGame.creeps = { harvester1: harvester, upgrader1: upgrader };

      const result = controller.execute(mockGame, mockMemory, { harvester: 1, upgrader: 1 });

      // Verify the cycle: harvester supplies energy, upgrader uses it for upgrade
      expect(result.tasksExecuted.supply || result.tasksExecuted.upgrade).toBeGreaterThan(0);
      expect(result.processedCreeps).toBe(2);
    });
  });
});
