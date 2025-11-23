/**
 * Builder Role Controller
 *
 * Builders are responsible for:
 * - Gathering energy from containers, storage, or sources
 * - Building construction sites (prioritized by structure type)
 * - Repairing damaged structures
 * - Upgrading controller as fallback
 * - Emergency spawn refilling when needed
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { tryPickupDroppedEnergy, isValidEnergySource } from "./helpers";

// Task constants
const BUILDER_GATHER_TASK = "gather" as const;
const BUILDER_BUILD_TASK = "build" as const;
const BUILDER_MAINTAIN_TASK = "maintain" as const;

type BuilderTask = typeof BUILDER_GATHER_TASK | typeof BUILDER_BUILD_TASK | typeof BUILDER_MAINTAIN_TASK;

interface BuilderMemory extends CreepMemory {
  role: "builder";
  task: BuilderTask;
  version: number;
}

/**
 * Builder role controller implementation
 */
export class BuilderController extends BaseRoleController<BuilderMemory> {
  public constructor() {
    const config: RoleConfig<BuilderMemory> = {
      minimum: 2,
      body: [WORK, CARRY, MOVE, MOVE],
      version: 1,
      createMemory: () => ({
        role: "builder",
        task: BUILDER_GATHER_TASK,
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "builder";
  }

  public execute(creep: CreepLike): string {
    const memory = creep.memory as BuilderMemory;
    const comm = serviceRegistry.getCommunicationManager();
    const energyMgr = serviceRegistry.getEnergyPriorityManager();
    const wallMgr = serviceRegistry.getWallUpgradeManager();

    // CRITICAL: Check if spawn needs immediate refilling BEFORE any other task
    const hasEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
    if (hasEnergy) {
      const spawnsNeedingEnergy = creep.room.find(FIND_MY_STRUCTURES, {
        filter: (structure: AnyStructure) => {
          if (structure.structureType !== STRUCTURE_SPAWN) return false;
          const capacity = structure.store.getCapacity(RESOURCE_ENERGY);
          const current = structure.store.getUsedCapacity(RESOURCE_ENERGY);
          return current < Math.max(150, capacity * 0.5);
        }
      }) as StructureSpawn[];

      if (spawnsNeedingEnergy.length > 0) {
        comm?.say(creep, "🚨spawn");
        const spawn = creep.pos.findClosestByPath(spawnsNeedingEnergy) ?? spawnsNeedingEnergy[0];
        const result = creep.transfer(spawn, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(spawn, { range: 1, reusePath: 10, visualizePathStyle: { stroke: "#ff0000" } });
        }
        return BUILDER_BUILD_TASK; // Return current task to avoid state confusion
      }
    }

    const task = this.ensureTask(memory, creep);

    if (task === BUILDER_GATHER_TASK) {
      comm?.say(creep, "gather");

      // Priority 1: Pick up dropped energy
      if (tryPickupDroppedEnergy(creep)) {
        return BUILDER_GATHER_TASK;
      }

      // Priority 2: Use energy priority manager to get available sources (respecting reserves)
      const energySources = energyMgr
        ? energyMgr.getAvailableEnergySources(creep.room, 0, true)
        : creep.room.find(FIND_STRUCTURES, {
            filter: isValidEnergySource
          });

      const target = energySources.length > 0 ? (creep.pos.findClosestByPath(energySources) ?? energySources[0]) : null;
      if (target) {
        const result = creep.withdraw(target, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { range: 1, reusePath: 30 });
        }
        return BUILDER_GATHER_TASK;
      }

      // Priority 3: Harvest from sources directly if no other options
      const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
      const source = sources.length > 0 ? (creep.pos.findClosestByPath(sources) ?? sources[0]) : null;
      if (source) {
        const harvestResult = creep.harvest(source);
        if (harvestResult === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { range: 1, reusePath: 30 });
        }
      }

      return BUILDER_GATHER_TASK;
    }

    if (task === BUILDER_BUILD_TASK) {
      comm?.say(creep, "build");

      // Prioritize construction sites by structure type
      const constructionPriorities = [
        STRUCTURE_SPAWN,
        STRUCTURE_EXTENSION,
        STRUCTURE_TOWER,
        STRUCTURE_CONTAINER,
        STRUCTURE_STORAGE,
        STRUCTURE_ROAD, // Roads lower priority but still automated
        STRUCTURE_RAMPART,
        STRUCTURE_WALL
      ];

      const sites = creep.room.find(FIND_CONSTRUCTION_SITES) as ConstructionSite[];

      // Find highest priority site
      let site: ConstructionSite | null = null;
      for (const structureType of constructionPriorities) {
        const prioritySites = sites.filter(s => s.structureType === structureType);
        if (prioritySites.length > 0) {
          site = creep.pos.findClosestByPath(prioritySites) ?? prioritySites[0];
          break;
        }
      }

      if (site) {
        const result = creep.build(site);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(site, { range: 3, reusePath: 30 });
        }
        return BUILDER_BUILD_TASK;
      }

      memory.task = BUILDER_MAINTAIN_TASK;
    }

    // Maintain (repair/upgrade) fallback
    comm?.say(creep, "repair");

    const targetHits = wallMgr?.getTargetHits(creep.room) ?? 0;
    const repairTargets = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure) => {
        if (!("hits" in structure) || typeof structure.hits !== "number") {
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

    const target = repairTargets.length > 0 ? (creep.pos.findClosestByPath(repairTargets) ?? repairTargets[0]) : null;
    if (target) {
      const result = creep.repair(target);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 3, reusePath: 30 });
      }
      return BUILDER_MAINTAIN_TASK;
    }

    const controller = creep.room.controller;
    if (controller) {
      const upgrade = creep.upgradeController(controller);
      if (upgrade === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { range: 3, reusePath: 30 });
      }
    }

    return BUILDER_MAINTAIN_TASK;
  }

  /**
   * Ensure builder task is valid and transitions properly between states
   */
  private ensureTask(memory: BuilderMemory, creep: CreepLike): BuilderTask {
    if (
      memory.task !== BUILDER_GATHER_TASK &&
      memory.task !== BUILDER_BUILD_TASK &&
      memory.task !== BUILDER_MAINTAIN_TASK
    ) {
      memory.task = BUILDER_GATHER_TASK;
      return memory.task;
    }

    if (memory.task === BUILDER_GATHER_TASK && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = BUILDER_BUILD_TASK;
    } else if (memory.task !== BUILDER_GATHER_TASK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = BUILDER_GATHER_TASK;
    }

    return memory.task;
  }
}
