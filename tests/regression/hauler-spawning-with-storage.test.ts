/**
 * Regression test for hauler spawning with storage/towers but no source containers.
 *
 * Issue: ralphschuler/.screeps-gpt#945 - Hauler role not spawning
 *
 * Root Cause: Haulers only spawned when containers existed near sources (range 2).
 * However, rooms with storage and towers still need haulers for logistics even without
 * source-adjacent containers.
 *
 * This test validates that haulers spawn in the following scenarios:
 * 1. Storage exists in room (RCL 4+)
 * 2. Towers exist and need refilling
 * 3. Containers exist anywhere in room (not just near sources)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { GameContext, RoomLike, SpawnLike } from "@runtime/types/GameContext";

describe("Hauler Spawning with Storage/Towers", () => {
  let behaviorController: BehaviorController;
  let memory: Memory;
  let mockSpawn: SpawnLike;

  beforeEach(() => {
    behaviorController = new BehaviorController(
      {
        useTaskSystem: false,
        cpuSafetyMargin: 0.85,
        maxCpuPerCreep: 1.5
      },
      { log: vi.fn(), warn: vi.fn() }
    );

    memory = {
      creepCounter: 0
    } as Memory;

    mockSpawn = {
      name: "Spawn1",
      spawning: null,
      spawnCreep: vi.fn().mockReturnValue(OK),
      pos: { x: 25, y: 25, roomName: "W1N1" } as RoomPosition,
      room: {
        energyAvailable: 400,
        energyCapacityAvailable: 550
      } as Room
    } as unknown as SpawnLike;
  });

  it("should spawn haulers when storage exists without source containers", () => {
    // Room with storage but no containers near sources
    const mockStorage = {
      id: "storage-1" as Id<StructureStorage>,
      structureType: STRUCTURE_STORAGE,
      pos: { x: 24, y: 24, roomName: "W1N1" } as RoomPosition,
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(1000),
        getFreeCapacity: vi.fn().mockReturnValue(49000),
        getCapacity: vi.fn().mockReturnValue(50000)
      }
    } as unknown as StructureStorage;

    const mockSource = {
      id: "source-1" as Id<Source>,
      pos: {
        x: 10,
        y: 10,
        roomName: "W1N1",
        findInRange: vi.fn(() => []) // No containers near source
      } as unknown as RoomPosition
    } as Source;

    const mockRoom: RoomLike = {
      name: "W1N1",
      controller: {
        my: true,
        level: 4,
        id: "controller-1" as Id<StructureController>,
        progress: 0,
        progressTotal: 1000
      } as StructureController,
      storage: mockStorage,
      find: vi.fn((findConstant: FindConstant, _options?: unknown) => {
        if (findConstant === FIND_SOURCES) {
          return [mockSource];
        }
        if (findConstant === FIND_MY_STRUCTURES) {
          return [];
        }
        if (findConstant === FIND_STRUCTURES) {
          // No containers in room
          return [];
        }
        return [];
      })
    };

    // Create mock harvester to avoid emergency mode (0 creeps)
    // Emergency mode would spawn harvesters first, but this test validates
    // that haulers spawn when storage exists (non-emergency scenario)
    const mockHarvester = {
      name: "harvester-999",
      memory: { role: "harvester" }
    } as Creep;

    const game: GameContext = {
      time: 1000,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 100,
        bucket: 10000
      },
      creeps: { "harvester-999": mockHarvester },
      spawns: { Spawn1: mockSpawn },
      rooms: { W1N1: mockRoom }
    } as unknown as GameContext;

    // Execute behavior controller - should spawn haulers due to storage
    // With 1 harvester existing, not in emergency mode, so hauler spawns first
    const result = behaviorController.execute(game, memory, { harvester: 1 });

    // Verify spawn was called (should spawn at least one hauler)
    expect(mockSpawn.spawnCreep).toHaveBeenCalled();

    // Check that a hauler was spawned
    const spawnCalls = (mockSpawn.spawnCreep as ReturnType<typeof vi.fn>).mock.calls;
    const haulerSpawned = spawnCalls.some(call => {
      const creepName = call[1] as string;
      return creepName.startsWith("hauler-");
    });

    expect(haulerSpawned).toBe(true);
    expect(result.spawnedCreeps.length).toBeGreaterThan(0);
  });

  it("should spawn haulers when towers exist without source containers", () => {
    // Room with tower but no containers near sources
    const mockTower = {
      id: "tower-1" as Id<StructureTower>,
      structureType: STRUCTURE_TOWER,
      pos: { x: 26, y: 26, roomName: "W1N1" } as RoomPosition,
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(400),
        getFreeCapacity: vi.fn().mockReturnValue(600),
        getCapacity: vi.fn().mockReturnValue(1000)
      }
    } as unknown as StructureTower;

    const mockSource = {
      id: "source-1" as Id<Source>,
      pos: {
        x: 10,
        y: 10,
        roomName: "W1N1",
        findInRange: vi.fn(() => []) // No containers near source
      } as unknown as RoomPosition
    } as Source;

    const mockRoom: RoomLike = {
      name: "W1N1",
      controller: {
        my: true,
        level: 3,
        id: "controller-1" as Id<StructureController>,
        progress: 0,
        progressTotal: 1000
      } as StructureController,
      storage: null,
      find: vi.fn((findConstant: FindConstant, options?: unknown) => {
        if (findConstant === FIND_SOURCES) {
          return [mockSource];
        }
        if (findConstant === FIND_MY_STRUCTURES) {
          if (options && typeof options === "object" && "filter" in options) {
            const filter = (options as { filter: (s: Structure) => boolean }).filter;
            const structures: Structure[] = [mockTower];
            return structures.filter(filter);
          }
          return [mockTower];
        }
        if (findConstant === FIND_STRUCTURES) {
          // No containers in room
          return [];
        }
        return [];
      })
    };

    // Create mock harvester to avoid emergency mode (0 creeps)
    const mockHarvester = {
      name: "harvester-999",
      memory: { role: "harvester" }
    } as Creep;

    const game: GameContext = {
      time: 1000,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 100,
        bucket: 10000
      },
      creeps: { "harvester-999": mockHarvester },
      spawns: { Spawn1: mockSpawn },
      rooms: { W1N1: mockRoom }
    } as unknown as GameContext;

    // Execute behavior controller - should spawn haulers due to towers
    // With 1 harvester existing, not in emergency mode, so hauler spawns first
    const result = behaviorController.execute(game, memory, { harvester: 1 });

    // Verify spawn was called
    expect(mockSpawn.spawnCreep).toHaveBeenCalled();

    // Check that a hauler was spawned
    const spawnCalls = (mockSpawn.spawnCreep as ReturnType<typeof vi.fn>).mock.calls;
    const haulerSpawned = spawnCalls.some(call => {
      const creepName = call[1] as string;
      return creepName.startsWith("hauler-");
    });

    expect(haulerSpawned).toBe(true);
    expect(result.spawnedCreeps.length).toBeGreaterThan(0);
  });

  it("should spawn haulers when containers exist anywhere in room", () => {
    // Room with container near spawn (not near source)
    const mockContainer = {
      id: "container-1" as Id<StructureContainer>,
      structureType: STRUCTURE_CONTAINER,
      pos: { x: 24, y: 25, roomName: "W1N1" } as RoomPosition,
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(500),
        getFreeCapacity: vi.fn().mockReturnValue(1500)
      }
    } as unknown as StructureContainer;

    const mockSource = {
      id: "source-1" as Id<Source>,
      pos: {
        x: 10,
        y: 10,
        roomName: "W1N1",
        findInRange: vi.fn(() => []) // No containers near source
      } as unknown as RoomPosition
    } as Source;

    const mockRoom: RoomLike = {
      name: "W1N1",
      controller: {
        my: true,
        level: 3,
        id: "controller-1" as Id<StructureController>,
        progress: 0,
        progressTotal: 1000
      } as StructureController,
      storage: null,
      find: vi.fn((findConstant: FindConstant, options?: unknown) => {
        if (findConstant === FIND_SOURCES) {
          return [mockSource];
        }
        if (findConstant === FIND_MY_STRUCTURES) {
          return [];
        }
        if (findConstant === FIND_STRUCTURES) {
          if (options && typeof options === "object" && "filter" in options) {
            const filter = (options as { filter: (s: Structure) => boolean }).filter;
            const structures: Structure[] = [mockContainer];
            return structures.filter(filter);
          }
          return [mockContainer];
        }
        return [];
      })
    };

    // Create mock harvester to avoid emergency mode (0 creeps)
    const mockHarvester = {
      name: "harvester-999",
      memory: { role: "harvester" }
    } as Creep;

    const game: GameContext = {
      time: 1000,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 100,
        bucket: 10000
      },
      creeps: { "harvester-999": mockHarvester },
      spawns: { Spawn1: mockSpawn },
      rooms: { W1N1: mockRoom }
    } as unknown as GameContext;

    // Execute behavior controller - should spawn haulers due to container
    // With 1 harvester existing, not in emergency mode, so hauler spawns first
    const result = behaviorController.execute(game, memory, { harvester: 1 });

    // Verify spawn was called
    expect(mockSpawn.spawnCreep).toHaveBeenCalled();

    // Check that a hauler was spawned
    const spawnCalls = (mockSpawn.spawnCreep as ReturnType<typeof vi.fn>).mock.calls;
    const haulerSpawned = spawnCalls.some(call => {
      const creepName = call[1] as string;
      return creepName.startsWith("hauler-");
    });

    expect(haulerSpawned).toBe(true);
    expect(result.spawnedCreeps.length).toBeGreaterThan(0);
  });

  it("should NOT spawn haulers when no containers, storage, or towers exist", () => {
    // Basic room with just sources and spawns
    const mockSource = {
      id: "source-1" as Id<Source>,
      pos: {
        x: 10,
        y: 10,
        roomName: "W1N1",
        findInRange: vi.fn(() => [])
      } as unknown as RoomPosition
    } as Source;

    const mockRoom: RoomLike = {
      name: "W1N1",
      controller: {
        my: true,
        level: 2,
        id: "controller-1" as Id<StructureController>,
        progress: 0,
        progressTotal: 1000
      } as StructureController,
      storage: null,
      find: vi.fn((findConstant: FindConstant) => {
        if (findConstant === FIND_SOURCES) {
          return [mockSource];
        }
        return [];
      })
    };

    const game: GameContext = {
      time: 1000,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 100,
        bucket: 10000
      },
      creeps: {},
      spawns: { Spawn1: mockSpawn },
      rooms: { W1N1: mockRoom }
    } as unknown as GameContext;

    // Execute behavior controller - should NOT spawn haulers (no logistics infrastructure)
    behaviorController.execute(game, memory, {});

    // Check that NO hauler was spawned
    const spawnCalls = (mockSpawn.spawnCreep as ReturnType<typeof vi.fn>).mock.calls;
    const haulerSpawned = spawnCalls.some(call => {
      const creepName = call[1] as string;
      return creepName.startsWith("hauler-");
    });

    // In basic RCL 2 room without containers/storage/towers, haulers should not spawn
    expect(haulerSpawned).toBe(false);
  });
});
