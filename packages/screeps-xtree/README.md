# @ralphschuler/screeps-xtree

A lightweight decision tree framework optimized for the Screeps runtime environment. Provides structured decision-making capabilities with minimal CPU overhead (<0.1 CPU per evaluation).

## Features

- ✅ **Multiple Node Types**: If, Switch, Leaf, and Noop nodes for flexible decision structures
- ✅ **Type-Safe**: Full TypeScript support with generics for context and results
- ✅ **CPU Efficient**: Minimal overhead for real-time game loop execution
- ✅ **Builder Pattern**: Fluent API for intuitive tree construction
- ✅ **Screeps Integration**: Pre-built contexts and conditions for common patterns
- ✅ **Composable**: Nested trees and reusable subtrees
- ✅ **Well-Tested**: Comprehensive unit and integration test coverage

## Installation

```bash
npm install @ralphschuler/screeps-xtree
```

## Quick Start

```typescript
import { DecisionTreeBuilder, type CreepDecisionContext, type CreepAction } from "@ralphschuler/screeps-xtree";

const builder = new DecisionTreeBuilder<CreepDecisionContext, CreepAction>();

// Build a simple harvester decision tree
const harvesterTree = builder.build(
  builder.if(
    ctx => ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0,
    // TRUE: Has energy - build or upgrade
    builder.if(
      ctx => ctx.constructionSites > 0,
      builder.leaf({ type: "build", target: {} as ConstructionSite }),
      builder.leaf({ type: "upgrade", target: {} as StructureController })
    ),
    // FALSE: Needs energy - harvest
    builder.leaf({ type: "harvest", target: {} as Source })
  )
);

// Use in game loop
export function runCreep(creep: Creep) {
  const context: CreepDecisionContext = {
    creep,
    room: creep.room,
    energyAvailable: creep.room.find(FIND_SOURCES).length > 0,
    nearbyEnemies: creep.pos.findInRange(FIND_HOSTILE_CREEPS, 10).length > 0,
    constructionSites: creep.room.find(FIND_MY_CONSTRUCTION_SITES).length,
    damagedStructures: creep.room.find(FIND_STRUCTURES, {
      filter: s => s.hits < s.hitsMax
    }).length
  };

  const action = harvesterTree.evaluate(context);
  executeAction(creep, action);
}
```

## Core Concepts

### Node Types

#### If Node

Binary decision based on a boolean condition. Follows one of two branches.

```typescript
builder.if(
  ctx => ctx.value > 10,
  builder.leaf("high"), // true branch
  builder.leaf("low") // false branch
);
```

#### Switch Node

Multi-way decision that evaluates conditions in order. Follows the first matching case or default.

```typescript
builder.switch(
  [
    { condition: ctx => ctx.value < 0, node: builder.leaf("negative") },
    { condition: ctx => ctx.value < 10, node: builder.leaf("low") },
    { condition: ctx => ctx.value < 100, node: builder.leaf("medium") }
  ],
  builder.leaf("high") // default
);
```

#### Leaf Node

Terminal node that returns a result without further evaluation.

```typescript
builder.leaf({ type: "harvest", target: source });
```

#### Noop Node

Pass-through node that forwards to another node. Useful for organizing structure or adding debug points.

```typescript
builder.noop(
  builder.leaf("result"),
  "debug-checkpoint" // optional label
);
```

### Builder API

```typescript
const builder = new DecisionTreeBuilder<ContextType, ResultType>();

// Create nodes
builder.if(condition, trueNode, falseNode)
builder.switch(cases, defaultNode?)
builder.leaf(result)
builder.noop(nextNode, label?)

// Build tree
const tree = builder.build(rootNode);

// Evaluate
const result = tree.evaluate(context);

// Reset for new tree
builder.reset();
```

## Screeps Integration

### Predefined Contexts

#### CreepDecisionContext

```typescript
interface CreepDecisionContext {
  creep: Creep;
  room: Room;
  energyAvailable: boolean;
  nearbyEnemies: boolean;
  constructionSites: number;
  damagedStructures: number;
}
```

#### CreepAction

```typescript
type CreepAction =
  | { type: "harvest"; target: Source }
  | { type: "upgrade"; target: StructureController }
  | { type: "build"; target: ConstructionSite }
  | { type: "repair"; target: Structure }
  | { type: "flee"; direction: DirectionConstant }
  | { type: "idle" };
```

### Helper Conditions

Pre-built condition functions for common checks:

```typescript
import { CreepConditions } from "@ralphschuler/screeps-xtree";

builder.if(CreepConditions.isEmpty /* ... */);
builder.if(CreepConditions.isFull /* ... */);
builder.if(CreepConditions.hasFreeCapacity /* ... */);
builder.if(CreepConditions.isDamaged /* ... */);
builder.if(CreepConditions.hasConstructionSites /* ... */);
builder.if(CreepConditions.hasRepairTargets /* ... */);
builder.if(CreepConditions.enemiesNearby /* ... */);
builder.if(CreepConditions.hasEnergySources /* ... */);
```

