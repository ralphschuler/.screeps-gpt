import { TaskRequest, TaskPriority } from "./TaskRequest";
import {
  BuildAction,
  HarvestAction,
  RepairAction,
  TransferAction,
  UpgradeAction,
  WithdrawAction,
  PickupAction,
  DismantleAction,
  RecycleAction,
  TowerAttackAction,
  TowerRepairAction,
  LinkTransferAction
} from "./TaskAction";
import { PathfindingManager } from "@runtime/pathfinding";

export interface TaskManagerConfig {
  cpuThreshold?: number;
  logger?: Pick<Console, "log" | "warn">;
  pathfindingProvider?: "default" | "cartographer";
  maxTasks?: number;
}

/**
 * Maximum number of tasks to keep in the queue to prevent unbounded growth
 */
const DEFAULT_MAX_TASKS = 25;

/**
 * Maximum percentage of queue that can be occupied by a single task type
 * This prevents any one task type from dominating the queue
 */
const MAX_TASK_TYPE_RATIO = 0.4;

/**
 * Manages task creation, assignment, and execution for a room.
 * Based on Jon Winsley's task management architecture.
 * Enhanced with CPU threshold management for tick budget control.
 */
export class TaskManager {
  private tasks: Map<string, TaskRequest> = new Map();
  private nextTaskId = 0;
  private readonly cpuThreshold: number;
  private readonly maxTasks: number;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly pathfindingManager: PathfindingManager;
  private tickOffset = 0;
  private lastExecuted: Map<string, number> = new Map();

