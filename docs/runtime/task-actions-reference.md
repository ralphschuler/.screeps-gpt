# Task Actions Reference

This document provides a comprehensive reference for all task actions available in the task system. The task system is based on Jon Winsley's task management architecture and has been extended to cover all major Screeps game scenarios.

## Overview

Task actions represent specific operations that creeps (or structures) can perform. Each task action:
- Has prerequisites that must be met before execution
- Implements an `action()` method that performs the work
- Returns `true` when complete, `false` to continue
- Provides a target position for distance-based task assignment

## Task Action Categories

### Resource Gathering

#### HarvestAction
Harvests energy from a source.

**Prerequisites:**
- Creep has free capacity
- Creep has WORK body parts

**Usage:**
```typescript
const task = new HarvestAction(sourceId);
```

#### PickupAction
Picks up a dropped resource from the ground.

**Prerequisites:**
- Creep has free capacity
- Creep has CARRY body parts

**Usage:**
```typescript
const task = new PickupAction(resourceId);
```

#### WithdrawAction
Withdraws resources from a structure (storage, container, etc.).

**Prerequisites:**
- Creep has free capacity
- Creep has CARRY body parts

**Usage:**
```typescript
const task = new WithdrawAction(structureId, RESOURCE_ENERGY);
```

### Resource Distribution

#### TransferAction
Transfers resources to a structure (spawn, extension, storage, etc.).

**Prerequisites:**
- Creep has CARRY body parts
- Creep has the resource to transfer (e.g., energy)

**Usage:**
```typescript
const task = new TransferAction(structureId, RESOURCE_ENERGY);
```

#### DropAction
Drops resources at the creep's current position.

**Prerequisites:** None

**Usage:**
```typescript
const task = new DropAction(RESOURCE_ENERGY, amount);
```

### Construction & Maintenance

#### BuildAction
Builds a construction site.

**Prerequisites:**
- Creep has energy
- Creep has WORK body parts

**Usage:**
```typescript
const task = new BuildAction(constructionSiteId);
```

#### RepairAction
Repairs a damaged structure.

**Prerequisites:**
- Creep has energy
- Creep has WORK body parts

**Usage:**
```typescript
const task = new RepairAction(structureId);
```

#### DismantleAction
Dismantles a structure to recover resources.

**Prerequisites:**
- Creep has WORK body parts

**Usage:**
```typescript
const task = new DismantleAction(structureId);
```

#### PlaceConstructionSiteAction
Places a construction site at a specific position.

**Prerequisites:** None

**Usage:**
```typescript
const task = new PlaceConstructionSiteAction(roomPosition, STRUCTURE_ROAD);
```

### Room Control

#### UpgradeAction
Upgrades the room controller.

**Prerequisites:**
- Creep has energy
- Creep has WORK body parts

**Usage:**
```typescript
const task = new UpgradeAction(controllerId);
```

#### ClaimAction
Claims a controller in a new room.

**Prerequisites:**
- Creep has CLAIM body parts

**Usage:**
```typescript
const task = new ClaimAction(controllerId);
```

#### ReserveAction
Reserves a controller in a neutral room.

**Prerequisites:**
- Creep has CLAIM body parts

**Usage:**
```typescript
const task = new ReserveAction(controllerId);
```

#### SignControllerAction
Signs a controller with a custom message.

**Prerequisites:** None

**Usage:**
```typescript
const task = new SignControllerAction(controllerId, "My colony!");
```

### Combat Operations

#### AttackAction
Attacks a hostile creep or structure with melee attack.

**Prerequisites:**
- Creep has ATTACK body parts

**Usage:**
```typescript
const task = new AttackAction(targetId);
```

#### RangedAttackAction
Attacks a hostile creep or structure with ranged attack.

**Prerequisites:**
- Creep has RANGED_ATTACK body parts

**Usage:**
```typescript
const task = new RangedAttackAction(targetId);
```

#### HealAction
Heals a friendly creep (melee range).

**Prerequisites:**
- Creep has HEAL body parts

**Usage:**
```typescript
const task = new HealAction(targetCreepId);
```

#### RangedHealAction
Heals a friendly creep (ranged).

**Prerequisites:**
- Creep has HEAL body parts

**Usage:**
```typescript
const task = new RangedHealAction(targetCreepId);
```

### Tower Operations

#### TowerAttackAction
Commands a tower to attack a hostile creep or structure.

**Prerequisites:** None (tower-based action)

**Usage:**
```typescript
const task = new TowerAttackAction(towerId, targetId);
```

