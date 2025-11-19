import type { BehaviorSummary } from "@shared/contracts";
import type { CreepLike, GameContext, SpawnLike } from "@runtime/types/GameContext";
import { TaskManager } from "@runtime/tasks";
import { profile } from "@profiler";
import { CreepCommunicationManager } from "./CreepCommunicationManager";
import { EnergyPriorityManager, DEFAULT_ENERGY_CONFIG } from "@runtime/energy";
import { BodyComposer } from "./BodyComposer";
import { WallUpgradeManager } from "@runtime/defense/WallUpgradeManager";
import { isCreepDying, handleDyingCreepEnergyDrop } from "./creepHelpers";

type RoleName =
  | "harvester"
  | "upgrader"
  | "builder"
  | "remoteMiner"
  | "stationaryHarvester"
  | "hauler"
  | "repairer"
  | "attacker"
  | "healer"
  | "dismantler"
  | "claimer";

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
const REPAIRER_VERSION = 1;
const ATTACKER_VERSION = 1;
const HEALER_VERSION = 1;
const DISMANTLER_VERSION = 1;
const CLAIMER_VERSION = 1;

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
const REPAIRER_GATHER_TASK = "repairerGather" as const;
const REPAIRER_REPAIR_TASK = "repair" as const;
const ATTACKER_ATTACK_TASK = "attack" as const;
const HEALER_HEAL_TASK = "heal" as const;
const DISMANTLER_DISMANTLE_TASK = "dismantle" as const;
const CLAIMER_CLAIM_TASK = "claim" as const;

type HarvesterTask = typeof HARVEST_TASK | typeof DELIVER_TASK | typeof UPGRADE_TASK;
type UpgraderTask = typeof RECHARGE_TASK | typeof UPGRADE_TASK;
type BuilderTask = typeof BUILDER_GATHER_TASK | typeof BUILDER_BUILD_TASK | typeof BUILDER_MAINTAIN_TASK;
type RemoteMinerTask = typeof REMOTE_TRAVEL_TASK | typeof REMOTE_MINE_TASK | typeof REMOTE_RETURN_TASK;
type StationaryHarvesterTask = typeof STATIONARY_HARVEST_TASK;
type HaulerTask = typeof HAULER_PICKUP_TASK | typeof HAULER_DELIVER_TASK;
type RepairerTask = typeof REPAIRER_GATHER_TASK | typeof REPAIRER_REPAIR_TASK;
type AttackerTask = typeof ATTACKER_ATTACK_TASK;
type HealerTask = typeof HEALER_HEAL_TASK;
type DismantlerTask = typeof DISMANTLER_DISMANTLE_TASK;
type ClaimerTask = typeof CLAIMER_CLAIM_TASK;

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

interface RepairerMemory extends BaseCreepMemory {
  task: RepairerTask;
}

interface AttackerMemory extends BaseCreepMemory {
  task: AttackerTask;
  targetRoom?: string;
  squadId?: string;
}

interface HealerMemory extends BaseCreepMemory {
  task: HealerTask;
  targetRoom?: string;
  squadId?: string;
}

interface DismantlerMemory extends BaseCreepMemory {
  task: DismantlerTask;
  targetRoom?: string;
  squadId?: string;
}

interface ClaimerMemory extends BaseCreepMemory {
  task: ClaimerTask;
  targetRoom: string;
  homeRoom: string;
}

/**
 * Determines if a structure is a valid energy source that creeps can withdraw from.
 * Valid sources include containers and storage, but NOT spawns, extensions, or towers.
 *
 * @param structure - The structure to check
 * @param minEnergy - Minimum energy threshold (default: 0)
 * @returns true if the structure is a valid energy source for withdrawal
 */
function isValidEnergySource(structure: AnyStructure, minEnergy: number = 0): boolean {
  // Only containers and storage are valid withdrawal sources
  if (structure.structureType !== STRUCTURE_CONTAINER && structure.structureType !== STRUCTURE_STORAGE) {
    return false;
  }

  const store = structure as AnyStoreStructure;
  return store.store.getUsedCapacity(RESOURCE_ENERGY) > minEnergy;
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
  },
  repairer: {
    minimum: 0,
    body: [WORK, WORK, CARRY, MOVE, MOVE],
    memory: () =>
      ({
        role: "repairer",
        task: REPAIRER_GATHER_TASK,
        version: REPAIRER_VERSION
      }) satisfies RepairerMemory,
    run: (creep: ManagedCreep) => runRepairer(creep)
  },
  attacker: {
    minimum: 0,
    body: [TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE],
    memory: () =>
      ({
        role: "attacker",
        task: ATTACKER_ATTACK_TASK,
        version: ATTACKER_VERSION
      }) satisfies AttackerMemory,
    run: (creep: ManagedCreep) => runAttacker(creep)
  },
  healer: {
    minimum: 0,
    body: [TOUGH, HEAL, HEAL, HEAL, MOVE, MOVE, MOVE, MOVE],
    memory: () =>
      ({
        role: "healer",
        task: HEALER_HEAL_TASK,
        version: HEALER_VERSION
      }) satisfies HealerMemory,
    run: (creep: ManagedCreep) => runHealer(creep)
  },
  dismantler: {
    minimum: 0,
    body: [TOUGH, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE],
    memory: () =>
      ({
        role: "dismantler",
        task: DISMANTLER_DISMANTLE_TASK,
        version: DISMANTLER_VERSION
      }) satisfies DismantlerMemory,
    run: (creep: ManagedCreep) => runDismantler(creep)
  },
  claimer: {
    minimum: 0,
    body: [CLAIM, MOVE],
    memory: () =>
      ({
        role: "claimer",
        task: CLAIMER_CLAIM_TASK,
        version: CLAIMER_VERSION,
        targetRoom: "",
        homeRoom: ""
      }) satisfies ClaimerMemory,
    run: (creep: ManagedCreep) => runClaimer(creep)
  }
};

interface BehaviorControllerOptions {
  cpuSafetyMargin?: number;
  maxCpuPerCreep?: number;
  useTaskSystem?: boolean;
  pathfindingProvider?: "default" | "cartographer";
  enableCreepCommunication?: boolean;
}

// Global communication manager instance for role functions to access
let communicationManager: CreepCommunicationManager | null = null;

// Global energy priority manager instance for role functions to access
let energyPriorityManager: EnergyPriorityManager | null = null;

