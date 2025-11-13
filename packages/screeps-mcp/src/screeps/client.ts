/**
 * Screeps API client integration
 */

import type {
  ScreepsConfig,
  RoomData,
  CreepData,
  SpawnData,
  StatsData,
  MemoryResult,
  ConsoleResult
} from "../types.js";

/**
 * Screeps API client for MCP server integration
 */
export class ScreepsClient {
  private config: ScreepsConfig;
  private api: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  public constructor(config: ScreepsConfig) {
    this.config = {
      host: config.host ?? "screeps.com",
      port: config.port ?? 443,
      protocol: config.protocol ?? "https",
      shard: config.shard ?? "shard3",
      ...config
    };
  }

  /**
   * Initialize the Screeps API connection
   */
  public async connect(): Promise<void> {
    // Dynamic import to avoid issues with ESM
    const { ScreepsAPI } = await import("screeps-api");

    // Build server URL
    const serverUrl = `${this.config.protocol}://${this.config.host}:${this.config.port}`;

    this.api = await ScreepsAPI.fromConfig(serverUrl);

    if (this.config.token) {
      this.api.auth(this.config.token);
    } else if (this.config.email && this.config.password) {
      await this.api.auth(this.config.email, this.config.password);
    } else {
      throw new Error("Authentication credentials required (token or email/password)");
    }
  }

  /**
   * Get room information
   */
  public async getRooms(): Promise<RoomData[]> {
    if (!this.api) {
      throw new Error("API not initialized. Call connect() first.");
    }

    const shard = this.config.shard!;
    const response = await this.api.memory.get(`_shard_${shard}`, "rooms");

    if (!response || !response.data) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Object.entries(response.data).map(([name, data]: [string, any]) => ({
      name,
      controller: data.controller,
      energyAvailable: data.energyAvailable ?? 0,
      energyCapacityAvailable: data.energyCapacityAvailable ?? 0
    }));
  }

  /**
   * Get creep information
   */
  public async getCreeps(): Promise<CreepData[]> {
    if (!this.api) {
      throw new Error("API not initialized. Call connect() first.");
    }

    const shard = this.config.shard!;
    const response = await this.api.memory.get(`_shard_${shard}`, "creeps");

    if (!response || !response.data) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Object.entries(response.data).map(([name, data]: [string, any]) => ({
      name,
      role: data.role,
      room: data.room,
      hits: data.hits ?? 0,
      hitsMax: data.hitsMax ?? 0,
      ticksToLive: data.ticksToLive
    }));
  }

  /**
   * Get spawn information
   */
  public async getSpawns(): Promise<SpawnData[]> {
    if (!this.api) {
      throw new Error("API not initialized. Call connect() first.");
    }

    const shard = this.config.shard!;
    const response = await this.api.memory.get(`_shard_${shard}`, "spawns");

    if (!response || !response.data) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Object.entries(response.data).map(([name, data]: [string, any]) => ({
      name,
      room: data.room,
      spawning: data.spawning,
      energy: data.energy ?? 0,
      energyCapacity: data.energyCapacity ?? 0
    }));
  }

  /**
   * Get game statistics
   */
  public async getStats(): Promise<StatsData> {
    if (!this.api) {
      throw new Error("API not initialized. Call connect() first.");
    }

    const shard = this.config.shard!;
    const response = await this.api.memory.get(`_shard_${shard}`, "stats");

    const data = response?.data ?? {};

    return {
      cpu: {
        used: data.cpu?.used ?? 0,
        limit: data.cpu?.limit ?? 0,
        bucket: data.cpu?.bucket
      },
      gcl: data.gcl,
      rooms: data.rooms ?? 0,
      creeps: data.creeps ?? 0
    };
  }

  /**
   * Get memory value at path
   */
  public async getMemory(path: string): Promise<MemoryResult> {
    if (!this.api) {
      throw new Error("API not initialized. Call connect() first.");
    }

    try {
      const shard = this.config.shard!;
      const response = await this.api.memory.get(`_shard_${shard}`, path);

      return {
        success: true,
        path,
        value: response?.data
      };
    } catch (error) {
      return {
        success: false,
        path,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Set memory value at path (with safety checks)
   */
  public async setMemory(path: string, value: unknown): Promise<MemoryResult> {
    if (!this.api) {
      throw new Error("API not initialized. Call connect() first.");
    }

    // Safety check: prevent modifying critical system paths
    const criticalPaths = ["__proto__", "constructor", "prototype"];
    if (criticalPaths.some(p => path.includes(p))) {
      return {
        success: false,
        path,
        error: "Cannot modify critical system paths"
      };
    }

    try {
      const shard = this.config.shard!;
      await this.api.memory.set(`_shard_${shard}`, path, value);

      return {
        success: true,
        path,
        value
      };
    } catch (error) {
      return {
        success: false,
        path,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute console command
   */
  public async executeConsole(command: string): Promise<ConsoleResult> {
    if (!this.api) {
      throw new Error("API not initialized. Call connect() first.");
    }

    try {
      const shard = this.config.shard!;
      const response = await this.api.console(command, shard);

      return {
        success: true,
        output: response?.data ?? ""
      };
    } catch (error) {
      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
