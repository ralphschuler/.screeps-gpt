# Round-Robin Task Scheduling

**Category**: Task Management / CPU Optimization
**Phase**: Phase 2 (Core Framework)
**Status**: Proven
**Implemented**: v0.57.1 (2024-11-12)

## Context

The task system assigns tasks to creeps and executes them each tick. With a CPU threshold check to prevent exceeding the CPU limit, the system processes creeps sequentially until the CPU budget is exhausted.

In scenarios with high creep counts (e.g., 25 creeps with CPU allowing only 12/tick), the sequential processing caused a critical fairness problem: the same creeps consistently executed while others were permanently starved.

## Problem

**Challenge**: CPU threshold checking creates permanent creep starvation in high-creep-count scenarios.

Specific issues:

- Creeps processed sequentially from start of creep list each tick
- CPU threshold check stops processing when budget exhausted
- Same creeps at start of list execute every tick
- Creeps at end of list never get CPU time
- Starved creeps remain idle indefinitely despite having assigned tasks

**Example Scenario**:

- 25 total creeps in room
- CPU budget allows ~12 creep executions per tick
- Creeps 0-11 execute every tick
- Creeps 12-24 permanently starved (never execute)
- Starved creeps waste energy, fail to complete tasks, don't contribute to economy

**Symptoms**:

