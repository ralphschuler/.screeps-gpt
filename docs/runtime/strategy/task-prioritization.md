# Task Prioritization and Efficiency

This document describes how creeps prioritize tasks and optimize their behavior for maximum efficiency.

## Overview

The task prioritization system ensures creeps make optimal decisions about what action to perform each tick based on their current state, role, and room conditions.

## Harvester Task Priority

### Priority Hierarchy

1. **HARVEST** (Highest Priority when empty)
   - Executed when: `store.getFreeCapacity(RESOURCE_ENERGY) > 0`
   - Goal: Fill carry capacity to maximum
   - Efficiency target: 100% capacity utilization

2. **DELIVER** (High Priority when full)
   - Executed when: `store.getUsedCapacity(RESOURCE_ENERGY) > 0` AND delivery targets exist
   - Goal: Supply spawn infrastructure
   - Efficiency target: Minimize delivery travel time

3. **UPGRADE** (Fallback Priority)
   - Executed when: No delivery targets available
   - Goal: Use surplus energy productively
   - Efficiency target: Zero wasted energy

### Target Selection Algorithm

**Source Selection (HARVEST)**:

```
1. Find all active sources in room
2. Calculate path costs to each source
3. Select closest by path
4. Fallback to first source if pathfinding fails
```

**Efficiency Considerations**:

- Closest path reduces travel overhead
- Active sources check prevents targeting depleted sources
- Fallback ensures creep always has a target

**Delivery Target Selection (DELIVER)**:

```
1. Find spawns and extensions with free energy capacity
2. Filter for structures that can accept energy
3. Calculate path costs to each structure
4. Select closest by path
5. Fallback to first structure if pathfinding fails
```

**Priority Order** (implicit in filter):

1. Spawns (enables new creep production)
2. Extensions (enables larger creep bodies)

**Efficiency Considerations**:

- Closest target minimizes delivery time
- Free capacity check prevents wasted transfer attempts
- No explicit priority between spawns/extensions (proximity wins)

### Task Transition Timing

**Immediate Transitions**: No delay between state changes

- `HARVEST → DELIVER`: Triggered same tick when capacity full
- `DELIVER → HARVEST`: Triggered same tick when energy depleted
- `DELIVER → UPGRADE`: Triggered same tick when no delivery targets

**Benefits**:

- Zero idle ticks
- Maximum creep utilization
- Responsive to changing conditions

## Upgrader Task Priority

### Priority Hierarchy

1. **RECHARGE** (Highest Priority when empty)
   - Executed when: `store.getFreeCapacity(RESOURCE_ENERGY) > 0`
   - Goal: Acquire energy for upgrading
   - Efficiency target: Minimize withdrawal travel time

2. **UPGRADE** (High Priority when full)
   - Executed when: `store.getUsedCapacity(RESOURCE_ENERGY) > 0`
   - Goal: Convert energy to controller points
   - Efficiency target: 100% energy → controller point conversion

### Energy Source Selection

**Source Priority Order** (explicit in filter):

```
1. Spawns with stored energy
2. Extensions with stored energy
3. Containers with stored energy
```

**Selection Algorithm**:

```
1. Find all valid energy structures
2. Filter for structures with available energy
3. Calculate path costs to each structure
4. Select closest by path
5. Fallback to first structure if pathfinding fails
```

**Efficiency Considerations**:

- Harvests from storage rather than competing with harvesters for sources
- Closest source minimizes recharge cycle time
- Container support enables longer-distance energy collection

### Task Transition Timing

**Immediate Transitions**:

- `RECHARGE → UPGRADE`: Same tick when capacity full
- `UPGRADE → RECHARGE`: Same tick when energy depleted

## Pathfinding Optimization

### Path Reuse Strategy

**Configuration**: `reusePath: 5`

**Behavior**:

- Path calculated once, reused for 5 ticks
- New path calculated on tick 6 or target change
- Significantly reduces CPU cost

**Cost Analysis**:

- Fresh pathfinding: ~0.5-2.0 CPU per creep
- Cached path reuse: ~0.05-0.1 CPU per creep
- **Savings: 90-95% CPU reduction**

### Path Invalidation Triggers

Paths are recalculated when:

1. **TTL expires** (5 ticks elapsed)
2. **Target changes** (source/structure changes)
3. **ERR_NO_PATH returned** (blocked path)

### Range Optimization

**Harvest/Withdraw/Transfer**: `range: 1`

- Must be adjacent to interact
- Pathfinding targets 1-tile proximity

**Upgrade Controller**: `range: 3`

- Can upgrade from 3 tiles away
- Reduces repositioning overhead
- Allows multiple upgraders around controller

## Efficiency Metrics

### Harvester Efficiency

**Ideal Cycle** (no contention, close sources):

```
Harvest Time:    25 ticks  (50 energy / 2 per tick)
Travel to Spawn:  5 ticks
Deliver Time:     1 tick
Travel to Source: 5 ticks
─────────────────────────
Total Cycle:     36 ticks
Energy per Tick:  1.39    (50 / 36)
```

**Real-World Cycle** (with contention):

```
Harvest Time:    25 ticks
Travel + Queue:  10 ticks  (waiting for spawn access)
Deliver Time:     1 tick
Travel to Source: 10 ticks (path reuse reduces cost)
─────────────────────────
Total Cycle:     46 ticks
Energy per Tick:  1.09    (50 / 46)
```

