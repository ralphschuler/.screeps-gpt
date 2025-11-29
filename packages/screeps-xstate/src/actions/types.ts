/**
 * Type definitions for modular actions.
 *
 * @packageDocumentation
 */

/**
 * Context interface for creep-based actions.
 * Actions can work with any context that includes a creep and optional target.
 */
export interface CreepActionContext {
  /** The creep performing the action */
  creep: Creep;
  /** Optional target for the action */
  target?: RoomObject | RoomPosition | null;
  /** Optional source ID for harvesting */
  sourceId?: Id<Source>;
  /** Optional target structure ID */
  targetId?: Id<AnyStoreStructure>;
}

/**
 * Action function type that takes a context and optionally modifies it.
 * Compatible with screeps-xstate Action type signature.
 */
export type CreepAction<TContext extends CreepActionContext = CreepActionContext, TEvent = unknown> = (
  context: TContext,
  event?: TEvent
) => void;

/**
 * Factory function type for creating parameterized actions.
 */
export type CreepActionFactory<TParams, TContext extends CreepActionContext = CreepActionContext, TEvent = unknown> = (
  params: TParams
) => CreepAction<TContext, TEvent>;

/**
 * Options for movement actions.
 */
export interface MoveToOptions {
  /** Range from target to stop at (default: 1) */
  range?: number;
  /** Number of ticks to reuse the path (default: 30) */
  reusePath?: number;
  /** Whether to ignore other creeps in pathfinding (default: true) */
  ignoreCreeps?: boolean;
  /** Visual style for the path */
  visualizePathStyle?: PolyStyle;
}
