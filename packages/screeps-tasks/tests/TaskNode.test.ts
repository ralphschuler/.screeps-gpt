import { describe, it, expect, beforeEach } from "vitest";
import { TaskNode } from "../src/TaskNode";
import { TaskState, TaskPriority } from "../src/types";

describe("TaskNode", () => {
  let currentTick: number;

  beforeEach(() => {
    currentTick = 1000;
  });

  describe("Construction", () => {
    it("should create task with required properties", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      expect(task.id).toBe("task-1");
      expect(task.type).toBe("harvest");
      expect(task.targetId).toBe("source-123");
      expect(task.priority).toBe(TaskPriority.NORMAL);
      expect(task.state).toBe(TaskState.PENDING);
      expect(task.parentId).toBeNull();
      expect(task.dependencies).toEqual([]);
      expect(task.dependents).toEqual([]);
    });

    it("should create task with custom priority", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        priority: TaskPriority.CRITICAL,
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      expect(task.priority).toBe(TaskPriority.CRITICAL);
    });

    it("should create task with parent", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        parentId: "parent-task",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      expect(task.parentId).toBe("parent-task");
    });

    it("should create task with dependencies", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "upgrade",
        targetId: "controller-123",
        dependencies: ["task-0"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      expect(task.dependencies).toEqual(["task-0"]);
    });
  });

  describe("Dependency Management", () => {
    it("should add dependency", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      task.addDependency("task-0");
      expect(task.dependencies).toContain("task-0");
    });

    it("should not add duplicate dependency", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      task.addDependency("task-0");
      task.addDependency("task-0");
      expect(task.dependencies).toEqual(["task-0"]);
    });

    it("should remove dependency", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        dependencies: ["task-0", "task-2"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      task.removeDependency("task-0");
      expect(task.dependencies).toEqual(["task-2"]);
    });

    it("should add dependent", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      task.addDependent("task-2");
      expect(task.dependents).toContain("task-2");
    });

    it("should remove dependent", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      task.addDependent("task-2");
      task.removeDependent("task-2");
      expect(task.dependents).toEqual([]);
    });
  });

  describe("State Management", () => {
    it("should start in pending state", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      expect(task.isPending()).toBe(true);
      expect(task.isReady()).toBe(false);
    });

    it("should mark as ready", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      task.markReady();
      expect(task.isReady()).toBe(true);
      expect(task.state).toBe(TaskState.READY);
    });

    it("should mark as blocked", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      task.markBlocked();
      expect(task.isBlocked()).toBe(true);
      expect(task.state).toBe(TaskState.BLOCKED);
    });

    it("should mark as completed", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      task.markCompleted();
      expect(task.isCompleted()).toBe(true);
      expect(task.state).toBe(TaskState.COMPLETED);
    });

    it("should mark as failed", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      task.markFailed();
      expect(task.isFailed()).toBe(true);
      expect(task.state).toBe(TaskState.FAILED);
    });
  });

  describe("Expiration", () => {
    it("should detect expired task", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      expect(task.isExpired(currentTick + 50)).toBe(false);
      expect(task.isExpired(currentTick + 100)).toBe(false);
      expect(task.isExpired(currentTick + 101)).toBe(true);
    });
  });

  describe("Assignment", () => {
    it("should assign creep", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      task.assignCreep("creep-1");
      expect(task.isAssigned()).toBe(true);
      expect(task.assignedCreep).toBe("creep-1");
    });

    it("should unassign creep", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      task.assignCreep("creep-1");
      task.unassignCreep();
      expect(task.isAssigned()).toBe(false);
      expect(task.assignedCreep).toBeUndefined();
    });
  });

  describe("Serialization", () => {
    it("should serialize to JSON", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        priority: TaskPriority.HIGH,
        dependencies: ["task-0"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      task.assignCreep("creep-1");
      task.markReady();

      const json = task.toJSON();
      expect(json.id).toBe("task-1");
      expect(json.type).toBe("harvest");
      expect(json.state).toBe(TaskState.READY);
      expect(json.assignedCreep).toBe("creep-1");
    });

    it("should deserialize from JSON", () => {
      const data = {
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        priority: TaskPriority.HIGH,
        state: TaskState.READY,
        parentId: null,
        dependencies: ["task-0"],
        dependents: ["task-2"],
        createdAt: currentTick,
        expiresAt: currentTick + 100,
        assignedCreep: "creep-1"
      };

      const task = TaskNode.fromJSON(data);
      expect(task.id).toBe("task-1");
      expect(task.type).toBe("harvest");
      expect(task.state).toBe(TaskState.READY);
      expect(task.assignedCreep).toBe("creep-1");
      expect(task.dependencies).toEqual(["task-0"]);
      expect(task.dependents).toEqual(["task-2"]);
    });

    it("should serialize without assigned creep", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const json = task.toJSON();
      expect(json.assignedCreep).toBeUndefined();
    });
  });

  describe("Helper Methods", () => {
    it("should check if task has dependencies", () => {
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
        targetId: "controller-123",
        dependencies: ["task-1"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      expect(task1.hasDependencies()).toBe(false);
      expect(task2.hasDependencies()).toBe(true);
    });

    it("should check if task has dependents", () => {
      const task = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      expect(task.hasDependents()).toBe(false);

      task.addDependent("task-2");
      expect(task.hasDependents()).toBe(true);
    });
  });
});
