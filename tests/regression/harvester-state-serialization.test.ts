/**
 * Regression test for harvester state machine serialization.
 *
 * Issue: Harvesters only harvest once and then continue to next step
 * Root cause: HarvesterController was returning stale state after transitions
 * - Used `currentState` variable captured before events were sent
 * - State machine transitioned correctly but return value was outdated
 *
 * Fix: Changed lines 211-213 to use `machine.getState()` instead of `currentState`
 * - Also fixed early return in tryPickupDroppedEnergy case to serialize properly
 *
 * This test validates that:
 * 1. State machine is properly serialized when picking up dropped energy
 * 2. Harvesters continue harvesting until full, not transitioning prematurely
 * 3. State transitions are preserved and returned correctly
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { HarvesterController } from "@runtime/behavior/controllers/HarvesterController";
import type { CreepLike } from "@runtime/types/GameContext";

// Mock Screeps globals
beforeEach(() => {
  (globalThis as typeof globalThis & Record<string, unknown>).WORK = "work" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).CARRY = "carry" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).MOVE = "move" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).RESOURCE_ENERGY = "energy";
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_DROPPED_RESOURCES = 106 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_SOURCES_ACTIVE = 104 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_STRUCTURES = 108 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_SPAWN = "spawn" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_EXTENSION = "extension" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_CONTAINER = "container" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_TOWER = "tower" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).OK = 0;
  (globalThis as typeof globalThis & Record<string, unknown>).ERR_NOT_IN_RANGE = -9;

  // Mock Game object
  (globalThis as typeof globalThis & Record<string, unknown>).Game = {
    creeps: {},
    getObjectById: vi.fn()
  };
});

describe("Harvester State Machine Serialization", () => {
  let controller: HarvesterController;
  let mockCreep: CreepLike;
  let mockRoom: Room;
  let mockSource: Source;
  let mockDroppedEnergy: Resource;
  let creepMemory: Record<string, unknown>;
  let freeCapacity: number;

  beforeEach(() => {
    controller = new HarvesterController();
    freeCapacity = 30;

    // Create mock source
    mockSource = {
      id: "source-1" as Id<Source>,
      pos: {
        x: 20,
        y: 20,
        roomName: "W1N1"
      } as RoomPosition,
      energy: 3000,
      energyCapacity: 3000,
      ticksToRegeneration: 300
    } as Source;

    // Create mock dropped energy
    mockDroppedEnergy = {
      id: "dropped-1" as Id<Resource>,
      resourceType: RESOURCE_ENERGY,
      amount: 100,
      pos: {
        x: 21,
        y: 21,
        roomName: "W1N1"
      } as RoomPosition
    } as Resource;

    // Create mock room
    mockRoom = {
      name: "W1N1",
      controller: {
        id: "controller-1" as Id<StructureController>,
        my: true,
        level: 3
      } as StructureController,
      find: vi.fn((findConstant: FindConstant) => {
        if (findConstant === FIND_SOURCES_ACTIVE) {
          return [mockSource];
        }
        if (findConstant === FIND_DROPPED_RESOURCES) {
          // tryPickupDroppedEnergy checks capacity first, returns empty if full
          return freeCapacity > 0 ? [mockDroppedEnergy] : [];
        }
        if (findConstant === FIND_STRUCTURES) {
          return [];
        }
        return [];
      })
    } as unknown as Room;

    // Use a separate memory object like Screeps does
    // In Screeps, creep.memory is a getter/setter that accesses Memory.creeps[creep.name]
    creepMemory = {
      role: "harvester",
      task: "idle",
      version: 1
    };

    // Create mock creep with getter/setter for memory to avoid circular reference
    mockCreep = {
      name: "harvester-test-1",
      id: "creep-1" as Id<Creep>,
      pos: {
        x: 20,
        y: 20,
        roomName: "W1N1",
        findClosestByPath: vi.fn((targets: unknown[]) => {
          return Array.isArray(targets) && targets.length > 0 ? targets[0] : null;
        }),
        findClosestByRange: vi.fn((targets: unknown[]) => {
          return Array.isArray(targets) && targets.length > 0 ? targets[0] : null;
        }),
        inRangeTo: vi.fn().mockReturnValue(true)
      } as unknown as RoomPosition,
      get memory() { return creepMemory as CreepMemory; },
      set memory(value: CreepMemory) { Object.assign(creepMemory, value); },
      store: {
        getFreeCapacity: vi.fn(() => freeCapacity),
        getUsedCapacity: vi.fn(() => 50 - freeCapacity),
        getCapacity: vi.fn().mockReturnValue(50)
      } as unknown as StoreDefinition,
      harvest: vi.fn().mockReturnValue(OK),
      transfer: vi.fn().mockReturnValue(OK),
      moveTo: vi.fn().mockReturnValue(OK),
      upgradeController: vi.fn().mockReturnValue(OK),
      pickup: vi.fn().mockReturnValue(OK),
      room: mockRoom
    } as unknown as CreepLike;

    // Setup Game.creeps
    (Game as typeof Game & { creeps: Record<string, Creep> }).creeps = {
      "harvester-test-1": mockCreep as Creep
    };

    // Setup Game.getObjectById
    (Game.getObjectById as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
      if (id === mockSource.id) return mockSource;
      if (id === mockDroppedEnergy.id) return mockDroppedEnergy;
      return null;
    });
  });

  it("should serialize state machine when picking up dropped energy and not full", () => {
    // Execute first tick - should find source and transition to harvesting
    const state1 = controller.execute(mockCreep);
    expect(state1).toBe("harvesting");

    // Verify stateMachine was saved to memory
    expect(creepMemory.stateMachine).toBeDefined();
    expect(creepMemory.task).toBe("harvesting");

    // Execute second tick - should pick up dropped energy but stay in harvesting
    const state2 = controller.execute(mockCreep);
    expect(state2).toBe("harvesting");

    // Verify pickup was attempted (dropped energy was present)
    expect(mockCreep.pickup).toHaveBeenCalled();

    // Verify state machine was serialized (key fix verification)
    expect(creepMemory.stateMachine).toBeDefined();
    expect(creepMemory.task).toBe("harvesting");
  });

  it("should transition to delivering when full after harvest and return correct state", () => {
    // First tick: idle -> harvesting
    controller.execute(mockCreep);

    // Second tick: harvest while not full
    controller.execute(mockCreep);

    // Third tick: creep becomes full
    freeCapacity = 0;

    const state = controller.execute(mockCreep);

    // Should transition to delivering since full and return the NEW state
    expect(state).toBe("delivering");

    // Verify state machine was serialized with new state
    expect(creepMemory.task).toBe("delivering");
  });

  it("should continue harvesting until full across multiple ticks", () => {
    // Tick 1: idle -> harvesting
    const state1 = controller.execute(mockCreep);
    expect(state1).toBe("harvesting");

    // Tick 2: harvesting with dropped energy pickup
    controller.execute(mockCreep);

    // Tick 3: not full, continue harvesting (no dropped energy this time)
    (mockRoom.find as ReturnType<typeof vi.fn>).mockImplementation((findConstant: FindConstant) => {
      if (findConstant === FIND_SOURCES_ACTIVE) return [mockSource];
      if (findConstant === FIND_DROPPED_RESOURCES) return []; // No dropped energy
      if (findConstant === FIND_STRUCTURES) return [];
      return [];
    });

    freeCapacity = 20;
    const state3 = controller.execute(mockCreep);
    expect(state3).toBe("harvesting");
    expect(mockCreep.harvest).toHaveBeenCalledWith(mockSource);

    // Tick 4: still not full, continue harvesting
    freeCapacity = 10;
    const state4 = controller.execute(mockCreep);
    expect(state4).toBe("harvesting");

    // Tick 5: now full, should transition to delivering
    freeCapacity = 0;
    const state5 = controller.execute(mockCreep);
    expect(state5).toBe("delivering");

    // Verify memory task updated
    expect(creepMemory.task).toBe("delivering");
  });

  it("should not prematurely transition after single harvest", () => {
    // This tests the exact bug: creep should NOT transition after one harvest

    // Tick 1: idle -> harvesting
    controller.execute(mockCreep);

    // Tick 2: harvest once, still have capacity
    (mockRoom.find as ReturnType<typeof vi.fn>).mockImplementation((findConstant: FindConstant) => {
      if (findConstant === FIND_SOURCES_ACTIVE) return [mockSource];
      if (findConstant === FIND_DROPPED_RESOURCES) return [];
      if (findConstant === FIND_STRUCTURES) return [];
      return [];
    });

    freeCapacity = 40;
    const state2 = controller.execute(mockCreep);

    // Should still be harvesting, NOT delivering or idle
    expect(state2).toBe("harvesting");

    // Tick 3: another harvest, still have capacity
    freeCapacity = 30;
    const state3 = controller.execute(mockCreep);
    expect(state3).toBe("harvesting");

    // Verify creep stays in harvesting state, not transitioning prematurely
    expect(creepMemory.task).toBe("harvesting");
  });
});
