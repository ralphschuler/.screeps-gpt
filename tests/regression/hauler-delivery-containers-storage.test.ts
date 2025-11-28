/**
 * Regression test for hauler delivery to containers and storage.
 *
 * Issue: ralphschuler/.screeps-gpt#1533 - Haulers pickup energy but don't deliver it.
 *
 * Root Cause: Hauler delivery priority logic only targeted spawn-adjacent containers
 * and storage via room.storage property. When all spawns/extensions/towers were full,
 * haulers would fall back to upgrading the controller instead of delivering to:
 * 1. Storage (via FIND_STRUCTURES fallback when room.storage is undefined)
 * 2. Any container with free capacity
 *
 * This test validates that haulers deliver energy to containers and storage
 * when spawns/extensions/towers are already full.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { HaulerController } from "@runtime/behavior/controllers/HaulerController";
import { serviceRegistry } from "@runtime/behavior/controllers/ServiceLocator";
import { EnergyPriorityManager } from "@runtime/energy";
import type { CreepLike } from "@runtime/types/GameContext";

describe("Hauler Delivery to Containers and Storage", () => {
  let haulerController: HaulerController;
  let mockCreep: CreepLike;
  let mockRoom: Room;

  beforeEach(() => {
    // Initialize the hauler controller
    haulerController = new HaulerController();

    // Register energy priority manager in service locator
    const energyManager = new EnergyPriorityManager({}, { log: vi.fn(), warn: vi.fn() });
    serviceRegistry.setEnergyPriorityManager(energyManager);

    // Mock room with full spawns, extensions, towers
    mockRoom = {
      name: "W1N1",
      controller: {
        my: true,
        level: 5,
        id: "controller-1" as Id<StructureController>
      } as StructureController,
      storage: null, // No room.storage property to test FIND_STRUCTURES fallback
      find: vi.fn()
    } as unknown as Room;
  });

  it("should deliver energy to storage when spawns/extensions/towers are full", () => {
    // Mock storage with free capacity
    const mockStorage = {
      id: "storage-1" as Id<StructureStorage>,
      structureType: STRUCTURE_STORAGE,
      pos: { x: 25, y: 25, roomName: "W1N1" } as RoomPosition,
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(5000),
        getFreeCapacity: vi.fn().mockReturnValue(45000),
        getCapacity: vi.fn().mockReturnValue(50000)
      }
    } as unknown as StructureStorage;

    // Mock room.find to return full spawns/extensions/towers and empty storage
    (mockRoom.find as ReturnType<typeof vi.fn>).mockImplementation((findConstant: FindConstant, options?: unknown) => {
      if (findConstant === FIND_STRUCTURES) {
        const filter = (options as { filter?: (s: AnyStructure) => boolean })?.filter;
        if (filter) {
          // Test if filter matches storage type
          if (filter(mockStorage as unknown as AnyStructure)) {
            return [mockStorage];
          }
        }
        // All other FIND_STRUCTURES calls return empty (spawns/extensions/towers are full)
        return [];
      }
      if (findConstant === FIND_DROPPED_RESOURCES) {
        return [];
      }
      if (findConstant === FIND_MY_SPAWNS) {
        return [];
      }
      return [];
    });

    // Create mock hauler that is full of energy
    // The state machine will be put in "deliver" state via serialized memory
    const mockCreepStore = {
      getFreeCapacity: vi.fn().mockReturnValue(0), // Full
      getUsedCapacity: vi.fn().mockReturnValue(200)
    };

    // Create a serialized state machine in "deliver" state
    const serializedMachine = {
      state: "deliver",
      context: {
        creep: null // Will be updated by controller
      }
    };

    mockCreep = {
      name: "hauler-test-1",
      memory: {
        role: "hauler",
        task: "deliver",
        version: 1,
        stateMachine: serializedMachine
      } as CreepMemory,
      store: mockCreepStore,
      pos: {
        x: 20,
        y: 20,
        roomName: "W1N1",
        findClosestByPath: vi.fn().mockReturnValue(mockStorage)
      } as unknown as RoomPosition,
      room: mockRoom,
      transfer: vi.fn().mockReturnValue(OK),
      moveTo: vi.fn().mockReturnValue(OK),
      pickup: vi.fn().mockReturnValue(OK),
      withdraw: vi.fn().mockReturnValue(OK),
      upgradeController: vi.fn().mockReturnValue(ERR_NOT_IN_RANGE)
    } as unknown as CreepLike;

    // Execute hauler behavior
    const result = haulerController.execute(mockCreep);

    // Hauler should have transferred to storage
    expect(mockCreep.transfer).toHaveBeenCalledWith(mockStorage, RESOURCE_ENERGY);
    expect(result).toBe("deliver");

    // Should NOT have fallen back to upgrading controller
    expect(mockCreep.upgradeController).not.toHaveBeenCalled();
  });

  it("should deliver energy to containers when spawns/extensions/towers/storage are full", () => {
    // Mock container with free capacity
    const mockContainer = {
      id: "container-1" as Id<StructureContainer>,
      structureType: STRUCTURE_CONTAINER,
      pos: { x: 30, y: 30, roomName: "W1N1" } as RoomPosition,
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(500),
        getFreeCapacity: vi.fn().mockReturnValue(1500),
        getCapacity: vi.fn().mockReturnValue(2000)
      }
    } as unknown as StructureContainer;

    // Mock room.find to return full spawns/extensions/towers/storage
    (mockRoom.find as ReturnType<typeof vi.fn>).mockImplementation((findConstant: FindConstant, options?: unknown) => {
      if (findConstant === FIND_STRUCTURES) {
        const filter = (options as { filter?: (s: AnyStructure) => boolean })?.filter;
        if (filter) {
          // Test if filter matches container type
          if (filter(mockContainer as unknown as AnyStructure)) {
            return [mockContainer];
          }
        }
        // All other FIND_STRUCTURES calls return empty (spawns/extensions/towers/storage are full)
        return [];
      }
      if (findConstant === FIND_DROPPED_RESOURCES) {
        return [];
      }
      if (findConstant === FIND_MY_SPAWNS) {
        return [];
      }
      return [];
    });

    // Create mock hauler that is full of energy
    const mockCreepStore = {
      getFreeCapacity: vi.fn().mockReturnValue(0), // Full
      getUsedCapacity: vi.fn().mockReturnValue(200)
    };

    // Create a serialized state machine in "deliver" state
    const serializedMachine = {
      state: "deliver",
      context: {
        creep: null // Will be updated by controller
      }
    };

    mockCreep = {
      name: "hauler-test-2",
      memory: {
        role: "hauler",
        task: "deliver",
        version: 1,
        stateMachine: serializedMachine
      } as CreepMemory,
      store: mockCreepStore,
      pos: {
        x: 20,
        y: 20,
        roomName: "W1N1",
        findClosestByPath: vi.fn().mockReturnValue(mockContainer)
      } as unknown as RoomPosition,
      room: mockRoom,
      transfer: vi.fn().mockReturnValue(OK),
      moveTo: vi.fn().mockReturnValue(OK),
      pickup: vi.fn().mockReturnValue(OK),
      withdraw: vi.fn().mockReturnValue(OK),
      upgradeController: vi.fn().mockReturnValue(ERR_NOT_IN_RANGE)
    } as unknown as CreepLike;

    // Execute hauler behavior
    const result = haulerController.execute(mockCreep);

    // Hauler should have transferred to container
    expect(mockCreep.transfer).toHaveBeenCalledWith(mockContainer, RESOURCE_ENERGY);
    expect(result).toBe("deliver");

    // Should NOT have fallen back to upgrading controller
    expect(mockCreep.upgradeController).not.toHaveBeenCalled();
  });

  it("should fall back to upgrading controller only when no delivery targets exist", () => {
    // Mock room.find to return nothing (no spawns, extensions, towers, storage, or containers)
    (mockRoom.find as ReturnType<typeof vi.fn>).mockImplementation(() => {
      return [];
    });

    // Create mock hauler that is full of energy
    const mockCreepStore = {
      getFreeCapacity: vi.fn().mockReturnValue(0), // Full
      getUsedCapacity: vi.fn().mockReturnValue(200)
    };

    // Create a serialized state machine in "deliver" state
    const serializedMachine = {
      state: "deliver",
      context: {
        creep: null // Will be updated by controller
      }
    };

    mockCreep = {
      name: "hauler-test-3",
      memory: {
        role: "hauler",
        task: "deliver",
        version: 1,
        stateMachine: serializedMachine
      } as CreepMemory,
      store: mockCreepStore,
      pos: {
        x: 20,
        y: 20,
        roomName: "W1N1",
        findClosestByPath: vi.fn().mockReturnValue(null)
      } as unknown as RoomPosition,
      room: mockRoom,
      transfer: vi.fn().mockReturnValue(ERR_INVALID_TARGET),
      moveTo: vi.fn().mockReturnValue(OK),
      pickup: vi.fn().mockReturnValue(OK),
      withdraw: vi.fn().mockReturnValue(OK),
      upgradeController: vi.fn().mockReturnValue(OK)
    } as unknown as CreepLike;

    // Execute hauler behavior
    haulerController.execute(mockCreep);

    // Hauler should have fallen back to upgrading controller
    expect(mockCreep.upgradeController).toHaveBeenCalledWith(mockRoom.controller);
  });
});
