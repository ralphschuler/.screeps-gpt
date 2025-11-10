import type { BehaviorSummary } from "@shared/contracts";
import type { CreepLike, GameContext, SpawnLike } from "@runtime/types/GameContext";
import { TaskManager } from "@runtime/tasks";
import { profile } from "@profiler";

type RoleName = "harvester" | "upgrader" | "builder" | "remoteMiner" | "stationaryHarvester" | "hauler";

interface BaseCreepMemory extends CreepMemory {
  role: RoleName;
  task: string;
  version: number;
}

interface ManagedCreep extends CreepLike {
  memory: CreepMemory & Partial<BaseCreepMemory>;
}

interface RoleDefinition {
  minimum: number;
  body: BodyPartConstant[];
  run(creep: ManagedCreep): string;
  memory: () => BaseCreepMemory;
}

const HARVESTER_VERSION = 1;
const UPGRADER_VERSION = 1;
const BUILDER_VERSION = 1;
const REMOTE_MINER_VERSION = 1;
const STATIONARY_HARVESTER_VERSION = 1;
const HAULER_VERSION = 1;

const HARVEST_TASK = "harvest" as const;
const DELIVER_TASK = "deliver" as const;
const RECHARGE_TASK = "recharge" as const;
const UPGRADE_TASK = "upgrade" as const;
const BUILDER_GATHER_TASK = "gather" as const;
const BUILDER_BUILD_TASK = "build" as const;
const BUILDER_MAINTAIN_TASK = "maintain" as const;
const REMOTE_TRAVEL_TASK = "travel" as const;
const REMOTE_MINE_TASK = "mine" as const;
const REMOTE_RETURN_TASK = "return" as const;
const STATIONARY_HARVEST_TASK = "stationaryHarvest" as const;
const HAULER_PICKUP_TASK = "pickup" as const;
const HAULER_DELIVER_TASK = "haulerDeliver" as const;

type HarvesterTask = typeof HARVEST_TASK | typeof DELIVER_TASK | typeof UPGRADE_TASK;
type UpgraderTask = typeof RECHARGE_TASK | typeof UPGRADE_TASK;
type BuilderTask = typeof BUILDER_GATHER_TASK | typeof BUILDER_BUILD_TASK | typeof BUILDER_MAINTAIN_TASK;
type RemoteMinerTask = typeof REMOTE_TRAVEL_TASK | typeof REMOTE_MINE_TASK | typeof REMOTE_RETURN_TASK;
type StationaryHarvesterTask = typeof STATIONARY_HARVEST_TASK;
type HaulerTask = typeof HAULER_PICKUP_TASK | typeof HAULER_DELIVER_TASK;

interface HarvesterMemory extends BaseCreepMemory {
  task: HarvesterTask;
}

interface UpgraderMemory extends BaseCreepMemory {
  task: UpgraderTask;
}

interface BuilderMemory extends BaseCreepMemory {
  task: BuilderTask;
}

interface RemoteMinerMemory extends BaseCreepMemory {
  task: RemoteMinerTask;
  homeRoom: string;
  targetRoom: string;
  sourceId?: Id<Source>;
}

interface StationaryHarvesterMemory extends BaseCreepMemory {
  task: StationaryHarvesterTask;
  sourceId?: Id<Source>;
  containerId?: Id<StructureContainer>;
}

interface HaulerMemory extends BaseCreepMemory {
  task: HaulerTask;
}

/**
 * Determines if a structure is a valid energy source that creeps can withdraw from.
 * Valid sources include containers and storage, but NOT spawns, extensions, or towers.
 *
 * @param structure - The structure to check
 * @returns true if the structure is a valid energy source for withdrawal
 */
function isValidEnergySource(structure: AnyStructure): boolean {
  // Only containers and storage are valid withdrawal sources
  if (structure.structureType !== STRUCTURE_CONTAINER && structure.structureType !== STRUCTURE_STORAGE) {
    return false;
  }

  const store = structure as AnyStoreStructure;
  return store.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
}

/**
 * Determines if a structure is a critical energy consumer that should never be depleted.
 * Critical consumers include spawns, extensions, and towers.
 * This function is exported for use in other modules that need to identify critical structures.
 *
 * @param structure - The structure to check
 * @returns true if the structure is a critical energy consumer
 */