- Some creeps active and completing tasks
- Other creeps idle despite having assigned tasks
- Energy inefficiency (paying for creeps that don't work)
- Economy underperforming despite adequate creep count
- Unpredictable system behavior based on creep spawn order

## Solution

**Round-robin scheduling with tick offset rotation to ensure fair CPU allocation.**

Key elements:

1. **Tick Offset Rotation**
   - Start processing from different creep each tick
   - Offset increments each tick: offset = Game.time % creepCount
   - Ensures every creep gets chance to execute

2. **Execution Gap Tracking**
   - Track last execution tick for each creep
   - Monitor gaps between executions
   - Identify starvation patterns

3. **Starvation Statistics**
   - Method to get min/max/average execution gaps
   - Enables monitoring fairness of scheduling
   - Helps validate round-robin effectiveness

4. **Graceful Degradation**
   - System still respects CPU threshold
   - Not all creeps execute every tick (by design in high-load scenarios)
   - But all creeps get fair opportunity over time

## Implementation

**Core Components**:

1. **Tick Offset Calculation** - Determines starting position in creep list
2. **Last Executed Tracking** - Map storing last execution tick per creep
3. **Starvation Stats Method** - Calculates execution gap statistics
4. **Modified Task Assignment Loop** - Processes creeps with offset

**Key Algorithm**:

```typescript
class TaskManager {
  private lastExecuted: Map<string, number> = new Map();

  public executeTasks(room: Room): void {
    const creeps = room.find(FIND_MY_CREEPS);
    const creepCount = creeps.length;

    // Calculate starting offset (round-robin)
    const tickOffset = Game.time % creepCount;

    // Process creeps starting from offset
    for (let i = 0; i < creepCount; i++) {
      // Check CPU budget
      if (Game.cpu.getUsed() > CPU_THRESHOLD) break;

      // Get creep with round-robin offset
      const index = (i + tickOffset) % creepCount;
      const creep = creeps[index];

      // Execute creep's task
      this.executeCreepTask(creep);

      // Track execution
      this.lastExecuted.set(creep.id, Game.time);
    }
  }

  public getStarvationStats(): StarvationStats {
    const gaps: number[] = [];

    for (const [creepId, lastTick] of this.lastExecuted.entries()) {
      const gap = Game.time - lastTick;
      gaps.push(gap);
    }

    return {
      minGap: Math.min(...gaps),
      maxGap: Math.max(...gaps),
      avgGap: gaps.reduce((a, b) => a + b, 0) / gaps.length
    };
  }
}
```

**Behavior Comparison**:

**Old System** (Sequential, no offset):

```
Tick 1: Process creeps [0-11], stop at CPU limit
Tick 2: Process creeps [0-11], stop at CPU limit
Tick 3: Process creeps [0-11], stop at CPU limit
Result: Creeps 12-24 never execute
```

**New System** (Round-robin with offset):

```
Tick 1: Process creeps [0-11], stop at CPU limit
Tick 2: Process creeps [1-12], stop at CPU limit
Tick 3: Process creeps [2-13], stop at CPU limit
...
Result: All creeps execute over sliding window
```

## Outcomes

**Measured Improvements**:

- ✅ **Eliminated Permanent Starvation** - All creeps now execute within bounded time
- ✅ **Fair CPU Allocation** - Max execution gap reduced from ∞ to 14 ticks (in test scenario)
- ✅ **Improved Economy** - All creeps contribute instead of subset
- ✅ **Predictable Behavior** - Starvation gaps deterministic and bounded

**Performance Comparison** (25 creeps, CPU for 12/tick):

**Old System**:

- Creeps 0-11: Execute every tick (gap = 1)
- Creeps 12-24: Never execute (gap = ∞)
- Min gap: 1 tick
- Max gap: ∞ (permanent starvation)
- Avg gap: N/A (undefined for starved creeps)

**New System**:

- All creeps: Execute in round-robin fashion
- Min gap: 1 tick
- Max gap: 14 ticks
- Avg gap: ~7 ticks
- All creeps productive over time

**Test Coverage**:

- 13 unit tests in `tests/unit/taskManager-round-robin.test.ts`
- 7 regression tests in `tests/regression/task-system-cpu-starvation.test.ts`
- Tests validate fair scheduling under various scenarios

## Trade-offs

**Benefits**:

- Eliminates permanent starvation
- Fair CPU allocation across all creeps
- Bounded execution gaps (predictable)
- Simple implementation (single modulo operation)
- No additional memory overhead

**Costs**:

- Slightly more complex task execution loop
- Need to track last execution per creep (minimal memory)
- May delay high-priority creep execution by a few ticks

**Limitations**:

- Doesn't prioritize critical creeps (all treated equally)
- Execution gaps still exist (by design when CPU limited)
- Optimal for fairness, not necessarily for efficiency

## When to Use

**Appropriate Scenarios**:

- ✅ High creep counts (15+ creeps)
- ✅ CPU-constrained environments
- ✅ Fairness important (all creeps should contribute)
- ✅ Task importance relatively equal across creeps

**Indicators**:

- Creep count exceeds CPU budget for processing all creeps
- Some creeps consistently idle despite assigned tasks
- Economy underperforming despite adequate creep count
- Starvation statistics showing high max gaps

## When to Avoid

**Inappropriate Scenarios**:

- ❌ Low creep counts (all creeps can execute every tick anyway)
- ❌ Priority-critical scenarios (emergency response needs immediate execution)
- ❌ When specific creeps must execute every tick (e.g., defenders during attack)

**Alternative Approaches**:

- Priority-based scheduling (critical creeps first, then round-robin for others)
- Weighted round-robin (some creeps get more frequent execution)
- Dynamic scheduling (adjust based on task urgency)

## Related Patterns

**Builds On**:

- Task queue system (Phase 2)
- CPU threshold checking
- Sequential creep processing

**Enables**:

- Scalable task execution for large creep populations
- Fair resource allocation across economy
- Predictable system behavior under CPU constraints

**Similar Patterns**:

- Priority-based spawn queue (different priority scheme but same queuing concept)
- Traffic management position reservation (fair resource allocation)
- Round-robin CPU scheduling in operating systems

## Lessons Learned

**What Worked Well**:

1. **Simple Solution** - Single modulo operation solved complex fairness problem
2. **Bounded Gaps** - Max gap predictable and acceptable (14 ticks in test scenario)
3. **Zero Overhead** - Minimal CPU/memory cost for fairness benefit
4. **Comprehensive Testing** - 20 tests ensured correct behavior in various scenarios

**What Didn't Work**:

1. **Ignoring Priorities** - Initial implementation treated all creeps equally, but some tasks more urgent
2. **No Metrics Initially** - Starvation problem existed before metrics added to detect it

**Key Insights**:

- **Fairness algorithms important** for multi-agent systems
- **Sequential processing + threshold checking = starvation risk**
- **Simple rotation effective** for fair resource allocation
- **Metrics essential** for detecting fairness violations

## Evolution

**Possible Future Enhancements**:

1. **Priority-Weighted Round-Robin**
   - Defenders/emergency roles get higher priority
   - Still use round-robin for same-priority creeps
   - Prevents critical role starvation while maintaining fairness

2. **Dynamic CPU Budget**
   - Adjust CPU threshold based on bucket level
   - Allow more creeps when bucket high
   - Tighter threshold when bucket low

3. **Task Urgency Integration**
   - Sort creeps by task urgency before round-robin
   - Critical tasks execute first, then round-robin remainder
   - Balances priority and fairness

## Validation Data

**From CHANGELOG.md (v0.57.1)**:

> - **Task System CPU Starvation Prevention**: Implemented round-robin scheduling to ensure fair creep execution under CPU constraints
>   - Added `tickOffset` rotation to prevent same creeps from being consistently skipped
>   - Added `lastExecuted` tracking map to monitor execution gaps per creep
>   - Added `getStarvationStats()` method for monitoring fairness metrics
>   - With 25 creeps and CPU allowing 12/tick: old system permanently starved 13 creeps, new system cycles all with max 14-tick gaps
>   - Created 13 unit tests in `tests/unit/taskManager-round-robin.test.ts` validating fair scheduling
>   - Created 7 regression tests in `tests/regression/task-system-cpu-starvation.test.ts` for high creep count scenarios
>   - Updated `docs/runtime/task-system.md` with round-robin scheduling documentation
>   - All creeps now get equal opportunity to execute tasks, eliminating permanent starvation
>   - Resolves issue: Task system CPU threshold checking may cause starvation with high creep counts

## See Also

**Code References**:

- `packages/bot/src/runtime/tasks/TaskManager.ts` - Implementation
- Task execution loop with offset calculation
- Starvation stats tracking

**Test Coverage**:

- `tests/unit/taskManager-round-robin.test.ts` - 13 unit tests
- `tests/regression/task-system-cpu-starvation.test.ts` - 7 regression tests

**Documentation**:

- `docs/runtime/task-system.md` - Task system documentation (original)
- [Phase 2: Core Framework](../phases/phase-2-core-framework.md) - Phase documentation
- [Strategic Roadmap](../roadmap.md) - Phase progression tracking

**Related Issues**:

- Issue about task system CPU starvation (resolved by v0.57.1)
- CHANGELOG v0.57.1 - Implementation details
