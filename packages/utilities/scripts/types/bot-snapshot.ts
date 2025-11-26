/**
 * Shared type definitions for bot state snapshots
 */

export interface BotSnapshot {
  timestamp: string;
  tick?: number;
  cpu?: {
    used: number;
    limit: number;
    bucket: number;
  };
  memory?: {
    used: number;
    usedPercent?: number;
  };
  structures?: {
    spawns?: number;
    extensions?: number;
    containers?: number;
    towers?: number;
    roads?: number;
  };
  constructionSites?: {
    count: number;
    byType?: Record<string, number>;
  };
  rooms?: Record<
    string,
    {
      rcl: number;
      energy: number;
      energyCapacity: number;
      controllerProgress?: number;
      controllerProgressTotal?: number;
      ticksToDowngrade?: number;
    }
  >;
  creeps?: {
    total: number;
    byRole?: Record<string, number>;
  };
  spawns?: {
    total: number;
    active: number;
  };
}