### Modular Conditions

The package provides an extended library of reusable condition functions (parallel to xstate guards):

```typescript
import { conditions } from "@ralphschuler/screeps-xtree";

// Energy conditions
conditions.hasEnergy(50); // Check if creep has > 50 energy
conditions.isFull; // ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
conditions.isEmpty; // ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0
conditions.hasCapacityPercent(50); // Check if >= 50% capacity

// Position conditions
conditions.isNearTarget(3); // Within 3 tiles of target
conditions.isAtTarget; // At exact target position
conditions.hasTarget; // Target is defined
conditions.isInRoom("W1N1"); // In specific room

// Creep conditions
conditions.hasWorkParts; // Has WORK body parts
conditions.hasCarryParts; // Has CARRY body parts
conditions.isDamaged; // hits < hitsMax
conditions.isHealthBelow(30); // health < 30%
conditions.hasRoleType("harvester"); // Check role

// Room conditions
conditions.hasConstructionSites; // ctx.constructionSites > 0
conditions.hasRepairTargets; // ctx.damagedStructures > 0
conditions.enemiesNearby; // ctx.nearbyEnemies
conditions.hasEnergySources; // ctx.energyAvailable
```

Use conditions in decision trees:

```typescript
const builder = new DecisionTreeBuilder<CreepDecisionContext, CreepAction>();

const tree = builder.build(
  builder.if(
    conditions.isFull,
    builder.leaf({ type: "deliver" }),
    builder.leaf({ type: "harvest" })
  )
);
```

### Modular Actions

The package provides reusable action functions for executing creep behaviors:

```typescript
import { treeActions } from "@ralphschuler/screeps-xtree";

// Movement actions
treeActions.moveToTarget(ctx, { range: 1 }); // Move toward ctx.target
treeActions.flee(ctx); // Move away from hostile creeps

// Energy actions
treeActions.harvestSource(ctx); // Harvest from ctx.target or ctx.sourceId
treeActions.harvestNearestSource(ctx); // Find and harvest nearest source
treeActions.transferEnergy(ctx); // Transfer to ctx.target
treeActions.withdrawEnergy(ctx); // Withdraw from ctx.target
treeActions.transferToSpawns(ctx); // Find spawn/extension and transfer

// Work actions
treeActions.upgradeController(ctx); // Upgrade room controller
treeActions.buildStructure(ctx); // Build ctx.target or nearest site
treeActions.repairStructure(ctx); // Repair ctx.target or most damaged
treeActions.attackTarget(ctx); // Attack ctx.target
treeActions.healTarget(ctx); // Heal ctx.target creep
```

## Usage Examples

### Example 1: Multi-Role Worker

```typescript
import { DecisionTreeBuilder, CreepConditions } from "@ralphschuler/screeps-xtree";

const builder = new DecisionTreeBuilder<CreepDecisionContext, CreepAction>();

const workerTree = builder.build(
  builder.switch(
    [
      // Priority 1: Flee from enemies
      {
        condition: CreepConditions.enemiesNearby,
        node: builder.leaf({ type: "flee", direction: TOP })
      },
      // Priority 2: Harvest when empty
      {
        condition: ctx => CreepConditions.isEmpty(ctx) && CreepConditions.hasEnergySources(ctx),
        node: builder.leaf({ type: "harvest", target: {} as Source })
      },
      // Priority 3: Repair damaged structures
      {
        condition: ctx => !CreepConditions.isEmpty(ctx) && CreepConditions.hasRepairTargets(ctx),
        node: builder.leaf({ type: "repair", target: {} as Structure })
      },
      // Priority 4: Build construction sites
      {
        condition: ctx => !CreepConditions.isEmpty(ctx) && CreepConditions.hasConstructionSites(ctx),
        node: builder.leaf({ type: "build", target: {} as ConstructionSite })
      }
    ],
    // Default: Upgrade controller
    builder.leaf({ type: "upgrade", target: {} as StructureController })
  )
);
```

### Example 2: Nested Decision Tree

