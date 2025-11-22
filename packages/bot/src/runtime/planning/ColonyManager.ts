import { profile } from "@ralphschuler/screeps-profiler";

/**
 * Colony expansion request
 */
export interface ExpansionRequest {
  targetRoom: string;
  priority: number;
  reason: string;
  requestedAt: number;
  status: "pending" | "claimed" | "failed";
}

/**
 * Inter-shard communication message
 */
export interface InterShardMessage {
  from: string;
  to: string;
  type: "resource_request" | "expansion_notice" | "status_update";
  payload: unknown;
  timestamp: number;
}

/**
 * Colony manager memory structure
 */
export interface ColonyManagerMemory {
  expansionQueue: ExpansionRequest[];
  claimedRooms: string[];
  shardMessages: InterShardMessage[];
  lastExpansionCheck: number;
}

/**
 * Colony manager configuration
 */
export interface ColonyManagerConfig {
  /** Minimum RCL before allowing expansion */
  minRclForExpansion?: number;
  /** Maximum number of rooms per shard */
  maxRoomsPerShard?: number;
  /** Logger for debugging */
  logger?: Pick<Console, "log" | "warn">;
  /** Optional Memory reference for persistence */
  memory?: ColonyManagerMemory;
}

/**
 * Manages multi-room expansion and inter-shard communication.
 * Coordinates global room/shard scheduling and resource distribution.
 *
 * State persistence: Colony state can be persisted to Memory
 * by providing a memory reference in the config and calling saveToMemory().
 *
 * @example
 * ```ts
 * const colony = new ColonyManager({ memory: Memory.colony });
 * colony.run(Game.rooms);
 * colony.requestExpansion("W2N2", "nearby energy source");
 * colony.saveToMemory();
 * ```
 */
@profile
export class ColonyManager {
  private readonly minRclForExpansion: number;
  private readonly maxRoomsPerShard: number;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly expansionQueue: ExpansionRequest[] = [];
  private readonly claimedRooms: Set<string> = new Set();
  private readonly shardMessages: InterShardMessage[] = [];
  private memoryRef?: ColonyManagerMemory;
  private lastExpansionCheck: number = 0;

  public constructor(config: ColonyManagerConfig = {}) {
    this.minRclForExpansion = config.minRclForExpansion ?? 4;
    this.maxRoomsPerShard = config.maxRoomsPerShard ?? 10;
    this.logger = config.logger ?? console;
    this.memoryRef = config.memory;

    if (this.memoryRef) {
      this.loadFromMemory();
    }
  }

  /**
   * Load state from Memory
   */
  private loadFromMemory(): void {
    if (!this.memoryRef) return;

    if (this.memoryRef.expansionQueue) {
      this.expansionQueue.push(...this.memoryRef.expansionQueue);
    }
    if (this.memoryRef.claimedRooms) {
      this.memoryRef.claimedRooms.forEach(room => this.claimedRooms.add(room));
    }
    if (this.memoryRef.shardMessages) {
      this.shardMessages.push(...this.memoryRef.shardMessages);
    }
    this.lastExpansionCheck = this.memoryRef.lastExpansionCheck;
  }

  /**
   * Set memory reference at runtime (allows late binding after Memory initialization)
   */
  public setMemoryReference(memory: ColonyManagerMemory): void {
    this.memoryRef = memory;
    this.loadFromMemory();
  }

  /**
   * Save state to Memory
   */
  public saveToMemory(): void {
    if (!this.memoryRef) return;

    this.memoryRef.expansionQueue = this.expansionQueue;
    this.memoryRef.claimedRooms = Array.from(this.claimedRooms);
    this.memoryRef.shardMessages = this.shardMessages;
    this.memoryRef.lastExpansionCheck = this.lastExpansionCheck;
  }

  /**
   * Main run loop - processes expansion queue and manages multi-room operations
   */
  public run(rooms: Record<string, Room>, currentTick: number): void {
    // Update claimed rooms list
    this.updateClaimedRooms(rooms);

    // Check expansion opportunities every 100 ticks
    if (currentTick - this.lastExpansionCheck >= 100) {
      this.evaluateExpansionOpportunities(rooms, currentTick);
      this.lastExpansionCheck = currentTick;
    }

    // Process expansion queue
    this.processExpansionQueue(rooms);

    // Process inter-shard messages
    this.processShardMessages(currentTick);
  }

  /**
   * Update the list of claimed rooms from Game.rooms
   */
  private updateClaimedRooms(rooms: Record<string, Room>): void {
    this.claimedRooms.clear();
    for (const roomName in rooms) {
      const room = rooms[roomName];
      if (room.controller?.my) {
        this.claimedRooms.add(roomName);
      }
    }
  }

  /**
   * Evaluate and queue expansion opportunities
   */
  private evaluateExpansionOpportunities(rooms: Record<string, Room>, _currentTick: number): void {
    // Check if we're at max rooms
    if (this.claimedRooms.size >= this.maxRoomsPerShard) {
      return;
    }

    // Find rooms ready for expansion
    const readyRooms = Object.values(rooms).filter(
      room => room.controller?.my && room.controller.level >= this.minRclForExpansion
    );

    if (readyRooms.length === 0) {
      return;
    }

    // Look for adjacent rooms (simplified - in real implementation would use scouting data)
    this.logger.log(`[ColonyManager] Evaluating expansion opportunities from ${readyRooms.length} ready rooms`);
  }

