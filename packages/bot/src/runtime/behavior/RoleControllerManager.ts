/**
 * Role Controller Manager
 *
 * Lightweight coordinator that manages individual role controllers.
 * Replaces the monolithic BehaviorController with a modular architecture.
 *
 * Responsibilities:
 * - Register and lookup role controllers
 * - Coordinate spawning across all roles
 * - Calculate dynamic role minimums
 * - Execute creep behavior via role controllers
 * - CPU budget management
 */

import type { BehaviorSummary } from "@shared/contracts";
import type { CreepLike, GameContext } from "@runtime/types/GameContext";
import { profile } from "@ralphschuler/screeps-profiler";
import { CreepCommunicationManager } from "./CreepCommunicationManager";
import { EnergyPriorityManager } from "@runtime/energy";
import { BodyComposer } from "./BodyComposer";
import { WallUpgradeManager } from "@runtime/defense/WallUpgradeManager";
import { isCreepDying, handleDyingCreepEnergyDrop } from "./creepHelpers";
import { ScoutManager } from "@runtime/scouting/ScoutManager";
import { RoleTaskQueueManager } from "./RoleTaskQueue";
import * as TaskDiscovery from "./TaskDiscovery";
import type { RoleController } from "./controllers/RoleController";
import { serviceRegistry } from "./controllers/ServiceLocator";
import {
  HarvesterController,
  UpgraderController,
  BuilderController,
  HaulerController,
  RepairerController,
  StationaryHarvesterController,
  RemoteMinerController,
  RemoteHaulerController,
  AttackerController,
  HealerController,
  DismantlerController,
  ClaimerController,
  ScoutController
} from "./controllers";

type RoleName =
  | "harvester"
  | "upgrader"
  | "builder"
  | "remoteMiner"
  | "remoteHauler"
  | "stationaryHarvester"
  | "hauler"
  | "repairer"
  | "attacker"
  | "healer"
  | "dismantler"
  | "claimer"
  | "scout";

interface ManagedCreep extends CreepLike {
  memory: CreepMemory & { role?: RoleName };
}

interface RoleControllerManagerOptions {
  cpuSafetyMargin?: number;
  maxCpuPerCreep?: number;
  enableCreepCommunication?: boolean;
}

/**
 * Coordinates spawning and per-tick behavior execution using individual role controllers.
 */
@profile
export class RoleControllerManager {
  private readonly options: Required<RoleControllerManagerOptions>;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly communicationManager: CreepCommunicationManager;
  private readonly energyPriorityManager: EnergyPriorityManager;
  private readonly bodyComposer: BodyComposer;
  private readonly wallUpgradeManager: WallUpgradeManager;
  private readonly scoutManager: ScoutManager;
  private readonly taskQueueManager: RoleTaskQueueManager;
  private readonly roleControllers: Map<string, RoleController>;

  public constructor(options: RoleControllerManagerOptions = {}, logger: Pick<Console, "log" | "warn"> = console) {
    this.logger = logger;
    this.options = {
      cpuSafetyMargin: options.cpuSafetyMargin ?? 0.85,
      maxCpuPerCreep: options.maxCpuPerCreep ?? 1.5,
      enableCreepCommunication: options.enableCreepCommunication ?? true
    };

    // Initialize shared services
    this.communicationManager = new CreepCommunicationManager();
    this.energyPriorityManager = new EnergyPriorityManager({}, this.logger);
    this.bodyComposer = new BodyComposer();
    this.wallUpgradeManager = new WallUpgradeManager();
    this.scoutManager = new ScoutManager(this.logger);
    this.taskQueueManager = new RoleTaskQueueManager(this.logger);

    // Register services in service locator
    serviceRegistry.setCommunicationManager(this.communicationManager);
    serviceRegistry.setEnergyPriorityManager(this.energyPriorityManager);
    serviceRegistry.setWallUpgradeManager(this.wallUpgradeManager);

    // Initialize role controllers registry
    this.roleControllers = new Map();

    // Register all role controllers
    // Core economy roles
    this.registerRoleController(new HarvesterController());
    this.registerRoleController(new UpgraderController());
    this.registerRoleController(new BuilderController());
    this.registerRoleController(new HaulerController());
    this.registerRoleController(new RepairerController());

    // Specialized roles
    this.registerRoleController(new StationaryHarvesterController());
    this.registerRoleController(new RemoteMinerController());
    this.registerRoleController(new RemoteHaulerController());

    // Combat roles
    this.registerRoleController(new AttackerController());
    this.registerRoleController(new HealerController());
    this.registerRoleController(new DismantlerController());

    // Support roles
    this.registerRoleController(new ClaimerController());
    this.registerRoleController(new ScoutController());
  }

