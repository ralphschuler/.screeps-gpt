/**
 * Example: Composable Decision Tree Patterns
 *
 * This example demonstrates how to use composition utilities to create
 * reusable and maintainable decision tree configurations.
 */

import {
  DecisionTreeBuilder,
  createSubtreeFactory,
  createCondition,
  andConditions,
  orConditions,
  notCondition,
  createSwitchCases,
  createPriorityTree,
  wrapWithCondition,
  createResultMapper
} from "../src/index.js";

// ===== Example 1: Subtree Factories =====

interface CreepContext {
  creep: Creep;
  energy: number;
  health: number;
  nearbyEnemies: number;
  nearbyAllies: number;
  constructionSites: number;
  damagedStructures: number;
}

type CreepAction =
  | { type: "harvest" }
  | { type: "build" }
  | { type: "upgrade" }
  | { type: "repair" }
  | { type: "attack" }
  | { type: "heal" }
  | { type: "flee" }
  | { type: "idle" };

// Create a reusable energy check subtree
const createEnergyCheckSubtree = createSubtreeFactory<
  CreepContext,
  CreepAction,
  { fullAction: CreepAction; emptyAction: CreepAction; threshold: number }
>(({ fullAction, emptyAction, threshold }) => {
  const builder = new DecisionTreeBuilder<CreepContext, CreepAction>();
  return builder.if(ctx => ctx.energy > threshold, builder.leaf(fullAction), builder.leaf(emptyAction));
});

// Create a reusable health check subtree
const createHealthCheckSubtree = createSubtreeFactory<
  CreepContext,
  CreepAction,
  { lowHealthAction: CreepAction; healthyAction: CreepAction; threshold: number }
>(({ lowHealthAction, healthyAction, threshold }) => {
  const builder = new DecisionTreeBuilder<CreepContext, CreepAction>();
  return builder.if(ctx => ctx.health < threshold, builder.leaf(lowHealthAction), builder.leaf(healthyAction));
});

// ===== Example 2: Parameterized Conditions =====

// Create a threshold condition factory
const createThresholdCondition = createCondition<CreepContext, { property: keyof CreepContext; threshold: number }>(
  ({ property, threshold }) =>
    ctx =>
      (ctx[property] as number) > threshold
);

// Create specific conditions using the factory
const hasHighEnergy = createThresholdCondition({ property: "energy", threshold: 40 });
const hasLowHealth = createThresholdCondition({ property: "health", threshold: 200 });
const hasEnemiesNearby = createThresholdCondition({ property: "nearbyEnemies", threshold: 0 });

// ===== Example 3: Condition Combinators =====

// Combine conditions for complex logic
const shouldWork = andConditions<CreepContext>(hasHighEnergy, notCondition(hasEnemiesNearby));

const needsHelp = orConditions<CreepContext>(hasLowHealth, ctx => ctx.nearbyAllies < 2);

const canFight = andConditions<CreepContext>(
  ctx => ctx.health > 300,
  hasEnemiesNearby,
  ctx => ctx.energy > 20
);

// ===== Example 4: Priority Trees =====

const builder = new DecisionTreeBuilder<CreepContext, CreepAction>();

// Create a priority-based decision tree
const combatPriorityTree = createPriorityTree(
  builder,
  [
    // Priority 1: Flee if low health
    { condition: hasLowHealth, result: { type: "flee" } },
    // Priority 2: Heal allies if they need help
    { condition: needsHelp, result: { type: "heal" } },
    // Priority 3: Attack if capable
    { condition: canFight, result: { type: "attack" } }
  ],
  { type: "idle" } // Default action
);

// ===== Example 5: Wrapped Subtrees =====

// Create a complex work subtree
builder.reset();
const workSubtree = createSwitchCases(
  builder,
  [
    { condition: ctx => ctx.constructionSites > 0, result: { type: "build" } },
    { condition: ctx => ctx.damagedStructures > 0, result: { type: "repair" } }
  ],
  { type: "upgrade" }
);

// Only use work logic when energy is high and no enemies
builder.reset();
const safeWorkTree = wrapWithCondition(builder, shouldWork, workSubtree, { type: "harvest" });

// ===== Example 6: Complete Composed Tree =====

builder.reset();

// Compose multiple subtrees and conditions into a complete decision tree
const harvesterTree = builder.build(
  builder.if(
    hasEnemiesNearby,
    // Combat mode
    wrapWithCondition(builder, hasLowHealth, builder.leaf({ type: "flee" }), combatPriorityTree),
    // Normal mode
    builder.if(
      hasHighEnergy,
      // Has energy - do work
      workSubtree,
      // No energy - harvest
      builder.leaf({ type: "harvest" })
    )
  )
);

// ===== Example 7: Role-Specific Tree Factories =====

const createRoleTree = createSubtreeFactory<
  CreepContext,
  CreepAction,
  {
    energyThreshold: number;
    primaryTask: CreepAction;
    secondaryTask: CreepAction;
    includeRepair: boolean;
  }
