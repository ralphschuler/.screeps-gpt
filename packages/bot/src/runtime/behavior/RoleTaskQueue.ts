/**
 * Role-specific task queue system to prevent duplicate task assignment.
 *
 * This module provides a centralized task coordination mechanism for the role-based
 * behavior system. It prevents multiple creeps of the same role from attempting the
 * same task simultaneously (e.g., all builders targeting the same construction site).
 *
 * Design principles:
 * - Simple Memory-based persistence across ticks
 * - Stable task IDs for consistent coordination
 * - Graceful degradation if queue operations fail
 * - Minimal integration with existing role handlers
 */

import { profile } from "@ralphschuler/screeps-profiler";

/**
 * Task priority levels for queue ordering
 */
export enum TaskPriority {
  CRITICAL = 1, // Emergency tasks (spawn energy, defense)
  HIGH = 2, // Important tasks (construction, harvesting)
  NORMAL = 3, // Regular tasks (upgrading, maintenance)
  LOW = 4 // Optional tasks (exploration, optimization)
}

/**
 * Represents a task in the queue
 */
export interface TaskQueueEntry {
  /** Unique stable identifier for the task (e.g., "harvest-source-5bbcae9f9099fc012e63b52e") */
  taskId: string;
  /** ID of the target object for this task */
  targetId: string;
  /** Name of the creep currently assigned to this task (undefined if unassigned) */
  assignedCreep?: string;
  /** Priority level for task ordering */
  priority: TaskPriority;
  /** Game tick when this task expires if not completed */
  expiresAt: number;
}

/**
 * Memory structure for role-specific task queues
 */
export interface RoleTaskQueueMemory {
  [role: string]: TaskQueueEntry[];
}

/**
 * Centralized manager for role-specific task queues.
 * Coordinates task assignment to prevent duplicate work.
 */
@profile
export class RoleTaskQueueManager {
  private readonly logger: Pick<Console, "log" | "warn">;

  public constructor(logger: Pick<Console, "log" | "warn"> = console) {
    this.logger = logger;
  }

  /**
   * Initialize task queue memory structure
   */
  private ensureMemory(memory: Memory): RoleTaskQueueMemory {
    memory.taskQueue ??= {} as RoleTaskQueueMemory;
    return memory.taskQueue as RoleTaskQueueMemory;
  }

  /**
   * Get all tasks for a specific role
   */
  private getRoleQueue(memory: Memory, role: string): TaskQueueEntry[] {
    const taskQueue = this.ensureMemory(memory);
    taskQueue[role] ??= [];
    return taskQueue[role];
  }

  /**
   * Assign an available task to a creep from the role's task queue.
   * Returns null if no tasks are available.
   *
   * @param memory - Game memory object
   * @param role - Role name to get task for
   * @param creepName - Name of the creep requesting a task
   * @param currentTick - Current game tick for expiration checking
   * @returns Task entry if assigned, null if no tasks available
   */
  public assignTask(memory: Memory, role: string, creepName: string, currentTick: number): TaskQueueEntry | null {
    const queue = this.getRoleQueue(memory, role);

    // Clean up expired tasks first
    this.cleanupExpiredTasks(memory, role, currentTick);

    // Find first available (unassigned) task
    const availableTask = queue.find(task => !task.assignedCreep && task.expiresAt > currentTick);

    if (availableTask) {
      availableTask.assignedCreep = creepName;
      return availableTask;
    }

    return null;
  }

  /**
   * Release a task assignment (when creep dies or completes task)
   *
   * @param memory - Game memory object
   * @param taskId - ID of the task to release
   * @param creepName - Name of the creep releasing the task
   */
  public releaseTask(memory: Memory, taskId: string, creepName: string): void {
    const taskQueue = this.ensureMemory(memory);

    // Search all role queues for this task
    for (const role in taskQueue) {
      const queue = taskQueue[role];
      const taskIndex = queue.findIndex(t => t.taskId === taskId && t.assignedCreep === creepName);

      if (taskIndex !== -1) {
        // Remove completed task from queue
        queue.splice(taskIndex, 1);
        return;
      }
    }
  }

