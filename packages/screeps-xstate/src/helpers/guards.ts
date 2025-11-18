import type { Guard } from "../types.js";

/**
 * Creates a guard that passes only if all provided guards pass.
 *
 * @param guards - Array of guards to combine with AND logic
 * @returns A new guard that passes only if all guards pass
 *
 * @example
 * ```typescript
 * const guard = and(
 *   (ctx) => ctx.energy > 0,
 *   (ctx) => ctx.capacity < 100
 * );
 * ```
 */
export function and<TContext, TEvent>(...guards: Guard<TContext, TEvent>[]): Guard<TContext, TEvent> {
  return (ctx, event) => guards.every(guard => guard(ctx, event));
}

/**
 * Creates a guard that passes if any of the provided guards pass.
 *
 * @param guards - Array of guards to combine with OR logic
 * @returns A new guard that passes if any guard passes
 *
 * @example
 * ```typescript
 * const guard = or(
 *   (ctx) => ctx.emergency,
 *   (ctx) => ctx.priority > 5
 * );
 * ```
 */
export function or<TContext, TEvent>(...guards: Guard<TContext, TEvent>[]): Guard<TContext, TEvent> {
  return (ctx, event) => guards.some(guard => guard(ctx, event));
}

/**
 * Creates a guard that inverts the result of the provided guard.
 *
 * @param guard - The guard to negate
 * @returns A new guard that passes only if the original guard fails
 *
 * @example
 * ```typescript
 * const guard = not((ctx) => ctx.disabled);
 * ```
 */
export function not<TContext, TEvent>(guard: Guard<TContext, TEvent>): Guard<TContext, TEvent> {
  return (ctx, event) => !guard(ctx, event);
}