export function isCriticalEnergyConsumer(structure: AnyStructure): boolean {
  return (
    structure.structureType === STRUCTURE_SPAWN ||
    structure.structureType === STRUCTURE_EXTENSION ||
    structure.structureType === STRUCTURE_TOWER
  );
}

const ROLE_DEFINITIONS: Record<RoleName, RoleDefinition> = {
  harvester: {
    minimum: 4,
    body: [WORK, CARRY, MOVE],
    memory: () => ({ role: "harvester", task: HARVEST_TASK, version: HARVESTER_VERSION }),
    run: (creep: ManagedCreep) => runHarvester(creep)
  },
  upgrader: {
    minimum: 3,
    body: [WORK, CARRY, MOVE],
    memory: () => ({ role: "upgrader", task: RECHARGE_TASK, version: UPGRADER_VERSION }),
    run: (creep: ManagedCreep) => runUpgrader(creep)
  },
  builder: {
    minimum: 2,
    body: [WORK, CARRY, MOVE, MOVE],
    memory: () =>
      ({
        role: "builder",
        task: BUILDER_GATHER_TASK,
        version: BUILDER_VERSION
      }) satisfies BuilderMemory,
    run: (creep: ManagedCreep) => runBuilder(creep)
  },
  remoteMiner: {
    minimum: 0,
    body: [WORK, WORK, CARRY, MOVE, MOVE],
    memory: () =>
      ({
        role: "remoteMiner",
        task: REMOTE_TRAVEL_TASK,
        version: REMOTE_MINER_VERSION,
        homeRoom: "",
        targetRoom: ""
      }) satisfies RemoteMinerMemory,
    run: (creep: ManagedCreep) => runRemoteMiner(creep)
  },
  stationaryHarvester: {
    minimum: 0,
    body: [WORK, WORK, WORK, WORK, WORK, MOVE],
    memory: () =>
      ({
        role: "stationaryHarvester",
        task: STATIONARY_HARVEST_TASK,
        version: STATIONARY_HARVESTER_VERSION
      }) satisfies StationaryHarvesterMemory,
    run: (creep: ManagedCreep) => runStationaryHarvester(creep)
  },
  hauler: {
    minimum: 0,
    body: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
    memory: () =>
      ({
        role: "hauler",
        task: HAULER_PICKUP_TASK,
        version: HAULER_VERSION
      }) satisfies HaulerMemory,
    run: (creep: ManagedCreep) => runHauler(creep)
  }
};

interface BehaviorControllerOptions {
  cpuSafetyMargin?: number;
  maxCpuPerCreep?: number;
  useTaskSystem?: boolean;
  pathfindingProvider?: "default" | "cartographer";
}

/**
 * Coordinates spawning and per-tick behaviour execution for every registered role.
 * Uses priority-based task management system by default (v0.32.0+).
 * Legacy role-based system available via useTaskSystem: false.
 */
@profile
export class BehaviorController {
  private readonly options: Required<BehaviorControllerOptions>;
  private readonly taskManager: TaskManager;
  private readonly logger: Pick<Console, "log" | "warn">;

  public constructor(options: BehaviorControllerOptions = {}, logger: Pick<Console, "log" | "warn"> = console) {
    this.logger = logger;
    this.options = {
      cpuSafetyMargin: options.cpuSafetyMargin ?? 0.85,
      maxCpuPerCreep: options.maxCpuPerCreep ?? 1.5,
      useTaskSystem: options.useTaskSystem ?? true,
      pathfindingProvider: options.pathfindingProvider ?? "default"
    };
    this.taskManager = new TaskManager({
      cpuThreshold: this.options.cpuSafetyMargin,
      pathfindingProvider: this.options.pathfindingProvider,
      logger: this.logger
    });
  }

  /**
   * Run a full behaviour tick and return a summary of executed actions.
   * Implements CPU budget management to prevent script execution timeouts.
   */
  public execute(game: GameContext, memory: Memory, roleCounts: Record<string, number>): BehaviorSummary {
    // Initialize creep counter if not present
    if (typeof memory.creepCounter !== "number") {
      memory.creepCounter = 0;
    }

    const spawned: string[] = [];
    this.ensureRoleMinimums(game, memory, roleCounts, spawned);

    // Use task system if enabled, otherwise use legacy role-based system
    const result = this.options.useTaskSystem
      ? this.executeWithTaskSystem(game, memory)
      : this.executeWithRoleSystem(game, memory);

    memory.roles = roleCounts;

    return {
      processedCreeps: result.processedCreeps,
      spawnedCreeps: spawned,
      tasksExecuted: result.tasksExecuted
    };
  }