  public constructor(config: TaskManagerConfig = {}) {
    this.cpuThreshold = config.cpuThreshold ?? 0.8;
    this.maxTasks = config.maxTasks ?? DEFAULT_MAX_TASKS;
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

    // Generate pickup tasks for dropped resources
    this.generatePickupTasks(room);

    // Generate recycle tasks for old/wounded creeps
    this.generateRecycleTasks(room);

    // Generate tower tasks for defense and repair
    this.generateTowerTasks(room);

    // Generate link transfer tasks
    this.generateLinkTransferTasks(room);

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
   * Find the best task for a creep based on prerequisites, priority, and distance.
   * Prioritizes high-priority tasks, but among tasks of the same priority,
   * prefers closer tasks to minimize travel time and improve efficiency.
   */
  private findBestTask(creep: Creep): TaskRequest | null {
    const availableTasks = Array.from(this.tasks.values())
      .filter(t => t.status === "PENDING")
      .filter(t => t.canAssign(creep));

    if (availableTasks.length === 0) {
      return null;
    }

    // Sort by priority (descending), then by distance (ascending)
    availableTasks.sort((a, b) => {
      // Primary sort: priority (higher is better)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Secondary sort: distance (shorter is better)
      const distA = this.calculateTaskDistance(creep, a);
      const distB = this.calculateTaskDistance(creep, b);

      // If either distance is Infinity (task target not found), deprioritize it
      if (distA === Infinity && distB === Infinity) return 0;
      if (distA === Infinity) return 1;
      if (distB === Infinity) return -1;

      return distA - distB;
    });

    return availableTasks[0];
  }

  /**
   * Calculate the distance from a creep to a task's target.
   * Uses linear range calculation for efficiency.
   * @returns Distance in tiles, or Infinity if target position cannot be determined
   */
  private calculateTaskDistance(creep: Creep, task: TaskRequest): number {
    const targetPos = task.task.getTargetPos();

    if (!targetPos) {
      return Infinity; // Target doesn't exist or can't be determined
    }

    // Use linear range for efficiency (avoids pathfinding cost)
    // This is sufficient for task assignment; actual pathfinding happens during movement
    return creep.pos.getRangeTo(targetPos);
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
        const added = this.addTaskWithEviction(request);
        if (!added) {
          this.logger.warn?.(
            `[TaskManager] Failed to add harvest task for source ${source.id} in room ${room.name} at tick ${Game.time}`
          );
        }
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
      this.addTaskWithEviction(request);
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
        this.addTaskWithEviction(request);
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
        this.addTaskWithEviction(request);
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
      this.addTaskWithEviction(request);
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
      this.addTaskWithEviction(withdrawRequest);

      // Create transfer task
      const transferTask = this.configureTaskAction(new TransferAction(target.id, RESOURCE_ENERGY));
      const transferRequest = new TaskRequest(this.getNextTaskId(), transferTask, TaskPriority.HIGH, Game.time + 50);
      this.addTaskWithEviction(transferRequest);
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
   * Add a task to the queue with priority-based eviction and spam prevention.
   * If the queue is full, drops the lowest priority PENDING task to make room.
   * Prevents spam by limiting tasks of the same type to a maximum percentage of the queue.
   *
   * @param request - The task request to add
   * @returns true if task was added, false if it was rejected
   */
  private addTaskWithEviction(request: TaskRequest): boolean {
    const taskType = request.task.constructor.name;

    // Check for task type spam - limit each task type to MAX_TASK_TYPE_RATIO of max queue size
    const maxTasksPerType = Math.floor(this.maxTasks * MAX_TASK_TYPE_RATIO);
    // Only count active tasks (PENDING or INPROCESS), not COMPLETE tasks which will be cleaned up
    const existingTasksOfType = Array.from(this.tasks.values()).filter(
      t => t.task.constructor.name === taskType && (t.status === "PENDING" || t.status === "INPROCESS")
    );

    if (existingTasksOfType.length >= maxTasksPerType) {
      // Too many tasks of this type already - check if we can evict one
      const pendingTasksOfSameType = existingTasksOfType.filter(t => t.status === "PENDING");

      if (pendingTasksOfSameType.length > 0) {
        // Find the lowest priority task of the same type (avoid mutating original array)
        const lowestPrioritySameType = [...pendingTasksOfSameType].sort((a, b) => a.priority - b.priority)[0];

        // Only evict if the new task has higher priority
        if (request.priority > lowestPrioritySameType.priority) {
          this.tasks.delete(lowestPrioritySameType.id);
          this.tasks.set(request.id, request);
          this.logger.log?.(
            `[TaskManager] Replaced ${taskType} task ${lowestPrioritySameType.id} (priority ${lowestPrioritySameType.priority}) ` +
              `with ${request.id} (priority ${request.priority})`
          );
          return true;
        }
      }

      // Can't add - too many of this type and none can be evicted
      return false;
    }

    // If queue has room, just add the task
    if (this.tasks.size < this.maxTasks) {
      this.tasks.set(request.id, request);
      return true;
    }

    // Queue is full - find the lowest priority PENDING task (any type)
    // Use reduce to find minimum without sorting for better performance
    const pendingTasks = Array.from(this.tasks.values()).filter(t => t.status === "PENDING");

    // If there are no pending tasks, we can't evict anything (all tasks are in progress)
    if (pendingTasks.length === 0) {
      this.logger.warn?.(
        `[TaskManager] Cannot add task ${request.id} - queue full (${this.tasks.size}/${this.maxTasks}) with no PENDING tasks to evict`
      );
      return false;
    }

    const lowestPriorityTask = pendingTasks.reduce((min, task) => (task.priority < min.priority ? task : min));

    // Only evict if the new task has higher priority than the lowest priority task
    if (request.priority <= lowestPriorityTask.priority) {
      // New task is lower or equal priority - reject it
      return false;
    }

    // Evict the lowest priority task and add the new one
    this.tasks.delete(lowestPriorityTask.id);
    this.tasks.set(request.id, request);

    this.logger.log?.(
      `[TaskManager] Evicted task ${lowestPriorityTask.id} (priority ${lowestPriorityTask.priority}) ` +
        `to make room for ${request.id} (priority ${request.priority})`
    );

    return true;
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

  /**
   * Generate tasks for picking up dropped resources
   */
  private generatePickupTasks(room: Room): void {
    const droppedResources = room.find(FIND_DROPPED_RESOURCES, {
      filter: r => r.amount > 50 // Only pick up resources with significant amounts
    });

    for (const resource of droppedResources) {
      // Count existing pickup tasks for this specific resource
      const existingTasks = Array.from(this.tasks.values()).filter(t => {
        if (t.status === "COMPLETE" || !(t.task instanceof PickupAction)) {
          return false;
        }
        return t.task.getResourceId() === resource.id;
      });

      // Generate 1 pickup task per resource
      if (existingTasks.length === 0) {
        const task = this.configureTaskAction(new PickupAction(resource.id));
        const priority = resource.resourceType === RESOURCE_ENERGY ? TaskPriority.NORMAL : TaskPriority.LOW;
        const request = new TaskRequest(this.getNextTaskId(), task, priority, Game.time + 20);
        this.addTaskWithEviction(request);
      }
    }
  }

  /**
   * Generate tasks for recycling old or wounded creeps
   */
  private generateRecycleTasks(room: Room): void {
    const spawns = room.find(FIND_MY_SPAWNS);
    if (spawns.length === 0) return;

    const spawn = spawns[0];

    // Find creeps that should be recycled
    const creepsToRecycle = room.find(FIND_MY_CREEPS, {
      filter: c => {
        // Recycle if TTL is very low or if critically damaged
        const lowTTL = c.ticksToLive !== undefined && c.ticksToLive < 50;
        const criticallyDamaged = c.hits < c.hitsMax * 0.3;
        return lowTTL || criticallyDamaged;
      }
    });

    for (const creep of creepsToRecycle) {
      // Check if creep already has a recycle task
      if (creep.memory.taskId) {
        const existingTask = this.tasks.get(creep.memory.taskId);
        if (existingTask && existingTask.task instanceof RecycleAction) {
          continue; // Already has recycle task
        }
      }

      // Generate recycle task
      const task = this.configureTaskAction(new RecycleAction(spawn.id));
      const request = new TaskRequest(this.getNextTaskId(), task, TaskPriority.LOW, Game.time + 100);
      this.addTaskWithEviction(request);
    }
  }

  /**
   * Generate tasks for towers (defense and repair)
   * Note: This generates task requests that can be used to track tower actions,
   * but actual tower logic is typically handled by TowerManager for immediate response.
   * These tasks are useful for strategic planning and metrics tracking.
   */
  private generateTowerTasks(room: Room): void {
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_TOWER
    }) as StructureTower[];

    if (towers.length === 0) return;

    // Generate attack tasks for hostile creeps
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
      for (const tower of towers) {
        // Only create one attack task per tower
        const existingTasks = Array.from(this.tasks.values()).filter(
          t => t.status !== "COMPLETE" && t.task instanceof TowerAttackAction && t.task.getTowerId() === tower.id
        );

        if (existingTasks.length === 0) {
          const closestHostile = tower.pos.findClosestByRange(hostiles);
          if (closestHostile) {
            const task = this.configureTaskAction(new TowerAttackAction(tower.id, closestHostile.id));
            const request = new TaskRequest(this.getNextTaskId(), task, TaskPriority.CRITICAL, Game.time + 10);
            this.addTaskWithEviction(request);
          }
        }
      }
    }

    // Generate repair tasks for damaged structures
    const damagedStructures = room.find(FIND_STRUCTURES, {
      filter: (s: Structure) => {
        if (!("hits" in s) || typeof s.hits !== "number") return false;
        if (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) return false;
        return s.hits < s.hitsMax * 0.7;
      }
    });

    if (damagedStructures.length > 0) {
      for (const tower of towers) {
        // Only create one repair task per tower
        const existingTasks = Array.from(this.tasks.values()).filter(
          t => t.status !== "COMPLETE" && t.task instanceof TowerRepairAction && t.task.getTowerId() === tower.id
        );

        if (existingTasks.length === 0) {
          const closestDamaged = tower.pos.findClosestByRange(damagedStructures);
          if (closestDamaged) {
            const task = this.configureTaskAction(new TowerRepairAction(tower.id, closestDamaged.id));
            const request = new TaskRequest(this.getNextTaskId(), task, TaskPriority.LOW, Game.time + 50);
            this.addTaskWithEviction(request);
          }
        }
      }
    }
  }

