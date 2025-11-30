/**
 * Power Roles - Phase 7.6 & 12
 *
 * Power creep roles using screeps-xtree decision trees:
 * - PowerQueen (economy-focused Operator)
 * - PowerWarrior (combat-support)
 * - PowerHarvester (regular creep for power banks)
 * - PowerCarrier (regular creep for carrying power)
 */

import { createSwarmContext, executeAction } from "../trees/context";
import { evaluatePowerRole as evaluatePowerTree, createPowerCreepContext, evaluatePowerQueen, evaluatePowerWarrior, executePowerCreepAction } from "../trees/powerTrees";
import type { SwarmCreepMemory } from "../../memory/schemas";

/**
 * Get power creep memory
 */
function getPowerCreepMemory(creep: PowerCreep): SwarmCreepMemory {
  return creep.memory as unknown as SwarmCreepMemory;
}

/**
 * Run power-related creep role (PowerHarvester, PowerCarrier) using screeps-xtree decision tree
 */
export function runPowerCreepRole(creep: Creep): void {
  // Create context with all room state
  const ctx = createSwarmContext(creep);

  // Evaluate decision tree to get action
  const action = evaluatePowerTree(ctx);

  // Execute the action
  executeAction(creep, action, ctx);
}

/**
 * Run power creep role (PowerQueen, PowerWarrior)
 */
export function runPowerRole(powerCreep: PowerCreep): void {
  const ctx = createPowerCreepContext(powerCreep);
  if (!ctx) return;

  const memory = getPowerCreepMemory(powerCreep);
  
  let action;
  switch (memory.role) {
    case "powerQueen":
      action = evaluatePowerQueen(ctx);
      break;
    case "powerWarrior":
      action = evaluatePowerWarrior(ctx);
      break;
    default:
      action = evaluatePowerQueen(ctx);
  }

  executePowerCreepAction(powerCreep, action);
}

/**
 * Run PowerHarvester behavior (regular creep)
 */
export function runPowerHarvester(creep: Creep): void {
  const ctx = createSwarmContext(creep);
  const action = evaluatePowerTree(ctx);
  executeAction(creep, action, ctx);
}

/**
 * Run PowerCarrier behavior (regular creep)
 */
export function runPowerCarrier(creep: Creep): void {
  const ctx = createSwarmContext(creep);
  const action = evaluatePowerTree(ctx);
  executeAction(creep, action, ctx);
}
