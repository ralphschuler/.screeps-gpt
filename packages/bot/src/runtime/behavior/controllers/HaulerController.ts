/**
 * Hauler Role Controller
 *
 * Haulers are responsible for:
 * - Picking up energy from containers and dropped resources
 * - Delivering energy to spawns, extensions, and towers (priority-based)
 * - Filling spawn-adjacent containers
 * - Storing surplus energy in storage
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { tryPickupDroppedEnergy, findSpawnAdjacentContainers, findLowEnergyTowers } from "./helpers";
import { DEFAULT_ENERGY_CONFIG } from "@runtime/energy";

// Task constants
const HAULER_PICKUP_TASK = "pickup" as const;
const HAULER_DELIVER_TASK = "haulerDeliver" as const;

type HaulerTask = typeof HAULER_PICKUP_TASK | typeof HAULER_DELIVER_TASK;

interface HaulerMemory extends CreepMemory {
  role: "hauler";
  task: HaulerTask;
  version: number;
}

/**
 * Hauler role controller implementation
 */
export class HaulerController extends BaseRoleController<HaulerMemory> {
  public constructor() {
    const config: RoleConfig<HaulerMemory> = {
      minimum: 0,
      body: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
      version: 1,
      createMemory: () => ({
        role: "hauler",
        task: HAULER_PICKUP_TASK,
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "hauler";
  }

  public execute(creep: CreepLike): string {
    const memory = creep.memory as HaulerMemory;
    const task = this.ensureTask(memory, creep);
    const comm = serviceRegistry.getCommunicationManager();

    if (task === HAULER_PICKUP_TASK) {
      comm?.say(creep, "pickup");

      // Priority 1: Pick up dropped energy
      if (tryPickupDroppedEnergy(creep)) {
        return HAULER_PICKUP_TASK;
      }

      // Priority 2: Pick up from containers near sources
      const containers = creep.room.find(FIND_STRUCTURES, {
        filter: s =>
          s.structureType === STRUCTURE_CONTAINER &&
          (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 0
      }) as StructureContainer[];

      if (containers.length > 0) {
        const closest = creep.pos.findClosestByPath(containers);
        const target = closest ?? containers[0];
        const result = creep.withdraw(target, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { range: 1, reusePath: 30 });
        }
      }

      return HAULER_PICKUP_TASK;
    }

    // HAULER_DELIVER_TASK: Threshold-based delivery for balanced energy distribution
    comm?.say(creep, "deliver");

    const energyMgr = serviceRegistry.getEnergyPriorityManager();

    // Priority 1: Critical spawns/extensions (below threshold capacity)
    const criticalSpawns = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure) => {
        if (structure.structureType !== STRUCTURE_SPAWN && structure.structureType !== STRUCTURE_EXTENSION) {
          return false;
        }
        const store = (structure as AnyStoreStructure).store;
        const capacity = store.getCapacity(RESOURCE_ENERGY);
        const used = store.getUsedCapacity(RESOURCE_ENERGY);
        // Use 30% threshold for spawn/extension critical level
        return capacity > 0 && used < capacity * 0.3;
      }
    });

    if (criticalSpawns.length > 0) {
      const closest = creep.pos.findClosestByPath(criticalSpawns);
      const target = closest !== null ? closest : criticalSpawns[0];
      const result = creep.transfer(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      }
      return HAULER_DELIVER_TASK;
    }

    // Priority 2: Towers below threshold capacity (defense)
    const lowTowers = findLowEnergyTowers(creep.room, DEFAULT_ENERGY_CONFIG.towerMinCapacity);

    if (lowTowers.length > 0) {
      const closest = creep.pos.findClosestByPath(lowTowers);
      const target = closest ?? lowTowers[0];
      const result = creep.transfer(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      }
      return HAULER_DELIVER_TASK;
    }

    // Priority 3: Spawn-adjacent containers below reserve threshold
    if (energyMgr) {
      const lowSpawnContainers = findSpawnAdjacentContainers(creep.room, DEFAULT_ENERGY_CONFIG.spawnContainerReserve);

      if (lowSpawnContainers.length > 0) {
        const closest = creep.pos.findClosestByPath(lowSpawnContainers);
        const target = closest ?? lowSpawnContainers[0];
        const result = creep.transfer(target, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { range: 1, reusePath: 30 });
        }
        return HAULER_DELIVER_TASK;
      }
    }

    // Priority 4: Top off spawns and extensions to full capacity
    const spawnsExtensions = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure) =>
        (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
        (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });

    if (spawnsExtensions.length > 0) {
      const closest = creep.pos.findClosestByPath(spawnsExtensions);
      const target = closest !== null ? closest : spawnsExtensions[0];
      const result = creep.transfer(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      }
      return HAULER_DELIVER_TASK;
    }

    // Priority 5: Top off towers to full capacity
    const towers = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure) => {
        if (structure.structureType !== STRUCTURE_TOWER) return false;
        return structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    }) as StructureTower[];

    if (towers.length > 0) {
      const closest = creep.pos.findClosestByPath(towers);
      const target = closest ?? towers[0];
      const result = creep.transfer(target, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      }
      return HAULER_DELIVER_TASK;
    }

    // Priority 6: Fill spawn-adjacent containers to full capacity
    if (energyMgr) {
      const spawnContainers = findSpawnAdjacentContainers(creep.room);

      if (spawnContainers.length > 0) {
        const closest = creep.pos.findClosestByPath(spawnContainers);
        const target = closest ?? spawnContainers[0];
        const result = creep.transfer(target, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { range: 1, reusePath: 30 });
        }
        return HAULER_DELIVER_TASK;
      }
    }

    // Priority 7: Storage (surplus)
    const storage = creep.room.storage;

    if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      const result = creep.transfer(storage, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(storage, { range: 1, reusePath: 30 });
      }
      return HAULER_DELIVER_TASK;
    }

    // Fallback: Upgrade controller
    const controller = creep.room.controller;
    if (controller) {
      const result = creep.upgradeController(controller);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { range: 3, reusePath: 30 });
      }
    }

    return HAULER_DELIVER_TASK;
  }

  /**
   * Ensure hauler task is valid and transitions properly between states
   */
  private ensureTask(memory: HaulerMemory, creep: CreepLike): HaulerTask {
    if (memory.task !== HAULER_PICKUP_TASK && memory.task !== HAULER_DELIVER_TASK) {
      memory.task = HAULER_PICKUP_TASK;
      return memory.task;
    }

    if (memory.task === HAULER_PICKUP_TASK && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = HAULER_DELIVER_TASK;
    } else if (memory.task === HAULER_DELIVER_TASK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = HAULER_PICKUP_TASK;
    }

    return memory.task;
  }
}
