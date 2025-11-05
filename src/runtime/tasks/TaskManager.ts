import { TaskRequest, TaskPriority } from "./TaskRequest";
import { BuildAction, HarvestAction, RepairAction, TransferAction, UpgradeAction, WithdrawAction } from "./TaskAction";

export interface TaskManagerConfig {
  cpuThreshold?: number;
  logger?: Pick<Console, "log" | "warn">;
}

/**
 * Manages task creation, assignment, and execution for a room.
 * Based on Jon Winsley's task management architecture.
 * Enhanced with CPU threshold management for tick budget control.
 */
export class TaskManager {
  private tasks: Map<string, TaskRequest> = new Map();
  private nextTaskId = 0;
  private readonly cpuThreshold: number;
  private readonly logger: Pick<Console, "log" | "warn">;

  public constructor(config: TaskManagerConfig = {}) {
    this.cpuThreshold = config.cpuThreshold ?? 0.8;
    this.logger = config.logger ?? console;
  }

  /**
   * Generate tasks based on room state
   */
  public generateTasks(room: Room): void {
    // Generate harvest tasks
    this.generateHarvestTasks(room);

    // Generate build tasks
    this.generateBuildTasks(room);

    // Generate repair tasks
    this.generateRepairTasks(room);

    // Generate upgrade tasks
    this.generateUpgradeTasks(room);

    // Generate energy distribution tasks
    this.generateEnergyDistributionTasks(room);

    // Cleanup expired tasks
    this.cleanupExpiredTasks();
  }

  /**
   * Find and assign tasks to idle creeps
   */
  public assignTasks(creeps: Creep[]): void {
    // Get idle creeps (no current task)
    const idleCreeps = creeps.filter(c => !c.memory.taskId || !this.tasks.get(c.memory.taskId as string));

    for (const creep of idleCreeps) {
      const task = this.findBestTask(creep);
      if (task && task.assign(creep)) {
        creep.memory.taskId = task.id;
      }
    }
  }

  /**
   * Execute tasks for all creeps with CPU threshold management.
   * Stops execution when CPU usage exceeds the configured threshold.
   */
  public executeTasks(creeps: Creep[], cpuLimit: number): Record<string, number> {
    const taskCounts: Record<string, number> = {};
    const cpuBudget = cpuLimit * this.cpuThreshold;
    let skippedCreeps = 0;
    let processedCreeps = 0;

    for (const creep of creeps) {
      // Check CPU budget before processing each creep
      if (Game.cpu.getUsed() > cpuBudget) {
        skippedCreeps = creeps.length - processedCreeps;
        if (skippedCreeps > 0) {
          this.logger.warn?.(
            `[TaskManager] CPU threshold reached (${Game.cpu.getUsed().toFixed(2)}/${cpuBudget.toFixed(2)}), ` +
              `skipping ${skippedCreeps} creep tasks`
          );
        }
        break;
      }

      const taskId = creep.memory.taskId as string | undefined;
      if (!taskId) {
        processedCreeps++;
        continue;
      }

      const task = this.tasks.get(taskId);
      if (!task) {
        delete creep.memory.taskId;
        processedCreeps++;
        continue;
      }

      // Execute the task
      const complete = task.execute(creep);

      // Track task type for metrics
      const taskType = task.task.constructor.name;
      taskCounts[taskType] = (taskCounts[taskType] ?? 0) + 1;

      if (complete) {
        delete creep.memory.taskId;
        this.tasks.delete(taskId);
      }

      processedCreeps++;
    }

    return taskCounts;
  }

  /**
   * Find the best task for a creep based on prerequisites and priority
   */
  private findBestTask(creep: Creep): TaskRequest | null {
    const availableTasks = Array.from(this.tasks.values())
      .filter(t => t.status === "PENDING")
      .sort((a, b) => b.priority - a.priority);

    for (const task of availableTasks) {
      if (task.canAssign(creep)) {
        return task;
      }
    }

    return null;
  }

  private generateHarvestTasks(room: Room): void {
    const sources = room.find(FIND_SOURCES_ACTIVE);

    for (const source of sources) {
      // Check if there's already a harvest task for this source
      const existingTask = Array.from(this.tasks.values()).find(
        t => t.status !== "COMPLETE" && t.task instanceof HarvestAction
      );

      if (!existingTask) {
        const task = new HarvestAction(source.id);
        const request = new TaskRequest(this.getNextTaskId(), task, TaskPriority.NORMAL, Game.time + 50);
        this.tasks.set(request.id, request);
      }
    }
  }

