/**
 * Swarm-specific conditions for decision trees.
 * These are used to build composable behavior trees for creep roles.
 *
 * @packageDocumentation
 */

import type { SwarmCreepContext } from "./types.js";

// Energy conditions

/** Checks if creep has energy capacity */
export const hasEnergy = (ctx: SwarmCreepContext): boolean => ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0;

/** Checks if creep is full */
export const isFull = (ctx: SwarmCreepContext): boolean => ctx.creep.store.getFreeCapacity() === 0;

/** Checks if creep is empty */
export const isEmpty = (ctx: SwarmCreepContext): boolean => ctx.creep.store.getUsedCapacity() === 0;

/** Checks if creep has free capacity */
export const hasFreeCapacity = (ctx: SwarmCreepContext): boolean => ctx.creep.store.getFreeCapacity() > 0;

/** Checks if storage has sufficient energy */
export const storageHasEnergy =
  (threshold = 200) =>
  (ctx: SwarmCreepContext): boolean =>
    ctx.storageEnergy > threshold;

// Room conditions

/** Checks if creep is in target room */
export const isInTargetRoom = (ctx: SwarmCreepContext): boolean =>
  !ctx.targetRoom || ctx.creep.room.name === ctx.targetRoom;

/** Checks if creep is in home room */
export const isInHomeRoom = (ctx: SwarmCreepContext): boolean => ctx.creep.room.name === ctx.homeRoom;

/** Checks if construction sites exist */
export const hasConstructionSites = (ctx: SwarmCreepContext): boolean => ctx.constructionSites > 0;

/** Checks if damaged structures exist */
export const hasDamagedStructures = (ctx: SwarmCreepContext): boolean => ctx.damagedStructures > 0;

/** Checks if enemies are nearby */
export const hasEnemies = (ctx: SwarmCreepContext): boolean => ctx.nearbyEnemies;

/** Checks if energy sources are available */
export const hasEnergySources = (ctx: SwarmCreepContext): boolean => ctx.energyAvailable;

// Structure conditions

/** Checks if terminal exists in room */
export const hasTerminal = (ctx: SwarmCreepContext): boolean => ctx.hasTerminal;

/** Checks if extractor exists in room */
export const hasExtractor = (ctx: SwarmCreepContext): boolean => ctx.hasExtractor;

/** Checks if mineral is available */
export const hasMinerals = (ctx: SwarmCreepContext): boolean => ctx.mineralAmount > 0;

// Spawn/extension energy needs

/** Checks if spawns/extensions need energy */
export const spawnsNeedEnergy = (ctx: SwarmCreepContext): boolean => {
  const targets = ctx.room.find(FIND_MY_STRUCTURES, {
    filter: s =>
      (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
      (s as StructureSpawn | StructureExtension).store.getFreeCapacity(RESOURCE_ENERGY) > 0
  });
  return targets.length > 0;
};

/** Checks if towers need energy */
export const towersNeedEnergy = (ctx: SwarmCreepContext): boolean => {
  const towers = ctx.room.find(FIND_MY_STRUCTURES, {
    filter: s =>
      s.structureType === STRUCTURE_TOWER && (s as StructureTower).store.getFreeCapacity(RESOURCE_ENERGY) > 100
  });
  return towers.length > 0;
};

/** Checks if terminal needs energy */
export const terminalNeedsEnergy = (ctx: SwarmCreepContext): boolean => {
  const terminal = ctx.room.terminal;
  return !!terminal && terminal.store.getUsedCapacity(RESOURCE_ENERGY) < 15000;
};

/** Checks if containers have energy */
export const containersHaveEnergy = (ctx: SwarmCreepContext): boolean => {
  const containers = ctx.room.find(FIND_STRUCTURES, {
    filter: s =>
      s.structureType === STRUCTURE_CONTAINER && (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 100
  });
  return containers.length > 0;
};

// Creep state conditions

/** Checks if creep is damaged */
export const isDamaged = (ctx: SwarmCreepContext): boolean => ctx.creep.hits < ctx.creep.hitsMax;

/** Checks if creep is low health */
export const isLowHealth =
  (threshold = 0.5) =>
  (ctx: SwarmCreepContext): boolean =>
    ctx.creep.hits / ctx.creep.hitsMax < threshold;

// Deposit and highway conditions

/** Checks if deposits exist in room */
export const hasDeposits = (ctx: SwarmCreepContext): boolean => {
  const deposits = ctx.room.find(FIND_DEPOSITS);
  return deposits.length > 0 && deposits.some(d => d.ticksToDecay > 50);
};

/** Checks if deposit cooldown is acceptable */
export const depositCooldownOk =
  (threshold = 90) =>
  (ctx: SwarmCreepContext): boolean => {
    const deposit = ctx.room.find(FIND_DEPOSITS)[0];
    return !!deposit && deposit.lastCooldown <= threshold;
  };

// Power conditions

/** Checks if power spawn needs power */
export const powerSpawnNeedsPower = (ctx: SwarmCreepContext): boolean => {
  const powerSpawn = ctx.room.find(FIND_MY_STRUCTURES, {
    filter: { structureType: STRUCTURE_POWER_SPAWN }
  })[0] as StructurePowerSpawn | undefined;
  return !!powerSpawn && powerSpawn.store.getUsedCapacity(RESOURCE_POWER) < 50;
};

/** Checks if power spawn needs energy */
export const powerSpawnNeedsEnergy = (ctx: SwarmCreepContext): boolean => {
  const powerSpawn = ctx.room.find(FIND_MY_STRUCTURES, {
    filter: { structureType: STRUCTURE_POWER_SPAWN }
  })[0] as StructurePowerSpawn | undefined;
  return !!powerSpawn && powerSpawn.store.getFreeCapacity(RESOURCE_ENERGY) > 200;
};

/** Checks if dropped power exists */
export const hasDroppedPower = (ctx: SwarmCreepContext): boolean => {
  const power = ctx.creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
    filter: r => r.resourceType === RESOURCE_POWER
  });
  return !!power;
};

