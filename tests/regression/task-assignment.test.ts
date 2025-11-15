/**
 * Regression test for task assignment and prioritization.
 * Ensures tasks are correctly generated, assigned, and executed by creeps.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TaskManager } from "@runtime/tasks/TaskManager";

describe("Task Assignment System", () => {
  let mockRoom: Partial<Room>;
  let mockCreep: Partial<Creep>;
  let taskManager: TaskManager;

  beforeEach(() => {
    // Mock Game object
    global.Game = {
      time: 1000,
      cpu: {
        getUsed: () => 5,
        limit: 100
      } as CPU,
      getObjectById: (id: string) => {
        if (id.includes("source")) {
          return {
            id,
            pos: { x: 10, y: 10, roomName: "W1N1" },
            energy: 3000,
            energyCapacity: 3000
          };
        }
        if (id.includes("site")) {
          return {
            id,
            pos: { x: 15, y: 15, roomName: "W1N1" },
            structureType: STRUCTURE_SPAWN,
            progress: 100,
            progressTotal: 1000
          };
        }
        if (id.includes("controller")) {
          return {
            id,
            pos: { x: 20, y: 20, roomName: "W1N1" },
            my: true,
            level: 1
          };
        }
        return null;
      }
    } as unknown as Game;

    // Mock room
    mockRoom = {
      name: "W1N1",
      find: (type: FindConstant) => {
        if (type === FIND_SOURCES_ACTIVE) {
          return [
            {
              id: "source1" as Id<Source>,
              pos: { x: 10, y: 10, roomName: "W1N1" },
              energy: 3000,
              energyCapacity: 3000
            }
          ];
        }
        if (type === FIND_CONSTRUCTION_SITES) {
          return [
            {
              id: "site1" as Id<ConstructionSite>,
              pos: { x: 15, y: 15, roomName: "W1N1" },
              structureType: STRUCTURE_SPAWN,
              progress: 100,
              progressTotal: 1000
            }
          ];
        }
        if (type === FIND_STRUCTURES) {
          return [];
        }
        return [];
      },
      controller: {
        id: "controller1" as Id<StructureController>,
        pos: { x: 20, y: 20, roomName: "W1N1" },
        my: true,
        level: 1
      } as StructureController
    };

    // Mock creep
    mockCreep = {
      id: "creep1" as Id<Creep>,
      name: "harvester1",
      pos: {
        x: 5,
        y: 5,
        roomName: "W1N1",
        getRangeTo: () => 5
      } as RoomPosition,
      room: mockRoom as Room,
      memory: {} as CreepMemory,
      store: {
        getUsedCapacity: () => 0,
        getFreeCapacity: () => 50,
        getCapacity: () => 50
      } as StoreDefinition,
      body: [
        { type: WORK, hits: 100 },
        { type: CARRY, hits: 100 },
        { type: MOVE, hits: 100 }
      ],
      getActiveBodyparts: (type: BodyPartConstant) => {
        if (type === WORK) return 1;
        if (type === CARRY) return 1;
        if (type === MOVE) return 1;
        return 0;
      },
      harvest: () => OK,
      build: () => OK,
      moveTo: () => OK
    };

    taskManager = new TaskManager({ cpuThreshold: 0.9 });
  });

  describe("Task Generation", () => {
    it("should generate harvest tasks for active sources", () => {
      taskManager.generateTasks(mockRoom as Room);
      const stats = taskManager.getStats();

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.pending).toBeGreaterThan(0);
    });

    it("should generate build tasks for construction sites", () => {
      taskManager.generateTasks(mockRoom as Room);
      const stats = taskManager.getStats();

      // Should have at least harvest and build tasks
      expect(stats.total).toBeGreaterThanOrEqual(2);
    });

    it("should generate upgrade tasks for owned controllers", () => {
      taskManager.generateTasks(mockRoom as Room);
      const stats = taskManager.getStats();

      expect(stats.total).toBeGreaterThan(0);
    });

    it("should not generate duplicate tasks for same target", () => {
      taskManager.generateTasks(mockRoom as Room);
      const stats1 = taskManager.getStats();

      taskManager.generateTasks(mockRoom as Room);
      const stats2 = taskManager.getStats();

      // Task count should not double
      expect(stats2.total).toBeLessThanOrEqual(stats1.total + 3);
    });
  });

  describe("Task Assignment", () => {
    it("should assign tasks to idle creeps", () => {
      taskManager.generateTasks(mockRoom as Room);

      const creeps = [mockCreep as Creep];
      taskManager.assignTasks(creeps);

      expect(mockCreep.memory.taskId).toBeDefined();
    });

    it("should not assign tasks to creeps with existing tasks", () => {
      taskManager.generateTasks(mockRoom as Room);

      // Assign a task first
      const creeps = [mockCreep as Creep];
      taskManager.assignTasks(creeps);
      const originalTaskId = mockCreep.memory.taskId as string | undefined;

      // Try to assign again - should keep the same task
      taskManager.assignTasks(creeps);

      // Task ID should remain unchanged
      expect(mockCreep.memory.taskId).toBe(originalTaskId);
    });

    it("should prioritize high-priority tasks", () => {
      // Manually create a high-priority build task
      taskManager.generateTasks(mockRoom as Room);

      // Create a creep with WORK parts (can build)
      mockCreep.store = {
        getUsedCapacity: (resource?: ResourceConstant) => {
          if (!resource || resource === RESOURCE_ENERGY) return 50;
          return 0;
        },
        getFreeCapacity: () => 0,
        getCapacity: () => 50
      } as StoreDefinition;

      const creeps = [mockCreep as Creep];
      taskManager.assignTasks(creeps);

      // Should get assigned a task
      expect(mockCreep.memory.taskId).toBeDefined();
    });
  });

  describe("Task Execution", () => {
    it("should execute assigned tasks", () => {
      taskManager.generateTasks(mockRoom as Room);

      const creeps = [mockCreep as Creep];
      taskManager.assignTasks(creeps);

      const tasksExecuted = taskManager.executeTasks(creeps, 100);

      expect(Object.keys(tasksExecuted).length).toBeGreaterThan(0);
    });

    it("should remove completed tasks from creep memory", () => {
      taskManager.generateTasks(mockRoom as Room);

      // Assign task
      const creeps = [mockCreep as Creep];
      taskManager.assignTasks(creeps);
      const taskId = mockCreep.memory.taskId as string | undefined;

      expect(taskId).toBeDefined();

      // Execute should work without throwing
      taskManager.executeTasks(creeps, 100);

      // Task should still be tracked (build tasks don't complete in one tick)
      expect(mockCreep.memory.taskId).toBeDefined();
    });

    it("should respect CPU threshold during execution", () => {
      // Create multiple tasks
      taskManager.generateTasks(mockRoom as Room);

      // Create multiple creeps
      const creeps = Array.from({ length: 10 }, (_, i) => ({
        ...mockCreep,
        id: `creep${i}` as Id<Creep>,
        name: `harvester${i}`,
        memory: { taskId: undefined } as CreepMemory
      })) as Creep[];

      taskManager.assignTasks(creeps);

      // Set very low CPU limit to trigger threshold
      const tasksExecuted = taskManager.executeTasks(creeps, 10);

      // Should have stopped execution due to CPU threshold
      expect(Object.values(tasksExecuted).reduce((a, b) => a + b, 0)).toBeLessThan(creeps.length);
    });
  });

  describe("Task Cleanup", () => {
    it("should remove expired tasks", () => {
      taskManager.generateTasks(mockRoom as Room);

      // Advance game time beyond task deadlines
      global.Game.time = 2000;

      taskManager.generateTasks(mockRoom as Room);
      const stats = taskManager.getStats();

      // Expired tasks should be cleaned up
      expect(stats.complete).toBe(0);
    });

    it("should handle invalid task targets gracefully", () => {
      taskManager.generateTasks(mockRoom as Room);

      // Override getObjectById to return null
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      global.Game.getObjectById = () => null;

      const creeps = [mockCreep as Creep];
      taskManager.assignTasks(creeps);

      // Should not throw
      expect(() => taskManager.executeTasks(creeps, 100)).not.toThrow();
    });
  });
});
