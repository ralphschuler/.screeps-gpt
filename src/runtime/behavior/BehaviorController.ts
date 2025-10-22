import type { BehaviorSummary } from "@shared/contracts";
import type { CreepLike, GameContext, SpawnLike } from "@runtime/types/GameContext";

interface RoleDefinition {
  minimum: number;
  body: BodyPartConstant[];
  run(creep: CreepLike): string;
  memory: () => CreepMemory;
}

const ROLE_DEFINITIONS: Record<string, RoleDefinition> = {
  harvester: {
    minimum: 2,
    body: [WORK, CARRY, MOVE],
    memory: () => ({ role: "harvester", task: "harvest", version: 1 }),
    run: (creep: CreepLike) => runHarvester(creep)
  },
  upgrader: {
    minimum: 1,
    body: [WORK, CARRY, MOVE],
    memory: () => ({ role: "upgrader", task: "upgrade", version: 1 }),
    run: (creep: CreepLike) => runUpgrader(creep)
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

    for (const creep of Object.values(game.creeps)) {
      const role = creep.memory.role;
      const handler = ROLE_DEFINITIONS[role];
      if (!handler) {
        this.logger.warn?.(`Unknown role '${role}' for creep ${creep.name}`);
        continue;
      }

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

      // Use deterministic naming based on game time and role count for reproducibility
      const name = `${role}-${game.time}-${current}`;
      const result = spawn.spawnCreep(definition.body, name, { memory: definition.memory() });
      if (result === OK) {
        spawned.push(name);
        roleCounts[role] = current + 1;
        this.logger.log?.(`Spawned ${name} at ${spawn.name}`);
      } else {
        const errorMessage = this.getSpawnErrorMessage(result);
        this.logger.warn?.(`Failed to spawn ${role}: ${errorMessage}`);
      }
    }
  }

  private findAvailableSpawn(spawns: Record<string, SpawnLike>): SpawnLike | null {
    return Object.values(spawns).find(spawn => spawn.spawning === null) ?? null;
  }

  private getSpawnErrorMessage(result: ScreepsReturnCode): string {
    const errorMessages: Record<ScreepsReturnCode, string> = {
      [ERR_NOT_ENOUGH_ENERGY]: "not enough energy",
      [ERR_BUSY]: "spawn is busy",
      [ERR_NAME_EXISTS]: "name already exists",
      [ERR_INVALID_ARGS]: "invalid arguments",
      [ERR_RCL_NOT_ENOUGH]: "room controller level too low"
    };
    return errorMessages[result] ?? `error code ${result}`;
  }
}

function runHarvester(creep: CreepLike): string {
  if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
    const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
    if (sources.length === 0) {
      return "waiting"; // No active sources available
    }
    
    const source = creep.pos.findClosestByPath(sources) ?? sources[0];
    if (source) {
      const result = creep.harvest(source);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(source);
      } else if (result !== OK && result !== ERR_BUSY) {
        // Handle harvest errors (e.g., no WORK parts, source depleted)
        return "error";
      }
    }
    return "harvest";
  }

  const targets = creep.room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) =>
      (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
      (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
  }) as AnyStoreStructure[];

  const target = targets.length > 0 ? (creep.pos.findClosestByPath(targets) ?? targets[0]) : null;
  if (target) {
    const result = creep.transfer(target, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target);
    } else if (result !== OK && result !== ERR_FULL) {
      // Handle transfer errors
      return "error";
    }
    return "supply";
  }

  // Fallback to upgrading controller if no transfer targets
  if (creep.room.controller) {
    const upgrade = creep.upgradeController(creep.room.controller);
    if (upgrade === ERR_NOT_IN_RANGE) {
      creep.moveTo(creep.room.controller);
    } else if (upgrade !== OK) {
      // Handle upgrade errors
      return "error";
    }
    return "upgrade";
  }

  return "idle";
}

function runUpgrader(creep: CreepLike): string {
  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    const targets = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure) =>
        (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
        (structure as AnyStoreStructure).store.getUsedCapacity(RESOURCE_ENERGY) > 50
    }) as AnyStoreStructure[];

    if (targets.length === 0) {
      return "waiting"; // No energy sources available
    }

    const target = creep.pos.findClosestByPath(targets) ?? targets[0];
    if (target) {
      const result = creep.withdraw(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target);
      } else if (result !== OK && result !== ERR_NOT_ENOUGH_RESOURCES) {
        // Handle withdraw errors
        return "error";
      }
    }
    return "recharge";
  }

  const controller = creep.room.controller;
  if (controller) {
    const result = creep.upgradeController(controller);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller);
    } else if (result !== OK) {
      // Handle upgrade errors
      return "error";
    }
    return "upgrade";
  }

  return "idle";
}
