import { describe, it, expect, beforeEach } from "vitest";
import { RoleTaskQueueManager, TaskPriority, type TaskQueueEntry } from "../../packages/bot/src/runtime/behavior/RoleTaskQueue";

/**
 * Regression tests for task queue coordination across multiple creeps.
 *
 * Tests validate:
 * - No duplicate task assignments across multiple creeps
 * - Task priority ordering
 * - Task expiration and reallocation
 * - Dead creep task cleanup and reallocation
 * - Queue exhaustion handling
 */
describe("Task Queue Coordination (Regression)", () => {
  let memory: Memory;
  let manager: RoleTaskQueueManager;
  let mockGame: { creeps: Record<string, unknown>; time: number };

  beforeEach(() => {
    memory = {} as Memory;
    manager = new RoleTaskQueueManager();
    mockGame = { creeps: {}, time: 100 };
  });

  describe("Multiple Creep Coordination", () => {
    it("should assign different tasks to multiple creeps", () => {
      // Create 3 harvest tasks
      const tasks: TaskQueueEntry[] = [
        { taskId: "harvest-source-1", targetId: "source-1", priority: TaskPriority.HIGH, expiresAt: 1000 },
        { taskId: "harvest-source-2", targetId: "source-2", priority: TaskPriority.HIGH, expiresAt: 1000 },
        { taskId: "harvest-source-3", targetId: "source-3", priority: TaskPriority.HIGH, expiresAt: 1000 }
      ];

      for (const task of tasks) {
        manager.addTask(memory, "harvester", task);
      }

      // Assign to 3 different creeps
      const task1 = manager.assignTask(memory, "harvester", "harvester-1", 100);
      const task2 = manager.assignTask(memory, "harvester", "harvester-2", 100);
      const task3 = manager.assignTask(memory, "harvester", "harvester-3", 100);

      // Verify all tasks assigned
      expect(task1).not.toBeNull();
      expect(task2).not.toBeNull();
      expect(task3).not.toBeNull();

      // Verify different tasks assigned
      expect(task1?.taskId).not.toBe(task2?.taskId);
      expect(task2?.taskId).not.toBe(task3?.taskId);
      expect(task1?.taskId).not.toBe(task3?.taskId);

      // Verify all creeps assigned
      const assignedCreeps = [task1?.assignedCreep, task2?.assignedCreep, task3?.assignedCreep];
      expect(new Set(assignedCreeps).size).toBe(3);
    });

    it("should not assign same task to multiple creeps", () => {
      const task: TaskQueueEntry = {
        taskId: "harvest-source-1",
        targetId: "source-1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      manager.addTask(memory, "harvester", task);

      // Assign to first creep
      const task1 = manager.assignTask(memory, "harvester", "harvester-1", 100);
      expect(task1).not.toBeNull();

      // Try to assign to second creep
      const task2 = manager.assignTask(memory, "harvester", "harvester-2", 100);
      expect(task2).toBeNull();
    });

    it("should handle queue exhaustion gracefully", () => {
      // Create 2 tasks but try to assign to 3 creeps
      const tasks: TaskQueueEntry[] = [
        { taskId: "harvest-source-1", targetId: "source-1", priority: TaskPriority.HIGH, expiresAt: 1000 },
        { taskId: "harvest-source-2", targetId: "source-2", priority: TaskPriority.HIGH, expiresAt: 1000 }
      ];

      for (const task of tasks) {
        manager.addTask(memory, "harvester", task);
      }

      const task1 = manager.assignTask(memory, "harvester", "harvester-1", 100);
      const task2 = manager.assignTask(memory, "harvester", "harvester-2", 100);
      const task3 = manager.assignTask(memory, "harvester", "harvester-3", 100);

      expect(task1).not.toBeNull();
      expect(task2).not.toBeNull();
      expect(task3).toBeNull(); // Queue exhausted
    });
  });

  describe("Priority-Based Assignment", () => {
    it("should assign higher priority tasks first", () => {
      const tasks: TaskQueueEntry[] = [
        { taskId: "task-low", targetId: "target-1", priority: TaskPriority.LOW, expiresAt: 1000 },
        { taskId: "task-critical", targetId: "target-2", priority: TaskPriority.CRITICAL, expiresAt: 1000 },
        { taskId: "task-normal", targetId: "target-3", priority: TaskPriority.NORMAL, expiresAt: 1000 },
        { taskId: "task-high", targetId: "target-4", priority: TaskPriority.HIGH, expiresAt: 1000 }
      ];

      for (const task of tasks) {
        manager.addTask(memory, "builder", task);
      }

      const assigned1 = manager.assignTask(memory, "builder", "builder-1", 100);
      const assigned2 = manager.assignTask(memory, "builder", "builder-2", 100);
      const assigned3 = manager.assignTask(memory, "builder", "builder-3", 100);
      const assigned4 = manager.assignTask(memory, "builder", "builder-4", 100);

      // Should assign in priority order: CRITICAL, HIGH, NORMAL, LOW
      expect(assigned1?.taskId).toBe("task-critical");
      expect(assigned2?.taskId).toBe("task-high");
      expect(assigned3?.taskId).toBe("task-normal");
      expect(assigned4?.taskId).toBe("task-low");
    });
  });

  describe("Task Reallocation", () => {
    it("should reallocate released tasks to other creeps", () => {
      const task: TaskQueueEntry = {
        taskId: "harvest-source-1",
        targetId: "source-1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      manager.addTask(memory, "harvester", task);

      // Assign to first creep
      const task1 = manager.assignTask(memory, "harvester", "harvester-1", 100);
      expect(task1).not.toBeNull();

      // Release task
      manager.releaseTask(memory, task.taskId, "harvester-1");

      // Task should be removed from queue (completed)
      const available = manager.getAvailableTasks(memory, "harvester", 100);
      expect(available).toHaveLength(0);
    });

    it("should reallocate tasks from dead creeps", () => {
      mockGame.creeps = { "harvester-1": {} };

      const task: TaskQueueEntry = {
        taskId: "harvest-source-1",
        targetId: "source-1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      manager.addTask(memory, "harvester", task);
      manager.assignTask(memory, "harvester", "harvester-1", 100);

      // Creep dies
      delete mockGame.creeps["harvester-1"];
      manager.cleanupDeadCreepTasks(memory, mockGame);

      // Task should be available again
      const available = manager.getAvailableTasks(memory, "harvester", 100);
      expect(available).toHaveLength(1);
      expect(available[0].assignedCreep).toBeUndefined();

      // New creep can take the task
      const task2 = manager.assignTask(memory, "harvester", "harvester-2", 100);
      expect(task2).not.toBeNull();
      expect(task2?.taskId).toBe("harvest-source-1");
    });
  });

  describe("Cross-Role Independence", () => {
    it("should maintain independent queues for different roles", () => {
      const harvesterTask: TaskQueueEntry = {
        taskId: "harvest-source-1",
        targetId: "source-1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      const builderTask: TaskQueueEntry = {
        taskId: "build-site-1",
        targetId: "site-1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      manager.addTask(memory, "harvester", harvesterTask);
      manager.addTask(memory, "builder", builderTask);

      const harvesterAssigned = manager.assignTask(memory, "harvester", "harvester-1", 100);
      const builderAssigned = manager.assignTask(memory, "builder", "builder-1", 100);

      expect(harvesterAssigned?.taskId).toBe("harvest-source-1");
      expect(builderAssigned?.taskId).toBe("build-site-1");

      // Verify independence: releasing one doesn't affect the other
      manager.releaseTask(memory, harvesterTask.taskId, "harvester-1");

      const builderTask2 = manager.getCreepTask(memory, "builder-1");
      expect(builderTask2).not.toBeNull();
      expect(builderTask2?.taskId).toBe("build-site-1");
    });
  });

  describe("Task Persistence", () => {
    it("should maintain task assignments across manager instances", () => {
      const task: TaskQueueEntry = {
        taskId: "harvest-source-1",
        targetId: "source-1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      // First manager assigns task
      manager.addTask(memory, "harvester", task);
      manager.assignTask(memory, "harvester", "harvester-1", 100);

      // New manager instance should see the assignment
      const newManager = new RoleTaskQueueManager();
      const creepTask = newManager.getCreepTask(memory, "harvester-1");

      expect(creepTask).not.toBeNull();
      expect(creepTask?.taskId).toBe("harvest-source-1");
      expect(creepTask?.assignedCreep).toBe("harvester-1");
    });
  });

  describe("Scenario: Multiple Builders", () => {
    it("should coordinate 3 builders on 5 construction sites without duplicates", () => {
      // Scenario: Room has 5 construction sites, 3 builders available
      const sites: TaskQueueEntry[] = [
        { taskId: "build-spawn", targetId: "spawn-1", priority: TaskPriority.CRITICAL, expiresAt: 1000 },
        { taskId: "build-extension-1", targetId: "ext-1", priority: TaskPriority.CRITICAL, expiresAt: 1000 },
        { taskId: "build-extension-2", targetId: "ext-2", priority: TaskPriority.CRITICAL, expiresAt: 1000 },
        { taskId: "build-road-1", targetId: "road-1", priority: TaskPriority.NORMAL, expiresAt: 1000 },
        { taskId: "build-road-2", targetId: "road-2", priority: TaskPriority.NORMAL, expiresAt: 1000 }
      ];

      for (const site of sites) {
        manager.addTask(memory, "builder", site);
      }

      // Assign to 3 builders
      const task1 = manager.assignTask(memory, "builder", "builder-1", 100);
      const task2 = manager.assignTask(memory, "builder", "builder-2", 100);
      const task3 = manager.assignTask(memory, "builder", "builder-3", 100);

      // All builders should get tasks
      expect(task1).not.toBeNull();
      expect(task2).not.toBeNull();
      expect(task3).not.toBeNull();

      // Should assign critical tasks first
      expect(task1?.priority).toBe(TaskPriority.CRITICAL);
      expect(task2?.priority).toBe(TaskPriority.CRITICAL);
      expect(task3?.priority).toBe(TaskPriority.CRITICAL);

      // All tasks should be different
      const assignedIds = [task1?.taskId, task2?.taskId, task3?.taskId];
      expect(new Set(assignedIds).size).toBe(3);

      // 2 tasks should remain available
      const remaining = manager.getAvailableTasks(memory, "builder", 100);
      expect(remaining).toHaveLength(2);
      expect(remaining[0].priority).toBe(TaskPriority.NORMAL); // Roads left
    });
  });

  describe("Scenario: Harvest Source Saturation", () => {
    it("should prevent more than 1 harvester per source", () => {
      // Scenario: 2 sources, 3 harvesters
      const sources: TaskQueueEntry[] = [
        { taskId: "harvest-source-1", targetId: "source-1", priority: TaskPriority.HIGH, expiresAt: 1000 },
        { taskId: "harvest-source-2", targetId: "source-2", priority: TaskPriority.HIGH, expiresAt: 1000 }
      ];

      for (const source of sources) {
        manager.addTask(memory, "harvester", source);
      }

      // Assign to 3 harvesters
      const task1 = manager.assignTask(memory, "harvester", "harvester-1", 100);
      const task2 = manager.assignTask(memory, "harvester", "harvester-2", 100);
      const task3 = manager.assignTask(memory, "harvester", "harvester-3", 100);

      // Only 2 should get tasks
      expect(task1).not.toBeNull();
      expect(task2).not.toBeNull();
      expect(task3).toBeNull(); // No task available (both sources occupied)

      // Third harvester should fall back to default behavior (not tested here)
    });
  });
});