// Global wall upgrade manager instance for role functions to access
let wallUpgradeManager: WallUpgradeManager | null = null;

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
  private readonly communicationManager: CreepCommunicationManager;
  private readonly energyPriorityManager: EnergyPriorityManager;
  private readonly bodyComposer: BodyComposer;
  private readonly wallUpgradeManager: WallUpgradeManager;

  public constructor(options: BehaviorControllerOptions = {}, logger: Pick<Console, "log" | "warn"> = console) {
    this.logger = logger;
    this.options = {
      cpuSafetyMargin: options.cpuSafetyMargin ?? 0.85,
      maxCpuPerCreep: options.maxCpuPerCreep ?? 1.5,
      useTaskSystem: options.useTaskSystem ?? true,
      pathfindingProvider: options.pathfindingProvider ?? "default",
      enableCreepCommunication: options.enableCreepCommunication ?? true
    };
    this.taskManager = new TaskManager({
      cpuThreshold: this.options.cpuSafetyMargin,
      pathfindingProvider: this.options.pathfindingProvider,
      logger: this.logger
    });
    this.communicationManager = new CreepCommunicationManager();
    communicationManager = this.communicationManager;
    this.energyPriorityManager = new EnergyPriorityManager({}, this.logger);
    energyPriorityManager = this.energyPriorityManager;
    this.bodyComposer = new BodyComposer();
    this.wallUpgradeManager = new WallUpgradeManager();
    wallUpgradeManager = this.wallUpgradeManager;
  }

  /**
   * Run a full behaviour tick and return a summary of executed actions.
   * Implements CPU budget management to prevent script execution timeouts.
   * @param bootstrapRoleMinimums - Optional role minimums to override during bootstrap phase
   */
  public execute(
    game: GameContext,
    memory: Memory,
    roleCounts: Record<string, number>,
    bootstrapRoleMinimums?: Partial<Record<RoleName, number>>
  ): BehaviorSummary {
    // Initialize creep counter if not present
    if (typeof memory.creepCounter !== "number") {
      memory.creepCounter = 0;
    }

    // Update communication configuration from Memory
    if (this.options.enableCreepCommunication && memory.creepCommunication) {
      this.communicationManager.updateConfig({
        verbosity: memory.creepCommunication.verbosity as "disabled" | "minimal" | "normal" | "verbose",
        enableRoomVisuals: memory.creepCommunication.enableRoomVisuals as boolean
      });
    } else if (!this.options.enableCreepCommunication) {
      this.communicationManager.updateConfig({ verbosity: "disabled" });
    }

    // Reset communication manager tick counter
    this.communicationManager.resetTick(game.time);

    const spawned: string[] = [];
    this.ensureRoleMinimums(game, memory, roleCounts, spawned, bootstrapRoleMinimums ?? {});

    // Use task system if enabled, otherwise use legacy role-based system
    const result = this.options.useTaskSystem
      ? this.executeWithTaskSystem(game, memory)
      : // eslint-disable-next-line @typescript-eslint/no-deprecated
        this.executeWithRoleSystem(game, memory);

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
    const dyingConfig = _memory.dyingCreepBehavior ?? { enabled: true, ttlThreshold: 50 };
    const comm = getComm();

    // Handle dying creeps first - they should drop energy and skip normal tasks
    const activeCreeps: Creep[] = [];
    for (const creep of creeps) {
      const isDying = dyingConfig.enabled !== false && isCreepDying(creep, dyingConfig.ttlThreshold ?? 50);

      if (isDying) {
        const dropped = handleDyingCreepEnergyDrop(creep);
        if (dropped) {
          comm?.say(creep, "💀");
        }
      } else {
        activeCreeps.push(creep);
      }
    }

    // Generate tasks for each room
    const rooms = Object.values(game.rooms);
    for (const room of rooms) {
      if (room.controller?.my) {
        this.taskManager.generateTasks(room);
      }
    }

    // Assign tasks to idle creeps (excluding dying creeps)
    this.taskManager.assignTasks(activeCreeps);

    // Execute tasks with CPU threshold management
    const tasksExecuted = this.taskManager.executeTasks(activeCreeps, game.cpu.limit);

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

      // Check if creep is dying and should drop energy
      const dyingConfig = _memory.dyingCreepBehavior ?? { enabled: true, ttlThreshold: 50 };
      const isDying = dyingConfig.enabled !== false && isCreepDying(creep as Creep, dyingConfig.ttlThreshold ?? 50);

      if (isDying) {
        const dropped = handleDyingCreepEnergyDrop(creep as Creep);
        if (dropped) {
          const comm = getComm();
          comm?.say(creep, "💀");
        }
        processedCreeps++;
        continue; // Skip normal behavior for dying creeps
      }

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

  /**
   * Detects the number of energy sources in a room.
   *
   * @param room - The room to analyze
   * @returns The number of energy sources in the room
   */
  private detectEnergySources(room: RoomLike): number {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const sources = room.find(FIND_SOURCES);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return sources.length;
  }

  /**
   * Calculates the optimal harvester count based on energy sources.
   * Single-source rooms need fewer harvesters than multi-source rooms.
   *
   * Falls back to default minimum (4) if no sources detected (e.g., in test mocks
   * or rooms without visibility).
   *
   * @param room - The room to analyze
   * @returns Optimal harvester count for the room
   */
  private calculateOptimalHarvesterCount(room: RoomLike): number {
    const sourceCount = this.detectEnergySources(room);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const controller = room.controller;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const rcl = controller ? controller.level : 1;

    // No sources detected - use default minimum from role definition
    if (sourceCount === 0) {
      return ROLE_DEFINITIONS["harvester"].minimum;
    }

    // Single source rooms: 2-3 harvesters depending on RCL
    // Multi-source rooms: 1-2 harvesters per source
    if (sourceCount === 1) {
      return rcl >= 3 ? 3 : 2;
    }

    // Multi-source: scale with RCL
    return sourceCount * (rcl >= 3 ? 2 : 1);
  }

  /**
   * Calculates the optimal hauler count based on room layout.
   * More sources require more haulers for efficient logistics.
   *
   * @param room - The room to analyze
   * @returns Optimal hauler count for the room
   */
  private calculateOptimalHaulerCount(room: RoomLike): number {
    const sourceCount = this.detectEnergySources(room);
    // At least 1 hauler per source, more for multi-source rooms
    return Math.max(1, sourceCount);
  }

  /**
   * Checks if the room can afford to spawn a creep while maintaining energy reserves.
   * Ensures 20% energy reserve is maintained for emergencies, construction, and repairs.
   *
   * Emergency Spawn Mode: Bypasses reserve requirement when critically low on harvesters
   * to prevent spawn starvation deadlock (Issue #806).
   *
   * @param room - The room to check energy reserves (must be actual Room type for energy checks)
   * @param spawnCost - Cost of the creep to spawn
   * @param role - Role being spawned (used for emergency spawn detection)
   * @param harvesterCount - Current harvester count (for emergency spawn detection)
   * @returns true if the room can afford the creep while maintaining reserves
   */
  private canAffordCreepWithReserve(
    room: Room | undefined,
    spawnCost: number,
    role: string,
    harvesterCount: number,
    isCriticalSpawn: boolean = false
  ): boolean {
    if (!room) {
      // For test mocks without room property, allow spawning
      return true;
    }

    // Type guard: check if room has energy properties
    // Some test mocks may not have these properties
    const energyAvailable = (room as { energyAvailable?: number }).energyAvailable;
    const energyCapacity = (room as { energyCapacityAvailable?: number }).energyCapacityAvailable;

    if (typeof energyAvailable !== "number" || typeof energyCapacity !== "number") {
      // For test mocks without energy properties, allow spawning if cost is affordable
      return true;
    }

    // Emergency Spawn Mode: Bypass reserve for harvesters when critically low
    // This prevents spawn starvation deadlock where we can't spawn harvesters
    // because of reserve requirements, but can't collect energy without harvesters
    const isEmergencySpawn = role === "harvester" && harvesterCount < 2;
    if (isEmergencySpawn) {
      // In emergency mode, only check if we have enough energy for the spawn
      return energyAvailable >= spawnCost;
    }

    // Critical Spawn Mode: Bypass reserve for critical infrastructure roles
    // When logistics infrastructure exists but haulers are missing, treat as critical
    if (isCriticalSpawn) {
      // In critical mode, only check if we have enough energy for the spawn
      return energyAvailable >= spawnCost;
    }

    // Calculate reserve threshold (20% of capacity, minimum 50 energy)
    const reserveThreshold = Math.max(50, energyCapacity * 0.2);

    // Essential Roles Bypass: Allow spawning essential infrastructure roles even when
    // reserve threshold would block it. This is critical at low RCL where energy capacity
    // is limited (e.g., RCL 2 has 550 capacity, but builder costs 450 + 110 reserve = 560).
    // Essential roles: harvester, upgrader, builder (needed for room progression)
    const isEssentialRole = role === "harvester" || role === "upgrader" || role === "builder";
    const wouldReserveBlockSpawn = spawnCost + reserveThreshold > energyCapacity;

    if (isEssentialRole && wouldReserveBlockSpawn) {
      // For essential roles, only check if we have enough energy for the spawn
      return energyAvailable >= spawnCost;
    }

    // Check if spawning would leave enough reserves
    return energyAvailable - spawnCost >= reserveThreshold;
  }

  /**
   * Calculates task-based creep demand when using the task system.
   * Returns the number of additional creeps needed based on pending task count.
   *
   * @param totalCreeps - Current number of creeps
   * @returns Number of additional creeps needed (0 if task system is disabled)
   */
  private calculateTaskBasedCreepDemand(totalCreeps: number): number {
    if (!this.options.useTaskSystem) {
      return 0;
    }

    const taskStats = this.taskManager.getTaskStats();
    const pendingTasks = taskStats.pending;

    // If no pending tasks, no additional demand
    if (pendingTasks === 0) {
      return 0;
    }

    // Assume each creep can handle ~3-5 tasks on average
    const tasksPerCreep = 4;
    const idealCreepCount = Math.ceil(pendingTasks / tasksPerCreep);

    // Calculate additional creeps needed (capped at +3 per tick to prevent spawn spam)
    const additionalNeeded = Math.max(0, Math.min(3, idealCreepCount - totalCreeps));

    if (additionalNeeded > 0) {
      this.logger.log?.(
        `[BehaviorController] Task queue has ${pendingTasks} pending tasks, ` +
          `${totalCreeps} creeps active. Requesting ${additionalNeeded} additional creeps.`
      );
    }

    return additionalNeeded;
  }

  /**
   * Calculates dynamic role minimums based on room infrastructure and energy sources.
   *
   * When containers exist near energy sources, the system transitions to a more
   * efficient harvesting model:
   * - Stationary harvesters: 1 per source with adjacent container
   * - Haulers: 1+ per room (transport energy from containers)
   * - Repairers: 1 per room (maintain infrastructure)
   * - Regular harvesters: scaled based on source count and RCL
   *
   * When links are operational (RCL 5+), hauler count is reduced as links
   * handle energy transport more efficiently.
   *
   * When using task system: Also increases harvester count based on pending task queue.
   *
   * @param game - The game context
   * @returns Adjusted role minimums for the current room state
   */
  private calculateDynamicRoleMinimums(game: GameContext): Partial<Record<RoleName, number>> {
    const adjustedMinimums: Partial<Record<RoleName, number>> = {};

    // Count sources with adjacent containers and detect link network
    let totalSourcesWithContainers = 0;
    let totalSources = 0;
    let controlledRoomCount = 0;
    let totalOperationalLinks = 0;
    let hasAnyContainersOrStorage = false;
    let hasTowers = false;
    let totalConstructionSites = 0;
    let hasDamagedStructures = false;

    for (const room of Object.values(game.rooms)) {
      if (!room.controller?.my) {
        continue;
      }

      controlledRoomCount++;

      // Find all sources in the room
      const sources = room.find(FIND_SOURCES) as Source[];
      totalSources += sources.length;

      // Count construction sites
      const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
      totalConstructionSites += constructionSites.length;

      // Check for damaged structures (excluding walls/ramparts which have separate logic)
      const damagedStructures = room.find(FIND_STRUCTURES, {
        filter: (s: Structure) => {
          if (!("hits" in s && "hitsMax" in s) || typeof s.hits !== "number" || typeof s.hitsMax !== "number")
            return false;
          // Skip walls and ramparts - they have separate wall upgrade manager logic
          if (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) return false;
          return s.hits < s.hitsMax;
        }
      });
      if (damagedStructures.length > 0) {
        hasDamagedStructures = true;
      }

      // Check for storage or containers anywhere in room (not just near sources)
      // This ensures haulers spawn for tower refilling and storage management
      if (room.storage) {
        hasAnyContainersOrStorage = true;
      }
      const allContainers = room.find(FIND_STRUCTURES, {
        filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER
      });
      if (allContainers.length > 0) {
        hasAnyContainersOrStorage = true;
      }

      // Check for towers that need refilling
      const towers = room.find(FIND_MY_STRUCTURES, {
        filter: (s: Structure) => s.structureType === STRUCTURE_TOWER
      });
      if (towers.length > 0) {
        hasTowers = true;
      }

      // Count operational links (with energy)
      const links = room.find(FIND_MY_STRUCTURES, {
        filter: (s: Structure) => s.structureType === STRUCTURE_LINK
      }) as StructureLink[];
      totalOperationalLinks += links.length;

      for (const source of sources) {
        // Check for containers adjacent to this source
        // Safety check: ensure pos has findInRange method (may not exist in test mocks)
        const sourcePos = source.pos as RoomPosition | undefined;
        if (!sourcePos || typeof sourcePos.findInRange !== "function") {
          continue;
        }

        const nearbyStructures = sourcePos.findInRange(FIND_STRUCTURES, 2, {
          filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER
        }) as Structure[];
        const hasContainer = nearbyStructures.length > 0;

        if (hasContainer) {
          totalSourcesWithContainers++;
        }
      }
    }

    // If we have containers near sources, transition to container-based economy
    if (totalSourcesWithContainers > 0 && controlledRoomCount > 0) {
      // Spawn 1 stationary harvester per source with container
      adjustedMinimums.stationaryHarvester = totalSourcesWithContainers;

      // Calculate hauler count based on link network status
      // When links are operational (2+ links = source + controller/storage),
      // reduce hauler count significantly as links handle energy transport
      let haulerCount: number;
      if (totalOperationalLinks >= 2) {
        // Link network active: minimal haulers for minerals and non-link routes
        haulerCount = Math.max(1, Math.ceil(totalSources / 2));
        this.logger.log?.(
          `[BehaviorController] Link network detected (${totalOperationalLinks} links), ` +
            `reducing haulers to ${haulerCount} (from ${Math.max(totalSources, controlledRoomCount)})`
        );
      } else {
        // No link network: standard hauler allocation (1+ per source)
        haulerCount = Math.max(totalSources, controlledRoomCount);
      }
      adjustedMinimums.hauler = haulerCount;

      // Spawn 1 repairer per controlled room
      adjustedMinimums.repairer = controlledRoomCount;

      // Maintain builder minimum for construction and repairs
      adjustedMinimums.builder = ROLE_DEFINITIONS["builder"].minimum;

      // Reduce regular harvesters - use optimal count for room
      const firstRoom = Object.values(game.rooms).find(r => r.controller?.my);
      if (firstRoom) {
        adjustedMinimums.harvester = this.calculateOptimalHarvesterCount(firstRoom);
      } else {
        adjustedMinimums.harvester = 2;
      }
    } else if (hasAnyContainersOrStorage || hasTowers) {
      // No containers near sources YET, but storage/containers/towers exist
      // Spawn at least 1 hauler for logistics (tower refilling, storage management)
      // This handles the case where towers and storage are built before source containers
      adjustedMinimums.hauler = Math.max(1, controlledRoomCount);
      this.logger.log?.(
        `[BehaviorController] Storage/containers/towers detected without source containers, ` +
          `spawning ${adjustedMinimums.hauler} hauler(s) for logistics`
      );

      // Reduce harvester count when haulers are handling logistics
      // Harvesters no longer need to do double duty (harvest + deliver)
      const firstRoom = Object.values(game.rooms).find(r => r.controller?.my);
      if (firstRoom) {
        const optimalHarvesters = this.calculateOptimalHarvesterCount(firstRoom);
        // With haulers available, reduce harvester count by 1-2 to prevent overstaffing
        adjustedMinimums.harvester = Math.max(2, optimalHarvesters - 1);
      }
    } else {
      // No containers yet - use source-based harvester count
      const firstRoom = Object.values(game.rooms).find(r => r.controller?.my);
      if (firstRoom) {
        const optimalHarvesters = this.calculateOptimalHarvesterCount(firstRoom);
        adjustedMinimums.harvester = optimalHarvesters;
      }
    }

    // Dynamic builder activation based on construction sites
    // Only adjust if not already set by container-based economy logic
    if (adjustedMinimums.builder === undefined) {
      if (totalConstructionSites > 0) {
        // Scale builders with construction queue size
        // 1-5 sites: 1 builder, 6-15 sites: 2 builders, 16+ sites: 3 builders
        if (totalConstructionSites > 15) {
          adjustedMinimums.builder = 3;
        } else if (totalConstructionSites > 5) {
          adjustedMinimums.builder = 2;
        } else {
          adjustedMinimums.builder = 1;
        }
      } else {
        // No construction sites: maintain minimum builder count from role definition (currently 2)
        // This ensures builders are available for repairs and emergency construction
        adjustedMinimums.builder = ROLE_DEFINITIONS["builder"].minimum;
      }
    }

    // Dynamic repairer activation based on damaged structures
    // Only adjust if not already set by container-based economy logic
    if (adjustedMinimums.repairer === undefined) {
      if (hasDamagedStructures) {
        adjustedMinimums.repairer = Math.max(1, controlledRoomCount);
      } else {
        // No damaged structures: maintain minimum repairer count from role definition (currently 0)
        // Builders can handle emergency repairs
        adjustedMinimums.repairer = ROLE_DEFINITIONS["repairer"].minimum;
      }
    }

    // Dynamic upgrader scaling based on energy surplus and RCL
    // Scale upgraders to 4-5 when energy is abundant to accelerate RCL progression
    for (const room of Object.values(game.rooms)) {
      if (!room.controller?.my) {
        continue;
      }

      const rcl = room.controller.level;
      const storage = room.storage as StructureStorage | undefined;
      const hasStorage = storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0;

      // Calculate energy surplus indicators
      const energyAvailable = (room as { energyAvailable?: number }).energyAvailable ?? 0;
      const energyCapacity = (room as { energyCapacityAvailable?: number }).energyCapacityAvailable ?? 300;
      const energyRatio = energyCapacity > 0 ? energyAvailable / energyCapacity : 0;

      // Storage energy percentage (if storage exists)
      const storageEnergy = hasStorage && storage ? storage.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
      const storageCapacity = hasStorage && storage ? storage.store.getCapacity(RESOURCE_ENERGY) : 1;
      const storageRatio = storageEnergy / storageCapacity;

      // Determine upgrader count based on energy surplus
      let upgraderCount = ROLE_DEFINITIONS["upgrader"].minimum; // Default: 3

      // RCL 4+ with energy surplus: increase upgraders for faster progression
      if (rcl >= 4) {
        // High energy surplus: 5 upgraders (storage >50% or consistently full extensions)
        if ((hasStorage && storageRatio > 0.5) || energyRatio > 0.9) {
          upgraderCount = 5;
        }
        // Medium energy surplus: 4 upgraders (storage >30% or extensions >75%)
        else if ((hasStorage && storageRatio > 0.3) || energyRatio > 0.75) {
          upgraderCount = 4;
        }
        // Default: keep minimum of 3 upgraders
      }
      // RCL 3 with good energy: 4 upgraders to accelerate to RCL4
      else if (rcl === 3 && energyRatio > 0.8) {
        upgraderCount = 4;
      }

      // Only adjust if we calculated a higher count (never reduce below minimum)
      if (upgraderCount > ROLE_DEFINITIONS["upgrader"].minimum) {
        adjustedMinimums.upgrader = upgraderCount;
        this.logger.log?.(
          `[BehaviorController] Scaling upgraders to ${upgraderCount} ` +
            `(RCL ${rcl}, energy: ${energyRatio.toFixed(2)}, storage: ${storageRatio.toFixed(2)})`
        );
      }
    }

    return adjustedMinimums;
  }

  private ensureRoleMinimums(
    game: GameContext,
    memory: Memory,
    roleCounts: Record<string, number>,
    spawned: string[],
    bootstrapMinimums: Partial<Record<RoleName, number>>
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

    // Detect containers near sources and adjust role minimums dynamically
    const adjustedMinimums = this.calculateDynamicRoleMinimums(game);

    // Get current harvester count for emergency spawn detection
    const harvesterCount = roleCounts["harvester"] ?? 0;

    // Detect emergency situation: no creeps alive in any owned room
    const totalCreeps = Object.keys(game.creeps).length;
    const isEmergency = totalCreeps === 0;

    // Detect critical hauler shortage: logistics infrastructure exists but no haulers
    // Do NOT prioritize haulers in emergency mode (0 total creeps) - harvesters must spawn first
    const haulerCount = roleCounts["hauler"] ?? 0;
    const haulerMinimum = adjustedMinimums["hauler"] ?? 0;
    const needsCriticalHauler = haulerCount === 0 && haulerMinimum > 0 && !isEmergency;

    // Priority-based spawn order: adjust dynamically based on critical needs
    // When haulers are critically needed (storage/towers exist but 0 haulers),
    // prioritize them FIRST to activate logistics infrastructure immediately.
    // This is critical because storage/towers indicate energy already exists in the room
    // and needs to be distributed to spawns/extensions/towers for operations.

    // Check for defensive posture requiring defender spawning
    // Only consider owned rooms to avoid triggering defense mode for hostile/scouted rooms
    const needsDefenders = Boolean(
      memory.defense &&
        game.rooms &&
        Object.keys(memory.defense.posture).some(roomName => {
          const posture = memory.defense?.posture[roomName];
          return game.rooms[roomName]?.controller?.my && (posture === "defensive" || posture === "emergency");
        })
    );

    let roleOrder: RoleName[];
    if (needsDefenders) {
      // Defense mode: prioritize defenders (attacker, healer) after essential roles
      roleOrder = [
        "harvester", // Essential for energy
        "hauler", // Essential for logistics
        "attacker", // CRITICAL: defend against threats
        "healer", // CRITICAL: support defenders
        "upgrader",
        "builder",
        "stationaryHarvester",
        "repairer",
        "remoteMiner",
        "dismantler",
        "claimer"
      ];
    } else if (needsCriticalHauler) {
      // Hauler emergency mode: spawn hauler first to activate logistics
      roleOrder = [
        "hauler", // CRITICAL: logistics infrastructure exists but not operational
        "harvester",
        "upgrader",
        "builder",
        "stationaryHarvester",
        "repairer",
        "remoteMiner",
        "attacker",
        "healer",
        "dismantler",
        "claimer"
      ];
    } else {
      // Normal priority mode
      roleOrder = [
        "harvester",
        "upgrader",
        "builder",
        "stationaryHarvester",
        "hauler",
        "repairer",
        "remoteMiner",
        "attacker",
        "healer",
        "dismantler",
        "claimer"
      ];
    }

    for (const role of roleOrder) {
      const definition = ROLE_DEFINITIONS[role];
      const current = roleCounts[role] ?? 0;
      const dynamicMinimum = adjustedMinimums[role] ?? definition.minimum;
      const targetMinimum = bootstrapMinimums[role] ?? dynamicMinimum;

      if (current >= targetMinimum) {
        continue;
      }

      const spawn = this.findAvailableSpawn(game.spawns);
      if (!spawn) {
        continue; // No available spawns
      }

      const room = spawn.room as Room | undefined;

      // EMERGENCY MODE: Use actual available energy instead of capacity
      // This allows spawning with whatever energy we have to bootstrap recovery
      const energyToUse =
        isEmergency || harvesterCount === 0 ? (room?.energyAvailable ?? 300) : (room?.energyCapacityAvailable ?? 300);

      // Generate body based on energy (capacity in normal mode, available in emergency)
      // Pass room context for source-aware body composition
      const body = this.bodyComposer.generateBody(role, energyToUse, room);

      if (body.length === 0) {
        // Not enough energy for minimum body
        // In emergency mode, log detailed diagnostics to help identify deadlock recovery status
        if (isEmergency && role === "harvester" && room) {
          const energyAvailable = room.energyAvailable ?? 0;
          const energyCapacity = room.energyCapacityAvailable ?? 0;

          // Check for energy stuck in containers/storage that cannot be transported
          const allStructures = room.find(FIND_STRUCTURES, {
            filter: (s: AnyStructure) => {
              if (s.structureType !== STRUCTURE_CONTAINER && s.structureType !== STRUCTURE_STORAGE) {
                return false;
              }
              return s.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
            }
          });

          const containersWithEnergy = allStructures.filter(
            (s): s is StructureContainer | StructureStorage =>
              s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE
          );

          const totalStoredEnergy = containersWithEnergy.reduce(
            (sum, structure) => sum + structure.store.getUsedCapacity(RESOURCE_ENERGY),
            0
          );

          this.logger.warn?.(
            `[BehaviorController] ⚠️ EMERGENCY DEADLOCK: Cannot spawn harvester - ` +
              `Energy: ${energyAvailable}/${energyCapacity} (${((energyAvailable / Math.max(energyCapacity, 1)) * 100).toFixed(1)}%) - ` +
              `Minimum required: 150 energy (WORK+MOVE) - ` +
              `Stored in containers: ${totalStoredEnergy} energy (inaccessible without creeps) - ` +
              `Waiting for passive source regeneration to reach spawn threshold`
          );
        }
        continue;
      }

      // Validate sufficient energy before spawning to prevent partial spawns
      const spawnCost = this.bodyComposer.calculateBodyCost(body);
      if (spawn.room && spawn.room.energyAvailable < spawnCost) {
        continue; // Not enough energy yet
      }

      // Check if we can afford the creep while maintaining energy reserves (20% buffer)
      // Emergency mode bypasses reserve for harvesters when critically low
      // Critical mode bypasses reserve for haulers when logistics infrastructure exists but is not operational
      const isCriticalSpawn = needsCriticalHauler && role === "hauler";
      if (
        !this.canAffordCreepWithReserve(
          spawn.room as Room | undefined,
          spawnCost,
          role,
          harvesterCount,
          isCriticalSpawn
        )
      ) {
        // Skip spawning to maintain emergency reserves
        continue;
      }

      const name = `${role}-${game.time}-${memory.creepCounter}`;
      memory.creepCounter += 1;

      // Mark emergency creeps with flag for priority spawn refilling
      const creepMemory = definition.memory();
      if (isEmergency || harvesterCount === 0) {
        (creepMemory as BaseCreepMemory & { emergency?: boolean }).emergency = true;
      }

      const result = spawn.spawnCreep(body, name, { memory: creepMemory });
      if (result === OK) {
        spawned.push(name);
        roleCounts[role] = current + 1;

        // Log emergency spawn recovery
        if (isEmergency || harvesterCount === 0) {
          const energyAvailable = room?.energyAvailable ?? 0;
          const energyCapacity = room?.energyCapacityAvailable ?? 0;
          const energyPercent = energyCapacity > 0 ? ((energyAvailable / energyCapacity) * 100).toFixed(1) : "0.0";

          this.logger.log?.(
            `[BehaviorController] ⚠️ EMERGENCY SPAWN: ${name} with ${body.length} parts (${spawnCost} energy) - ` +
              `Recovering from total creep loss (${totalCreeps} creeps, ${harvesterCount} harvesters) - ` +
              `Energy: ${energyAvailable}/${energyCapacity} (${energyPercent}%)`
          );
          // Display emergency visual feedback
          if (room && typeof room.visual?.text === "function") {
            const spawnPos = spawn.pos as { x: number; y: number } | undefined;
            if (spawnPos) {
              room.visual.text("⚠️ EMERGENCY", spawnPos.x, spawnPos.y - 1, {
                color: "red",
                font: 0.5
              });
            }
          }
        } else if (role === "harvester" && harvesterCount < 2) {
          const energyAvailable = room?.energyAvailable ?? 0;
          const energyCapacity = room?.energyCapacityAvailable ?? 0;
          const energyPercent = energyCapacity > 0 ? ((energyAvailable / energyCapacity) * 100).toFixed(1) : "0.0";

          this.logger.log?.(
            `[BehaviorController] EMERGENCY SPAWN: ${name} with ${body.length} parts (${spawnCost} energy) - ` +
              `Recovering from starvation (${harvesterCount} harvesters) - ` +
              `Energy: ${energyAvailable}/${energyCapacity} (${energyPercent}%)`
          );
        } else {
          this.logger.log?.(`[BehaviorController] Spawned ${name} with ${body.length} parts (${spawnCost} energy)`);
        }
      } else {
        this.logger.warn?.(`Failed to spawn ${role}: ${result}`);
      }
    }
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

/**
 * Helper to get communication manager instance
 */
function getComm(): CreepCommunicationManager | null {
  return communicationManager;
}

/**
 * Helper to get energy priority manager instance
 */
function getEnergyManager(): EnergyPriorityManager | null {
  return energyPriorityManager;
}

/**
 * Helper function to find the closest target by path or fall back to the first target.
 * Reduces code duplication throughout the file.
 *
 * @param creep - The creep to find a path from
 * @param targets - Array of potential targets
 * @returns The closest target by path, or the first target if pathfinding fails, or null if no targets
 */
function findClosestOrFirst<T extends _HasRoomPosition>(creep: CreepLike, targets: T[]): T | null {
  if (targets.length === 0) {
    return null;
  }
  return creep.pos.findClosestByPath(targets) ?? targets[0];
}

/**
 * Helper function to pick up nearby dropped energy if the creep has capacity.
 * Returns true if the creep picked up or is moving to pick up energy.
 *
 * @param creep - The creep that should pick up energy
 * @param minAmount - Minimum amount of energy to consider picking up (default: 50)
 * @returns true if energy pickup is in progress, false otherwise
 */
function tryPickupDroppedEnergy(creep: ManagedCreep, minAmount = 50): boolean {
  // Only pick up if creep has capacity
  if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    return false;
  }

  const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
    filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= minAmount
  }) as Resource[];

  if (droppedEnergy.length === 0) {
    return false;
  }

  const closest = creep.pos.findClosestByPath(droppedEnergy);
  const target = closest ?? droppedEnergy[0];

  const result = creep.pickup(target);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, { range: 1, reusePath: 10 });
    return true;
  } else if (result === OK) {
    return true;
  }

  return false;
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
  const comm = getComm();

  // CRITICAL: Check if spawn needs immediate refilling BEFORE any other task
  // This ensures emergency recovery and prevents spawn starvation
  const hasEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
  if (hasEnergy) {
    const spawnsNeedingEnergy = creep.room.find(FIND_MY_STRUCTURES, {
      filter: (structure: AnyStructure) => {
        if (structure.structureType !== STRUCTURE_SPAWN) return false;
        // TypeScript knows structure is StructureSpawn after the type check
        const capacity = structure.store.getCapacity(RESOURCE_ENERGY);
        const current = structure.store.getUsedCapacity(RESOURCE_ENERGY);
        // Spawn is critical if below 50% capacity or below 150 energy (minimum spawn threshold)
        return current < Math.max(150, capacity * 0.5);
      }
    }) as StructureSpawn[];

    if (spawnsNeedingEnergy.length > 0) {
      // FORCE delivery to spawn - override any other task
      memory.task = DELIVER_TASK;
      comm?.say(creep, "🚨spawn");

      const spawn = creep.pos.findClosestByPath(spawnsNeedingEnergy) ?? spawnsNeedingEnergy[0];
      const result = creep.transfer(spawn, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(spawn, { range: 1, reusePath: 10, visualizePathStyle: { stroke: "#ff0000" } });
      }
      return DELIVER_TASK;
    }
  }

  const task = ensureHarvesterTask(memory, creep);

  if (task === HARVEST_TASK) {
    // Communicate status change when transitioning to full
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      comm?.say(creep, "full");
    } else {
      comm?.say(creep, "harvest");
    }

    // Try to pick up dropped energy first
    if (tryPickupDroppedEnergy(creep)) {
      return HARVEST_TASK;
    }

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
  comm?.say(creep, "deliver");

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
  comm?.say(creep, "upgrade");

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
  const comm = getComm();
  const energyMgr = getEnergyManager();

  // Check if room is under defensive posture - pause upgrading during combat
  const roomPosture = Memory.defense?.posture[creep.room.name];
  const shouldPauseUpgrading = roomPosture === "defensive" || roomPosture === "emergency";

  if (shouldPauseUpgrading) {
    // During combat, upgraders move to a safe position and pause upgrading
    comm?.say(creep, "🛡️");
    // Move to a safe position near storage/spawn
    let safeSpot: { pos: RoomPosition } | undefined;
    if (creep.room.storage) {
      safeSpot = creep.room.storage;
    } else {
      const spawns = creep.room.find(FIND_MY_SPAWNS) as StructureSpawn[];
      safeSpot = spawns[0];
    }
    if (safeSpot && !creep.pos.inRangeTo(safeSpot, 3)) {
      void creep.moveTo(safeSpot, { range: 3, reusePath: 10 });
    }
    return UPGRADE_TASK; // Keep task state but don't upgrade
  }

  // CRITICAL: Check if spawn needs immediate refilling BEFORE any other task
  const hasEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
  if (hasEnergy) {
    const spawnsNeedingEnergy = creep.room.find(FIND_MY_STRUCTURES, {
      filter: (structure: AnyStructure) => {
        if (structure.structureType !== STRUCTURE_SPAWN) return false;
        // TypeScript knows structure is StructureSpawn after the type check
        const capacity = structure.store.getCapacity(RESOURCE_ENERGY);
        const current = structure.store.getUsedCapacity(RESOURCE_ENERGY);
        return current < Math.max(150, capacity * 0.5);
      }
    }) as StructureSpawn[];

    if (spawnsNeedingEnergy.length > 0) {
      comm?.say(creep, "🚨spawn");
      const spawn = creep.pos.findClosestByPath(spawnsNeedingEnergy) ?? spawnsNeedingEnergy[0];
      const result = creep.transfer(spawn, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(spawn, { range: 1, reusePath: 10, visualizePathStyle: { stroke: "#ff0000" } });
      }
      return UPGRADE_TASK; // Return current task to avoid state confusion
    }
  }

  const task = ensureUpgraderTask(memory, creep);

  if (task === RECHARGE_TASK) {
    comm?.say(creep, "gather");

    // Priority 1: Pick up dropped energy
    if (tryPickupDroppedEnergy(creep)) {
      return RECHARGE_TASK;
    }

    // Priority 2: Use energy priority manager to get available sources (respecting reserves)
    const energySources = energyMgr
      ? energyMgr.getAvailableEnergySources(creep.room, 0, true)
      : creep.room.find(FIND_STRUCTURES, {
          filter: isValidEnergySource
        });

    const target = energySources.length > 0 ? (creep.pos.findClosestByPath(energySources) ?? energySources[0]) : null;
    if (target) {
      const result = creep.withdraw(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      }
      return RECHARGE_TASK;
    }

    // Priority 3: Harvest from sources directly if no other options
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

  comm?.say(creep, "upgrade");

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
  const comm = getComm();
  const energyMgr = getEnergyManager();

  // CRITICAL: Check if spawn needs immediate refilling BEFORE any other task
  const hasEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
  if (hasEnergy) {
    const spawnsNeedingEnergy = creep.room.find(FIND_MY_STRUCTURES, {
      filter: (structure: AnyStructure) => {
        if (structure.structureType !== STRUCTURE_SPAWN) return false;
        // TypeScript knows structure is StructureSpawn after the type check
        const capacity = structure.store.getCapacity(RESOURCE_ENERGY);
        const current = structure.store.getUsedCapacity(RESOURCE_ENERGY);
        return current < Math.max(150, capacity * 0.5);
      }
    }) as StructureSpawn[];

    if (spawnsNeedingEnergy.length > 0) {
      comm?.say(creep, "🚨spawn");
      const spawn = creep.pos.findClosestByPath(spawnsNeedingEnergy) ?? spawnsNeedingEnergy[0];
      const result = creep.transfer(spawn, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(spawn, { range: 1, reusePath: 10, visualizePathStyle: { stroke: "#ff0000" } });
      }
      return BUILDER_BUILD_TASK; // Return current task to avoid state confusion
    }
  }

  const task = ensureBuilderTask(memory, creep);

  if (task === BUILDER_GATHER_TASK) {
    comm?.say(creep, "gather");

    // Priority 1: Pick up dropped energy
    if (tryPickupDroppedEnergy(creep)) {
      return BUILDER_GATHER_TASK;
    }

    // Priority 2: Use energy priority manager to get available sources (respecting reserves)
    const energySources = energyMgr
      ? energyMgr.getAvailableEnergySources(creep.room, 0, true)
      : creep.room.find(FIND_STRUCTURES, {
          filter: isValidEnergySource
        });

    const target = energySources.length > 0 ? (creep.pos.findClosestByPath(energySources) ?? energySources[0]) : null;
    if (target) {
      const result = creep.withdraw(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      }
      return BUILDER_GATHER_TASK;
    }

    // Priority 3: Harvest from sources directly if no other options
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
    comm?.say(creep, "build");

    // Prioritize construction sites by structure type
    const constructionPriorities = [
      STRUCTURE_SPAWN,
      STRUCTURE_EXTENSION,
      STRUCTURE_TOWER,
      STRUCTURE_CONTAINER,
      STRUCTURE_STORAGE,
      STRUCTURE_ROAD, // Roads lower priority but still automated
      STRUCTURE_RAMPART,
      STRUCTURE_WALL
    ];

    const sites = creep.room.find(FIND_CONSTRUCTION_SITES) as ConstructionSite[];

    // Find highest priority site
    let site: ConstructionSite | null = null;
    for (const structureType of constructionPriorities) {
      const prioritySites = sites.filter(s => s.structureType === structureType);
      if (prioritySites.length > 0) {
        site = creep.pos.findClosestByPath(prioritySites) ?? prioritySites[0];
        break;
      }
    }

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
  comm?.say(creep, "repair");

  const targetHits = wallUpgradeManager?.getTargetHits(creep.room) ?? 0;
  const repairTargets = creep.room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) => {
      if (!("hits" in structure) || typeof structure.hits !== "number") {
        return false;
      }

      if (structure.structureType === STRUCTURE_WALL) {
        return structure.hits < targetHits;
      }

      if (structure.structureType === STRUCTURE_RAMPART) {
        return structure.hits < targetHits;
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
  const comm = getComm();

  if (task === REMOTE_TRAVEL_TASK) {
    comm?.say(creep, "travel");

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
    comm?.say(creep, "harvest");

    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = REMOTE_RETURN_TASK;
      comm?.say(creep, "full");
      return REMOTE_RETURN_TASK;
    }

    // Try to pick up dropped energy first
    if (tryPickupDroppedEnergy(creep)) {
      return REMOTE_MINE_TASK;
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

  comm?.say(creep, "deliver");

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
  const comm = getComm();

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

  // Find or remember container near source (within range 2 = 1 space away)
  if (!memory.containerId) {
    const nearbyStructures = source.pos.findInRange(FIND_STRUCTURES, 2);
    const containers = nearbyStructures.filter((s): s is StructureContainer => s.structureType === STRUCTURE_CONTAINER);

    if (containers.length > 0) {
      memory.containerId = containers[0].id;
    }
  }

  const container = memory.containerId ? Game.getObjectById(memory.containerId) : null;

  // Move to source if not adjacent

  const isNear = creep.pos.inRangeTo(source, 1);
  if (!isNear) {
    comm?.say(creep, "travel");
    creep.moveTo(source, { range: 1, reusePath: 50 });
    return STATIONARY_HARVEST_TASK;
  }

  comm?.say(creep, "harvest");

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
 * Finds containers adjacent to spawns in a room.
 * Helper function to avoid duplicate find operations in hauler logic.
 *
 * @param room - The room to search in
 * @param minEnergy - Optional minimum energy threshold to filter containers
 * @returns Array of containers adjacent to spawns
 */
function findSpawnAdjacentContainers(
  room: { find: (constant: number, opts?: unknown) => unknown[] },
  minEnergy?: number
): StructureContainer[] {
  const spawns = room.find(FIND_MY_SPAWNS) as StructureSpawn[];
  const containers: StructureContainer[] = [];

  for (const spawn of spawns) {
    const nearbyStructures = spawn.pos.findInRange(FIND_STRUCTURES, 1, {
      filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER
    });

    for (const structure of nearbyStructures) {
      const container = structure as StructureContainer;
      if (minEnergy !== undefined) {
        const currentEnergy = container.store.getUsedCapacity(RESOURCE_ENERGY);
        if (currentEnergy < minEnergy && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          containers.push(container);
        }
      } else if (container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        containers.push(container);
      }
    }
  }

  return containers;
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
  const comm = getComm();

  if (task === HAULER_PICKUP_TASK) {
    comm?.say(creep, "pickup");

    // Priority 1: Pick up dropped energy
    if (tryPickupDroppedEnergy(creep)) {
      return HAULER_PICKUP_TASK;
    }

    // Priority 2: Pick up from containers near sources
    const containers = creep.room.find(FIND_STRUCTURES, {
      filter: s =>
        s.structureType === STRUCTURE_CONTAINER && (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 0
    }) as StructureContainer[];

    if (containers.length > 0) {
      const closest = creep.pos.findClosestByPath(containers);
      const target = closest ?? containers[0];
      const result = creep.withdraw(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      }
    }

    return HAULER_PICKUP_TASK;
  }

  // HAULER_DELIVER_TASK: Threshold-based delivery for balanced energy distribution
  comm?.say(creep, "deliver");

  const energyMgr = getEnergyManager();

  // Priority 1: Critical spawns/extensions (below threshold capacity)
  // These need immediate attention to prevent spawn starvation
  const criticalSpawns = creep.room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) => {
      if (structure.structureType !== STRUCTURE_SPAWN && structure.structureType !== STRUCTURE_EXTENSION) {
        return false;
      }
      const store = (structure as AnyStoreStructure).store;
      const capacity = store.getCapacity(RESOURCE_ENERGY);
      const used = store.getUsedCapacity(RESOURCE_ENERGY);
      return capacity > 0 && used < capacity * DEFAULT_ENERGY_CONFIG.towerMinCapacity;
    }
  });

  if (criticalSpawns.length > 0) {
    const closest = creep.pos.findClosestByPath(criticalSpawns);
    const target = closest !== null ? closest : criticalSpawns[0];
    const result = creep.transfer(target, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { range: 1, reusePath: 30 });
    }
    return HAULER_DELIVER_TASK;
  }

  // Priority 2: Towers below threshold capacity (defense)
  const lowTowers = creep.room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) => {
      if (structure.structureType !== STRUCTURE_TOWER) return false;
      const tower = structure;
      const capacity = tower.store.getCapacity(RESOURCE_ENERGY);
      const used = tower.store.getUsedCapacity(RESOURCE_ENERGY);
      return capacity > 0 && used < capacity * DEFAULT_ENERGY_CONFIG.towerMinCapacity;
    }
  }) as StructureTower[];

  if (lowTowers.length > 0) {
    const closest = creep.pos.findClosestByPath(lowTowers);
    const target = closest ?? lowTowers[0];
    const result = creep.transfer(target, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { range: 1, reusePath: 30 });
    }
    return HAULER_DELIVER_TASK;
  }

  // Priority 3: Spawn-adjacent containers below reserve threshold
  if (energyMgr) {
    const lowSpawnContainers = findSpawnAdjacentContainers(creep.room, DEFAULT_ENERGY_CONFIG.spawnContainerReserve);

    if (lowSpawnContainers.length > 0) {
      const closest = creep.pos.findClosestByPath(lowSpawnContainers);
      const target = closest ?? lowSpawnContainers[0];
      const result = creep.transfer(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      }
      return HAULER_DELIVER_TASK;
    }
  }

  // Priority 4: Top off spawns and extensions to full capacity
  const spawnsExtensions = creep.room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) =>
      (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
      (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
  });

  if (spawnsExtensions.length > 0) {
    const closest = creep.pos.findClosestByPath(spawnsExtensions);
    const target = closest !== null ? closest : spawnsExtensions[0];
    const result = creep.transfer(target, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { range: 1, reusePath: 30 });
    }
    return HAULER_DELIVER_TASK;
  }

  // Priority 5: Top off towers to full capacity
  const towers = creep.room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) => {
      if (structure.structureType !== STRUCTURE_TOWER) return false;
      return structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
    }
  }) as StructureTower[];

  if (towers.length > 0) {
    const closest = creep.pos.findClosestByPath(towers);
    const target = closest ?? towers[0];
    const result = creep.transfer(target, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { range: 1, reusePath: 30 });
    }
    return HAULER_DELIVER_TASK;
  }

  // Priority 6: Fill spawn-adjacent containers to full capacity
  if (energyMgr) {
    const spawnContainers = findSpawnAdjacentContainers(creep.room);

    if (spawnContainers.length > 0) {
      const closest = creep.pos.findClosestByPath(spawnContainers);
      const target = closest ?? spawnContainers[0];
      const result = creep.transfer(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      }
      return HAULER_DELIVER_TASK;
    }
  }

  // Priority 7: Storage (surplus)

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

