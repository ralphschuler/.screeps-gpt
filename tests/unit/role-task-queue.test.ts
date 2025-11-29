import { describe, it, expect, beforeEach } from "vitest";
import {
  RoleTaskQueueManager,
  TaskPriority,
  type TaskQueueEntry
} from "../../packages/bot/src/runtime/behavior/RoleTaskQueue";

/**
 * Unit tests for RoleTaskQueue system
 *
 * Tests validate:
 * - Task assignment and release
 * - Task expiration and cleanup
 * - Dead creep task cleanup
 * - Task queue ordering by priority
 * - Duplicate task prevention
 */
describe("RoleTaskQueue", () => {
  let memory: Memory;
  let manager: RoleTaskQueueManager;
  let mockGame: { creeps: Record<string, unknown> };

  beforeEach(() => {
    // Initialize fresh memory and manager for each test
    memory = {} as Memory;
    manager = new RoleTaskQueueManager();
    mockGame = { creeps: {} };
  });

  describe("Task Assignment", () => {
    it("should assign available task to creep", () => {
      const task: TaskQueueEntry = {
        taskId: "W1N1-harvest-source-123",
        targetId: "123",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      manager.addTask(memory, "harvester", task);
      const assigned = manager.assignTask(memory, "harvester", "harvester-1", 100);

      expect(assigned).not.toBeNull();
      expect(assigned?.taskId).toBe("W1N1-harvest-source-123");
      expect(assigned?.assignedCreep).toBe("harvester-1");
    });

    it("should return null when no tasks available", () => {
      const assigned = manager.assignTask(memory, "harvester", "harvester-1", 100);
      expect(assigned).toBeNull();
    });

    it("should not assign already assigned task", () => {
      const task: TaskQueueEntry = {
        taskId: "W1N1-harvest-source-123",
        targetId: "123",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      manager.addTask(memory, "harvester", task);
      manager.assignTask(memory, "harvester", "harvester-1", 100);

      // Try to assign same task to different creep
      const assigned = manager.assignTask(memory, "harvester", "harvester-2", 100);
      expect(assigned).toBeNull();
    });

    it("should not assign expired task", () => {
      const task: TaskQueueEntry = {
        taskId: "W1N1-harvest-source-123",
        targetId: "123",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 100
      };

      manager.addTask(memory, "harvester", task);
      const assigned = manager.assignTask(memory, "harvester", "harvester-1", 200);

      expect(assigned).toBeNull();
    });
  });

  describe("Task Release", () => {
    it("should release completed task", () => {
      const task: TaskQueueEntry = {
        taskId: "W1N1-harvest-source-123",
        targetId: "123",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      manager.addTask(memory, "harvester", task);
      manager.assignTask(memory, "harvester", "harvester-1", 100);
      manager.releaseTask(memory, "W1N1-harvest-source-123", "harvester-1");

      const available = manager.getAvailableTasks(memory, "harvester", 100);
      expect(available).toHaveLength(0);
    });

    it("should not release task assigned to different creep", () => {
      const task: TaskQueueEntry = {
        taskId: "W1N1-harvest-source-123",
        targetId: "123",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      manager.addTask(memory, "harvester", task);
      manager.assignTask(memory, "harvester", "harvester-1", 100);
      manager.releaseTask(memory, "W1N1-harvest-source-123", "harvester-2");

      const creepTask = manager.getCreepTask(memory, "harvester-1");
      expect(creepTask).not.toBeNull();
      expect(creepTask?.taskId).toBe("W1N1-harvest-source-123");
    });
  });

  describe("Task Addition", () => {
    it("should add new task to queue", () => {
      const task: TaskQueueEntry = {
        taskId: "W1N1-build-site-456",
        targetId: "456",
        roomName: "W1N1",
        priority: TaskPriority.NORMAL,
        expiresAt: 1000
      };

      manager.addTask(memory, "builder", task);
      const available = manager.getAvailableTasks(memory, "builder", 100);

      expect(available).toHaveLength(1);
      expect(available[0].taskId).toBe("W1N1-build-site-456");
    });

    it("should not add duplicate task", () => {
      const task: TaskQueueEntry = {
        taskId: "W1N1-build-site-456",
        targetId: "456",
        roomName: "W1N1",
        priority: TaskPriority.NORMAL,
        expiresAt: 1000
      };

      manager.addTask(memory, "builder", task);
      manager.addTask(memory, "builder", task);

      const available = manager.getAvailableTasks(memory, "builder", 100);
      expect(available).toHaveLength(1);
    });

    it("should update existing unassigned task", () => {
      const task1: TaskQueueEntry = {
        taskId: "W1N1-build-site-456",
        targetId: "456",
        roomName: "W1N1",
        priority: TaskPriority.NORMAL,
        expiresAt: 1000
      };

      const task2: TaskQueueEntry = {
        taskId: "W1N1-build-site-456",
        targetId: "456",
        roomName: "W1N1",
        priority: TaskPriority.CRITICAL,
        expiresAt: 2000
      };

      manager.addTask(memory, "builder", task1);
      manager.addTask(memory, "builder", task2);

      const available = manager.getAvailableTasks(memory, "builder", 100);
      expect(available).toHaveLength(1);
      expect(available[0].priority).toBe(TaskPriority.CRITICAL);
      expect(available[0].expiresAt).toBe(2000);
    });

    it("should not update assigned task", () => {
      const task1: TaskQueueEntry = {
        taskId: "W1N1-build-site-456",
        targetId: "456",
        roomName: "W1N1",
        priority: TaskPriority.NORMAL,
        expiresAt: 1000
      };

      manager.addTask(memory, "builder", task1);
      manager.assignTask(memory, "builder", "builder-1", 100);

      const task2: TaskQueueEntry = {
        taskId: "W1N1-build-site-456",
        targetId: "456",
        roomName: "W1N1",
        priority: TaskPriority.CRITICAL,
        expiresAt: 2000
      };

      manager.addTask(memory, "builder", task2);

      const creepTask = manager.getCreepTask(memory, "builder-1");
      expect(creepTask?.priority).toBe(TaskPriority.NORMAL);
      expect(creepTask?.expiresAt).toBe(1000);
    });

    it("should sort tasks by priority", () => {
      const task1: TaskQueueEntry = {
        taskId: "W1N1-task-1",
        targetId: "1",
        roomName: "W1N1",
        priority: TaskPriority.LOW,
        expiresAt: 1000
      };

      const task2: TaskQueueEntry = {
        taskId: "W1N1-task-2",
        targetId: "2",
        roomName: "W1N1",
        priority: TaskPriority.CRITICAL,
        expiresAt: 1000
      };

      const task3: TaskQueueEntry = {
        taskId: "W1N1-task-3",
        targetId: "3",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      manager.addTask(memory, "builder", task1);
      manager.addTask(memory, "builder", task2);
      manager.addTask(memory, "builder", task3);

      const available = manager.getAvailableTasks(memory, "builder", 100);
      expect(available[0].taskId).toBe("W1N1-task-2"); // CRITICAL first
      expect(available[1].taskId).toBe("W1N1-task-3"); // HIGH second
      expect(available[2].taskId).toBe("W1N1-task-1"); // LOW last
    });
  });

  describe("Task Expiration", () => {
    it("should cleanup expired tasks", () => {
      const task1: TaskQueueEntry = {
        taskId: "W1N1-task-1",
        targetId: "1",
        roomName: "W1N1",
        priority: TaskPriority.NORMAL,
        expiresAt: 100
      };

      const task2: TaskQueueEntry = {
        taskId: "W1N1-task-2",
        targetId: "2",
        roomName: "W1N1",
        priority: TaskPriority.NORMAL,
        expiresAt: 1000
      };

      manager.addTask(memory, "builder", task1);
      manager.addTask(memory, "builder", task2);

      manager.cleanupExpiredTasks(memory, "builder", 500);

      const available = manager.getAvailableTasks(memory, "builder", 500);
      expect(available).toHaveLength(1);
      expect(available[0].taskId).toBe("W1N1-task-2");
    });

    it("should cleanup expired tasks during assignment", () => {
      const task1: TaskQueueEntry = {
        taskId: "W1N1-task-1",
        targetId: "1",
        roomName: "W1N1",
        priority: TaskPriority.CRITICAL,
        expiresAt: 100
      };

      const task2: TaskQueueEntry = {
        taskId: "W1N1-task-2",
        targetId: "2",
        roomName: "W1N1",
        priority: TaskPriority.NORMAL,
        expiresAt: 1000
      };

      manager.addTask(memory, "builder", task1);
      manager.addTask(memory, "builder", task2);

      const assigned = manager.assignTask(memory, "builder", "builder-1", 500);

      // Should skip expired task-1 and assign task-2
      expect(assigned?.taskId).toBe("W1N1-task-2");
    });
  });

  describe("Dead Creep Cleanup", () => {
    it("should release tasks from dead creeps", () => {
      mockGame.creeps = { "harvester-1": {} };

      const task: TaskQueueEntry = {
        taskId: "W1N1-harvest-source-123",
        targetId: "123",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      manager.addTask(memory, "harvester", task);
      manager.assignTask(memory, "harvester", "harvester-1", 100);

      // Creep dies
      delete mockGame.creeps["harvester-1"];
      manager.cleanupDeadCreepTasks(memory, mockGame);

      const available = manager.getAvailableTasks(memory, "harvester", 100);
      expect(available).toHaveLength(1);
      expect(available[0].assignedCreep).toBeUndefined();
    });

    it("should not affect tasks from alive creeps", () => {
      mockGame.creeps = { "harvester-1": {}, "harvester-2": {} };

      const task1: TaskQueueEntry = {
        taskId: "W1N1-harvest-source-123",
        targetId: "123",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      const task2: TaskQueueEntry = {
        taskId: "W1N1-harvest-source-456",
        targetId: "456",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      manager.addTask(memory, "harvester", task1);
      manager.addTask(memory, "harvester", task2);
      manager.assignTask(memory, "harvester", "harvester-1", 100);
      manager.assignTask(memory, "harvester", "harvester-2", 100);

      // harvester-1 dies
      delete mockGame.creeps["harvester-1"];
      manager.cleanupDeadCreepTasks(memory, mockGame);

      const task1Status = manager.getCreepTask(memory, "harvester-1");
      const task2Status = manager.getCreepTask(memory, "harvester-2");

      expect(task1Status).toBeNull();
      expect(task2Status).not.toBeNull();
      expect(task2Status?.assignedCreep).toBe("harvester-2");
    });
  });

  describe("Queue Management", () => {
    it("should get available tasks for role", () => {
      const task1: TaskQueueEntry = {
        taskId: "W1N1-task-1",
        targetId: "1",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      const task2: TaskQueueEntry = {
        taskId: "W1N1-task-2",
        targetId: "2",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      manager.addTask(memory, "builder", task1);
      manager.addTask(memory, "builder", task2);
      manager.assignTask(memory, "builder", "builder-1", 100);

      const available = manager.getAvailableTasks(memory, "builder", 100);
      expect(available).toHaveLength(1);
      expect(available[0].taskId).toBe("W1N1-task-2");
    });

    it("should clear role queue", () => {
      const task: TaskQueueEntry = {
        taskId: "W1N1-task-1",
        targetId: "1",
        roomName: "W1N1",
        priority: TaskPriority.NORMAL,
        expiresAt: 1000
      };

      manager.addTask(memory, "builder", task);
      manager.clearRoleQueue(memory, "builder");

      const available = manager.getAvailableTasks(memory, "builder", 100);
      expect(available).toHaveLength(0);
    });

    it("should get queue statistics", () => {
      const task1: TaskQueueEntry = {
        taskId: "W1N1-task-1",
        targetId: "1",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      const task2: TaskQueueEntry = {
        taskId: "W1N1-task-2",
        targetId: "2",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      const task3: TaskQueueEntry = {
        taskId: "W1N1-task-3",
        targetId: "3",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      manager.addTask(memory, "builder", task1);
      manager.addTask(memory, "builder", task2);
      manager.addTask(memory, "builder", task3);
      manager.assignTask(memory, "builder", "builder-1", 100);
      manager.assignTask(memory, "builder", "builder-2", 100);

      const stats = manager.getQueueStats(memory);
      expect(stats.builder.total).toBe(3);
      expect(stats.builder.assigned).toBe(2);
      expect(stats.builder.available).toBe(1);
    });

    it("should handle multiple roles independently", () => {
      const harvesterTask: TaskQueueEntry = {
        taskId: "W1N1-harvest-source-123",
        targetId: "123",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      const builderTask: TaskQueueEntry = {
        taskId: "W1N1-build-site-456",
        targetId: "456",
        roomName: "W1N1",
        priority: TaskPriority.NORMAL,
        expiresAt: 1000
      };

      manager.addTask(memory, "harvester", harvesterTask);
      manager.addTask(memory, "builder", builderTask);

      const harvesterTasks = manager.getAvailableTasks(memory, "harvester", 100);
      const builderTasks = manager.getAvailableTasks(memory, "builder", 100);

      expect(harvesterTasks).toHaveLength(1);
      expect(builderTasks).toHaveLength(1);
      expect(harvesterTasks[0].taskId).toBe("W1N1-harvest-source-123");
      expect(builderTasks[0].taskId).toBe("W1N1-build-site-456");
    });
  });

  describe("Creep Task Lookup", () => {
    it("should find task assigned to creep", () => {
      const task: TaskQueueEntry = {
        taskId: "W1N1-harvest-source-123",
        targetId: "123",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      manager.addTask(memory, "harvester", task);
      manager.assignTask(memory, "harvester", "harvester-1", 100);

      const creepTask = manager.getCreepTask(memory, "harvester-1");
      expect(creepTask).not.toBeNull();
      expect(creepTask?.taskId).toBe("W1N1-harvest-source-123");
    });

    it("should return null for creep with no task", () => {
      const creepTask = manager.getCreepTask(memory, "harvester-1");
      expect(creepTask).toBeNull();
    });
  });

  describe("Room-aware task counting", () => {
    it("should count tasks for a specific room only", () => {
      const task1: TaskQueueEntry = {
        taskId: "W1N1-task-1",
        targetId: "1",
        roomName: "W1N1",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      const task2: TaskQueueEntry = {
        taskId: "W1N2-task-2",
        targetId: "2",
        roomName: "W1N2",
        priority: TaskPriority.HIGH,
        expiresAt: 1000
      };

      const task3: TaskQueueEntry = {
        taskId: "W1N1-task-3",
        targetId: "3",
        roomName: "W1N1",
        priority: TaskPriority.NORMAL,
        expiresAt: 1000
      };

      manager.addTask(memory, "builder", task1);
      manager.addTask(memory, "builder", task2);
      manager.addTask(memory, "builder", task3);

      const countW1N1 = manager.getTaskCountForRoom(memory, "builder", "W1N1");
      const countW1N2 = manager.getTaskCountForRoom(memory, "builder", "W1N2");
      const countW1N3 = manager.getTaskCountForRoom(memory, "builder", "W1N3");

      expect(countW1N1).toBe(2);
      expect(countW1N2).toBe(1);
      expect(countW1N3).toBe(0);
    });

    it("should return 0 for empty role queue", () => {
      const count = manager.getTaskCountForRoom(memory, "builder", "W1N1");
      expect(count).toBe(0);
    });
  });
});
