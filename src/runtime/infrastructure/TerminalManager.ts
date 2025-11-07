import type { RoomLike } from "@runtime/types/GameContext";
import { profile } from "@profiler";

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
 * Terminal manager configuration
 */
export interface TerminalManagerConfig {
  /** Minimum energy reserve to maintain */
  energyReserve?: number;
  /** Minimum transfer amount */
  minTransferAmount?: number;
  /** Logger for debugging */
  logger?: Pick<Console, "log" | "warn">;
}

/**
 * Manages terminal operations for inter-room resource logistics.
 * Handles energy balancing and resource transfer coordination.
 */
@profile
export class TerminalManager {
  private readonly energyReserve: number;
  private readonly minTransferAmount: number;
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly resourceRequests: Map<string, ResourceRequest[]> = new Map();

  public constructor(config: TerminalManagerConfig = {}) {
    this.energyReserve = config.energyReserve ?? 20000;
    this.minTransferAmount = config.minTransferAmount ?? 1000;
    this.logger = config.logger ?? console;
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
    const energyBalanced = this.balanceEnergy(room);

    // Process resource requests if not on cooldown
    if (terminal.cooldown === 0) {
      const processed = this.processResourceRequests(room);
      transfers += processed.transfers;
      resourcesSent += processed.resourcesSent;
    }

    return { transfers, energyBalanced, resourcesSent };
  }

  /**
   * Balance terminal energy levels
   */
  private balanceEnergy(room: RoomLike): boolean {
    const terminals = room.find(FIND_MY_STRUCTURES, {
      filter: (s: Structure) => s.structureType === STRUCTURE_TERMINAL
    }) as StructureTerminal[];

    if (terminals.length === 0) return false;
    const terminal = terminals[0];

    const energy = terminal.store.getUsedCapacity(RESOURCE_ENERGY);

    if (energy < this.energyReserve) {
      // Request energy from storage if available
      const storages = room.find(FIND_MY_STRUCTURES, {
        filter: (s: Structure) => s.structureType === STRUCTURE_STORAGE
      }) as StructureStorage[];

      if (storages.length > 0) {
        const storage = storages[0];
        const storageEnergy = storage.store.getUsedCapacity(RESOURCE_ENERGY);
        const needed = this.energyReserve - energy;

        if (storageEnergy >= needed + 50000) {
          // Have enough in storage to transfer
          // Energy transfer would be handled by hauler creeps
          return false;
        }
      }
      return false;
    }

    return true;
  }

  /**
   * Process pending resource transfer requests
   */
  private processResourceRequests(room: RoomLike): { transfers: number; resourcesSent: number } {
    const terminals = room.find(FIND_MY_STRUCTURES, {
      filter: (s: Structure) => s.structureType === STRUCTURE_TERMINAL
    }) as StructureTerminal[];

    if (terminals.length === 0) return { transfers: 0, resourcesSent: 0 };
    const terminal = terminals[0];

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
      if (available >= Math.max(request.amount, this.minTransferAmount ?? 0)) {
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

    const index = requests.indexOf(request);
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
