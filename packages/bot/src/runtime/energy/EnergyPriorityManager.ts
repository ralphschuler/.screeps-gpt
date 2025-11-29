import type { RoomLike } from "@runtime/types/GameContext";
import { profile } from "@ralphschuler/screeps-profiler";

/**
 * Energy priority levels for resource distribution.
 * Lower values = higher priority.
 */
export enum EnergyPriority {
  DEFENSE = 0, // Towers (critical for room defense)
  SPAWN = 1, // Spawn-adjacent containers (critical for creep production)
  GROWTH = 2, // Controller upgrades (economic growth)
  STORAGE = 3 // Buffer storage (surplus energy)
}

/**
 * Configuration for energy priority thresholds
 */
export interface EnergyPriorityConfig {
  /** Minimum energy reserve for spawn-adjacent containers */
  spawnContainerReserve: number;
  /** Minimum tower energy capacity percentage to maintain */
  towerMinCapacity: number;
  /** Minimum amount of dropped energy to consider picking up */
  haulerPickupMinAmount: number;
  /** Energy amount threshold above which piles are prioritized */
  haulerPriorityAmount: number;
  /** Energy amount difference threshold for using distance as tiebreaker */
  haulerAmountTiebreakerThreshold: number;
}

/**
 * Default energy priority configuration
 */
export const DEFAULT_ENERGY_CONFIG: EnergyPriorityConfig = {
  spawnContainerReserve: 300, // Reserve 300 energy for spawn operations
  towerMinCapacity: 0.5, // Maintain towers at >50% capacity
  haulerPickupMinAmount: 10, // Ignore very small drops below 10 energy
  haulerPriorityAmount: 100, // Prioritize piles above 100 energy
  haulerAmountTiebreakerThreshold: 50 // Use distance as tiebreaker when amounts differ by less than this
};

/**
 * Energy budget allocation for a room
 */
export interface EnergyBudget {
  towersNeed: number;
  spawnContainersNeed: number;
  availableForUpgrade: number;
}

/**
 * Manages energy priority and distribution logic across structures in a room.
 * Ensures critical structures (towers, spawn containers) are prioritized over
 * lower-priority operations like controller upgrades.
 */
@profile
export class EnergyPriorityManager {
  private readonly config: EnergyPriorityConfig;
  private readonly logger: Pick<Console, "log" | "warn">;

  public constructor(config: Partial<EnergyPriorityConfig> = {}, logger: Pick<Console, "log" | "warn"> = console) {
    this.config = { ...DEFAULT_ENERGY_CONFIG, ...config };
    this.logger = logger;
  }

