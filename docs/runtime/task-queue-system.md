# Role-Specific Task Queue System

## Overview

The role-specific task queue system prevents duplicate task assignment by coordinating work distribution across creeps of the same role. It provides a centralized coordination mechanism without replacing the existing role-based behavior system.

## Architecture

### Core Components

1. **RoleTaskQueueManager** (`packages/bot/src/runtime/behavior/RoleTaskQueue.ts`)
   - Manages task queues for each role
   - Handles task assignment, release, and expiration
   - Cleans up tasks from dead creeps
   - Provides queue statistics for monitoring

2. **TaskDiscovery** (`packages/bot/src/runtime/behavior/TaskDiscovery.ts`)
   - Discovers available work targets in rooms
   - Converts targets into task queue entries
   - Assigns priorities based on target type
   - Sets appropriate expiration times

3. **BehaviorController Integration**
   - Initializes task queue manager at startup
   - Runs task discovery phase before creep execution
   - Cleans up dead creep tasks each tick
   - Cleans up expired tasks each tick

### Data Structures

```typescript
interface TaskQueueEntry {
  taskId: string; // Stable identifier (e.g., "harvest-source-5bbcae9f9099fc012e63b52e")
  targetId: string; // ID of the target object
  assignedCreep?: string; // Name of assigned creep (undefined if unassigned)
  priority: TaskPriority; // CRITICAL, HIGH, NORMAL, or LOW
  expiresAt: number; // Game tick when task expires
}
```

### Task Priorities

```typescript
enum TaskPriority {
  CRITICAL = 1, // Emergency tasks (spawn energy, defense)
  HIGH = 2, // Important tasks (construction, harvesting)
  NORMAL = 3, // Regular tasks (upgrading, maintenance)
  LOW = 4 // Optional tasks (exploration, optimization)
}
```

## Task Discovery

Task discovery runs once per tick before creep execution. It identifies available work targets and populates role-specific task queues.

### Discovered Tasks by Role

#### Harvesters

- **Task Type**: Harvest from energy sources
- **Priority**: HIGH
- **Task ID Format**: `harvest-source-<sourceId>`
- **Expiration**: 100 ticks

#### Builders

- **Task Types**: Construction sites (priority-based), repair tasks
- **Priorities**:
  - CRITICAL: Spawns, Extensions
  - HIGH: Towers, Containers, Storage
  - NORMAL: Roads, Ramparts
  - LOW: Walls
- **Task ID Format**: `build-<constructionSiteId>`, `repair-<structureId>`
- **Expiration**: 200 ticks (build), 150 ticks (repair)

#### Haulers

- **Task Types**: Pickup (dropped energy, containers), delivery (spawns, extensions, towers, storage)
- **Priorities**:
  - CRITICAL: Spawn/extension delivery
  - HIGH: Tower delivery, energy pickup
  - NORMAL: Storage delivery, container pickup
- **Task ID Format**: `pickup-energy-<resourceId>`, `pickup-container-<containerId>`, `deliver-<structureId>`
- **Expiration**: 50 ticks (pickup), 100 ticks (delivery)

#### Upgraders

- **Task Type**: Controller upgrade
- **Priority**: NORMAL
- **Task ID Format**: `upgrade-<controllerId>`
- **Expiration**: 50 ticks
- **Note**: Multiple upgraders can work on same controller, but queue tracks work availability

#### Stationary Harvesters

- **Task Type**: Harvest from sources with adjacent containers
- **Priority**: HIGH
- **Task ID Format**: `stationary-harvest-<sourceId>`
- **Expiration**: 100 ticks

#### Repairers

- **Task Type**: Structure repair
- **Priorities**:
  - CRITICAL: Spawns, Towers
  - HIGH: Containers, Roads
  - NORMAL: Other structures, Walls/Ramparts (below target HP)
- **Task ID Format**: `repair-<structureId>`
- **Expiration**: 150 ticks

## Usage in Role Handlers

### Basic Pattern

To integrate task queue with a role handler:

```typescript
function runHarvester(creep: ManagedCreep): string {
  const memory = creep.memory as HarvesterMemory;
  const taskQueue = getTaskQueue();

  // Check if creep already has an assigned task
  let task = taskQueue?.getCreepTask(Memory, creep.name);

  // If no task, try to assign one from the queue
  if (!task) {
    task = taskQueue?.assignTask(Memory, "harvester", creep.name, Game.time);
  }

  // If we have a task from queue, try to execute it
  if (task) {
    const target = Game.getObjectById(task.targetId as Id<Source>);

    if (target) {
      // Execute task
      const result = creep.harvest(target);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 1, reusePath: 30 });
      } else if (result === OK && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        // Task complete (or creep full), release it
        taskQueue?.releaseTask(Memory, task.taskId, creep.name);
        task = null;
      }
      return HARVEST_TASK;
    } else {
      // Target no longer exists, release task
      taskQueue?.releaseTask(Memory, task.taskId, creep.name);
      task = null;
    }
  }

  // Fallback to original behavior if no queue task available
  // ... existing creep logic here ...
}
```

### Key Principles

1. **Check for existing assignment first**: Creeps should check if they already have a task before requesting a new one
2. **Graceful fallback**: If queue is empty or unavailable, fall back to original behavior
3. **Release on completion**: Release tasks when completed or when target is no longer valid
4. **Validate targets**: Always validate that the target still exists before attempting to use it
5. **Handle partial completion**: For tasks that require multiple ticks, keep the assignment until fully complete

### Task Lifecycle