  /**
   * Request expansion to a target room
   */
  public requestExpansion(targetRoom: string, reason: string, currentTick?: number, priority: number = 50): void {
    // Check if already claimed
    if (this.claimedRooms.has(targetRoom)) {
      this.logger.warn(`[ColonyManager] Cannot expand to ${targetRoom}: already claimed`);
      return;
    }

    // Check if already queued
    if (this.expansionQueue.some(req => req.targetRoom === targetRoom)) {
      this.logger.warn(`[ColonyManager] Expansion to ${targetRoom} already queued`);
      return;
    }

    // Add to queue
    const request: ExpansionRequest = {
      targetRoom,
      priority,
      reason,
      requestedAt: currentTick ?? (typeof Game !== "undefined" ? Game.time : 0),
      status: "pending"
    };

    // Insert request into expansionQueue in sorted order (descending priority)
    let left = 0;
    let right = this.expansionQueue.length;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.expansionQueue[mid].priority > request.priority) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    this.expansionQueue.splice(left, 0, request);

    this.logger.log(`[ColonyManager] Queued expansion to ${targetRoom}: ${reason} (priority: ${priority})`);
  }

  /**
   * Process expansion queue
   */
  private processExpansionQueue(rooms: Record<string, Room>): void {
    if (this.expansionQueue.length === 0) return;

    // Get highest priority pending request
    const request = this.expansionQueue.find(req => req.status === "pending");
    if (!request) return;

    // Check if room is visible (would need claimer creep in real implementation)
    const targetRoom = rooms[request.targetRoom];
    if (targetRoom?.controller && !targetRoom.controller.my) {
      if (targetRoom.controller.reservation?.username === "Invader") {
        this.logger.log(`[ColonyManager] Cannot claim ${request.targetRoom}: reserved by Invaders`);
        request.status = "failed";
      }
    }
  }

  /**
   * Send inter-shard message
   */
  public sendShardMessage(to: string, type: InterShardMessage["type"], payload: unknown, currentTick?: number): void {
    const message: InterShardMessage = {
      from: (typeof Game !== "undefined" && Game.shard?.name) || "shard0",
      to,
      type,
      payload,
      timestamp: currentTick ?? (typeof Game !== "undefined" ? Game.time : 0)
    };

    this.shardMessages.push(message);

    // Use InterShardMemory if available
    if (typeof InterShardMemory !== "undefined") {
      const data = InterShardMemory.getLocal() || "";
      const messages: InterShardMessage[] = data ? (JSON.parse(data) as InterShardMessage[]) : [];
      messages.push(message);
      InterShardMemory.setLocal(JSON.stringify(messages));
    }

    this.logger.log(`[ColonyManager] Sent shard message to ${to}: ${type}`);
  }

  /**
   * Process inter-shard messages
   */
  private processShardMessages(currentTick: number): void {
    // Clean up old messages (>1000 ticks old)
    const cutoff = currentTick - 1000;
    const beforeCount = this.shardMessages.length;

    // Filter out messages older than cutoff
    const filteredMessages = this.shardMessages.filter(msg => msg.timestamp >= cutoff);
    this.shardMessages.length = 0;
    this.shardMessages.push(...filteredMessages);

    if (this.shardMessages.length < beforeCount) {
      this.logger.log(`[ColonyManager] Cleaned up ${beforeCount - this.shardMessages.length} old shard messages`);
    }

    // Receive messages from other shards
    if (typeof InterShardMemory !== "undefined" && typeof Game !== "undefined") {
      const data = InterShardMemory.getRemote(Game.shard?.name ?? "shard0");
      if (data) {
        try {
          const messages = JSON.parse(data) as InterShardMessage[];
          for (const message of messages) {
            this.handleShardMessage(message);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`[ColonyManager] Failed to parse shard messages: ${errorMsg}`);
        }
      }
    }
  }

  /**
   * Handle received shard message
   */
  private handleShardMessage(message: InterShardMessage): void {
    this.logger.log(
      `[ColonyManager] Received shard message from ${message.from}: ${message.type} (${typeof message.payload})`
    );

    switch (message.type) {
      case "resource_request":
        // Handle resource request from another shard
        break;
      case "expansion_notice":
        // Handle expansion notice from another shard
        break;
      case "status_update":
        // Handle status update from another shard
        break;
    }
  }

  /**
   * Get colony statistics
   */
  public getStats(): {
    claimedRooms: number;
    expansionQueue: number;
    pendingExpansions: number;
    shardMessages: number;
  } {
    return {
      claimedRooms: this.claimedRooms.size,
      expansionQueue: this.expansionQueue.length,
      pendingExpansions: this.expansionQueue.filter(req => req.status === "pending").length,
      shardMessages: this.shardMessages.length
    };
  }

  /**
   * Get claimed room names
   */
  public getClaimedRooms(): string[] {
    return Array.from(this.claimedRooms);
  }

  /**
   * Get expansion queue
   */
  public getExpansionQueue(): ExpansionRequest[] {
    return [...this.expansionQueue];
  }
}