  /**
   * Execute using the task management system with priority-based task execution.
   */
  private executeWithTaskSystem(
    game: GameContext,
    _memory: Memory
  ): { processedCreeps: number; tasksExecuted: Record<string, number> } {
    const creeps = Object.values(game.creeps) as Creep[];

    // Generate tasks for each room
    const rooms = Object.values(game.rooms);
    for (const room of rooms) {
      if (room.controller?.my) {
        this.taskManager.generateTasks(room);
      }
    }

    // Assign tasks to idle creeps
    this.taskManager.assignTasks(creeps);

    // Execute tasks with CPU threshold management
    const tasksExecuted = this.taskManager.executeTasks(creeps, game.cpu.limit);

    return {
      processedCreeps: creeps.length,
      tasksExecuted
    };
  }

  /**
   * Execute using the legacy role-based system.
   * @deprecated Since v0.32.0 - Task system is now the default. Use useTaskSystem: false to enable.
   * This method will be removed in a future version once task system is fully validated in production.
   */
  private executeWithRoleSystem(
    game: GameContext,
    _memory: Memory
  ): { processedCreeps: number; tasksExecuted: Record<string, number> } {
    const tasksExecuted: Record<string, number> = {};
    let processedCreeps = 0;
    let skippedCreeps = 0;

    const cpuBudget = game.cpu.limit * this.options.cpuSafetyMargin;
    const creeps = Object.values(game.creeps) as ManagedCreep[];

    for (const creep of creeps) {
      // Check CPU budget before processing each creep
      const cpuUsed = game.cpu.getUsed();
      if (cpuUsed > cpuBudget) {
        skippedCreeps = creeps.length - processedCreeps;
        this.logger.warn?.(
          `CPU budget exceeded (${cpuUsed.toFixed(2)}/${cpuBudget.toFixed(2)}), ` +
            `skipping ${skippedCreeps} creeps to prevent timeout`
        );
        break;
      }

      const cpuBefore = game.cpu.getUsed();

      const role = creep.memory.role;
      const handler = role ? ROLE_DEFINITIONS[role] : undefined;
      if (!handler) {
        this.logger.warn?.(`Unknown role '${role}' for creep ${creep.name}`);
        processedCreeps++;
        continue;
      }

      const defaults = handler.memory();
      if (creep.memory.version !== defaults.version) {
        creep.memory.task = defaults.task;
        creep.memory.version = defaults.version;
      }
      if (typeof creep.memory.task !== "string") {
        creep.memory.task = defaults.task;
      }
      creep.memory.role = role;

      const task = handler.run(creep);
      tasksExecuted[task] = (tasksExecuted[task] ?? 0) + 1;
      processedCreeps++;

      // Log warning if a single creep consumed excessive CPU
      const cpuConsumed = game.cpu.getUsed() - cpuBefore;
      if (cpuConsumed > this.options.maxCpuPerCreep) {
        this.logger.warn?.(`Creep ${creep.name} (${role}) consumed excessive CPU: ${cpuConsumed.toFixed(2)}`);
      }
    }

    return {
      processedCreeps,
      tasksExecuted
    };
  }

  private ensureRoleMinimums(
    game: GameContext,
    memory: Memory,
    roleCounts: Record<string, number>,
    spawned: string[]
  ): void {
    // Check CPU budget before spawn operations
    const cpuBudget = game.cpu.limit * this.options.cpuSafetyMargin;
    if (game.cpu.getUsed() > cpuBudget) {
      this.logger.warn?.(
        `CPU budget exceeded before spawn operations (${game.cpu.getUsed().toFixed(2)}/${cpuBudget.toFixed(2)}), ` +
          `skipping spawn checks to prevent timeout`
      );
      return;
    }

    // Validate spawn health on each tick
    this.validateSpawnHealth(game.spawns, game.creeps, game.time, memory);

    for (const [role, definition] of Object.entries(ROLE_DEFINITIONS)) {
      const current = roleCounts[role] ?? 0;
      if (current >= definition.minimum) {
        continue;
      }

      const spawn = this.findAvailableSpawn(game.spawns);
      if (!spawn) {
        continue; // No available spawns
      }

      // Validate sufficient energy before spawning to prevent partial spawns
      const spawnCost = this.calculateBodyCost(definition.body);
      if (spawn.room && spawn.room.energyAvailable < spawnCost) {
        continue; // Not enough energy yet
      }

      const name = `${role}-${game.time}-${memory.creepCounter}`;
      memory.creepCounter += 1;
      const result = spawn.spawnCreep(definition.body, name, { memory: definition.memory() });
      if (result === OK) {
        spawned.push(name);
        roleCounts[role] = current + 1;
      } else {
        this.logger.warn?.(`Failed to spawn ${role}: ${result}`);
      }
    }
  }