```typescript
const builder = new DecisionTreeBuilder<CreepDecisionContext, CreepAction>();

const complexTree = builder.build(
  builder.if(
    CreepConditions.enemiesNearby,
    // Combat mode
    builder.if(
      CreepConditions.isDamaged,
      builder.leaf({ type: "flee", direction: TOP }),
      builder.leaf({ type: "idle" })
    ),
    // Normal operations
    builder.if(
      CreepConditions.isEmpty,
      // Needs energy
      builder.leaf({ type: "harvest", target: {} as Source }),
      // Has energy - prioritize tasks
      builder.switch(
        [
          {
            condition: CreepConditions.hasRepairTargets,
            node: builder.leaf({ type: "repair", target: {} as Structure })
          },
          {
            condition: CreepConditions.hasConstructionSites,
            node: builder.leaf({ type: "build", target: {} as ConstructionSite })
          }
        ],
        builder.leaf({ type: "upgrade", target: {} as StructureController })
      )
    )
  )
);
```

### Example 3: Room Management

```typescript
import type { RoomDecisionContext, RoomAction } from "@ralphschuler/screeps-xtree";

const builder = new DecisionTreeBuilder<RoomDecisionContext, RoomAction>();

const roomTree = builder.build(
  builder.switch(
    [
      {
        condition: ctx => ctx.hostileCount > 0,
        node: builder.leaf({ type: "defend", priority: "high" })
      },
      {
        condition: ctx => ctx.ownedCreeps < 5,
        node: builder.leaf({ type: "spawn", role: "harvester" })
      },
      {
        condition: ctx => ctx.rcl >= 3 && ctx.energyAvailable > 1000,
        node: builder.leaf({ type: "expand", targetRoom: "W1N2" })
      }
    ],
    builder.leaf({ type: "economy" })
  )
);
```

### Example 4: Using Noop for Organization

```typescript
const builder = new DecisionTreeBuilder<CreepDecisionContext, CreepAction>();

const tree = builder.build(
  builder.noop(
    builder.if(
      CreepConditions.isEmpty,
      builder.noop(builder.leaf({ type: "harvest", target: {} as Source }), "harvest-branch"),
      builder.noop(builder.leaf({ type: "upgrade", target: {} as StructureController }), "work-branch")
    ),
    "root"
  )
);

// Useful for debugging - noop nodes preserve structure
console.log(tree.getRoot().type); // "noop"
```

## Performance

Decision tree evaluation is highly efficient:

- **If node**: ~0.005 CPU per evaluation
- **Switch node**: ~0.01 CPU per case + evaluation
- **Leaf node**: ~0.001 CPU (returns immediately)
- **Noop node**: ~0.001 CPU (pass-through)

A typical creep decision with 5-10 nodes uses **<0.05 CPU total**.

## Best Practices

### 1. Reuse Trees Across Creeps

Define trees once and reuse them:

```typescript
// trees.ts
export const harvesterTree = new DecisionTreeBuilder<CreepDecisionContext, CreepAction>().build(/* ... */);

// main.ts
for (const name in Game.creeps) {
  const action = harvesterTree.evaluate(createContext(Game.creeps[name]));
  executeAction(Game.creeps[name], action);
}
```

### 2. Order Switch Cases by Priority

Place most important conditions first:

```typescript
builder.switch([
  { condition: checkEmergency, node: emergencyNode }, // Check critical first
  { condition: checkHigh, node: highPriorityNode },
  { condition: checkLow, node: lowPriorityNode }
]);
```

### 3. Use Noop for Debugging

Add noop nodes with labels to trace execution:

```typescript
builder.noop(complexSubtree, "before-complex-subtree");
```

### 4. Separate Context Creation

Create context once per creep per tick:

```typescript
const context = createCreepContext(creep);
const action1 = tree1.evaluate(context);
const action2 = tree2.evaluate(context); // Reuse context
```

## Composability

`screeps-xtree` provides powerful utilities for creating reusable and composable decision tree patterns.

### Subtree Factories

Create parameterized decision subtrees:

```typescript
import { createSubtreeFactory, DecisionTreeBuilder } from "@ralphschuler/screeps-xtree";

const createThresholdCheck = createSubtreeFactory<Context, Action, { threshold: number }>(({ threshold }) => {
  const builder = new DecisionTreeBuilder<Context, Action>();
  return builder.if(ctx => ctx.value > threshold, builder.leaf({ type: "high" }), builder.leaf({ type: "low" }));
});

// Use with different parameters
const highThreshold = createThresholdCheck({ threshold: 75 });
const lowThreshold = createThresholdCheck({ threshold: 25 });
```

### Condition Combinators

Combine conditions with logical operators:

```typescript
import { andConditions, orConditions, notCondition } from "@ralphschuler/screeps-xtree";

// AND: All conditions must be true
const needsEnergyAndSafe = andConditions(
  ctx => ctx.energy < 50,
  ctx => !ctx.underAttack
);

// OR: Any condition can be true
const criticalOrEmergency = orConditions(
  ctx => ctx.health < 100,
  ctx => ctx.emergency
);

// NOT: Negate a condition
const notDisabled = notCondition(ctx => ctx.disabled);
```

### Switch Case Helpers

Create switch-case patterns easily:

