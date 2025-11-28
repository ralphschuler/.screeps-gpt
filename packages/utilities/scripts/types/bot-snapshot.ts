/**
 * Shared type definitions for bot state snapshots
 */

/**
 * Shard metadata in a snapshot
 */
export interface ShardMetadata {
  name: string;
  rooms: string[];
}

export interface BotSnapshot {
  timestamp: string;
  tick?: number;
  /**
   * Shard metadata for multi-shard support
   */
  shards?: ShardMetadata[];
  /**
   * Total rooms across all shards
   */
  totalRooms?: number;
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
      /**
       * Shard where this room is located
       */
      shard?: string;
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
