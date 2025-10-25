import type { BehaviorSummary } from "@shared/contracts";
import type { CreepLike, GameContext, SpawnLike } from "@runtime/types/GameContext";

type RoleName = "harvester" | "upgrader" | "builder" | "remoteMiner";

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

type HarvesterTask = typeof HARVEST_TASK | typeof DELIVER_TASK | typeof UPGRADE_TASK;
type UpgraderTask = typeof RECHARGE_TASK | typeof UPGRADE_TASK;
type BuilderTask = typeof BUILDER_GATHER_TASK | typeof BUILDER_BUILD_TASK | typeof BUILDER_MAINTAIN_TASK;
type RemoteMinerTask = typeof REMOTE_TRAVEL_TASK | typeof REMOTE_MINE_TASK | typeof REMOTE_RETURN_TASK;

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

const ROLE_DEFINITIONS: Record<RoleName, RoleDefinition> = {
  harvester: {
    minimum: 2,
    body: [WORK, CARRY, MOVE],
    memory: () => ({ role: "harvester", task: HARVEST_TASK, version: HARVESTER_VERSION }),
    run: (creep: ManagedCreep) => runHarvester(creep)
  },
  upgrader: {
    minimum: 1,
    body: [WORK, CARRY, MOVE],
    memory: () => ({ role: "upgrader", task: RECHARGE_TASK, version: UPGRADER_VERSION }),
    run: (creep: ManagedCreep) => runUpgrader(creep)
  },
  builder: {
    minimum: 1,
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
  }
};

interface BehaviorControllerOptions {
  cpuSafetyMargin?: number;
  maxCpuPerCreep?: number;
}

/**
 * Coordinates spawning and per-tick behaviour execution for every registered role.
 */
export class BehaviorController {
  private readonly options: Required<BehaviorControllerOptions>;

  public constructor(
    options: BehaviorControllerOptions = {},
    private readonly logger: Pick<Console, "log" | "warn"> = console
  ) {
    this.options = {
      cpuSafetyMargin: options.cpuSafetyMargin ?? 0.8,
      maxCpuPerCreep: options.maxCpuPerCreep ?? 1.5
    };
  }

  /**
   * Run a full behaviour tick and return a summary of executed actions.
   * Implements CPU budget management to prevent script execution timeouts.
   */
  public execute(game: GameContext, memory: Memory, roleCounts: Record<string, number>): BehaviorSummary {
    const tasksExecuted: Record<string, number> = {};
    const spawned: string[] = [];
    let processedCreeps = 0;
    let skippedCreeps = 0;

    // Initialize creep counter if not present
    if (typeof memory.creepCounter !== "number") {
      memory.creepCounter = 0;
    }

    this.ensureRoleMinimums(game, memory, roleCounts, spawned);

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

    memory.roles = roleCounts;

    return {
      processedCreeps,
      spawnedCreeps: spawned,
      tasksExecuted
    };
  }

  private ensureRoleMinimums(
    game: GameContext,
    memory: Memory,
    roleCounts: Record<string, number>,
    spawned: string[]
  ): void {
    for (const [role, definition] of Object.entries(ROLE_DEFINITIONS)) {
      const current = roleCounts[role] ?? 0;
      if (current >= definition.minimum) {
        continue;
      }

      const spawn = this.findAvailableSpawn(game.spawns);
      if (!spawn) {
        this.logger.warn?.(`No available spawns to satisfy minimum role ${role}`);
        continue;
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

  const deliveryTargets = creep.room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) =>
      (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
      (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
  }) as AnyStoreStructure[];

  const target =
    deliveryTargets.length > 0 ? (creep.pos.findClosestByPath(deliveryTargets) ?? deliveryTargets[0]) : null;
  if (target) {
    const result = creep.transfer(target, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { range: 1, reusePath: 30 });
    }
    return DELIVER_TASK;
  }

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
    const sources = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure) => {
        if (
          structure.structureType !== STRUCTURE_SPAWN &&
          structure.structureType !== STRUCTURE_EXTENSION &&
          structure.structureType !== STRUCTURE_CONTAINER
        ) {
          return false;
        }

        const store = structure as AnyStoreStructure;
        return store.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
      }
    }) as AnyStoreStructure[];

    const target = sources.length > 0 ? (creep.pos.findClosestByPath(sources) ?? sources[0]) : null;
    if (target) {
      const result = creep.withdraw(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
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
    const energySources = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure) => {
        if (
          structure.structureType !== STRUCTURE_SPAWN &&
          structure.structureType !== STRUCTURE_EXTENSION &&
          structure.structureType !== STRUCTURE_CONTAINER &&
          structure.structureType !== STRUCTURE_STORAGE
        ) {
          return false;
        }

        const store = structure as AnyStoreStructure;
        return store.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
      }
    }) as AnyStoreStructure[];

    const target = energySources.length > 0 ? (creep.pos.findClosestByPath(energySources) ?? energySources[0]) : null;
    if (target) {
      const result = creep.withdraw(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      }
    } else {
      const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
      const source = sources.length > 0 ? (creep.pos.findClosestByPath(sources) ?? sources[0]) : null;
      if (source) {
        const harvestResult = creep.harvest(source);
        if (harvestResult === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { range: 1, reusePath: 30 });
        }
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
