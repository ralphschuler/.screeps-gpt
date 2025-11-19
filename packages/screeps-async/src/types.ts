/**
 * Type definitions for screeps-async package
 */

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface TaskState {
  id: string;
  status: TaskStatus;
  result?: unknown;
  error?: string;
  tickCreated: number;
  tickCompleted?: number;
  ticksExecuted: number;
  generatorState?: unknown;
}

export interface TaskOptions {
  maxTicks?: number;
  cpuBudget?: number;
  priority?: number;
  cleanupAfterTicks?: number;
}

export type TaskGenerator<T = unknown> = Generator<void, T, void>;
export type TaskGeneratorFn<T = unknown> = () => TaskGenerator<T>;
export type TaskSuccessCallback<T = unknown> = (result: T) => void;
export type TaskErrorCallback = (error: Error) => void;

export interface TaskRunnerConfig {
  maxCpuPerTick?: number;
  defaultCleanupDelay?: number;
  debug?: boolean;
}

export interface TaskStats {
  activeTasks: number;
  byStatus: Record<TaskStatus, number>;
  cpuUsed: number;
  completedThisTick: number;
  failedThisTick: number;
}
