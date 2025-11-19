import { Task } from "./Task";
import type { TaskState, TaskStatus, TaskGeneratorFn, TaskOptions, TaskRunnerConfig, TaskStats } from "./types";

export class TaskRunner {
  private tasks: Map<string, Task<unknown>> = new Map();
  private readonly config: Required<TaskRunnerConfig>;
  private readonly memory: {
    tasks?: Record<string, TaskState>;
  };

  public constructor(memory: { tasks?: Record<string, TaskState> }, config: TaskRunnerConfig = {}) {
    this.memory = memory;
    this.config = {
      maxCpuPerTick: config.maxCpuPerTick ?? Infinity,
      defaultCleanupDelay: config.defaultCleanupDelay ?? 10,
      debug: config.debug ?? false
    };

    if (!this.memory.tasks) {
      this.memory.tasks = {};
    }
  }

  public createTask<T>(id: string, generatorFn: TaskGeneratorFn<T>, options: TaskOptions = {}): Task<T> {
    if (this.tasks.has(id)) {
      throw new Error(`Task with id '${id}' already exists`);
    }

    const taskOptions: TaskOptions = {
      ...options,
      cleanupAfterTicks: options.cleanupAfterTicks ?? this.config.defaultCleanupDelay
    };

    const task = new Task(id, generatorFn, taskOptions);
    this.tasks.set(id, task as Task<unknown>);

    if (this.config.debug) {
      console.log(`[TaskRunner] Created task: ${id}`);
    }

    return task;
  }

  public getTask(id: string): Task<unknown> | undefined {
    return this.tasks.get(id);
  }

  public hasTask(id: string): boolean {
    return this.tasks.has(id);
  }

  public cancelTask(id: string, reason?: string): boolean {
    const task = this.tasks.get(id);
    if (task) {
      task.cancel(reason);
      if (this.config.debug) {
        console.log(`[TaskRunner] Cancelled task: ${id} - ${reason ?? "No reason provided"}`);
      }
      return true;
    }
    return false;
  }

  public getNextTask(): Task<unknown> | undefined {
    const activeTasks = Array.from(this.tasks.values())
      .filter(task => !task.isComplete())
      .sort((a, b) => b.getPriority() - a.getPriority());

    return activeTasks[0];
  }

  public runNext(): TaskState | undefined {
    const task = this.getNextTask();
    if (!task) {
      return undefined;
    }

    const state = task.run();

    if (task.shouldCleanup()) {
      this.tasks.delete(task.id);
      if (this.memory.tasks && this.memory.tasks[task.id]) {
        delete this.memory.tasks[task.id];
      }
    } else {
      if (this.memory.tasks) {
        this.memory.tasks[task.id] = task.serialize();
      }
    }

    return state;
  }

  public runTask(id: string): TaskState | undefined {
    const task = this.tasks.get(id);
    if (!task) {
      return undefined;
    }

    const state = task.run();

    if (task.shouldCleanup()) {
      this.tasks.delete(task.id);
      if (this.memory.tasks && this.memory.tasks[task.id]) {
        delete this.memory.tasks[task.id];
      }
    } else {
      if (this.memory.tasks) {
        this.memory.tasks[task.id] = task.serialize();
      }
    }

    return state;
  }

  public runUntilCpuLimit(cpuBudget?: number): number {
    const budget = cpuBudget ?? this.config.maxCpuPerTick;
    const startCpu = Game.cpu.getUsed();
    let tasksExecuted = 0;

    while (true) {
      const cpuUsed = Game.cpu.getUsed() - startCpu;
      if (cpuUsed >= budget) {
        break;
      }

      const state = this.runNext();
      if (!state) {
        break;
      }

      tasksExecuted++;
    }

    if (this.config.debug) {
      const cpuUsed = Game.cpu.getUsed() - startCpu;
      console.log(
        `[TaskRunner] Executed ${tasksExecuted} tasks, CPU: ${cpuUsed.toFixed(2)}/${budget}, Active: ${this.tasks.size}`
      );
    }

    return tasksExecuted;
  }

  public run(): void {
    this.runUntilCpuLimit();
    this.cleanup();
    this.saveToMemory();
  }

  public endTick(): void {
    this.cleanup();
    this.saveToMemory();
  }

  public getStats(): TaskStats {
    const stats: TaskStats = {
      activeTasks: this.tasks.size,
      byStatus: {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      },
      cpuUsed: 0,
      completedThisTick: 0,
      failedThisTick: 0
    };

    for (const task of this.tasks.values()) {
      const state = task.getState();
      stats.byStatus[state.status]++;

      if (state.status === "completed" && state.tickCompleted === Game.time) {
        stats.completedThisTick++;
      }
      if (state.status === "failed" && state.tickCompleted === Game.time) {
        stats.failedThisTick++;
      }
    }

    return stats;
  }

  public clear(): void {
    this.tasks.clear();
    if (this.memory.tasks) {
      this.memory.tasks = {};
    }
    if (this.config.debug) {
      console.log("[TaskRunner] Cleared all tasks");
    }
  }

  public getTaskCount(status?: TaskStatus): number {
    if (!status) {
      return this.tasks.size;
    }

    let count = 0;
    for (const task of this.tasks.values()) {
      if (task.getState().status === status) {
        count++;
      }
    }
    return count;
  }

  private cleanup(): void {
    const toDelete: string[] = [];

    for (const [id, task] of this.tasks.entries()) {
      if (task.shouldCleanup()) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.tasks.delete(id);
      if (this.memory.tasks && this.memory.tasks[id]) {
        delete this.memory.tasks[id];
      }
      if (this.config.debug) {
        console.log(`[TaskRunner] Cleaned up task: ${id}`);
      }
    }
  }

  private saveToMemory(): void {
    if (!this.memory.tasks) {
      this.memory.tasks = {};
    }

    for (const [id, task] of this.tasks.entries()) {
      this.memory.tasks[id] = task.serialize();
    }
  }

  public static restoreFromMemory(
    memory: { tasks?: Record<string, TaskState> },
    taskFactories: Record<string, TaskGeneratorFn<unknown>>,
    config?: TaskRunnerConfig
  ): TaskRunner {
    const runner = new TaskRunner(memory, config);

    if (memory.tasks) {
      for (const [id, state] of Object.entries(memory.tasks)) {
        const factory = taskFactories[id];
        if (factory) {
          const task = Task.deserialize(state, factory);
          runner.tasks.set(id, task);
        } else if (runner.config.debug) {
          console.log(`[TaskRunner] No factory found for task: ${id}`);
        }
      }
    }

    return runner;
  }
}
