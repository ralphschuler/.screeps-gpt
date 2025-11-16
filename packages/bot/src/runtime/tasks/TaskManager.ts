import { TaskRequest, TaskPriority } from "./TaskRequest";
import { BuildAction, HarvestAction, RepairAction, TransferAction, UpgradeAction, WithdrawAction } from "./TaskAction";
import { PathfindingManager } from "@runtime/pathfinding";

export interface TaskManagerConfig {
  cpuThreshold?: number;
  logger?: Pick<Console, "log" | "warn">;
  pathfindingProvider?: "default" | "cartographer";
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
  private readonly pathfindingManager: PathfindingManager;
  private tickOffset = 0;
  private lastExecuted: Map<string, number> = new Map();

  public constructor(config: TaskManagerConfig = {}) {
    this.cpuThreshold = config.cpuThreshold ?? 0.8;
    this.logger = config.logger ?? console;
    this.pathfindingManager = new PathfindingManager({
      provider: config.pathfindingProvider ?? "default",
      logger: this.logger
    });
  }

  /**
   * Helper to configure a task action with pathfinding manager
   */
  private configureTaskAction<T extends { setPathfindingManager(manager: PathfindingManager): void }>(action: T): T {
    action.setPathfindingManager(this.pathfindingManager);
    return action;
  }

  /**
   * Generate tasks based on room state
   */
  public generateTasks(room: Room): void {
    // Generate harvest tasks
    this.generateHarvestTasks(room);

    // Generate container deposit tasks (for harvesters to deposit into containers)
    this.generateContainerDepositTasks(room);

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
    const idleCreeps = creeps.filter(c => !c.memory.taskId || !this.tasks.get(c.memory.taskId));

    for (const creep of idleCreeps) {
      const task = this.findBestTask(creep);
      if (task?.assign(creep)) {
        creep.memory.taskId = task.id;
      }
    }
  }

