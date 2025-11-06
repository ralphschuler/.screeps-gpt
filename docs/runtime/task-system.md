# Task System Architecture

## Overview

The task management system is a comprehensive priority-based execution framework that provides an alternative to the legacy role-based behavior system. It implements ~961 lines of production-ready code featuring dynamic task prioritization, flexible creep assignment, and sophisticated CPU budget management.

**Status:** Implemented but disabled by default (as of v0.9.0)

**Implementation:** `src/runtime/tasks/` (4 core modules + index)

**Integration Point:** `BehaviorController.ts:125` - `useTaskSystem: false` (disabled)

## Architecture Components

### Core Modules

#### 1. TaskAction.ts (343 lines)

Defines the base `TaskAction` abstract class and 9 concrete action implementations.

**Implemented Actions:**

- `HarvestAction` - Harvest energy from sources
- `BuildAction` - Build construction sites
- `RepairAction` - Repair damaged structures
- `UpgradeAction` - Upgrade room controller
- `TransferAction` - Transfer resources to structures
- `WithdrawAction` - Withdraw resources from structures
- `MoveAction` - Move creep to position
- `SpawnAction` - Spawn new creeps
- `PlaceConstructionSiteAction` - Place construction sites

Each action includes:

- **Prerequisites:** Body part requirements, energy requirements, capacity checks
- **Action Logic:** The actual work performed each tick
- **Completion Detection:** Determines when the task is done
- **Movement Integration:** Automatic pathfinding to targets

#### 2. TaskPrerequisite.ts (174 lines)

Defines prerequisites that creeps must meet to execute tasks.

**Implemented Prerequisites:**

- `MinionCanWork` - Requires WORK body parts
- `MinionCanCarry` - Requires CARRY body parts
- `MinionHasEnergy` - Requires minimum energy amount
- `MinionHasFreeCapacity` - Requires free storage capacity
- `MinionIsNear` - Requires proximity to target
- `SpawnHasEnergy` - Validates spawn energy availability
- `StructureHasCapacity` - Validates structure storage capacity

#### 3. TaskRequest.ts (118 lines)

Wraps TaskActions with scheduling metadata.

**Features:**

- Unique task IDs
- Priority levels (CRITICAL=100, HIGH=75, NORMAL=50, LOW=25, IDLE=0)
- Task status (PENDING, INPROCESS, COMPLETE)
- Deadline management (optional expiration)
- Assignment tracking (which creep is working on it)
- Prerequisite validation before assignment

#### 4. TaskManager.ts (302 lines)

Central coordinator for task lifecycle management.

**Responsibilities:**

- **Task Generation:** Creates tasks based on room state
  - Harvest tasks for active sources
  - Build tasks for construction sites
  - Repair tasks for damaged structures (excluding walls/ramparts)
  - Upgrade tasks for controllers
  - Energy distribution tasks for spawns/extensions
- **Task Assignment:** Matches idle creeps to compatible tasks
  - Priority-based selection
  - Prerequisite validation
  - Automatic creep tracking via memory
- **Task Execution:** Runs assigned tasks with CPU protection
  - Per-tick action execution
  - Completion detection and cleanup
  - CPU threshold enforcement (default 80%)
  - Execution metrics tracking
- **Task Cleanup:** Removes expired and completed tasks

**CPU Threshold Management:**

```typescript
const taskManager = new TaskManager({
  cpuThreshold: 0.8, // Stop at 80% CPU usage
  logger: console
});

// Automatically stops when threshold is reached
const metrics = taskManager.executeTasks(creeps, Game.cpu.limit);
```

## Feature Comparison: Task System vs Role-Based System

### Legacy Role-Based System

**File:** `BehaviorController.ts:314-636` (functions runHarvester, runUpgrader, runBuilder, runRemoteMiner)

**Behavior Patterns:**