/**
 * Ensures the repairer creep's task state is consistent with its energy store.
 *
 * If the current task is invalid, sets it to gather. Transitions from gather to repair
 * when the creep's energy store is full, and from repair to gather when empty.
 *
 * @param memory - The repairer's memory object, containing the current task.
 * @param creep - The repairer creep instance.
 * @returns The updated repairer task.
 */
function ensureRepairerTask(memory: RepairerMemory, creep: CreepLike): RepairerTask {
  if (memory.task !== REPAIRER_GATHER_TASK && memory.task !== REPAIRER_REPAIR_TASK) {
    memory.task = REPAIRER_GATHER_TASK;
    return memory.task;
  }

  if (memory.task === REPAIRER_GATHER_TASK && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    memory.task = REPAIRER_REPAIR_TASK;
  } else if (memory.task === REPAIRER_REPAIR_TASK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    memory.task = REPAIRER_GATHER_TASK;
  }

  return memory.task;
}

/**
 * Executes the behavior logic for a repairer creep.
 *
 * Repairers are responsible for maintaining structures in the room. They gather energy
 * from containers or storage, then repair structures with priority given to:
 *   1. Roads and containers (infrastructure)
 *   2. Other structures (excluding walls and ramparts above target HP)
 *
 * When in gather mode, the repairer seeks out containers with energy (priority) or
 * storage, withdrawing energy as appropriate. When in repair mode, the repairer
 * identifies and repairs damaged structures following the priority order above.
 *
 * The function manages the repairer's task state (gather or repair) and moves the creep
 * accordingly.
 *
 * @param creep - The repairer creep to run behavior for.
 * @returns The current repairer task ("repairerGather" or "repair") as a string.
 */
