/**
 * Upgrader Role Controller
 *
 * Upgraders are responsible for:
 * - Gathering energy from containers, storage, or sources
 * - Upgrading the room controller
 * - Emergency spawn refilling when needed
 * - Pausing during defensive postures
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { tryPickupDroppedEnergy, isValidEnergySource } from "./helpers";

// Task constants
const RECHARGE_TASK = "recharge" as const;
const UPGRADE_TASK = "upgrade" as const;

type UpgraderTask = typeof RECHARGE_TASK | typeof UPGRADE_TASK;

interface UpgraderMemory extends CreepMemory {
  role: "upgrader";
  task: UpgraderTask;
  version: number;
}

/**
 * Upgrader role controller implementation
 */
export class UpgraderController extends BaseRoleController<UpgraderMemory> {
  public constructor() {
    const config: RoleConfig<UpgraderMemory> = {
      minimum: 3,
      body: [WORK, CARRY, MOVE],
      version: 1,
      createMemory: () => ({
        role: "upgrader",
        task: RECHARGE_TASK,
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "upgrader";
  }

  public execute(creep: CreepLike): string {
    const memory = creep.memory as UpgraderMemory;
    const comm = serviceRegistry.getCommunicationManager();
    const energyMgr = serviceRegistry.getEnergyPriorityManager();

    // Check if room is under defensive posture - pause upgrading during combat
    const roomPosture = Memory.defense?.posture[creep.room.name];
    const shouldPauseUpgrading = roomPosture === "defensive" || roomPosture === "emergency";

    if (shouldPauseUpgrading) {
      // During combat, upgraders move to a safe position and pause upgrading
      comm?.say(creep, "🛡️");
      // Move to a safe position near storage/spawn
      let safeSpot: { pos: RoomPosition } | undefined;
      if (creep.room.storage) {
        safeSpot = creep.room.storage;
      } else {
        const spawns = creep.room.find(FIND_MY_SPAWNS) as StructureSpawn[];
        safeSpot = spawns[0];
      }
      if (safeSpot && !creep.pos.inRangeTo(safeSpot, 3)) {
        void creep.moveTo(safeSpot, { range: 3, reusePath: 10 });
      }
      return UPGRADE_TASK; // Keep task state but don't upgrade
    }

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
        return UPGRADE_TASK; // Return current task to avoid state confusion
      }
    }

    const task = this.ensureTask(memory, creep);

    if (task === RECHARGE_TASK) {
      comm?.say(creep, "gather");

      // Priority 1: Pick up dropped energy
      if (tryPickupDroppedEnergy(creep)) {
        return RECHARGE_TASK;
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
        return RECHARGE_TASK;
      }

      // Priority 3: Harvest from sources directly if no other options
      const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
      const source = sources.length > 0 ? (creep.pos.findClosestByPath(sources) ?? sources[0]) : null;
      if (source) {
        const result = creep.harvest(source);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { range: 1, reusePath: 30 });
        }
      }
      return RECHARGE_TASK;
    }

    comm?.say(creep, "upgrade");

    const controller = creep.room.controller;
    if (controller) {
      const result = creep.upgradeController(controller);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { range: 3, reusePath: 30 });
      }
      return UPGRADE_TASK;
    }

    return RECHARGE_TASK;
  }

  /**
   * Ensure upgrader task is valid and transitions properly between states
   */
  private ensureTask(memory: UpgraderMemory, creep: CreepLike): UpgraderTask {
    if (memory.task !== RECHARGE_TASK && memory.task !== UPGRADE_TASK) {
      memory.task = RECHARGE_TASK;
      return memory.task;
    }

    if (memory.task === RECHARGE_TASK && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = UPGRADE_TASK;
    } else if (memory.task === UPGRADE_TASK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = RECHARGE_TASK;
    }

    return memory.task;
  }
}
