import { describe, it, expect, beforeEach } from "vitest";
import { DependencyTaskQueue } from "../src/DependencyTaskQueue";
import { TaskNode } from "../src/TaskNode";
import { TaskPriority } from "../src/types";

describe("DependencyTaskQueue", () => {
  let queue: DependencyTaskQueue;
  let currentTick: number;

  beforeEach(() => {
    queue = new DependencyTaskQueue();
    currentTick = 1000;
  });

  describe("Task Management", () => {
    it("should add task to queue", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const added = queue.addTask(task);

      expect(added).toBe(true);
      expect(queue.size()).toBe(1);
    });

    it("should not add duplicate task", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task);
      const added = queue.addTask(task);

      expect(added).toBe(false);
      expect(queue.size()).toBe(1);
    });

    it("should not add task with missing dependency", () => {
      const task = new TaskNode({
        id: "task-2",
        type: "upgrade",
        targetId: "controller-456",
        dependencies: ["task-1"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const added = queue.addTask(task);

      expect(added).toBe(false);
      expect(queue.size()).toBe(0);
    });

    it("should add task with valid dependencies", () => {
      const task1 = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task2 = new TaskNode({
        id: "task-2",
        type: "upgrade",
        targetId: "controller-456",
        dependencies: ["task-1"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task1);
      const added = queue.addTask(task2);

      expect(added).toBe(true);
      expect(queue.size()).toBe(2);
      expect(task1.dependents).toContain("task-2");
    });

    it("should remove task from queue", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task);
      const removed = queue.removeTask("task-1");

      expect(removed).toBe(true);
      expect(queue.size()).toBe(0);
    });

    it("should clean up dependent relationships when removing task", () => {
      const task1 = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task2 = new TaskNode({
        id: "task-2",
        type: "upgrade",
        targetId: "controller-456",
        dependencies: ["task-1"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task1);
      queue.addTask(task2);

      queue.removeTask("task-1");

      expect(task2.dependencies).not.toContain("task-1");
    });
  });

  describe("Task Assignment", () => {
    it("should assign ready task to creep", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task);

      const assigned = queue.assignTask("creep-1", currentTick);

      expect(assigned).not.toBeNull();
      expect(assigned?.id).toBe("task-1");
      expect(assigned?.assignedCreep).toBe("creep-1");
    });

    it("should not assign task with pending dependencies", () => {
      const task1 = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task2 = new TaskNode({
        id: "task-2",
        type: "upgrade",
        targetId: "controller-456",
        dependencies: ["task-1"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task1);
      queue.addTask(task2);

      // Assign task-1
      queue.assignTask("creep-1", currentTick);

      // Try to assign task-2 (should fail - dependency not completed)
      const assigned = queue.assignTask("creep-2", currentTick);

      // Should get null (no ready tasks available)
      expect(assigned).toBeNull();
    });

    it("should assign task after dependency completes", () => {
      const task1 = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task2 = new TaskNode({
        id: "task-2",
        type: "upgrade",
        targetId: "controller-456",
        dependencies: ["task-1"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task1);
      queue.addTask(task2);

      // Complete task-1
      queue.completeTask("task-1");

      // Now task-2 should be assignable
      const assigned = queue.assignTask("creep-2", currentTick);

      expect(assigned).not.toBeNull();
      expect(assigned?.id).toBe("task-2");
    });

    it("should prioritize tasks by priority", () => {
      const task1 = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        priority: TaskPriority.LOW,
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task2 = new TaskNode({
        id: "task-2",
        type: "upgrade",
        targetId: "controller-456",
        priority: TaskPriority.CRITICAL,
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task1);
      queue.addTask(task2);

      const assigned = queue.assignTask("creep-1", currentTick);

      // Should assign task-2 (higher priority)
      expect(assigned?.id).toBe("task-2");
    });

    it("should not assign expired task", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 50
      });

      queue.addTask(task);

      const assigned = queue.assignTask("creep-1", currentTick + 100);

      expect(assigned).toBeNull();
    });

    it("should not assign already assigned task", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task);
      queue.assignTask("creep-1", currentTick);

      const assigned = queue.assignTask("creep-2", currentTick);

      expect(assigned).toBeNull();
    });
  });

  describe("Task Completion", () => {
    it("should complete task", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task);
      const completed = queue.completeTask("task-1");

      expect(completed).toBe(true);
      expect(task.isCompleted()).toBe(true);
    });

    it("should fail task", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task);
      const failed = queue.failTask("task-1");

      expect(failed).toBe(true);
      expect(task.isFailed()).toBe(true);
    });

    it("should block dependent tasks when task fails", () => {
      const task1 = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task2 = new TaskNode({
        id: "task-2",
        type: "upgrade",
        targetId: "controller-456",
        dependencies: ["task-1"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task1);
      queue.addTask(task2);

      queue.failTask("task-1");

      // Get ready tasks to trigger state update
      queue.getReadyTasks(currentTick);

      expect(task2.isBlocked()).toBe(true);
    });
  });

  describe("Task Release", () => {
    it("should release task assignment", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task);
      queue.assignTask("creep-1", currentTick);

      const released = queue.releaseTask("task-1", "creep-1");

      expect(released).toBe(true);
      expect(task.isAssigned()).toBe(false);
    });

    it("should not release task assigned to different creep", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task);
      queue.assignTask("creep-1", currentTick);

      const released = queue.releaseTask("task-1", "creep-2");

      expect(released).toBe(false);
      expect(task.assignedCreep).toBe("creep-1");
    });

    it("should get creep task", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task);
      queue.assignTask("creep-1", currentTick);

      const creepTask = queue.getCreepTask("creep-1");

      expect(creepTask).not.toBeNull();
      expect(creepTask?.id).toBe("task-1");
    });
  });

  describe("Cleanup Operations", () => {
    it("should cleanup expired tasks", () => {
      const task1 = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 50
      });

      const task2 = new TaskNode({
        id: "task-2",
        type: "upgrade",
        targetId: "controller-456",
        createdAt: currentTick,
        expiresAt: currentTick + 200
      });

      queue.addTask(task1);
      queue.addTask(task2);

      const removed = queue.cleanupExpiredTasks(currentTick + 100);

      expect(removed).toBe(1);
      expect(queue.size()).toBe(1);
      expect(queue.getTask("task-2")).toBeDefined();
    });

    it("should not remove assigned expired tasks", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 50
      });

      queue.addTask(task);
      queue.assignTask("creep-1", currentTick);

      const removed = queue.cleanupExpiredTasks(currentTick + 100);

      expect(removed).toBe(0);
      expect(queue.size()).toBe(1);
    });

    it("should cleanup dead creep tasks", () => {
      const task1 = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task2 = new TaskNode({
        id: "task-2",
        type: "upgrade",
        targetId: "controller-456",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task1);
      queue.addTask(task2);

      queue.assignTask("creep-1", currentTick);
      queue.assignTask("creep-2", currentTick);

      // Mock creeps with only creep-2 alive
      const mockCreeps = {
        "creep-2": {}
      };

      const cleaned = queue.cleanupDeadCreepTasks(mockCreeps);

      expect(cleaned).toBe(1);
      expect(task1.isAssigned()).toBe(false);
      expect(task2.isAssigned()).toBe(true);
    });
  });

  describe("Queue Statistics", () => {
    it("should return accurate statistics", () => {
      const task1 = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task2 = new TaskNode({
        id: "task-2",
        type: "upgrade",
        targetId: "controller-456",
        dependencies: ["task-1"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task3 = new TaskNode({
        id: "task-3",
        type: "build",
        targetId: "site-789",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task1);
      queue.addTask(task2);
      queue.addTask(task3);

      queue.assignTask("creep-1", currentTick);
      queue.completeTask("task-3");

      const stats = queue.getStats();

      expect(stats.total).toBe(3);
      expect(stats.assigned).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.pending).toBe(1);
    });
  });

  describe("Dependency Resolution", () => {
    it("should resolve all dependencies", () => {
      const task1 = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task2 = new TaskNode({
        id: "task-2",
        type: "transfer",
        targetId: "storage-456",
        dependencies: ["task-1"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task3 = new TaskNode({
        id: "task-3",
        type: "upgrade",
        targetId: "controller-789",
        dependencies: ["task-2"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task1);
      queue.addTask(task2);
      queue.addTask(task3);

      const result = queue.resolveAll();

      expect(result.executionOrder).toEqual(["task-1", "task-2", "task-3"]);
      expect(result.hasCircularDependency).toBe(false);
    });

    it("should prevent circular dependencies", () => {
      const task1 = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task2 = new TaskNode({
        id: "task-2",
        type: "upgrade",
        targetId: "controller-456",
        dependencies: ["task-1"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task1);
      queue.addTask(task2);

      // Try to add task-1 as dependency of task-2 (would create cycle)
      task1.dependencies = ["task-2"];
      task2.dependents = ["task-1"];

      // Should not add (would create cycle - although this is a simplified check)
      // In reality, the cycle is already created by manipulating dependencies directly
      // The proper way would be through the queue's addTask which validates

      // This test demonstrates that cycles can't be added through addTask
      // The cycle detection happens during resolution
      const result = queue.resolveAll();
      expect(result.hasCircularDependency).toBe(true);
    });
  });

  describe("Clear and Size", () => {
    it("should clear all tasks", () => {
      const task1 = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task2 = new TaskNode({
        id: "task-2",
        type: "upgrade",
        targetId: "controller-456",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task1);
      queue.addTask(task2);

      queue.clear();

      expect(queue.size()).toBe(0);
    });

    it("should return correct size", () => {
      expect(queue.size()).toBe(0);

      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      queue.addTask(task);
      expect(queue.size()).toBe(1);
    });
  });
});