function runRepairer(creep: ManagedCreep): string {
  const memory = creep.memory as RepairerMemory;
  const task = ensureRepairerTask(memory, creep);
  const comm = getComm();
  const energyMgr = getEnergyManager();

  if (task === REPAIRER_GATHER_TASK) {
    comm?.say(creep, "gather");

    // Use energy priority manager to get available sources (respecting reserves)
    const energySources = energyMgr
      ? energyMgr.getAvailableEnergySources(creep.room, 50, true)
      : creep.room.find(FIND_STRUCTURES, {
          filter: s => isValidEnergySource(s, 50)
        });

    const target = findClosestOrFirst(creep, energySources);
    if (target) {
      const result = creep.withdraw(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      }
      return REPAIRER_GATHER_TASK;
    }

    // Priority 2: Pick up dropped energy
    if (tryPickupDroppedEnergy(creep)) {
      return REPAIRER_GATHER_TASK;
    }

    // Priority 3: Harvest from sources directly if no other options
    const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
    const source = findClosestOrFirst(creep, sources);
    if (source) {
      const harvestResult = creep.harvest(source);
      if (harvestResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { range: 1, reusePath: 30 });
      }
    }

    return REPAIRER_GATHER_TASK;
  }

  // REPAIRER_REPAIR_TASK
  comm?.say(creep, "repair");

  // Priority 1: Roads and containers (infrastructure)
  // Roads are repaired when below 50% health to prevent decay while not over-prioritizing maintenance
  // Containers are repaired when below 50% health (critical threshold to prevent decay)
  const infrastructureTargets = creep.room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) => {
      if (!("hits" in structure) || typeof structure.hits !== "number") {
        return false;
      }

      // Prioritize roads when below 50% health
      if (structure.structureType === STRUCTURE_ROAD) {
        return structure.hits < structure.hitsMax * 0.5;
      }

      // Prioritize containers when below 50% health (Phase 1 requirement)
      if (structure.structureType === STRUCTURE_CONTAINER) {
        return structure.hits < structure.hitsMax * 0.5;
      }

      return false;
    }
  }) as Structure[];

  // Sort infrastructure targets to prioritize source containers
  // Source containers (near sources) are more critical than controller containers
  const sources = creep.room.find(FIND_SOURCES) as Source[];
  if (infrastructureTargets.length > 1) {
    infrastructureTargets.sort((a, b) => {
      const isAContainer = a.structureType === STRUCTURE_CONTAINER;
      const isBContainer = b.structureType === STRUCTURE_CONTAINER;

      // Both are containers - prioritize by proximity to sources
      if (isAContainer && isBContainer) {
        const aNearSource = sources.some(s => s.pos.inRangeTo(a.pos, 2));
        const bNearSource = sources.some(s => s.pos.inRangeTo(b.pos, 2));

        if (aNearSource && !bNearSource) return -1;
        if (!aNearSource && bNearSource) return 1;

        // Both near or both far from sources - use distance to creep
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const aDist = creep.pos.getRangeTo(a.pos);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const bDist = creep.pos.getRangeTo(b.pos);
        return aDist - bDist;
      }

      // Containers prioritized over roads
      if (isAContainer && !isBContainer) return -1;
      if (!isAContainer && isBContainer) return 1;

      // Both are same type - use distance
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const aDist = creep.pos.getRangeTo(a.pos);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const bDist = creep.pos.getRangeTo(b.pos);
      return aDist - bDist;
    });
  }

  if (infrastructureTargets.length > 0) {
    const target = creep.pos.findClosestByPath(infrastructureTargets) ?? infrastructureTargets[0];
    if (target) {
      const result = creep.repair(target);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 3, reusePath: 30 });
      }
      return REPAIRER_REPAIR_TASK;
    }
  }

  // Priority 2: Other structures (excluding walls and ramparts)
  const targetHits = wallUpgradeManager?.getTargetHits(creep.room) ?? 0;
  const repairTargets = creep.room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) => {
      if (!("hits" in structure) || typeof structure.hits !== "number") {
        return false;
      }

      // Skip infrastructure (already handled above)
      if (structure.structureType === STRUCTURE_ROAD || structure.structureType === STRUCTURE_CONTAINER) {
        return false;
      }

      if (structure.structureType === STRUCTURE_WALL) {
        return structure.hits < targetHits;
      }

      if (structure.structureType === STRUCTURE_RAMPART) {
        return structure.hits < targetHits;
      }

      return structure.hits < structure.hitsMax;
    }
  }) as Structure[];

  const target = findClosestOrFirst(creep, repairTargets);
  if (target) {
    const result = creep.repair(target);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { range: 3, reusePath: 30 });
    }
    return REPAIRER_REPAIR_TASK;
  }

  // No repairs needed, idle or upgrade controller as fallback
  const controller = creep.room.controller;
  if (controller) {
    const upgrade = creep.upgradeController(controller);
    if (upgrade === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { range: 3, reusePath: 30 });
    }
  }

  return REPAIRER_REPAIR_TASK;
}

