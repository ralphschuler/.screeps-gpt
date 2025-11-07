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
 * Traffic manager configuration
 */
export interface TrafficManagerConfig {
  /** Logger for debugging */
  logger?: Pick<Console, "log" | "warn">;
}

/**
 * Manages creep movement with collision avoidance and priority-based pathing.
 * Coordinates high-priority creeps through congested areas.
 */
@profile
export class TrafficManager {
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly movementRequests: Map<string, MovementRequest> = new Map();
  private readonly positionReservations: Map<string, string> = new Map(); // pos key -> creep name

  public constructor(config: TrafficManagerConfig = {}) {
    this.logger = config.logger ?? console;
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
    // TODO: Cache this path and reuse when destination unchanged
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
}