// Lab conditions

/** Checks if labs need energy */
export const labsNeedEnergy = (ctx: SwarmCreepContext): boolean => {
  const labs = ctx.room.find(FIND_MY_STRUCTURES, {
    filter: { structureType: STRUCTURE_LAB }
  }) as StructureLab[];
  return labs.some(l => l.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
};

// Factory conditions

/** Checks if factory needs energy */
export const factoryNeedsEnergy = (ctx: SwarmCreepContext): boolean => {
  const factory = ctx.room.find(FIND_MY_STRUCTURES, {
    filter: { structureType: STRUCTURE_FACTORY }
  })[0] as StructureFactory | undefined;
  return !!factory && factory.store.getFreeCapacity() > 0;
};

// Controller conditions

/** Checks if controller needs upgrading (is owned by us) */
export const controllerNeedsUpgrade = (ctx: SwarmCreepContext): boolean => !!ctx.room.controller?.my;

/** Checks if controller is downgrading soon */
export const controllerDowngradingSoon =
  (threshold = 3000) =>
  (ctx: SwarmCreepContext): boolean =>
    !!ctx.room.controller && (ctx.room.controller.ticksToDowngrade ?? 20000) < threshold;

// Link conditions

/** Checks if links need energy */
export const linksNeedEnergy = (ctx: SwarmCreepContext): boolean => {
  const links = ctx.room.find(FIND_MY_STRUCTURES, {
    filter: { structureType: STRUCTURE_LINK }
  }) as StructureLink[];
  return links.some(l => l.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
};

/**
 * Registry of all swarm conditions for easy access.
 */
export const swarmConditions = {
  hasEnergy,
  isFull,
  isEmpty,
  hasFreeCapacity,
  storageHasEnergy,
  isInTargetRoom,
  isInHomeRoom,
  hasConstructionSites,
  hasDamagedStructures,
  hasEnemies,
  hasEnergySources,
  hasTerminal,
  hasExtractor,
  hasMinerals,
  spawnsNeedEnergy,
  towersNeedEnergy,
  terminalNeedsEnergy,
  containersHaveEnergy,
  isDamaged,
  isLowHealth,
  hasDeposits,
  depositCooldownOk,
  powerSpawnNeedsPower,
  powerSpawnNeedsEnergy,
  hasDroppedPower,
  labsNeedEnergy,
  factoryNeedsEnergy,
  controllerNeedsUpgrade,
  controllerDowngradingSoon,
  linksNeedEnergy
};