/**
 * Executes the behavior logic for an attacker creep.
 *
 * Attackers are specialized for melee combat. They prioritize hostile creeps,
 * then hostile spawns, then towers, and finally other hostile structures.
 * Attackers coordinate with healers in their squad for sustained engagement.
 *
 * @param creep - The attacker creep to run behavior for.
 * @returns The current attacker task ("attack") as a string.
 */
function runAttacker(creep: ManagedCreep): string {
  const memory = creep.memory as AttackerMemory;
  const comm = getComm();

  // Move to target room if specified
  if (memory.targetRoom && creep.room.name !== memory.targetRoom) {
    comm?.say(creep, "➡️");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const exitDir: ExitConstant | ERR_NO_PATH | ERR_INVALID_ARGS = creep.room.findExitTo(memory.targetRoom);
    if (typeof exitDir === "number" && exitDir >= 1 && exitDir <= 8) {
      const exitPositions = creep.room.find(exitDir as ExitConstant) as RoomPosition[];
      if (exitPositions.length > 0) {
        const exitPos: RoomPosition | null = creep.pos.findClosestByPath(exitPositions);
        const actualExitPos: RoomPosition = exitPos ?? exitPositions[0];
        creep.moveTo(actualExitPos, { reusePath: 50 });
      }
    }
    return ATTACKER_ATTACK_TASK;
  }

  comm?.say(creep, "⚔️");

  // Priority 1: Attack hostile creeps
  const hostileCreeps = creep.room.find(FIND_HOSTILE_CREEPS) as Creep[];
  if (hostileCreeps.length > 0) {
    const target: Creep | null = creep.pos.findClosestByPath(hostileCreeps);
    const actualTarget: Creep = target ?? hostileCreeps[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = creep.attack(actualTarget);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(actualTarget, { reusePath: 10 });
    }
    return ATTACKER_ATTACK_TASK;
  }

  // Priority 2: Attack hostile spawns
  const hostileSpawns = creep.room.find(FIND_STRUCTURES, {
    filter: (s: Structure): s is StructureSpawn =>
      !s.my && "owner" in s && s.owner !== undefined && s.structureType === STRUCTURE_SPAWN
  });
  if (hostileSpawns.length > 0) {
    const target: StructureSpawn | null = creep.pos.findClosestByPath(hostileSpawns);
    const actualTarget: StructureSpawn = target ?? hostileSpawns[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = creep.attack(actualTarget);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(actualTarget, { reusePath: 20 });
    }
    return ATTACKER_ATTACK_TASK;
  }

  // Priority 3: Attack hostile towers
  const hostileTowers = creep.room.find(FIND_STRUCTURES, {
    filter: (s: Structure): s is StructureTower =>
      !s.my && "owner" in s && s.owner !== undefined && s.structureType === STRUCTURE_TOWER
  });
  if (hostileTowers.length > 0) {
    const target: StructureTower | null = creep.pos.findClosestByPath(hostileTowers);
    const actualTarget: StructureTower = target ?? hostileTowers[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = creep.attack(actualTarget);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(actualTarget, { reusePath: 20 });
    }
    return ATTACKER_ATTACK_TASK;
  }

  // Priority 4: Attack any hostile structure
  const hostileStructures = creep.room.find(FIND_STRUCTURES, {
    filter: (s: Structure): s is OwnedStructure => !s.my && "owner" in s && s.owner !== undefined
  });
  if (hostileStructures.length > 0) {
    const target: Structure | null = creep.pos.findClosestByPath(hostileStructures);
    const actualTarget: Structure = target ?? hostileStructures[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = creep.attack(actualTarget);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(actualTarget, { reusePath: 20 });
    }
    return ATTACKER_ATTACK_TASK;
  }

  // No targets found - hold position or return to rally point
  return ATTACKER_ATTACK_TASK;
}

