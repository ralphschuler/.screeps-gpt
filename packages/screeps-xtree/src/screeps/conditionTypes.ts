/**
 * Type definitions for modular conditions.
 *
 * @packageDocumentation
 */

import type { CreepDecisionContext } from "./types.js";

/**
 * Condition function type for decision tree evaluation.
 * Compatible with screeps-xtree condition signature.
 */
export type Condition<TContext = CreepDecisionContext> = (context: TContext) => boolean;

/**
 * Factory function type for creating parameterized conditions.
 */
export type ConditionFactory<TParams, TContext = CreepDecisionContext> = (params: TParams) => Condition<TContext>;

/**
 * Context interface for creep-based conditions with optional target.
 * Extends the basic CreepDecisionContext with target support.
 */
export interface CreepConditionContext extends CreepDecisionContext {
  /** Optional target for position-based conditions */
  target?: RoomObject | RoomPosition | null;
  /** Optional source ID */
  sourceId?: Id<Source>;
  /** Optional target structure ID */
  targetId?: Id<AnyStoreStructure>;
}
