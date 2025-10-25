import type { SystemReport } from "./src/shared/contracts";

declare global {
  interface Memory {
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
  }
}

export {};
