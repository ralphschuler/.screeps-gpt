/**
 * Modular conditions for screeps-xtree decision trees.
 *
 * This module provides reusable condition functions that parallel
 * the guards in screeps-xstate. Conditions are pure functions that
 * evaluate to boolean for decision tree branching.
 *
 * @packageDocumentation
 */

import type { CreepDecisionContext } from "./types.js";
import type { Condition, ConditionFactory, CreepConditionContext } from "./conditionTypes.js";

// Energy conditions

/**
 * Creates a condition that checks if the creep has energy above a threshold.
 *
 * @param threshold - Minimum energy amount (default: 0)
 * @returns Condition function that returns true if creep has energy above threshold
 */
export const hasEnergy: ConditionFactory<number | undefined, CreepDecisionContext> =
  (threshold = 0) =>
  ctx =>
    ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) > threshold;

/**
 * Condition that checks if the creep's energy store is full.
 */
export const isFull: Condition<CreepDecisionContext> = ctx =>
  ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0;

/**
 * Condition that checks if the creep's energy store is empty.
 */
export const isEmpty: Condition<CreepDecisionContext> = ctx =>
  ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0;

/**
 * Condition that checks if the creep has free capacity for energy.
 */
export const hasFreeCapacity: Condition<CreepDecisionContext> = ctx =>
  ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0;

/**
 * Creates a condition that checks if the creep has at least a certain percentage of capacity filled.
 *
 * @param percentage - Percentage of capacity (0-100)
 */
export const hasCapacityPercent: ConditionFactory<number, CreepDecisionContext> = percentage => ctx => {
  const capacity = ctx.creep.store.getCapacity(RESOURCE_ENERGY);
  if (capacity === 0 || capacity === null) return false;
  const used = ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY);
  return (used / capacity) * 100 >= percentage;
};

// Position conditions

/**
 * Creates a condition that checks if the creep is within range of its target.
 *
 * @param range - Maximum distance to target (default: 1)
 */
export const isNearTarget: ConditionFactory<number | undefined, CreepConditionContext> =
  (range = 1) =>
  ctx => {
    if (!ctx.target) return false;
    const targetPos = "pos" in ctx.target ? ctx.target.pos : ctx.target;
    return ctx.creep.pos.getRangeTo(targetPos) <= range;
  };

/**
 * Condition that checks if the creep is at the exact position of its target.
 */
export const isAtTarget: Condition<CreepConditionContext> = ctx => {
  if (!ctx.target) return false;
  const targetPos = "pos" in ctx.target ? ctx.target.pos : ctx.target;
  return ctx.creep.pos.isEqualTo(targetPos);
};

/**
 * Condition that checks if the creep has a target assigned.
 */
export const hasTarget: Condition<CreepConditionContext> = ctx => ctx.target != null;

/**
 * Creates a condition that checks if the creep is in a specific room.
 *
 * @param roomName - Name of the room to check
 */
export const isInRoom: ConditionFactory<string, CreepDecisionContext> = roomName => ctx =>
  ctx.creep.room.name === roomName;

/**
 * Condition that checks if the creep is near a room exit.
 */
export const isNearExit: Condition<CreepDecisionContext> = ctx => {
  const { x, y } = ctx.creep.pos;
  return x <= 2 || x >= 47 || y <= 2 || y >= 47;
};

/**
 * Condition that checks if the creep is at a room exit.
 */
export const isAtExit: Condition<CreepDecisionContext> = ctx => {
  const { x, y } = ctx.creep.pos;
  return x === 0 || x === 49 || y === 0 || y === 49;
};

// Creep conditions

/**
 * Creates a condition that checks if the creep has a specific body part.
 *
 * @param part - Body part constant to check for
 */
export const hasBodyPart: ConditionFactory<BodyPartConstant, CreepDecisionContext> = part => ctx =>
  ctx.creep.body.some(p => p.type === part);

/** Condition that checks if the creep has WORK body parts. */
export const hasWorkParts: Condition<CreepDecisionContext> = hasBodyPart(WORK);

