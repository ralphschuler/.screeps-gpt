/**
 * Military Roles - Phase 7.3 & 7.4
 *
 * Defense and offensive roles using screeps-xtree decision trees:
 * - GuardAnt (melee/ranged defenders)
 * - HealerAnt
 * - SoldierAnt (melee/range offense)
 * - SiegeUnit (dismantler/tough)
 * - Harasser (early aggression)
 * - Ranger (ranged combat)
 */

import { createSwarmContext, executeAction } from "../trees/context";
import { evaluateMilitaryRole as evaluateMilitaryTree } from "../trees/militaryTrees";

/**
 * Run military role using screeps-xtree decision tree
 */
export function runMilitaryRole(creep: Creep): void {
  // Create context with all room state
  const ctx = createSwarmContext(creep);

  // Evaluate decision tree to get action
  const action = evaluateMilitaryTree(ctx);

  // Execute the action
  executeAction(creep, action, ctx);
}
