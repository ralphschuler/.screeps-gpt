# Task Management System

## Overview

This task management system is based on Jon Winsley's comprehensive guide for Screeps AI development. It implements a modern, flexible architecture that separates task definitions from creep behavior, enabling better coordination and scalability.

## Core Concepts

### TaskAction

Represents a specific action to be performed by a creep. Each task action includes:

- **Prerequisites**: Conditions that must be met before the task can be executed
- **Action Function**: The actual work to be performed each tick
- **Completion Logic**: Determines when the task is complete

```typescript
import { HarvestAction } from "@runtime/tasks";

const harvestTask = new HarvestAction(source.id);
```

### TaskPrerequisite

Defines requirements that a creep must meet to execute a task. Built-in prerequisites include:

- `MinionCanWork`: Creep has WORK body parts
- `MinionCanCarry`: Creep has CARRY body parts
- `MinionHasEnergy`: Creep has minimum energy amount
- `MinionHasFreeCapacity`: Creep has free capacity
- `MinionIsNear`: Creep is within range of target

```typescript
import { MinionCanWork, MinionHasEnergy } from "@runtime/tasks";

// Example: Build task requires WORK parts and energy
const prereqs = [new MinionCanWork(), new MinionHasEnergy(50)];
```

### TaskRequest

Wraps a TaskAction with metadata for scheduling and assignment:

- **ID**: Unique identifier
- **Priority**: Numeric priority (higher = more important)
- **Status**: PENDING, INPROCESS, or COMPLETE
- **Deadline**: Optional expiration time
- **Assigned Creep**: Creep currently working on the task

```typescript
import { TaskRequest, TaskPriority, BuildAction } from "@runtime/tasks";

const task = new TaskRequest(
  "build-spawn-1",
  new BuildAction(site.id),
  TaskPriority.HIGH,
  Game.time + 100 // deadline
);
```

### TaskManager

Coordinates task generation, assignment, and execution for a room:

```typescript
import { TaskManager } from "@runtime/tasks";

const taskManager = new TaskManager();

// Generate tasks based on room state
taskManager.generateTasks(room);

// Assign tasks to idle creeps
const creeps = room.find(FIND_MY_CREEPS);
taskManager.assignTasks(creeps);

// Execute tasks
const taskCounts = taskManager.executeTasks(creeps);
```

## Available Task Types

### HarvestAction

Harvest energy from a source until full.

**Prerequisites**:

- `MinionCanWork`: Requires WORK body parts
- `MinionHasFreeCapacity`: Requires free capacity

**Usage**:

```typescript
const task = new HarvestAction(source.id);
```

### BuildAction

Build a construction site until out of energy or site complete.

**Prerequisites**:

- `MinionCanWork`: Requires WORK body parts
- `MinionHasEnergy`: Requires energy

**Usage**:

```typescript
const task = new BuildAction(constructionSite.id);
```

### RepairAction

Repair a structure until out of energy or structure fully repaired.

**Prerequisites**:

- `MinionCanWork`: Requires WORK body parts
- `MinionHasEnergy`: Requires energy

**Usage**:

```typescript
const task = new RepairAction(structure.id);
```

### UpgradeAction

Upgrade controller until out of energy.

**Prerequisites**:

- `MinionCanWork`: Requires WORK body parts
- `MinionHasEnergy`: Requires energy

**Usage**:

```typescript
const task = new UpgradeAction(controller.id);
```

### TransferAction

Transfer resources to a structure until empty or target full.

**Prerequisites**:

- `MinionCanCarry`: Requires CARRY body parts
- `MinionHasEnergy`: Requires energy (for RESOURCE_ENERGY)

**Usage**:

```typescript
const task = new TransferAction(spawn.id, RESOURCE_ENERGY);
```

### WithdrawAction

Withdraw resources from a structure until full or source empty.

**Prerequisites**:

- `MinionCanCarry`: Requires CARRY body parts
- `MinionHasFreeCapacity`: Requires free capacity

**Usage**:

```typescript
const task = new WithdrawAction(storage.id, RESOURCE_ENERGY);
```

## Integration Example

