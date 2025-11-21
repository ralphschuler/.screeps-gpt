# @ralphschuler/screeps-tasks

Hierarchical task dependency system for Screeps AI with support for prerequisite sub-tasks and dependency resolution.

## Features

- **Hierarchical Task Structure**: Tasks can have parent-child relationships and dependencies
- **Dependency Resolution**: Topological sort determines optimal task execution order
- **Circular Dependency Detection**: Prevents invalid dependency graphs
- **State Management**: Tasks track states (pending, ready, blocked, completed, failed)
- **Priority Queuing**: Tasks are ordered by priority for efficient execution
- **Assignment Tracking**: Track which creeps are assigned to which tasks
- **Automatic Cleanup**: Remove expired tasks and handle dead creep cleanup

## Installation

This package is part of the `.screeps-gpt` monorepo workspace.

```bash
yarn install
```

## Usage

### Basic Task Creation

```typescript
import { TaskNode, TaskPriority } from "@ralphschuler/screeps-tasks";

// Create a simple task
const harvestTask = new TaskNode({
  id: "harvest-source-123",
  type: "harvest",
  targetId: "source-123",
  priority: TaskPriority.HIGH,
  createdAt: Game.time,
  expiresAt: Game.time + 100
});
```

### Task Dependencies

```typescript
import { TaskNode, DependencyTaskQueue, TaskPriority } from "@ralphschuler/screeps-tasks";

const queue = new DependencyTaskQueue();

// Create prerequisite task
const collectEnergyTask = new TaskNode({
  id: "collect-energy",
  type: "harvest",
  targetId: "source-123",
  priority: TaskPriority.HIGH,
  createdAt: Game.time,
  expiresAt: Game.time + 100
});

// Create dependent task (requires energy collection first)
const upgradeTask = new TaskNode({
  id: "upgrade-controller",
  type: "upgrade",
  targetId: "controller-456",
  priority: TaskPriority.NORMAL,
  dependencies: ["collect-energy"], // Must complete collect-energy first
  createdAt: Game.time,
  expiresAt: Game.time + 200
});

// Add tasks to queue (prerequisite must be added first)
queue.addTask(collectEnergyTask);
queue.addTask(upgradeTask);

// Get ready tasks (only collect-energy is ready initially)
const readyTasks = queue.getReadyTasks(Game.time);
// readyTasks = [collectEnergyTask]

// Assign task to creep
const assignedTask = queue.assignTask("creep-1", Game.time);

// Complete the task
queue.completeTask("collect-energy");

// Now upgrade task is ready
const nextReadyTasks = queue.getReadyTasks(Game.time);
// nextReadyTasks = [upgradeTask]
```

### Complex Dependency Chains

```typescript
import { TaskNode, DependencyTaskQueue, TaskPriority } from "@ralphschuler/screeps-tasks";

const queue = new DependencyTaskQueue();

// Multi-step workflow: Harvest -> Transport -> Upgrade
const harvestTask = new TaskNode({
  id: "harvest-1",
  type: "harvest",
  targetId: "source-123",
  priority: TaskPriority.HIGH,
  createdAt: Game.time,
  expiresAt: Game.time + 100
});

const transportTask = new TaskNode({
  id: "transport-1",
  type: "transfer",
  targetId: "storage-456",
  priority: TaskPriority.NORMAL,
  dependencies: ["harvest-1"],
  createdAt: Game.time,
  expiresAt: Game.time + 150
});

const upgradeTask = new TaskNode({
  id: "upgrade-1",
  type: "upgrade",
  targetId: "controller-789",
  priority: TaskPriority.NORMAL,
  dependencies: ["transport-1"],
  createdAt: Game.time,
  expiresAt: Game.time + 200
});

queue.addTask(harvestTask);
queue.addTask(transportTask);
queue.addTask(upgradeTask);

// Resolve all dependencies to see execution order
const resolution = queue.resolveAll();
console.log(resolution.executionOrder);
// Output: ["harvest-1", "transport-1", "upgrade-1"]
```

### Dependency Resolution

