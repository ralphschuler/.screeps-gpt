export interface BehaviorSummary {
  processedCreeps: number;
  spawnedCreeps: string[];
  tasksExecuted: Record<string, number>;
}

export interface PerformanceSnapshot {
  tick: number;
  cpuUsed: number;
  cpuLimit: number;
  cpuBucket: number;
  creepCount: number;
  roomCount: number;
  spawnOrders: number;
  warnings: string[];
  execution: BehaviorSummary;
}

export interface CoverageSummary {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface RepositorySignal {
  coverage?: CoverageSummary;
  lintErrors?: number;
  testFailures?: number;
  timestamp: string;
}

export type EvaluationSeverity = "info" | "warning" | "critical";

export interface EvaluationFinding {
  severity: EvaluationSeverity;
  title: string;
  detail: string;
  recommendation: string;
}

export interface SystemReport {
  tick: number;
  summary: string;
  findings: EvaluationFinding[];
  repository?: RepositorySignal;
}

export interface EvaluationResult {
  report: SystemReport;
  persisted: boolean;
}

/**
 * Task priority levels for workload prioritization
 */
export enum TaskPriority {
  CRITICAL = 100,
  HIGH = 75,
  NORMAL = 50,
  LOW = 25,
  IDLE = 0
}

/**
 * Task status tracking
 */
export type TaskStatus = "PENDING" | "INPROCESS" | "COMPLETE" | "FAILED";

/**
 * Base interface for all task types in the task system.
 * Tasks represent discrete units of work that can be assigned to creeps.
 */
export interface Task {
  /** Unique identifier for this task */
  id: string;

  /** Human-readable type identifier (e.g., "harvest", "build", "upgrade") */
  type: string;

  /** Current status of the task */
  status: TaskStatus;

  /** Priority level (higher = more important) */
  priority: TaskPriority;

  /** Creep assigned to this task (if any) */
  assignedCreep?: Id<Creep>;

  /** Tick when task was created */
  createdAt: number;

  /** Optional deadline for task completion */
  deadline?: number;

  /** Target game object ID (source, construction site, structure, etc.) */
  targetId?: Id<RoomObject>;

  /** Target room name for cross-room tasks */
  targetRoom?: string;

  /**
   * Check if this task can be assigned to a creep
   */
  canAssign(creep: Creep): boolean;

  /**
   * Assign this task to a creep
   * @returns true if assignment succeeded
   */
  assign(creep: Creep): boolean;

  /**
   * Execute the task action with the assigned creep
   * @returns true if task is complete
   */
  execute(creep: Creep): boolean;

  /**
   * Check if task has expired
   */
  isExpired(): boolean;
}
