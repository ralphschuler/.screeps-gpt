import { profile } from "@profiler";

/**
 * Movement request with priority
 */
export interface MovementRequest {
  creepName: string;
  destination: RoomPosition;
  priority: number;
  requestedAt: number;
}

/**
 * Serializable movement request for Memory (RoomPosition replaced with coordinates)
 */
export interface SerializedMovementRequest {
  creepName: string;
  destination: { x: number; y: number; roomName: string };
  priority: number;
  requestedAt: number;
}

/**
 * Traffic data for a position (for analysis)
 */
export interface TrafficData {
  count: number;
  lastUpdated: number;
}

/**
 * Serialized traffic manager state for Memory persistence
 */
export interface TrafficManagerMemory {
  movementRequests: Record<string, SerializedMovementRequest>;
  trafficData?: Record<string, TrafficData>;
}

/**
 * Traffic manager configuration
 */
export interface TrafficManagerConfig {
  /** Logger for debugging */
  logger?: Pick<Console, "log" | "warn">;
  /** Optional Memory reference for persistence */
  memory?: TrafficManagerMemory;
  /** Enable traffic analysis (default: true) */
  enableTrafficAnalysis?: boolean;
  /** Traffic data decay rate per tick (default: 0.98) */
  trafficDecayRate?: number;
  /** Minimum traffic count before cleanup (default: 1) */
  trafficCleanupThreshold?: number;
  /** Maximum traffic positions per room (default: 500) */
  maxPositionsPerRoom?: number;
  /** Maximum total traffic positions across all rooms (default: 2000) */
  maxTotalPositions?: number;
  /** Threshold to trigger aggressive decay (default: 0.8, meaning 80% of maxTotalPositions) */
  aggressiveDecayThreshold?: number;
  /** Multiplier for decay rate under memory pressure (default: 0.9, makes decay 10% faster) */
  aggressiveDecayMultiplier?: number;
  /** Threshold for warning logs (default: 0.9, meaning 90% of maxTotalPositions) */
  warningThreshold?: number;
}

/**
 * Manages creep movement with collision avoidance and priority-based pathing.
 * Coordinates high-priority creeps through congested areas.
 *
 * State persistence: Movement requests can be persisted to Memory
 * by providing a memory reference in the config and calling saveToMemory().
 * Note: Position reservations are transient and not persisted.
 */
@profile
export class TrafficManager {
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly movementRequests: Map<string, MovementRequest> = new Map();
  private readonly positionReservations: Map<string, string> = new Map(); // pos key -> creep name
  private readonly memoryRef?: TrafficManagerMemory;
  private readonly trafficData: Map<string, TrafficData> = new Map(); // pos key -> traffic count
  private readonly enableTrafficAnalysis: boolean;
  private readonly trafficDecayRate: number;
  private readonly trafficCleanupThreshold: number;
  private readonly maxPositionsPerRoom: number;
  private readonly maxTotalPositions: number;
  private readonly aggressiveDecayThreshold: number;
  private readonly aggressiveDecayMultiplier: number;
  private readonly warningThreshold: number;

  /**
   * Estimated bytes per traffic position entry (key + TrafficData object)
   * Based on typical JSON serialization: "roomName:x:y" (15-20 chars) + count/lastUpdated (20-30 chars)
   */
  private static readonly BYTES_PER_POSITION_ESTIMATE = 50;

  public constructor(config: TrafficManagerConfig = {}) {
    this.logger = config.logger ?? console;
    this.memoryRef = config.memory;
    this.enableTrafficAnalysis = config.enableTrafficAnalysis ?? true;
    this.trafficDecayRate = config.trafficDecayRate ?? 0.98;
    this.trafficCleanupThreshold = config.trafficCleanupThreshold ?? 1;
    this.maxPositionsPerRoom = config.maxPositionsPerRoom ?? 500;
    this.maxTotalPositions = config.maxTotalPositions ?? 2000;
    this.aggressiveDecayThreshold = config.aggressiveDecayThreshold ?? 0.8;
    this.aggressiveDecayMultiplier = config.aggressiveDecayMultiplier ?? 0.9;
    this.warningThreshold = config.warningThreshold ?? 0.9;

    // Load state from Memory if provided
    if (this.memoryRef) {
      this.loadFromMemory();
    }
  }

