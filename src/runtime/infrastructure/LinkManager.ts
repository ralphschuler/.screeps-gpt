import type { RoomLike } from "@runtime/types/GameContext";
import { profile } from "@profiler";

/**
 * Link role in the network
 */
export type LinkRole = "source" | "storage" | "controller" | "upgrade";

/**
 * Link metadata for network coordination
 */
export interface LinkMetadata {
  id: Id<StructureLink>;
  role: LinkRole;
  pos: RoomPosition;
  lastTransferTick: number;
}

/**
 * Manages link network for automated energy distribution.
 * Handles transfers from source links to storage/controller links.
 */
@profile
export class LinkManager {
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly linkNetworks: Map<string, LinkMetadata[]> = new Map();
  private readonly sourceCache: Map<string, Source[]> = new Map();

  public constructor(logger: Pick<Console, "log" | "warn"> = console) {
    this.logger = logger;
  }

  /**
   * Execute link logic for a room
   */
  public run(room: RoomLike): { transfers: number; energyMoved: number } {
    const links = room.find(FIND_MY_STRUCTURES, {
      filter: (s: Structure) => s.structureType === STRUCTURE_LINK
    }) as StructureLink[];

    if (links.length === 0) {
      return { transfers: 0, energyMoved: 0 };
    }

    // Initialize or update link network
    const network = this.getOrCreateNetwork(room.name, links);

    let transfers = 0;
    let energyMoved = 0;

    // Process each link based on role
    for (const linkMeta of network) {
      const link = Game.getObjectById(linkMeta.id);
      if (!link) continue;

      if (linkMeta.role === "source") {
        // Source links send energy when full
        if (link.store.getFreeCapacity(RESOURCE_ENERGY) === 0 && link.cooldown === 0) {
          const target = this.findBestTarget(network, link);
          if (target) {
            const targetLink = Game.getObjectById(target.id);
            if (targetLink) {
              const transferAmount = link.store.getUsedCapacity(RESOURCE_ENERGY);
              const result = link.transferEnergy(targetLink);
              if (result === OK) {
                transfers++;
                energyMoved += transferAmount;
                linkMeta.lastTransferTick = Game.time;
              }
            }
          }
        }
      }
    }

    return { transfers, energyMoved };
  }

  /**
   * Get or create link network metadata for a room
   */
  private getOrCreateNetwork(roomName: string, links: StructureLink[]): LinkMetadata[] {
    if (!this.linkNetworks.has(roomName)) {
      const network = links.map(link => this.classifyLink(link));
      this.linkNetworks.set(roomName, network);
      return network;
    }

    const network = this.linkNetworks.get(roomName)!;

    // Update network if link count changed
    if (network.length !== links.length) {
      const newNetwork = links.map(link => this.classifyLink(link));
      this.linkNetworks.set(roomName, newNetwork);
      return newNetwork;
    }

    return network;
  }

  /**
   * Get or create cached source list for a room
   */
  private getCachedSources(roomName: string): Source[] {
    if (!this.sourceCache.has(roomName)) {
      const room = Game.rooms[roomName];
      if (room) {
        this.sourceCache.set(roomName, room.find(FIND_SOURCES));
      }
    }
    return this.sourceCache.get(roomName) ?? [];
  }

  /**
   * Classify link role based on proximity to game objects
   */
  private classifyLink(link: StructureLink): LinkMetadata {
    const room = Game.rooms[link.room.name];
    if (!room) {
      return {
        id: link.id,
        role: "storage",
        pos: link.pos,
        lastTransferTick: 0
      };
    }

    // Check proximity to sources (within 2 tiles)
    const sources = this.getCachedSources(link.room.name);
    for (const source of sources) {
      if (link.pos.getRangeTo(source) <= 2) {
        return {
          id: link.id,
          role: "source",
          pos: link.pos,
          lastTransferTick: 0
        };
      }
    }

    // Check proximity to controller (within 3 tiles)
    if (room.controller && link.pos.getRangeTo(room.controller) <= 3) {
      return {
        id: link.id,
        role: "controller",
        pos: link.pos,
        lastTransferTick: 0
      };
    }

    // Check proximity to storage (within 2 tiles)
    const storage = room.storage;
    if (storage && link.pos.getRangeTo(storage) <= 2) {
      return {
        id: link.id,
        role: "storage",
        pos: link.pos,
        lastTransferTick: 0
      };
    }

    // Default to upgrade role
    return {
      id: link.id,
      role: "upgrade",
      pos: link.pos,
      lastTransferTick: 0
    };
  }

  /**
   * Find best target link for energy transfer
   */
  private findBestTarget(network: LinkMetadata[], sourceLink: StructureLink): LinkMetadata | null {
    // Priority: controller > storage > upgrade
    const priorities: LinkRole[] = ["controller", "storage", "upgrade"];

    for (const role of priorities) {
      const targets = network.filter(meta => meta.role === role && meta.id !== sourceLink.id);

      // Find target with most free capacity
      let bestTarget: LinkMetadata | null = null;
      let maxFreeCapacity = 0;

      for (const target of targets) {
        const targetLink = Game.getObjectById(target.id);
        if (!targetLink) continue;

        const freeCapacity = targetLink.store.getFreeCapacity(RESOURCE_ENERGY);
        if (freeCapacity > maxFreeCapacity && freeCapacity >= 400) {
          maxFreeCapacity = freeCapacity;
          bestTarget = target;
        }
      }

      if (bestTarget) {
        return bestTarget;
      }
    }

    return null;
  }
}