  /**
   * Calculate the energy cost of body parts
   */
  private calculateBodyCost(body: BodyPartConstant[]): number {
    return body.reduce((total, part) => total + (BODYPART_COST[part] ?? 0), 0);
  }

  /**
   * Validate spawn health and detect stuck spawn states.
   * Logs warnings when spawns appear to be stuck.
   */
  private validateSpawnHealth(
    spawns: Record<string, SpawnLike>,
    creeps: Record<string, CreepLike>,
    currentTick: number,
    memory: Memory
  ): void {
    memory.spawnHealth ??= {};

    const spawnCount = Object.values(spawns).length;
    if (spawnCount === 0) {
      return;
    }

    for (const spawn of Object.values(spawns)) {
      const spawnIdKey = spawn.name; // Use spawn name as key to avoid type issues

      if (spawn.spawning === null) {
        // Clear stuck state tracking when spawn becomes available
        delete memory.spawnHealth[spawnIdKey];
        continue;
      }

      // Validate spawning state
      const spawningCreepName = spawn.spawning.name;
      const spawningCreepExists = creeps[spawningCreepName] !== undefined;
      const remainingTime = spawn.spawning.remainingTime;
      const needTime = spawn.spawning.needTime;

      // Detect stuck state: creep already exists but spawn.spawning not cleared
      if (spawningCreepExists && remainingTime <= 0) {
        if (!memory.spawnHealth[spawnIdKey]) {
          memory.spawnHealth[spawnIdKey] = {
            detectedAt: currentTick,
            creepName: spawningCreepName,
            remainingTime
          };
          this.logger.warn?.(
            `[SpawnHealth] Detected stuck spawn: ${spawn.name} shows spawning ${spawningCreepName} ` +
              `but creep exists and remainingTime is ${remainingTime}. This may indicate a Screeps API issue.`
          );
        } else {
          const ticksStuck = currentTick - memory.spawnHealth[spawnIdKey].detectedAt;
          if (ticksStuck > 10) {
            this.logger.warn?.(
              `[SpawnHealth] CRITICAL: Spawn ${spawn.name} stuck for ${ticksStuck} ticks. ` +
                `Manual intervention may be required.`
            );
          }
        }
      }

      // Detect invalid spawn timing (potential corruption)
      if (remainingTime > needTime) {
        this.logger.warn?.(
          `[SpawnHealth] Spawn ${spawn.name} has invalid timing: ` +
            `remainingTime (${remainingTime}) > needTime (${needTime})`
        );
      }
    }
  }

  private findAvailableSpawn(spawns: Record<string, SpawnLike>): SpawnLike | null {
    return Object.values(spawns).find(spawn => spawn.spawning === null) ?? null;
  }
}

function ensureHarvesterTask(memory: HarvesterMemory, creep: CreepLike): HarvesterTask {
  if (memory.task !== HARVEST_TASK && memory.task !== DELIVER_TASK && memory.task !== UPGRADE_TASK) {
    memory.task = HARVEST_TASK;
    return memory.task;
  }

  if (memory.task === HARVEST_TASK && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    memory.task = DELIVER_TASK;
  } else if (memory.task === DELIVER_TASK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    memory.task = HARVEST_TASK;
  } else if (memory.task === UPGRADE_TASK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    memory.task = HARVEST_TASK;
  }

  return memory.task;
}