/**
 * Executes the behavior logic for a healer creep.
 *
 * Healers support combat operations by healing damaged friendly creeps.
 * They prioritize critically wounded creeps, then engaged attackers, then any damaged friendlies.
 * Healers stay close to their squad for maximum effectiveness.
 *
 * @param creep - The healer creep to run behavior for.
 * @returns The current healer task ("heal") as a string.
 */
function runHealer(creep: ManagedCreep): string {
  const memory = creep.memory as HealerMemory;
  const comm = getComm();

  // Move to target room if specified
  if (memory.targetRoom && creep.room.name !== memory.targetRoom) {
    comm?.say(creep, "➡️");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const exitDir: ExitConstant | ERR_NO_PATH | ERR_INVALID_ARGS = creep.room.findExitTo(memory.targetRoom);
    if (typeof exitDir === "number" && exitDir >= 1 && exitDir <= 8) {
      const exitPositions = creep.room.find(exitDir as ExitConstant) as RoomPosition[];
      if (exitPositions.length > 0) {
        const exitPos: RoomPosition | null = creep.pos.findClosestByPath(exitPositions);
        const actualExitPos: RoomPosition = exitPos ?? exitPositions[0];
        creep.moveTo(actualExitPos, { reusePath: 50 });
      }
    }
    return HEALER_HEAL_TASK;
  }

  comm?.say(creep, "💚");

  // Find wounded friendly creeps
  const woundedCreeps = creep.room.find(FIND_MY_CREEPS, {
    filter: (c: Creep) => c.hits < c.hitsMax
  }) as Creep[];

  if (woundedCreeps.length > 0) {
    // Sort by health percentage (most critical first)

    woundedCreeps.sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax);

    const target = woundedCreeps[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    if (creep.pos.isNearTo(target)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      creep.heal(target);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      creep.rangedHeal(target);
      creep.moveTo(target, { reusePath: 10 });
    }
    return HEALER_HEAL_TASK;
  }

  // No wounded friendlies - follow squad leader (attacker)
  if (memory.squadId) {
    const squadMembers = Object.values(Game.creeps).filter(
      c => (c.memory as AttackerMemory).squadId === memory.squadId && c.memory.role === "attacker"
    );
    if (squadMembers.length > 0) {
      const leader = squadMembers[0];
      if (!creep.pos.inRangeTo(leader, 2)) {
        creep.moveTo(leader, { reusePath: 20 });
      }
    }
  }

  return HEALER_HEAL_TASK;
}