  /**
   * Generate tasks for transferring energy between links
   */
  private generateLinkTransferTasks(room: Room): void {
    const links = room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_LINK
    }) as StructureLink[];

    if (links.length < 2) return;

    // Find source links (near sources or storage) with energy
    const sourceLinks = links.filter(
      link => link.store.getUsedCapacity(RESOURCE_ENERGY) > link.store.getCapacity(RESOURCE_ENERGY) * 0.8
    );

    // Find target links (near controller or extensions) with free capacity
    const targetLinks = links.filter(
      link => link.store.getFreeCapacity(RESOURCE_ENERGY) > link.store.getCapacity(RESOURCE_ENERGY) * 0.5
    );

    if (sourceLinks.length === 0 || targetLinks.length === 0) return;

    // Check for existing link transfer tasks
    const existingTasks = Array.from(this.tasks.values()).filter(
      t => t.status !== "COMPLETE" && t.task instanceof LinkTransferAction
    );

    // Limit to 2 concurrent link transfer tasks
    if (existingTasks.length < 2) {
      const sourceLink = sourceLinks[0];
      const targetLink = targetLinks[0];

      const task = this.configureTaskAction(new LinkTransferAction(sourceLink.id, targetLink.id));
      const request = new TaskRequest(this.getNextTaskId(), task, TaskPriority.NORMAL, Game.time + 20);
      this.addTaskWithEviction(request);
    }
  }
}
