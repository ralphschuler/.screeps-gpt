import type { SystemReport } from "./src/shared/contracts";

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
    creepCounter?: number;
    experimentalFeatures?: {
      taskSystem?: boolean;
    };
    stats?: {
      time: number;
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
