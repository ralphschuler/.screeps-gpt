import type { DecisionNode } from "./types.js";
import { DecisionTreeBuilder } from "./DecisionTreeBuilder.js";

/**
 * Factory function type for creating reusable decision subtrees.
 * Takes parameters and returns a decision node.
 *
 * @template TContext - The type of context passed during evaluation
 * @template TResult - The type of result returned by the tree
 * @template TParams - The type of factory parameters
 */
export type SubtreeFactory<TContext, TResult, TParams = void> = (params: TParams) => DecisionNode<TContext, TResult>;

/**
 * Creates a subtree factory that generates reusable decision subtrees.
 * Useful for creating parameterized decision patterns.
 *
 * @param factory - Function that creates a subtree based on parameters
 * @returns The factory function
 *
 * @example
 * ```typescript
 * const createThresholdCheck = createSubtreeFactory<Context, Action, { threshold: number }>(
 *   ({ threshold }) => {
 *     const builder = new DecisionTreeBuilder<Context, Action>();
 *     return builder.if(
 *       (ctx) => ctx.value > threshold,
 *       builder.leaf({ type: 'high' }),
 *       builder.leaf({ type: 'low' })
 *     );
 *   }
 * );
 *
 * const highThreshold = createThresholdCheck({ threshold: 100 });
 * const lowThreshold = createThresholdCheck({ threshold: 10 });
 * ```
 */
export function createSubtreeFactory<TContext, TResult, TParams = void>(
  factory: (params: TParams) => DecisionNode<TContext, TResult>
): SubtreeFactory<TContext, TResult, TParams> {
  return factory;
}

/**
 * Creates a reusable condition function that can be parameterized.
 *
 * @param factory - Function that creates a condition based on parameters
 * @returns Function that creates conditions
 *
 * @example
 * ```typescript
 * const createRangeCheck = createCondition<Context, { min: number; max: number }>(
 *   ({ min, max }) => (ctx) => ctx.value >= min && ctx.value <= max
 * );
 *
 * const inRange = createRangeCheck({ min: 10, max: 20 });
 * ```
 */
export function createCondition<TContext, TParams = void>(
  factory: (params: TParams) => (context: TContext) => boolean
): (params: TParams) => (context: TContext) => boolean {
  return factory;
}

/**
 * Combines multiple conditions with AND logic.
 * All conditions must be true for the combined condition to be true.
 *
 * @param conditions - Array of condition functions
 * @returns Combined condition function
 *
 * @example
 * ```typescript
 * const condition = andConditions(
 *   (ctx) => ctx.energy > 0,
 *   (ctx) => ctx.health > 50
 * );
 * ```
 */
export function andConditions<TContext>(
  ...conditions: Array<(context: TContext) => boolean>
): (context: TContext) => boolean {
  return (context: TContext) => conditions.every(cond => cond(context));
}

/**
 * Combines multiple conditions with OR logic.
 * At least one condition must be true for the combined condition to be true.
 *
 * @param conditions - Array of condition functions
 * @returns Combined condition function
 *
 * @example
 * ```typescript
 * const condition = orConditions(
 *   (ctx) => ctx.emergency,
 *   (ctx) => ctx.priority > 5
 * );
 * ```
 */
export function orConditions<TContext>(
  ...conditions: Array<(context: TContext) => boolean>
): (context: TContext) => boolean {
  return (context: TContext) => conditions.some(cond => cond(context));
}

/**
 * Negates a condition function.
 *
 * @param condition - Condition to negate
 * @returns Negated condition function
 *
 * @example
 * ```typescript
 * const notDisabled = notCondition((ctx) => ctx.disabled);
 * ```
 */
export function notCondition<TContext>(condition: (context: TContext) => boolean): (context: TContext) => boolean {
  return (context: TContext) => !condition(context);
}

