import type { BehaviorSummary } from "@shared/contracts";
import type { CreepLike, GameContext, SpawnLike } from "@runtime/types/GameContext";

/**
 * Defines the properties and behavior of a creep role in the starter bot.
 * Each role has a minimum count, body composition, initial memory, and execution logic.
 */
interface RoleDefinition {
  /** Minimum number of creeps to maintain for this role */
  minimum: number;
  /** Body parts composition for spawning new creeps */
  body: BodyPartConstant[];
  /** Function executed each tick to control the creep's behavior */
  run(creep: CreepLike): string;
  /** Factory function to create initial memory for newly spawned creeps */
  memory: () => CreepMemory;
}

/**
 * Starter Bot Role Definitions
 * 
 * This is a basic MVP implementation with two essential roles:
 * - Harvesters: Collect energy from sources and deliver it to spawns/extensions
 * - Upgraders: Withdraw energy from spawns and upgrade the room controller
 * 
 * These roles form the foundation of a functional Screeps AI that can sustain itself
 * and continuously improve the room's controller level.
 */
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
 * BehaviorController - Starter Bot Core Logic
 * 
 * Coordinates spawning and per-tick behaviour execution for every registered role.
 * This controller implements the essential automation features for a functional Screeps bot:
 * 
 * - **Auto-spawning**: Automatically maintains minimum creep counts for each role
 * - **Auto-harvesting**: Harvesters locate and extract energy from sources
 * - **Auto-upgrading**: Upgraders and idle harvesters improve the room controller
 * - **Error handling**: Gracefully handles edge cases like missing spawns or unknown roles
 * 
 * The implementation prioritizes simplicity and clarity, making it easy to understand
 * and extend with additional roles and behaviors as needed.
 */
export class BehaviorController {
  public constructor(private readonly logger: Pick<Console, "log" | "warn"> = console) {}

  /**
   * Execute one tick of the starter bot's behavior cycle.
   * 
   * This is the main entry point that runs every game tick. It performs:
   * 1. Ensures minimum creep counts are maintained (auto-spawning)
   * 2. Executes behavior logic for each active creep
   * 3. Updates memory with current role counts
   * 
   * @param game - The current game state context
   * @param memory - Global memory object for persistent data
   * @param roleCounts - Current count of creeps by role
   * @returns Summary of actions performed this tick
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

/**
 * Harvester Role - Energy Collection and Distribution
 * 
 * The harvester is the foundation of the colony's economy. It follows a simple priority system:
 * 
 * 1. **Harvest Phase** (when not full):
 *    - Locate the closest active energy source
 *    - Move to and harvest from the source
 * 
 * 2. **Supply Phase** (when full):
 *    - Find spawns or extensions that need energy
 *    - Transfer energy to keep spawning capability active
 * 
 * 3. **Upgrade Phase** (when full but nothing needs energy):
 *    - Use excess energy to upgrade the room controller
 *    - This prevents energy waste and contributes to room progression
 * 
 * @param creep - The harvester creep to control
 * @returns The task identifier for metrics tracking
 */
function runHarvester(creep: CreepLike): string {
  // Phase 1: Harvest energy when storage has capacity
  if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
    const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
    const source = sources.length > 0 ? (creep.pos.findClosestByPath(sources) ?? sources[0]) : null;
    if (source) {
      const result = creep.harvest(source);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(source);
      }
    }
    return "harvest";
  }

  // Phase 2: Supply energy to spawns and extensions
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
    }
    return "supply";
  }

  // Phase 3: Use excess energy to upgrade controller
  if (creep.room.controller) {
    const upgrade = creep.upgradeController(creep.room.controller);
    if (upgrade === ERR_NOT_IN_RANGE) {
      creep.moveTo(creep.room.controller);
    }
    return "upgrade";
  }

  return "idle";
}

/**
 * Upgrader Role - Controller Progression
 * 
 * The upgrader is dedicated to improving the room's controller level, which unlocks
 * new structures and capabilities. It follows a simple two-phase cycle:
 * 
 * 1. **Recharge Phase** (when empty):
 *    - Withdraw energy from spawns or extensions that have surplus (>50 energy)
 *    - This ensures spawning operations aren't disrupted
 * 
 * 2. **Upgrade Phase** (when carrying energy):
 *    - Move to the room controller
 *    - Continuously upgrade to increase controller level
 * 
 * The upgrader is essential for room progression and should always be active
 * to prevent controller downgrade from lack of upgrades.
 * 
 * @param creep - The upgrader creep to control
 * @returns The task identifier for metrics tracking
 */
function runUpgrader(creep: CreepLike): string {
  // Phase 1: Recharge from spawns when empty
  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    const targets = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure) =>
        (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
        (structure as AnyStoreStructure).store.getUsedCapacity(RESOURCE_ENERGY) > 50
    }) as AnyStoreStructure[];

    const target = targets.length > 0 ? (creep.pos.findClosestByPath(targets) ?? targets[0]) : null;
    if (target) {
      const result = creep.withdraw(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target);
      }
    }
    return "recharge";
  }

  // Phase 2: Upgrade the controller
  const controller = creep.room.controller;
  if (controller) {
    const result = creep.upgradeController(controller);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller);
    }
    return "upgrade";
  }

  return "idle";
}