### Upgrader Efficiency

**Ideal Cycle**:

```
Withdraw Time:    1 tick
Travel to Controller: 5 ticks
Upgrade Time:    50 ticks  (1 energy per tick)
Travel to Source: 5 ticks
─────────────────────────
Total Cycle:     61 ticks
Points per Tick:  0.82    (50 / 61)
```

**Real-World Cycle**:

```
Withdraw Time:    1 tick
Travel:          10 ticks  (longer distance)
Upgrade Time:    50 ticks
Travel:          10 ticks
─────────────────────────
Total Cycle:     71 ticks
Points per Tick:  0.70    (50 / 71)
```

## Task Switching Overhead

### Zero-Latency Switching

The current implementation has **no explicit overhead** for task switches:

- Conditions checked every tick
- Transitions happen immediately
- No "waiting" or "idle" states

### Implicit Overhead Sources

1. **Pathfinding Recalculation**
   - Occurs when target changes
   - Mitigated by path caching
   - Cost: ~0.5 CPU one-time

2. **Target Search**
   - Find operations executed every task switch
   - Cost: ~0.1-0.3 CPU per search
   - Cannot be cached (room state changes)

3. **Movement Latency**
   - Creep must travel to new target
   - Time: varies by distance
   - Optimization: minimize unnecessary switches

## Load Balancing

### Source Distribution

**Current Behavior**: All harvesters use "closest source" logic

- **Risk**: Multiple harvesters on same source
- **Contention**: Reduced harvest efficiency
- **Mitigation**: None (implicit load balancing by spawn timing)

**Optimization Opportunity**:

- Assign harvesters to specific sources
- Prevent overcrowding
- Potential efficiency gain: 10-20%

### Spawn Access

**Current Behavior**: All harvesters use "closest spawn/extension" logic

- **Risk**: Queue formation at spawns
- **Contention**: Harvesters wait for transfer access
- **Mitigation**: None (first-come-first-served)

**Optimization Opportunity**:

- Distribute deliveries across extensions
- Reserve spawns for critical transfers
- Potential efficiency gain: 5-15%

## Energy Flow Balance

### Steady State Requirements

For sustainable operation:

```
Harvest Rate ≥ Spawn Cost Rate + Upgrade Cost Rate + Maintenance
```

**Minimum Viable Economy** (RCL 1):

- 2 Harvesters: ~10 energy/tick income
- Spawn cost: ~1.4 energy/tick average (50 energy / 36 tick cycle)
- Upgrader consumption: ~0.8 energy/tick (1 upgrader fully utilized)
- **Balance**: 10 - 1.4 - 0.8 = 7.8 energy/tick surplus ✓

### Bottleneck Identification

**Common Bottlenecks**:

1. **Insufficient Harvesters**
   - Symptom: Spawns frequently empty
   - Metric: `spawn.store.energy < 50` for >50% of ticks
   - Solution: Add 1 harvester

2. **Insufficient Upgraders**
   - Symptom: Spawns frequently at capacity
   - Metric: `spawn.store.energy === spawn.store.getCapacity(RESOURCE_ENERGY)` for >20% of ticks
   - Solution: Add 1 upgrader

3. **Insufficient CPU**
   - Symptom: Bucket draining
   - Metric: `Game.cpu.bucket < 1000` trend downward
   - Solution: Reduce creep count or optimize pathfinding

## Priority Inversion Scenarios

### Harvester Stealing from Upgrader

**Scenario**: Harvester uses UPGRADE task as fallback

- **Risk**: Competes with upgraders for controller access
- **Impact**: Reduces upgrader efficiency (positioning conflicts)
- **Frequency**: Only when spawns/extensions full
- **Mitigation**: None needed (overflow handling)

### Source Competition

**Scenario**: Multiple harvesters target same source

- **Risk**: Harvest slots fill up (max 5 adjacent positions)
- **Impact**: Some harvesters idle waiting for access
- **Frequency**: Common with >2 harvesters on 1 source
- **Mitigation**: Manual source assignment (not implemented)

## Task Efficiency Improvements

### Potential Optimizations

1. **Source Assignment**
   - Assign harvesters to specific sources
   - Prevents overcrowding
   - Estimated gain: 10-20% harvest efficiency

2. **Delivery Batching**
   - Wait for fuller capacity before delivering
   - Reduces travel overhead
   - Estimated gain: 5-10% delivery efficiency
   - **Trade-off**: Increased response latency

3. **Predictive Task Switching**
   - Start moving to next target before current task completes
   - Reduces transition latency
   - Estimated gain: 2-5% overall efficiency
   - **Complexity**: High (requires precise timing)

4. **Priority Delivery Targets**
   - Prioritize spawns over extensions explicitly
   - Ensures spawn queue never starves
   - Estimated gain: 3-7% spawn uptime

## Related Documentation

- [Creep Roles](./creep-roles.md) - Role definitions and behavior logic
- [Scaling Strategies](./scaling-strategies.md) - Population scaling guidelines
- [Performance Monitoring](../operations/performance-monitoring.md) - Efficiency measurement
- [Safe Refactoring](../development/safe-refactoring.md) - How to modify task logic safely
