/**
 * DependencyResolver - Topological sort for task execution order
 *
 * Resolves task dependencies to determine execution order and detects circular dependencies.
 * Uses Kahn's algorithm for topological sorting of directed acyclic graphs (DAGs).
 */

import { TaskNode } from "./TaskNode";
import { TaskState, ResolutionResult, TaskGraph } from "./types";

/**
 *
 */
export class DependencyResolver {
  /**
   * Build a task graph from a collection of task nodes
   */
  public buildGraph(tasks: Map<string, TaskNode>): TaskGraph {
    const nodes = new Map<string, TaskNode>();
    const edges = new Map<string, string[]>();

    // Initialize graph structure
    for (const [id, task] of tasks) {
      nodes.set(id, task);
      edges.set(id, []);
    }

    // Build edges: for each task, add edges to its dependents
    for (const task of tasks.values()) {
      for (const dependentId of task.dependents) {
        if (edges.has(task.id)) {
          const dependentsList = edges.get(task.id);
          if (dependentsList && !dependentsList.includes(dependentId)) {
            dependentsList.push(dependentId);
          }
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Resolve task dependencies and determine execution order
   * Uses Kahn's algorithm for topological sorting
   */
  public resolve(tasks: Map<string, TaskNode>): ResolutionResult {
    const graph = this.buildGraph(tasks);
    const executionOrder: string[] = [];
    const readyTasks: string[] = [];
    const blockedTasks: string[] = [];

    // Calculate in-degree (number of dependencies) for each task
    const inDegree = new Map<string, number>();
    for (const [id, task] of graph.nodes) {
      inDegree.set(id, task.dependencies.length);
    }

    // Queue of tasks with no dependencies
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    // Process tasks in topological order
    while (queue.length > 0) {
      const taskId = queue.shift()!;
      executionOrder.push(taskId);

      const task = graph.nodes.get(taskId);
      if (!task) continue;

      // Check if this task is ready (not blocked, not completed/failed)
      if (task.state === TaskState.PENDING || task.state === TaskState.READY) {
        // Verify all dependencies are actually completed
        const allDependenciesCompleted = task.dependencies.every(depId => {
          const dep = graph.nodes.get(depId);
          return dep && dep.state === TaskState.COMPLETED;
        });

        const anyDependencyFailed = task.dependencies.some(depId => {
          const dep = graph.nodes.get(depId);
          return dep && (dep.state === TaskState.FAILED || dep.state === TaskState.BLOCKED);
        });

        if (anyDependencyFailed) {
          task.state = TaskState.BLOCKED;
          blockedTasks.push(taskId);
        } else if (allDependenciesCompleted) {
          task.state = TaskState.READY;
          readyTasks.push(taskId);
        }
      }

      // Reduce in-degree for dependents
      const edges = graph.edges.get(taskId) || [];
      for (const dependentId of edges) {
        const degree = inDegree.get(dependentId);
        if (degree !== undefined) {
          inDegree.set(dependentId, degree - 1);
          if (degree - 1 === 0) {
            queue.push(dependentId);
          }
        }
      }
    }

    // Detect circular dependencies
    const hasCircularDependency = executionOrder.length !== graph.nodes.size;
    const circularDependencies: string[] = [];

    if (hasCircularDependency) {
      // Find tasks not in execution order (part of cycle)
      for (const id of graph.nodes.keys()) {
        if (!executionOrder.includes(id)) {
          circularDependencies.push(id);
        }
      }
    }

    return {
      executionOrder,
      readyTasks,
      blockedTasks,
      hasCircularDependency,
      circularDependencies
    };
  }

  /**
   * Detect if adding a dependency would create a circular dependency
   * Uses depth-first search to detect cycles
   */
  public wouldCreateCycle(tasks: Map<string, TaskNode>, fromTaskId: string, toTaskId: string): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (taskId: string): boolean => {
      if (recStack.has(taskId)) {
        return true; // Found a cycle
      }
      if (visited.has(taskId)) {
        return false; // Already explored this path
      }

      visited.add(taskId);
      recStack.add(taskId);

      const task = tasks.get(taskId);
      if (task) {
        // Follow dependencies
        for (const depId of task.dependencies) {
          if (hasCycle(depId)) {
            return true;
          }
        }
      }

      recStack.delete(taskId);
      return false;
    };

    // Temporarily add the proposed dependency
    const toTask = tasks.get(toTaskId);
    if (!toTask) return false;

    const originalDeps = [...toTask.dependencies];
    toTask.dependencies.push(fromTaskId);

    const result = hasCycle(toTaskId);

    // Restore original dependencies
    toTask.dependencies = originalDeps;

    return result;
  }

  /**
   * Update task states based on dependency completion
   * Marks tasks as ready when dependencies complete, blocked when dependencies fail
   */
  public updateTaskStates(tasks: Map<string, TaskNode>): void {
    for (const task of tasks.values()) {
      if (task.state !== TaskState.PENDING) {
        continue; // Only update pending tasks
      }

      // Check dependency states
      let allCompleted = true;
      let anyFailed = false;

      for (const depId of task.dependencies) {
        const dep = tasks.get(depId);
        if (!dep) continue;

        if (dep.state === TaskState.FAILED || dep.state === TaskState.BLOCKED) {
          anyFailed = true;
          break;
        }
        if (dep.state !== TaskState.COMPLETED) {
          allCompleted = false;
        }
      }

      // Update task state
      if (anyFailed) {
        task.markBlocked();
      } else if (allCompleted) {
        task.markReady();
      }
    }
  }
}