  /**
   * Load state from Memory
   */
  private loadFromMemory(): void {
    if (!this.memoryRef) return;

    // Load movement requests and reconstruct RoomPosition objects
    if (this.memoryRef.movementRequests) {
      for (const [creepName, serializedRequest] of Object.entries(this.memoryRef.movementRequests)) {
        const request: MovementRequest = {
          ...serializedRequest,
          destination: new RoomPosition(
            serializedRequest.destination.x,
            serializedRequest.destination.y,
            serializedRequest.destination.roomName
          )
        };
        this.movementRequests.set(creepName, request);
      }
    }

    // Load traffic data if available
    if (this.memoryRef.trafficData) {
      for (const [posKey, data] of Object.entries(this.memoryRef.trafficData)) {
        this.trafficData.set(posKey, data);
      }
    }
  }

  /**
   * Save state to Memory (call periodically to persist state)
   */
  public saveToMemory(): void {
    if (!this.memoryRef) return;

    // Save movement requests with serialized destinations
    this.memoryRef.movementRequests = {};
    for (const [creepName, request] of this.movementRequests.entries()) {
      this.memoryRef.movementRequests[creepName] = {
        ...request,
        destination: {
          x: request.destination.x,
          y: request.destination.y,
          roomName: request.destination.roomName
        }
      };
    }

    // Save traffic data
    if (this.enableTrafficAnalysis) {
      this.memoryRef.trafficData = {};
      for (const [posKey, data] of this.trafficData.entries()) {
        this.memoryRef.trafficData[posKey] = data;
      }
    }
  }

  /**
   * Register a movement request
   */
  public requestMovement(creepName: string, destination: RoomPosition, priority: number = 50): void {
    this.movementRequests.set(creepName, {
      creepName,
      destination,
      priority,
      requestedAt: Game.time
    });
  }

  /**
   * Execute traffic management logic
   */
  public run(): { moves: number; collisionsAvoided: number } {
    // Clear old reservations
    this.positionReservations.clear();

    let moves = 0;
    let collisionsAvoided = 0;

    // Sort requests by priority (highest first)
    const requests = Array.from(this.movementRequests.values()).sort((a, b) => b.priority - a.priority);

    for (const request of requests) {
      const creep = Game.creeps[request.creepName];
      if (!creep) {
        this.movementRequests.delete(request.creepName);
        continue;
      }

      // Check if creep reached destination
      if (creep.pos.isEqualTo(request.destination)) {
        this.movementRequests.delete(request.creepName);
        continue;
      }

      // Move with collision avoidance
      const result = this.moveWithPriority(creep, request.destination, request.priority);
      if (result.moved) {
        moves++;
      }
      if (result.collisionAvoided) {
        collisionsAvoided++;
      }
    }

    // Periodically clean up old requests
    if (Game.time % 100 === 0) {
      this.clearOldRequests();
    }

    return { moves, collisionsAvoided };
  }

  /**
   * Move a creep with priority-based collision avoidance
   * TODO: Implement path caching to avoid recomputing paths every tick
   */
  private moveWithPriority(
    creep: Creep,
    destination: RoomPosition,
    priority: number
  ): { moved: boolean; collisionAvoided: boolean } {
    // Get next position in path
    const path = creep.pos.findPathTo(destination, {
      ignoreCreeps: true,
      maxRooms: 1
    });

    if (path.length === 0) {
      return { moved: false, collisionAvoided: false };
    }

    const nextPos = creep.room.getPositionAt(path[0].x, path[0].y);

    if (!nextPos) {
      return { moved: false, collisionAvoided: false };
    }

    // Check if position is reserved by higher priority creep
    const posKey = this.getPositionKey(nextPos);
    const reservedBy = this.positionReservations.get(posKey);

    if (reservedBy && reservedBy !== creep.name) {
      const otherRequest = this.movementRequests.get(reservedBy);
      if (otherRequest && otherRequest.priority > priority) {
        // Wait for higher priority creep
        return { moved: false, collisionAvoided: true };
      }
    }

    // Check if there's a creep at next position
    const creepsAtPos = nextPos.lookFor(LOOK_CREEPS);
    if (creepsAtPos.length > 0) {
      const blockingCreep = creepsAtPos[0];

      // Check if blocking creep has lower priority
      const blockingRequest = this.movementRequests.get(blockingCreep.name);
      if (blockingRequest && blockingRequest.priority < priority) {
        // Ask blocking creep to move
        const swapResult = this.requestSwap(creep, blockingCreep);
        if (swapResult) {
          return { moved: true, collisionAvoided: true };
        }
      }

      // Wait if blocking creep has higher priority
      return { moved: false, collisionAvoided: true };
    }

    // Reserve position and move
    this.positionReservations.set(posKey, creep.name);
    const result = creep.move(path[0].direction);

    // Record traffic if movement was successful
    if (result === OK || result === ERR_TIRED) {
      this.recordMovement(nextPos);
    }

    return {
      moved: result === OK || result === ERR_TIRED,
      collisionAvoided: false
    };
  }