function runHarvester(creep: ManagedCreep): string {
  const memory = creep.memory as HarvesterMemory;
  const task = ensureHarvesterTask(memory, creep);

  if (task === HARVEST_TASK) {
    const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
    const source = sources.length > 0 ? (creep.pos.findClosestByPath(sources) ?? sources[0]) : null;
    if (source) {
      const result = creep.harvest(source);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { range: 1, reusePath: 30 });
      }
    }
    return HARVEST_TASK;
  }

  // Priority 1: Fill spawns and extensions
  const criticalTargets = creep.room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) =>
      (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
      (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
  }) as AnyStoreStructure[];

  const criticalTarget =
    criticalTargets.length > 0 ? (creep.pos.findClosestByPath(criticalTargets) ?? criticalTargets[0]) : null;
  if (criticalTarget) {
    const result = creep.transfer(criticalTarget, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(criticalTarget, { range: 1, reusePath: 30 });
    }
    return DELIVER_TASK;
  }

  // Priority 2: Fill containers
  const containers = creep.room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) =>
      structure.structureType === STRUCTURE_CONTAINER &&
      (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
  }) as AnyStoreStructure[];

  const container = containers.length > 0 ? (creep.pos.findClosestByPath(containers) ?? containers[0]) : null;
  if (container) {
    const result = creep.transfer(container, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(container, { range: 1, reusePath: 30 });
    }
    return DELIVER_TASK;
  }

  // Priority 3: Upgrade controller
  memory.task = UPGRADE_TASK;
  const controller = creep.room.controller;
  if (controller) {
    const upgrade = creep.upgradeController(controller);
    if (upgrade === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { range: 3, reusePath: 30 });
    }
    return UPGRADE_TASK;
  }

  return DELIVER_TASK;
}

function ensureUpgraderTask(memory: UpgraderMemory, creep: CreepLike): UpgraderTask {
  if (memory.task !== RECHARGE_TASK && memory.task !== UPGRADE_TASK) {
    memory.task = RECHARGE_TASK;
    return memory.task;
  }

  if (memory.task === RECHARGE_TASK && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    memory.task = UPGRADE_TASK;
  } else if (memory.task === UPGRADE_TASK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    memory.task = RECHARGE_TASK;
  }

  return memory.task;
}

function runUpgrader(creep: ManagedCreep): string {
  const memory = creep.memory as UpgraderMemory;
  const task = ensureUpgraderTask(memory, creep);

  if (task === RECHARGE_TASK) {
    // Find valid energy sources (containers and storage only, NOT spawns/extensions/towers)
    const energySources = creep.room.find(FIND_STRUCTURES, {
      filter: isValidEnergySource
    }) as AnyStoreStructure[];

    const target = energySources.length > 0 ? (creep.pos.findClosestByPath(energySources) ?? energySources[0]) : null;
    if (target) {
      const result = creep.withdraw(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      }
      return RECHARGE_TASK;
    }

    // Fallback: Check for dropped energy
    const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
    }) as Resource[];

    if (droppedEnergy.length > 0) {
      const closest = creep.pos.findClosestByPath(droppedEnergy);
      const droppedTarget = closest ?? droppedEnergy[0];
      const result = creep.pickup(droppedTarget);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(droppedTarget, { range: 1, reusePath: 30 });
      }
      return RECHARGE_TASK;
    }

    // Fallback: Harvest from sources directly if no other options
    const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
    const source = sources.length > 0 ? (creep.pos.findClosestByPath(sources) ?? sources[0]) : null;
    if (source) {
      const result = creep.harvest(source);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { range: 1, reusePath: 30 });
      }
    }
    return RECHARGE_TASK;
  }

  const controller = creep.room.controller;
  if (controller) {
    const result = creep.upgradeController(controller);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { range: 3, reusePath: 30 });
    }
    return UPGRADE_TASK;
  }

  return RECHARGE_TASK;
}

function ensureBuilderTask(memory: BuilderMemory, creep: CreepLike): BuilderTask {
  if (
    memory.task !== BUILDER_GATHER_TASK &&
    memory.task !== BUILDER_BUILD_TASK &&
    memory.task !== BUILDER_MAINTAIN_TASK
  ) {
    memory.task = BUILDER_GATHER_TASK;
    return memory.task;
  }

  if (memory.task === BUILDER_GATHER_TASK && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    memory.task = BUILDER_BUILD_TASK;
  } else if (memory.task !== BUILDER_GATHER_TASK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    memory.task = BUILDER_GATHER_TASK;
  }

  return memory.task;
}