/**
 * Executes the behavior logic for a dismantler creep.
 *
 * Dismantlers specialize in destroying defensive structures to create breach points.
 * They prioritize ramparts, then walls, then towers, allowing attackers to penetrate defenses.
 * Dismantlers have high WORK parts for maximum structure damage.
 *
 * @param creep - The dismantler creep to run behavior for.
 * @returns The current dismantler task ("dismantle") as a string.
 */
function runDismantler(creep: ManagedCreep): string {
  const memory = creep.memory as DismantlerMemory;
  const comm = getComm();

  // Move to target room if specified
  if (memory.targetRoom && creep.room.name !== memory.targetRoom) {
    comm?.say(creep, "➡️");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const exitDir: ExitConstant | ERR_NO_PATH | ERR_INVALID_ARGS = creep.room.findExitTo(memory.targetRoom);
    if (typeof exitDir === "number" && exitDir >= 1 && exitDir <= 8) {
      const exitPositions = creep.room.find(exitDir as ExitConstant) as RoomPosition[];
      if (exitPositions.length > 0) {
        const exitPos: RoomPosition | null = creep.pos.findClosestByPath(exitPositions);
        const actualExitPos: RoomPosition = exitPos ?? exitPositions[0];
        creep.moveTo(actualExitPos, { reusePath: 50 });
      }
    }
    return DISMANTLER_DISMANTLE_TASK;
  }

  comm?.say(creep, "🔨");

  // Priority 1: Dismantle ramparts (create breach points)
  const ramparts = creep.room.find(FIND_STRUCTURES, {
    filter: (s: Structure): s is StructureRampart =>
      !s.my && "owner" in s && s.owner !== undefined && s.structureType === STRUCTURE_RAMPART
  });
  if (ramparts.length > 0) {
    const target: StructureRampart | null = creep.pos.findClosestByPath(ramparts);
    const actualTarget: StructureRampart = target ?? ramparts[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = creep.dismantle(actualTarget);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(actualTarget, { reusePath: 20 });
    }
    return DISMANTLER_DISMANTLE_TASK;
  }

  // Priority 2: Dismantle walls
  const walls = creep.room.find(FIND_STRUCTURES, {
    filter: (s: Structure) => s.structureType === STRUCTURE_WALL
  }) as StructureWall[];
  if (walls.length > 0) {
    const target: StructureWall | null = creep.pos.findClosestByPath(walls);
    const actualTarget: StructureWall = target ?? walls[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = creep.dismantle(actualTarget);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(actualTarget, { reusePath: 20 });
    }
    return DISMANTLER_DISMANTLE_TASK;
  }

  // Priority 3: Dismantle towers
  const towers = creep.room.find(FIND_STRUCTURES, {
    filter: (s: Structure): s is StructureTower =>
      !s.my && "owner" in s && s.owner !== undefined && s.structureType === STRUCTURE_TOWER
  });
  if (towers.length > 0) {
    const target: StructureTower | null = creep.pos.findClosestByPath(towers);
    const actualTarget: StructureTower = target ?? towers[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = creep.dismantle(actualTarget);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(actualTarget, { reusePath: 20 });
    }
    return DISMANTLER_DISMANTLE_TASK;
  }

  // Priority 4: Dismantle any hostile structure
  const hostileStructures = creep.room.find(FIND_STRUCTURES, {
    filter: (s: Structure): s is OwnedStructure => !s.my && "owner" in s && s.owner !== undefined
  });
  if (hostileStructures.length > 0) {
    const target: Structure | null = creep.pos.findClosestByPath(hostileStructures);
    const actualTarget: Structure = target ?? hostileStructures[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = creep.dismantle(actualTarget);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(actualTarget, { reusePath: 20 });
    }
    return DISMANTLER_DISMANTLE_TASK;
  }

  // No targets found - hold position
  return DISMANTLER_DISMANTLE_TASK;
}

