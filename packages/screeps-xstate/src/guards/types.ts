/**
 * Type definitions for modular guards.
 *
 * @packageDocumentation
 */

/**
 * Context interface for creep-based guards.
 * Guards can work with any context that includes a creep and optional target.
 */
export interface CreepContext {
  /** The creep being evaluated */
  creep: Creep;
  /** Optional target for position-based guards */
  target?: RoomObject | RoomPosition | null;
}

/**
 * Guard function type that takes a context and returns a boolean.
 * Compatible with screeps-xstate Guard type signature.
 */
export type CreepGuard<TContext extends CreepContext = CreepContext, TEvent = unknown> = (
  context: TContext,
  event?: TEvent
) => boolean;

/**
 * Factory function type for creating parameterized guards.
 */
export type CreepGuardFactory<TParams, TContext extends CreepContext = CreepContext, TEvent = unknown> = (
  params: TParams
) => CreepGuard<TContext, TEvent>;
