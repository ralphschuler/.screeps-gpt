# Phase 2: Core Task Framework - Implementation Guide

This guide provides detailed implementation tasks for Phase 2, which transitions the bot from a role-based to a task-based architecture for improved flexibility and scalability.

## Phase Overview

**Goal**: Implement centralized task management system and core resource management infrastructure.

**Duration**: 3-4 weeks  
**Priority**: HIGH  
**Prerequisites**: Phase 1 complete and validated  
**Status**: 📋 Planned

## Success Criteria

- ✅ Task assignment latency <5 ticks on average
- ✅ Storage maintains 20k+ energy reserves at RCL 4+
- ✅ Link efficiency >80% (energy transferred vs capacity)
- ✅ Remote rooms contribute 30%+ of total income
- ✅ Tower defense responds within 3 ticks of threat detection

## Architecture Changes

### New Modules

- `src/runtime/tasks/` - Task queue and assignment system
  - `TaskQueue.ts` - Priority queue implementation
  - `TaskAssigner.ts` - Assignment algorithm
  - `TaskTypes.ts` - Task definitions and interfaces
- `src/runtime/managers/` - Resource management
  - `StorageManager.ts` - Energy distribution
  - `LinkManager.ts` - Link network optimization
  - `TowerManager.ts` - Automated defense and repair

### Modified Modules

- `src/runtime/behavior/BehaviorController.ts` - Refactor to use task system
- `src/runtime/bootstrap/BootstrapKernel.ts` - Initialize managers
- `src/runtime/evaluation/SystemEvaluator.ts` - Add Phase 2 metrics

## Key Deliverables

### 1. Task Queue System

**Implementation**: Create priority-based task queue

```typescript
// src/runtime/tasks/TaskTypes.ts
export interface Task {
  id: string;
  type: TaskType;
  priority: number; // 0-100
  target: RoomPosition | Id<Structure | Source>;
  assignedCreep?: Id<Creep>;
  status: TaskStatus;
  createdAt: number;
  deadline?: number;
}

export enum TaskType {
  HARVEST = "harvest",
  HAUL = "haul",
  BUILD = "build",
  REPAIR = "repair",
  UPGRADE = "upgrade",
  WITHDRAW = "withdraw",
  TRANSFER = "transfer"
}

export enum TaskStatus {
  PENDING = "pending",
  ASSIGNED = "assigned",
  IN_PROGRESS = "in-progress",
  COMPLETED = "completed",
  FAILED = "failed"
}

export const TaskPriority = {
  CRITICAL: 100,
  HIGH: 75,
  NORMAL: 50,
  LOW: 25,
  IDLE: 0
} as const;
```

```typescript
// src/runtime/tasks/TaskQueue.ts
export class TaskQueue {
  private tasks: Map<string, Task> = new Map();

  public addTask(task: Task): void {
    this.tasks.set(task.id, task);
  }

  public removeTask(taskId: string): void {
    this.tasks.delete(taskId);
  }

  public getAvailableTasks(minPriority = 0): Task[] {
    return Array.from(this.tasks.values())
      .filter(t => t.status === TaskStatus.PENDING && t.priority >= minPriority)
      .sort((a, b) => b.priority - a.priority);
  }

  public assignTask(taskId: string, creepId: Id<Creep>): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== TaskStatus.PENDING) return false;

    task.assignedCreep = creepId;
    task.status = TaskStatus.ASSIGNED;
    return true;
  }

  public completeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = TaskStatus.COMPLETED;
      // Clean up completed tasks after a delay
      setTimeout(() => this.tasks.delete(taskId), 10);
    }
  }

  public cleanupExpiredTasks(): void {
    const now = Game.time;
    for (const [id, task] of this.tasks) {
      if (task.deadline && now > task.deadline) {
        this.tasks.delete(id);
      }
    }
  }
}
```

### 2. Task Assignment Algorithm

**Implementation**: Assign tasks to creeps based on proximity and capability