#### TowerHealAction
Commands a tower to heal a friendly creep.

**Prerequisites:** None (tower-based action)

**Usage:**
```typescript
const task = new TowerHealAction(towerId, targetCreepId);
```

#### TowerRepairAction
Commands a tower to repair a structure.

**Prerequisites:** None (tower-based action)

**Usage:**
```typescript
const task = new TowerRepairAction(towerId, structureId);
```

### Lab Operations

#### BoostCreepAction
Boosts a creep with a mineral compound at a lab. The lab must already have the appropriate mineral compound loaded.

**Prerequisites:** None

**Usage:**
```typescript
const task = new BoostCreepAction(labId);
```

#### RunReactionAction
Runs a chemical reaction at a lab using two input labs.

**Prerequisites:** None (lab-based action)

**Usage:**
```typescript
const task = new RunReactionAction(outputLabId, inputLab1Id, inputLab2Id);
```

### Link Operations

#### LinkTransferAction
Transfers energy from one link to another.

**Prerequisites:** None (link-based action)

**Usage:**
```typescript
const task = new LinkTransferAction(sourceLinkId, targetLinkId);
```

### Movement & Utility

#### MoveAction
Moves a creep to a specific position.

**Prerequisites:** None

**Usage:**
```typescript
const task = new MoveAction(targetPosition, range);
```

#### RecycleAction
Returns a creep to spawn to be recycled.

**Prerequisites:** None

**Usage:**
```typescript
const task = new RecycleAction(spawnId);
```

### Spawn Operations

#### SpawnAction
Spawns a new creep at a spawn.

**Prerequisites:** None (spawn-based action)

**Usage:**
```typescript
const task = new SpawnAction(
  spawnId,
  [WORK, CARRY, MOVE],
  "Harvester1",
  { role: "harvester" }
);
```

### Emergency Operations

#### GenerateSafeModeAction
Generates safe mode at the controller (requires special conditions).

**Prerequisites:** None

**Usage:**
```typescript
const task = new GenerateSafeModeAction(controllerId);
```

## Task Priority Levels

The `TaskPriority` constant provides standard priority levels:

```typescript
TaskPriority.CRITICAL  // 100 - Emergency operations
TaskPriority.HIGH      // 75  - High priority tasks
TaskPriority.NORMAL    // 50  - Standard tasks
TaskPriority.LOW       // 25  - Background tasks
TaskPriority.IDLE      // 0   - Idle/optional tasks
```

## Task Manager Integration

The TaskManager automatically generates tasks based on room state:

- **Harvest Tasks**: Generated for active sources
- **Build Tasks**: Generated for construction sites
- **Repair Tasks**: Generated for damaged structures
- **Upgrade Tasks**: Generated for the room controller
- **Energy Distribution**: Generated for spawns and extensions
- **Pickup Tasks**: Generated for dropped resources
- **Recycle Tasks**: Generated for old or wounded creeps
- **Tower Tasks**: Generated for defense and repair
- **Link Tasks**: Generated for energy transfer

## Creating Custom Task Actions

To create a custom task action:

1. Extend the `TaskAction` abstract class
2. Implement required properties and methods
3. Add appropriate prerequisites
4. Export from `index.ts`

Example:

```typescript
export class CustomAction extends TaskAction {
  public prereqs: TaskPrerequisite[];
  
  public constructor(targetId: Id<Structure>) {
    super();
    this.prereqs = [new MinionHasEnergy()];
  }
  
  public getTargetPos(): RoomPosition | null {
    // Return target position for distance calculations
  }
  
  public action(creep: Creep): boolean {
    // Implement action logic
    // Return true when complete, false to continue
  }
}
```

## Best Practices

1. **Prerequisites**: Always define appropriate prerequisites to ensure tasks are assigned to capable creeps
2. **Completion**: Return `true` when task is complete, `false` to continue next tick
3. **Target Position**: Implement `getTargetPos()` for distance-based assignment optimization
4. **Error Handling**: Handle missing targets gracefully and return `true` to complete
5. **Movement**: Use `moveToTarget()` helper for consistent pathfinding behavior
6. **Priority**: Set appropriate priority levels based on task urgency

## See Also

- [TaskRequest](../../packages/bot/src/runtime/tasks/TaskRequest.ts) - Task wrapper with status and priority
- [TaskManager](../../packages/bot/src/runtime/tasks/TaskManager.ts) - Task generation and assignment
- [TaskPrerequisite](../../packages/bot/src/runtime/tasks/TaskPrerequisite.ts) - Prerequisite definitions