  /**
   * Request a swap between two creeps
   */
  private requestSwap(movingCreep: Creep, blockingCreep: Creep): boolean {
    // Simple swap: blocking creep moves toward moving creep's position
    const direction = blockingCreep.pos.getDirectionTo(movingCreep.pos);
    const result = blockingCreep.move(direction);

    if (result === OK || result === ERR_TIRED) {
      // Moving creep can now move forward
      return true;
    }

    return false;
  }

  /**
   * Get a unique key for a position
   */
  private getPositionKey(pos: RoomPosition): string {
    return `${pos.roomName}:${pos.x}:${pos.y}`;
  }

  /**
   * Clear movement request for a creep
   */
  public clearRequest(creepName: string): void {
    this.movementRequests.delete(creepName);
  }

  /**
   * Get current request for a creep
   */
  public getRequest(creepName: string): MovementRequest | undefined {
    return this.movementRequests.get(creepName);
  }

  /**
   * Clear old requests (older than 100 ticks)
   */
  public clearOldRequests(): void {
    for (const [creepName, request] of this.movementRequests.entries()) {
      if (Game.time - request.requestedAt > 100) {
        this.movementRequests.delete(creepName);
      }
    }
  }

  /**
   * Record movement at a position for traffic analysis
   */
  public recordMovement(pos: RoomPosition): void {
    if (!this.enableTrafficAnalysis) {
      return;
    }

    const posKey = this.getPositionKey(pos);
    const existing = this.trafficData.get(posKey);

    if (existing) {
      this.trafficData.set(posKey, {
        count: existing.count + 1,
        lastUpdated: Game.time
      });
    } else {
      this.trafficData.set(posKey, {
        count: 1,
        lastUpdated: Game.time
      });
    }
  }

  /**
   * Apply decay to traffic data (call periodically to fade old traffic patterns)
   * Also enforces size limits to prevent unbounded memory growth
   */
  public applyTrafficDecay(): void {
    if (!this.enableTrafficAnalysis) {
      return;
    }

    // Check if we're approaching memory pressure
    const totalPositions = this.trafficData.size;
    const isUnderMemoryPressure = totalPositions >= this.maxTotalPositions * this.aggressiveDecayThreshold;

    // Apply decay (more aggressive under memory pressure)
    const effectiveDecayRate = isUnderMemoryPressure
      ? this.trafficDecayRate * this.aggressiveDecayMultiplier
      : this.trafficDecayRate;

    for (const [posKey, data] of this.trafficData.entries()) {
      const decayedCount = data.count * effectiveDecayRate;

      if (decayedCount < this.trafficCleanupThreshold) {
        this.trafficData.delete(posKey);
      } else {
        this.trafficData.set(posKey, {
          count: decayedCount,
          lastUpdated: data.lastUpdated
        });
      }
    }

    // Enforce hard size limit by removing lowest-traffic positions
    if (this.trafficData.size > this.maxTotalPositions) {
      this.pruneStaleTrafficData(this.trafficData.size - this.maxTotalPositions);
    }

    // Enforce per-room limits
    this.enforcePerRoomLimits();

    // Log warnings if size is still excessive
    if (this.trafficData.size > this.maxTotalPositions * this.warningThreshold) {
      this.logger.warn?.(
        `[TrafficManager] Traffic data at ${this.trafficData.size}/${this.maxTotalPositions} positions (${((this.trafficData.size / this.maxTotalPositions) * 100).toFixed(1)}%)`
      );
    }
  }