```typescript
import { createSwitchCases, DecisionTreeBuilder } from "@ralphschuler/screeps-xtree";

const builder = new DecisionTreeBuilder<Context, Action>();

const prioritySwitch = createSwitchCases(
  builder,
  [
    { condition: ctx => ctx.priority === "critical", result: { type: "emergency" } },
    { condition: ctx => ctx.priority === "high", result: { type: "urgent" } },
    { condition: ctx => ctx.priority === "medium", result: { type: "normal" } }
  ],
  { type: "idle" } // default
);
```

### Wrapping Subtrees

Conditionally execute complex subtrees:

```typescript
import { wrapWithCondition, DecisionTreeBuilder } from "@ralphschuler/screeps-xtree";

const builder = new DecisionTreeBuilder<Context, Action>();

// Complex decision logic
const expensiveSubtree = builder.switch([
  // ... many conditions
]);

// Only evaluate if enabled
const wrapped = wrapWithCondition(
  builder,
  ctx => ctx.enabled,
  expensiveSubtree,
  { type: "idle" } // fallback
);
```

### Composition Example: Reusable Creep Behaviors

```typescript
import {
  createSubtreeFactory,
  andConditions,
  createPriorityTree,
  DecisionTreeBuilder
} from "@ralphschuler/screeps-xtree";

// Create reusable energy check
const createEnergyCheck = createSubtreeFactory<Context, Action, { threshold: number }>(({ threshold }) => {
  const builder = new DecisionTreeBuilder<Context, Action>();
  return builder.if(ctx => ctx.energy > threshold, builder.leaf({ type: "work" }), builder.leaf({ type: "harvest" }));
});

// Create role-specific priorities
const createRoleTree = createSubtreeFactory<Context, Action, { energyThreshold: number; primaryTask: Action }>(
  ({ energyThreshold, primaryTask }) => {
    const builder = new DecisionTreeBuilder<Context, Action>();

    return createPriorityTree(
      builder,
      [
        {
          condition: andConditions(
            ctx => ctx.underAttack,
            ctx => ctx.health < 500
          ),
          result: { type: "flee" }
        },
        {
          condition: ctx => ctx.energy > energyThreshold,
          result: primaryTask
        }
      ],
      { type: "harvest" }
    );
  }
);

// Use the factories for different roles
const harvesterTree = createRoleTree({
  energyThreshold: 50,
  primaryTask: { type: "deliver" }
});

const builderTree = createRoleTree({
  energyThreshold: 25,
  primaryTask: { type: "build" }
});
```

## API Reference

### DecisionTree

```typescript
class DecisionTree<TContext, TResult>
```

#### Constructor

```typescript
new DecisionTree(root: DecisionNode<TContext, TResult>)
```

#### Methods

##### `evaluate(context: TContext): TResult`

Evaluates the decision tree with the given context and returns a result.

##### `getRoot(): DecisionNode<TContext, TResult>`

Returns the root node (useful for debugging).

### DecisionTreeBuilder

```typescript
class DecisionTreeBuilder<TContext, TResult>
```

#### Methods

##### `if(condition, trueNode, falseNode): IfNode`

Creates a binary decision node.

##### `switch(cases, defaultNode?): SwitchNode`

Creates a multi-way decision node.

##### `leaf(result): LeafNode`

Creates a terminal node that returns a result.

##### `noop(next, label?): NoopNode`

Creates a pass-through node.

##### `build(root): DecisionTree`

Builds a tree from a root node.

##### `reset(): void`

Resets the node ID counter.

## Error Handling

The framework throws `DecisionTreeError` when:

- A switch node has no matching cases and no default
- An unknown node type is encountered

```typescript
try {
  const result = tree.evaluate(context);
} catch (error) {
  if (error instanceof DecisionTreeError) {
    console.log(`Error at node ${error.nodeId}: ${error.message}`);
  }
}
```

## TypeScript Support

Full TypeScript support with strict typing:

```typescript
interface MyContext {
  value: number;
  flag: boolean;
}

type MyResult = "option1" | "option2" | "option3";

const builder = new DecisionTreeBuilder<MyContext, MyResult>();

// Type-safe conditions
const condition = (ctx: MyContext) => ctx.value > 0;

// Type-safe results
const result: MyResult = tree.evaluate({ value: 5, flag: true });
```

## Contributing

Contributions are welcome! This package is part of the [.screeps-gpt monorepo](https://github.com/ralphschuler/.screeps-gpt).

## License

MIT © OpenAI Automations

## Related Packages

- `@ralphschuler/screeps-xstate` - Finite state machine for Screeps
- `@ralphschuler/screeps-gpt-bot` - Core Screeps AI implementation
- `@ralphschuler/screeps-agent` - Agent-based architecture
