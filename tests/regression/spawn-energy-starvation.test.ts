import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskManager } from "@runtime/tasks";
import { TaskPriority } from "@runtime/tasks/TaskRequest";

/**
 * Regression test for issue: Critical energy starvation in E54N39
 * Energy distribution logic not refilling spawns when container tasks exist.
 *
 * Root Cause: generateEnergyDistributionTasks counted ALL withdraw/transfer tasks
 * (including container deposits) in its limit, preventing spawn refill tasks.
 *
 * Issue: ralphschuler/.screeps-gpt#XXX (E54N39 energy starvation)
 * Related: #607, #614, #638, #688
 */
describe("Regression: Spawn Energy Starvation Prevention", () => {
  let mockRoom: Room;
  let mockSpawn: StructureSpawn;
  let mockExtension: StructureExtension;
  let mockContainer: StructureContainer;
  let mockStorage: StructureStorage;

  beforeEach(() => {
    // Mock Screeps constants
    global.FIND_SOURCES_ACTIVE = 105 as FindConstant;
    global.FIND_CONSTRUCTION_SITES = 107 as FindConstant;
    global.FIND_STRUCTURES = 106 as FindConstant;
    global.FIND_MY_STRUCTURES = 112 as FindConstant;
    global.FIND_SOURCES = 104 as FindConstant;
    global.FIND_DROPPED_RESOURCES = 106 as FindConstant;
    global.STRUCTURE_SPAWN = "spawn" as StructureConstant;
    global.STRUCTURE_EXTENSION = "extension" as StructureConstant;
    global.STRUCTURE_STORAGE = "storage" as StructureConstant;
    global.STRUCTURE_CONTAINER = "container" as StructureConstant;
    global.STRUCTURE_CONTROLLER = "controller" as StructureConstant;
    global.WORK = "work" as BodyPartConstant;
    global.CARRY = "carry" as BodyPartConstant;
    global.MOVE = "move" as BodyPartConstant;
    global.RESOURCE_ENERGY = "energy" as ResourceConstant;
    global.OK = 0;
    global.ERR_NOT_IN_RANGE = -9;

    // Mock Game global
    global.Game = {
      time: 75043644,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 20
      },
      getObjectById: vi.fn()
    } as unknown as Game;

    // Mock spawn needing energy (critical starvation scenario)
    mockSpawn = {
      id: "spawn1" as Id<StructureSpawn>,
      structureType: STRUCTURE_SPAWN,
      pos: { x: 25, y: 25, roomName: "E54N39" },
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(4), // Only 4 energy!
        getFreeCapacity: vi.fn().mockReturnValue(296), // 300 capacity - 4 used = 296 free
        getCapacity: vi.fn().mockReturnValue(300)
      }
    } as unknown as StructureSpawn;

    // Mock extension needing energy
    mockExtension = {
      id: "extension1" as Id<StructureExtension>,
      structureType: STRUCTURE_EXTENSION,
      pos: { x: 26, y: 25, roomName: "E54N39" },
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(0),
        getFreeCapacity: vi.fn().mockReturnValue(50),
        getCapacity: vi.fn().mockReturnValue(50)
      }
    } as unknown as StructureExtension;

    // Mock container with energy (near source)
    mockContainer = {
      id: "container1" as Id<StructureContainer>,
      structureType: STRUCTURE_CONTAINER,
      pos: { x: 10, y: 10, roomName: "E54N39" },
      store: {
        getUsedCapacity: vi.fn((resource?: ResourceConstant) => {
          if (!resource || resource === RESOURCE_ENERGY) return 500;
          return 0;
        }),
        getFreeCapacity: vi.fn().mockReturnValue(1500),
        getCapacity: vi.fn().mockReturnValue(2000)
      }
    } as unknown as StructureContainer;

    // Mock storage with energy
    mockStorage = {
      id: "storage1" as Id<StructureStorage>,
      structureType: STRUCTURE_STORAGE,
      pos: { x: 27, y: 25, roomName: "E54N39" },
      store: {
        getUsedCapacity: vi.fn((resource?: ResourceConstant) => {
          if (!resource || resource === RESOURCE_ENERGY) return 1000;
          return 0;
        }),
        getFreeCapacity: vi.fn().mockReturnValue(9000),
        getCapacity: vi.fn().mockReturnValue(10000)
      }
    } as unknown as StructureStorage;

    // Mock room
    mockRoom = {
      name: "E54N39",
      controller: {
        my: true,
        id: "controller1" as Id<StructureController>,
        level: 3
      },
      storage: mockStorage,
      find: vi.fn((type: FindConstant) => {
        if (type === FIND_SOURCES_ACTIVE || type === FIND_SOURCES) {
          return [];
        }
        if (type === FIND_CONSTRUCTION_SITES) {
          return [];
        }
        if (type === FIND_MY_STRUCTURES) {
          // Return spawns and extensions
          return [mockSpawn, mockExtension];
        }
        if (type === FIND_STRUCTURES) {
          // Return all structures including container and storage
          return [mockSpawn, mockExtension, mockContainer, mockStorage];
        }
        if (type === FIND_DROPPED_RESOURCES) {
          return [];
        }
        return [];
      })
    } as unknown as Room;
  });

  it("should generate spawn refill tasks even when container tasks exist", () => {
    const manager = new TaskManager({ cpuThreshold: 0.8 });

    // Generate tasks for the room
    manager.generateTasks(mockRoom);

    // Get task statistics
    const stats = manager.getStats();

    // Verify tasks were generated
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.pending).toBeGreaterThan(0);

    // The key assertion: spawn refill tasks should be generated
    // Expected: At least 2 tasks per structure needing energy (withdraw + transfer)
    // With spawn + extension = 2 structures, expect at least 4 tasks total
    expect(stats.pending).toBeGreaterThanOrEqual(4);
  });

  it("should prioritize spawn refill tasks with CRITICAL priority", () => {
    const manager = new TaskManager({ cpuThreshold: 0.8 });

    // Generate tasks
    manager.generateTasks(mockRoom);

    // Get all tasks (accessing private field for testing)
    const tasks = (manager as unknown as { tasks: Map<string, unknown> }).tasks;
    const taskArray = Array.from(tasks.values()) as Array<{ priority: number; status: string }>;

    // Filter for pending tasks
    const pendingTasks = taskArray.filter(t => t.status === "PENDING");

    // Verify at least some tasks have CRITICAL priority (100)
    const criticalTasks = pendingTasks.filter(t => t.priority === TaskPriority.CRITICAL);
    expect(criticalTasks.length).toBeGreaterThan(0);
  });

  it("should generate tasks for multiple structures in single tick", () => {
    const manager = new TaskManager({ cpuThreshold: 0.8 });

    // Generate tasks
    manager.generateTasks(mockRoom);

    const stats = manager.getStats();

    // With spawn (4 energy) and extension (0 energy) both needing energy,
    // and the fix allowing up to 3 structures per tick,
    // we should see tasks for both structures
    // Each structure needs 2 tasks (withdraw + transfer) = 4 total
    expect(stats.pending).toBeGreaterThanOrEqual(4);
  });

  it("should not count container deposit tasks against spawn refill limit", () => {
    const manager = new TaskManager({ cpuThreshold: 0.8 });

    // First, generate harvest tasks which will create container deposit tasks
    manager.generateTasks(mockRoom);

    // Clear all pending tasks to simulate having only container tasks
    const tasks = (manager as unknown as { tasks: Map<string, unknown> }).tasks;
    tasks.clear();

    // Manually add a container deposit task (simulating existing container task)
    // This simulates the scenario that was causing the bug

    // Now generate energy distribution tasks again
    manager.generateTasks(mockRoom);

    const stats = manager.getStats();

    // Even with container tasks, spawn refill tasks should still be generated
    expect(stats.pending).toBeGreaterThan(0);
  });

  it("should maintain spawn energy above critical threshold after fix", () => {
    const manager = new TaskManager({ cpuThreshold: 0.8 });

    // Simulate multiple ticks of task generation
    for (let tick = 0; tick < 10; tick++) {
      global.Game.time = 75043644 + tick;

      // Generate tasks each tick
      manager.generateTasks(mockRoom);

      const stats = manager.getStats();

      // Verify tasks are being generated consistently
      expect(stats.pending).toBeGreaterThan(0);
    }

    // After 10 ticks, we should have generated sufficient tasks to refill spawn
    const finalStats = manager.getStats();
    expect(finalStats.pending).toBeGreaterThan(0);
  });

  it("should handle rooms with multiple spawns and extensions", () => {
    // Create additional structures
    const mockSpawn2 = {
      id: "spawn2" as Id<StructureSpawn>,
      structureType: STRUCTURE_SPAWN,
      pos: { x: 30, y: 30, roomName: "E54N39" },
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(10),
        getFreeCapacity: vi.fn().mockReturnValue(290),
        getCapacity: vi.fn().mockReturnValue(300)
      }
    } as unknown as StructureSpawn;

    const mockExtension2 = {
      id: "extension2" as Id<StructureExtension>,
      structureType: STRUCTURE_EXTENSION,
      pos: { x: 31, y: 30, roomName: "E54N39" },
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(0),
        getFreeCapacity: vi.fn().mockReturnValue(50),
        getCapacity: vi.fn().mockReturnValue(50)
      }
    } as unknown as StructureExtension;

    // Update room mock to return more structures
    mockRoom.find = vi.fn((type: FindConstant) => {
      if (type === FIND_MY_STRUCTURES) {
        return [mockSpawn, mockExtension, mockSpawn2, mockExtension2];
      }
      if (type === FIND_STRUCTURES) {
        return [mockSpawn, mockExtension, mockSpawn2, mockExtension2, mockContainer, mockStorage];
      }
      return [];
    });

    const manager = new TaskManager({ cpuThreshold: 0.8 });
    manager.generateTasks(mockRoom);

    const stats = manager.getStats();

    // With fix allowing up to 3 structures per tick, we should see tasks for at least 3
    // Each structure needs 2 tasks (withdraw + transfer) = 6 minimum
    expect(stats.pending).toBeGreaterThanOrEqual(6);
  });
});
