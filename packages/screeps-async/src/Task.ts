import type { TaskState, TaskGenerator, TaskGeneratorFn, TaskOptions } from "./types";

/**
 * Represents an asynchronous task that can be paused and resumed across ticks.
 */
export class Task<T = unknown> {
  private generator: TaskGenerator<T> | null = null;
  private state: TaskState;
  private readonly generatorFn: TaskGeneratorFn<T>;
  private readonly options: Required<TaskOptions>;

  public constructor(
    public readonly id: string,
    generatorFn: TaskGeneratorFn<T>,
    options: TaskOptions = {}
  ) {
    this.generatorFn = generatorFn;
    this.options = {
      maxTicks: options.maxTicks ?? Infinity,
      cpuBudget: options.cpuBudget ?? Infinity,
      priority: options.priority ?? 0,
      cleanupAfterTicks: options.cleanupAfterTicks ?? 10
    };

    this.state = {
      id,
      status: "pending",
      tickCreated: Game.time,
      ticksExecuted: 0
    };
  }

  public run(): TaskState {
    if (this.state.status === "completed" || this.state.status === "failed" || this.state.status === "cancelled") {
      return this.state;
    }

    if (this.state.ticksExecuted >= this.options.maxTicks) {
      this.cancel("Task exceeded maximum tick limit");
      return this.state;
    }

    const startCpu = Game.cpu.getUsed();

    try {
      if (this.state.status === "pending") {
        this.generator = this.generatorFn();
        this.state.status = "running";
      }

      if (this.generator) {
        const result = this.generator.next();
        const cpuUsed = Game.cpu.getUsed() - startCpu;

        if (cpuUsed > this.options.cpuBudget) {
          this.state.ticksExecuted++;
          return this.state;
        }

        if (result.done) {
          this.complete(result.value);
        } else {
          this.state.ticksExecuted++;
        }
      }
    } catch (error) {
      this.fail(error);
    }

    return this.state;
  }

  public cancel(reason?: string): void {
    this.state.status = "cancelled";
    this.state.error = reason ?? "Task cancelled";
    this.state.tickCompleted = Game.time;
    this.generator = null;
  }

  public getState(): TaskState {
    return { ...this.state };
  }

  public getPriority(): number {
    return this.options.priority;
  }

  public isComplete(): boolean {
    return this.state.status === "completed" || this.state.status === "failed" || this.state.status === "cancelled";
  }

  public shouldCleanup(): boolean {
    if (!this.isComplete() || !this.state.tickCompleted) {
      return false;
    }
    return Game.time - this.state.tickCompleted >= this.options.cleanupAfterTicks;
  }

  public serialize(): TaskState {
    const state: TaskState = {
      id: this.state.id,
      status: this.state.status,
      result: this.state.result,
      tickCreated: this.state.tickCreated,
      ticksExecuted: this.state.ticksExecuted
    };
    if (this.state.error !== undefined) {
      state.error = this.state.error;
    }
    if (this.state.tickCompleted !== undefined) {
      state.tickCompleted = this.state.tickCompleted;
    }
    return state;
  }

  public static deserialize<T>(state: TaskState, generatorFn: TaskGeneratorFn<T>): Task<T> {
    const task = new Task(state.id, generatorFn);
    task.state = { ...state };

    if (state.status === "running") {
      task.state.status = "failed";
      task.state.error = "Task state lost due to global reset";
      task.state.tickCompleted = Game.time;
    }

    return task;
  }

  private complete(result: T): void {
    this.state.status = "completed";
    this.state.result = result;
    this.state.tickCompleted = Game.time;
    this.generator = null;
  }

  private fail(error: unknown): void {
    this.state.status = "failed";
    this.state.error = error instanceof Error ? error.message : String(error);
    this.state.tickCompleted = Game.time;
    this.generator = null;
  }
}
