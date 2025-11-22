/**
 * Task state enumeration
 */
export enum TaskState {
  /** Task is waiting for dependencies to complete */
  PENDING = "pending",
  /** All dependencies completed, task is ready for execution */
  READY = "ready",
  /** Task is blocked due to failed dependencies */
  BLOCKED = "blocked",
  /** Task execution completed successfully */
  COMPLETED = "completed",
  /** Task execution failed */
  FAILED = "failed"
}

/**
 * Task priority levels for execution ordering
 */
export enum TaskPriority {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4
}

/**
 * Interface for task nodes with dependency support
 */
export interface ITaskNode {
  /** Unique task identifier */
  id: string;
  /** Task type identifier (e.g., "harvest", "upgrade", "build") */
  type: string;
  /** Task priority for execution ordering */
  priority: TaskPriority;
  /** Current task state */
  state: TaskState;
  /** Target object ID for this task */
  targetId: string;
  /** Parent task ID (null for root tasks) */
  parentId: string | null;
  /** Array of prerequisite task IDs that must complete before this task */
  dependencies: string[];
  /** Array of dependent task IDs that depend on this task */
  dependents: string[];
  /** Game tick when task was created */
  createdAt: number;
  /** Game tick when task expires if not started */
  expiresAt: number;
  /**
   * Name of creep assigned to this task (undefined if unassigned)
   * Note: The explicit '| undefined' is required for TypeScript's
   * exactOptionalPropertyTypes: true to allow setting this.assignedCreep = undefined
   */
  assignedCreep?: string | undefined;
}

/**
 * Result of dependency resolution
 */
export interface ResolutionResult {
  /** Tasks in execution order (topologically sorted) */
  executionOrder: string[];
  /** Tasks that are ready to execute (no pending dependencies) */
  readyTasks: string[];
  /** Tasks that are blocked (dependencies failed) */
  blockedTasks: string[];
  /** Circular dependency detected */
  hasCircularDependency: boolean;
  /** List of task IDs involved in circular dependencies */
  circularDependencies: string[];
}

/**
 * Task graph structure for dependency resolution
 */
export interface TaskGraph {
  /** Map of task ID to task node */
  nodes: Map<string, ITaskNode>;
  /** Adjacency list: task ID -> array of dependent task IDs */
  edges: Map<string, string[]>;
}