  /**
   * Register a role controller
   */
  private registerRoleController(controller: RoleController): void {
    this.roleControllers.set(controller.getRoleName(), controller);
  }

  /**
   * Get a role controller by name
   */
  private getRoleController(roleName: string): RoleController | undefined {
    return this.roleControllers.get(roleName);
  }

  /**
   * Run a full behavior tick and return a summary of executed actions.
   * Implements CPU budget management to prevent script execution timeouts.
   */
  public execute(
    game: GameContext,
    memory: Memory,
    roleCounts: Record<string, number>,
    bootstrapMinimums?: Partial<Record<RoleName, number>>
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
    this.ensureRoleMinimums(game, memory, roleCounts, spawned, bootstrapMinimums ?? {});

    // Clean up dead creep tasks first to release assignments before new task discovery
    this.taskQueueManager.cleanupDeadCreepTasks(memory, game);

    // Task Discovery Phase: Populate task queues before creep execution
    this.discoverTasks(game, memory);

    // Execute role-based system using individual controllers
    const result = this.executeWithRoleControllers(game, memory);

    memory.roles = roleCounts;

    return {
      processedCreeps: result.processedCreeps,
      spawnedCreeps: spawned,
      tasksExecuted: result.tasksExecuted
    };
  }

  /**
   * Discover and populate task queues for all roles.
   */
  private discoverTasks(game: GameContext, memory: Memory): void {
    const currentTick = game.time;

    // Process each owned room to discover tasks
    for (const room of Object.values(game.rooms)) {
      if (!room.controller?.my) {
        continue;
      }

      // Get target HP for repair tasks from wall upgrade manager
      const targetHits = this.wallUpgradeManager.getTargetHits(room);

      // Discover tasks for each role type
      const harvesterTasks = TaskDiscovery.discoverHarvestTasks(room, currentTick);
      const builderBuildTasks = TaskDiscovery.discoverBuildTasks(room, currentTick);
      const builderRepairTasks = TaskDiscovery.discoverRepairTasks(room, currentTick, targetHits);
      const haulerPickupTasks = TaskDiscovery.discoverPickupTasks(room, currentTick);
      const haulerDeliveryTasks = TaskDiscovery.discoverDeliveryTasks(room, currentTick);
      const upgraderTasks = TaskDiscovery.discoverUpgradeTasks(room, currentTick);
      const stationaryHarvestTasks = TaskDiscovery.discoverStationaryHarvestTasks(room, currentTick);
      const repairerTasks = TaskDiscovery.discoverRepairTasks(room, currentTick, targetHits);

      // Add tasks to respective role queues
      for (const task of harvesterTasks) {
        this.taskQueueManager.addTask(memory, "harvester", task);
      }

      for (const task of [...builderBuildTasks, ...builderRepairTasks]) {
        this.taskQueueManager.addTask(memory, "builder", task);
      }

      for (const task of [...haulerPickupTasks, ...haulerDeliveryTasks]) {
        this.taskQueueManager.addTask(memory, "hauler", task);
      }

      for (const task of upgraderTasks) {
        this.taskQueueManager.addTask(memory, "upgrader", task);
      }

      for (const task of stationaryHarvestTasks) {
        this.taskQueueManager.addTask(memory, "stationaryHarvester", task);
      }

      for (const task of repairerTasks) {
        this.taskQueueManager.addTask(memory, "repairer", task);
      }
    }

    // Clean up expired tasks for all roles that have queues
    const taskQueue = memory.taskQueue as { [role: string]: unknown[] } | undefined;
    if (taskQueue) {
      for (const role of Object.keys(taskQueue)) {
        this.taskQueueManager.cleanupExpiredTasks(memory, role, currentTick);
      }
    }
  }

