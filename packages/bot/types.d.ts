import type { SystemReport } from "./src/shared/contracts";
import type { ColonyManagerMemory } from "./src/runtime/planning/ColonyManager";
import type { ProfilerMemory } from "@ralphschuler/screeps-profiler";
import type { CommunicationVerbosity } from "./src/runtime/behavior/CreepCommunicationManager";
import type { InfrastructureMemory } from "./src/runtime/infrastructure/InfrastructureManager";
import type { ThreatMemory } from "./src/runtime/defense/ThreatDetector";
import type { DefenseMemory } from "./src/runtime/defense/DefenseCoordinator";
import type { CombatManagerMemory } from "./src/runtime/defense/CombatManager";
import type { SerializedMachine } from "@ralphschuler/screeps-xstate";

declare global {
  /**
   * Build-time constants injected by esbuild define
   * These are replaced at compile time with literal values from environment variables
   */
  const __PROFILER_ENABLED__: "true" | "false";
  const __ROOM_VISUALS_ENABLED__: string;
  const __PLAYER_USERNAME__: string;

  /**
   * Global EventBus instance for inter-component communication.
   * Available in console and for debugging.
   * @see src/main.ts
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  var EventBus: import("@ralphschuler/screeps-events").EventBus;

  interface Memory {
    /**
     * Memory schema version for migration tracking.
     * Used by MemoryMigrationManager to safely upgrade memory structure across version updates.
     * @see src/runtime/memory/MemoryMigrationManager.ts
     */
    version?: number;
    systemReport?: {
      lastGenerated: number;
      report: SystemReport;
    };
    roles?: Record<string, number>;
    respawn?: {
      needsRespawn: boolean;
      lastSpawnLostTick?: number;
      respawnRequested: boolean;
    };
    /**
     * Empire-wide coordination memory for multi-room management.
     * @see src/runtime/empire/EmpireManager.ts
     */
    empire?: {
      lastUpdate: number;
      cpuBudgets: Record<string, number>;
      threats: Array<{
        room: string;
        hostileCount: number;
        severity: number;
      }>;
      transferHistory: Array<{
        tick: number;
        from: string;
        to: string;
        resource: ResourceConstant;
        amount: number;
      }>;
      scoutReports?: Record<string, unknown>;
    };
    /**
     * Scout memory for room reconnaissance.
     * @see src/runtime/scouting/ScoutManager.ts
     */
    scout?: {
      rooms: Record<string, unknown>;
      lastUpdate: number;
      activeScouts: Record<string, string>;
    };
    /**
     * Bootstrap phase tracking for first-room resource optimization.
     * Tracks whether the room is in bootstrap mode and when it was initiated.
     * @see src/runtime/bootstrap/BootstrapPhaseManager.ts
     */
    bootstrap?: {
      isActive: boolean;
      startedAt?: number;
      completedAt?: number;
    };
    creepCounter?: number;
    experimentalFeatures?: {
      roomVisuals?: boolean;
    };
    creepCommunication?: {
      verbosity?: CommunicationVerbosity;
      enableRoomVisuals?: boolean;
    };
    /**
     * Configuration for dying creep energy dropping behavior.
     * Controls when creeps should drop energy before expiring.
     * @see src/runtime/behavior/creepHelpers.ts
     */
    dyingCreepBehavior?: {
      enabled?: boolean; // Default: true
      ttlThreshold?: number; // Default: 50 ticks
    };
    colony?: ColonyManagerMemory;
    /**
     * Takeover planning memory for occupied room conquest.
     * Tracks identified enemy rooms and takeover strategies.
     * @see src/runtime/empire/EmpireManager.ts
     */
    takeover?: {
      targets: Array<{
        roomName: string;
        owner?: string;
        controllerLevel?: number;
        sourceCount: number;
        threatLevel: string;
        hostileStructures?: {
          towers: number;
          ramparts: number;
          walls: number;
          spawns: number;
        };
        hostileCreeps?: {
          defenders: number;
          healers: number;
          totalBodyParts: {
            attack: number;
            rangedAttack: number;
            heal: number;
            tough: number;
            work: number;
          };
        };
        discoveredAt: number;
        status: "identified" | "analyzing" | "planning" | "executing" | "conquered" | "abandoned";
        priority: number;
        strategy?: string;
      }>;
      lastUpdate: number;
    };
    /**
     * Profiler performance data collection.
     * Populated when profiler is enabled and started.
     * @see src/profiler/Profiler.ts
     */
    profiler?: ProfilerMemory;
    /**
     * Spawn health tracking for stuck spawn detection.
     * Maps spawn ID to stuck state information.
     * @see src/runtime/behavior/BehaviorController.ts
     */
    spawnHealth?: Record<
      string,
      {
        detectedAt: number;
        creepName: string;
        remainingTime: number;
      }
    >;
    /**
     * Infrastructure management memory for road planning and traffic analysis.
     * Tracks road planning intervals and traffic data for path optimization.
     * @see src/runtime/infrastructure/InfrastructureManager.ts
     */
    infrastructure?: InfrastructureMemory;
    /**
     * Room-level progression phases tracking for RCL-based infrastructure activation.
     * Tracks which phase each room is in based on controller level.
     * @see src/runtime/bootstrap/BootstrapPhaseManager.ts
     */
    rooms?: Record<
      string,
      {
        phase?: "phase1" | "phase2" | "phase3" | "phase4" | "phase5";
        rclLevelDetected?: number;
        phaseActivatedAt?: number;
        storageBuilt?: boolean;
        linkNetworkActive?: boolean;
        /**
         * Energy economy metrics for sustainable spawning.
         * Tracks production, consumption, and sustainability ratio.
         * @see src/runtime/energy/EnergyValidation.ts
         */
        energyMetrics?: {
          productionRate: number;
          consumptionRate: number;
          storageCapacity: number;
          currentReserves: number;
          sustainabilityRatio: number;
          lastUpdate: number;
          sourceCount: number;
          maxSpawnBudget: number;
        };
      }
    >;
    stats?: {
      time: number;
      lastTimeoutTick?: number;
      cpu: {
        used: number;
        limit: number;
        bucket: number;
      };
      creeps: {
        count: number;
      };
      rooms: {
        count: number;
        [roomName: string]:
          | number
          | {
              energyAvailable: number;
              energyCapacityAvailable: number;
              controllerLevel?: number;
              controllerProgress?: number;
              controllerProgressTotal?: number;
            };
      };
      spawn?: {
        orders: number;
      };
    };
    /**
     * Threat detection and defense coordination memory.
     * Tracks hostile creeps and defensive posture per room.
     * @see src/runtime/defense/ThreatDetector.ts
     * @see src/runtime/defense/DefenseCoordinator.ts
     * @see src/runtime/defense/CombatManager.ts
     */
    threats?: ThreatMemory;
    defense?: DefenseMemory;
    combat?: CombatManagerMemory;
    /**
     * Tower energy state tracking for event emission.
     * Tracks which towers have emitted energy depletion events.
     * @see src/runtime/defense/TowerManager.ts
     */
    towerState?: Record<string, { depleted: boolean }>;
    /**
     * Phased initialization state tracking.
     * Used by InitializationManager to spread init workload across multiple ticks
     * after deployment or server restart to prevent CPU bucket drain.
     * @see src/runtime/bootstrap/InitializationManager.ts
     */
    init?: {
      /** Current initialization phase index */
      phase: number;
      /** Tick when initialization began */
      startTick: number;
      /** Whether initialization is complete */
      complete: boolean;
      /** Phase names that have completed */
      completedPhases?: string[];
    };
  }

  interface CreepMemory {
    role: string;
    task?: string;
    version?: number;
    homeRoom?: string;
    targetRoom?: string;
    sourceId?: Id<Source>;
    stateMachine?: SerializedMachine;
    containerId?: Id<StructureContainer>;
    squadId?: string;
  }
}

export {};
