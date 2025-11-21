/**
 * Core event type that all events must conform to
 */
export interface GameEvent<T = unknown> {
  /** Event type identifier */
  type: string;
  /** Event payload data */
  data: T;
  /** Game tick when event was emitted */
  tick: number;
  /** Optional source component that emitted the event */
  source?: string;
}

/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (event: GameEvent<T>) => void;

/**
 * Function returned by subscribe that can be called to unsubscribe
 */
export type UnsubscribeFunction = () => void;