  /**
   * Execute using individual role controllers.
   */
  private executeWithRoleControllers(
    game: GameContext,
    memory: Memory
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
      const dyingConfig = memory.dyingCreepBehavior ?? { enabled: true, ttlThreshold: 50 };
      const isDying = dyingConfig.enabled !== false && isCreepDying(creep as Creep, dyingConfig.ttlThreshold ?? 50);

      if (isDying) {
        const dropped = handleDyingCreepEnergyDrop(creep as Creep);
        if (dropped) {
          this.communicationManager.say(creep, "💀");
        }
        processedCreeps++;
        continue; // Skip normal behavior for dying creeps
      }

      const role = creep.memory.role;
      const controller = role ? this.getRoleController(role) : undefined;

      if (!controller) {
        this.logger.warn?.(`Unknown or unimplemented role '${role}' for creep ${creep.name}`);
        processedCreeps++;
        continue;
      }

      // Validate and migrate memory if needed
      controller.validateMemory(creep);

      // Execute role behavior
      const task = controller.execute(creep);
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
   * Ensure role minimums are met by spawning creeps as needed.
   */
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

    // Detect emergency situation: no creeps alive in any owned room
    const totalCreeps = Object.keys(game.creeps).length;
    const isEmergency = totalCreeps === 0;
    const harvesterCount = roleCounts["harvester"] ?? 0;

    // Determine spawn priority order
    const roleOrder: RoleName[] = [
      "harvester",
      "upgrader",
      "builder",
      "stationaryHarvester",
      "hauler",
      "repairer",
      "remoteMiner",
      "remoteHauler",
      "scout",
      "attacker",
      "healer",
      "dismantler",
      "claimer"
    ];

    for (const role of roleOrder) {
      const controller = this.getRoleController(role);
      if (!controller) {
        continue;
      }

      const current = roleCounts[role] ?? 0;
      const config = controller.getConfig();
      const targetMinimum = bootstrapMinimums[role] ?? config.minimum;

      if (current >= targetMinimum) {
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const spawn = this.findAvailableSpawn(game.spawns);
      if (!spawn) {
        continue; // No available spawns
      }

      // Get spawn energy details using helper to avoid type casting issues
      const spawnEnergy = this.getSpawnEnergyDetails(spawn, isEmergency || harvesterCount === 0);
      const energyToUse = spawnEnergy.energyToUse;

      // Generate body based on energy
      const body = this.bodyComposer.generateBody(role, energyToUse, spawnEnergy.room);

      if (body.length === 0) {
        // Not enough energy for minimum body
        continue;
      }

      // Validate sufficient energy before spawning
      const spawnCost = this.bodyComposer.calculateBodyCost(body);
      if (spawnEnergy.energyAvailable < spawnCost) {
        continue; // Not enough energy yet
      }

      const name = `${role}-${game.time}-${memory.creepCounter}`;
      memory.creepCounter += 1;

      const creepMemory = controller.createMemory();

      const result = this.spawnCreepSafely(spawn, body, name, creepMemory);
      if (result === OK) {
        spawned.push(name);
        this.logger.log?.(`[RoleControllerManager] Spawned ${name} (${body.length} parts, ${spawnCost} energy)`);
      }
    }
  }

  /**
   * Find an available spawn that is not currently spawning.
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  private findAvailableSpawn(spawns: Record<string, SpawnLike>): SpawnLike | undefined {
    for (const spawn of Object.values(spawns)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (!spawn.spawning) {
        return spawn;
      }
    }
    return undefined;
  }

  /**
   * Helper method to extract energy details from spawn in a type-safe way.
   * Centralizes all type casting for spawns to a single location.
   */
  private getSpawnEnergyDetails(
    spawn: SpawnLike,
    isEmergencyMode: boolean
  ): { energyAvailable: number; energyCapacity: number; energyToUse: number; room: Room | undefined } {
    // Type guard to safely access room properties
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const room = spawn.room;

    // Extract energy values with fallback defaults
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const energyAvailable = (room.energyAvailable as number | undefined) ?? 300;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const energyCapacity = (room.energyCapacityAvailable as number | undefined) ?? 300;

    // EMERGENCY MODE: Use actual available energy instead of capacity
    const energyToUse = isEmergencyMode ? energyAvailable : energyCapacity;

    return {
      energyAvailable,
      energyCapacity,
      energyToUse,
      room: room as Room | undefined
    };
  }

  /**
   * Helper method to safely spawn a creep, handling type casting in one place.
   */
  private spawnCreepSafely(
    spawn: SpawnLike,
    body: BodyPartConstant[],
    name: string,
    memory: CreepMemory
  ): ScreepsReturnCode {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return spawn.spawnCreep(body, name, { memory });
  }
}