function runBuilder(creep: ManagedCreep): string {
  const memory = creep.memory as BuilderMemory;
  const task = ensureBuilderTask(memory, creep);

  if (task === BUILDER_GATHER_TASK) {
    // Find valid energy sources (containers and storage only, NOT spawns/extensions/towers)
    const energySources = creep.room.find(FIND_STRUCTURES, {
      filter: isValidEnergySource
    }) as AnyStoreStructure[];

    const target = energySources.length > 0 ? (creep.pos.findClosestByPath(energySources) ?? energySources[0]) : null;
    if (target) {
      const result = creep.withdraw(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      }
      return BUILDER_GATHER_TASK;
    }

    // Fallback: Check for dropped energy
    const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
    }) as Resource[];

    if (droppedEnergy.length > 0) {
      const closest = creep.pos.findClosestByPath(droppedEnergy);
      const droppedTarget = closest ?? droppedEnergy[0];
      const result = creep.pickup(droppedTarget);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(droppedTarget, { range: 1, reusePath: 30 });
      }
      return BUILDER_GATHER_TASK;
    }

    // Fallback: Harvest from sources directly if no other options
    const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
    const source = sources.length > 0 ? (creep.pos.findClosestByPath(sources) ?? sources[0]) : null;
    if (source) {
      const harvestResult = creep.harvest(source);
      if (harvestResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { range: 1, reusePath: 30 });
      }
    }

    return BUILDER_GATHER_TASK;
  }

  if (task === BUILDER_BUILD_TASK) {
    const sites = creep.room.find(FIND_CONSTRUCTION_SITES) as ConstructionSite[];
    const site = sites.length > 0 ? (creep.pos.findClosestByPath(sites) ?? sites[0]) : null;

    if (site) {
      const result = creep.build(site);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(site, { range: 3, reusePath: 30 });
      }
      return BUILDER_BUILD_TASK;
    }

    memory.task = BUILDER_MAINTAIN_TASK;
  }

  // Maintain (repair/upgrade) fallback
  const repairTargets = creep.room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) => {
      if (!("hits" in structure) || typeof structure.hits !== "number") {
        return false;
      }

      if (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) {
        return false;
      }

      return structure.hits < structure.hitsMax;
    }
  }) as Structure[];

  const target = repairTargets.length > 0 ? (creep.pos.findClosestByPath(repairTargets) ?? repairTargets[0]) : null;
  if (target) {
    const result = creep.repair(target);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { range: 3, reusePath: 30 });
    }
    return BUILDER_MAINTAIN_TASK;
  }

  const controller = creep.room.controller;
  if (controller) {
    const upgrade = creep.upgradeController(controller);
    if (upgrade === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { range: 3, reusePath: 30 });
    }
  }

  return BUILDER_MAINTAIN_TASK;
}

function ensureRemoteMinerTask(memory: RemoteMinerMemory): RemoteMinerTask {
  if (memory.task !== REMOTE_TRAVEL_TASK && memory.task !== REMOTE_MINE_TASK && memory.task !== REMOTE_RETURN_TASK) {
    memory.task = REMOTE_TRAVEL_TASK;
  }

  return memory.task;
}

function ensureRemoteAssignments(memory: RemoteMinerMemory, creep: ManagedCreep): void {
  if (!memory.homeRoom) {
    memory.homeRoom = creep.room.name ?? memory.homeRoom ?? "";
  }
  if (!memory.targetRoom) {
    memory.targetRoom = memory.homeRoom;
  }
}

function resolveRemoteSource(creep: ManagedCreep, memory: RemoteMinerMemory): Source | null {
  const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
  if (sources.length === 0) {
    return null;
  }

  if (memory.sourceId) {
    const match = sources.find(source => source.id === memory.sourceId);
    if (match) {
      return match;
    }
  }

  const chosen = creep.pos.findClosestByPath(sources) ?? sources[0];
  if (chosen) {
    memory.sourceId = chosen.id;
  }
  return chosen;
}

