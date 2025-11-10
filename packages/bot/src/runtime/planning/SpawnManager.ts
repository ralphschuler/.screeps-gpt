import { profile } from "@profiler";

/**
 * Body part configuration for a creep role
 */
export interface BodyPartConfig {
  /** Base body parts required for the role */
  base: BodyPartConstant[];
  /** Repeatable body parts to scale with available energy */
  pattern?: BodyPartConstant[];
  /** Maximum number of times to repeat the pattern */
  maxRepeats?: number;
}

/**
 * Spawn request in the spawn queue
 */
export interface SpawnRequest {
  /** Unique identifier for this spawn request */
  id: string;
  /** Role name for the creep */
  role: string;
  /** Priority level (higher = more important) */
  priority: number;
  /** Body parts configuration */
  bodyConfig: BodyPartConfig;
  /** Memory to assign to the spawned creep */
  memory: CreepMemory;
  /** Tick when request was created */
  createdAt: number;
  /** Optional deadline for spawning */
  deadline?: number;
}

export interface SpawnManagerConfig {
  /** Maximum number of spawn requests to queue */
  maxQueueSize?: number;
  /** Logger for debugging */
  logger?: Pick<Console, "log" | "warn">;
}

/**
 * Manages spawn queue and dynamic body part generation based on available energy.
 * Handles cold boot scenarios and ensures minimum role populations.
 */
@profile
export class SpawnManager {
  private queue: Map<string, SpawnRequest> = new Map();
  private nextRequestId = 0;
  private readonly maxQueueSize: number;
  private readonly logger: Pick<Console, "log" | "warn">;

  public constructor(config: SpawnManagerConfig = {}) {
    this.maxQueueSize = config.maxQueueSize ?? 50;
    this.logger = config.logger ?? console;
  }

  /**
   * Add a spawn request to the queue
   * @returns Request ID if added, null if queue is full
   */
  public addRequest(
    role: string,
    bodyConfig: BodyPartConfig,
    memory: CreepMemory,
    priority: number,
    deadline?: number
  ): string | null {
    if (this.queue.size >= this.maxQueueSize) {
      this.logger.warn?.(`Spawn queue full (${this.queue.size}/${this.maxQueueSize}), dropping request for ${role}`);
      return null;
    }

    const id = `spawn-${Game.time}-${this.nextRequestId++}`;
    const request: SpawnRequest = {
      id,
      role,
      priority,
      bodyConfig,
      memory,
      createdAt: Game.time,
      deadline
    };

    this.queue.set(id, request);
    return id;
  }

  /**
   * Process spawn queue and spawn creeps from available spawns
   * @param spawns Available spawns in the room
   * @param creepCounter Counter for generating unique creep names
   * @returns List of spawned creep names
   */
  public processQueue(spawns: StructureSpawn[], creepCounter: number): string[] {
    const spawned: string[] = [];

    // Find available spawns
    const availableSpawns = spawns.filter(spawn => !spawn.spawning);
    if (availableSpawns.length === 0) {
      return spawned;
    }

    // Sort requests by priority (highest first)
    const sortedRequests = Array.from(this.queue.values()).sort((a, b) => b.priority - a.priority);

    for (const spawn of availableSpawns) {
      // Find highest priority request that can be spawned
      for (const request of sortedRequests) {
        // Skip if already processed
        if (spawned.some(name => name.includes(request.role))) {
          continue;
        }

        // Check if expired
        if (request.deadline && Game.time > request.deadline) {
          this.queue.delete(request.id);
          continue;
        }

        // Generate body parts based on available energy
        const body = this.generateBody(request.bodyConfig, spawn.room);
        if (body.length === 0) {
          // Not enough energy yet
          continue;
        }

        // Calculate cost
        const cost = this.calculateBodyCost(body);
        if (spawn.room.energyAvailable < cost) {
          continue;
        }

        // Spawn the creep
        const name = `${request.role}-${Game.time}-${creepCounter++}`;
        const result = spawn.spawnCreep(body, name, { memory: request.memory });

        if (result === OK) {
          spawned.push(name);
          this.queue.delete(request.id);
          this.logger.log?.(`[SpawnManager] Spawned ${name} with ${body.length} parts (${cost} energy)`);
          break; // Move to next spawn
        } else {
          this.logger.warn?.(`[SpawnManager] Failed to spawn ${request.role}: ${result}`);
        }
      }

      // If we spawned something, increment counter
    }

    return spawned;
  }

  /**
   * Generate body parts dynamically based on available energy
   */
  public generateBody(config: BodyPartConfig, room: Room): BodyPartConstant[] {
    const { base, pattern, maxRepeats = 10 } = config;

    // Start with base parts
    const body: BodyPartConstant[] = [...base];
    const baseCost = this.calculateBodyCost(base);

    // If no pattern or not enough energy for base, return base or empty
    if (!pattern || pattern.length === 0) {
      return room.energyAvailable >= baseCost ? body : [];
    }

    // Calculate available energy for patterns
    const patternCost = this.calculateBodyCost(pattern);
    const availableEnergy = room.energyAvailable - baseCost;

    // Add pattern repeats up to maxRepeats or energy limit
    const affordableRepeats = Math.floor(availableEnergy / patternCost);
    const repeats = Math.min(affordableRepeats, maxRepeats);

    for (let i = 0; i < repeats; i++) {
      body.push(...pattern);
    }

    // Validate body part limits
    if (body.length > MAX_CREEP_SIZE) {
      // Trim to max size
      return body.slice(0, MAX_CREEP_SIZE);
    }

    // Check if we can afford the base parts at minimum
    if (room.energyAvailable < baseCost) {
      return [];
    }

    return body;
  }

  /**
   * Calculate the energy cost of a body configuration
   */
  public calculateBodyCost(body: BodyPartConstant[]): number {
    const costs: Record<BodyPartConstant, number> = {
      [MOVE]: 50,
      [WORK]: 100,
      [CARRY]: 50,
      [ATTACK]: 80,
      [RANGED_ATTACK]: 150,
      [HEAL]: 250,
      [CLAIM]: 600,
      [TOUGH]: 10
    };

    return body.reduce((total, part) => total + (costs[part] ?? 0), 0);
  }

  /**
   * Get current queue statistics
   */
  public getQueueStats(): { size: number; byPriority: Record<number, number> } {
    const byPriority: Record<number, number> = {};

    for (const request of this.queue.values()) {
      byPriority[request.priority] = (byPriority[request.priority] ?? 0) + 1;
    }

    return {
      size: this.queue.size,
      byPriority
    };
  }

  /**
   * Clear expired requests from the queue
   */
  public clearExpired(): void {
    for (const [id, request] of this.queue) {
      if (request.deadline && Game.time > request.deadline) {
        this.queue.delete(id);
      }
    }
  }

  /**
   * Check if a role has a pending spawn request
   */
  public hasPendingRequest(role: string): boolean {
    return Array.from(this.queue.values()).some(req => req.role === role);
  }

  /**
   * Clear all spawn requests from the queue
   */
  public clear(): void {
    this.queue.clear();
  }
}
