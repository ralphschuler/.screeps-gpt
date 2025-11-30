/**
 * Regression test for stationary harvester depositing state machine.
 *
 * Issue: #1564 - Bot experiences recurring death spirals where energy never reaches
 * spawn structures despite harvesters mining energy.
 *
 * Root cause: The stationary harvester state machine only had ONE state (harvesting)
 * with no transitions to a depositing state. While the controller imperatively called
 * transfer(), the state machine didn't properly track state transitions.
 *
 * Fix:
 * - Added proper state machine states (harvesting, depositing)
 * - Added state transitions for ENERGY_FULL, ENERGY_EMPTY, CONTAINER_FULL
 * - Controller now uses state-based behavior with proper transitions
 * - Container lookup now searches near source position (not just creep position)
 *
 * This test validates that:
 * 1. Stationary harvesters properly transition to depositing state when full
 * 2. Energy is transferred to containers
 * 3. State transitions back to harvesting when empty
 * 4. Death spiral prevention - energy flows through containers
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StationaryHarvesterController } from "@runtime/behavior/controllers/StationaryHarvesterController";
import type { CreepLike } from "@runtime/types/GameContext";

// Mock Screeps globals
beforeEach(() => {
  (globalThis as typeof globalThis & Record<string, unknown>).WORK = "work" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).CARRY = "carry" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).MOVE = "move" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).RESOURCE_ENERGY = "energy";
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_SOURCES = 104 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_STRUCTURES = 108 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_CONTAINER = "container" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).OK = 0;
  (globalThis as typeof globalThis & Record<string, unknown>).ERR_NOT_IN_RANGE = -9;

  // Mock Game object
  (globalThis as typeof globalThis & Record<string, unknown>).Game = {
    time: 1000,
    creeps: {},
    getObjectById: vi.fn()
  };
});

describe("Stationary Harvester Depositing (Issue #1564)", () => {
  let controller: StationaryHarvesterController;
  let mockCreep: CreepLike;
  let mockRoom: Room;
  let mockSource: Source;
  let mockContainer: StructureContainer;
  let creepMemory: Record<string, unknown>;
  let freeCapacity: number;
  let usedCapacity: number;
  let containerFreeCapacity: number;

  beforeEach(() => {
    controller = new StationaryHarvesterController();
    freeCapacity = 50; // Creep starts with empty store
    usedCapacity = 0;
    containerFreeCapacity = 2000; // Container has space

    // Create mock source
    mockSource = {
      id: "source-1" as Id<Source>,
      pos: {
        x: 20,
        y: 20,
        roomName: "W1N1",
        findInRange: vi.fn((findConstant: FindConstant, range: number) => {
          if (findConstant === FIND_STRUCTURES && range === 1) {
            return [mockContainer];
          }
          return [];
        })
      } as unknown as RoomPosition,
      energy: 3000,
      energyCapacity: 3000,
      ticksToRegeneration: 300
    } as Source;

    // Create mock container adjacent to source
    mockContainer = {
      id: "container-1" as Id<StructureContainer>,
      structureType: STRUCTURE_CONTAINER,
      pos: {
        x: 21,
        y: 20,
        roomName: "W1N1"
      } as RoomPosition,
      store: {
        getFreeCapacity: vi.fn(() => containerFreeCapacity),
        getUsedCapacity: vi.fn(() => 2000 - containerFreeCapacity),
        getCapacity: vi.fn().mockReturnValue(2000)
      } as unknown as Store<RESOURCE_ENERGY, false>
    } as unknown as StructureContainer;

    // Create mock room
    mockRoom = {
      name: "W1N1",
      controller: {
        id: "controller-1" as Id<StructureController>,
        my: true,
        level: 2
      } as StructureController,
      find: vi.fn((findConstant: FindConstant) => {
        if (findConstant === FIND_SOURCES) {
          return [mockSource];
        }
        if (findConstant === FIND_STRUCTURES) {
          return [mockContainer];
        }
        return [];
      })
    } as unknown as Room;

    // Use a separate memory object
    creepMemory = {
      role: "stationaryHarvester",
      task: "harvesting",
      version: 1
    };

    // Create mock creep positioned near both source and container
    mockCreep = {
      name: "stationary-harvester-test-1",
      id: "creep-1" as Id<Creep>,
      pos: {
        x: 20,
        y: 20,
        roomName: "W1N1",
        findClosestByPath: vi.fn((targets: unknown[]) => {
          return Array.isArray(targets) && targets.length > 0 ? targets[0] : null;
        }),
        isNearTo: vi.fn().mockReturnValue(true), // Creep is adjacent to both source and container
        inRangeTo: vi.fn().mockReturnValue(true),
        findInRange: vi.fn((findConstant: FindConstant, range: number) => {
          if (findConstant === FIND_STRUCTURES && range === 1) {
            return [mockContainer];
          }
          return [];
        })
      } as unknown as RoomPosition,
      get memory() {
        return creepMemory as CreepMemory;
      },
      set memory(value: CreepMemory) {
        Object.assign(creepMemory, value);
      },
      store: {
        getFreeCapacity: vi.fn(() => freeCapacity),
        getUsedCapacity: vi.fn(() => usedCapacity),
        getCapacity: vi.fn().mockReturnValue(50)
      } as unknown as StoreDefinition,
      harvest: vi.fn().mockReturnValue(OK),
      transfer: vi.fn().mockReturnValue(OK),
      moveTo: vi.fn().mockReturnValue(OK),
      drop: vi.fn().mockReturnValue(OK),
      room: mockRoom
    } as unknown as CreepLike;

    // Setup Game.creeps
    (Game as typeof Game & { creeps: Record<string, Creep> }).creeps = {
      "stationary-harvester-test-1": mockCreep as Creep
    };

    // Setup Game.getObjectById
    (Game.getObjectById as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
      if (id === mockSource.id) return mockSource;
      if (id === mockContainer.id) return mockContainer;
      return null;
    });
  });

  it("should find and assign container near source position", () => {
    // Execute first tick - should find source and container
    const state = controller.execute(mockCreep);
    expect(state).toBe("harvesting");

    // Verify source and container were assigned
    expect(creepMemory.sourceId).toBe(mockSource.id);
    expect(creepMemory.containerId).toBe(mockContainer.id);
  });

  it("should transition to depositing state when full", () => {
    // Execute first tick to initialize
    controller.execute(mockCreep);

    // Make creep full
    freeCapacity = 0;
    usedCapacity = 50;

    // Execute - should transition to depositing
    const state = controller.execute(mockCreep);
    expect(state).toBe("depositing");
    expect(creepMemory.task).toBe("depositing");
  });

  it("should transfer energy to container when depositing", () => {
    // Initialize and get to depositing state
    controller.execute(mockCreep);
    freeCapacity = 0;
    usedCapacity = 50;
    controller.execute(mockCreep);

    // Execute another tick in depositing state
    freeCapacity = 0;
    usedCapacity = 50;
    controller.execute(mockCreep);

    // Verify transfer was called
    expect(mockCreep.transfer).toHaveBeenCalledWith(mockContainer, RESOURCE_ENERGY);
  });

  it("should transition back to harvesting when empty", () => {
    // Initialize
    controller.execute(mockCreep);

    // Make creep full and transition to depositing
    freeCapacity = 0;
    usedCapacity = 50;
    controller.execute(mockCreep);
    expect(creepMemory.task).toBe("depositing");

    // Make creep empty
    freeCapacity = 50;
    usedCapacity = 0;

    // Execute - should transition back to harvesting
    const state = controller.execute(mockCreep);
    expect(state).toBe("harvesting");
    expect(creepMemory.task).toBe("harvesting");
  });

  it("should handle full container by transitioning back to harvesting", () => {
    // Initialize
    controller.execute(mockCreep);

    // Make creep full and transition to depositing
    freeCapacity = 0;
    usedCapacity = 50;
    controller.execute(mockCreep);
    expect(creepMemory.task).toBe("depositing");

    // Make container full
    containerFreeCapacity = 0;

    // Execute - should transition back to harvesting (CONTAINER_FULL event)
    const state = controller.execute(mockCreep);
    expect(state).toBe("harvesting");
    expect(creepMemory.task).toBe("harvesting");
  });

  it("should continue parallel harvest/deposit when adjacent to both", () => {
    // Initialize and start harvesting
    controller.execute(mockCreep);

    // Simulate partial fill
    freeCapacity = 20;
    usedCapacity = 30;

    // Execute - should harvest and deposit opportunistically
    controller.execute(mockCreep);

    // Both harvest and transfer should have been called
    expect(mockCreep.harvest).toHaveBeenCalledWith(mockSource);
    expect(mockCreep.transfer).toHaveBeenCalledWith(mockContainer, RESOURCE_ENERGY);
  });

  it("should drop energy when no container is available", () => {
    // Remove container from mock
    (mockSource.pos.findInRange as ReturnType<typeof vi.fn>).mockReturnValue([]);
    (mockRoom.find as ReturnType<typeof vi.fn>).mockImplementation((findConstant: FindConstant) => {
      if (findConstant === FIND_SOURCES) return [mockSource];
      if (findConstant === FIND_STRUCTURES) return [];
      return [];
    });
    (Game.getObjectById as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
      if (id === mockSource.id) return mockSource;
      return null; // No container
    });

    // Initialize - no container assigned
    controller.execute(mockCreep);
    expect(creepMemory.containerId).toBeUndefined();

    // Make creep full and get to depositing state
    freeCapacity = 0;
    usedCapacity = 50;
    controller.execute(mockCreep);
    expect(creepMemory.task).toBe("depositing");

    // Execute in depositing state without container - should drop energy
    controller.execute(mockCreep);
    expect(mockCreep.drop).toHaveBeenCalledWith(RESOURCE_ENERGY);
  });

  it("should persist state machine across ticks (serialization)", () => {
    // Execute first tick
    controller.execute(mockCreep);
    expect(creepMemory.stateMachine).toBeDefined();

    // Make creep full
    freeCapacity = 0;
    usedCapacity = 50;

    // Execute second tick - should serialize depositing state
    controller.execute(mockCreep);
    expect(creepMemory.task).toBe("depositing");
    const serializedState1 = creepMemory.stateMachine;

    // Simulate tick boundary - create new controller instance (like in game loop)
    const controller2 = new StationaryHarvesterController();

    // Execute with same creep - should restore state from memory
    const state = controller2.execute(mockCreep);
    expect(state).toBe("depositing");
  });

  describe("Death Spiral Prevention", () => {
    it("should ensure energy flows from source to container", () => {
      // This test validates the core fix for #1564
      // Energy must flow: Source -> Harvester -> Container -> Spawn

      let transferCalled = false;

      // Track transfer calls
      mockCreep.transfer = vi.fn(() => {
        transferCalled = true;
        return OK;
      }) as unknown as typeof mockCreep.transfer;

      // Simulate multiple ticks of operation
      for (let tick = 0; tick < 10; tick++) {
        // Simulate harvest filling the creep
        if (tick % 3 === 0) {
          freeCapacity = 50;
          usedCapacity = 0;
        } else if (tick % 3 === 1) {
          freeCapacity = 20;
          usedCapacity = 30;
        } else {
          freeCapacity = 0;
          usedCapacity = 50;
        }

        controller.execute(mockCreep);

        // Update Game.time for cleanup logic
        (Game as Game & { time: number }).time = 1000 + tick;
      }

      // Verify transfer was called at least once - energy flowed to container
      expect(transferCalled).toBe(true);
    });

    it("should maintain continuous harvesting/depositing cycle", () => {
      const states: string[] = [];

      // Run multiple ticks simulating a harvest/deposit cycle
      for (let tick = 0; tick < 20; tick++) {
        // Cycle energy level: empty -> filling -> full -> depositing -> empty
        const cyclePhase = tick % 4;
        if (cyclePhase === 0) {
          freeCapacity = 50;
          usedCapacity = 0;
        } else if (cyclePhase === 1) {
          freeCapacity = 25;
          usedCapacity = 25;
        } else if (cyclePhase === 2) {
          freeCapacity = 0;
          usedCapacity = 50;
        } else {
          freeCapacity = 25;
          usedCapacity = 25;
        }

        const state = controller.execute(mockCreep);
        states.push(state);

        // Update Game.time
        (Game as Game & { time: number }).time = 1000 + tick;
      }

      // Verify we see both harvesting and depositing states
      expect(states).toContain("harvesting");
      expect(states).toContain("depositing");

      // Verify state changes occurred (not stuck in one state)
      const uniqueStates = [...new Set(states)];
      expect(uniqueStates.length).toBeGreaterThan(1);
    });
  });
});
