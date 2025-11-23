/**
 * Repairer Role Controller
 *
 * Repairers are responsible for:
 * - Gathering energy from containers or storage
 * - Repairing infrastructure (roads, containers) at 50% health
 * - Repairing other damaged structures
 * - Prioritizing source containers over other repairs
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { tryPickupDroppedEnergy, findClosestOrFirst, isValidEnergySource } from "./helpers";

// Task constants
const REPAIRER_GATHER_TASK = "repairerGather" as const;
const REPAIRER_REPAIR_TASK = "repair" as const;

type RepairerTask = typeof REPAIRER_GATHER_TASK | typeof REPAIRER_REPAIR_TASK;

interface RepairerMemory extends CreepMemory {
  role: "repairer";
  task: RepairerTask;
  version: number;
}

/**
 * Repairer role controller implementation
 */
export class RepairerController extends BaseRoleController<RepairerMemory> {
  public constructor() {
    const config: RoleConfig<RepairerMemory> = {
      minimum: 0,
      body: [WORK, WORK, CARRY, MOVE, MOVE],
      version: 1,
      createMemory: () => ({
        role: "repairer",
        task: REPAIRER_GATHER_TASK,
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "repairer";
  }

  public execute(creep: CreepLike): string {
    const memory = creep.memory as RepairerMemory;
    const task = this.ensureTask(memory, creep);
    const comm = serviceRegistry.getCommunicationManager();
    const energyMgr = serviceRegistry.getEnergyPriorityManager();
    const wallMgr = serviceRegistry.getWallUpgradeManager();

    if (task === REPAIRER_GATHER_TASK) {
      comm?.say(creep, "gather");

      // Use energy priority manager to get available sources (respecting reserves)
      const energySources = energyMgr
        ? energyMgr.getAvailableEnergySources(creep.room, 50, true)
        : creep.room.find(FIND_STRUCTURES, {
            filter: s => isValidEnergySource(s, 50)
          });

      const target = findClosestOrFirst(creep, energySources);
      if (target) {
        const result = creep.withdraw(target, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { range: 1, reusePath: 30 });
        }
        return REPAIRER_GATHER_TASK;
      }

      // Priority 2: Pick up dropped energy
      if (tryPickupDroppedEnergy(creep)) {
        return REPAIRER_GATHER_TASK;
      }

      // Priority 3: Harvest from sources directly if no other options
      const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
      const source = findClosestOrFirst(creep, sources);
      if (source) {
        const harvestResult = creep.harvest(source);
        if (harvestResult === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { range: 1, reusePath: 30 });
        }
      }

      return REPAIRER_GATHER_TASK;
    }

    // REPAIRER_REPAIR_TASK
    comm?.say(creep, "repair");

    // Priority 1: Roads and containers (infrastructure)
    const infrastructureTargets = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure) => {
        if (!("hits" in structure) || typeof structure.hits !== "number") {
          return false;
        }

        // Prioritize roads when below 50% health
        if (structure.structureType === STRUCTURE_ROAD) {
          return structure.hits < structure.hitsMax * 0.5;
        }

        // Prioritize containers when below 50% health
        if (structure.structureType === STRUCTURE_CONTAINER) {
          return structure.hits < structure.hitsMax * 0.5;
        }

        return false;
      }
    }) as Structure[];

    // Sort infrastructure targets to prioritize source containers
    const sources = creep.room.find(FIND_SOURCES) as Source[];
    if (infrastructureTargets.length > 1) {
      infrastructureTargets.sort((a, b) => {
        const isAContainer = a.structureType === STRUCTURE_CONTAINER;
        const isBContainer = b.structureType === STRUCTURE_CONTAINER;

        // Both are containers - prioritize by proximity to sources
        if (isAContainer && isBContainer) {
          const aNearSource = sources.some(s => s.pos.inRangeTo(a.pos, 2));
          const bNearSource = sources.some(s => s.pos.inRangeTo(b.pos, 2));

          if (aNearSource && !bNearSource) return -1;
          if (!aNearSource && bNearSource) return 1;

          const aDist = creep.pos.getRangeTo(a.pos);
          const bDist = creep.pos.getRangeTo(b.pos);
          return aDist - bDist;
        }

        // Containers prioritized over roads
        if (isAContainer && !isBContainer) return -1;
        if (!isAContainer && isBContainer) return 1;

        // Both are same type - use distance
        const aDist = creep.pos.getRangeTo(a.pos);
        const bDist = creep.pos.getRangeTo(b.pos);
        return aDist - bDist;
      });
    }

    if (infrastructureTargets.length > 0) {
      const target = creep.pos.findClosestByPath(infrastructureTargets) ?? infrastructureTargets[0];
      if (target) {
        const result = creep.repair(target);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { range: 3, reusePath: 30 });
        }
        return REPAIRER_REPAIR_TASK;
      }
    }

    // Priority 2: Other structures (excluding walls and ramparts)
    const targetHits = wallMgr?.getTargetHits(creep.room) ?? 0;
    const repairTargets = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure) => {
        if (!("hits" in structure) || typeof structure.hits !== "number") {
          return false;
        }

        // Skip infrastructure (already handled above)
        if (structure.structureType === STRUCTURE_ROAD || structure.structureType === STRUCTURE_CONTAINER) {
          return false;
        }

        if (structure.structureType === STRUCTURE_WALL) {
          return structure.hits < targetHits;
        }

        if (structure.structureType === STRUCTURE_RAMPART) {
          return structure.hits < targetHits;
        }

        return structure.hits < structure.hitsMax;
      }
    }) as Structure[];

    const target = findClosestOrFirst(creep, repairTargets);
    if (target) {
      const result = creep.repair(target);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 3, reusePath: 30 });
      }
      return REPAIRER_REPAIR_TASK;
    }

    // No repairs needed, upgrade controller as fallback
    const controller = creep.room.controller;
    if (controller) {
      const upgrade = creep.upgradeController(controller);
      if (upgrade === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { range: 3, reusePath: 30 });
      }
    }

    return REPAIRER_REPAIR_TASK;
  }

  /**
   * Ensure repairer task is valid and transitions properly between states
   */
  private ensureTask(memory: RepairerMemory, creep: CreepLike): RepairerTask {
    if (memory.task !== REPAIRER_GATHER_TASK && memory.task !== REPAIRER_REPAIR_TASK) {
      memory.task = REPAIRER_GATHER_TASK;
      return memory.task;
    }

    if (memory.task === REPAIRER_GATHER_TASK && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = REPAIRER_REPAIR_TASK;
    } else if (memory.task === REPAIRER_REPAIR_TASK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = REPAIRER_GATHER_TASK;
    }

    return memory.task;
  }
}
