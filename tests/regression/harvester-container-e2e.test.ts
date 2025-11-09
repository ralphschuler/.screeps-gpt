/**
 * End-to-end regression test for harvester container transfer behavior.
 *
 * Issue: ralphschuler/.screeps-gpt#566
 * Tests the complete BehaviorController flow with actual role execution
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { GameContext } from "@runtime/types/GameContext";

describe("Harvester Container Transfer E2E", () => {
  let behaviorController: BehaviorController;
  let memory: Memory;
  let game: GameContext;
  let mockHarvester: Creep;
  let mockContainer: StructureContainer;
  let mockSource: Source;

  beforeEach(() => {
    // Create behavior controller with legacy role system for testing
    behaviorController = new BehaviorController(
      {
        useTaskSystem: false, // Use legacy role-based system for this test
        cpuSafetyMargin: 0.85,
        maxCpuPerCreep: 1.5
      },
      { log: vi.fn(), warn: vi.fn() }
    );

    memory = {} as Memory;

    // Create mock source
    mockSource = {
      id: "source-1" as Id<Source>,
      pos: {
        x: 20,
        y: 20,
        roomName: "W1N1",
        inRangeTo: vi.fn().mockReturnValue(true)
      } as RoomPosition,
      energy: 3000,
      energyCapacity: 3000,
      ticksToRegeneration: 300
    } as Source;

    // Create mock container near source
    mockContainer = {
      id: "container-1" as Id<StructureContainer>,
      structureType: STRUCTURE_CONTAINER,
      pos: {
        x: 21,
        y: 21,
        roomName: "W1N1",
        inRangeTo: vi.fn().mockReturnValue(true)
      } as RoomPosition,
      store: {
        getFreeCapacity: vi.fn().mockReturnValue(2000),
        getUsedCapacity: vi.fn().mockReturnValue(0),
        energy: 0
      } as StoreDefinition,
      hits: 5000,
      hitsMax: 5000,
      room: {} as Room,
      my: false
    } as StructureContainer;

    // Create mock harvester creep
    mockHarvester = {
      name: "harvester-1",
      id: "creep-1" as Id<Creep>,
      pos: {
        x: 20,
        y: 20,
        roomName: "W1N1",
        findClosestByPath: vi.fn((targets: unknown[]) => {
          // Return first target
          return Array.isArray(targets) && targets.length > 0 ? targets[0] : null;
        }),
        findClosestByRange: vi.fn((targets: unknown[]) => {
          return Array.isArray(targets) && targets.length > 0 ? targets[0] : null;
        }),
        inRangeTo: vi.fn().mockReturnValue(true)
      } as RoomPosition,
      memory: {
        role: "harvester",
        task: "harvest",
        version: 1
      } as CreepMemory,
      store: {
        getFreeCapacity: vi.fn().mockReturnValue(50), // Empty initially
        getUsedCapacity: vi.fn().mockReturnValue(0),
        energy: 0,
        getCapacity: vi.fn().mockReturnValue(50)
      } as StoreDefinition,
      harvest: vi.fn().mockReturnValue(OK),
      transfer: vi.fn().mockReturnValue(OK),
      moveTo: vi.fn().mockReturnValue(OK),
      upgradeController: vi.fn().mockReturnValue(OK),
      room: {
        name: "W1N1",
        controller: {
          id: "controller-1" as Id<StructureController>,
          my: true,
          level: 3
        } as StructureController,
        find: vi.fn((findConstant: FindConstant, options?: FilterOptions<FindConstant>) => {
          if (findConstant === FIND_SOURCES_ACTIVE) {
            return [mockSource];
          }
          if (findConstant === FIND_STRUCTURES) {
            const structures = [mockContainer];
            if (options?.filter) {
              return structures.filter(s => options.filter!(s as AnyStructure));
            }
            return structures;
          }
          return [];
        })
      } as Room
    } as Creep;

    // Setup game context
    game = {
      time: 1000,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 100,
        bucket: 10000
      },
      creeps: {
        "harvester-1": mockHarvester
      },
      spawns: {},
      rooms: {
        W1N1: mockHarvester.room
      }
    } as unknown as GameContext;
  });

  it("should transfer energy to container when full and no spawns/extensions available", () => {
    // Simulate harvester with full energy
    (mockHarvester.store.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
    (mockHarvester.store.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(50);
    mockHarvester.store.energy = 50;
    mockHarvester.memory.task = "harvest"; // Will transition to deliver

    // Execute behavior
    const result = behaviorController.execute(game, memory, { harvester: 1 });

    // Verify behavior executed
    expect(result.processedCreeps).toBe(1);

    // Verify transfer was attempted to container
    expect(mockHarvester.transfer).toHaveBeenCalledWith(mockContainer, RESOURCE_ENERGY);
  });

  it("should handle harvest-transfer cycle correctly over multiple ticks", () => {
    // Tick 1: Harvester empty, should harvest
    (mockHarvester.store.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(50);
    (mockHarvester.store.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
    mockHarvester.memory.task = "harvest";

    behaviorController.execute(game, memory, { harvester: 1 });

    expect(mockHarvester.harvest).toHaveBeenCalledWith(mockSource);
    expect(mockHarvester.memory.task).toBe("harvest");

    // Tick 2: Harvester full, should deliver to container
    (mockHarvester.store.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
    (mockHarvester.store.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(50);
    vi.clearAllMocks(); // Clear previous calls

    behaviorController.execute(game, memory, { harvester: 1 });

    expect(mockHarvester.transfer).toHaveBeenCalledWith(mockContainer, RESOURCE_ENERGY);
    expect(mockHarvester.memory.task).toBe("deliver");

    // Tick 3: Harvester empty again, should return to harvest
    (mockHarvester.store.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(50);
    (mockHarvester.store.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
    vi.clearAllMocks();

    behaviorController.execute(game, memory, { harvester: 1 });

    expect(mockHarvester.harvest).toHaveBeenCalledWith(mockSource);
    expect(mockHarvester.memory.task).toBe("harvest");
  });

  it("should not get stuck when container becomes available after upgrade task", () => {
    // Scenario: Harvester was in UPGRADE_TASK because no targets were available
    // Then a container becomes available

    // Setup: Harvester has energy and is in UPGRADE_TASK
    // Note: "upgrade" is a valid HarvesterTask value as defined in BehaviorController
    mockHarvester.memory.task = "upgrade";
    (mockHarvester.store.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
    (mockHarvester.store.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(50);

    // Container is now available with capacity
    (mockContainer.store.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(2000);

    // Execute behavior
    behaviorController.execute(game, memory, { harvester: 1 });

    // Harvester should transfer to container (not stay stuck in upgrade)
    expect(mockHarvester.transfer).toHaveBeenCalledWith(mockContainer, RESOURCE_ENERGY);
  });

  it("should move to container when ERR_NOT_IN_RANGE", () => {
    // Setup: Harvester full, not in range of container
    (mockHarvester.store.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
    (mockHarvester.store.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(50);
    mockHarvester.memory.task = "deliver";

    // Mock transfer to return ERR_NOT_IN_RANGE
    (mockHarvester.transfer as ReturnType<typeof vi.fn>).mockReturnValue(ERR_NOT_IN_RANGE);

    behaviorController.execute(game, memory, { harvester: 1 });

    // Should attempt transfer first
    expect(mockHarvester.transfer).toHaveBeenCalledWith(mockContainer, RESOURCE_ENERGY);

    // Then should move to container
    expect(mockHarvester.moveTo).toHaveBeenCalledWith(
      mockContainer,
      expect.objectContaining({ range: 1, reusePath: 30 })
    );
  });
});

// Type augmentation matching BehaviorController's HarvesterTask definition
// HarvesterTask = typeof HARVEST_TASK | typeof DELIVER_TASK | typeof UPGRADE_TASK
// where HARVEST_TASK = "harvest", DELIVER_TASK = "deliver", UPGRADE_TASK = "upgrade"
