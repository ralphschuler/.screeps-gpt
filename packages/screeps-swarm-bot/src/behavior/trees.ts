/**
 * Decision trees for all swarm creep roles.
 * Uses the xtree library for composable behavior trees.
 *
 * @packageDocumentation
 */

import { DecisionTreeBuilder, DecisionTree } from "@ralphschuler/screeps-xtree";
import type { SwarmCreepContext, SwarmAction } from "./types.js";
import * as cond from "./conditions.js";

const builder = new DecisionTreeBuilder<SwarmCreepContext, SwarmAction>();

// Helper to check if creep should move to target room
const shouldMoveToTarget = (ctx: SwarmCreepContext): boolean =>
  ctx.targetRoom !== undefined && ctx.creep.room.name !== ctx.targetRoom;

// Helper to check if creep should move to home room
const shouldMoveToHome = (ctx: SwarmCreepContext): boolean => ctx.creep.room.name !== ctx.homeRoom;

// ============ Economy Role Trees ============

/**
 * Larva Worker - General purpose starter creep.
 * harvest → build → upgrade
 */
export const larvaWorkerTree = builder.build(
  builder.switch(
    [
      { condition: cond.hasEnemies, node: builder.leaf({ type: "flee" }) },
      {
        condition: ctx => cond.hasFreeCapacity(ctx) && cond.hasEnergySources(ctx),
        node: builder.leaf({ type: "harvest" })
      },
      { condition: cond.hasConstructionSites, node: builder.leaf({ type: "build" }) }
    ],
    builder.leaf({ type: "upgrade" })
  )
);

/**
 * Harvester - Stationary energy miner.
 * harvest → drop to container/link
 */
builder.reset();
export const harvesterTree = builder.build(
  builder.switch(
    [
      {
        condition: ctx => !cond.isInTargetRoom(ctx),
        node: builder.leaf({ type: "moveTo", target: "targetRoom" })
      },
      { condition: cond.hasFreeCapacity, node: builder.leaf({ type: "harvest" }) }
    ],
    builder.leaf({ type: "drop" })
  )
);

/**
 * Hauler - Transport energy between structures.
 */
builder.reset();
export const haulerTree = builder.build(
  builder.switch(
    [
      {
        condition: ctx => cond.isEmpty(ctx) && (cond.containersHaveEnergy(ctx) || cond.storageHasEnergy()(ctx)),
        node: builder.leaf({ type: "withdraw" })
      },
      { condition: ctx => cond.hasEnergy(ctx), node: builder.leaf({ type: "transfer" }) }
    ],
    builder.leaf({ type: "idle" })
  )
);

/**
 * Upgrader - Controller upgrading specialist.
 */
builder.reset();
export const upgraderTree = builder.build(
  builder.switch(
    [
      {
        condition: ctx => cond.isEmpty(ctx) && (cond.storageHasEnergy()(ctx) || cond.hasEnergySources(ctx)),
        node: builder.if(cond.storageHasEnergy(), builder.leaf({ type: "withdraw" }), builder.leaf({ type: "harvest" }))
      }
    ],
    builder.leaf({ type: "upgrade" })
  )
);

/**
 * Forager Ant - Remote energy gatherer.
 */
builder.reset();
export const foragerAntTree = builder.build(
  builder.switch(
    [
      {
        condition: ctx => shouldMoveToTarget(ctx) && cond.hasFreeCapacity(ctx),
        node: builder.leaf({ type: "moveTo", target: "targetRoom" })
      },
      { condition: cond.hasFreeCapacity, node: builder.leaf({ type: "harvest" }) }
    ],
    builder.leaf({ type: "transfer" })
  )
);

/**
 * Builder Ant - Construction specialist.
 */
builder.reset();
export const builderAntTree = builder.build(
  builder.switch(
    [
      {
        condition: ctx => cond.isEmpty(ctx),
        node: builder.if(cond.storageHasEnergy(), builder.leaf({ type: "withdraw" }), builder.leaf({ type: "harvest" }))
      },
      { condition: cond.hasConstructionSites, node: builder.leaf({ type: "build" }) }
    ],
    builder.leaf({ type: "upgrade" })
  )
);

/**
 * Queen Carrier - Energy distribution specialist.
 */
builder.reset();
export const queenCarrierTree = builder.build(
  builder.switch(
    [
      {
        condition: ctx => !cond.hasEnergy(ctx) && shouldMoveToHome(ctx),
        node: builder.leaf({ type: "moveTo", target: "homeRoom" })
      },
      {
        condition: ctx => !cond.hasEnergy(ctx),
        node: builder.if(
          cond.containersHaveEnergy,
          builder.leaf({ type: "withdraw" }),
          builder.leaf({ type: "harvest" })
        )
      },
      {
        condition: ctx => cond.hasEnergy(ctx) && shouldMoveToTarget(ctx),
        node: builder.leaf({ type: "moveTo", target: "targetRoom" })
      }
    ],
    builder.leaf({ type: "transfer" })
  )
);