| Role            | Actions                                                      | State Machine          |
| --------------- | ------------------------------------------------------------ | ---------------------- |
| **Harvester**   | Harvest → Deliver to Spawn/Extension → Upgrade Controller    | Fixed 3-state cycle    |
| **Upgrader**    | Withdraw from Spawn/Extension/Container → Upgrade Controller | Fixed 2-state cycle    |
| **Builder**     | Withdraw/Harvest → Build Site → Repair → Upgrade (fallback)  | Fixed 4-state priority |
| **RemoteMiner** | Travel → Mine → Return → Deposit                             | Fixed 4-state cycle    |

**Characteristics:**

- ✅ Simple, predictable behavior
- ✅ Easy to understand and debug
- ❌ Fixed roles - harvesters always harvest even if not needed
- ❌ No dynamic prioritization
- ❌ Limited adaptability to changing room conditions
- ❌ Creeps locked to roles, cannot switch tasks
- ❌ CPU protection only at controller level (per-creep threshold checks)

### Task System

**Behavior Patterns:**

| Task Type          | When Generated               | Priority    | Behavior                        |
| ------------------ | ---------------------------- | ----------- | ------------------------------- |
| **HarvestAction**  | Active sources exist         | NORMAL (50) | Any creep with WORK + capacity  |
| **BuildAction**    | Construction sites exist     | HIGH (75)   | Any creep with WORK + energy    |
| **RepairAction**   | Damaged structures exist     | LOW (25)    | Any creep with WORK + energy    |
| **UpgradeAction**  | Controller exists            | NORMAL (50) | Any creep with WORK + energy    |
| **TransferAction** | Spawn/Extension needs energy | HIGH (75)   | Any creep with CARRY + energy   |
| **WithdrawAction** | Storage/Container has energy | NORMAL (50) | Any creep with CARRY + capacity |

**Characteristics:**

- ✅ Dynamic task generation based on actual room needs
- ✅ Priority-based execution (critical tasks first)
- ✅ Flexible assignment (any compatible creep can take any task)
- ✅ CPU budget management at task manager level
- ✅ Idle creep detection (creeps without tasks can be recycled)
- ✅ Better scalability (tasks generated per-room, not per-creep)
- ❌ More complex to debug
- ❌ Higher memory overhead for task tracking
- ❌ Potential performance overhead from task generation

## Implementation Completeness

### ✅ Fully Implemented Features

1. **All Core Task Types:**
   - All role behaviors have equivalent task actions
   - Harvest, Build, Repair, Upgrade all covered
   - Resource transfer and withdrawal implemented
   - Movement and spawning implemented

2. **CPU Protection:**
   - Configurable CPU threshold
   - Automatic execution stopping
   - Warning logging for skipped tasks
   - Priority ensures critical work completes first

3. **Prerequisite System:**
   - Body part validation
   - Energy/capacity checks
   - Proximity validation
   - Extensible for custom prerequisites

4. **Task Lifecycle:**
   - Generation based on room state
   - Assignment with prerequisite checking
   - Execution with completion detection
   - Automatic cleanup of expired/completed tasks

5. **Integration:**
   - Fully integrated with `BehaviorController`
   - Compatible with `GameContext` types
   - Works with profiler decorators
   - Metrics tracking included

### ❌ Missing/Unimplemented Features

1. **Remote Mining:**
   - Legacy system has specialized `runRemoteMiner` logic
   - Task system has `MoveAction` but no dedicated remote mining coordinator
   - **Gap:** Multi-room coordination and source tracking

2. **Defense/Combat:**
   - Neither system implements combat behavior
   - **Gap:** Attack, heal, tower control tasks

3. **Advanced Building:**
   - No road planning tasks
   - No container/link placement logic
   - **Gap:** Strategic structure placement

4. **Resource Management:**
   - No terminal/market integration
   - No mineral mining
   - **Gap:** Advanced economy features

5. **Task Persistence:**
   - Tasks stored in `TaskManager` instance (not Memory)
   - Tasks are regenerated each tick
   - **Gap:** Cannot persist tasks across global resets

