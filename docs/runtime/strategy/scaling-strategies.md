# Scaling Strategies

This document describes how to scale the Screeps AI from a single room to multiple rooms while maintaining efficiency and staying within CPU limits.

## Overview

Scaling in Screeps involves managing increasing numbers of creeps, rooms, and structures while staying within the CPU limit. This requires careful planning and incremental expansion.

## Room Control Level (RCL) Progression

### RCL 1: Foundation

**Characteristics**:

- 1 spawn available
- 1-2 sources accessible
- 300 energy capacity (spawn only)
- No extensions

**Optimal Composition**:

- 2 Harvesters (minimum viable economy)
- 1 Upgrader (controller maintenance)
- Total: 3 creeps

**CPU Budget**: ~2-3 CPU/tick

- Memory management: ~0.1 CPU
- Spawn logic: ~0.1 CPU
- 3 creeps × 0.5 CPU: ~1.5 CPU
- Kernel overhead: ~0.5 CPU

**Energy Flow**:

- Income: ~10 energy/tick (2 harvesters, 1 source)
- Spawn cost: ~1.4 energy/tick average
- Upgrade rate: ~0.8 energy/tick
- Surplus: ~7.8 energy/tick (enables upgrades)

**Bottleneck**: Energy storage (300 capacity limits growth)

### RCL 2: Expansion

**Unlocks**:

- 5 extensions (50 energy each) = +250 energy capacity
- Ramparts and walls
- Total capacity: 550 energy

**Optimal Composition**:

- 3-4 Harvesters (2 per source ideal)
- 1-2 Upgraders (consume surplus energy)
- Total: 4-6 creeps

**CPU Budget**: ~3-5 CPU/tick

**Energy Flow**:

- Income: ~15-20 energy/tick (3-4 harvesters, 2 sources)
- Spawn cost: ~2 energy/tick average (more frequent spawning)
- Upgrade rate: ~1-2 energy/tick (1-2 upgraders)
- Surplus: ~12-17 energy/tick

**Scaling Decision**:

- Add 3rd harvester when spawn queue >3
- Add 2nd upgrader when spawns at capacity >20% of time

**Bottleneck**: Spawn availability (single spawn limits throughput)

### RCL 3: Infrastructure

**Unlocks**:

- 10 extensions (50 energy each) = +500 energy capacity
- Towers
- Total capacity: 800 energy

**Optimal Composition**:

- 4-5 Harvesters
- 2-3 Upgraders
- 0-1 Builder (optional, for construction)
- Total: 6-9 creeps

**CPU Budget**: ~5-8 CPU/tick

**Energy Flow**:

- Income: ~20-25 energy/tick
- Spawn cost: ~2.5 energy/tick
- Upgrade rate: ~2-3 energy/tick
- Tower defense: ~0-5 energy/tick (sporadic)
- Surplus: ~10-15 energy/tick

**Scaling Decision**:

- Add 5th harvester if sources underutilized
- Add 3rd upgrader if consistent energy surplus
- CPU becomes a consideration (monitor bucket)

**Bottleneck**: CPU efficiency and spawn throughput

### RCL 4+: Optimization

**Unlocks** (RCL 4):

- 20 extensions (50 energy each) = +1000 energy capacity
- Storage structure (unlimited capacity)
- Total capacity: 1300 energy

**Focus**: Optimize for efficiency before expanding further

**Optimal Composition**:

- 2 Harvesters per source (4-6 total)
- 3-5 Upgraders
- 1-2 Builders (for infrastructure)
- Total: 8-13 creeps

**CPU Budget**: ~8-15 CPU/tick

**Optimization Goals**:

1. Reduce per-creep CPU cost
2. Implement better pathfinding
3. Add energy storage management
4. Prepare for multi-room expansion

## Multi-Room Expansion Strategy

### When to Expand

**Prerequisites**:

- Current room at RCL 4+
- Stable economy (10+ energy/tick surplus)
- CPU bucket >5000 (safety margin)
- Storage structure active

