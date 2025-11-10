import type { SystemReport } from "./src/shared/contracts";
import type { ColonyManagerMemory } from "./src/runtime/planning/ColonyManager";
import type { ProfilerMemory } from "./src/shared/profiler-types";
import type { CommunicationVerbosity } from "./src/runtime/behavior/CreepCommunicationManager";

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