### ⚠️ Integration Gaps

1. **Spawn Logic:**
   - Legacy system uses `ensureRoleMinimums` for spawning
   - Task system includes `SpawnAction` but no equivalent to minimum role enforcement
   - **Impact:** Task system may not maintain minimum creep counts

2. **Memory Migration:**
   - Creeps have `memory.role` (legacy) and `memory.taskId` (task system)
   - Both systems can coexist but may conflict
   - **Impact:** Switching between systems requires creep memory cleanup

3. **Performance Benchmarking:**
   - No formal performance comparison exists
   - **Impact:** Unknown if task generation overhead is acceptable

4. **Task Deadline Tuning:**
   - Default deadline is `Game.time + 50` (50 ticks)
   - No dynamic deadline adjustment based on urgency
   - **Impact:** Tasks may expire too early or accumulate too much

## Enabling the Task System

### Configuration

**Option 1: Direct Construction**

```typescript
import { BehaviorController } from "@runtime/behavior/BehaviorController";

const behavior = new BehaviorController({
  useTaskSystem: true,
  cpuSafetyMargin: 0.8,
  maxCpuPerCreep: 1.5
});
```

**Option 2: Kernel Configuration**

```typescript
import { createKernel } from "@runtime/bootstrap";

const kernel = createKernel({
  behavior: new BehaviorController({
    useTaskSystem: true
  })
});
```

**Option 3: Environment Variable (Proposed)**

```bash
# Set in deployment environment
TASK_SYSTEM_ENABLED=true bun run deploy
```

### Migration Strategy

**Phase 1: Parallel Testing (Safe)**

- Deploy with `useTaskSystem: false` (current default)
- Add monitoring for legacy system performance
- Establish baseline metrics

**Phase 2: PTR Validation (Experimental)**

- Deploy to PTR with `useTaskSystem: true`
- Monitor for 24+ hours
- Compare CPU usage, RCL progression, creep efficiency

**Phase 3: Gradual Production Rollout (Controlled)**

- Enable on single room first
- Use Memory flag for dynamic toggling:
  ```typescript
  useTaskSystem: Memory.experimentalFeatures?.taskSystem ?? false;
  ```
- Monitor for regressions

**Phase 4: Full Migration (Stable)**

- Set `useTaskSystem: true` as default
- Mark legacy system as deprecated
- Plan eventual removal

## Performance Considerations

### CPU Overhead Analysis

**Task Generation:**

- Runs once per room per tick
- Complexity: O(sources + sites + structures)
- Estimated: 0.5-2 CPU per room

**Task Assignment:**

- Runs only for idle creeps
- Complexity: O(idleCreeps × pendingTasks)
- Estimated: 0.1-0.5 CPU per idle creep

**Task Execution:**

- Runs once per creep with task
- Complexity: O(1) per creep
- Estimated: Same as legacy system (task action overhead minimal)

**Total Estimated Overhead:** 1-3 CPU per room with 10 creeps

**Optimization Opportunities:**

1. Cache task generation results for multiple ticks
2. Limit max pending tasks per room
3. Batch task cleanup operations
4. Use spatial indexes for task-creep matching

### Memory Overhead

**Legacy System:**

- Per-creep: `role`, `task`, `version` (~3 strings)
- No task storage (behavior is hardcoded)

**Task System:**

- Per-creep: `role`, `task`, `version`, `taskId` (~4 strings)
- Task storage: TaskManager holds tasks in heap (not Memory)
- Transient: Tasks regenerated each tick, not persisted

**Memory Impact:** Minimal (+1 string per creep memory)

## Testing Coverage

### Unit Tests

**`tests/unit/taskManager.test.ts`** (10 tests)

- Task generation for sources, sites, structures
- Task assignment with prerequisite validation
- Task execution with completion detection
- CPU threshold management
- Task cleanup

