/**
 * Economy Roles - Phase 7.1
 *
 * All economy-focused creep roles:
 * - LarvaWorker (unified starter)
 * - Harvester (stationary miner)
 * - Hauler (transport)
 * - Builder
 * - Upgrader
 * - QueenCarrier (distributor)
 * - MineralHarvester
 * - DepositHarvester
 * - LabTech
 * - FactoryWorker
 */

// import { getConfig } from "../../config";
import type { SwarmCreepMemory } from "../../memory/schemas";

/**
 * Get creep memory with type safety
 */
function getMemory(creep: Creep): SwarmCreepMemory {
  return creep.memory as unknown as SwarmCreepMemory;
}

/**
 * Set working state based on carry capacity
 */
function updateWorkingState(creep: Creep): boolean {
  const memory = getMemory(creep);
  if (creep.store.getUsedCapacity() === 0) {
    memory.working = false;
  }
  if (creep.store.getFreeCapacity() === 0) {
    memory.working = true;
  }
  return memory.working ?? false;
}

/**
 * Find best energy source for creep
 */
function findEnergySource(creep: Creep): Source | StructureContainer | StructureStorage | Resource | null {
  // Priority 1: Dropped energy
  const dropped = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
    filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
  });
  if (dropped) return dropped;

  // Priority 2: Containers with energy
  const container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
    filter: s =>
      s.structureType === STRUCTURE_CONTAINER &&
      (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 100
  }) as StructureContainer | null;
  if (container) return container;

  // Priority 3: Storage
  if (creep.room.storage && creep.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
    return creep.room.storage;
  }

  // Priority 4: Active sources
  return creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
}

/**
 * Collect energy from source/container/storage/dropped
 */
function collectEnergy(creep: Creep, target: Source | StructureContainer | StructureStorage | Resource): number {
  if (target instanceof Resource) {
    const result = creep.pickup(target);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
    return result;
  }

  if (target instanceof Source) {
    const result = creep.harvest(target);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
    return result;
  }

  // Structure (container/storage)
  const result = creep.withdraw(target, RESOURCE_ENERGY);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, { visualizePathStyle: { stroke: "#ffaa00" } });
  }
  return result;
}

/**
 * Find energy delivery target
 */
function findDeliveryTarget(creep: Creep): AnyStoreStructure | null {
  // Priority 1: Spawns/extensions that need energy
  const spawnOrExtension = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
    filter: s =>
      (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
      "store" in s &&
      s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
  }) as AnyStoreStructure | null;
  if (spawnOrExtension) return spawnOrExtension;

  // Priority 2: Towers below 80%
  const tower = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
    filter: s =>
      s.structureType === STRUCTURE_TOWER &&
      (s as StructureTower).store.getFreeCapacity(RESOURCE_ENERGY) > 200
  }) as StructureTower | null;
  if (tower) return tower;

  // Priority 3: Storage
  if (creep.room.storage && creep.room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
    return creep.room.storage;
  }

  return null;
}

/**
 * Deliver energy to target
 */
function deliverEnergy(creep: Creep, target: AnyStoreStructure): number {
  const result = creep.transfer(target, RESOURCE_ENERGY);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
  }
  return result;
}

// =============================================================================
// LarvaWorker - Unified starter role
// =============================================================================

/**
 * Run LarvaWorker behavior
 * Priority: harvest → deliver → build → upgrade
 */
export function runLarvaWorker(creep: Creep): void {
  const working = updateWorkingState(creep);

  if (working) {
    // Try to deliver first
    const deliveryTarget = findDeliveryTarget(creep);
    if (deliveryTarget) {
      deliverEnergy(creep, deliveryTarget);
      return;
    }

    // Then try to build
    const site = creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES);
    if (site) {
      if (creep.build(site) === ERR_NOT_IN_RANGE) {
        creep.moveTo(site, { visualizePathStyle: { stroke: "#ffffff" } });
      }
      return;
    }

    // Fallback to upgrading
    if (creep.room.controller) {
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    }
  } else {
    // Collect energy
    const source = findEnergySource(creep);
    if (source) {
      collectEnergy(creep, source);
    }
  }
}

// =============================================================================
// Harvester - Stationary miner
// =============================================================================

/**
 * Run Harvester behavior
 * Stationary miner that harvests from assigned source
 */