  private generateBuildTasks(room: Room): void {
    const sites = room.find(FIND_CONSTRUCTION_SITES);

    for (const site of sites) {
      // Check if there's already a build task for this site
      const existingTask = Array.from(this.tasks.values()).find(t => {
        if (t.status === "COMPLETE" || !(t.task instanceof BuildAction)) {
          return false;
        }
        return t.task.getSiteId() === site.id;
      });

      if (!existingTask) {
        const task = new BuildAction(site.id);
        const priority = site.structureType === STRUCTURE_SPAWN ? TaskPriority.HIGH : TaskPriority.NORMAL;
        const request = new TaskRequest(this.getNextTaskId(), task, priority, Game.time + 100);
        this.tasks.set(request.id, request);
      }
    }
  }

  private generateRepairTasks(room: Room): void {
    const structures = room.find(FIND_STRUCTURES, {
      filter: (s: Structure) => {
        if (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) {
          return false;
        }
        return s.hits < s.hitsMax * 0.7;
      }
    });

    for (const structure of structures.slice(0, 3)) {
      // Limit repair tasks
      const existingTask = Array.from(this.tasks.values()).find(t => {
        if (t.status === "COMPLETE" || !(t.task instanceof RepairAction)) {
          return false;
        }
        return t.task.getStructureId() === structure.id;
      });

      if (!existingTask) {
        const task = new RepairAction(structure.id);
        const request = new TaskRequest(this.getNextTaskId(), task, TaskPriority.LOW, Game.time + 50);
        this.tasks.set(request.id, request);
      }
    }
  }

  private generateUpgradeTasks(room: Room): void {
    const controller = room.controller;
    if (!controller || !controller.my) return;

    // Always keep one upgrade task available
    const existingTask = Array.from(this.tasks.values()).find(
      t => t.status !== "COMPLETE" && t.task instanceof UpgradeAction
    );

    if (!existingTask) {
      const task = new UpgradeAction(controller.id);
      const request = new TaskRequest(this.getNextTaskId(), task, TaskPriority.NORMAL, Game.time + 100);
      this.tasks.set(request.id, request);
    }
  }

  private generateEnergyDistributionTasks(room: Room): void {
    // Find structures needing energy
    const needEnergy: AnyStoreStructure[] = room.find(FIND_MY_STRUCTURES, {
      filter: (s: AnyStructure) => {
        if (s.structureType !== STRUCTURE_SPAWN && s.structureType !== STRUCTURE_EXTENSION) {
          return false;
        }
        const store = s as AnyStoreStructure;
        return store.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    }) as AnyStoreStructure[];

    if (needEnergy.length === 0) return;

    // Find available energy sources
    const energySources: AnyStoreStructure[] = room.find(FIND_STRUCTURES, {
      filter: (s: AnyStructure) => {
        if (s.structureType !== STRUCTURE_STORAGE && s.structureType !== STRUCTURE_CONTAINER) {
          return false;
        }
        const store = s as AnyStoreStructure;
        return store.store.getUsedCapacity(RESOURCE_ENERGY) > 100;
      }
    });

    if (energySources.length === 0) return;

    // Limit the number of distribution tasks
    const existingDistributionTasks = Array.from(this.tasks.values()).filter(
      t => t.status !== "COMPLETE" && (t.task instanceof WithdrawAction || t.task instanceof TransferAction)
    );

    if (existingDistributionTasks.length < 2) {
      const source = energySources[0];
      const target = needEnergy[0];

      // Create withdraw task
      const withdrawTask = new WithdrawAction(source.id, RESOURCE_ENERGY);
      const withdrawRequest = new TaskRequest(this.getNextTaskId(), withdrawTask, TaskPriority.HIGH, Game.time + 50);
      this.tasks.set(withdrawRequest.id, withdrawRequest);

      // Create transfer task
      const transferTask = new TransferAction(target.id, RESOURCE_ENERGY);
      const transferRequest = new TaskRequest(this.getNextTaskId(), transferTask, TaskPriority.HIGH, Game.time + 50);
      this.tasks.set(transferRequest.id, transferRequest);
    }
  }

  private cleanupExpiredTasks(): void {
    for (const [id, task] of this.tasks) {
      if (task.status === "COMPLETE" || task.isExpired()) {
        this.tasks.delete(id);
      }
    }
  }

  private getNextTaskId(): string {
    return `task-${Game.time}-${this.nextTaskId++}`;
  }

  /**
   * Get current task statistics
   */
  public getStats(): { total: number; pending: number; inProgress: number; complete: number } {
    const stats = {
      total: this.tasks.size,
      pending: 0,
      inProgress: 0,
      complete: 0
    };

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case "PENDING":
          stats.pending++;
          break;
        case "INPROCESS":
          stats.inProgress++;
          break;
        case "COMPLETE":
          stats.complete++;
          break;
      }
    }

    return stats;
  }
}
