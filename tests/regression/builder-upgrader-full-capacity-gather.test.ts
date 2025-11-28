/**
 * Regression test for builder and upgrader full-capacity gathering.
 *
 * Issue #1501, #1504: Builders and upgraders were gathering energy once then immediately
 * transitioning to build/upgrade instead of filling to capacity.
 *
 * Root Cause: tryPickupDroppedEnergy() was called during gather/recharge states, which could:
 * 1. Pick up a small amount of dropped energy
 * 2. Trigger early return from gather logic
 * 3. Result in creeps transitioning to work state before filling to capacity
 *
 * Fix: Remove tryPickupDroppedEnergy() call from gather/recharge states entirely.
 * Dropped energy collection should be handled by haulers, not builders/upgraders.
 *
 * Expected behavior after fix:
 * - Builders/Upgraders stay in "gather"/"recharge" state until getFreeCapacity === 0
 * - No dropped energy pickup during gather/recharge
 * - Full capacity is reached through withdraw/harvest actions only
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { BuilderController } from "@runtime/behavior/controllers/BuilderController";
import { UpgraderController } from "@runtime/behavior/controllers/UpgraderController";
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
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_MY_STRUCTURES = 109 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_CONSTRUCTION_SITES = 111 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_SPAWN = "spawn" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_EXTENSION = "extension" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_CONTAINER = "container" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_TOWER = "tower" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_STORAGE = "storage" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_ROAD = "road" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_RAMPART = "rampart" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_WALL = "constructedWall" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).OK = 0;
  (globalThis as typeof globalThis & Record<string, unknown>).ERR_NOT_IN_RANGE = -9;

  // Mock Game object
  (globalThis as typeof globalThis & Record<string, unknown>).Game = {
    creeps: {},
    getObjectById: vi.fn(),
    time: 1000
  };

  // Mock Memory object for defensive posture check
  (globalThis as typeof globalThis & Record<string, unknown>).Memory = {
    defense: { posture: {} }
  };
});

describe("Builder Full Capacity Gather (Issue #1501, #1504)", () => {
  let controller: BuilderController;
  let mockCreep: CreepLike;
  let mockRoom: Room;
  let mockSource: Source;
  let mockDroppedEnergy: Resource;
  let creepMemory: Record<string, unknown>;
  let freeCapacity: number;

  beforeEach(() => {
    controller = new BuilderController();
    freeCapacity = 50; // Start with empty capacity

    // Create mock source
    mockSource = {
      id: "source-1" as Id<Source>,
      pos: { x: 20, y: 20, roomName: "W1N1" } as RoomPosition,
      energy: 3000,
      energyCapacity: 3000,
      ticksToRegeneration: 300
    } as Source;

    // Create mock dropped energy - this should be IGNORED during gather
    mockDroppedEnergy = {
      id: "dropped-1" as Id<Resource>,
      resourceType: RESOURCE_ENERGY,
      amount: 100,
      pos: { x: 21, y: 21, roomName: "W1N1" } as RoomPosition
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
        if (findConstant === FIND_SOURCES_ACTIVE) return [mockSource];
        if (findConstant === FIND_DROPPED_RESOURCES) return [mockDroppedEnergy];
        if (findConstant === FIND_STRUCTURES) return []; // No containers/storage
        if (findConstant === FIND_MY_STRUCTURES) return []; // No spawns needing energy
        if (findConstant === FIND_CONSTRUCTION_SITES) return []; // No construction sites
        return [];
      })
    } as unknown as Room;

    creepMemory = { role: "builder", task: "gather", version: 1 };

    mockCreep = {
      name: "builder-capacity-test",
      id: "creep-builder-1" as Id<Creep>,
      pos: {
        x: 20,
        y: 20,
        roomName: "W1N1",
        findClosestByPath: vi.fn((targets: unknown[]) => targets[0] ?? null),
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
      withdraw: vi.fn().mockReturnValue(OK),
      transfer: vi.fn().mockReturnValue(OK),
      build: vi.fn().mockReturnValue(OK),
      repair: vi.fn().mockReturnValue(OK),
      moveTo: vi.fn().mockReturnValue(OK),
      upgradeController: vi.fn().mockReturnValue(OK),
      pickup: vi.fn().mockReturnValue(OK),
      room: mockRoom
    } as unknown as CreepLike;

    (Game as typeof Game & { creeps: Record<string, Creep> }).creeps = {
      "builder-capacity-test": mockCreep as Creep
    };

    (Game.getObjectById as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
      if (id === mockSource.id) return mockSource;
      if (id === mockDroppedEnergy.id) return mockDroppedEnergy;
      return null;
    });
  });

  it("should NOT pick up dropped energy while gathering (prevents premature transition)", () => {
    // Execute multiple ticks in gather state
    for (let i = 0; i < 5; i++) {
      freeCapacity = 50 - i * 10;
      controller.execute(mockCreep);
    }

    // Verify pickup was NEVER called during gathering
    expect(mockCreep.pickup).not.toHaveBeenCalled();

    // Verify harvest was called (since no containers/storage)
    expect(mockCreep.harvest).toHaveBeenCalled();

    // Verify still in gather state (not full yet)
    expect(creepMemory.task).toBe("gather");
  });

  it("should only transition to build when getFreeCapacity === 0", () => {
    // Multiple ticks gathering, not full
    freeCapacity = 30;
    controller.execute(mockCreep);
    expect(creepMemory.task).toBe("gather");

    freeCapacity = 10;
    controller.execute(mockCreep);
    expect(creepMemory.task).toBe("gather");

    // NOW full, should transition to build
    freeCapacity = 0;
    controller.execute(mockCreep);
    expect(creepMemory.task).toBe("build");
  });
});

describe("Upgrader Full Capacity Recharge (Issue #1501, #1504)", () => {
  let controller: UpgraderController;
  let mockCreep: CreepLike;
  let mockRoom: Room;
  let mockSource: Source;
  let mockDroppedEnergy: Resource;
  let creepMemory: Record<string, unknown>;
  let freeCapacity: number;

  beforeEach(() => {
    controller = new UpgraderController();
    freeCapacity = 50;

    mockSource = {
      id: "source-1" as Id<Source>,
      pos: { x: 20, y: 20, roomName: "W1N1" } as RoomPosition,
      energy: 3000,
      energyCapacity: 3000,
      ticksToRegeneration: 300
    } as Source;

    mockDroppedEnergy = {
      id: "dropped-1" as Id<Resource>,
      resourceType: RESOURCE_ENERGY,
      amount: 100,
      pos: { x: 21, y: 21, roomName: "W1N1" } as RoomPosition
    } as Resource;

    mockRoom = {
      name: "W1N1",
      controller: {
        id: "controller-1" as Id<StructureController>,
        my: true,
        level: 3
      } as StructureController,
      find: vi.fn((findConstant: FindConstant) => {
        if (findConstant === FIND_SOURCES_ACTIVE) return [mockSource];
        if (findConstant === FIND_DROPPED_RESOURCES) return [mockDroppedEnergy];
        if (findConstant === FIND_STRUCTURES) return [];
        if (findConstant === FIND_MY_STRUCTURES) return [];
        return [];
      })
    } as unknown as Room;

    creepMemory = { role: "upgrader", task: "recharge", version: 1 };

    mockCreep = {
      name: "upgrader-capacity-test",
      id: "creep-upgrader-1" as Id<Creep>,
      pos: {
        x: 20,
        y: 20,
        roomName: "W1N1",
        findClosestByPath: vi.fn((targets: unknown[]) => targets[0] ?? null),
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
      withdraw: vi.fn().mockReturnValue(OK),
      transfer: vi.fn().mockReturnValue(OK),
      moveTo: vi.fn().mockReturnValue(OK),
      upgradeController: vi.fn().mockReturnValue(OK),
      pickup: vi.fn().mockReturnValue(OK),
      room: mockRoom
    } as unknown as CreepLike;

    (Game as typeof Game & { creeps: Record<string, Creep> }).creeps = {
      "upgrader-capacity-test": mockCreep as Creep
    };

    (Game.getObjectById as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
      if (id === mockSource.id) return mockSource;
      if (id === mockDroppedEnergy.id) return mockDroppedEnergy;
      return null;
    });
  });

  it("should NOT pick up dropped energy while recharging (prevents premature transition)", () => {
    for (let i = 0; i < 5; i++) {
      freeCapacity = 50 - i * 10;
      controller.execute(mockCreep);
    }

    expect(mockCreep.pickup).not.toHaveBeenCalled();
    expect(mockCreep.harvest).toHaveBeenCalled();
    expect(creepMemory.task).toBe("recharge");
  });

  it("should only transition to upgrading when getFreeCapacity === 0", () => {
    freeCapacity = 30;
    controller.execute(mockCreep);
    expect(creepMemory.task).toBe("recharge");

    freeCapacity = 10;
    controller.execute(mockCreep);
    expect(creepMemory.task).toBe("recharge");

    // NOW full
    freeCapacity = 0;
    controller.execute(mockCreep);
    expect(creepMemory.task).toBe("upgrading");
  });
});
