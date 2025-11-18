/**
 * Guard function that determines whether a transition should be allowed.
 * Returns true to allow the transition, false to block it.
 */
export type Guard<TContext, TEvent> = (context: TContext, event: TEvent) => boolean;

/**
 * Action function executed during state transitions or entry/exit.
 * Can modify the context in place.
 */
export type Action<TContext, TEvent> = (context: TContext, event: TEvent) => void;

/**
 * Configuration for a state transition.
 */
export interface Transition<TContext, TEvent> {
  /** Target state to transition to */
  target: string;
  /** Optional guard to conditionally allow the transition */
  guard?: Guard<TContext, TEvent>;
  /** Optional actions to execute during the transition */
  actions?: Action<TContext, TEvent>[];
}

/**
 * Configuration for a state in the state machine.
 */
export interface StateConfig<TContext, TEvent> {
  /** Map of event types to transitions */
  on?: Record<string, Transition<TContext, TEvent>>;
  /** Actions to execute when entering this state */
  onEntry?: Action<TContext, TEvent>[];
  /** Actions to execute when exiting this state */
  onExit?: Action<TContext, TEvent>[];
}

/**
 * Serialized representation of a state machine for persistence.
 */
export interface SerializedMachine {
  /** Current state name */
  state: string;
  /** Serialized context data */
  context: unknown;
}
