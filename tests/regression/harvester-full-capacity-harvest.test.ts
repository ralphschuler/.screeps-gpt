/**
 * Regression test for harvester full-capacity harvesting.
 *
 * Issue #1501, #1504: Harvesters harvest once then immediately deliver instead of filling to capacity
 *
 * Root Cause: tryPickupDroppedEnergy() was called during harvesting state, which could:
 * 1. Pick up a small amount of dropped energy
 * 2. Fill the creep to capacity (when nearly full)
 * 3. Trigger ENERGY_FULL transition prematurely
 * 4. Cause the creep to deliver after only partial harvest
 *
 * Fix: Remove tryPickupDroppedEnergy() call from harvesting state entirely.
 * Dropped energy collection should be handled by haulers, not harvesters during active harvesting.
 *
 * Expected behavior after fix:
 * - Harvesters stay in "harvesting" state until getFreeCapacity(RESOURCE_ENERGY) === 0
 * - No dropped energy pickup during harvesting
 * - Full capacity is reached through harvest actions only
 * - 50-80% improvement in energy collection efficiency
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

describe("Harvester Full Capacity Harvest (Issue #1501, #1504)", () => {
  let controller: HarvesterController;
  let mockCreep: CreepLike;
  let mockRoom: Room;
  let mockSource: Source;
  let mockDroppedEnergy: Resource;
  let creepMemory: Record<string, unknown>;
  let freeCapacity: number;

  beforeEach(() => {
    controller = new HarvesterController();
    freeCapacity = 50; // Start with empty capacity

    // Create mock source with plenty of energy
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

    // Create mock dropped energy - this should be IGNORED during harvesting
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

    // Create mock room that returns dropped energy
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
          // Always return dropped energy to test that it's ignored
          return [mockDroppedEnergy];
        }
        if (findConstant === FIND_STRUCTURES) {
          return [];
        }
        return [];
      })
    } as unknown as Room;

    // Use a separate memory object like Screeps does
    creepMemory = {
      role: "harvester",
      task: "idle",
      version: 1
    };

    // Create mock creep with getter/setter for memory
    mockCreep = {
      name: "harvester-capacity-test",
      id: "creep-capacity-1" as Id<Creep>,
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
      get memory() {
        return creepMemory as CreepMemory;
      },
      set memory(value: CreepMemory) {
        Object.assign(creepMemory, value);
      },
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
      "harvester-capacity-test": mockCreep as Creep
    };

    // Setup Game.getObjectById
    (Game.getObjectById as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
      if (id === mockSource.id) return mockSource;
      if (id === mockDroppedEnergy.id) return mockDroppedEnergy;
      return null;
    });
  });

  it("should NOT pick up dropped energy while harvesting (prevents premature transition)", () => {
    // Tick 1: idle -> harvesting
    controller.execute(mockCreep);

    // Tick 2-5: Continue harvesting with dropped energy present
    for (let i = 0; i < 4; i++) {
      freeCapacity = 50 - (i + 1) * 10; // Slowly filling up
      controller.execute(mockCreep);
    }

    // Verify pickup was NEVER called during harvesting
    expect(mockCreep.pickup).not.toHaveBeenCalled();

    // Verify harvest was called multiple times
    expect(mockCreep.harvest).toHaveBeenCalled();
    expect((mockCreep.harvest as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(4);

    // Verify still in harvesting state (not full yet)
    expect(creepMemory.task).toBe("harvesting");
  });

  it("should only transition to delivering when getFreeCapacity === 0 from harvesting", () => {
    // Tick 1: idle -> harvesting
    const state1 = controller.execute(mockCreep);
    expect(state1).toBe("harvesting");

    // Ticks 2-4: Continue harvesting, not full yet
    freeCapacity = 30;
    const state2 = controller.execute(mockCreep);
    expect(state2).toBe("harvesting");

    freeCapacity = 15;
    const state3 = controller.execute(mockCreep);
    expect(state3).toBe("harvesting");

    freeCapacity = 5;
    const state4 = controller.execute(mockCreep);
    expect(state4).toBe("harvesting");

    // Tick 5: NOW full, should transition to delivering
    freeCapacity = 0;
    const state5 = controller.execute(mockCreep);
    expect(state5).toBe("delivering");

    // Verify correct state in memory
    expect(creepMemory.task).toBe("delivering");
  });

  it("should harvest multiple times per trip (simulating 50 capacity with 2 WORK parts)", () => {
    // A creep with 2 WORK parts harvests 4 energy per tick
    // With 50 capacity, it takes ~13 ticks to fill up
    // This test verifies harvester stays in harvesting state for multiple ticks

    let harvests = 0;
    (mockCreep.harvest as ReturnType<typeof vi.fn>).mockImplementation(() => {
      harvests++;
      // Simulate energy gain from harvest (2 WORK * 2 = 4 energy/tick)
      freeCapacity = Math.max(0, freeCapacity - 4);
      return OK;
    });

    // Tick 1: idle -> harvesting
    controller.execute(mockCreep);

    // Run multiple ticks until full
    for (let i = 0; i < 15; i++) {
      controller.execute(mockCreep);
      if (freeCapacity === 0) break;
    }

    // Should have harvested multiple times
    expect(harvests).toBeGreaterThanOrEqual(10); // At least 10 harvests to fill 50 capacity @ 4/tick

    // After becoming full, the transition to delivering happens at the START of the next tick
    // (per the hauler pattern - check fullness first before any actions)
    // Run one more tick to trigger the transition
    controller.execute(mockCreep);

    // Should now be in delivering state
    expect(creepMemory.task).toBe("delivering");

    // Should never have picked up dropped energy
    expect(mockCreep.pickup).not.toHaveBeenCalled();
  });

  it("should ignore dropped energy even when it's right next to the source", () => {
    // Move dropped energy to same position as source
    mockDroppedEnergy.pos = mockSource.pos;

    // Tick 1: idle -> harvesting
    controller.execute(mockCreep);

    // Tick 2: harvesting with dropped energy at same position - should still harvest, not pickup
    freeCapacity = 40;
    controller.execute(mockCreep);

    // Verify harvest was called, pickup was not
    expect(mockCreep.harvest).toHaveBeenCalled();
    expect(mockCreep.pickup).not.toHaveBeenCalled();
    expect(creepMemory.task).toBe("harvesting");
  });
});
