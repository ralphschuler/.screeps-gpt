import type { Action } from "../types.js";

// Declare global for Screeps compatibility (available in both Node.js and Screeps)
declare const global: any;

/**
 * Creates an action that assigns a value to a context property.
 *
 * @param key - The property key to assign to
 * @param value - The value to assign, or a function that returns the value
 * @returns An action that performs the assignment
 *
 * @example
 * ```typescript
 * assign('count', (ctx, event) => ctx.count + 1)
 * ```
 */
export function assign<TContext, TEvent, K extends keyof TContext>(
  key: K,
  value: TContext[K] | ((ctx: TContext, event: TEvent) => TContext[K])
): Action<TContext, TEvent> {
  return (ctx, event) => {
    ctx[key] =
      typeof value === "function" ? (value as (ctx: TContext, event: TEvent) => TContext[K])(ctx, event) : value;
  };
}

/**
 * Creates an action that logs a message.
 * Useful for debugging state transitions.
 *
 * @param message - The message to log, or a function that returns the message
 * @returns An action that logs the message
 *
 * @example
 * ```typescript
 * log((ctx, event) => `Transitioned to ${event.type}`)
 * ```
 */
export function log<TContext, TEvent>(
  message: string | ((ctx: TContext, event: TEvent) => string)
): Action<TContext, TEvent> {
  return (ctx, event) => {
    const msg = typeof message === "function" ? message(ctx, event) : message;
    // Access console from global for Screeps compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const safeConsole = (typeof global !== "undefined" ? (global as any).console : undefined) || { log: () => {} };
    safeConsole.log(msg);
  };
}

/**
 * Chains multiple actions to execute in sequence.
 *
 * @param actions - Array of actions to execute in order
 * @returns An action that executes all provided actions
 *
 * @example
 * ```typescript
 * chain(
 *   assign('count', (ctx) => ctx.count + 1),
 *   log((ctx) => `Count is now ${ctx.count}`)
 * )
 * ```
 */
export function chain<TContext, TEvent>(...actions: Action<TContext, TEvent>[]): Action<TContext, TEvent> {
  return (ctx, event) => {
    actions.forEach(action => action(ctx, event));
  };
}