/**
 * Mineral Harvester - Extracts minerals from deposits.
 */
builder.reset();
export const mineralHarvesterTree = builder.build(
  builder.switch(
    [
      {
        condition: ctx => !cond.isInTargetRoom(ctx),
        node: builder.leaf({ type: "moveTo", target: "targetRoom" })
      },
      {
        condition: ctx => cond.isFull(ctx) || !cond.hasMinerals(ctx),
        node: builder.leaf({ type: "transfer" })
      },
      {
        condition: ctx => cond.hasExtractor(ctx) && cond.hasMinerals(ctx),
        node: builder.leaf({ type: "harvestMineral" })
      }
    ],
    builder.leaf({ type: "transfer" })
  )
);

/**
 * Deposit Harvester - Highway deposit harvester.
 */
builder.reset();
export const depositHarvesterTree = builder.build(
  builder.switch(
    [
      {
        condition: shouldMoveToTarget,
        node: builder.leaf({ type: "moveTo", target: "targetRoom" })
      },
      {
        condition: ctx => cond.isFull(ctx) || !cond.hasDeposits(ctx) || !cond.depositCooldownOk()(ctx),
        node: builder.leaf({ type: "transfer" })
      },
      { condition: cond.hasDeposits, node: builder.leaf({ type: "harvestDeposit" }) }
    ],
    builder.leaf({ type: "transfer" })
  )
);

/**
 * Terminal Manager - Handles terminal logistics.
 */
builder.reset();
export const terminalManagerTree = builder.build(
  builder.switch(
    [{ condition: ctx => !cond.hasTerminal(ctx), node: builder.leaf({ type: "idle" }) }],
    builder.leaf({ type: "manageTerminal" })
  )
);

/**
 * Link Manager - Handles link energy distribution.
 */
builder.reset();
export const linkManagerTree = builder.build(
  builder.switch(
    [
      { condition: ctx => cond.isEmpty(ctx), node: builder.leaf({ type: "withdraw" }) },
      { condition: cond.linksNeedEnergy, node: builder.leaf({ type: "manageLink" }) }
    ],
    builder.leaf({ type: "transfer" })
  )
);

/**
 * Factory Worker - Manages factory operations.
 */
builder.reset();
export const factoryWorkerTree = builder.build(
  builder.switch(
    [
      { condition: ctx => cond.isEmpty(ctx), node: builder.leaf({ type: "withdraw" }) },
      { condition: cond.factoryNeedsEnergy, node: builder.leaf({ type: "manageFactory" }) }
    ],
    builder.leaf({ type: "idle" })
  )
);

/**
 * Lab Tech - Manages lab operations.
 */
builder.reset();
export const labTechTree = builder.build(
  builder.switch(
    [
      { condition: ctx => cond.isEmpty(ctx), node: builder.leaf({ type: "withdraw" }) },
      { condition: cond.labsNeedEnergy, node: builder.leaf({ type: "manageLab" }) }
    ],
    builder.leaf({ type: "idle" })
  )
);

// ============ Scouting & Claiming Role Trees ============

/**
 * Scout Ant - Explores and gathers intel.
 */
builder.reset();
export const scoutAntTree = builder.build(
  builder.switch(
    [
      {
        condition: shouldMoveToTarget,
        node: builder.leaf({ type: "moveTo", target: "targetRoom" })
      }
    ],
    builder.leaf({ type: "patrol" })
  )
);

/**
 * Claim Ant - Claims or reserves controllers.
 */
builder.reset();
export const claimAntTree = builder.build(
  builder.switch(
    [
      {
        condition: shouldMoveToTarget,
        node: builder.leaf({ type: "moveTo", target: "targetRoom" })
      }
    ],
    builder.leaf({ type: "claim" })
  )
);

// ============ Defense & Military Role Trees ============

/**
 * Guard Ant - Melee defender.
 */
builder.reset();
export const guardAntTree = builder.build(
  builder.switch(
    [
      {
        condition: shouldMoveToTarget,
        node: builder.leaf({ type: "moveTo", target: "targetRoom" })
      },
      { condition: cond.hasEnemies, node: builder.leaf({ type: "attack" }) }
    ],
    builder.leaf({ type: "patrol" })
  )
);

/**
 * Healer Ant - Combat medic.
 */
builder.reset();
export const healerAntTree = builder.build(
  builder.switch(
    [
      {
        condition: shouldMoveToTarget,
        node: builder.leaf({ type: "moveTo", target: "targetRoom" })
      },
      {
        condition: ctx => {
          const wounded = ctx.creep.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: c => c.hits < c.hitsMax
          });
          return !!wounded;
        },
        node: builder.leaf({ type: "heal" })
      }
    ],
    builder.leaf({ type: "patrol" })
  )
);

/**
 * Soldier Ant - Ranged/melee attacker.
 */
