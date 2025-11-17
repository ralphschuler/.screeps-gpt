import type { SystemReport } from "./packages/bot/src/shared/contracts";
import type { ColonyManagerMemory } from "./packages/bot/src/runtime/planning/ColonyManager";
import type { ProfilerMemory } from "./packages/bot/src/shared/profiler-types";
import type { CommunicationVerbosity } from "./packages/bot/src/runtime/behavior/CreepCommunicationManager";
import type { InfrastructureMemory } from "./packages/bot/src/runtime/infrastructure/InfrastructureManager";

declare global {
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
      taskSystem?: boolean;
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
  }

  interface CreepMemory {
    role: string;
    task?: string;
    version?: number;
    homeRoom?: string;
    targetRoom?: string;
    sourceId?: Id<Source>;
    taskId?: string;
  }
}

export {};
