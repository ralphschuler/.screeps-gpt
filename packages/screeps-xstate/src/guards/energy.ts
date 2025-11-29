/**
 * Energy-related guards for creep behavior.
 *
 * @packageDocumentation
 */

import type { CreepContext, CreepGuard, CreepGuardFactory } from "./types.js";

/**
 * Creates a guard that checks if the creep has energy above a threshold.
 *
 * @param threshold - Minimum energy amount (default: 0)
 * @returns Guard function that returns true if creep has energy above threshold
 *
 * @example
 * ```typescript
 * const hasEnergy50 = hasEnergy(50);
 * if (hasEnergy50({ creep })) {
 *   // Creep has more than 50 energy
 * }
 * ```
 */
export const hasEnergy: CreepGuardFactory<number | undefined, CreepContext> =
  (threshold = 0) =>
  ctx =>
    ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) > threshold;

/**
 * Guard that checks if the creep's energy store is full.
 *
 * @param ctx - Creep context
 * @returns true if creep has no free capacity for energy
 *
 * @example
 * ```typescript
 * if (isFull({ creep })) {
 *   // Creep is full of energy
 * }
 * ```
 */
export const isFull: CreepGuard = ctx => ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0;

/**
 * Guard that checks if the creep's energy store is empty.
 *
 * @param ctx - Creep context
 * @returns true if creep has no energy
 *
 * @example
 * ```typescript
 * if (isEmpty({ creep })) {
 *   // Creep has no energy
 * }
 * ```
 */
export const isEmpty: CreepGuard = ctx => ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0;

/**
 * Guard that checks if the creep has free capacity for energy.
 *
 * @param ctx - Creep context
 * @returns true if creep can carry more energy
 *
 * @example
 * ```typescript
 * if (hasFreeCapacity({ creep })) {
 *   // Creep can pick up more energy
 * }
 * ```
 */
export const hasFreeCapacity: CreepGuard = ctx => ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0;

/**
 * Creates a guard that checks if the creep has at least a certain percentage of capacity filled.
 *
 * @param percentage - Percentage of capacity (0-100)
 * @returns Guard function that returns true if creep has at least that percentage filled
 *
 * @example
 * ```typescript
 * const halfFull = hasCapacityPercent(50);
 * if (halfFull({ creep })) {
 *   // Creep is at least 50% full
 * }
 * ```
 */
export const hasCapacityPercent: CreepGuardFactory<number, CreepContext> = percentage => ctx => {
  const capacity = ctx.creep.store.getCapacity(RESOURCE_ENERGY);
  if (capacity === 0 || capacity === null) return false;
  const used = ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY);
  return (used / capacity) * 100 >= percentage;
};
