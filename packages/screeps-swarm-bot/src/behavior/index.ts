/**
 * Swarm Behavior Module
 * 
 * Provides decision tree-based behavior for swarm creeps using the xtree library.
 * This replaces the imperative role functions with composable, declarative behavior trees.
 * 
 * @packageDocumentation
 */

export type { SwarmCreepContext, SwarmAction } from "./types.js";
export { createSwarmContext } from "./types.js";
export { swarmConditions } from "./conditions.js";
export { swarmActions, executeAction } from "./actions.js";
export { roleTrees, getTreeForRole } from "./trees.js";

import { createSwarmContext } from "./types.js";
import { executeAction } from "./actions.js";
import { getTreeForRole } from "./trees.js";
import type { SwarmRole } from "../types.js";

/**
 * Runs the behavior tree for a creep based on its role.
 * This is the main entry point for creep behavior execution.
 * 
 * @param creep - The creep to run behavior for
 */
export function runCreepBehavior(creep: Creep): void {
  const memory = creep.memory as { role?: SwarmRole };
  const role = memory.role ?? "larvaWorker";
  
  // Create context for the decision tree
  const context = createSwarmContext(creep);
  
  // Get the tree for this role and evaluate
  const tree = getTreeForRole(role);
  const action = tree.evaluate(context);
  
  // Handle moveTo actions with dynamic target resolution
  if (action.type === "moveTo") {
    const resolvedAction = { 
      ...action, 
      target: action.target === "targetRoom" ? context.targetRoom ?? context.homeRoom : context.homeRoom 
    };
    executeAction(context, resolvedAction);
  } else {
    executeAction(context, action);
  }
}
