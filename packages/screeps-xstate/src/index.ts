/**
 * @ralphschuler/screeps-xstate
 *
 * A lightweight finite state machine library optimized for the Screeps runtime environment.
 * Provides declarative behavior management with minimal CPU overhead.
 *
 * @packageDocumentation
 */

export { StateMachine } from "./StateMachine.js";
export type { Guard, Action, Transition, StateConfig, SerializedMachine } from "./types.js";
export { and, or, not } from "./helpers/guards.js";
export { assign, log, chain } from "./helpers/actions.js";
export { serialize, restore } from "./helpers/persistence.js";
export {
  mergeStates,
  createStateFactory,
  prefixStates,
  createBridge,
  type StateFactory
} from "./helpers/composition.js";

// Modular guards for creep behaviors
export {
  guards,
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
  hasActiveBodyPart,
  hasRole,
  hasRoleType,
  type CreepContext,
  type CreepGuard,
  type CreepGuardFactory
} from "./guards/index.js";

// Modular actions for creep behaviors
export {
  creepActions,
  moveToTarget,
  moveToTargetDefault,
  findClosestByPath,
  findInRange,
  moveToRoom,
  flee,
  harvestSource,
  harvestNearestSource,
  transferEnergy,
  withdrawEnergy,
  pickupEnergy,
  pickupNearestEnergy,
  transferToSpawns,
  withdrawFromContainers,
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
  dismantleStructure,
  type CreepActionContext,
  type CreepAction,
  type CreepActionFactory,
  type MoveToOptions
} from "./actions/index.js";