builder.reset();
export const soldierAntTree = builder.build(
  builder.switch(
    [
      {
        condition: shouldMoveToTarget,
        node: builder.leaf({ type: "moveTo", target: "targetRoom" })
      },
      { condition: cond.hasEnemies, node: builder.leaf({ type: "rangedAttack" }) }
    ],
    builder.leaf({ type: "patrol" })
  )
);

/**
 * Siege Unit - Dismantler for offensive operations.
 */
builder.reset();
export const siegeUnitTree = builder.build(
  builder.switch(
    [
      {
        condition: shouldMoveToTarget,
        node: builder.leaf({ type: "moveTo", target: "targetRoom" })
      },
      {
        condition: ctx => {
          const hostileStructure = ctx.creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
            filter: s => s.structureType !== STRUCTURE_CONTROLLER
          });
          return !!hostileStructure;
        },
        node: builder.leaf({ type: "dismantle" })
      }
    ],
    builder.leaf({ type: "patrol" })
  )
);

// ============ Utility & Support Role Trees ============

/**
 * Engineer - Repairs and maintains structures.
 */
builder.reset();
export const engineerTree = builder.build(
  builder.switch(
    [
      {
        condition: ctx => cond.isEmpty(ctx),
        node: builder.if(cond.storageHasEnergy(), builder.leaf({ type: "withdraw" }), builder.leaf({ type: "harvest" }))
      },
      { condition: cond.hasDamagedStructures, node: builder.leaf({ type: "repair" }) }
    ],
    builder.leaf({ type: "build" })
  )
);

/**
 * Remote Worker - Multi-purpose remote room worker.
 */
builder.reset();
export const remoteWorkerTree = builder.build(
  builder.switch(
    [
      {
        condition: shouldMoveToTarget,
        node: builder.leaf({ type: "moveTo", target: "targetRoom" })
      },
      { condition: cond.hasFreeCapacity, node: builder.leaf({ type: "harvest" }) },
      { condition: cond.hasConstructionSites, node: builder.leaf({ type: "build" }) },
      { condition: cond.hasDamagedStructures, node: builder.leaf({ type: "repair" }) }
    ],
    builder.leaf({ type: "upgrade" })
  )
);

// ============ Power Creep Role Trees ============

/**
 * Power Queen - Economy-focused power creep behavior.
 */
builder.reset();
export const powerQueenTree = builder.build(
  builder.switch(
    [
      {
        condition: shouldMoveToTarget,
        node: builder.leaf({ type: "moveTo", target: "targetRoom" })
      },
      { condition: cond.hasDroppedPower, node: builder.leaf({ type: "pickup" }) },
      {
        condition: ctx => ctx.creep.store.getUsedCapacity(RESOURCE_POWER) > 0,
        node: builder.leaf({ type: "managePower" })
      },
      { condition: cond.powerSpawnNeedsPower, node: builder.leaf({ type: "managePower" }) },
      { condition: cond.powerSpawnNeedsEnergy, node: builder.leaf({ type: "managePower" }) }
    ],
    builder.leaf({ type: "transfer" })
  )
);

/**
 * Power Warrior - Combat-support power creep.
 */
builder.reset();
export const powerWarriorTree = builder.build(
  builder.switch(
    [
      {
        condition: shouldMoveToTarget,
        node: builder.leaf({ type: "moveTo", target: "targetRoom" })
      },
      { condition: cond.hasEnemies, node: builder.leaf({ type: "attack" }) },
      {
        condition: ctx => {
          const powerBank = ctx.creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_POWER_BANK
          })[0];
          return !!powerBank;
        },
        node: builder.leaf({ type: "attack" })
      }
    ],
    builder.leaf({ type: "patrol" })
  )
);

// ============ Role Tree Registry ============

/**
 * Map of role names to their decision trees.
 */
export const roleTrees: Record<string, DecisionTree<SwarmCreepContext, SwarmAction>> = {
  larvaWorker: larvaWorkerTree,
  harvester: harvesterTree,
  hauler: haulerTree,
  upgrader: upgraderTree,
  foragerAnt: foragerAntTree,
  builderAnt: builderAntTree,
  queenCarrier: queenCarrierTree,
  mineralHarvester: mineralHarvesterTree,
  depositHarvester: depositHarvesterTree,
  terminalManager: terminalManagerTree,
  scoutAnt: scoutAntTree,
  claimAnt: claimAntTree,
  guardAnt: guardAntTree,
  healerAnt: healerAntTree,
  soldierAnt: soldierAntTree,
  engineer: engineerTree,
  remoteWorker: remoteWorkerTree,
  siegeUnit: siegeUnitTree,
  linkManager: linkManagerTree,
  factoryWorker: factoryWorkerTree,
  labTech: labTechTree,
  powerQueen: powerQueenTree,
  powerWarrior: powerWarriorTree
};

/**
 * Gets the decision tree for a given role.
 */
export function getTreeForRole(role: string): DecisionTree<SwarmCreepContext, SwarmAction> {
  return roleTrees[role] ?? larvaWorkerTree;
}