>(({ energyThreshold, primaryTask, secondaryTask, includeRepair }) => {
  const builder = new DecisionTreeBuilder<CreepContext, CreepAction>();

  const energyCheck = createEnergyCheckSubtree({
    threshold: energyThreshold,
    fullAction: primaryTask,
    emptyAction: { type: "harvest" }
  });

  if (includeRepair) {
    return builder.if(
      ctx => ctx.energy > energyThreshold,
      createSwitchCases(
        builder,
        [
          { condition: ctx => ctx.damagedStructures > 0, result: { type: "repair" } },
          { condition: () => true, result: primaryTask }
        ],
        secondaryTask
      ),
      builder.leaf({ type: "harvest" })
    );
  }

  return energyCheck;
});

// Create trees for different roles
export const builderTree = createRoleTree({
  energyThreshold: 25,
  primaryTask: { type: "build" },
  secondaryTask: { type: "upgrade" },
  includeRepair: true
});

export const upgraderTree = createRoleTree({
  energyThreshold: 50,
  primaryTask: { type: "upgrade" },
  secondaryTask: { type: "upgrade" },
  includeRepair: false
});

export const repairerTree = createRoleTree({
  energyThreshold: 30,
  primaryTask: { type: "repair" },
  secondaryTask: { type: "upgrade" },
  includeRepair: true
});

// ===== Example 8: Result Mappers =====

// Create consistent action mappers
const createWorkActionMapper = createResultMapper<CreepContext, CreepAction>(ctx => {
  if (ctx.constructionSites > 5) return { type: "build" };
  if (ctx.damagedStructures > 3) return { type: "repair" };
  return { type: "upgrade" };
});

const createCombatActionMapper = createResultMapper<CreepContext, CreepAction>(ctx => {
  if (ctx.health < 200) return { type: "flee" };
  if (ctx.nearbyAllies < 2) return { type: "heal" };
  return { type: "attack" };
});

// ===== Example 9: Using the Composed Trees =====

export function runComposedCreep(creep: Creep): void {
  // Create context
  const context: CreepContext = {
    creep,
    energy: creep.store.getUsedCapacity(RESOURCE_ENERGY),
    health: creep.hits,
    nearbyEnemies: creep.pos.findInRange(FIND_HOSTILE_CREEPS, 10).length,
    nearbyAllies: creep.pos.findInRange(FIND_MY_CREEPS, 5).length,
    constructionSites: creep.room.find(FIND_MY_CONSTRUCTION_SITES).length,
    damagedStructures: creep.room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax }).length
  };

  // Evaluate the tree based on role
  let action: CreepAction;

  switch (creep.memory.role) {
    case "harvester":
      action = new DecisionTreeBuilder<CreepContext, CreepAction>().build(harvesterTree).evaluate(context);
      break;
    case "builder":
      action = new DecisionTreeBuilder<CreepContext, CreepAction>().build(builderTree).evaluate(context);
      break;
    case "upgrader":
      action = new DecisionTreeBuilder<CreepContext, CreepAction>().build(upgraderTree).evaluate(context);
      break;
    case "repairer":
      action = new DecisionTreeBuilder<CreepContext, CreepAction>().build(repairerTree).evaluate(context);
      break;
    default:
      action = { type: "idle" };
  }

  // Execute the action
  executeAction(creep, action);
}

function executeAction(creep: Creep, action: CreepAction): void {
  switch (action.type) {
    case "harvest": {
      const sources = creep.room.find(FIND_SOURCES);
      if (sources.length > 0) {
        const source = creep.pos.findClosestByPath(sources);
        if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source);
        }
      }
      break;
    }
    case "build": {
      const sites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
      if (sites.length > 0) {
        const site = creep.pos.findClosestByPath(sites);
        if (site && creep.build(site) === ERR_NOT_IN_RANGE) {
          creep.moveTo(site);
        }
      }
      break;
    }
    case "upgrade": {
      if (creep.room.controller && creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller);
      }
      break;
    }
    case "repair": {
      const damaged = creep.room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax });
      if (damaged.length > 0) {
        const target = creep.pos.findClosestByPath(damaged);
        if (target && creep.repair(target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target);
        }
      }
      break;
    }
    case "attack": {
      const enemies = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 10);
      if (enemies.length > 0 && creep.attack(enemies[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(enemies[0]);
      }
      break;
    }
    case "heal": {
      const wounded = creep.pos.findInRange(FIND_MY_CREEPS, 5).filter(c => c.hits < c.hitsMax);
      if (wounded.length > 0 && creep.heal(wounded[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(wounded[0]);
      }
      break;
    }
    case "flee": {
      const enemies = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 10);
      if (enemies.length > 0) {
        const fleeDirection = creep.pos.getDirectionTo(enemies[0]);
        const oppositeDirection = ((fleeDirection + 3) % 8) + 1;
        creep.move(oppositeDirection as DirectionConstant);
      }
      break;
    }
    case "idle":
    default:
      // Do nothing
      break;
  }
}
