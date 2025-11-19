/**
 * @ralphschuler/screeps-xtree
 *
 * A lightweight decision tree framework for the Screeps runtime environment.
 * Provides structured decision-making capabilities with minimal CPU overhead.
 *
 * @packageDocumentation
 */

// Core decision tree components
export { DecisionTree } from "./DecisionTree.js";
export { DecisionTreeBuilder } from "./DecisionTreeBuilder.js";
export type { DecisionNode } from "./types.js";
export { DecisionTreeError } from "./types.js";

// Composition utilities
export {
  createSubtreeFactory,
  createCondition,
  andConditions,
  orConditions,
  notCondition,
  createSwitchCases,
  createPriorityTree,
  wrapWithCondition,
  createResultMapper,
  type SubtreeFactory
} from "./composition.js";

// Screeps-specific extensions
export * from "./screeps/index.js";