function runRemoteMiner(creep: ManagedCreep): string {
  const memory = creep.memory as RemoteMinerMemory;
  const task = ensureRemoteMinerTask(memory);
  ensureRemoteAssignments(memory, creep);

  if (task === REMOTE_TRAVEL_TASK) {
    if (memory.targetRoom && creep.room.name !== memory.targetRoom) {
      creep.moveTo(
        { pos: { x: 25, y: 25, roomName: memory.targetRoom } as unknown as RoomPosition },
        { reusePath: 50 }
      );
      return REMOTE_TRAVEL_TASK;
    }

    memory.task = REMOTE_MINE_TASK;
  }

  if (memory.task === REMOTE_MINE_TASK) {
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = REMOTE_RETURN_TASK;
      return REMOTE_RETURN_TASK;
    }

    const source = resolveRemoteSource(creep, memory);
    if (source) {
      const result = creep.harvest(source);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { range: 1, reusePath: 40 });
      }
    }

    return REMOTE_MINE_TASK;
  }

  if (memory.homeRoom && creep.room.name !== memory.homeRoom) {
    creep.moveTo({ pos: { x: 25, y: 25, roomName: memory.homeRoom } as unknown as RoomPosition }, { reusePath: 50 });
    return REMOTE_RETURN_TASK;
  }

  const depositTargets = creep.room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) =>
      (structure.structureType === STRUCTURE_STORAGE ||
        structure.structureType === STRUCTURE_SPAWN ||
        structure.structureType === STRUCTURE_EXTENSION ||
        structure.structureType === STRUCTURE_CONTAINER) &&
      (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
  }) as AnyStoreStructure[];

  const depositTarget =
    depositTargets.length > 0 ? (creep.pos.findClosestByPath(depositTargets) ?? depositTargets[0]) : null;
  if (depositTarget) {
    const result = creep.transfer(depositTarget, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(depositTarget, { range: 1, reusePath: 40 });
    } else if (result === OK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = REMOTE_TRAVEL_TASK;
    }
    return REMOTE_RETURN_TASK;
  }

  const controller = creep.room.controller;
  if (controller) {
    const result = creep.upgradeController(controller);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { range: 3, reusePath: 40 });
    }
  }

  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    memory.task = REMOTE_TRAVEL_TASK;
  }

  return REMOTE_RETURN_TASK;
}

/**
 * Executes the behavior for a stationary harvester creep.
 *
 * The stationary harvester is responsible for harvesting energy from a specific source,
 * transferring it to an adjacent container if available, or dropping it on the ground if necessary.
 * The function manages memory assignments for the source and container, ensures the creep is positioned
 * correctly, and handles energy transfer logic.
 *
 * @param creep - The ManagedCreep instance representing the stationary harvester.
 *   Expects creep.memory to be compatible with StationaryHarvesterMemory.
 * @returns The current task string for the stationary harvester (typically STATIONARY_HARVEST_TASK).
 *
 * Side effects:
 * - Updates creep.memory with sourceId and containerId as needed.
 * - May move the creep, harvest energy, transfer to container, or drop energy.
 */
function runStationaryHarvester(creep: ManagedCreep): string {
  const memory = creep.memory as StationaryHarvesterMemory;

  // Find or remember assigned source
  if (!memory.sourceId) {
    const sources = creep.room.find(FIND_SOURCES) as Source[];
    const source = sources.length > 0 ? (creep.pos.findClosestByPath(sources) ?? sources[0]) : null;
    if (source) {
      memory.sourceId = source.id;
    } else {
      return STATIONARY_HARVEST_TASK;
    }
  }

  const source = Game.getObjectById(memory.sourceId);
  if (!source) {
    delete memory.sourceId;
    return STATIONARY_HARVEST_TASK;
  }

  // Find or remember container adjacent to source
  if (!memory.containerId) {
    const nearbyStructures = source.pos.findInRange(FIND_STRUCTURES, 1);
    const containers = nearbyStructures.filter((s): s is StructureContainer => s.structureType === STRUCTURE_CONTAINER);

    if (containers.length > 0) {
      memory.containerId = containers[0].id;
    }
  }

  const container = memory.containerId ? Game.getObjectById(memory.containerId) : null;

  // Move to source if not adjacent

  const isNear = creep.pos.inRangeTo(source, 1);
  if (!isNear) {
    creep.moveTo(source, { range: 1, reusePath: 50 });
    return STATIONARY_HARVEST_TASK;
  }

  // Harvest energy
  const harvestResult = creep.harvest(source);
  if (harvestResult === ERR_NOT_IN_RANGE) {
    creep.moveTo(source, { range: 1, reusePath: 50 });
  }

  // Drop energy into container or on ground if full
  if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    if (container && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      creep.transfer(container, RESOURCE_ENERGY);
    } else {
      // Drop on ground if no container or container is full

      creep.drop(RESOURCE_ENERGY);
    }
  }

  return STATIONARY_HARVEST_TASK;
}