```typescript
// src/runtime/tasks/TaskAssigner.ts
export class TaskAssigner {
  public assignTasks(creeps: Creep[], taskQueue: TaskQueue): void {
    const availableTasks = taskQueue.getAvailableTasks();
    const idleCreeps = creeps.filter(c => !this.hasAssignedTask(c));

    for (const creep of idleCreeps) {
      const bestTask = this.findBestTask(creep, availableTasks);
      if (bestTask) {
        taskQueue.assignTask(bestTask.id, creep.id);
      }
    }
  }

  private findBestTask(creep: Creep, tasks: Task[]): Task | null {
    if (tasks.length === 0) return null;

    return tasks.reduce((best, task) => {
      const score = this.calculateTaskScore(creep, task);
      const bestScore = this.calculateTaskScore(creep, best);
      return score > bestScore ? task : best;
    });
  }

  private calculateTaskScore(creep: Creep, task: Task): number {
    let score = task.priority;

    // Distance factor (closer is better)
    const distance = this.getDistance(creep.pos, task.target);
    score -= distance * 0.5;

    // Capability factor (prefer creeps with suitable body parts)
    const capability = this.getCapability(creep, task.type);
    score += capability * 10;

    // Energy state factor
    if (task.type === TaskType.HARVEST && creep.store.getFreeCapacity() > 0) {
      score += 20;
    }

    return score;
  }

  private getCapability(creep: Creep, taskType: TaskType): number {
    const body = creep.body;
    switch (taskType) {
      case TaskType.HARVEST:
        return body.filter(p => p.type === WORK).length;
      case TaskType.BUILD:
      case TaskType.REPAIR:
        return body.filter(p => p.type === WORK).length;
      case TaskType.HAUL:
      case TaskType.TRANSFER:
        return body.filter(p => p.type === CARRY).length;
      default:
        return 1;
    }
  }

  private getDistance(from: RoomPosition, to: RoomPosition | Id<Structure | Source>): number {
    // Simplified distance calculation
    if (to instanceof RoomPosition) {
      return from.getRangeTo(to);
    }
    const obj = Game.getObjectById(to as Id<Structure>);
    return obj ? from.getRangeTo(obj.pos) : 999;
  }

  private hasAssignedTask(creep: Creep): boolean {
    return creep.memory.taskId !== undefined;
  }
}
```

### 3. Storage Manager

**Implementation**: Optimize energy distribution from storage

```typescript
// src/runtime/managers/StorageManager.ts
export class StorageManager {
  private readonly RESERVE_TARGET = 20000;
  private readonly WITHDRAW_THRESHOLD = 25000;

  public run(room: Room): void {
    const storage = room.storage;
    if (!storage) return;

    this.balanceStorage(room);
    this.distributeEnergy(room);
  }

  private balanceStorage(room: Room): void {
    const storage = room.storage!;
    const energyStored = storage.store.getUsedCapacity(RESOURCE_ENERGY);

    // Generate tasks based on storage state
    if (energyStored > this.WITHDRAW_THRESHOLD) {
      // Create haul tasks to distribute energy
      this.createDistributionTasks(room);
    } else if (energyStored < this.RESERVE_TARGET) {
      // Create haul tasks to fill storage
      this.createCollectionTasks(room);
    }
  }

  private createDistributionTasks(room: Room): void {
    // Find structures needing energy
    const needEnergy = room.find(FIND_MY_STRUCTURES, {
      filter: s =>
        (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_SPAWN) &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });

    for (const structure of needEnergy) {
      // Create WITHDRAW task from storage and TRANSFER task to structure
      // (Task creation logic)
    }
  }

  private createCollectionTasks(room: Room): void {
    // Find dropped resources or full containers
    const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
      filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 50
    });

    // Create PICKUP and TRANSFER tasks
  }

  private distributeEnergy(room: Room): void {
    // Link energy distribution handled by LinkManager
  }
}
```

### 4. Link Manager

**Implementation**: Optimize link network for energy highways

```typescript
// src/runtime/managers/LinkManager.ts
export class LinkManager {
  public run(room: Room): void {
    const links = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_LINK }
    }) as StructureLink[];

    if (links.length < 2) return;

    const sourceLinks = this.identifySourceLinks(room, links);
    const targetLinks = this.identifyTargetLinks(room, links);

    this.transferEnergy(sourceLinks, targetLinks);
  }

  private identifySourceLinks(room: Room, links: StructureLink[]): StructureLink[] {
    const sources = room.find(FIND_SOURCES);
    return links.filter(link => {
      return sources.some(source => link.pos.getRangeTo(source) <= 2);
    });
  }

  private identifyTargetLinks(room: Room, links: StructureLink[]): StructureLink[] {
    const controller = room.controller;
    const storage = room.storage;

    return links.filter(link => {
      const nearController = controller && link.pos.getRangeTo(controller) <= 3;
      const nearStorage = storage && link.pos.getRangeTo(storage) <= 2;
      return nearController || nearStorage;
    });
  }

  private transferEnergy(sourceLinks: StructureLink[], targetLinks: StructureLink[]): void {
    for (const source of sourceLinks) {
      if (source.store.getUsedCapacity(RESOURCE_ENERGY) < 400) continue;
      if (source.cooldown > 0) continue;

      const target = targetLinks.find(t => t.store.getFreeCapacity(RESOURCE_ENERGY) > 400);

      if (target) {
        source.transferEnergy(target);
      }
    }
  }

  public calculateEfficiency(room: Room): number {
    // Track energy transferred vs link capacity
    // Return ratio for evaluation metrics
    return 0.85; // Placeholder
  }
}
```

### 5. Tower Manager

**Implementation**: Automated defense and repair

