/**
 * Example: Harvester Creep Decision Tree
 *
 * This example demonstrates how to use screeps-xtree to create
 * a decision tree for a harvester creep that:
 * - Harvests when empty
 * - Builds when full and construction sites exist
 * - Upgrades when full and no construction sites
 * - Flees when enemies are nearby
 */

import {
  DecisionTreeBuilder,
  CreepConditions,
  createCreepContext,
  type CreepDecisionContext,
  type CreepAction
} from "../src/index.js";

// Build the harvester decision tree
const builder = new DecisionTreeBuilder<CreepDecisionContext, CreepAction>();

export const harvesterTree = builder.build(
  builder.switch(
    [
      // Priority 1: Flee from enemies if nearby
      {
        condition: CreepConditions.enemiesNearby,
        node: builder.leaf({ type: "flee", direction: TOP })
      },
      // Priority 2: Harvest when empty and energy available
      {
        condition: ctx => CreepConditions.isEmpty(ctx) && CreepConditions.hasEnergySources(ctx),
        node: builder.leaf({ type: "harvest", target: {} as Source })
      },
      // Priority 3: Build when full and construction sites exist
      {
        condition: ctx => CreepConditions.isFull(ctx) && CreepConditions.hasConstructionSites(ctx),
        node: builder.leaf({ type: "build", target: {} as ConstructionSite })
      }
    ],
    // Default: Upgrade controller when full
    builder.leaf({ type: "upgrade", target: {} as StructureController })
  )
);

// Example usage in game loop
export function runHarvester(creep: Creep): void {
  // Create decision context
  const context = createCreepContext(creep);

  // Evaluate decision tree
  const action = harvesterTree.evaluate(context);

  // Execute the decided action
  executeAction(creep, action);
}

// Helper function to execute actions
function executeAction(creep: Creep, action: CreepAction): void {
  switch (action.type) {
    case "harvest": {
      const sources = creep.room.find(FIND_SOURCES);
      if (sources.length > 0) {
        const source = creep.pos.findClosestByPath(sources);
        if (source) {
          if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
          }
        }
      }
      break;
    }

    case "build": {
      const sites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
      if (sites.length > 0) {
        const site = creep.pos.findClosestByPath(sites);
        if (site) {
          if (creep.build(site) === ERR_NOT_IN_RANGE) {
            creep.moveTo(site, { visualizePathStyle: { stroke: "#ffffff" } });
          }
        }
      }
      break;
    }

    case "upgrade": {
      if (creep.room.controller) {
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#0000ff" } });
        }
      }
      break;
    }

    case "repair": {
      const damagedStructures = creep.room.find(FIND_STRUCTURES, {
        filter: s => s.hits < s.hitsMax
      });
      if (damagedStructures.length > 0) {
        const target = creep.pos.findClosestByPath(damagedStructures);
        if (target) {
          if (creep.repair(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: "#00ff00" } });
          }
        }
      }
      break;
    }

    case "flee": {
      const hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 10);
      if (hostiles.length > 0) {
        const fleeFrom = hostiles[0];
        const path = PathFinder.search(creep.pos, { pos: fleeFrom.pos, range: 5 }, { flee: true });
        if (path.path.length > 0) {
          creep.moveByPath(path.path);
        }
      }
      break;
    }

    case "idle":
      // Do nothing
      break;
  }
}

// Example: Main loop integration
export function loop(): void {
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];

    // Only run harvester logic for harvester role
    if (creep.memory.role === "harvester") {
      runHarvester(creep);
    }
  }
}
