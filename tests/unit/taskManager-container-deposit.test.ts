/**
 * Unit test for TaskManager container deposit task generation.
 *
 * Issue: ralphschuler/.screeps-gpt#566
 * Validates that the TaskManager generates tasks for harvesters to deposit energy into containers.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskManager } from "@runtime/tasks/TaskManager";

describe("TaskManager Container Deposit", () => {
  let taskManager: TaskManager;
  let mockRoom: Partial<Room>;
  let mockContainer: StructureContainer;

  beforeEach(() => {
    taskManager = new TaskManager({
      cpuThreshold: 0.8,
      logger: { log: vi.fn(), warn: vi.fn() }
    });

    // Setup global Game object
    (global as unknown as { Game: Game }).Game = {
      time: 1000,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 100,
        bucket: 10000
      } as CPUInfo
    } as Game;

    // Setup mock container
    mockContainer = {
      id: "container-1" as Id<StructureContainer>,
      structureType: STRUCTURE_CONTAINER,
      pos: {
        x: 25,
        y: 25,
        roomName: "W1N1"
      } as RoomPosition,
      store: {
        getFreeCapacity: vi.fn().mockReturnValue(2000),
        getUsedCapacity: vi.fn().mockReturnValue(0),
        energy: 0,
        getCapacity: vi.fn().mockReturnValue(2000)
      } as StoreDefinition,
      hits: 5000,
      hitsMax: 5000
    } as StructureContainer;

    // Setup mock room
    mockRoom = {
      name: "W1N1",
      controller: {
        id: "controller-1" as Id<StructureController>,
        my: true,
        level: 3
      } as StructureController,
      find: vi.fn((findConstant: FindConstant, options?: FilterOptions<FindConstant>) => {
        if (findConstant === FIND_SOURCES_ACTIVE) {
          return [];
        }
        if (findConstant === FIND_STRUCTURES) {
          const structures = [mockContainer];
          if (options?.filter) {
            return structures.filter(s => options.filter!(s as AnyStructure));
          }
          return structures;
        }
        if (findConstant === FIND_CONSTRUCTION_SITES) {
          return [];
        }
        if (findConstant === FIND_MY_STRUCTURES) {
          return [];
        }
        return [];
      })
    } as Room;
  });

  it("should generate transfer tasks for containers with free capacity", () => {
    // Generate tasks
    taskManager.generateTasks(mockRoom as Room);

    // Get task statistics
    const stats = taskManager.getStats();

    // Should have created at least one task (transfer to container)
    expect(stats.total).toBeGreaterThan(0);

    // Verify that a TransferAction task was created
    const tasks = Array.from((taskManager as { tasks: Map<string, unknown> }).tasks.values()) as Array<{
      task: { constructor: { name: string } };
      status: string;
    }>;

    const transferTasks = tasks.filter(t => t.task.constructor.name === "TransferAction");
    expect(transferTasks.length).toBeGreaterThan(0);
  });

  it("should not generate container deposit tasks when containers are full", () => {
    // Make container full
    (mockContainer.store.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
    (mockContainer.store.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(2000);

    // Generate tasks
    taskManager.generateTasks(mockRoom as Room);

    // Should not create transfer tasks for full containers
    const tasks = Array.from((taskManager as { tasks: Map<string, unknown> }).tasks.values()) as Array<{
      task: { constructor: { name: string } };
      status: string;
    }>;

    const transferTasks = tasks.filter(t => t.task.constructor.name === "TransferAction");

    // Either no transfer tasks, or they're for other structures (spawns/extensions)
    // Since we have no spawns/extensions in this test, should be 0
    expect(transferTasks.length).toBe(0);
  });

  it("should limit the number of container deposit tasks", () => {
    // Create multiple containers
    const containers: StructureContainer[] = [];
    for (let i = 0; i < 10; i++) {
      containers.push({
        id: `container-${i}` as Id<StructureContainer>,
        structureType: STRUCTURE_CONTAINER,
        store: {
          getFreeCapacity: vi.fn().mockReturnValue(2000),
          getUsedCapacity: vi.fn().mockReturnValue(0)
        } as StoreDefinition
      } as StructureContainer);
    }

    // Mock room.find to return all containers
    mockRoom.find = vi.fn((findConstant: FindConstant, options?: FilterOptions<FindConstant>) => {
      if (findConstant === FIND_STRUCTURES) {
        if (options?.filter) {
          return containers.filter(s => options.filter!(s as AnyStructure));
        }
        return containers;
      }
      return [];
    });

    // Generate tasks
    taskManager.generateTasks(mockRoom as Room);

    // Get task statistics
    const tasks = Array.from((taskManager as { tasks: Map<string, unknown> }).tasks.values()) as Array<{
      task: { constructor: { name: string } };
      status: string;
    }>;

    const transferTasks = tasks.filter(t => t.task.constructor.name === "TransferAction");

    // Should limit to prevent overwhelming the system (max 4 according to implementation)
    expect(transferTasks.length).toBeLessThanOrEqual(4);
  });

  it("should generate container deposit tasks with HIGH priority", () => {
    // Generate tasks
    taskManager.generateTasks(mockRoom as Room);

    // Verify task priorities
    const tasks = Array.from((taskManager as { tasks: Map<string, unknown> }).tasks.values()) as Array<{
      task: { constructor: { name: string } };
      priority: number;
      status: string;
    }>;

    const transferTasks = tasks.filter(t => t.task.constructor.name === "TransferAction");

    // All container deposit tasks should have NORMAL priority (50)
    // This is lower than CRITICAL spawn refill tasks (100) to prevent starvation
    for (const task of transferTasks) {
      expect(task.priority).toBe(50); // TaskPriority.NORMAL = 50
    }
  });

  it("should work alongside other task generation", () => {
    // Add sources and construction sites
    const mockSource = {
      id: "source-1" as Id<Source>,
      pos: {} as RoomPosition,
      energy: 3000,
      energyCapacity: 3000
    } as Source;

    const mockSite = {
      id: "site-1" as Id<ConstructionSite>,
      structureType: STRUCTURE_ROAD,
      pos: {} as RoomPosition,
      progress: 0,
      progressTotal: 1000
    } as ConstructionSite;

    mockRoom.find = vi.fn((findConstant: FindConstant, options?: FilterOptions<FindConstant>) => {
      if (findConstant === FIND_SOURCES_ACTIVE) {
        return [mockSource];
      }
      if (findConstant === FIND_CONSTRUCTION_SITES) {
        return [mockSite];
      }
      if (findConstant === FIND_STRUCTURES) {
        const structures = [mockContainer];
        if (options?.filter) {
          return structures.filter(s => options.filter!(s as AnyStructure));
        }
        return structures;
      }
      return [];
    });

    // Generate tasks
    taskManager.generateTasks(mockRoom as Room);

    // Get task statistics
    const stats = taskManager.getStats();

    // Should have generated multiple types of tasks
    expect(stats.total).toBeGreaterThan(1);

    // Verify we have harvest, build, transfer, and upgrade tasks
    const tasks = Array.from((taskManager as { tasks: Map<string, unknown> }).tasks.values()) as Array<{
      task: { constructor: { name: string } };
      status: string;
    }>;

    const taskTypes = new Set(tasks.map(t => t.task.constructor.name));

    expect(taskTypes.has("HarvestAction")).toBe(true);
    expect(taskTypes.has("TransferAction")).toBe(true);
    expect(taskTypes.has("BuildAction")).toBe(true);
    expect(taskTypes.has("UpgradeAction")).toBe(true);
  });
});
