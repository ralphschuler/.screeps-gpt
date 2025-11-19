import type { DecisionNode } from "./types.js";
import { DecisionTreeError } from "./types.js";

/**
 * A decision tree implementation for making structured decisions based on context.
 * Evaluates a tree of condition nodes to determine the appropriate result.
 *
 * @template TContext - The type of context passed during evaluation
 * @template TResult - The type of result returned by the tree
 *
 * @example
 * ```typescript
 * const tree = new DecisionTree<CreepContext, CreepAction>(rootNode);
 * const action = tree.evaluate(context);
 * ```
 */
export class DecisionTree<TContext, TResult> {
  /**
   * Creates a new decision tree.
   *
   * @param root - The root node of the decision tree
   */
  public constructor(private readonly root: DecisionNode<TContext, TResult>) {}

  /**
   * Evaluates the decision tree with the given context.
   * Traverses the tree based on condition results until a result is found.
   *
   * @param context - The context to evaluate
   * @returns The result determined by the tree
   * @throws {DecisionTreeError} If the tree reaches a dead end without a result
   */
  public evaluate(context: TContext): TResult {
    return this.evaluateNode(this.root, context);
  }

  /**
   * Internal recursive evaluation method.
   *
   * @param node - The current node to evaluate
   * @param context - The context to evaluate
   * @returns The result from this node or its children
   * @throws {DecisionTreeError} If the node has no result and no valid next node
   */
  private evaluateNode(node: DecisionNode<TContext, TResult>, context: TContext): TResult {
    switch (node.type) {
      case "leaf":
        // Leaf nodes return their result directly
        return node.result;

      case "if": {
        // If nodes evaluate a condition and follow true/false branches
        const conditionResult = node.condition(context);
        const nextNode = conditionResult ? node.trueNode : node.falseNode;
        return this.evaluateNode(nextNode, context);
      }

      case "switch": {
        // Switch nodes evaluate multiple conditions in order
        for (const { condition, node: caseNode } of node.cases) {
          if (condition(context)) {
            return this.evaluateNode(caseNode, context);
          }
        }

        // If no condition matched, use default node
        if (node.defaultNode) {
          return this.evaluateNode(node.defaultNode, context);
        }

        // No matching condition and no default - dead end
        throw new DecisionTreeError(
          `Switch node ${node.id} reached dead end with no matching condition and no default`,
          node.id
        );
      }

      case "noop":
        // Noop nodes pass through to their next node
        return this.evaluateNode(node.next, context);

      default:
        // This should never happen with proper TypeScript types
        throw new DecisionTreeError(`Unknown node type at node ${node.id}`, node.id);
    }
  }

  /**
   * Gets the root node of the tree (useful for debugging or visualization).
   *
   * @returns The root decision node
   */
  public getRoot(): DecisionNode<TContext, TResult> {
    return this.root;
  }
}
