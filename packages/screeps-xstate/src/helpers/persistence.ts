import { StateMachine } from "../StateMachine.js";
import type { SerializedMachine, StateConfig } from "../types.js";

/**
 * Serializes a state machine to a plain object for storage in Memory.
 *
 * @param machine - The state machine to serialize
 * @returns A serialized representation of the machine
 *
 * @example
 * ```typescript
 * const serialized = serialize(machine);
 * Memory.creeps['Harvester1'].machine = serialized;
 * ```
 */
export function serialize<TContext>(machine: StateMachine<TContext, { type: string }>): SerializedMachine {
  return {
    state: machine.getState(),
    context: machine.getContext()
  };
}

/**
 * Restores a state machine from a serialized representation.
 *
 * @param serialized - The serialized machine data
 * @param states - The state configuration for the machine
 * @returns A new state machine instance
 *
 * @example
 * ```typescript
 * const machine = restore(
 *   Memory.creeps['Harvester1'].machine,
 *   harvesterStates
 * );
 * ```
 */
export function restore<TContext, TEvent extends { type: string }>(
  serialized: SerializedMachine,
  states: Record<string, StateConfig<TContext, TEvent>>
): StateMachine<TContext, TEvent> {
  return new StateMachine(serialized.state, states, serialized.context as TContext);
}
