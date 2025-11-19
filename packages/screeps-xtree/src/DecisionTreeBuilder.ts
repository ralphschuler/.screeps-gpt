import type { DecisionNode } from "./types.js";
import { DecisionTree } from "./DecisionTree.js";

/**
 * Builder for constructing decision trees with a fluent API.
 * Provides helper methods for creating nodes and building complete trees.
 *
 * @template TContext - The type of context passed during evaluation
 * @template TResult - The type of result returned by the tree
 *
 * @example
 * ```typescript
 * const builder = new DecisionTreeBuilder<Context, Action>();
 *
 * const root = builder.if(
 *   (ctx) => ctx.energy > 0,
 *   builder.leaf({ type: 'harvest' }),
 *   builder.leaf({ type: 'idle' })
 * );
 *
 * const tree = builder.build(root);
 * ```
 */
export class DecisionTreeBuilder<TContext, TResult> {
  private nodeCounter = 0;

  /**
   * Creates an if node that makes a binary decision based on a condition.
   *
   * @param condition - Function that determines which branch to follow
   * @param trueNode - Node to evaluate if condition returns true
   * @param falseNode - Node to evaluate if condition returns false
   * @returns An if decision node
   */
  public if(
    condition: (context: TContext) => boolean,
    trueNode: DecisionNode<TContext, TResult>,
    falseNode: DecisionNode<TContext, TResult>
  ): DecisionNode<TContext, TResult> {
    return {
      id: `if-${this.nodeCounter++}`,
      type: "if",
      condition,
      trueNode,
      falseNode
    };
  }

  /**
   * Creates a switch node that makes multi-way decisions.
   * Evaluates conditions in order and follows the first matching path.
   *
   * @param cases - Array of condition-node pairs to evaluate
   * @param defaultNode - Optional default node if no conditions match
   * @returns A switch decision node
   */
  public switch(
    cases: Array<{
      condition: (context: TContext) => boolean;
      node: DecisionNode<TContext, TResult>;
    }>,
    defaultNode?: DecisionNode<TContext, TResult>
  ): DecisionNode<TContext, TResult> {
    return {
      id: `switch-${this.nodeCounter++}`,
      type: "switch",
      cases,
      defaultNode
    };
  }

  /**
   * Creates a leaf node that returns a result without further evaluation.
   *
   * @param result - The result value to return
   * @returns A leaf decision node
   */
  public leaf(result: TResult): DecisionNode<TContext, TResult> {
    return {
      id: `leaf-${this.nodeCounter++}`,
      type: "leaf",
      result
    };
  }

  /**
   * Creates a noop node that passes through to a child node.
   * Useful for organizing tree structure or adding debugging points.
   *
   * @param next - The node to pass through to
   * @param label - Optional label for debugging
   * @returns A noop decision node
   */
  public noop(next: DecisionNode<TContext, TResult>, label?: string): DecisionNode<TContext, TResult> {
    return {
      id: `noop-${this.nodeCounter++}`,
      type: "noop",
      next,
      label
    };
  }

  /**
   * Builds a complete decision tree from a root node.
   *
   * @param root - The root node of the tree
   * @returns A new DecisionTree instance
   */
  public build(root: DecisionNode<TContext, TResult>): DecisionTree<TContext, TResult> {
    return new DecisionTree(root);
  }

  /**
   * Resets the node counter for ID generation.
   * Useful when building multiple independent trees.
   */
  public reset(): void {
    this.nodeCounter = 0;
  }
}