```typescript
// src/runtime/managers/TowerManager.ts
export class TowerManager {
  private readonly REPAIR_THRESHOLD = 0.7; // Repair if <70% hits

  public run(room: Room): void {
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    }) as StructureTower[];

    for (const tower of towers) {
      this.operateTower(tower, room);
    }
  }

  private operateTower(tower: StructureTower, room: Room): void {
    // Priority 1: Defend against hostiles
    const hostile = this.findClosestHostile(tower, room);
    if (hostile) {
      tower.attack(hostile);
      return;
    }

    // Priority 2: Heal damaged creeps
    const damaged = this.findDamagedCreep(tower, room);
    if (damaged) {
      tower.heal(damaged);
      return;
    }

    // Priority 3: Repair structures
    const needsRepair = this.findRepairTarget(tower, room);
    if (needsRepair) {
      tower.repair(needsRepair);
    }
  }

  private findClosestHostile(tower: StructureTower, room: Room): Creep | null {
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    return hostiles.length > 0 ? tower.pos.findClosestByRange(hostiles) : null;
  }

  private findDamagedCreep(tower: StructureTower, room: Room): Creep | null {
    const damaged = room.find(FIND_MY_CREEPS, {
      filter: c => c.hits < c.hitsMax
    });
    return damaged.length > 0 ? tower.pos.findClosestByRange(damaged) : null;
  }

  private findRepairTarget(tower: StructureTower, room: Room): Structure | null {
    const damaged = room.find(FIND_STRUCTURES, {
      filter: s =>
        s.hits < s.hitsMax * this.REPAIR_THRESHOLD &&
        s.structureType !== STRUCTURE_WALL &&
        s.structureType !== STRUCTURE_RAMPART
    });

    return damaged.length > 0 ? tower.pos.findClosestByRange(damaged) : null;
  }
}
```

## Integration with BehaviorController

Refactor BehaviorController to use task system:

```typescript
// In BehaviorController.ts
import { TaskQueue } from "../tasks/TaskQueue";
import { TaskAssigner } from "../tasks/TaskAssigner";

export class BehaviorController {
  private taskQueue = new TaskQueue();
  private taskAssigner = new TaskAssigner();

  public run(room: Room): void {
    // Generate tasks based on room state
    this.generateTasks(room);

    // Assign tasks to creeps
    const creeps = room.find(FIND_MY_CREEPS);
    this.taskAssigner.assignTasks(creeps, this.taskQueue);

    // Execute assigned tasks
    for (const creep of creeps) {
      this.executeCreepTask(creep);
    }

    // Cleanup expired tasks
    this.taskQueue.cleanupExpiredTasks();
  }

  private generateTasks(room: Room): void {
    // Create harvest tasks for sources
    // Create build tasks for construction sites
    // Create repair tasks for damaged structures
    // Create upgrade tasks for controller
  }

  private executeCreepTask(creep: Creep): void {
    const taskId = creep.memory.taskId;
    if (!taskId) return;

    const task = this.taskQueue["tasks"].get(taskId);
    if (!task) {
      delete creep.memory.taskId;
      return;
    }

    // Execute task based on type
    switch (task.type) {
      case TaskType.HARVEST:
        this.executeHarvestTask(creep, task);
        break;
      case TaskType.BUILD:
        this.executeBuildTask(creep, task);
        break;
      // ... other task types
    }
  }
}
```

## Testing Strategy

Create comprehensive tests for task system:

```typescript
// tests/unit/taskQueue.test.ts
describe("TaskQueue", () => {
  it("should prioritize high-priority tasks", () => {
    const queue = new TaskQueue();
    queue.addTask(createTask({ priority: 50 }));
    queue.addTask(createTask({ priority: 100 }));

    const tasks = queue.getAvailableTasks();
    expect(tasks[0].priority).toBe(100);
  });

  it("should assign tasks to creeps", () => {
    const queue = new TaskQueue();
    const task = createTask();
    queue.addTask(task);

    const success = queue.assignTask(task.id, "creep1" as Id<Creep>);
    expect(success).toBe(true);
    expect(task.assignedCreep).toBe("creep1");
  });
});

// tests/regression/phase2-tasks.test.ts
describe("Phase 2: Task System", () => {
  it("should maintain task assignment latency <5 ticks", async () => {
    const results = await runSimulation({ duration: 1000 });
    const avgLatency = results.reduce((sum, r) => sum + r.taskAssignmentLatency, 0) / results.length;
    expect(avgLatency).toBeLessThan(5);
  });
});
```

## Deployment Plan

- **Week 1**: Implement task queue and assignment system
- **Week 2**: Create storage and link managers
- **Week 3**: Implement tower manager and refactor BehaviorController
- **Week 4**: Testing, optimization, and PTR validation

## Success Validation

Before advancing to Phase 3:

- ✅ All Phase 2 success criteria met on PTR
- ✅ Regression tests passing
- ✅ No performance degradation from Phase 1
- ✅ Task system documentation complete

## Next Phase

[Phase 3: Economy Expansion](./03-economy-expansion.md)

## References

- [Architecture Alignment](../architecture.md)
- [Development Roadmap](../roadmap.md)
- [Phase 1: Foundation](./01-foundation.md)