  /**
   * Prune stale traffic data by removing positions with lowest traffic counts
   * @param count Number of positions to remove
   */
  private pruneStaleTrafficData(count: number): void {
    if (count <= 0) return;

    // Sort positions by traffic count (ascending) to remove least-used first
    const sorted = Array.from(this.trafficData.entries()).sort((a, b) => a[1].count - b[1].count);

    // Remove the lowest traffic positions
    const toRemove = sorted.slice(0, Math.min(count, sorted.length));
    for (const [posKey] of toRemove) {
      this.trafficData.delete(posKey);
    }

    if (toRemove.length > 0) {
      this.logger.warn?.(`[TrafficManager] Pruned ${toRemove.length} low-traffic positions to enforce size limit`);
    }
  }

  /**
   * Enforce per-room position limits
   */
  private enforcePerRoomLimits(): void {
    // Group positions by room
    const roomPositions = new Map<string, Array<[string, TrafficData]>>();

    for (const [posKey, data] of this.trafficData.entries()) {
      const roomName = posKey.split(":")[0];
      if (!roomPositions.has(roomName)) {
        roomPositions.set(roomName, []);
      }
      roomPositions.get(roomName)?.push([posKey, data]);
    }

    // Check each room and prune if over limit
    for (const [roomName, positions] of roomPositions.entries()) {
      if (positions.length > this.maxPositionsPerRoom) {
        // Sort by traffic count and remove lowest
        positions.sort((a, b) => a[1].count - b[1].count);
        const toRemove = positions.slice(0, positions.length - this.maxPositionsPerRoom);

        for (const [posKey] of toRemove) {
          this.trafficData.delete(posKey);
        }

        this.logger.warn?.(
          `[TrafficManager] Pruned ${toRemove.length} positions in room ${roomName} (exceeded ${this.maxPositionsPerRoom} limit)`
        );
      }
    }
  }

  /**
   * Get high-traffic positions above a threshold
   * @param threshold Minimum traffic count to be considered high-traffic
   * @returns Array of positions with their traffic counts
   */
  public getHighTrafficPositions(threshold: number): Array<{ pos: RoomPosition; count: number }> {
    if (!this.enableTrafficAnalysis) {
      return [];
    }

    const result: Array<{ pos: RoomPosition; count: number }> = [];

    for (const [posKey, data] of this.trafficData.entries()) {
      if (data.count >= threshold) {
        // Parse key format: "roomName:x:y"
        const parts = posKey.split(":");
        const roomName = parts[0];
        const x = Number(parts[1]);
        const y = Number(parts[2]);
        result.push({
          pos: new RoomPosition(x, y, roomName),
          count: data.count
        });
      }
    }

    // Sort by traffic count descending
    return result.sort((a, b) => b.count - a.count);
  }

  /**
   * Get traffic data for a specific position
   */
  public getTrafficAt(pos: RoomPosition): number {
    if (!this.enableTrafficAnalysis) {
      return 0;
    }

    const posKey = this.getPositionKey(pos);
    return this.trafficData.get(posKey)?.count ?? 0;
  }

  /**
   * Get total number of tracked positions
   */
  public getTrackedPositionCount(): number {
    return this.trafficData.size;
  }

  /**
   * Get memory usage statistics for monitoring
   * @returns Statistics about traffic data memory usage
   */
  public getMemoryUsageStats(): {
    positionCount: number;
    estimatedBytes: number;
    maxTotalPositions: number;
    maxPositionsPerRoom: number;
    utilizationPercent: number;
  } {
    const positionCount = this.trafficData.size;
    const estimatedBytes = positionCount * TrafficManager.BYTES_PER_POSITION_ESTIMATE;
    const utilizationPercent = (positionCount / this.maxTotalPositions) * 100;

    return {
      positionCount,
      estimatedBytes,
      maxTotalPositions: this.maxTotalPositions,
      maxPositionsPerRoom: this.maxPositionsPerRoom,
      utilizationPercent
    };
  }
}
