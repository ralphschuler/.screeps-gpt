# Enabling the Task Management System

## Overview

The task management system provides priority-based task execution with automatic CPU threshold management. This guide explains how to enable and configure it in your runtime.

## Quick Start

### Basic Integration

To enable the task management system, configure the `BehaviorController` with the `useTaskSystem` flag:

```typescript
import { BehaviorController } from "@runtime/behavior/BehaviorController";

const behavior = new BehaviorController({
  useTaskSystem: true,
  cpuSafetyMargin: 0.8 // 80% CPU threshold
});
```

### Kernel Integration

The task system integrates seamlessly with the kernel:

```typescript
import { createKernel } from "@runtime/bootstrap";

const kernel = createKernel({
  behavior: new BehaviorController({
    useTaskSystem: true,
    cpuSafetyMargin: 0.8
  })
});

export const loop = (): void => {
  kernel.run(Game, Memory);
};
```

## Configuration Options

### CPU Threshold

Control how much CPU the task system can use:

```typescript
const behavior = new BehaviorController({
  useTaskSystem: true,
  cpuSafetyMargin: 0.8 // Stop at 80% CPU usage
});
```

**Recommended values:**

- `0.7` (70%) - Very conservative, good for unstable shards
- `0.8` (80%) - Default, balanced safety and performance
- `0.9` (90%) - Aggressive, maximize CPU usage but riskier

### Dual Mode Operation

The system supports running alongside the legacy role-based system:

```typescript
const behavior = new BehaviorController({
  useTaskSystem: false // Use legacy role-based system
});
```

This allows gradual migration and testing.

## Task System Behavior

### Priority-Based Execution

Tasks are executed in priority order:

1. **CRITICAL (100)** - Emergency tasks (spawning defensive creeps)
2. **HIGH (75)** - Important tasks (energy delivery, construction)
3. **NORMAL (50)** - Regular tasks (harvesting, upgrading)
4. **LOW (25)** - Maintenance tasks (repair, cleanup)
5. **IDLE (0)** - Filler tasks (exploration)

### CPU Budget Management

The system automatically:

- Checks CPU usage before processing each creep
- Stops execution when threshold is reached
- Logs warnings when tasks are skipped
- Prioritizes high-priority tasks

Example output:

```
[TaskManager] CPU threshold reached (78.45/80.00), skipping 5 creep tasks
```

### Task Generation

Tasks are automatically generated based on room state:

- **Harvest Tasks**: For active sources
- **Build Tasks**: For construction sites
- **Repair Tasks**: For damaged structures
- **Upgrade Tasks**: For controller upgrading
- **Energy Distribution**: For spawn/extension filling

### Task Assignment

The system assigns tasks to idle creeps:

1. Check if creep has a valid task
2. Find highest priority available task
3. Verify creep meets prerequisites
4. Assign task if compatible
5. Store task ID in creep memory

### Task Execution

Each tick:

1. Execute assigned task action
2. Check if task is complete
3. Clean up completed/expired tasks
4. Stop if CPU threshold reached

## Migration Guide

### From Role-Based to Task System

**Phase 1: Enable in Parallel**

```typescript
// Keep legacy system as fallback
const behavior = new BehaviorController({
  useTaskSystem: false // Start with legacy
});
```

**Phase 2: Test Task System**

```typescript
// Enable task system for testing
const behavior = new BehaviorController({
  useTaskSystem: true,
  cpuSafetyMargin: 0.7 // Conservative threshold
});
```

**Phase 3: Full Migration**

```typescript
// Use task system with optimal settings
const behavior = new BehaviorController({
  useTaskSystem: true,
  cpuSafetyMargin: 0.8
});
```

### Handling Legacy Creeps

Creeps created with the legacy system will continue to work. The task system respects existing creep memory and will only manage creeps that don't have role-based assignments.

## Monitoring and Debugging

### Task Statistics

Get task execution metrics:

```typescript
const stats = taskManager.getStats();
console.log(`Total tasks: ${stats.total}`);
console.log(`Pending: ${stats.pending}`);
console.log(`In progress: ${stats.inProgress}`);
console.log(`Complete: ${stats.complete}`);
```

### Performance Tracking

Monitor CPU usage per task type:

```typescript
const taskCounts = taskManager.executeTasks(creeps, Game.cpu.limit);
console.log(`HarvestAction: ${taskCounts.HarvestAction || 0}`);
console.log(`BuildAction: ${taskCounts.BuildAction || 0}`);
```

### Common Issues

**Issue: Tasks not being assigned**

- Check if creeps meet prerequisites
- Verify task generation is running
- Check CPU threshold isn't too low

**Issue: CPU timeout still occurring**

- Lower `cpuSafetyMargin` (e.g., 0.7)
- Reduce task generation frequency
- Optimize custom task actions

**Issue: Creeps idle despite available tasks**

- Verify prerequisites are correct
- Check task priorities
- Ensure task deadlines haven't expired

## Best Practices

### 1. Start Conservative

Begin with a lower CPU threshold and gradually increase:

```typescript
cpuSafetyMargin: 0.7; // Start here
cpuSafetyMargin: 0.8; // After testing
cpuSafetyMargin: 0.9; // Only if stable
```

### 2. Monitor Performance

Track task execution and CPU usage:

```typescript
const cpuBefore = Game.cpu.getUsed();
taskManager.executeTasks(creeps, Game.cpu.limit);
const cpuUsed = Game.cpu.getUsed() - cpuBefore;
console.log(`Task execution: ${cpuUsed.toFixed(2)} CPU`);
```

### 3. Use Appropriate Priorities

Assign priorities based on importance:

- Spawning during attacks: CRITICAL
- Energy delivery: HIGH
- Harvesting: NORMAL
- Repair: LOW
- Exploration: IDLE

### 4. Set Reasonable Deadlines

Prevent task accumulation:

```typescript
const deadline = Game.time + 100; // 100 ticks
const task = new TaskRequest(id, action, priority, deadline);
```

## Advanced Usage

### Custom Task Actions

Create specialized tasks for your strategy:

```typescript
import { TaskAction, TaskPrerequisite, MinionCanWork } from "@runtime/tasks";

export class DefendPositionAction extends TaskAction {
  public prereqs: TaskPrerequisite[] = [new MinionCanWork()];
  private position: RoomPosition;

  public constructor(position: RoomPosition) {
    super();
    this.position = position;
  }

  public action(creep: Creep): boolean {
    if (creep.pos.isEqualTo(this.position)) {
      // Defend position
      const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
      if (hostiles.length > 0) {
        creep.attack(hostiles[0]);
      }
      return false; // Continue defending
    }
    this.moveToTarget(creep, this.position, 0);
    return false;
  }
}
```

### Custom Prerequisites

Implement specialized requirements:

```typescript
import { TaskPrerequisite } from "@runtime/tasks";

export class MinionIsHealthy extends TaskPrerequisite {
  private minHits: number;

  public constructor(minHits: number) {
    super();
    this.minHits = minHits;
  }

  public meets(creep: Creep): boolean {
    return creep.hits >= this.minHits;
  }

  public toMeet(_creep: Creep): TaskAction[] {
    // Could return task to heal creep
    return [];
  }
}
```

## See Also

- [Task Management System](./task-management.md) - Core concepts and API
- [Task Prioritization](./task-prioritization.md) - Priority system details
- [CPU Timeout Prevention](../operations/cpu-timeout-prevention.md) - CPU budget strategies
- [Performance Monitoring](../operations/performance-monitoring.md) - Tracking metrics
