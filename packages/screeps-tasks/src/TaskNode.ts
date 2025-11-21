/**
 * TaskNode - Hierarchical task with dependency support
 *
 * Represents a task in a dependency graph with parent-child relationships.
 * Tasks can have prerequisite dependencies that must complete before execution.
 */

import { ITaskNode, TaskState, TaskPriority } from "./types";

export class TaskNode implements ITaskNode {
  public id: string;
  public type: string;
  public priority: TaskPriority;
  public state: TaskState;
  public targetId: string;
  public parentId: string | null;
  public dependencies: string[];
  public dependents: string[];
  public createdAt: number;
  public expiresAt: number;
  public assignedCreep?: string;

  public constructor(config: {
    id: string;
    type: string;
    targetId: string;
    priority?: TaskPriority;
    parentId?: string | null;
    dependencies?: string[];
    createdAt: number;
    expiresAt: number;
  }) {
    this.id = config.id;
    this.type = config.type;
    this.targetId = config.targetId;
    this.priority = config.priority ?? TaskPriority.NORMAL;
    this.state = TaskState.PENDING;
    this.parentId = config.parentId ?? null;
    this.dependencies = config.dependencies ?? [];
    this.dependents = [];
    this.createdAt = config.createdAt;
    this.expiresAt = config.expiresAt;
  }

  /**
   * Add a prerequisite dependency to this task
   */
  public addDependency(taskId: string): void {
    if (!this.dependencies.includes(taskId)) {
      this.dependencies.push(taskId);
    }
  }

  /**
   * Remove a prerequisite dependency from this task
   */
  public removeDependency(taskId: string): void {
    this.dependencies = this.dependencies.filter(id => id !== taskId);
  }

  /**
   * Add a dependent task that depends on this task
   */
  public addDependent(taskId: string): void {
    if (!this.dependents.includes(taskId)) {
      this.dependents.push(taskId);
    }
  }

  /**
   * Remove a dependent task
   */
  public removeDependent(taskId: string): void {
    this.dependents = this.dependents.filter(id => id !== taskId);
  }

  /**
   * Check if task is expired
   */
  public isExpired(currentTick: number): boolean {
    return currentTick > this.expiresAt;
  }

  /**
   * Check if task has dependencies
   */
  public hasDependencies(): boolean {
    return this.dependencies.length > 0;
  }

  /**
   * Check if task has dependents
   */
  public hasDependents(): boolean {
    return this.dependents.length > 0;
  }

  /**
   * Check if task is ready to execute (all dependencies completed)
   */
  public isReady(): boolean {
    return this.state === TaskState.READY;
  }

  /**
   * Check if task is pending (waiting for dependencies)
   */
  public isPending(): boolean {
    return this.state === TaskState.PENDING;
  }

  /**
   * Check if task is blocked (dependencies failed)
   */
  public isBlocked(): boolean {
    return this.state === TaskState.BLOCKED;
  }

  /**
   * Check if task is completed
   */
  public isCompleted(): boolean {
    return this.state === TaskState.COMPLETED;
  }

  /**
   * Check if task failed
   */
  public isFailed(): boolean {
    return this.state === TaskState.FAILED;
  }

  /**
   * Mark task as ready for execution
   */
  public markReady(): void {
    this.state = TaskState.READY;
  }

  /**
   * Mark task as blocked
   */
  public markBlocked(): void {
    this.state = TaskState.BLOCKED;
  }

  /**
   * Mark task as completed
   */
  public markCompleted(): void {
    this.state = TaskState.COMPLETED;
  }

  /**
   * Mark task as failed
   */
  public markFailed(): void {
    this.state = TaskState.FAILED;
  }

  /**
   * Assign creep to this task
   */
  public assignCreep(creepName: string): void {
    this.assignedCreep = creepName;
  }

  /**
   * Unassign creep from this task
   */
  public unassignCreep(): void {
    delete this.assignedCreep;
  }

  /**
   * Check if task is assigned to a creep
   */
  public isAssigned(): boolean {
    return this.assignedCreep !== undefined;
  }

  /**
   * Serialize task to plain object for storage
   */
  public toJSON(): ITaskNode {
    const result: ITaskNode = {
      id: this.id,
      type: this.type,
      priority: this.priority,
      state: this.state,
      targetId: this.targetId,
      parentId: this.parentId,
      dependencies: this.dependencies,
      dependents: this.dependents,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt
    };
    if (this.assignedCreep !== undefined) {
      result.assignedCreep = this.assignedCreep;
    }
    return result;
  }

  /**
   * Deserialize task from plain object
   */
  public static fromJSON(data: ITaskNode): TaskNode {
    const task = new TaskNode({
      id: data.id,
      type: data.type,
      targetId: data.targetId,
      priority: data.priority,
      parentId: data.parentId,
      dependencies: data.dependencies,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt
    });
    task.state = data.state;
    task.dependents = data.dependents;
    if (data.assignedCreep !== undefined) {
      task.assignedCreep = data.assignedCreep;
    }
    return task;
  }
}
