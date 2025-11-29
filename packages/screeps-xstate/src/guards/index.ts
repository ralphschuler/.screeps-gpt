/**
 * Modular guards for screeps-xstate.
 *
 * This module provides reusable, testable guard functions for common
 * creep behavior patterns. Guards are pure functions that evaluate
 * conditions based on the provided context.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { guards } from '@ralphschuler/screeps-xstate';
 *
 * // Use in state machine transitions
 * const states = {
 *   harvesting: {
 *     on: {
 *       TICK: {
 *         target: 'delivering',
 *         guard: guards.isFull
 *       }
 *     }
 *   }
 * };
 *
 * // Create parameterized guards
 * const hasEnough = guards.hasEnergy(50);
 * ```
 */

// Type definitions
export type { CreepContext, CreepGuard, CreepGuardFactory } from "./types.js";

// Energy guards
export { hasEnergy, isFull, isEmpty, hasFreeCapacity, hasCapacityPercent } from "./energy.js";

// Position guards
export { isNearTarget, isAtTarget, hasTarget, isInRoom, isNearExit, isAtExit } from "./position.js";

// Creep guards
export {
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
  hasActiveBodyPart,
  hasRole,
  hasRoleType
} from "./creep.js";

// Import all for registry
import { hasEnergy, isFull, isEmpty, hasFreeCapacity, hasCapacityPercent } from "./energy.js";

import { isNearTarget, isAtTarget, hasTarget, isInRoom, isNearExit, isAtExit } from "./position.js";

import {
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
  hasActiveBodyPart,
  hasRole,
  hasRoleType
} from "./creep.js";

/**
 * Registry of all modular guards for easy access.
 *
 * @example
 * ```typescript
 * import { guards } from '@ralphschuler/screeps-xstate';
 *
 * // Access guards from registry
 * const guard = guards.isFull;
 * const paramGuard = guards.hasEnergy(50);
 * ```
 */
export const guards = {
  // Energy guards
  hasEnergy,
  isFull,
  isEmpty,
  hasFreeCapacity,
  hasCapacityPercent,

  // Position guards
  isNearTarget,
  isAtTarget,
  hasTarget,
  isInRoom,
  isNearExit,
  isAtExit,

  // Creep guards
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
  hasActiveBodyPart,
  hasRole,
  hasRoleType
};
