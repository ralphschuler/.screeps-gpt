import type { CreepDecisionContext } from "./types.js";

/**
 * Helper function to create a standard creep decision context.
 * Gathers common information needed for creep decision making.
 *
 * @param creep - The creep to create context for
 * @returns A populated CreepDecisionContext
 */
export function createCreepContext(creep: Creep): CreepDecisionContext {
  const room = creep.room;

  return {
    creep,
    room,
    energyAvailable: room.find(FIND_SOURCES).length > 0,
    nearbyEnemies: creep.pos.findInRange(FIND_HOSTILE_CREEPS, 10).length > 0,
    constructionSites: room.find(FIND_MY_CONSTRUCTION_SITES).length,
    damagedStructures: room.find(FIND_STRUCTURES, {
      filter: s => s.hits < s.hitsMax
    }).length
  };
}

/**
 * Common condition helpers for creep decisions.
 */
export const CreepConditions = {
  /** Check if creep has free capacity for energy */
  hasFreeCapacity: (ctx: CreepDecisionContext): boolean => {
    return ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
  },

  /** Check if creep is full of energy */
  isFull: (ctx: CreepDecisionContext): boolean => {
    return ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0;
  },

  /** Check if creep is empty */
  isEmpty: (ctx: CreepDecisionContext): boolean => {
    return ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0;
  },

  /** Check if creep is damaged */
  isDamaged: (ctx: CreepDecisionContext): boolean => {
    return ctx.creep.hits < ctx.creep.hitsMax;
  },

  /** Check if construction sites are available */
  hasConstructionSites: (ctx: CreepDecisionContext): boolean => {
    return ctx.constructionSites > 0;
  },

  /** Check if structures need repair */
  hasRepairTargets: (ctx: CreepDecisionContext): boolean => {
    return ctx.damagedStructures > 0;
  },

  /** Check if enemies are nearby */
  enemiesNearby: (ctx: CreepDecisionContext): boolean => {
    return ctx.nearbyEnemies;
  },

  /** Check if energy sources are available */
  hasEnergySources: (ctx: CreepDecisionContext): boolean => {
    return ctx.energyAvailable;
  }
};