/** Condition that checks if the creep has CARRY body parts. */
export const hasCarryParts: Condition<CreepDecisionContext> = hasBodyPart(CARRY);

/** Condition that checks if the creep has MOVE body parts. */
export const hasMoveParts: Condition<CreepDecisionContext> = hasBodyPart(MOVE);

/** Condition that checks if the creep has ATTACK body parts. */
export const hasAttackParts: Condition<CreepDecisionContext> = hasBodyPart(ATTACK);

/** Condition that checks if the creep has RANGED_ATTACK body parts. */
export const hasRangedAttackParts: Condition<CreepDecisionContext> = hasBodyPart(RANGED_ATTACK);

/** Condition that checks if the creep has HEAL body parts. */
export const hasHealParts: Condition<CreepDecisionContext> = hasBodyPart(HEAL);

/** Condition that checks if the creep has CLAIM body parts. */
export const hasClaimParts: Condition<CreepDecisionContext> = hasBodyPart(CLAIM);

/**
 * Condition that checks if the creep is damaged.
 */
export const isDamaged: Condition<CreepDecisionContext> = ctx => ctx.creep.hits < ctx.creep.hitsMax;

/**
 * Creates a condition that checks if the creep's health is below a percentage.
 *
 * @param percentage - Health percentage threshold (0-100)
 */
export const isHealthBelow: ConditionFactory<number, CreepDecisionContext> = percentage => ctx =>
  (ctx.creep.hits / ctx.creep.hitsMax) * 100 < percentage;

/**
 * Condition that checks if the creep is still spawning.
 */
export const isSpawning: Condition<CreepDecisionContext> = ctx => ctx.creep.spawning;

/**
 * Creates a condition that checks if the creep has at least a certain number of a body part.
 *
 * @param part - Body part constant to count
 * @param count - Minimum number required
 */
export const hasMinBodyParts: ConditionFactory<{ part: BodyPartConstant; count: number }, CreepDecisionContext> =
  ({ part, count }) =>
  ctx =>
    ctx.creep.body.filter(p => p.type === part).length >= count;

/**
 * Creates a condition that checks if the creep has a specific role.
 *
 * @param role - Role name to check
 */
export const hasRoleType: ConditionFactory<string, CreepDecisionContext> = role => ctx =>
  (ctx.creep.memory as { role?: string })?.role === role;

// Room conditions (from existing CreepDecisionContext)

/**
 * Condition that checks if construction sites are available.
 */
export const hasConstructionSites: Condition<CreepDecisionContext> = ctx => ctx.constructionSites > 0;

/**
 * Condition that checks if structures need repair.
 */
export const hasRepairTargets: Condition<CreepDecisionContext> = ctx => ctx.damagedStructures > 0;

/**
 * Condition that checks if enemies are nearby.
 */
export const enemiesNearby: Condition<CreepDecisionContext> = ctx => ctx.nearbyEnemies;

/**
 * Condition that checks if energy sources are available.
 */
export const hasEnergySources: Condition<CreepDecisionContext> = ctx => ctx.energyAvailable;

/**
 * Registry of all modular conditions for easy access.
 */
export const conditions = {
  // Energy conditions
  hasEnergy,
  isFull,
  isEmpty,
  hasFreeCapacity,
  hasCapacityPercent,

  // Position conditions
  isNearTarget,
  isAtTarget,
  hasTarget,
  isInRoom,
  isNearExit,
  isAtExit,

  // Creep conditions
  hasBodyPart,
  hasWorkParts,
  hasCarryParts,
  hasMoveParts,
  hasAttackParts,
  hasRangedAttackParts,
  hasHealParts,
  hasClaimParts,
  isDamaged,
  isHealthBelow,
  isSpawning,
  hasMinBodyParts,
  hasRoleType,

  // Room conditions
  hasConstructionSites,
  hasRepairTargets,
  enemiesNearby,
  hasEnergySources
};