export function runHarvester(creep: Creep): void {
  const memory = getMemory(creep);

  // Find assigned source or closest source
  let source: Source | null = null;
  if (memory.sourceId) {
    source = Game.getObjectById(memory.sourceId);
  }

  if (!source) {
    // Find and assign a source
    const sources = creep.room.find(FIND_SOURCES);
    // Pick source with fewest assigned harvesters
    const sourceCounts = new Map<string, number>();
    for (const s of sources) {
      sourceCounts.set(s.id, 0);
    }

    for (const c of Object.values(Game.creeps)) {
      const m = c.memory as unknown as SwarmCreepMemory;
      if (m.role === "harvester" && m.sourceId) {
        sourceCounts.set(m.sourceId, (sourceCounts.get(m.sourceId) ?? 0) + 1);
      }
    }

    let minCount = Infinity;
    for (const s of sources) {
      const count = sourceCounts.get(s.id) ?? 0;
      if (count < minCount) {
        minCount = count;
        source = s;
      }
    }

    if (source) {
      memory.sourceId = source.id;
    }
  }

  if (!source) return;

  // Move to source and harvest
  if (creep.pos.isNearTo(source)) {
    creep.harvest(source);

    // If full, try to transfer to nearby container or link
    if (creep.store.getFreeCapacity() === 0) {
      const container = creep.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: s =>
          s.structureType === STRUCTURE_CONTAINER &&
          (s as StructureContainer).store.getFreeCapacity(RESOURCE_ENERGY) > 0
      })[0] as StructureContainer | undefined;

      if (container) {
        creep.transfer(container, RESOURCE_ENERGY);
      } else {
        const link = creep.pos.findInRange(FIND_MY_STRUCTURES, 1, {
          filter: s =>
            s.structureType === STRUCTURE_LINK &&
            (s as StructureLink).store.getFreeCapacity(RESOURCE_ENERGY) > 0
        })[0] as StructureLink | undefined;

        if (link) {
          creep.transfer(link, RESOURCE_ENERGY);
        } else {
          // Drop on ground for haulers
          creep.drop(RESOURCE_ENERGY);
        }
      }
    }
  } else {
    creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
  }
}

// =============================================================================
// Hauler - Transport energy/resources
// =============================================================================

/**
 * Run Hauler behavior
 * Transport energy from sources/containers to storage/spawns
 */
