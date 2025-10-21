import type { SystemReport } from "./src/shared/contracts";

declare global {
  interface Memory {
    systemReport?: {
      lastGenerated: number;
      report: SystemReport;
    };
    roles?: Record<string, number>;
  }

  interface CreepMemory {
    role: string;
    task?: string;
    version?: number;
  }
}

export {};
