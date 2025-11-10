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
  rooms?: Record<
    string,
    {
      rcl: number;
      energy: number;
      energyCapacity: number;
      controllerProgress?: number;
      controllerProgressTotal?: number;
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