**Expansion Checklist**:

- [ ] Claim new room with controller
- [ ] Build first spawn in new room
- [ ] Establish energy supply chain
- [ ] Monitor CPU usage increase

### Room Claim Process

**Step 1: Scout and Claim**

- Create claimer creep (1 CLAIM, 1 MOVE)
- Move to target room
- Use `claimController()` action
- Cost: ~650 energy + 1 CPU/tick during travel

**Step 2: Remote Harvesting**

- Send harvesters from main room
- Establish energy pipeline
- Build first spawn foundation
- Cost: ~5000 energy for spawn, ~2-3 CPU/tick

**Step 3: Bootstrap New Room**

- Wait for spawn construction (15000 ticks = ~100 real-time hours)
- Spawn first creeps in new room
- Gradually reduce remote harvesting
- Cost: Temporary energy drain, +2-3 CPU/tick

### Multi-Room CPU Budget

**CPU Distribution**:

```
Main Room (RCL 6):     ~15 CPU/tick
Secondary Room (RCL 2): ~3 CPU/tick
Kernel + Memory:        ~1 CPU/tick
─────────────────────────────────
Total:                 ~19 CPU/tick
```

**CPU Limit Considerations**:

- Subscription: 30 CPU/tick
- Free tier: 10 CPU/tick (insufficient for 2+ rooms)
- Recommendation: Subscribe before claiming 2nd room

## Creep Body Scaling

### Early Game Bodies (RCL 1-2)

**Harvester**: `[WORK, CARRY, MOVE]`

- Cost: 50 energy
- Harvest rate: 2/tick
- Capacity: 50 energy
- Speed: 1 tile/tick

**Upgrader**: `[WORK, CARRY, MOVE]`

- Cost: 50 energy
- Upgrade rate: 1 point/energy
- Capacity: 50 energy
- Speed: 1 tile/tick

### Mid Game Bodies (RCL 3-4)

**Harvester**: `[WORK, WORK, CARRY, MOVE, MOVE]`

- Cost: 300 energy
- Harvest rate: 4/tick (2× faster)
- Capacity: 50 energy (same)
- Speed: 1 tile/tick (balanced)

**Upgrader**: `[WORK, WORK, CARRY, CARRY, MOVE, MOVE]`

- Cost: 350 energy
- Upgrade rate: 2 points/energy (2× faster)
- Capacity: 100 energy (2× larger)
- Speed: 1 tile/tick (balanced)

### Late Game Bodies (RCL 5+)

**Harvester**: `[WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE]`

- Cost: 550 energy
- Harvest rate: 6/tick (3× faster)
- Capacity: 100 energy
- Speed: 1 tile/tick
- **Efficiency**: Fewer creeps needed (reduces CPU)

**Upgrader**: `[WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]`

- Cost: 800 energy
- Upgrade rate: 4 points/energy (4× faster)
- Capacity: 200 energy (4× larger)
- Speed: 1 tile/tick
- **Efficiency**: Significantly reduces upgrader count

## Scaling Decision Matrix

### Add Harvester When:

| Symptom               | Metric                               | Action                  |
| --------------------- | ------------------------------------ | ----------------------- |
| Spawns empty          | `spawn.store.energy < 50` >50% ticks | +1 Harvester            |
| Sources underutilized | <2 creeps per source                 | +1 Harvester per source |
| Spawn queue depth     | >5 pending creeps                    | +1 Harvester            |
| Controller downgrade  | <5000 ticks to downgrade             | +1 Harvester            |

### Add Upgrader When:

| Symptom            | Metric                                  | Action      |
| ------------------ | --------------------------------------- | ----------- |
| Spawns at capacity | `spawn.store.energy === 300` >20% ticks | +1 Upgrader |
| Energy surplus     | Consistent 10+ energy/tick surplus      | +1 Upgrader |
| Slow RCL progress  | <500 control points/1000 ticks          | +1 Upgrader |
| CPU available      | Bucket >8000, current usage <80% limit  | +1 Upgrader |

