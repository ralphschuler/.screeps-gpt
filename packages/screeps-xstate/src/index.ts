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
