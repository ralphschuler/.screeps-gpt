/**
 * Modular actions for screeps-xstate.
 *
 * This module provides reusable action functions for common
 * creep behavior patterns. Actions can modify context and
 * execute creep commands.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { creepActions } from '@ralphschuler/screeps-xstate';
 *
 * // Use in state machine transitions
 * const states = {
 *   harvesting: {
 *     onEntry: [creepActions.harvestSource],
 *     on: {
 *       TICK: {
 *         target: 'delivering',
 *         actions: [creepActions.transferToSpawns()]
 *       }
 *     }
 *   }
 * };
 * ```
 */

// Type definitions
export type { CreepActionContext, CreepAction, CreepActionFactory, MoveToOptions } from "./types.js";

// Movement actions
export { moveToTarget, moveToTargetDefault, findClosestByPath, findInRange, moveToRoom, flee } from "./movement.js";

// Energy actions
export {
  harvestSource,
  harvestNearestSource,
  transferEnergy,
  withdrawEnergy,
  pickupEnergy,
  pickupNearestEnergy,
  transferToSpawns,
  withdrawFromContainers
} from "./energy.js";

// Work actions
export {
  upgradeController,
  buildStructure,
  repairStructure,
  repairToThreshold,
  claimController,
  reserveController,
  signController,
  attackTarget,
  rangedAttackTarget,
  healTarget,
  dismantleStructure
} from "./work.js";

// Import all for registry
import { moveToTarget, moveToTargetDefault, findClosestByPath, findInRange, moveToRoom, flee } from "./movement.js";

import {
  harvestSource,
  harvestNearestSource,
  transferEnergy,
  withdrawEnergy,
  pickupEnergy,
  pickupNearestEnergy,
  transferToSpawns,
  withdrawFromContainers
} from "./energy.js";

import {
  upgradeController,
  buildStructure,
  repairStructure,
  repairToThreshold,
  claimController,
  reserveController,
  signController,
  attackTarget,
  rangedAttackTarget,
  healTarget,
  dismantleStructure
} from "./work.js";

/**
 * Registry of all modular creep actions for easy access.
 *
 * @example
 * ```typescript
 * import { creepActions } from '@ralphschuler/screeps-xstate';
 *
 * // Access actions from registry
 * const harvest = creepActions.harvestSource;
 * const moveAction = creepActions.moveToTarget({ range: 3 });
 * ```
 */
export const creepActions = {
  // Movement actions
  moveToTarget,
  moveToTargetDefault,
  findClosestByPath,
  findInRange,
  moveToRoom,
  flee,

  // Energy actions
  harvestSource,
  harvestNearestSource,
  transferEnergy,
  withdrawEnergy,
  pickupEnergy,
  pickupNearestEnergy,
  transferToSpawns,
  withdrawFromContainers,

  // Work actions
  upgradeController,
  buildStructure,
  repairStructure,
  repairToThreshold,
  claimController,
  reserveController,
  signController,
  attackTarget,
  rangedAttackTarget,
  healTarget,
  dismantleStructure
};
