import type { BehaviorSummary } from "@shared/contracts";
import type { CreepLike, GameContext, SpawnLike } from "@runtime/types/GameContext";

type RoleName = "harvester" | "upgrader";

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

const HARVEST_TASK = "harvest" as const;
const DELIVER_TASK = "deliver" as const;
const RECHARGE_TASK = "recharge" as const;
const UPGRADE_TASK = "upgrade" as const;

type HarvesterTask = typeof HARVEST_TASK | typeof DELIVER_TASK | typeof UPGRADE_TASK;
type UpgraderTask = typeof RECHARGE_TASK | typeof UPGRADE_TASK;

interface HarvesterMemory extends BaseCreepMemory {
  task: HarvesterTask;
}

interface UpgraderMemory extends BaseCreepMemory {
  task: UpgraderTask;
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
  }
};

/**
 * Coordinates spawning and per-tick behaviour execution for every registered role.
 */
export class BehaviorController {
  public constructor(private readonly logger: Pick<Console, "log" | "warn"> = console) {}

  /**
   * Run a full behaviour tick and return a summary of executed actions.
   */
  public execute(game: GameContext, memory: Memory, roleCounts: Record<string, number>): BehaviorSummary {
    const tasksExecuted: Record<string, number> = {};
    const spawned: string[] = [];

    this.ensureRoleMinimums(game, roleCounts, spawned);

    for (const creep of Object.values(game.creeps) as ManagedCreep[]) {
      const role = creep.memory.role;
      const handler = role ? ROLE_DEFINITIONS[role] : undefined;
      if (!handler) {
        this.logger.warn?.(`Unknown role '${role}' for creep ${creep.name}`);
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
    }

    memory.roles = roleCounts;

    return {
      processedCreeps: Object.keys(game.creeps).length,
      spawnedCreeps: spawned,
      tasksExecuted
    };
  }

  private ensureRoleMinimums(game: GameContext, roleCounts: Record<string, number>, spawned: string[]): void {
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

      const name = `${role}-${game.time}-${Math.floor(Math.random() * 1000)}`;
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
        creep.moveTo(source, { range: 1, reusePath: 5 });
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
      creep.moveTo(target, { range: 1, reusePath: 5 });
    }
    return DELIVER_TASK;
  }

  memory.task = UPGRADE_TASK;
  const controller = creep.room.controller;
  if (controller) {
    const upgrade = creep.upgradeController(controller);
    if (upgrade === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { range: 3, reusePath: 5 });
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
        creep.moveTo(target, { range: 1, reusePath: 5 });
      }
    }
    return RECHARGE_TASK;
  }

  const controller = creep.room.controller;
  if (controller) {
    const result = creep.upgradeController(controller);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { range: 3, reusePath: 5 });
    }
    return UPGRADE_TASK;
  }

  return RECHARGE_TASK;
}
