/**
 * Screeps-specific decision tree extensions and helpers.
 *
 * @packageDocumentation
 */

export type { CreepDecisionContext, CreepAction, RoomDecisionContext, RoomAction } from "./types.js";
export { createCreepContext, CreepConditions } from "./helpers.js";

// Modular conditions (parallel to xstate guards)
export type { Condition, ConditionFactory, CreepConditionContext } from "./conditionTypes.js";
export {
  conditions,
  hasEnergy,
  isFull,
  isEmpty,
  hasFreeCapacity,
  hasCapacityPercent,
  isNearTarget,
  isAtTarget,
  hasTarget,
  isInRoom,
  isNearExit,
  isAtExit,
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
  hasConstructionSites,
  hasRepairTargets,
  enemiesNearby,
  hasEnergySources
} from "./conditions.js";

// Modular tree actions (parallel to xstate creepActions)
export type { MoveToOptions } from "./actions.js";
export {
  treeActions,
  moveToTarget,
  flee,
  harvestNearestSource,
  harvestSource,
  transferEnergy,
  withdrawEnergy,
  transferToSpawns,
  withdrawFromContainers,
  upgradeController,
  buildStructure,
  repairStructure,
  attackTarget,
  healTarget
} from "./actions.js";