### Reduce Creeps When:

| Symptom             | Metric                      | Action                 |
| ------------------- | --------------------------- | ---------------------- |
| CPU bucket draining | Bucket <2000 and decreasing | Reduce upgraders first |
| Excessive idle time | Creeps idle >20% of ticks   | Reduce role count      |
| Over-harvesting     | Energy waste visible        | Reduce harvester count |

## CPU Optimization Strategies

### Pathfinding Optimization

**Current Implementation**: `reusePath: 5`

- Recalculates path every 5 ticks
- Cost: ~0.5 CPU per recalculation
- **Optimization**: Increase to `reusePath: 10` for stable rooms
- **Savings**: ~50% pathfinding CPU

### Memory Access Optimization

**Current Implementation**: Direct Memory access each tick

- Cost: ~0.1 CPU per creep per tick
- **Optimization**: Cache frequently accessed memory in local variables
- **Savings**: ~20-30% memory access CPU

### Role-Specific Optimization

**Harvester Optimization**:

- Assign to specific sources (prevents competition)
- Use container mining (reduces movement)
- **Potential savings**: 15-25% harvester CPU

**Upgrader Optimization**:

- Position statically near controller
- Use link for energy delivery (late game)
- **Potential savings**: 30-40% upgrader CPU

## Scaling Benchmarks

### Single Room Performance

| RCL | Creeps | CPU/tick | Energy/tick | Upgrade Rate | Bucket Trend |
| --- | ------ | -------- | ----------- | ------------ | ------------ |
| 1   | 3      | 2-3      | 10          | 0.8          | Stable       |
| 2   | 5      | 3-5      | 18          | 1.5          | Increasing   |
| 3   | 8      | 5-8      | 23          | 2.5          | Stable       |
| 4   | 10     | 8-12     | 28          | 3.5          | Stable       |
| 5   | 12     | 10-15    | 35          | 5.0          | Stable       |
| 6   | 14     | 12-18    | 40          | 7.0          | Decreasing\* |

\*At RCL 6, CPU optimization becomes critical for free tier users.

### Multi-Room Performance

| Total Rooms | Total Creeps | CPU/tick | Subscription | Viable? |
| ----------- | ------------ | -------- | ------------ | ------- |
| 1           | 8-12         | 8-15     | No           | ✓ Yes   |
| 2           | 18-24        | 18-25    | Required     | ✓ Yes   |
| 3           | 30-38        | 28-38    | Required     | ✓ Yes   |
| 4+          | 40+          | 38+      | Required     | Careful |

**Note**: CPU limit with subscription is typically 30 CPU/tick for most players.

## Scaling Failure Modes

### CPU Bucket Depletion

**Symptoms**:

- Bucket drops below 500
- Warning: "CPU bucket is depleted"
- Game execution may be throttled

**Recovery**:

1. Reduce upgrader count immediately
2. Increase path reuse duration
3. Monitor bucket recovery
4. Identify CPU-intensive operations

### Spawn Starvation

**Symptoms**:

- Spawns empty most ticks
- Creep population declining
- Controller downgrade timer low

**Recovery**:

1. Add emergency harvester (highest priority)
2. Disable upgraders temporarily
3. Focus all energy on spawning harvesters
4. Resume normal operations once stable

### Controller Downgrade

**Symptoms**:

- `controller.ticksToDowngrade < 5000`
- Warning: "Controller will downgrade soon"
- RCL progress negative

**Recovery**:

1. Add upgraders immediately
2. Ensure harvesters deliver to upgraders
3. Sacrifice other operations for upgrades
4. Monitor downgrade timer until >10000

## Related Documentation

- [Creep Roles](./creep-roles.md) - Role definitions and body configurations
- [Task Prioritization](./task-prioritization.md) - Task efficiency and optimization
- [Performance Monitoring](../operations/performance-monitoring.md) - CPU tracking and alerting
- [Memory Management](../operations/memory-management.md) - Memory optimization for scaling
