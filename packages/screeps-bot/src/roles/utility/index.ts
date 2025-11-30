/**
 * Utility Roles - Phase 7.2 & 7.5
 *
 * Utility and support roles using screeps-xtree decision trees:
 * - ScoutAnt (exploration)
 * - ClaimAnt (claiming/reserving)
 * - Engineer (repairs, ramparts)
 * - RemoteWorker (remote mining)
 * - LinkManager
 * - TerminalManager
 */

import { createSwarmContext, executeAction } from "../trees/context";
import { evaluateUtilityRole as evaluateUtilityTree } from "../trees/utilityTrees";

/**
 * Run utility role using screeps-xtree decision tree
 */
export function runUtilityRole(creep: Creep): void {
  // Create context with all room state
  const ctx = createSwarmContext(creep);

  // Evaluate decision tree to get action
  const action = evaluateUtilityTree(ctx);

  // Execute the action
  executeAction(creep, action, ctx);
}
