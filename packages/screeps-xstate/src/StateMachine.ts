import type { StateConfig } from "./types.js";

/**
 * A lightweight finite state machine implementation optimized for Screeps.
 *
 * @template TContext - The type of the context object that holds state data
 * @template TEvent - The type of events, must have a 'type' property
 *
 * @example
 * ```typescript
 * const machine = new StateMachine(
 *   'idle',
 *   {
 *     idle: {
 *       on: {
 *         START: { target: 'running' }
 *       }
 *     },
 *     running: {
 *       on: {
 *         STOP: { target: 'idle' }
 *       }
 *     }
 *   },
 *   { counter: 0 }
 * );
 *
 * machine.send({ type: 'START' });
 * console.log(machine.getState()); // 'running'
 * ```
 */
export class StateMachine<TContext, TEvent extends { type: string }> {
  private currentState: string;

  /**
   * Creates a new state machine.
   *
   * @param initialState - The starting state name
   * @param states - Configuration for all states in the machine
   * @param context - The initial context object
   */
  public constructor(
    private initialState: string,
    private states: Record<string, StateConfig<TContext, TEvent>>,
    private context: TContext
  ) {
    this.currentState = initialState;
  }

  /**
   * Sends an event to the state machine, potentially triggering a transition.
   *
   * @param event - The event to process
   */
  public send(event: TEvent): void {
    const stateConfig = this.states[this.currentState];
    if (!stateConfig) {
      return;
    }

    if (!stateConfig.on) {
      return;
    }

    const transition = stateConfig.on[event.type];
    if (!transition) {
      return;
    }

    // Check transition guard
    if (transition.guard && !transition.guard(this.context, event)) {
      return;
    }

    // Execute exit actions
    stateConfig.onExit?.forEach(action => action(this.context, event));

    // Execute transition actions
    transition.actions?.forEach(action => action(this.context, event));

    // Transition to new state
    this.currentState = transition.target;

    // Execute entry actions
    const newStateConfig = this.states[this.currentState];
    if (newStateConfig) {
      newStateConfig.onEntry?.forEach(action => action(this.context, event));
    }
  }

  /**
   * Gets the current state name.
   *
   * @returns The current state name
   */
  public getState(): string {
    return this.currentState;
  }

  /**
   * Gets the current context object.
   *
   * @returns The context object
   */
  public getContext(): TContext {
    return this.context;
  }

  /**
   * Checks if the machine is in a specific state.
   *
   * @param state - The state name to check
   * @returns True if the machine is in the specified state
   */
  public matches(state: string): boolean {
    return this.currentState === state;
  }

  /**
   * Resets the machine to its initial state.
   * Does not modify the context.
   */
  public reset(): void {
    this.currentState = this.initialState;
  }
}