```
1. Discovery Phase (per tick)
   └─> TaskDiscovery identifies work targets
   └─> Tasks added to role queues
   └─> Expired tasks cleaned up

2. Assignment Phase (per creep)
   └─> Creep checks for existing task
   └─> If none, requests task from queue
   └─> Task marked as assigned to creep

3. Execution Phase (per creep)
   └─> Creep executes task behavior
   └─> On completion: release task
   └─> On target invalid: release task
   └─> On failure: continue (task will expire)

4. Cleanup Phase (per tick)
   └─> Dead creep tasks released
   └─> Expired tasks removed from queue
```

## Memory Structure

Task queues are stored in `Memory.taskQueue`:

```typescript
Memory.taskQueue = {
  harvester: [
    {
      taskId: "harvest-source-5bbcae9f9099fc012e63b52e",
      targetId: "5bbcae9f9099fc012e63b52e",
      assignedCreep: "harvester-1",
      priority: 2,
      expiresAt: 12345
    }
  ],
  builder: [
    {
      taskId: "build-5bbcae9f9099fc012e63b530",
      targetId: "5bbcae9f9099fc012e63b530",
      priority: 1,
      expiresAt: 12400
    }
  ]
  // ... other roles
};
```

## Monitoring

Get queue statistics:

```typescript
const taskQueue = getTaskQueue();
const stats = taskQueue.getQueueStats(Memory);

// stats = {
//   harvester: { total: 3, assigned: 2, available: 1 },
//   builder: { total: 5, assigned: 3, available: 2 }
// }
```

## Performance Considerations

- **Memory usage**: O(n) where n = number of active tasks (typically 10-50 per role)
- **CPU cost**: Task discovery runs once per tick per room (minimal cost)
- **Lookup complexity**: O(n) for task assignment (acceptable for typical creep counts < 50)
- **Optimization**: If creep count exceeds 50+, consider Map-based lookup for O(1) performance

## Benefits

1. **Prevents duplicate work**: Multiple creeps no longer target the same task simultaneously
2. **Reduces CPU waste**: Eliminates redundant pathfinding and failed action attempts
3. **Improves resource allocation**: Better distribution of workload across creeps
4. **Enables prioritization**: Critical tasks (spawn energy) get assigned before optional tasks
5. **Foundation for future work**: Enables more sophisticated task scheduling and coordination

## Current Limitations

1. **Not integrated with role handlers**: Task queue is populated but not yet consumed by role logic
2. **Manual integration required**: Each role handler needs explicit queue integration
3. **No cross-role coordination**: Tasks are role-specific; no sharing between roles
4. **Basic prioritization**: Priority is based on target type, not dynamic room state

## Future Enhancements

1. **Dynamic task priorities**: Adjust priorities based on room state (e.g., low energy = prioritize harvesters)
2. **Task dependencies**: Enable task chains (e.g., build road before hauling)
3. **Cross-role task sharing**: Allow multiple roles to fulfill the same task type
4. **Task reservation**: Reserve tasks before assignment to prevent race conditions
5. **Task metrics**: Track task completion rates, average time, and efficiency
6. **Role handler integration**: Complete integration with all role handlers for full coordination

## Testing

Unit tests cover all core functionality:

- ✓ Task assignment and release
- ✓ Task expiration and cleanup
- ✓ Dead creep task cleanup
- ✓ Task queue ordering by priority
- ✓ Duplicate task prevention
- ✓ Queue statistics and monitoring
- ✓ Multiple role independence

Run tests with: `yarn test:unit`

## API Reference

### RoleTaskQueueManager

#### `assignTask(memory, role, creepName, currentTick): TaskQueueEntry | null`

Assigns an available task to a creep. Returns null if no tasks available.

#### `releaseTask(memory, taskId, creepName): void`

Releases a task assignment (on completion or failure).

#### `addTask(memory, role, task): void`

Adds a new task to the queue (prevents duplicates).

#### `getAvailableTasks(memory, role, currentTick): TaskQueueEntry[]`

Returns all unassigned tasks for a role.

#### `cleanupExpiredTasks(memory, role, currentTick): void`

Removes expired tasks from a role's queue.

#### `cleanupDeadCreepTasks(memory, game): void`

Releases tasks assigned to dead creeps.

#### `getCreepTask(memory, creepName): TaskQueueEntry | null`

Gets the current task assigned to a creep.

#### `clearRoleQueue(memory, role): void`

Removes all tasks for a role (for testing/reset).

#### `getQueueStats(memory): Record<string, { total, assigned, available }>`

Returns queue statistics by role.

### TaskDiscovery Functions

- `discoverHarvestTasks(room, currentTick): TaskQueueEntry[]`
- `discoverBuildTasks(room, currentTick): TaskQueueEntry[]`
- `discoverRepairTasks(room, currentTick, targetHits): TaskQueueEntry[]`
- `discoverPickupTasks(room, currentTick, minAmount): TaskQueueEntry[]`
- `discoverDeliveryTasks(room, currentTick): TaskQueueEntry[]`
- `discoverUpgradeTasks(room, currentTick): TaskQueueEntry[]`
- `discoverStationaryHarvestTasks(room, currentTick): TaskQueueEntry[]`

## Related Systems

- **Role-Based Behavior System**: Primary control flow (task queue coordinates, not replaces)
- **Energy Priority Manager**: Manages energy reserves and withdrawal permissions
- **Wall Upgrade Manager**: Determines target HP for wall/rampart repairs
- **Scout Manager**: Provides remote room data for remote mining tasks
- **Body Composer**: Generates creep bodies based on available energy

## References

- **Issue**: ralphschuler/.screeps-gpt#[current issue number]
- **Task System History**: ralphschuler/.screeps-gpt#1114 (task controller disabled)
- **Duplicate Task Issues**: ralphschuler/.screeps-gpt#836 (old task system)
- **Phase 2 Task Framework**: ralphschuler/.screeps-gpt#723 (architectural patterns)
