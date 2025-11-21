import { describe, it, expect, beforeEach } from "vitest";
import { DependencyResolver } from "../src/DependencyResolver";
import { TaskNode } from "../src/TaskNode";
import { TaskState } from "../src/types";

describe("DependencyResolver", () => {
  let resolver: DependencyResolver;
  let tasks: Map<string, TaskNode>;
  let currentTick: number;

  beforeEach(() => {
    resolver = new DependencyResolver();
    tasks = new Map();
    currentTick = 1000;
  });

  describe("Simple Dependency Resolution", () => {
    it("should resolve tasks with no dependencies", () => {
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

      tasks.set("task-1", task1);
      tasks.set("task-2", task2);

      const result = resolver.resolve(tasks);

      expect(result.executionOrder).toHaveLength(2);
      expect(result.executionOrder).toContain("task-1");
      expect(result.executionOrder).toContain("task-2");
      expect(result.hasCircularDependency).toBe(false);
      expect(result.readyTasks).toHaveLength(2);
    });

    it("should resolve linear dependency chain", () => {
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

      task1.addDependent("task-2");
      task2.addDependent("task-3");

      tasks.set("task-1", task1);
      tasks.set("task-2", task2);
      tasks.set("task-3", task3);

      const result = resolver.resolve(tasks);

      expect(result.executionOrder).toEqual(["task-1", "task-2", "task-3"]);
      expect(result.hasCircularDependency).toBe(false);
    });

    it("should mark first task as ready when no dependencies", () => {
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

      task1.addDependent("task-2");

      tasks.set("task-1", task1);
      tasks.set("task-2", task2);

      const result = resolver.resolve(tasks);

      expect(result.readyTasks).toContain("task-1");
      expect(result.readyTasks).not.toContain("task-2");
      expect(task1.state).toBe(TaskState.READY);
      expect(task2.state).toBe(TaskState.PENDING);
    });
  });

  describe("Complex Dependency Graphs", () => {
    it("should resolve diamond dependency graph", () => {
      //     task-1
      //    /      \
      // task-2  task-3
      //    \      /
      //     task-4

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
        type: "transfer",
        targetId: "storage-789",
        dependencies: ["task-1"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task4 = new TaskNode({
        id: "task-4",
        type: "upgrade",
        targetId: "controller-012",
        dependencies: ["task-2", "task-3"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      task1.addDependent("task-2");
      task1.addDependent("task-3");
      task2.addDependent("task-4");
      task3.addDependent("task-4");

      tasks.set("task-1", task1);
      tasks.set("task-2", task2);
      tasks.set("task-3", task3);
      tasks.set("task-4", task4);

      const result = resolver.resolve(tasks);

      expect(result.hasCircularDependency).toBe(false);
      expect(result.executionOrder[0]).toBe("task-1");
      expect(result.executionOrder[3]).toBe("task-4");
      // task-2 and task-3 can be in any order
      expect(result.executionOrder).toContain("task-2");
      expect(result.executionOrder).toContain("task-3");
    });

    it("should resolve multiple independent chains", () => {
      // Chain 1: task-1 -> task-2
      // Chain 2: task-3 -> task-4

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
        type: "harvest",
        targetId: "source-789",
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task4 = new TaskNode({
        id: "task-4",
        type: "build",
        targetId: "site-012",
        dependencies: ["task-3"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      task1.addDependent("task-2");
      task3.addDependent("task-4");

      tasks.set("task-1", task1);
      tasks.set("task-2", task2);
      tasks.set("task-3", task3);
      tasks.set("task-4", task4);

      const result = resolver.resolve(tasks);

      expect(result.hasCircularDependency).toBe(false);
      expect(result.executionOrder).toHaveLength(4);

      // Verify partial ordering
      const indexOf1 = result.executionOrder.indexOf("task-1");
      const indexOf2 = result.executionOrder.indexOf("task-2");
      const indexOf3 = result.executionOrder.indexOf("task-3");
      const indexOf4 = result.executionOrder.indexOf("task-4");

      expect(indexOf1).toBeLessThan(indexOf2);
      expect(indexOf3).toBeLessThan(indexOf4);
    });
  });

  describe("Circular Dependency Detection", () => {
    it("should detect simple circular dependency", () => {
      // task-1 -> task-2 -> task-1 (circular)

      const task1 = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        dependencies: ["task-2"],
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

      task1.addDependent("task-2");
      task2.addDependent("task-1");

      tasks.set("task-1", task1);
      tasks.set("task-2", task2);

      const result = resolver.resolve(tasks);

      expect(result.hasCircularDependency).toBe(true);
      expect(result.circularDependencies).toHaveLength(2);
      expect(result.circularDependencies).toContain("task-1");
      expect(result.circularDependencies).toContain("task-2");
    });

    it("should detect complex circular dependency", () => {
      // task-1 -> task-2 -> task-3 -> task-1 (circular)

      const task1 = new TaskNode({
        id: "task-1",
        type: "harvest",
        targetId: "source-123",
        dependencies: ["task-3"],
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

      task1.addDependent("task-2");
      task2.addDependent("task-3");
      task3.addDependent("task-1");

      tasks.set("task-1", task1);
      tasks.set("task-2", task2);
      tasks.set("task-3", task3);

      const result = resolver.resolve(tasks);

      expect(result.hasCircularDependency).toBe(true);
      expect(result.circularDependencies).toHaveLength(3);
    });

    it("should detect if adding dependency would create cycle", () => {
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

      task1.addDependent("task-2");

      tasks.set("task-1", task1);
      tasks.set("task-2", task2);

      // Try to add task-2 as dependency of task-1 (would create cycle)
      const wouldCycle = resolver.wouldCreateCycle(tasks, "task-2", "task-1");

      expect(wouldCycle).toBe(true);
    });

    it("should not detect cycle for valid dependency", () => {
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

      task1.addDependent("task-2");

      tasks.set("task-1", task1);
      tasks.set("task-2", task2);
      tasks.set("task-3", task3);

      // Try to add task-3 as dependency of task-2 (valid)
      const wouldCycle = resolver.wouldCreateCycle(tasks, "task-3", "task-2");

      expect(wouldCycle).toBe(false);
    });
  });

  describe("State Updates", () => {
    it("should mark task as ready when dependencies complete", () => {
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

      tasks.set("task-1", task1);
      tasks.set("task-2", task2);

      // Initially task-2 is pending
      expect(task2.state).toBe(TaskState.PENDING);

      // Complete task-1
      task1.markCompleted();

      // Update states
      resolver.updateTaskStates(tasks);

      // task-2 should now be ready
      expect(task2.state).toBe(TaskState.READY);
    });

    it("should mark task as blocked when dependency fails", () => {
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

      tasks.set("task-1", task1);
      tasks.set("task-2", task2);

      // Fail task-1
      task1.markFailed();

      // Update states
      resolver.updateTaskStates(tasks);

      // task-2 should be blocked
      expect(task2.state).toBe(TaskState.BLOCKED);
    });

    it("should mark task as blocked when any dependency fails", () => {
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
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      const task3 = new TaskNode({
        id: "task-3",
        type: "upgrade",
        targetId: "controller-789",
        dependencies: ["task-1", "task-2"],
        createdAt: currentTick,
        expiresAt: currentTick + 100
      });

      tasks.set("task-1", task1);
      tasks.set("task-2", task2);
      tasks.set("task-3", task3);

      // Complete task-1 but fail task-2
      task1.markCompleted();
      task2.markFailed();

      // Update states
      resolver.updateTaskStates(tasks);

      // task-3 should be blocked
      expect(task3.state).toBe(TaskState.BLOCKED);
    });

    it("should not update non-pending tasks", () => {
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

      tasks.set("task-1", task1);
      tasks.set("task-2", task2);

      // Mark task-2 as completed
      task2.markCompleted();

      // Complete task-1
      task1.markCompleted();

      // Update states
      resolver.updateTaskStates(tasks);

      // task-2 should still be completed (not changed to ready)
      expect(task2.state).toBe(TaskState.COMPLETED);
    });
  });
});
