import type { TaskAction } from "./TaskAction";

/**
 * Task status tracking
 */
export type TaskStatus = "PENDING" | "INPROCESS" | "COMPLETE";

/**
 * Represents work that needs to be done.
 * Based on Jon Winsley's task management architecture.
 */
export class TaskRequest {
  /** Unique identifier for this task */
  id: string;

  /** The action to be performed */
  task: TaskAction;

  /** Current status of the task */
  status: TaskStatus;

  /** Priority level (higher = more important) */
  priority: number;

  /** Creep assigned to this task (if any) */
  assignedCreep?: Id<Creep>;

  /** Tick when task was created */
  createdAt: number;

  /** Optional deadline for task completion */
  deadline?: number;

  constructor(id: string, task: TaskAction, priority: number, deadline?: number) {
    this.id = id;
    this.task = task;
    this.status = "PENDING";
    this.priority = priority;
    this.createdAt = Game.time;
    this.deadline = deadline;
  }

  /**
   * Check if this task can be assigned to a creep
   */
  canAssign(creep: Creep): boolean {
    if (this.status !== "PENDING") {
      return false;
    }

    // Check all prerequisites
    return this.task.prereqs.every(prereq => prereq.meets(creep));
  }

  /**
   * Assign this task to a creep
   */
  assign(creep: Creep): boolean {
    if (!this.canAssign(creep)) {
      return false;
    }

    this.assignedCreep = creep.id;
    this.status = "INPROCESS";
    return true;
  }

  /**
   * Execute the task action with the assigned creep
   * @returns true if task is complete
   */
  execute(creep: Creep): boolean {
    if (this.status !== "INPROCESS") {
      return false;
    }

    const complete = this.task.action(creep);
    if (complete) {
      this.status = "COMPLETE";
    }

    return complete;
  }

  /**
   * Check if task has expired
   */
  isExpired(): boolean {
    return this.deadline !== undefined && Game.time > this.deadline;
  }

  /**
   * Get subtasks needed to meet prerequisites
   */
  getPrerequisiteSubtasks(creep: Creep): TaskAction[] {
    const subtasks: TaskAction[] = [];

    for (const prereq of this.task.prereqs) {
      if (!prereq.meets(creep)) {
        const prereqTasks = prereq.toMeet(creep);
        subtasks.push(...prereqTasks);
      }
    }

    return subtasks;
  }
}

/**
 * Priority levels for common task types
 */
export const TaskPriority = {
  CRITICAL: 100,
  HIGH: 75,
  NORMAL: 50,
  LOW: 25,
  IDLE: 0
} as const;