```typescript
import { TaskManager } from "@runtime/tasks";

class RoomCoordinator {
  private taskManager = new TaskManager();

  public run(room: Room): void {
    // Generate tasks based on room state
    this.taskManager.generateTasks(room);

    // Get creeps in the room
    const creeps = room.find(FIND_MY_CREEPS);

    // Assign tasks to idle creeps
    this.taskManager.assignTasks(creeps);

    // Execute assigned tasks
    const taskCounts = this.taskManager.executeTasks(creeps);

    // Log task execution stats
    console.log(`Tasks executed:`, taskCounts);
    console.log(`Task stats:`, this.taskManager.getStats());
  }
}
```

## Task Priorities

The system includes predefined priority levels:

```typescript
export const TaskPriority = {
  CRITICAL: 100, // Immediate attention required
  HIGH: 75, // Important tasks (spawning, defense)
  NORMAL: 50, // Regular tasks (harvesting, building)
  LOW: 25, // Low priority (repair, upgrade)
  IDLE: 0 // Filler tasks when nothing else to do
};
```

## Best Practices

### 1. Task Generation

- Generate tasks based on room state, not individual creep needs
- Use deadlines to prevent task accumulation
- Limit task creation to avoid memory overhead

### 2. Task Assignment

- Let the system handle prerequisite validation
- Creeps check `canAssign()` before accepting tasks
- Failed assignments don't change task state

### 3. Task Execution

- Tasks run each tick until complete
- Completion is determined by the action's logic
- Failed tasks are cleaned up automatically

### 4. Memory Management

- Store task IDs in creep memory, not full task objects
- Clean up expired tasks regularly
- Remove completed tasks after a brief delay

## Performance Considerations

### CPU Efficiency

- Task generation runs once per room per tick
- Task assignment only for idle creeps
- Task execution is O(1) per creep

### Memory Usage

- Tasks stored in `TaskManager` instance (not Memory)
- Only task IDs stored in creep memory
- Automatic cleanup of completed/expired tasks

## Extension Points

### Creating Custom Tasks

```typescript
import { TaskAction, TaskPrerequisite, MinionCanWork } from "@runtime/tasks";

export class CustomAction extends TaskAction {
  public prereqs: TaskPrerequisite[];
  private targetId: Id<Structure>;

  public constructor(targetId: Id<Structure>) {
    super();
    this.targetId = targetId;
    this.prereqs = [new MinionCanWork()];
  }

  public action(creep: Creep): boolean {
    const target = Game.getObjectById(this.targetId);
    if (!target) {
      return true; // Task complete (target gone)
    }

    // Implement custom logic here
    const result = creep.customAction(target);

    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, target, 1);
      return false; // Not complete, continue
    }

    return result === OK; // Complete if successful
  }
}
```

### Creating Custom Prerequisites

```typescript
import { TaskPrerequisite, TaskAction } from "@runtime/tasks";

export class MinionHasBoost extends TaskPrerequisite {
  private boostType: MineralBoostConstant;

  public constructor(boostType: MineralBoostConstant) {
    super();
    this.boostType = boostType;
  }

  public meets(creep: Creep): boolean {
    return creep.body.some(part => part.boost === this.boostType);
  }

  public toMeet(_creep: Creep): TaskAction[] {
    // Could return task to get boost from lab
    return [];
  }
}
```

## Architecture Principles

This implementation follows Jon Winsley's key design principles:

1. **Separation of Concerns**: Tasks define what to do, not how creeps should behave
2. **Composability**: Prerequisites and actions are reusable building blocks
3. **Transparency**: Task state and assignment logic are explicit and debuggable
4. **Performance**: Minimal CPU overhead through efficient task matching
5. **Determinism**: Predictable behavior for testing and validation

## References

- [Jon Winsley's Task Management Guide](https://jonwinsley.com/notes/screeps-task-management)
- [Strategic Directives](https://jonwinsley.com/notes/screeps-strategic-directives)
- [Decision Making](https://jonwinsley.com/notes/screeps-decision-making)

## Related Documentation

- [Creep Roles](./creep-roles.md) - Traditional role-based patterns
- [Task Prioritization](./task-prioritization.md) - Priority system details
- [Scaling Strategies](./scaling-strategies.md) - Multi-room coordination