/**
 * Run claimer role behavior.
 * Claimers travel to a target room and claim the controller.
 *
 * @param creep - The claimer creep to run behavior for.
 * @returns The current claimer task as a string.
 */
function runClaimer(creep: ManagedCreep): string {
  const memory = creep.memory as ClaimerMemory;
  const targetRoom = memory.targetRoom;
  const comm = getComm();

  if (!targetRoom) {
    comm?.say(creep, "❌");
    return CLAIMER_CLAIM_TASK;
  }

  // If not in target room, move there
  if (creep.room.name !== targetRoom) {
    comm?.say(creep, "🚀");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const exit = creep.room.findExitTo(targetRoom);
    if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const exitPos = creep.pos.findClosestByRange(exit);
      if (exitPos) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        creep.moveTo(exitPos, { reusePath: 50 });
      }
    }
    return CLAIMER_CLAIM_TASK;
  }

  // In target room - claim controller
  const controller = creep.room.controller;
  if (!controller) {
    comm?.say(creep, "❌");
    return CLAIMER_CLAIM_TASK;
  }

  comm?.say(creep, "🏴");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const result = creep.claimController(controller);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(controller, { reusePath: 30 });
  } else if (result === OK) {
    comm?.say(creep, "✅");
  }

  return CLAIMER_CLAIM_TASK;
}
