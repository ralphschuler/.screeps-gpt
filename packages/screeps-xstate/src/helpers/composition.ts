import type { StateConfig } from "../types.js";

/**
 * Factory function type for creating reusable state configurations.
 * Takes parameters and returns a state configuration object.
 *
 * @template TContext - The type of context
 * @template TEvent - The type of events
 * @template TParams - The type of factory parameters
 */
export type StateFactory<TContext, TEvent, TParams = void> = (
  params: TParams
) => Record<string, StateConfig<TContext, TEvent>>;

/**
 * Merges multiple state configuration objects into a single configuration.
 * Later configurations override earlier ones if there are conflicts.
 *
 * @param configs - State configuration objects to merge
 * @returns Merged state configuration
 *
 * @example
 * ```typescript
 * const baseStates = { idle: { on: { START: { target: 'active' } } } };
 * const extendedStates = { active: { on: { STOP: { target: 'idle' } } } };
 * const combined = mergeStates(baseStates, extendedStates);
 * ```
 */
export function mergeStates<TContext, TEvent extends { type: string }>(
  ...configs: Array<Record<string, StateConfig<TContext, TEvent>>>
): Record<string, StateConfig<TContext, TEvent>> {
  const result: Record<string, StateConfig<TContext, TEvent>> = {};

  for (const config of configs) {
    for (const stateName in config) {
      const existingState = result[stateName];
      const newState = config[stateName];

      if (!existingState) {
        // New state, just add it
        result[stateName] = { ...newState };
      } else {
        // Merge with existing state
        result[stateName] = {
          ...existingState,
          ...newState,
          on: {
            ...existingState.on,
            ...newState.on
          },
          onEntry: [...(existingState.onEntry || []), ...(newState.onEntry || [])],
          onExit: [...(existingState.onExit || []), ...(newState.onExit || [])]
        };
      }
    }
  }

  return result;
}

/**
 * Creates a state factory that generates reusable state configurations.
 * Useful for creating parameterized state patterns.
 *
 * @param factory - Function that creates states based on parameters
 * @returns The factory function
 *
 * @example
 * ```typescript
 * const createMovementStates = createStateFactory<Context, Event, { speed: number }>(
 *   ({ speed }) => ({
 *     moving: {
 *       onEntry: [(ctx) => ctx.speed = speed],
 *       on: { STOP: { target: 'idle' } }
 *     },
 *     idle: {
 *       on: { MOVE: { target: 'moving' } }
 *     }
 *   })
 * );
 *
 * const fastStates = createMovementStates({ speed: 10 });
 * const slowStates = createMovementStates({ speed: 5 });
 * ```
 */
export function createStateFactory<TContext, TEvent extends { type: string }, TParams = void>(
  factory: (params: TParams) => Record<string, StateConfig<TContext, TEvent>>
): StateFactory<TContext, TEvent, TParams> {
  return factory;
}

/**
 * Prefixes all state names and transition targets in a configuration.
 * Useful for namespacing states when composing multiple machines.
 *
 * @param prefix - Prefix to add to all state names
 * @param states - State configuration to prefix
 * @returns New configuration with prefixed state names
 *
 * @example
 * ```typescript
 * const states = {
 *   idle: { on: { START: { target: 'active' } } },
 *   active: { on: { STOP: { target: 'idle' } } }
 * };
 *
 * const prefixed = prefixStates('combat_', states);
 * // Result: { combat_idle: { on: { START: { target: 'combat_active' } } }, ... }
 * ```
 */
export function prefixStates<TContext, TEvent extends { type: string }>(
  prefix: string,
  states: Record<string, StateConfig<TContext, TEvent>>
): Record<string, StateConfig<TContext, TEvent>> {
  const result: Record<string, StateConfig<TContext, TEvent>> = {};

  // First pass: create new states with prefixed names
  for (const stateName in states) {
    const prefixedName = `${prefix}${stateName}`;
    result[prefixedName] = { ...states[stateName] };
  }

  // Second pass: update all transition targets to use prefixed names
  for (const stateName in result) {
    const state = result[stateName];
    if (state.on) {
      const newOn: Record<string, StateConfig<TContext, TEvent>["on"][string]> = {};
      for (const eventType in state.on) {
        const transition = state.on[eventType];
        const originalTarget = transition.target;

        // Check if the target exists in the original states (it should be prefixed)
        if (originalTarget in states) {
          newOn[eventType] = {
            ...transition,
            target: `${prefix}${originalTarget}`
          };
        } else {
          // Keep unprefixed targets (they might reference external states)
          newOn[eventType] = transition;
        }
      }
      state.on = newOn;
    }
  }

  return result;
}

/**
 * Creates bridge transitions between two state configurations.
 * Useful for connecting separate state machines.
 *
 * @param fromState - State to transition from
 * @param eventType - Event that triggers the transition
 * @param toState - State to transition to
 * @param guard - Optional guard for the transition
 * @returns Bridge transition configuration
 *
 * @example
 * ```typescript
 * const states = mergeStates(
 *   workStates,
 *   combatStates,
 *   createBridge('work_idle', 'ENTER_COMBAT', 'combat_active')
 * );
 * ```
 */
export function createBridge<TContext, TEvent extends { type: string }>(
  fromState: string,
  eventType: string,
  toState: string,
  guard?: (context: TContext, event: TEvent) => boolean
): Record<string, StateConfig<TContext, TEvent>> {
  return {
    [fromState]: {
      on: {
        [eventType]: {
          target: toState,
          ...(guard && { guard })
        }
      }
    }
  };
}