  /**
   * Execute tasks for all creeps with CPU threshold management.
   * Uses round-robin scheduling to ensure fair execution across all creeps.
   * Stops execution when CPU usage exceeds the configured threshold.
   */
  public executeTasks(creeps: Creep[], cpuLimit: number): Record<string, number> {
    const taskCounts: Record<string, number> = {};
    const cpuBudget = cpuLimit * this.cpuThreshold;
    let skippedCreeps = 0;
    let processedCreeps = 0;

    // Apply round-robin scheduling to prevent starvation
    // Rotate starting position each tick for fair CPU distribution
    let orderedCreeps = creeps;
    if (creeps.length > 0) {
      // Ensure offset is valid for current creep count
      const validOffset = this.tickOffset % creeps.length;
      orderedCreeps = [...creeps.slice(validOffset), ...creeps.slice(0, validOffset)];
      this.tickOffset = (validOffset + 1) % creeps.length;
    }

    for (const creep of orderedCreeps) {
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

      const taskId = creep.memory.taskId;
      if (!taskId) {
        processedCreeps++;
        this.lastExecuted.set(creep.name, Game.time);
        continue;
      }

      const task = this.tasks.get(taskId);
      if (!task) {
        delete creep.memory.taskId;
        processedCreeps++;
        this.lastExecuted.set(creep.name, Game.time);
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

      // Record execution time for starvation tracking
      this.lastExecuted.set(creep.name, Game.time);
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
      // Count existing harvest tasks for this specific source
      const existingTasks = Array.from(this.tasks.values()).filter(t => {
        if (t.status === "COMPLETE" || !(t.task instanceof HarvestAction)) {
          return false;
        }
        return t.task.getSourceId() === source.id;
      });

      // Generate up to 2 harvest tasks per source
      const tasksNeeded = 2 - existingTasks.length;
      for (let i = 0; i < tasksNeeded; i++) {
        const task = this.configureTaskAction(new HarvestAction(source.id));
        const request = new TaskRequest(this.getNextTaskId(), task, TaskPriority.NORMAL, Game.time + 50);
        this.tasks.set(request.id, request);
      }
    }
  }

  /**
   * Generate tasks for depositing harvested energy into containers.
   * This ensures harvesters have a follow-up task after completing harvest.
   */
  private generateContainerDepositTasks(room: Room): void {
    // Find containers with free capacity
    const allStructures = room.find(FIND_STRUCTURES);
    const containers = allStructures.filter((s): s is StructureContainer => {
      return s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
    });

    if (containers.length === 0) return;

    // Only count transfer tasks whose target is a container in this room
    const containerIds = new Set(containers.map(c => c.id));
    const containerTransferTasks = Array.from(this.tasks.values()).filter(
      t =>
        t.status !== "COMPLETE" &&
        t.task instanceof TransferAction &&
        containerIds.has(t.task.getTargetId() as Id<StructureContainer>)
    );

    // Create transfer tasks for containers with capacity
    // Process up to 2 containers per tick, with a global limit of 4 concurrent container deposit tasks
    for (const container of containers.slice(0, 2)) {
      if (containerTransferTasks.length >= 4) {
        break;
      }

      const task = this.configureTaskAction(new TransferAction(container.id, RESOURCE_ENERGY));
      // Higher priority than general transfer tasks to ensure harvesters deposit quickly
      const request = new TaskRequest(this.getNextTaskId(), task, TaskPriority.HIGH, Game.time + 50);
      this.tasks.set(request.id, request);
      containerTransferTasks.push(request);
    }
  }

  private generateBuildTasks(room: Room): void {
    const sites = room.find(FIND_CONSTRUCTION_SITES);

    for (const site of sites) {
      // Count existing build tasks for this specific site
      const existingTasks = Array.from(this.tasks.values()).filter(t => {
        if (t.status === "COMPLETE" || !(t.task instanceof BuildAction)) {
          return false;
        }
        return t.task.getSiteId() === site.id;
      });

      // Generate up to 2 build tasks per construction site to allow multiple builders
      const tasksNeeded = 2 - existingTasks.length;
      for (let i = 0; i < tasksNeeded; i++) {
        const task = this.configureTaskAction(new BuildAction(site.id));
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

    // Prioritize roads over other structures for repair
    const roads = structures.filter(s => s.structureType === STRUCTURE_ROAD);
    const otherStructures = structures.filter(s => s.structureType !== STRUCTURE_ROAD);

    // Prioritize roads, then other structures
    const prioritized = [...roads.slice(0, 2), ...otherStructures.slice(0, 1)];

    for (const structure of prioritized) {
      // Count existing repair tasks for this specific structure
      const existingTasks = Array.from(this.tasks.values()).filter(t => {
        if (t.status === "COMPLETE" || !(t.task instanceof RepairAction)) {
          return false;
        }
        return t.task.getStructureId() === structure.id;
      });

      // Generate up to 2 repair tasks per structure to allow multiple repairers
      const tasksNeeded = 2 - existingTasks.length;
      for (let i = 0; i < tasksNeeded; i++) {
        const task = this.configureTaskAction(new RepairAction(structure.id));
        // Roads get normal priority, other structures get low priority
        const priority = structure.structureType === STRUCTURE_ROAD ? TaskPriority.NORMAL : TaskPriority.LOW;
        const request = new TaskRequest(this.getNextTaskId(), task, priority, Game.time + 50);
        this.tasks.set(request.id, request);
      }
    }
  }

  private generateUpgradeTasks(room: Room): void {
    const controller = room.controller;
    if (!controller?.my) return;

    // Count existing upgrade tasks for this controller
    const existingTasks = Array.from(this.tasks.values()).filter(
      t => t.status !== "COMPLETE" && t.task instanceof UpgradeAction
    );

    // Generate up to 3 upgrade tasks to allow multiple creeps to upgrade simultaneously
    const tasksNeeded = 3 - existingTasks.length;
    for (let i = 0; i < tasksNeeded; i++) {
      const task = this.configureTaskAction(new UpgradeAction(controller.id));
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
      const withdrawTask = this.configureTaskAction(new WithdrawAction(source.id, RESOURCE_ENERGY));
      const withdrawRequest = new TaskRequest(this.getNextTaskId(), withdrawTask, TaskPriority.HIGH, Game.time + 50);
      this.tasks.set(withdrawRequest.id, withdrawRequest);

      // Create transfer task
      const transferTask = this.configureTaskAction(new TransferAction(target.id, RESOURCE_ENERGY));
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

  /**
   * Get starvation statistics for monitoring.
   * Returns creeps that haven't been processed in multiple ticks.
   */
  public getStarvationStats(creeps: Creep[]): {
    starvedCreeps: string[];
    maxTicksSinceExecution: number;
    avgTicksSinceExecution: number;
  } {
    const currentTick = Game.time;
    const ticksSinceExecution: number[] = [];
    const starvedCreeps: string[] = [];

    for (const creep of creeps) {
      const lastTick = this.lastExecuted.get(creep.name);
      if (lastTick !== undefined) {
        const ticksSince = currentTick - lastTick;
        ticksSinceExecution.push(ticksSince);
        // Consider creep starved if not executed in 5+ ticks
        if (ticksSince >= 5) {
          starvedCreeps.push(creep.name);
        }
      }
      // Note: Creeps never executed are not included in stats
      // This is intentional to avoid skewing metrics on initial spawn
    }

    const maxTicksSinceExecution = ticksSinceExecution.length > 0 ? Math.max(...ticksSinceExecution) : 0;
    const avgTicksSinceExecution =
      ticksSinceExecution.length > 0 ? ticksSinceExecution.reduce((a, b) => a + b, 0) / ticksSinceExecution.length : 0;

    return {
      starvedCreeps,
      maxTicksSinceExecution,
      avgTicksSinceExecution
    };
  }
}