```typescript
import { DependencyResolver } from "@ralphschuler/screeps-tasks";

const resolver = new DependencyResolver();
const tasks = new Map(); // Map of task IDs to TaskNode instances

// Add tasks...

// Resolve dependencies
const result = resolver.resolve(tasks);

console.log("Execution order:", result.executionOrder);
console.log("Ready tasks:", result.readyTasks);
console.log("Blocked tasks:", result.blockedTasks);

if (result.hasCircularDependency) {
  console.log("Circular dependencies detected:", result.circularDependencies);
}
```

### Queue Management

```typescript
import { DependencyTaskQueue } from "@ralphschuler/screeps-tasks";

const queue = new DependencyTaskQueue();

// Add tasks...

// Get statistics
const stats = queue.getStats();
console.log(`Total: ${stats.total}, Ready: ${stats.ready}, Assigned: ${stats.assigned}`);

// Cleanup expired tasks
const removed = queue.cleanupExpiredTasks(Game.time);
console.log(`Removed ${removed} expired tasks`);

// Cleanup dead creep tasks
const cleaned = queue.cleanupDeadCreepTasks(Game.creeps);
console.log(`Released ${cleaned} tasks from dead creeps`);

// Clear all tasks
queue.clear();
```

## API Reference

### TaskNode

Main class representing a task with dependency support.

**Constructor:**

```typescript
new TaskNode(config: {
  id: string;
  type: string;
  targetId: string;
  priority?: TaskPriority;
  parentId?: string | null;
  dependencies?: string[];
  createdAt: number;
  expiresAt: number;
})
```

**Methods:**

- `addDependency(taskId: string): void` - Add a prerequisite dependency
- `removeDependency(taskId: string): void` - Remove a dependency
- `addDependent(taskId: string): void` - Add a dependent task
- `removeDependent(taskId: string): void` - Remove a dependent task
- `isExpired(currentTick: number): boolean` - Check if task expired
- `isReady(): boolean` - Check if ready for execution
- `markCompleted(): void` - Mark task as completed
- `markFailed(): void` - Mark task as failed
- `assignCreep(creepName: string): void` - Assign to creep
- `unassignCreep(): void` - Unassign from creep

### DependencyTaskQueue

Queue manager with dependency-aware task assignment.

**Methods:**

- `addTask(task: TaskNode): boolean` - Add task to queue
- `removeTask(taskId: string): boolean` - Remove task from queue
- `getReadyTasks(currentTick: number): TaskNode[]` - Get ready tasks sorted by priority
- `assignTask(creepName: string, currentTick: number): TaskNode | null` - Assign task to creep
- `completeTask(taskId: string): boolean` - Mark task completed
- `failTask(taskId: string): boolean` - Mark task failed
- `releaseTask(taskId: string, creepName: string): boolean` - Release task assignment
- `cleanupExpiredTasks(currentTick: number): number` - Remove expired tasks
- `cleanupDeadCreepTasks(creeps: Record<string, unknown>): number` - Release tasks from dead creeps
- `resolveAll(): ResolutionResult` - Resolve all dependencies
- `getStats(): object` - Get queue statistics

### DependencyResolver

Resolves task dependencies using topological sort.

**Methods:**

- `resolve(tasks: Map<string, TaskNode>): ResolutionResult` - Resolve dependencies
- `wouldCreateCycle(tasks, fromTaskId, toTaskId): boolean` - Check for circular dependencies
- `updateTaskStates(tasks: Map<string, TaskNode>): void` - Update task states

## Design Principles

This package focuses on **task dependency relationships**, not task execution. It complements existing task systems by adding hierarchical structure.

**Scope:**

- ✅ Task dependencies and prerequisite relationships
- ✅ Dependency resolution and execution ordering
- ✅ Task composition patterns (chains, workflows)
- ❌ Task generation (handled by TaskManager)
- ❌ Task assignment to creeps (handled by BehaviorController)
- ❌ Task execution (handled by role handlers)

## Performance

- **Dependency resolution**: O(V + E) per tick (V = tasks, E = dependencies)
- **Memory overhead**: ~50-100 bytes per task node
- **CPU impact**: <0.5ms/tick for typical task counts (<50 tasks)

## Testing

```bash
# Run unit tests
yarn test

# Run tests with coverage
yarn test:coverage

# Watch mode
yarn test:watch
```

## License

MIT

## Related

- **Task System**: [`../../bot/src/runtime/behavior/`](../../bot/src/runtime/behavior/)
- **ADR-002**: Role-to-task migration strategy
- **Issue #625**: creep-tasks library research
