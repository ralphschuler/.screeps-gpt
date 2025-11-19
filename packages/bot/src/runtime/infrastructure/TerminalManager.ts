import type { RoomLike } from "@runtime/types/GameContext";
import { profile } from "@ralphschuler/screeps-profiler";

/**
 * Resource request for inter-room transfers
 */
export interface ResourceRequest {
  resource: ResourceConstant;
  amount: number;
  targetRoom: string;
  priority: number;
  requestedAt: number;
}

/**
 * Serialized terminal manager state for Memory persistence
 */
export interface TerminalManagerMemory {
  resourceRequests: Record<string, ResourceRequest[]>;
}

/**
 * Terminal manager configuration
 */
export interface TerminalManagerConfig {
  /** Minimum energy reserve to maintain */
  energyReserve?: number;
  /** Minimum transfer amount */
  minTransferAmount?: number;
  /** Logger for debugging */
  logger?: Pick<Console, "log" | "warn">;
  /** Optional Memory reference for persistence */
  memory?: TerminalManagerMemory;
}

/**
 * Manages terminal operations for inter-room resource logistics.
 * Handles energy balancing and resource transfer coordination.
 *
 * State persistence: Resource requests can be persisted to Memory
 * by providing a memory reference in the config and calling saveToMemory().
 */
@profile
export class TerminalManager {
  private readonly energyReserve: number;
  private readonly minTransferAmount: number;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly resourceRequests: Map<string, ResourceRequest[]> = new Map();
  private readonly memoryRef?: TerminalManagerMemory;

  public constructor(config: TerminalManagerConfig = {}) {
    this.energyReserve = config.energyReserve ?? 20000;
    this.minTransferAmount = config.minTransferAmount ?? 1000;
    this.logger = config.logger ?? console;
    this.memoryRef = config.memory;

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

    // Load resource requests
    if (this.memoryRef.resourceRequests) {
      for (const [roomName, requests] of Object.entries(this.memoryRef.resourceRequests)) {
        this.resourceRequests.set(roomName, requests);
      }
    }
  }

  /**
   * Save state to Memory (call periodically to persist state)
   */
  public saveToMemory(): void {
    if (!this.memoryRef) return;

    // Save resource requests
    this.memoryRef.resourceRequests = {};
    for (const [roomName, requests] of this.resourceRequests.entries()) {
      this.memoryRef.resourceRequests[roomName] = requests;
    }
  }

  /**
   * Execute terminal logic for a room
   */
  public run(room: RoomLike): {
    transfers: number;
    energyBalanced: boolean;
    resourcesSent: number;
  } {
    const terminals = room.find(FIND_MY_STRUCTURES, {
      filter: (s: Structure) => s.structureType === STRUCTURE_TERMINAL
    }) as StructureTerminal[];

    if (terminals.length === 0) {
      return { transfers: 0, energyBalanced: false, resourcesSent: 0 };
    }

    const terminal = terminals[0];
    let transfers = 0;
    let resourcesSent = 0;

    // Balance energy first
    const energyBalanced = this.balanceEnergy(room, terminal);

    // Process resource requests if not on cooldown
    if (terminal.cooldown === 0) {
      const processed = this.processResourceRequests(room, terminal);
      transfers += processed.transfers;
      resourcesSent += processed.resourcesSent;
    }

    // Periodically clean up old requests
    if (Game.time % 100 === 0) {
      this.clearOldRequests();
    }

    return { transfers, energyBalanced, resourcesSent };
  }

  /**
   * Balance terminal energy levels
   */
  private balanceEnergy(room: RoomLike, terminal: StructureTerminal): boolean {
    const energy = terminal.store.getUsedCapacity(RESOURCE_ENERGY);

    if (energy < this.energyReserve) {
      // Energy is below reserve threshold
      return false;
    }

    return true;
  }

  /**
   * Process pending resource transfer requests
   */
  private processResourceRequests(
    room: RoomLike,
    terminal: StructureTerminal
  ): { transfers: number; resourcesSent: number } {
    const requests = this.getResourceRequests(room.name);
    if (requests.length === 0) {
      return { transfers: 0, resourcesSent: 0 };
    }

    // Sort by priority (highest first)
    requests.sort((a, b) => b.priority - a.priority);

    let transfers = 0;
    let resourcesSent = 0;

    for (const request of requests) {
      if (terminal.cooldown > 0) break;

      const available = terminal.store.getUsedCapacity(request.resource);
      if (available >= Math.max(request.amount, this.minTransferAmount)) {
        const result = terminal.send(
          request.resource,
          request.amount,
          request.targetRoom,
          `Resource transfer: ${request.resource}`
        );

        if (result === OK) {
          transfers++;
          resourcesSent += request.amount;
          this.removeRequest(room.name, request);
        }
      }
    }

    return { transfers, resourcesSent };
  }

  /**
   * Get resource requests for a room
   */
  private getResourceRequests(roomName: string): ResourceRequest[] {
    if (!this.resourceRequests.has(roomName)) {
      return [];
    }
    return this.resourceRequests.get(roomName) ?? [];
  }

  /**
   * Add a resource request
   */
  public addRequest(
    sourceRoom: string,
    resource: ResourceConstant,
    amount: number,
    targetRoom: string,
    priority: number = 50
  ): void {
    if (!this.resourceRequests.has(sourceRoom)) {
      this.resourceRequests.set(sourceRoom, []);
    }

    const requests = this.resourceRequests.get(sourceRoom)!;
    requests.push({
      resource,
      amount,
      targetRoom,
      priority,
      requestedAt: Game.time
    });
  }

  /**
   * Remove a processed request
   */
  private removeRequest(roomName: string, request: ResourceRequest): void {
    const requests = this.resourceRequests.get(roomName);
    if (!requests) return;

    const index = requests.findIndex(
      r =>
        r.resource === request.resource &&
        r.amount === request.amount &&
        r.targetRoom === request.targetRoom &&
        r.priority === request.priority &&
        r.requestedAt === request.requestedAt
    );
    if (index !== -1) {
      requests.splice(index, 1);
    }
  }

  /**
   * Clear old requests (older than 1000 ticks)
   */
  public clearOldRequests(): void {
    for (const [roomName, requests] of this.resourceRequests.entries()) {
      const filtered = requests.filter(req => Game.time - req.requestedAt < 1000);
      this.resourceRequests.set(roomName, filtered);
    }
  }
}