**`tests/unit/taskSystem.test.ts`** (10 tests)

- TaskRequest creation and properties
- Task assignment to creeps
- Prerequisite validation
- Task execution and completion
- Status transitions

**Coverage:** ✅ 20 tests passing

### Integration Tests

**`tests/regression/task-assignment.test.ts`**

- Task assignment edge cases
- Multiple creep coordination

**Missing Tests:**

- ❌ Full e2e test with task system enabled
- ❌ Performance benchmarks vs legacy system
- ❌ Spawn integration validation
- ❌ Multi-room coordination

## Monitoring and Debugging

### Task System Metrics

The task system provides execution metrics:

```typescript
const metrics = taskManager.executeTasks(creeps, Game.cpu.limit);
// Returns: { HarvestAction: 2, BuildAction: 1, UpgradeAction: 3, ... }
```

### Logging

The TaskManager logs important events:

```
[TaskManager] CPU threshold reached (78.45/80.00), skipping 5 creep tasks
```

### Recommended Monitoring

1. **Task Execution Counts:**
   - Track `tasksExecuted` by type
   - Alert if task types are missing (e.g., no harvest tasks when sources exist)

2. **CPU Usage:**
   - Track CPU before/after task generation
   - Track CPU for task assignment
   - Compare total CPU with legacy system

3. **Creep Utilization:**
   - Count idle creeps (no `taskId`)
   - Alert if idle rate exceeds threshold

4. **Task Completion Rate:**
   - Track tasks created vs completed
   - Alert if completion rate drops

## Recommendations

### For Immediate Testing (Phase 1)

1. **Create Performance Benchmark Test:**

   ```bash
   tests/e2e/task-system-benchmark.test.ts
   ```

   - Measure CPU overhead of task generation
   - Compare task assignment performance
   - Validate execution parity with legacy system

2. **Document Missing Remote Mining Feature:**
   - Create issue for remote mining task coordinator
   - Document workaround using current actions

3. **Add Environment Variable Support:**
   ```typescript
   useTaskSystem: process.env.TASK_SYSTEM_ENABLED === "true";
   ```

### For PTR Validation (Phase 2)

1. **Deploy with Monitoring:**
   - Enable comprehensive logging
   - Track CPU usage per tick
   - Monitor RCL progression rate
   - Track creep spawn rate

2. **Run for 24+ Hours:**
   - Verify stability under continuous operation
   - Check for edge cases (no sources, all tasks complete, etc.)
   - Validate CPU stays under threshold

3. **Compare Metrics:**
   - Legacy vs Task system CPU usage
   - Room upgrade rate (RCL/hour)
   - Creep efficiency (tasks/creep/tick)

### For Production Rollout (Phase 3)

1. **Implement Dynamic Toggle:**

   ```typescript
   Memory.experimentalFeatures = {
     taskSystem: true,
     taskSystemRooms: ["W1N1"] // Limit to specific rooms
   };
   ```

2. **Monitor for Regressions:**
   - Automated alerts for CPU spikes
   - Room progress tracking
   - Creep utilization metrics

3. **Gradual Expansion:**
   - Single room → Multiple rooms → All rooms
   - Rollback capability via Memory flag

## Related Documentation

- [Task Management System](./strategy/task-management.md) - API and usage guide
- [Enabling Task System](./strategy/enabling-task-system.md) - Configuration guide
- [Task Prioritization](./strategy/task-prioritization.md) - Priority system details
- [Creep Roles](./strategy/creep-roles.md) - Legacy role-based patterns
- [CPU Timeout Prevention](./operations/cpu-timeout-prevention.md) - CPU budget strategies

## References

- [Jon Winsley's Task Management Guide](https://jonwinsley.com/notes/screeps-task-management)
- Issue #477 - Priority-based task system evaluation
- `src/runtime/tasks/` - Implementation source code
- `tests/unit/taskManager.test.ts` - Test coverage