/**
 * Creates a switch-case subtree from an array of condition-result pairs.
 * This is a convenience function for creating common switch patterns.
 *
 * @param cases - Array of condition-result pairs
 * @param defaultResult - Default result if no conditions match
 * @returns Decision node implementing the switch logic
 *
 * @example
 * ```typescript
 * const builder = new DecisionTreeBuilder<Context, Action>();
 * const prioritySwitch = createSwitchCases(
 *   builder,
 *   [
 *     { condition: (ctx) => ctx.priority === 'critical', result: { type: 'emergency' } },
 *     { condition: (ctx) => ctx.priority === 'high', result: { type: 'urgent' } },
 *     { condition: (ctx) => ctx.priority === 'medium', result: { type: 'normal' } }
 *   ],
 *   { type: 'low' }
 * );
 * ```
 */
export function createSwitchCases<TContext, TResult>(
  builder: DecisionTreeBuilder<TContext, TResult>,
  cases: Array<{
    condition: (context: TContext) => boolean;
    result: TResult;
  }>,
  defaultResult: TResult
): DecisionNode<TContext, TResult> {
  return builder.switch(
    cases.map(({ condition, result }) => ({
      condition,
      node: builder.leaf(result)
    })),
    builder.leaf(defaultResult)
  );
}

/**
 * Creates a priority-based decision subtree where conditions are evaluated in order.
 * The first matching condition determines the result.
 *
 * @param builder - DecisionTreeBuilder instance
 * @param priorities - Array of condition-result pairs in priority order
 * @param defaultResult - Default result if no conditions match
 * @returns Decision node implementing priority-based logic
 *
 * @example
 * ```typescript
 * const builder = new DecisionTreeBuilder<Context, Action>();
 * const priorityTree = createPriorityTree(
 *   builder,
 *   [
 *     { condition: (ctx) => ctx.underAttack, result: { type: 'flee' } },
 *     { condition: (ctx) => ctx.needsEnergy, result: { type: 'harvest' } },
 *     { condition: (ctx) => ctx.hasWork, result: { type: 'work' } }
 *   ],
 *   { type: 'idle' }
 * );
 * ```
 */
export function createPriorityTree<TContext, TResult>(
  builder: DecisionTreeBuilder<TContext, TResult>,
  priorities: Array<{
    condition: (context: TContext) => boolean;
    result: TResult;
  }>,
  defaultResult: TResult
): DecisionNode<TContext, TResult> {
  return createSwitchCases(builder, priorities, defaultResult);
}

/**
 * Wraps a subtree with a condition check.
 * If the condition is true, evaluates the subtree, otherwise returns the fallback.
 *
 * @param builder - DecisionTreeBuilder instance
 * @param condition - Condition to check
 * @param subtree - Subtree to evaluate if condition is true
 * @param fallback - Result to return if condition is false
 * @returns Wrapped decision node
 *
 * @example
 * ```typescript
 * const builder = new DecisionTreeBuilder<Context, Action>();
 * const complexLogic = builder.switch(...); // Complex subtree
 * const wrapped = wrapWithCondition(
 *   builder,
 *   (ctx) => ctx.enabled,
 *   complexLogic,
 *   { type: 'disabled' }
 * );
 * ```
 */
export function wrapWithCondition<TContext, TResult>(
  builder: DecisionTreeBuilder<TContext, TResult>,
  condition: (context: TContext) => boolean,
  subtree: DecisionNode<TContext, TResult>,
  fallback: TResult
): DecisionNode<TContext, TResult> {
  return builder.if(condition, subtree, builder.leaf(fallback));
}

/**
 * Creates a reusable result mapper that transforms context into results.
 * Useful for creating consistent result generation patterns.
 *
 * @param mapper - Function that maps context to result
 * @returns Result mapper function
 *
 * @example
 * ```typescript
 * const createHarvestAction = createResultMapper<Context, Action>(
 *   (ctx) => ({ type: 'harvest', target: ctx.nearestSource })
 * );
 * ```
 */
export function createResultMapper<TContext, TResult>(
  mapper: (context: TContext) => TResult
): (context: TContext) => TResult {
  return mapper;
}