export function runHauler(creep: Creep): void {
  const working = updateWorkingState(creep);

  if (working) {
    const target = findDeliveryTarget(creep);
    if (target) {
      deliverEnergy(creep, target);
    }
  } else {
    // Priority 1: Dropped resources near sources
    const dropped = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
    });

    if (dropped) {
      if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) {
        creep.moveTo(dropped, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }

    // Priority 2: Tombstones
    const tombstone = creep.pos.findClosestByRange(FIND_TOMBSTONES, {
      filter: t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });

    if (tombstone) {
      if (creep.withdraw(tombstone, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(tombstone, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }

    // Priority 3: Containers
    const container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: s =>
        s.structureType === STRUCTURE_CONTAINER &&
        (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 100
    }) as StructureContainer | null;

    if (container) {
      if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(container, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    }
  }
}

// =============================================================================
// Builder
// =============================================================================

/**
 * Run Builder behavior
 */
export function runBuilder(creep: Creep): void {
  const working = updateWorkingState(creep);

  if (working) {
    // Find construction site by priority
    const sites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);

    if (sites.length === 0) {
      // No sites, help with upgrading
      runUpgrader(creep);
      return;
    }

    // Prioritize: spawns > extensions > towers > storage > other
    const prioritized = sites.sort((a, b) => {
      const priority: Record<string, number> = {
        [STRUCTURE_SPAWN]: 100,
        [STRUCTURE_EXTENSION]: 90,
        [STRUCTURE_TOWER]: 80,
        [STRUCTURE_STORAGE]: 70,
        [STRUCTURE_CONTAINER]: 60,
        [STRUCTURE_ROAD]: 30
      };
      return (priority[b.structureType] ?? 50) - (priority[a.structureType] ?? 50);
    });

    const site = prioritized[0];
    if (site) {
      if (creep.build(site) === ERR_NOT_IN_RANGE) {
        creep.moveTo(site, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    }
  } else {
    const source = findEnergySource(creep);
    if (source) {
      collectEnergy(creep, source);
    }
  }
}

// =============================================================================
// Upgrader
// =============================================================================

/**
 * Run Upgrader behavior
 */
export function runUpgrader(creep: Creep): void {
  const working = updateWorkingState(creep);

  if (working) {
    if (creep.room.controller) {
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    }
  } else {
    // Prefer storage/container over harvesting
    if (creep.room.storage && creep.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 1000) {
      if (creep.withdraw(creep.room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.storage, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }

    const container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: s =>
        s.structureType === STRUCTURE_CONTAINER &&
        (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 100
    }) as StructureContainer | null;

    if (container) {
      if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(container, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }

    const source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
    if (source) {
      if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    }
  }
}

// =============================================================================
// QueenCarrier / Distributor
// =============================================================================

/**
 * Run QueenCarrier behavior
 * Manages key energy flow between storage, spawns, extensions, towers
 */
export function runQueenCarrier(creep: Creep): void {
  const working = updateWorkingState(creep);

  if (working) {
    // Fill spawns and extensions first
    const spawnOrExtension = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
      filter: s =>
        (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
        "store" in s &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    }) as AnyStoreStructure | null;

    if (spawnOrExtension) {
      if (creep.transfer(spawnOrExtension, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(spawnOrExtension, { visualizePathStyle: { stroke: "#ffffff" } });
      }
      return;
    }

    // Then towers
    const tower = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
      filter: s =>
        s.structureType === STRUCTURE_TOWER &&
        (s as StructureTower).store.getFreeCapacity(RESOURCE_ENERGY) > 100
    }) as StructureTower | null;

    if (tower) {
      if (creep.transfer(tower, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(tower, { visualizePathStyle: { stroke: "#ffffff" } });
      }
      return;
    }

    // If nothing needs energy, wait near storage
    if (creep.room.storage) {
      creep.moveTo(creep.room.storage);
    }
  } else {
    // Get energy from storage or terminal
    if (creep.room.storage && creep.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      if (creep.withdraw(creep.room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.storage, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    } else if (creep.room.terminal && creep.room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      if (creep.withdraw(creep.room.terminal, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.terminal, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    }
  }
}

// =============================================================================
// MineralHarvester
// =============================================================================

/**
 * Run MineralHarvester behavior
 */
export function runMineralHarvester(creep: Creep): void {
  // Find mineral in room
  const mineral = creep.room.find(FIND_MINERALS)[0];
  if (!mineral) return;

  // Check for extractor
  const extractor = mineral.pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_EXTRACTOR);
  if (!extractor) return;

  // Check if mineral is available
  if (mineral.mineralAmount === 0) {
    // Wait near storage
    if (creep.room.storage) {
      creep.moveTo(creep.room.storage);
    }
    return;
  }

  if (creep.store.getFreeCapacity() === 0) {
    // Deliver to storage or terminal
    const target = creep.room.terminal ?? creep.room.storage;
    if (target) {
      const mineralType = Object.keys(creep.store)[0] as ResourceConstant;
      if (creep.transfer(target, mineralType) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    }
  } else {
    // Harvest mineral
    if (creep.harvest(mineral) === ERR_NOT_IN_RANGE) {
      creep.moveTo(mineral, { visualizePathStyle: { stroke: "#00ff00" } });
    }
  }
}

// =============================================================================
// DepositHarvester
// =============================================================================

/**
 * Run DepositHarvester behavior
 */
export function runDepositHarvester(creep: Creep): void {
  const memory = getMemory(creep);

  // Check if we have a target deposit
  if (!memory.targetId) {
    // Find deposit in room or move to highway room
    const deposits = creep.room.find(FIND_DEPOSITS);
    if (deposits.length > 0) {
      // Select deposit with best ROI (lowest cooldown)
      const best = deposits.reduce((a, b) => (a.cooldown < b.cooldown ? a : b));
      memory.targetId = best.id as unknown as Id<_HasId>;
    }
  }

  if (memory.targetId) {
    const deposit = Game.getObjectById(memory.targetId as unknown as Id<Deposit>);
    if (!deposit || deposit.cooldown > 100) {
      // Deposit gone or cooldown too high
      delete memory.targetId;
      return;
    }

    if (creep.store.getFreeCapacity() === 0) {
      // Return home to deliver
      const homeRoom = Game.rooms[memory.homeRoom];
      if (homeRoom) {
        const target = homeRoom.terminal ?? homeRoom.storage;
        if (target) {
          const resourceType = Object.keys(creep.store)[0] as ResourceConstant;
          if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
          }
        }
      }
    } else {
      // Harvest deposit
      if (creep.harvest(deposit) === ERR_NOT_IN_RANGE) {
        creep.moveTo(deposit, { visualizePathStyle: { stroke: "#00ffff" } });
      }
    }
  }
}

// =============================================================================
// LabTech
// =============================================================================

/**
 * Run LabTech behavior
 */
export function runLabTech(creep: Creep): void {
  // Find labs in room
  const labs = creep.room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_LAB
  }) as StructureLab[];

  if (labs.length === 0) return;

  // Simple lab management: keep input labs filled, empty output labs
  // Identify input/output labs (first 2 are input, rest are output)
  const inputLabs = labs.slice(0, 2);
  const outputLabs = labs.slice(2);

  // If carrying resources, deliver them
  if (creep.store.getUsedCapacity() > 0) {
    const resourceType = Object.keys(creep.store)[0] as ResourceConstant;

    // If carrying a product, put in terminal/storage
    if (
      resourceType !== RESOURCE_ENERGY &&
      ![
        RESOURCE_HYDROGEN,
        RESOURCE_OXYGEN,
        RESOURCE_UTRIUM,
        RESOURCE_LEMERGIUM,
        RESOURCE_KEANIUM,
        RESOURCE_ZYNTHIUM,
        RESOURCE_CATALYST
      ].includes(resourceType as MineralConstant)
    ) {
      const target = creep.room.terminal ?? creep.room.storage;
      if (target) {
        if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      }
      return;
    }

    // If carrying a base mineral, put in input lab
    for (const lab of inputLabs) {
      const capacity = lab.store.getFreeCapacity(resourceType);
      if (capacity !== null && capacity > 0) {
        if (creep.transfer(lab, resourceType) === ERR_NOT_IN_RANGE) {
          creep.moveTo(lab, { visualizePathStyle: { stroke: "#ffffff" } });
        }
        return;
      }
    }
  }

  // Collect products from output labs
  for (const lab of outputLabs) {
    const mineralType = lab.mineralType;
    if (mineralType && lab.store.getUsedCapacity(mineralType) > 100) {
      if (creep.withdraw(lab, mineralType) === ERR_NOT_IN_RANGE) {
        creep.moveTo(lab, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }
  }

  // Fill input labs from terminal/storage
  const source = creep.room.terminal ?? creep.room.storage;
  if (source) {
    for (const lab of inputLabs) {
      if (lab.store.getFreeCapacity(RESOURCE_ENERGY) > 500) {
        // Need to determine what mineral this lab needs
        // For now, just fill with first available base mineral
        const minerals: MineralConstant[] = [
          RESOURCE_HYDROGEN,
          RESOURCE_OXYGEN,
          RESOURCE_UTRIUM,
          RESOURCE_LEMERGIUM,
          RESOURCE_KEANIUM,
          RESOURCE_ZYNTHIUM,
          RESOURCE_CATALYST
        ];
        for (const mineral of minerals) {
          if (source.store.getUsedCapacity(mineral) > 0 && lab.store.getFreeCapacity(mineral) > 0) {
            if (creep.withdraw(source, mineral) === ERR_NOT_IN_RANGE) {
              creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
            }
            return;
          }
        }
      }
    }
  }
}

// =============================================================================
// FactoryWorker
// =============================================================================

/**
 * Run FactoryWorker behavior
 */
export function runFactoryWorker(creep: Creep): void {
  const factory = creep.room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_FACTORY
  })[0] as StructureFactory | undefined;

  if (!factory) return;

  // Keep factory stocked with energy and basic resources
  const working = updateWorkingState(creep);

  if (working) {
    // Deliver to factory
    const resourceType = Object.keys(creep.store)[0] as ResourceConstant;
    if (creep.transfer(factory, resourceType) === ERR_NOT_IN_RANGE) {
      creep.moveTo(factory, { visualizePathStyle: { stroke: "#ffffff" } });
    }
  } else {
    // Check what factory needs
    const source = creep.room.terminal ?? creep.room.storage;
    if (!source) return;

    // Priority: energy, then bars, then regional resources
    if (factory.store.getUsedCapacity(RESOURCE_ENERGY) < 5000 && source.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
      if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }

    // Check for compressed bars
    const bars: ResourceConstant[] = [
      RESOURCE_UTRIUM_BAR,
      RESOURCE_LEMERGIUM_BAR,
      RESOURCE_KEANIUM_BAR,
      RESOURCE_ZYNTHIUM_BAR,
      RESOURCE_OXIDANT,
      RESOURCE_REDUCTANT
    ];

    for (const bar of bars) {
      if (factory.store.getUsedCapacity(bar) < 500 && source.store.getUsedCapacity(bar) > 0) {
        if (creep.withdraw(source, bar) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
        }
        return;
      }
    }
  }
}

// =============================================================================
// Role dispatcher
// =============================================================================

/**
 * Run economy role
 */
export function runEconomyRole(creep: Creep): void {
  const memory = getMemory(creep);

  switch (memory.role) {
    case "larvaWorker":
      runLarvaWorker(creep);
      break;
    case "harvester":
      runHarvester(creep);
      break;
    case "hauler":
      runHauler(creep);
      break;
    case "builder":
      runBuilder(creep);
      break;
    case "upgrader":
      runUpgrader(creep);
      break;
    case "queenCarrier":
      runQueenCarrier(creep);
      break;
    case "mineralHarvester":
      runMineralHarvester(creep);
      break;
    case "depositHarvester":
      runDepositHarvester(creep);
      break;
    case "labTech":
      runLabTech(creep);
      break;
    case "factoryWorker":
      runFactoryWorker(creep);
      break;
    default:
      runLarvaWorker(creep);
  }
}
