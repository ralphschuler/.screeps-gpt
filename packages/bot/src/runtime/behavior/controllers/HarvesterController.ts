/**
 * Harvester Role Controller
 *
 * Harvesters are responsible for:
 * - Harvesting energy from sources
 * - Delivering energy to spawns and extensions (priority)
 * - Filling containers when spawns/extensions are full
 * - Upgrading controller as fallback when no delivery targets
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { tryPickupDroppedEnergy } from "./helpers";

// Task constants
const HARVEST_TASK = "harvest" as const;
const DELIVER_TASK = "deliver" as const;
const UPGRADE_TASK = "upgrade" as const;

type HarvesterTask = typeof HARVEST_TASK | typeof DELIVER_TASK | typeof UPGRADE_TASK;

interface HarvesterMemory extends CreepMemory {
  role: "harvester";
  task: HarvesterTask;
  version: number;
}

/**
 * Harvester role controller implementation
 */
export class HarvesterController extends BaseRoleController<HarvesterMemory> {
  public constructor() {
    const config: RoleConfig<HarvesterMemory> = {
      minimum: 4,
      body: [WORK, CARRY, MOVE],
      version: 1,
      createMemory: () => ({
        role: "harvester",
        task: HARVEST_TASK,
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "harvester";
  }

  public execute(creep: CreepLike): string {
    const memory = creep.memory as HarvesterMemory;
    const comm = serviceRegistry.getCommunicationManager();

    // CRITICAL: Check if spawn needs immediate refilling BEFORE any other task
    // This ensures emergency recovery and prevents spawn starvation
    const hasEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
    if (hasEnergy) {
      const spawnsNeedingEnergy = creep.room.find(FIND_MY_STRUCTURES, {
        filter: (structure: AnyStructure) => {
          if (structure.structureType !== STRUCTURE_SPAWN) return false;
          const capacity = structure.store.getCapacity(RESOURCE_ENERGY);
          const current = structure.store.getUsedCapacity(RESOURCE_ENERGY);
          // Spawn is critical if below 50% capacity or below 150 energy (minimum spawn threshold)
          return current < Math.max(150, capacity * 0.5);
        }
      }) as StructureSpawn[];

      if (spawnsNeedingEnergy.length > 0) {
        // FORCE delivery to spawn - override any other task
        memory.task = DELIVER_TASK;
        comm?.say(creep, "🚨spawn");

        const spawn = creep.pos.findClosestByPath(spawnsNeedingEnergy) ?? spawnsNeedingEnergy[0];
        const result = creep.transfer(spawn, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(spawn, { range: 1, reusePath: 10, visualizePathStyle: { stroke: "#ff0000" } });
        }
        return DELIVER_TASK;
      }
    }

    const task = this.ensureTask(memory, creep);

    if (task === HARVEST_TASK) {
      // Communicate status change when transitioning to full
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        comm?.say(creep, "full");
      } else {
        comm?.say(creep, "harvest");
      }

      // Try to pick up dropped energy first
      if (tryPickupDroppedEnergy(creep)) {
        return HARVEST_TASK;
      }

      const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
      const source = sources.length > 0 ? (creep.pos.findClosestByPath(sources) ?? sources[0]) : null;
      if (source) {
        const result = creep.harvest(source);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { range: 1, reusePath: 30 });
        }
      }
      return HARVEST_TASK;
    }

    // Priority 1: Fill spawns and extensions
    comm?.say(creep, "deliver");

    const criticalTargets = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure) =>
        (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
        (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
    }) as AnyStoreStructure[];

    const criticalTarget =
      criticalTargets.length > 0 ? (creep.pos.findClosestByPath(criticalTargets) ?? criticalTargets[0]) : null;
    if (criticalTarget) {
      const result = creep.transfer(criticalTarget, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(criticalTarget, { range: 1, reusePath: 30 });
      }
      return DELIVER_TASK;
    }

    // Priority 2: Fill containers
    const containers = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure) =>
        structure.structureType === STRUCTURE_CONTAINER &&
        (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
    }) as AnyStoreStructure[];

    const container = containers.length > 0 ? (creep.pos.findClosestByPath(containers) ?? containers[0]) : null;
    if (container) {
      const result = creep.transfer(container, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(container, { range: 1, reusePath: 30 });
      }
      return DELIVER_TASK;
    }

    // Priority 3: Upgrade controller
    memory.task = UPGRADE_TASK;
    comm?.say(creep, "upgrade");

    const controller = creep.room.controller;
    if (controller) {
      const upgrade = creep.upgradeController(controller);
      if (upgrade === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { range: 3, reusePath: 30 });
      }
      return UPGRADE_TASK;
    }

    return DELIVER_TASK;
  }

  /**
   * Ensure harvester task is valid and transitions properly between states
   */
  private ensureTask(memory: HarvesterMemory, creep: CreepLike): HarvesterTask {
    if (memory.task !== HARVEST_TASK && memory.task !== DELIVER_TASK && memory.task !== UPGRADE_TASK) {
      memory.task = HARVEST_TASK;
      return memory.task;
    }

    if (memory.task === HARVEST_TASK && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = DELIVER_TASK;
    } else if (memory.task === DELIVER_TASK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = HARVEST_TASK;
    } else if (memory.task === UPGRADE_TASK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = HARVEST_TASK;
    }

    return memory.task;
  }
}
