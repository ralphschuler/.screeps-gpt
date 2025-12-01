/**
 * Economy Roles - Phase 7.1
 *
 * All economy-focused creep roles using screeps-xtree decision trees:
 * - LarvaWorker (unified starter)
 * - Harvester (stationary miner)
 * - Hauler (transport)
 * - Builder
 * - Upgrader
 * - QueenCarrier (distributor)
 * - MineralHarvester
 * - DepositHarvester
 * - LabTech
 * - FactoryWorker
 */

import { createSwarmContext, executeAction } from "../trees/context";
import { evaluateEconomyRole as evaluateEconomyTree } from "../trees/economyTrees";

/**
 * Run economy role using screeps-xtree decision tree
 */
export function runEconomyRole(creep: Creep): void {
  // Create context with all room state
  const ctx = createSwarmContext(creep);

  // Evaluate decision tree to get action
  const action = evaluateEconomyTree(ctx);

  // Execute the action
  executeAction(creep, action, ctx);
}
