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
 * - Traffic management via PathfindingManager
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
import { PathfindingManager } from "@runtime/pathfinding";
import {
  HarvesterController,
  UpgraderController,
  BuilderController,
  HaulerController,
  RepairerController,
  StationaryHarvesterController,
  RemoteUpgraderController,
  RemoteHaulerController,
  RemoteBuilderController,
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
  | "remoteUpgrader"
  | "remoteHauler"
  | "remoteBuilder"
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
 * Combat mode constants for spawn prioritization
 */
const COMBAT_UPGRADER_REDUCTION_FACTOR = 0.3; // Reduce upgrader minimum to 30% during combat
const COMBAT_MIN_ATTACKERS_HEALERS = 2; // Minimum attackers/healers during combat
const COMBAT_MIN_REPAIRERS = 1; // Minimum repairers during combat

/**
 * Room integration constants for workforce deployment
 */
const UPGRADERS_PER_INTEGRATION_ROOM = 2; // Remote upgraders spawned per room needing integration
const BUILDERS_PER_INTEGRATION_ROOM = 2; // Remote builders spawned per room needing integration
const DISMANTLERS_PER_INTEGRATION_ROOM = 1; // Dismantlers spawned per room needing structure clearing

/**
 * Attack flag constants for attacker spawning
 */
const ATTACKERS_PER_ATTACK_FLAG = 2; // Attackers spawned per attack flag command

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
  private readonly pathfindingManager: PathfindingManager;

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

    // Initialize PathfindingManager for traffic management
    // This enables priority-based movement and creep traffic coordination
    // Note: PathfindingManager gracefully handles library loading failures via isAvailable() checks
    this.pathfindingManager = new PathfindingManager({
      enableCaching: true,
      logger: this.logger
    });

    // Log pathfinding availability status for monitoring
    if (!this.pathfindingManager.isAvailable()) {
      this.logger.warn?.(
        `[RoleControllerManager] PathfindingManager unavailable - traffic management disabled, falling back to native pathfinding`
      );
    }

    // Register services in service locator
    serviceRegistry.setCommunicationManager(this.communicationManager);
    serviceRegistry.setEnergyPriorityManager(this.energyPriorityManager);
    serviceRegistry.setWallUpgradeManager(this.wallUpgradeManager);
    serviceRegistry.setPathfindingManager(this.pathfindingManager);

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
    this.registerRoleController(new RemoteUpgraderController());
    this.registerRoleController(new RemoteHaulerController());
    this.registerRoleController(new RemoteBuilderController());

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

    // CRITICAL: Execute all queued moves with traffic management
    // This must be called AFTER all creep behavior has issued move intents
    // to enable priority-based movement coordination and creep swapping
    this.pathfindingManager.runMoves();

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

    // CRITICAL: Emergency spawn protection - handle total workforce collapse
    if (isEmergency) {
      this.logger.log?.(`[EMERGENCY] Total workforce collapse detected - forcing minimal spawn`);

      const result = this.attemptEmergencyHarvesterSpawn(game, spawned, roleCounts, "EMERGENCY", "emergency");

      if (result.success) {
        return; // Skip normal spawn logic - emergency spawn takes priority
      } else {
        this.logger.warn?.(`[EMERGENCY] ${result.error} - may need manual intervention`);
        return; // Prevent fallthrough to normal spawn logic after emergency spawn failure
      }
    }

    // CRITICAL: Harvester priority check - prevents energy starvation deadlock
    // When no harvesters exist but other creeps do, force harvester spawn before any other role
    // This prevents scenarios where non-harvester spawns drain energy, stopping energy income
    if (harvesterCount === 0 && totalCreeps > 0) {
      this.logger.log?.(`[CRITICAL] No harvesters alive - forcing harvester priority spawn`);

      const result = this.attemptEmergencyHarvesterSpawn(game, spawned, roleCounts, "CRITICAL", "priority");

      if (result.success) {
        this.logger.log?.(`[CRITICAL] Unblocking normal spawns`);
        return; // Skip normal spawn logic - priority spawn takes precedence
      } else {
        this.logger.warn?.(`[CRITICAL] ${result.error} - blocking other spawns`);
        return; // Block all spawns until harvester can be spawned
      }
    }

    // Pre-calculate room creep counts to avoid repeated filtering
    // Map room name to creep count for efficient lookup during spawning
    const roomCreepCounts = new Map<string, number>();
    for (const creep of Object.values(game.creeps)) {
      const roomName = creep.room.name;
      roomCreepCounts.set(roomName, (roomCreepCounts.get(roomName) ?? 0) + 1);
    }

    // Check if any room is under defensive posture (alert, defensive, or emergency)
    const defenseMemory = memory.defense;
    const roomsUnderCombat = defenseMemory
      ? Object.entries(defenseMemory.posture)
          .filter(([_, posture]) => posture === "alert" || posture === "defensive" || posture === "emergency")
          .map(([roomName, _]) => roomName)
      : [];
    const isUnderCombat = roomsUnderCombat.length > 0;

    // Check if any room is in emergency posture (most severe)
    const hasEmergencyPosture = defenseMemory
      ? Object.values(defenseMemory.posture).some(posture => posture === "emergency")
      : false;

    // Check for pending expansion requests and adjust claimer minimum
    // Access colony memory expansion queue (typed as ColonyManagerMemory when set by EmpireManager)
    const expansionQueue = memory.colony?.expansionQueue as Array<{ targetRoom: string; status: string }> | undefined;
    const pendingExpansions = expansionQueue?.filter(req => req.status === "pending") ?? [];
    const needsClaimers = pendingExpansions.length > 0;

    // Pre-calculate claimer assignments to avoid repeated iterations
    // Build a Set of target rooms already assigned to claimers and count them
    const assignedClaimerRooms = new Set<string>();
    let claimersOnExpansionCount = 0;
    if (needsClaimers) {
      for (const creep of Object.values(game.creeps)) {
        if (creep.memory.role === "claimer" && creep.memory.targetRoom) {
          assignedClaimerRooms.add(creep.memory.targetRoom);
          if (pendingExpansions.some(exp => exp.targetRoom === creep.memory.targetRoom)) {
            claimersOnExpansionCount++;
          }
        }
      }
    }

    // Check for pending attack requests from attack flag commands
    // Access combat memory attack queue (set by FlagCommandInterpreter)
    const attackQueue = memory.combat?.attackQueue as
      | Array<{ targetRoom: string; status: string; flagName: string; targetPos?: { x: number; y: number } }>
      | undefined;
    const pendingAttacks = attackQueue?.filter(req => req.status === "pending") ?? [];
    const needsAttackers = pendingAttacks.length > 0;

    // Pre-calculate attacker assignments to avoid repeated iterations
    // Map of targetRoom:flagName to assigned attacker count
    const assignedAttackersByTarget = new Map<string, number>();
    if (needsAttackers) {
      for (const creep of Object.values(game.creeps)) {
        if (creep.memory.role === "attacker" && creep.memory.targetRoom) {
          const targetKey = creep.memory.targetRoom;
          assignedAttackersByTarget.set(targetKey, (assignedAttackersByTarget.get(targetKey) ?? 0) + 1);
        }
      }
    }

    // Check for newly claimed rooms needing workforce deployment
    // These are rooms with controller.my but no operational spawn
    // Note: We access memory directly because RoleControllerManager doesn't own ColonyManager
    // (ColonyManager is owned by EmpireManager). The filter logic mirrors ColonyManager.getRoomsNeedingWorkforce()
    const roomsNeedingIntegration =
      memory.colony?.roomsNeedingIntegration?.filter(data => data.status === "pending" || data.status === "building") ??
      [];
    const needsRemoteWorkforce = roomsNeedingIntegration.length > 0;

    // Pre-calculate remote worker assignments for rooms needing integration
    const assignedRemoteUpgraders = new Map<string, number>(); // targetRoom -> count
    const assignedRemoteBuilders = new Map<string, number>(); // targetRoom -> count
    const assignedDismantlers = new Map<string, number>(); // targetRoom -> count
    if (needsRemoteWorkforce) {
      for (const creep of Object.values(game.creeps)) {
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) continue;

        if (creep.memory.role === "remoteUpgrader") {
          assignedRemoteUpgraders.set(targetRoom, (assignedRemoteUpgraders.get(targetRoom) ?? 0) + 1);
        } else if (creep.memory.role === "remoteBuilder") {
          // Count remote builders assigned to integration rooms
          assignedRemoteBuilders.set(targetRoom, (assignedRemoteBuilders.get(targetRoom) ?? 0) + 1);
        } else if (creep.memory.role === "dismantler") {
          // Count dismantlers assigned to integration rooms for structure clearing
          assignedDismantlers.set(targetRoom, (assignedDismantlers.get(targetRoom) ?? 0) + 1);
        }
      }

      this.logger.log?.(
        `[RoleControllerManager] Rooms needing workforce: ${roomsNeedingIntegration.map(r => r.roomName).join(", ")}`
      );
    }

    // Detect integration rooms that need structure clearing (non-owned structures to dismantle)
    // This identifies rooms where dismantlers should be spawned to clear leftover structures
    const roomsNeedingClearing = this.detectRoomsNeedingClearing(game, roomsNeedingIntegration);
    const needsDismantlers = roomsNeedingClearing.length > 0;

    if (needsDismantlers) {
      this.logger.log?.(`[RoleControllerManager] Rooms needing structure clearing: ${roomsNeedingClearing.join(", ")}`);
    }

    // Determine spawn priority order based on combat status
    // Base role order that will be adjusted based on conditions
    const baseRoleOrder: RoleName[] = [
      "harvester",
      "upgrader",
      "builder",
      "stationaryHarvester",
      "hauler",
      "repairer",
      "remoteUpgrader",
      "remoteHauler",
      "remoteBuilder",
      "scout",
      "attacker",
      "healer",
      "dismantler",
      "claimer"
    ];

    let roleOrder: RoleName[];
    if (isUnderCombat) {
      // Combat mode: prioritize defenders, attackers, and repairers over upgraders
      roleOrder = [
        "harvester",
        "attacker",
        "healer",
        "repairer",
        "hauler",
        "builder",
        "stationaryHarvester",
        "upgrader",
        "remoteUpgrader",
        "remoteHauler",
        "remoteBuilder",
        "scout",
        "dismantler",
        "claimer"
      ];
      this.logger.log?.(`[RoleControllerManager] Combat mode active in rooms: ${roomsUnderCombat.join(", ")}`);
    } else if (needsAttackers && needsClaimers) {
      // Attack flags pending with expansion: prioritize attackers over claimers
      // Attackers should spawn before claimers since attacks are typically more urgent
      roleOrder = baseRoleOrder.filter(r => r !== "attacker" && r !== "claimer");
      roleOrder.splice(1, 0, "attacker"); // Attackers second (after harvesters)
      roleOrder.splice(2, 0, "claimer"); // Claimers third
    } else if (needsAttackers) {
      // Attack flags pending: prioritize attackers (second after harvesters)
      roleOrder = baseRoleOrder.filter(r => r !== "attacker");
      roleOrder.splice(1, 0, "attacker");
    } else if (needsClaimers) {
      // Normal mode with expansion: prioritize claimers (second after harvesters)
      roleOrder = baseRoleOrder.filter(r => r !== "claimer");
      roleOrder.splice(1, 0, "claimer");
    } else if (needsRemoteWorkforce) {
      // Normal mode with room integration: prioritize remote upgraders, builders, and dismantlers
      // Dismantlers are included if rooms need structure clearing
      roleOrder = [
        "harvester",
        "upgrader",
        "remoteUpgrader",
        "remoteBuilder",
        ...(needsDismantlers ? ["dismantler" as const] : []),
        "builder",
        "stationaryHarvester",
        "hauler",
        "repairer",
        "remoteHauler",
        "scout",
        "attacker",
        "healer",
        ...(needsDismantlers ? [] : ["dismantler" as const]), // Keep dismantler in list if not already added
        "claimer"
      ];
    } else {
      // Normal mode: standard priority order
      roleOrder = baseRoleOrder;
    }

    if (needsClaimers) {
      this.logger.log?.(
        `[RoleControllerManager] Expansion pending to ${pendingExpansions.map(e => e.targetRoom).join(", ")} - prioritizing claimer spawning`
      );
    }

    if (needsAttackers) {
      this.logger.log?.(
        `[RoleControllerManager] Attack pending to ${pendingAttacks.map(a => a.targetRoom).join(", ")} - prioritizing attacker spawning`
      );
    }

    for (const role of roleOrder) {
      const controller = this.getRoleController(role);
      if (!controller) {
        continue;
      }

      const current = roleCounts[role] ?? 0;
      const config = controller.getConfig();
      let targetMinimum = bootstrapMinimums[role] ?? config.minimum;

      // Dynamically increase claimer minimum when expansion is pending
      if (role === "claimer" && needsClaimers) {
        // Use pre-calculated claimer count to avoid iterating through all creeps again
        // Spawn one claimer per pending expansion (up to current pending count)
        targetMinimum = Math.max(targetMinimum, pendingExpansions.length - claimersOnExpansionCount);
      }

      // Dynamically increase remote upgrader minimum when rooms need workforce integration
      // Spawn remote upgraders per room needing workforce (to upgrade controller in new rooms)
      if (role === "remoteUpgrader" && needsRemoteWorkforce) {
        let neededUpgraders = 0;
        for (const integrationRoom of roomsNeedingIntegration) {
          const assigned = assignedRemoteUpgraders.get(integrationRoom.roomName) ?? 0;
          neededUpgraders += Math.max(0, UPGRADERS_PER_INTEGRATION_ROOM - assigned);
        }
        targetMinimum = Math.max(targetMinimum, neededUpgraders);
      }

      // Dynamically increase remote builder minimum when rooms need workforce integration
      // Spawn remote builders per room needing workforce (to build spawn and structures)
      if (role === "remoteBuilder" && needsRemoteWorkforce) {
        let neededBuilders = 0;
        for (const integrationRoom of roomsNeedingIntegration) {
          const assigned = assignedRemoteBuilders.get(integrationRoom.roomName) ?? 0;
          neededBuilders += Math.max(0, BUILDERS_PER_INTEGRATION_ROOM - assigned);
        }
        targetMinimum = Math.max(targetMinimum, neededBuilders);
      }

      // Dynamically increase dismantler minimum when integration rooms need structure clearing
      // Spawn dismantlers to clear leftover structures from previous room owners
      if (role === "dismantler" && needsDismantlers) {
        let neededDismantlers = 0;
        for (const roomName of roomsNeedingClearing) {
          const assigned = assignedDismantlers.get(roomName) ?? 0;
          neededDismantlers += Math.max(0, DISMANTLERS_PER_INTEGRATION_ROOM - assigned);
        }
        targetMinimum = Math.max(targetMinimum, neededDismantlers);
      }

      // Dynamically increase attacker minimum when attack flags are pending
      // Spawn attackers per attack flag command (to fulfill attack requests)
      if (role === "attacker" && needsAttackers) {
        let neededAttackers = 0;
        for (const attackRequest of pendingAttacks) {
          const assigned = assignedAttackersByTarget.get(attackRequest.targetRoom) ?? 0;
          neededAttackers += Math.max(0, ATTACKERS_PER_ATTACK_FLAG - assigned);
        }
        targetMinimum = Math.max(targetMinimum, neededAttackers);
      }

      // Dynamically reduce upgrader minimum during combat to focus on defense
      if (role === "upgrader" && isUnderCombat) {
        if (hasEmergencyPosture) {
          // Emergency: Stop spawning upgraders entirely
          targetMinimum = 0;
        } else {
          // Alert/Defensive: Reduce upgrader minimum to 30%
          targetMinimum = Math.max(0, Math.floor(targetMinimum * COMBAT_UPGRADER_REDUCTION_FACTOR));
        }

        if (targetMinimum === 0 && current === 0) {
          continue; // Skip spawning upgraders entirely
        }
      }

      // Increase attacker/healer/repairer minimums during combat
      if ((role === "attacker" || role === "healer") && isUnderCombat) {
        targetMinimum = Math.max(config.minimum, COMBAT_MIN_ATTACKERS_HEALERS);
      }
      if (role === "repairer" && isUnderCombat) {
        targetMinimum = Math.max(config.minimum, COMBAT_MIN_REPAIRERS);
      }

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

      // CRITICAL: Prevent oversized bodies when available energy is below capacity
      // Use the smaller of available vs capacity-derived budget so we can bootstrap recovery
      const energyBudget = Math.min(spawnEnergy.energyToUse, spawnEnergy.energyAvailable);

      // Get pre-calculated creep count for the spawn's room
      // Defaults to 0 if room not in map (no creeps in room)
      const roomCreepCount = spawnEnergy.room ? (roomCreepCounts.get(spawnEnergy.room.name) ?? 0) : undefined;

      // Generate body based on energy
      const body = this.bodyComposer.generateBody(role, energyBudget, spawnEnergy.room, roomCreepCount);

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

      // If spawning a claimer for expansion, assign the target room
      if (role === "claimer" && needsClaimers) {
        // Use pre-calculated Set to efficiently find first unassigned expansion
        const unassignedExpansion = pendingExpansions.find(
          expansion => !assignedClaimerRooms.has(expansion.targetRoom)
        );

        if (unassignedExpansion) {
          // Set targetRoom using explicit property assignment (ClaimerMemory extends CreepMemory with optional targetRoom)
          (creepMemory as CreepMemory & { targetRoom?: string }).targetRoom = unassignedExpansion.targetRoom;
          this.logger.log?.(
            `[RoleControllerManager] Assigning claimer ${name} to expansion target: ${unassignedExpansion.targetRoom}`
          );
        }
      }

      // If spawning a remote upgrader for room integration, assign home and target rooms
      if (role === "remoteUpgrader" && needsRemoteWorkforce) {
        // Find an integration room that needs more upgraders
        for (const integrationRoom of roomsNeedingIntegration) {
          const assigned = assignedRemoteUpgraders.get(integrationRoom.roomName) ?? 0;
          if (assigned < UPGRADERS_PER_INTEGRATION_ROOM) {
            // Assign this upgrader to the integration room
            (creepMemory as CreepMemory & { homeRoom?: string; targetRoom?: string }).homeRoom =
              integrationRoom.homeRoom;
            (creepMemory as CreepMemory & { homeRoom?: string; targetRoom?: string }).targetRoom =
              integrationRoom.roomName;
            // Update pre-calculated count for subsequent iterations
            assignedRemoteUpgraders.set(integrationRoom.roomName, assigned + 1);
            this.logger.log?.(
              `[RoleControllerManager] Assigning remote upgrader ${name} to integration room: ${integrationRoom.roomName} (home: ${integrationRoom.homeRoom})`
            );
            break;
          }
        }
      }

      // If spawning a remote builder for room integration, assign home and target rooms
      if (role === "remoteBuilder" && needsRemoteWorkforce) {
        // Find an integration room that needs more builders
        for (const integrationRoom of roomsNeedingIntegration) {
          const assigned = assignedRemoteBuilders.get(integrationRoom.roomName) ?? 0;
          if (assigned < BUILDERS_PER_INTEGRATION_ROOM) {
            // Assign this builder to the integration room
            (creepMemory as CreepMemory & { homeRoom?: string; targetRoom?: string }).homeRoom =
              integrationRoom.homeRoom;
            (creepMemory as CreepMemory & { homeRoom?: string; targetRoom?: string }).targetRoom =
              integrationRoom.roomName;
            // Update pre-calculated count for subsequent iterations
            assignedRemoteBuilders.set(integrationRoom.roomName, assigned + 1);
            this.logger.log?.(
              `[RoleControllerManager] Assigning remote builder ${name} to integration room: ${integrationRoom.roomName} (home: ${integrationRoom.homeRoom})`
            );
            break;
          }
        }
      }

      // If spawning a dismantler for room clearing, assign home and target rooms
      if (role === "dismantler" && needsDismantlers) {
        // Find an integration room that needs structure clearing
        for (const roomName of roomsNeedingClearing) {
          const assigned = assignedDismantlers.get(roomName) ?? 0;
          if (assigned < DISMANTLERS_PER_INTEGRATION_ROOM) {
            // Find the home room for this integration room
            const integrationData = roomsNeedingIntegration.find(r => r.roomName === roomName);
            const homeRoom = integrationData?.homeRoom ?? Object.values(game.spawns)[0]?.room?.name ?? "";

            // Assign this dismantler to the integration room for clearing
            (creepMemory as CreepMemory & { homeRoom?: string; targetRoom?: string; mode?: string }).homeRoom =
              homeRoom;
            (creepMemory as CreepMemory & { homeRoom?: string; targetRoom?: string; mode?: string }).targetRoom =
              roomName;
            (creepMemory as CreepMemory & { homeRoom?: string; targetRoom?: string; mode?: string }).mode = "clearing";
            // Update pre-calculated count for subsequent iterations
            assignedDismantlers.set(roomName, assigned + 1);
            this.logger.log?.(
              `[RoleControllerManager] Assigning dismantler ${name} to clear structures in: ${roomName} (home: ${homeRoom})`
            );
            break;
          }
        }
      }

      // If spawning an attacker for attack flag command, assign target room
      if (role === "attacker" && needsAttackers) {
        // Find an attack target that needs more attackers
        for (const attackRequest of pendingAttacks) {
          const assigned = assignedAttackersByTarget.get(attackRequest.targetRoom) ?? 0;
          if (assigned < ATTACKERS_PER_ATTACK_FLAG) {
            // Assign this attacker to the attack target
            (creepMemory as CreepMemory & { targetRoom?: string }).targetRoom = attackRequest.targetRoom;
            // Update pre-calculated count for subsequent iterations
            assignedAttackersByTarget.set(attackRequest.targetRoom, assigned + 1);
            this.logger.log?.(
              `[RoleControllerManager] Assigning attacker ${name} to attack target: ${attackRequest.targetRoom}`
            );
            break;
          }
        }
      }

      const result = this.spawnCreepSafely(spawn, body, name, creepMemory);
      if (result === OK) {
        spawned.push(name);
        // Update role counts to reflect the newly spawned creep
        roleCounts[role] = (roleCounts[role] ?? 0) + 1;
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

  /**
   * Attempt to spawn an emergency harvester using minimal body composition.
   * Used during workforce collapse scenarios (total emergency or harvester priority).
   *
   * @param game - Game context
   * @param spawned - Array to track spawned creep names
   * @param roleCounts - Role counts to update on successful spawn
   * @param logPrefix - Prefix for log messages (e.g., "EMERGENCY", "CRITICAL")
   * @param namePrefix - Prefix for creep name (e.g., "emergency", "priority")
   * @returns Object with success status and optional error message
   */
  private attemptEmergencyHarvesterSpawn(
    game: GameContext,
    spawned: string[],
    roleCounts: Record<string, number>,
    logPrefix: string,
    namePrefix: string
  ): { success: boolean; blocked: boolean; error?: string } {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const spawn = this.findAvailableSpawn(game.spawns);
    if (!spawn) {
      return { success: false, blocked: true, error: "No spawn available" };
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const room = spawn.room as Room;
    const energyAvailable = room.energyAvailable;

    // Generate minimal viable body using BodyComposer's emergency logic
    const minimalBody = this.bodyComposer.generateEmergencyBody(energyAvailable);

    if (minimalBody.length === 0) {
      const minimalCost = 200; // Minimum required for [WORK, CARRY, MOVE]
      return {
        success: false,
        blocked: true,
        error: `Insufficient energy (${energyAvailable}) for minimal body (need ${minimalCost})`
      };
    }

    const roleName: RoleName = "harvester";
    const name = `${namePrefix}-${roleName}-${game.time}`;
    const controller = this.getRoleController(roleName);
    const creepMemory = controller?.createMemory() ?? { role: roleName };
    const result = this.spawnCreepSafely(spawn, minimalBody, name, creepMemory);

    if (result === OK) {
      spawned.push(name);
      roleCounts[roleName] = (roleCounts[roleName] ?? 0) + 1;
      const spawnCost = this.bodyComposer.calculateBodyCost(minimalBody);
      this.logger.log?.(
        `[${logPrefix}] Spawned ${name} with minimal body (${minimalBody.length} parts, ${spawnCost} energy)`
      );
      return { success: true, blocked: false };
    } else {
      return { success: false, blocked: true, error: `Spawn failed: ${result}` };
    }
  }

  /**
   * Detect integration rooms that need structure clearing.
   * Returns a list of room names that have non-owned structures requiring dismantling.
   *
   * This method checks each integration room for structures that:
   * - Are not owned by us (my === false)
   * - Are not controllers (cannot be dismantled)
   * - Are owned structures (spawns, extensions, towers, etc.) left by previous owner
   *
   * Note: Roads and containers are deliberately kept as they are useful.
   * Only walls and owned structures are targeted for clearing.
   *
   * @param game - Game context with rooms
   * @param roomsNeedingIntegration - List of rooms currently being integrated
   * @returns Array of room names that need structure clearing
   */
  private detectRoomsNeedingClearing(
    game: GameContext,
    roomsNeedingIntegration: Array<{ roomName: string; status: string; homeRoom: string }>
  ): string[] {
    const roomsNeedingClearing: string[] = [];

    for (const integrationData of roomsNeedingIntegration) {
      const room = game.rooms[integrationData.roomName];
      if (!room?.controller?.my) {
        continue; // Room not visible or not owned
      }

      // Check if the room has structures that need clearing
      // We only target structures we don't own and that are not useful
      const structuresToClear = room.find(FIND_STRUCTURES, {
        filter: (s: AnyStructure) => {
          // Never clear controllers
          if (s.structureType === STRUCTURE_CONTROLLER) {
            return false;
          }

          // Check if structure is owned and not ours
          if ("my" in s) {
            // Owned structure - only count if not ours
            return (s as OwnedStructure).my === false;
          }

          // For non-ownable structures, only count walls (constructed)
          // Roads and containers are useful and should be kept
          if (s.structureType === STRUCTURE_WALL) {
            return true;
          }

          return false;
        }
      });

      if (structuresToClear.length > 0) {
        roomsNeedingClearing.push(integrationData.roomName);
      }
    }

    return roomsNeedingClearing;
  }
}