  /**
   * Add a new task to the queue for a specific role
   *
   * @param memory - Game memory object
   * @param role - Role name to add task to
   * @param task - Task entry to add
   */
  public addTask(memory: Memory, role: string, task: TaskQueueEntry): void {
    const queue = this.getRoleQueue(memory, role);

    // Check if task already exists (by taskId)
    const existingTask = queue.find(t => t.taskId === task.taskId);
    if (existingTask) {
      // Update existing task if unassigned
      if (!existingTask.assignedCreep) {
        existingTask.priority = task.priority;
        existingTask.expiresAt = task.expiresAt;
      }
      return;
    }

    // Add new task and sort by priority
    queue.push(task);
    queue.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get all available (unassigned) tasks for a role
   *
   * @param memory - Game memory object
   * @param role - Role name to get tasks for
   * @param currentTick - Current game tick for expiration checking
   * @returns Array of available tasks
   */
  public getAvailableTasks(memory: Memory, role: string, currentTick: number): TaskQueueEntry[] {
    const queue = this.getRoleQueue(memory, role);
    return queue.filter(task => !task.assignedCreep && task.expiresAt > currentTick);
  }

  /**
   * Clean up expired tasks from a role's queue
   *
   * @param memory - Game memory object
   * @param role - Role name to clean up
   * @param currentTick - Current game tick
   */
  public cleanupExpiredTasks(memory: Memory, role: string, currentTick: number): void {
    const queue = this.getRoleQueue(memory, role);
    const taskQueue = this.ensureMemory(memory);

    const beforeCount = queue.length;
    taskQueue[role] = queue.filter(task => task.expiresAt > currentTick);
    const afterCount = taskQueue[role].length;

    if (beforeCount !== afterCount) {
      this.logger.log?.(
        `[TaskQueue] Cleaned up ${beforeCount - afterCount} expired tasks for role '${role}' ` +
          `(${afterCount} remaining)`
      );
    }
  }

  /**
   * Clean up tasks assigned to dead creeps
   *
   * @param memory - Game memory object
   * @param game - Game context for creep lookup
   */
  public cleanupDeadCreepTasks(memory: Memory, game: { creeps: Record<string, unknown> }): void {
    const taskQueue = this.ensureMemory(memory);

    for (const role in taskQueue) {
      const queue = taskQueue[role];
      let cleanedCount = 0;

      for (const task of queue) {
        if (task.assignedCreep && !game.creeps[task.assignedCreep]) {
          // Creep is dead, release the task
          task.assignedCreep = undefined;
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        this.logger.log?.(`[TaskQueue] Released ${cleanedCount} tasks from dead creeps for role '${role}'`);
      }
    }
  }

  /**
   * Get the current task assigned to a creep
   *
   * @param memory - Game memory object
   * @param creepName - Name of the creep
   * @returns Task entry if found, null otherwise
   */
  public getCreepTask(memory: Memory, creepName: string): TaskQueueEntry | null {
    const taskQueue = this.ensureMemory(memory);

    for (const role in taskQueue) {
      const queue = taskQueue[role];
      const task = queue.find(t => t.assignedCreep === creepName);
      if (task) {
        return task;
      }
    }

    return null;
  }

  /**
   * Remove all tasks for a specific role (useful for testing or reset)
   *
   * @param memory - Game memory object
   * @param role - Role name to clear
   */
  public clearRoleQueue(memory: Memory, role: string): void {
    const taskQueue = this.ensureMemory(memory);
    taskQueue[role] = [];
  }

  /**
   * Get task queue statistics for monitoring
   *
   * @param memory - Game memory object
   * @returns Object with task count statistics by role
   */
  public getQueueStats(memory: Memory): Record<string, { total: number; assigned: number; available: number }> {
    const taskQueue = this.ensureMemory(memory);
    const stats: Record<string, { total: number; assigned: number; available: number }> = {};

    for (const role in taskQueue) {
      const queue = taskQueue[role];
      const assigned = queue.filter(t => t.assignedCreep).length;
      stats[role] = {
        total: queue.length,
        assigned,
        available: queue.length - assigned
      };
    }

    return stats;
  }
}
