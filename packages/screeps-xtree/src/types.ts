/**
 * Base interface for all decision nodes.
 *
 * @template TContext - The type of context passed during evaluation (used in derived types)
 * @template TResult - The type of result returned by the tree (used in derived types)
 */
export interface BaseDecisionNode<TContext = unknown, TResult = unknown> {
  /** Unique identifier for this node */
  id: string;

  /** Type discriminator for node type */
  type: "if" | "switch" | "leaf" | "noop";

  // Phantom types to enforce type safety - never accessed at runtime
  readonly __context?: TContext;
  readonly __result?: TResult;
}

/**
 * If node - binary decision based on a condition.
 *
 * @template TContext - The type of context passed during evaluation
 * @template TResult - The type of result returned by the tree
 */
export interface IfNode<TContext, TResult> extends BaseDecisionNode<TContext, TResult> {
  type: "if";

  /** Condition function that determines which branch to follow */
  condition: (context: TContext) => boolean;

  /** Node to evaluate if condition returns true */
  trueNode: DecisionNode<TContext, TResult>;

  /** Node to evaluate if condition returns false */
  falseNode: DecisionNode<TContext, TResult>;
}

/**
 * Switch node - multi-way decision based on multiple conditions.
 * Evaluates conditions in order and follows the first matching path.
 *
 * @template TContext - The type of context passed during evaluation
 * @template TResult - The type of result returned by the tree
 */
export interface SwitchNode<TContext, TResult> extends BaseDecisionNode<TContext, TResult> {
  type: "switch";

  /** Map of conditions to nodes - evaluated in array order */
  cases: Array<{
    condition: (context: TContext) => boolean;
    node: DecisionNode<TContext, TResult>;
  }>;

  /** Default node if no conditions match */
  defaultNode?: DecisionNode<TContext, TResult>;
}

/**
 * Leaf node - returns a result without further evaluation.
 *
 * @template TContext - The type of context passed during evaluation
 * @template TResult - The type of result returned by the tree
 */
export interface LeafNode<TContext, TResult> extends BaseDecisionNode<TContext, TResult> {
  type: "leaf";

  /** Result value to return */
  result: TResult;
}

/**
 * Noop node - passes through to a child node without evaluation.
 * Useful for organizing tree structure or adding debugging points.
 *
 * @template TContext - The type of context passed during evaluation
 * @template TResult - The type of result returned by the tree
 */
export interface NoopNode<TContext, TResult> extends BaseDecisionNode<TContext, TResult> {
  type: "noop";

  /** Node to pass through to */
  next: DecisionNode<TContext, TResult>;

  /** Optional label for debugging */
  label?: string;
}

/**
 * Union type for all decision node types.
 */
export type DecisionNode<TContext, TResult> =
  | IfNode<TContext, TResult>
  | SwitchNode<TContext, TResult>
  | LeafNode<TContext, TResult>
  | NoopNode<TContext, TResult>;

/**
 * Error thrown when decision tree evaluation reaches a dead end.
 */
export class DecisionTreeError extends Error {
  public constructor(
    message: string,
    public readonly nodeId: string
  ) {
    super(message);
    this.name = "DecisionTreeError";
  }
}