  /**
   * Calculate energy needs for towers in the room.
   * Returns the total amount of energy needed to bring all towers to the minimum capacity threshold.
   */
  public getTowerEnergyNeeds(room: RoomLike): number {
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_TOWER
    }) as StructureTower[];

    return towers.reduce((total, tower) => {
      const currentCapacity = tower.store.getUsedCapacity(RESOURCE_ENERGY);
      const maxCapacity = tower.store.getCapacity(RESOURCE_ENERGY);
      const targetCapacity = maxCapacity * this.config.towerMinCapacity;
      const need = Math.max(0, targetCapacity - currentCapacity);
      return total + need;
    }, 0);
  }

  /**
   * Calculate energy needs for spawn-adjacent containers.
   * Returns the total amount of energy needed to maintain spawn reserves.
   */
  public getSpawnContainerNeeds(room: RoomLike): number {
    const spawns = room.find(FIND_MY_SPAWNS) as StructureSpawn[];
    if (spawns.length === 0) {
      return 0;
    }

    let totalNeed = 0;

    for (const spawn of spawns) {
      // Find containers adjacent to this spawn
      const nearbyStructures = spawn.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER
      });

      for (const structure of nearbyStructures) {
        const container = structure as StructureContainer;
        const currentEnergy = container.store.getUsedCapacity(RESOURCE_ENERGY);
        const need = Math.max(0, this.config.spawnContainerReserve - currentEnergy);
        totalNeed += need;
      }
    }

    return totalNeed;
  }

  /**
   * Check if a container is adjacent to a spawn and should be protected.
   */
  public isSpawnContainer(container: StructureContainer, room: RoomLike): boolean {
    const spawns = room.find(FIND_MY_SPAWNS) as StructureSpawn[];
    return spawns.some(spawn => spawn.pos.isNearTo(container.pos));
  }

  /**
   * Check if energy can be safely withdrawn from a container by a non-critical role.
   * Returns true only if withdrawing wouldn't violate spawn reserves.
   */
  public canWithdrawFromContainer(container: StructureContainer, withdrawAmount: number, room: RoomLike): boolean {
    // Check if this is a spawn-adjacent container
    if (!this.isSpawnContainer(container, room)) {
      return true; // Not a spawn container, safe to withdraw
    }

    // Calculate how much energy would remain after withdrawal
    const currentEnergy = container.store.getUsedCapacity(RESOURCE_ENERGY);
    const remainingEnergy = currentEnergy - withdrawAmount;

    // Only allow withdrawal if reserve is maintained
    return remainingEnergy >= this.config.spawnContainerReserve;
  }

  /**
   * Calculate the energy budget for a room.
   * Determines how much energy is needed for critical operations vs available for upgrades.
   */
  public calculateEnergyBudget(room: RoomLike): EnergyBudget {
    const towersNeed = this.getTowerEnergyNeeds(room);
    const spawnContainersNeed = this.getSpawnContainerNeeds(room);

    // Calculate total available energy in containers and storage
    const containers = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_CONTAINER
    }) as StructureContainer[];

    const storage = room.storage;

    let totalAvailable = 0;
    for (const container of containers) {
      totalAvailable += container.store.getUsedCapacity(RESOURCE_ENERGY);
    }
    if (storage) {
      totalAvailable += storage.store.getUsedCapacity(RESOURCE_ENERGY);
    }

    // Energy available for upgrades = total - critical needs
    const availableForUpgrade = Math.max(0, totalAvailable - towersNeed - spawnContainersNeed);

    return {
      towersNeed,
      spawnContainersNeed,
      availableForUpgrade
    };
  }

  /**
   * Check if the room has sufficient energy for non-critical operations.
   * Returns true if towers and spawn containers have adequate energy.
   */
  public hasEnergyForUpgrades(room: RoomLike): boolean {
    const budget = this.calculateEnergyBudget(room);
    // Allow upgrades if critical needs are minimal (less than 100 total)
    // OR if there's significant surplus (more than 500 available)
    return budget.towersNeed + budget.spawnContainersNeed < 100 || budget.availableForUpgrade > 500;
  }

  /**
   * Get a priority-sorted list of energy sources for withdrawal.
   * Excludes spawn-adjacent containers if they're below reserve threshold.
   */
  public getAvailableEnergySources(
    room: RoomLike,
    minEnergy: number = 0,
    respectReserves: boolean = true
  ): AnyStoreStructure[] {
    const sources: AnyStoreStructure[] = [];

    // Find all containers with energy
    const containers = room.find(FIND_STRUCTURES, {
      filter: s =>
        s.structureType === STRUCTURE_CONTAINER &&
        (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > minEnergy
    }) as StructureContainer[];

    // Filter containers based on spawn reserves if requested
    for (const container of containers) {
      if (respectReserves) {
        const isSpawnAdj = this.isSpawnContainer(container, room);
        const currentEnergy = container.store.getUsedCapacity(RESOURCE_ENERGY);

        if (isSpawnAdj && currentEnergy <= this.config.spawnContainerReserve) {
          continue; // Skip this container, it's below reserve
        }
      }
      sources.push(container);
    }

    // Add storage if available (check both room.storage and FIND_STRUCTURES)
    if (room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > minEnergy) {
      sources.push(room.storage);
    } else {
      // Fallback: look for storage via FIND_STRUCTURES (needed for some test mocks)
      const storageStructures = room.find(FIND_STRUCTURES, {
        filter: s =>
          s.structureType === STRUCTURE_STORAGE &&
          (s as StructureStorage).store.getUsedCapacity(RESOURCE_ENERGY) > minEnergy
      }) as StructureStorage[];

      if (storageStructures.length > 0) {
        sources.push(storageStructures[0]);
      }
    }

    return sources;
  }

  /**
   * Get the maximum amount that can be safely withdrawn from a container.
   * For spawn containers, this respects the reserve threshold.
   */
  public getMaxWithdrawAmount(container: StructureContainer, room: RoomLike): number {
    const currentEnergy = container.store.getUsedCapacity(RESOURCE_ENERGY);

    if (!this.isSpawnContainer(container, room)) {
      return currentEnergy; // Non-spawn container, can withdraw all
    }

    // Spawn container - respect reserve
    return Math.max(0, currentEnergy - this.config.spawnContainerReserve);
  }
}
