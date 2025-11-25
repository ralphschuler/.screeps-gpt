/**
 * DependencyTaskQueue - Dependency-aware task queue manager
 *
 * Extends the concept of task queues to support hierarchical dependencies.
 * Tasks are stored in a DAG structure and assigned based on dependency resolution.
 */

import { TaskNode } from "./TaskNode";
import { DependencyResolver } from "./DependencyResolver";

/**
 *
 */
export class DependencyTaskQueue {
  private tasks: Map<string, TaskNode>;
  private resolver: DependencyResolver;

  public constructor() {
    this.tasks = new Map();
    this.resolver = new DependencyResolver();
  }

  /**
   * Add a task to the queue
   * Validates that adding this task won't create circular dependencies
   */
  public addTask(task: TaskNode): boolean {
    // Check if task already exists
    if (this.tasks.has(task.id)) {
      return false;
    }

    // Validate dependencies exist
    for (const depId of task.dependencies) {
      if (!this.tasks.has(depId)) {
        // Dependency not found, cannot add task
        return false;
      }
    }

    // Check for circular dependencies
    for (const depId of task.dependencies) {
      if (this.resolver.wouldCreateCycle(this.tasks, task.id, depId)) {
        // Would create circular dependency
        return false;
      }
    }

    // Add task to queue
    this.tasks.set(task.id, task);

    // Update dependent relationships
    for (const depId of task.dependencies) {
      const dep = this.tasks.get(depId);
      if (dep) {
        dep.addDependent(task.id);
      }
    }

    return true;
  }

  /**
   * Remove a task from the queue
   */
  public removeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    // Remove this task from dependents of its dependencies
    for (const depId of task.dependencies) {
      const dep = this.tasks.get(depId);
      if (dep) {
        dep.removeDependent(taskId);
      }
    }

    // Remove this task from dependencies of its dependents
    for (const dependentId of task.dependents) {
      const dependent = this.tasks.get(dependentId);
      if (dependent) {
        dependent.removeDependency(taskId);
      }
    }

    this.tasks.delete(taskId);
    return true;
  }

  /**
   * Get a task by ID
   */
  public getTask(taskId: string): TaskNode | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  public getAllTasks(): TaskNode[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get ready tasks (all dependencies completed, sorted by priority)
   */
  public getReadyTasks(currentTick: number): TaskNode[] {
    // Update task states based on dependencies
    this.resolver.updateTaskStates(this.tasks);

    // Filter ready tasks that haven't expired
    const readyTasks = Array.from(this.tasks.values()).filter(
      task => task.isReady() && !task.isExpired(currentTick) && !task.isAssigned()
    );

    // Sort by priority (lowest number = highest priority)
    return readyTasks.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Assign a ready task to a creep
   */
  public assignTask(creepName: string, currentTick: number): TaskNode | null {
    const readyTasks = this.getReadyTasks(currentTick);
    if (readyTasks.length === 0) {
      return null;
    }

    // Assign first ready task (highest priority)
    const task = readyTasks[0];
    if (task) {
      task.assignCreep(creepName);
      return task;
    }
    return null;
  }

  /**
   * Complete a task and update dependent tasks
   */
  public completeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    task.markCompleted();

    // Update dependent tasks that may now be ready
    this.resolver.updateTaskStates(this.tasks);

    return true;
  }

  /**
   * Fail a task and block dependent tasks
   */
  public failTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    task.markFailed();

    // Update dependent tasks to blocked state
    this.resolver.updateTaskStates(this.tasks);

    return true;
  }

  /**
   * Release a task assignment (when creep dies or abandons task)
   */
  public releaseTask(taskId: string, creepName: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.assignedCreep !== creepName) {
      return false;
    }

    task.unassignCreep();
    return true;
  }

  /**
   * Get task assigned to a creep
   */
  public getCreepTask(creepName: string): TaskNode | null {
    for (const task of this.tasks.values()) {
      if (task.assignedCreep === creepName) {
        return task;
      }
    }
    return null;
  }

  /**
   * Clean up expired tasks
   */
  public cleanupExpiredTasks(currentTick: number): number {
    let removed = 0;
    const expiredTasks: string[] = [];

    for (const task of this.tasks.values()) {
      if (task.isExpired(currentTick) && !task.isAssigned()) {
        expiredTasks.push(task.id);
      }
    }

    for (const taskId of expiredTasks) {
      if (this.removeTask(taskId)) {
        removed++;
      }
    }

    return removed;
  }

  /**
   * Clean up tasks assigned to dead creeps
   * @param creeps - Object mapping creep names to creep instances
   */
  public cleanupDeadCreepTasks(creeps: Record<string, unknown>): number {
    let cleaned = 0;

    for (const task of this.tasks.values()) {
      if (task.assignedCreep && !creeps[task.assignedCreep]) {
        task.unassignCreep();
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Resolve all task dependencies and get execution order
   */
  public resolveAll(): ReturnType<DependencyResolver["resolve"]> {
    return this.resolver.resolve(this.tasks);
  }

  /**
   * Get queue statistics
   */
  public getStats(): {
    total: number;
    pending: number;
    ready: number;
    blocked: number;
    completed: number;
    failed: number;
    assigned: number;
  } {
    const stats = {
      total: this.tasks.size,
      pending: 0,
      ready: 0,
      blocked: 0,
      completed: 0,
      failed: 0,
      assigned: 0
    };

    for (const task of this.tasks.values()) {
      if (task.isPending()) stats.pending++;
      if (task.isReady()) stats.ready++;
      if (task.isBlocked()) stats.blocked++;
      if (task.isCompleted()) stats.completed++;
      if (task.isFailed()) stats.failed++;
      if (task.isAssigned()) stats.assigned++;
    }

    return stats;
  }

  /**
   * Clear all tasks from the queue
   */
  public clear(): void {
    this.tasks.clear();
  }

  /**
   * Get number of tasks in queue
   */
  public size(): number {
    return this.tasks.size;
  }
}