/**
 * Ensures the hauler creep's task state is consistent with its energy store.
 *
 * If the current task is invalid, sets it to pickup. Transitions from pickup to deliver
 * when the creep's energy store is full, and from deliver to pickup when empty.
 *
 * @param memory - The hauler's memory object, containing the current task.
 * @param creep - The hauler creep instance.
 * @returns The updated hauler task.
 */
function ensureHaulerTask(memory: HaulerMemory, creep: CreepLike): HaulerTask {
  if (memory.task !== HAULER_PICKUP_TASK && memory.task !== HAULER_DELIVER_TASK) {
    memory.task = HAULER_PICKUP_TASK;
    return memory.task;
  }

  if (memory.task === HAULER_PICKUP_TASK && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    memory.task = HAULER_DELIVER_TASK;
  } else if (memory.task === HAULER_DELIVER_TASK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    memory.task = HAULER_PICKUP_TASK;
  }

  return memory.task;
}

/**
 * Executes the behavior logic for a hauler creep.
 *
 * Haulers are responsible for transporting energy from containers or dropped resources
 * (typically near sources) to structures that require energy. The function implements a
 * priority-based delivery system:
 *   1. Spawns and extensions (critical structures)
 *   2. Towers (defense)
 *   3. Storage (surplus)
 *   4. Controller upgrade (fallback)
 *
 * When in pickup mode, the hauler seeks out containers with energy (priority) or
 * dropped energy, withdrawing or picking up as appropriate. When in delivery mode,
 * the hauler delivers energy to structures in need following the priority order above.
 *
 * The function manages the hauler's task state (pickup or deliver) and moves the creep
 * accordingly.
 *
 * @param creep - The hauler creep to run behavior for.
 * @returns The current hauler task ("pickup" or "haulerDeliver") as a string.
 */
function runHauler(creep: ManagedCreep): string {
  const memory = creep.memory as HaulerMemory;
  const task = ensureHaulerTask(memory, creep);

  if (task === HAULER_PICKUP_TASK) {
    // Priority: Pick up from containers near sources
    const containers = creep.room.find(FIND_STRUCTURES, {
      filter: s =>
        s.structureType === STRUCTURE_CONTAINER && (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 0
    }) as StructureContainer[];

    // Also check for dropped energy near sources
    const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
    }) as Resource[];

    if (containers.length > 0) {
      const closest = creep.pos.findClosestByPath(containers);
      const target = closest ?? containers[0];
      const result = creep.withdraw(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      }
    } else if (droppedEnergy.length > 0) {
      const closest = creep.pos.findClosestByPath(droppedEnergy);
      const target = closest ?? droppedEnergy[0];

      const result = creep.pickup(target);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      }
    }

    return HAULER_PICKUP_TASK;
  }

  // HAULER_DELIVER_TASK: Priority-based delivery
  // Priority 1: Spawns and extensions (critical)
  const criticalTargets = creep.room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) =>
      (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
      (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
  });

  if (criticalTargets.length > 0) {
    const closest = creep.pos.findClosestByPath(criticalTargets);
    const target = closest !== null ? closest : criticalTargets[0];
    const result = creep.transfer(target, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { range: 1, reusePath: 30 });
    }
    return HAULER_DELIVER_TASK;
  }

  // Priority 2: Towers
  const towers = creep.room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) => {
      if (structure.structureType !== STRUCTURE_TOWER) return false;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const tower = structure as StructureTower;
      return tower.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
    }
  });

  if (towers.length > 0) {
    const closest = creep.pos.findClosestByPath(towers);
    const target = closest !== null ? closest : towers[0];
    const result = creep.transfer(target, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { range: 1, reusePath: 30 });
    }
    return HAULER_DELIVER_TASK;
  }

  // Priority 3: Storage

  const storage = creep.room.storage;

  if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
    const result = creep.transfer(storage, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(storage, { range: 1, reusePath: 30 });
    }
    return HAULER_DELIVER_TASK;
  }

  // Fallback: Upgrade controller
  const controller = creep.room.controller;
  if (controller) {
    const result = creep.upgradeController(controller);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { range: 3, reusePath: 30 });
    }
  }

  return HAULER_DELIVER_TASK;
}
