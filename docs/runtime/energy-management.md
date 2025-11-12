# Energy Management and Collection Strategies

This guide covers comprehensive energy management strategies for efficient Screeps bot operation, including static harvesting, hauler logistics, container systems, and distribution prioritization.

## Overview

Energy management is the cornerstone of a successful Screeps colony. An efficient energy system ensures:

- Consistent spawn operation for creep production
- Reliable controller upgrades for RCL progression
- Adequate tower defense and repair capabilities
- Smooth construction and maintenance operations
- Scalable expansion to remote rooms

This document synthesizes best practices from the Screeps community and provides implementation guidance for our bot architecture.

## Energy Collection Architectures

### Drop Mining (Early Game - RCL 1)

**Overview**: Harvesters drop energy on the ground for other creeps to pick up.

**Characteristics**:

- Simplest implementation
- High energy decay loss (~1 energy per 1000 ticks = 0.1% loss)
- No infrastructure required
- Suitable only for initial bootstrap phase

**When to Use**: Only during the first few minutes after spawn until containers can be built.

**Transition Point**: Replace with container mining as soon as RCL 2 is reached and containers are available.

### Static Harvesting with Containers (Mid Game - RCL 2+)

**Overview**: Stationary harvesters mine directly into adjacent containers, with dedicated haulers transporting energy to consumption points.

**Architecture Components**:

1. **Static Harvesters**
   - Position adjacent to source (range 1)
   - Never move from assigned position
   - Minimize MOVE parts (1-2 maximum)
   - Maximize WORK parts for harvest efficiency
   - Include 1 CARRY part for container repair

2. **Containers**
   - Placed adjacent to each source (exactly 1 tile away)
   - Acts as energy buffer (2,000 capacity)
   - Reduces energy decay by ~90% vs. dropped energy
   - Requires periodic repair (decays by 5,000 hits per 500 ticks)

3. **Haulers**
   - Dedicated transport role with multiple CARRY parts
   - Optimized MOVE:CARRY ratio (1:1 for roads, 1:2 for plains)
   - Pick up energy from containers
   - Deliver to priority targets (spawns, extensions, storage)

**Advantages**:

- 90% reduction in energy loss vs. drop mining
- Maximizes source utilization (no wasted regeneration)
- Separates concerns (harvest vs. transport)
- Scales efficiently with room energy capacity

**Container Placement Strategy**:

```
Source Layout Example:

    [ ][ ][ ]
    [ ][S][ ]   S = Source
    [ ][C][ ]   C = Container (optimal placement)
    [ ][ ][ ]
```

**Best Practices**:

- Place container on the tile closest to storage/spawn
- Ensure container is accessible from multiple sides for hauler pickup
- Avoid placing containers on roads (road decay compounds with container decay)
- Consider escape routes for static harvesters (can still move if needed)

### Link-Based Energy Transfer (Late Game - RCL 5+)

**Overview**: Links provide instant energy transfer without hauler movement.

**Key Characteristics**:

- Instant energy transfer (no travel time)
- 3% energy loss per transfer
- Requires RCL 5+ and significant energy investment
- Best for controller upgrading and storage management

**Integration**: Links complement container systems by reducing long-distance hauling for high-throughput targets like the controller.

**Note**: Link systems are outside the scope of this guide but represent the natural evolution of energy distribution at higher RCLs.

## Static Harvester Design

### Body Part Configuration

**Optimal Body Composition**:

```typescript
// Early Game (300 energy capacity - RCL 1)
const bodyEarlyGame = [WORK, WORK, MOVE];
// Cost: 250, Harvest: 4/tick, Carry: 0

// Mid Game (550 energy capacity - RCL 2)
const bodyMidGame = [WORK, WORK, WORK, WORK, CARRY, MOVE];
// Cost: 500, Harvest: 8/tick, Carry: 50

// Late Game (800+ energy capacity - RCL 3+)
const bodyLateGame = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE];
// Cost: 600, Harvest: 10/tick, Carry: 50
```

**Design Rationale**:

- **WORK parts**: Each source generates 10 energy/tick, requiring 5 WORK parts for full utilization
- **CARRY part**: 1 CARRY part (50 capacity) allows container repair without energy loss
- **MOVE part**: 1-2 MOVE parts sufficient since harvester is stationary (1 MOVE for 4-5 WORK parts)

**Source Regeneration Math**:

- Source regenerates 3,000 energy every 300 ticks (10 energy/tick)
- 5 WORK parts harvest 10 energy/tick (full utilization)
- Container capacity 2,000 energy (200 ticks of continuous harvesting)

### Task State Machine

```
MOVE_TO_SOURCE → HARVEST → REPAIR_CONTAINER
      ↑               ↓            ↓
      └───────────────┴────────────┘
```

**States**:

1. **MOVE_TO_SOURCE**: Travel to assigned container position (one-time)
2. **HARVEST**: Continuously harvest energy into container
3. **REPAIR_CONTAINER**: Repair container when hits < 50% of maximum (occasional)

### Memory Structure

```typescript
interface HarvesterMemory {
  role: "staticHarvester";
  sourceId: Id<Source>; // Assigned source (persistent)
  containerId: Id<StructureContainer>; // Target container
  position: { x: number; y: number; roomName: string }; // Static position
  task: "move" | "harvest" | "repair";
  version: number;
}
```

### Implementation Considerations

**Source Assignment**:

- Assign harvesters to specific sources during spawn
- Store `sourceId` in memory for persistence across ticks
- Prevent multiple harvesters from same source (efficiency loss)

**Container Repair Logic**:

- Check container hits every 10 ticks
- Repair when hits < 250,000 (50% of 500,000 max)
- Harvest rate temporarily reduced during repair (acceptable trade-off)

**Energy Efficiency**:

- Full utilization: 10 energy/tick harvested
- Container repair cost: ~100 energy every 100 ticks (1 energy/tick overhead)
- Net efficiency: 9 energy/tick per source = 90% efficiency

## Hauler Architecture

### Role Purpose

Haulers are dedicated energy transport creeps that:

- Pick up energy from containers near sources
- Deliver energy to priority targets (spawns, extensions, towers, storage)
- Balance energy distribution across the room
- Minimize idle time for specialized roles (harvesters, upgraders)

### Body Part Configuration

**Optimal Body Ratios**:

```typescript
// Early Game (300 energy capacity - RCL 1)
const bodyEarlyGame = [CARRY, CARRY, MOVE, MOVE];
// Cost: 200, Capacity: 100, Speed: 1 tile/tick on roads

// Mid Game (550 energy capacity - RCL 2)
const bodyMidGame = [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
// Cost: 400, Capacity: 200, Speed: 1 tile/tick on roads

// Late Game (800+ energy capacity - RCL 3+)
const bodyLateGame = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
// Cost: 450, Capacity: 300, Speed: 0.66 tiles/tick (acceptable with roads)
```

**Design Rationale**:

- **CARRY:MOVE Ratio**: 1:1 for roads (1 tile/tick), 1:2 for plains (0.5 tiles/tick)
- **No WORK Parts**: Haulers specialize in transport only
- **Capacity Target**: 200-400 energy per trip (balances frequency vs. efficiency)

**Trip Efficiency Math**:

- Average trip: 10-20 tiles round trip (20-40 ticks at 1 tile/tick)
- Energy carried: 200-400 per trip
- Throughput: 5-20 energy/tick per hauler
- 2-3 haulers per source (for 2-source room)

### Task State Machine

```
WITHDRAW → DELIVER → (repeat)
    ↑         ↓
    └─────────┘
```

**States**:

1. **WITHDRAW**: Pick up energy from containers near sources
2. **DELIVER**: Transfer energy to priority targets

### Energy Distribution Priority System

**Priority Levels** (highest to lowest):

1. **CRITICAL (Priority 100)** - Spawns with < 300 energy (spawn blocking)
2. **HIGH (Priority 75)** - Extensions (needed for larger creeps)
3. **MEDIUM (Priority 50)** - Towers (defense and repair)
4. **LOW (Priority 25)** - Storage (long-term accumulation)
5. **IDLE (Priority 0)** - Controller containers (overflow)

**Priority Logic**:

```typescript
function getPriorityTarget(room: Room): Structure | null {
  // Priority 1: Spawns below critical threshold
  const criticalSpawns = room.find(FIND_MY_SPAWNS, {
    filter: s => s.store.getFreeCapacity(RESOURCE_ENERGY) >= 300
  });
  if (criticalSpawns.length > 0) return criticalSpawns[0];

  // Priority 2: Extensions with capacity
  const extensions = room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_EXTENSION && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
  });
  if (extensions.length > 0) return extensions[0];

  // Priority 3: Towers below 80% capacity
  const towers = room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_TOWER && s.store.getUsedCapacity(RESOURCE_ENERGY) < 800
  });
  if (towers.length > 0) return towers[0];

  // Priority 4: Storage
  const storage = room.storage;
  if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
    return storage;
  }

  // Priority 5: Controller container (if exists)
  const controllerContainers = room.controller?.pos.findInRange(FIND_STRUCTURES, 3, {
    filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
  });
  if (controllerContainers && controllerContainers.length > 0) {
    return controllerContainers[0];
  }

  return null; // No targets need energy
}
```

**Distribution Rationale**:

- **Spawn Priority**: Prevents spawn blocking (critical for creep production)
- **Extension Priority**: Ensures large creeps can be spawned when needed
- **Tower Priority**: Maintains defense and repair capabilities
- **Storage Secondary**: Accumulates surplus for future use
- **Controller Last**: Upgraders should withdraw from storage, not compete with spawn

### Memory Structure

```typescript
interface HaulerMemory {
  role: "hauler";
  task: "withdraw" | "deliver";
  targetId?: Id<Structure>; // Current target (container or delivery structure)
  version: number;
}
```

### Hauler Count Estimation

**Formula**:

```
Haulers Needed = (Energy Generation Rate) / (Hauler Throughput)

Where:
- Energy Generation Rate = Sources × 10 energy/tick
- Hauler Throughput = (Capacity) / (Round Trip Time)
```

**Example (2-source room, mid-game)**:

```
Energy Generation = 2 sources × 10 energy/tick = 20 energy/tick
Hauler Capacity = 200 energy
Round Trip Time = 30 ticks (average)
Hauler Throughput = 200 / 30 = 6.67 energy/tick

Haulers Needed = 20 / 6.67 = 3 haulers
```

**Scaling Guidelines**:

| RCL | Sources | Haulers | Notes                             |
| --- | ------- | ------- | --------------------------------- |
| 1-2 | 1-2     | 2-3     | Bootstrap phase                   |
| 3-4 | 2       | 3-4     | Establish stable economy          |
| 5-6 | 2+      | 4-6     | Add remote sources, scale haulers |
| 7-8 | 3+      | 6-10    | Links reduce hauler load          |

## Container Management

### Container Lifecycle

**Placement** (RCL 2+):

- Build containers adjacent to each source (1 tile distance)
- Build container near controller (within range 2-3)
- Build container near mineral extractor (RCL 6+)

**Maintenance**:

- Containers decay by 5,000 hits every 500 ticks (10 hits/tick)
- Maximum hits: 500,000 (50 ticks of repair with 1 WORK part)
- Repair threshold: < 250,000 hits (50%)

**Energy Buffer**:

- Container capacity: 2,000 energy
- Source output: 10 energy/tick
- Buffer time: 200 ticks of harvesting (adequate for hauler cycles)

### Container Placement Strategy

**Source Containers**:

```
Goal: Minimize hauler travel distance to spawn/storage

Optimal Placement:
  [ ][ ][ ][ ]
  [ ][S][ ][ ]   S = Source
  [ ][C][ ][ ]   C = Container (on path to spawn/storage)
  [→][→][→][Sp] Sp = Spawn
```

**Controller Containers**:

```
Goal: Support upgraders without blocking hauler paths

Optimal Placement:
  [ ][C][ ]
  [ ][Ct][ ]     Ct = Controller
  [ ][ ][ ]      C = Container (range 2 from controller)
```

**Repair Responsibility**:

Two approaches:

1. **Static Harvesters Repair Containers** (recommended for source containers)
   - Requires 1 CARRY part on harvester
   - Minimal energy overhead (1 energy/tick)
   - No additional creep roles needed

2. **Dedicated Repair Creeps** (for controller/mineral containers)
   - Builder or dedicated repairer role
   - Repairs multiple containers in circuit
   - More efficient for sparse containers

### Container vs. Storage

**Container Use Cases**:

- Energy buffers near sources (temporary storage)
- Controller upgrading stations (upgrader access)
- Remote room energy collection points

**Storage Use Cases** (RCL 4+):

- Long-term energy accumulation (up to 1,000,000 capacity)
- Terminal logistics (RCL 6+)
- Central energy bank for room economy

**Migration Path**: As storage becomes available (RCL 4), transition controller containers to storage-fed upgraders, freeing haulers to focus on spawn/extension priority.

## Energy Distribution Priority System

### Critical Priority Hierarchy

The energy distribution system ensures that critical structures are filled before lower-priority consumers. This prevents spawn blocking and maintains defensive capabilities.

**Priority Tiers**:

1. **TIER 1 - Spawn Operations** (Blocking Prevention)
   - Spawns with < 300 energy (minimum for basic creep)
   - Extensions (required for larger body parts)
   - **Impact if Empty**: Cannot spawn replacement creeps (colony collapse risk)

2. **TIER 2 - Defense & Maintenance** (Survival)
   - Towers with < 80% energy (800/1000)
   - **Impact if Empty**: No defense against hostiles, no structure repair

3. **TIER 3 - Economic Growth** (Long-term)
   - Storage accumulation
   - Controller upgrade energy
   - **Impact if Empty**: Slower RCL progression, but not critical

### Priority Implementation

**Hauler Target Selection**:

```typescript
function selectDeliveryTarget(hauler: Creep, room: Room): Structure | null {
  // Tier 1: Spawn operations (highest priority)
  const spawnTargets = room.find(FIND_MY_SPAWNS, {
    filter: s => s.store.getFreeCapacity(RESOURCE_ENERGY) >= 50
  });

  const extensionTargets = room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_EXTENSION && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
  });

  // Fill spawns and extensions first
  if (spawnTargets.length > 0 || extensionTargets.length > 0) {
    const targets = [...spawnTargets, ...extensionTargets];
    return hauler.pos.findClosestByPath(targets) || targets[0];
  }

  // Tier 2: Defense structures
  const towerTargets = room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_TOWER && s.store.getUsedCapacity(RESOURCE_ENERGY) < 800
  });

  if (towerTargets.length > 0) {
    return hauler.pos.findClosestByPath(towerTargets) || towerTargets[0];
  }

  // Tier 3: Storage (economic growth)
  if (room.storage && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
    return room.storage;
  }

  // No priority targets available
  return null;
}
```

**Upgrader Energy Source Priority**:

```typescript
function getUpgraderEnergySource(upgrader: Creep, room: Room): Structure | null {
  // Priority 1: Storage (should be primary source)
  if (room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 1000) {
    return room.storage;
  }

  // Priority 2: Controller container (if no storage or storage low)
  const controllerContainers = room.controller?.pos.findInRange(FIND_STRUCTURES, 3, {
    filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
  });

  if (controllerContainers && controllerContainers.length > 0) {
    return controllerContainers[0];
  }

  // Priority 3: Source containers (only if nothing else available)
  // WARNING: This competes with haulers and should be avoided
  const sourceContainers = room.find(FIND_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getUsedCapacity(RESOURCE_ENERGY) > 500
  });

  if (sourceContainers.length > 0) {
    return upgrader.pos.findClosestByPath(sourceContainers) || sourceContainers[0];
  }

  return null;
}
```

**Key Principles**:

1. **Never Compete with Spawn**: Upgraders should withdraw from storage or dedicated controller containers, not source containers
2. **Prevent Spawn Blocking**: Haulers always prioritize spawns and extensions
3. **Tower Reserve**: Maintain 80% tower energy for defense response
4. **Storage Buffer**: Accumulate energy in storage before controller upgrades
5. **Upgrader Throttling**: Reduce upgrader population if spawns frequently empty

## Current Implementation Analysis

### Existing Systems (as of v1.x)

**Current Architecture**:

- Harvester role combines harvesting and delivery (no static harvesters)
- No dedicated hauler role (harvesters transport their own energy)
- No container-based energy buffering
- Upgraders withdraw from spawns/extensions (competes with spawn operations)

**Current Harvester Behavior** (from `creep-roles.md`):

```
HARVEST → DELIVER → UPGRADE (fallback)
```

- Harvesters move to sources, harvest, return to spawn/extensions
- When no delivery targets available, harvesters upgrade controller
- 2 harvesters minimum, [WORK, CARRY, MOVE] body

**Current Upgrader Behavior**:

```
RECHARGE ⟷ UPGRADE
```

- Upgraders withdraw from spawns, extensions, containers (no priority)
- 1 upgrader minimum, [WORK, CARRY, MOVE] body

### Identified Gaps

**Gap 1: No Static Harvester System**

- **Issue**: Harvesters waste time and energy traveling between sources and delivery targets
- **Impact**: 30-40% efficiency loss due to travel time
- **Recommendation**: Implement static harvesters with containers (Phase 1 priority)

**Gap 2: No Dedicated Hauler Role**

- **Issue**: Harvesters double as transporters (inefficient specialization)
- **Impact**: Slower energy collection, lower throughput
- **Recommendation**: Create dedicated hauler role (Phase 1 priority)

**Gap 3: Energy Priority System Missing**

- **Issue**: Upgraders withdraw from spawn/extensions, competing with spawn operations (see #607, #614, #638)
- **Impact**: Spawn blocking, unable to spawn larger creeps when needed
- **Recommendation**: Implement priority-based energy distribution (Phase 1 priority)

**Gap 4: No Container Infrastructure**

- **Issue**: Energy dropped on ground or stored only in spawn
- **Impact**: Energy decay, limited buffering capacity
- **Recommendation**: Build containers adjacent to sources and controller (Phase 1 priority)

**Gap 5: Upgraders Lack Storage Integration**

- **Issue**: Upgraders compete with spawn for energy from spawns/extensions
- **Impact**: Related to Gap 3, causes spawn container depletion (#607, #638)
- **Recommendation**: Upgraders should prioritize storage/controller containers (Phase 2 priority)

## Implementation Roadmap

### Phase 1: Core Infrastructure (High Priority)

**Goal**: Establish static harvester + hauler architecture with energy priority system.

**Tasks**:

1. **Create Static Harvester Role**
   - New role: `staticHarvester`
   - Body: `[WORK, WORK, WORK, WORK, CARRY, MOVE]` (scalable)
   - Task: Move to source once, harvest continuously
   - Container repair logic (when container hits < 50%)
   - Memory: Store `sourceId` and `containerId`

2. **Create Hauler Role**
   - New role: `hauler`
   - Body: `[CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]` (scalable)
   - Task: Withdraw from containers, deliver to priority targets
   - Implement priority target selection (spawn/extension > tower > storage)

3. **Build Container Infrastructure**
   - Add construction planning for containers
   - Place containers adjacent to sources (distance 1)
   - Place container near controller (distance 2-3)
   - Add to builder priorities

4. **Implement Energy Priority System**
   - Modify hauler delivery logic to prioritize spawn/extensions
   - Modify upgrader recharge logic to avoid spawn/extensions (use storage/containers)
   - Add energy level thresholds for tower filling

5. **Update Spawn Manager**
   - Adjust spawn priorities: staticHarvester > hauler > upgrader > builder
   - Configure minimum population: 2 staticHarvesters, 3 haulers, 1 upgrader
   - Scale body parts based on room energy capacity

**Expected Outcomes**:

- 50-70% increase in energy collection efficiency
- Elimination of spawn blocking issues (#607, #614, #638)
- Stable energy flow for controller upgrades and construction

### Phase 2: Optimization and Scaling (Medium Priority)

**Goal**: Optimize energy logistics and scale to remote rooms.

**Tasks**:

1. **Container Repair Management**
   - Evaluate harvester repair vs. dedicated repairer performance
   - Optimize repair timing (before container critical)

2. **Hauler Route Optimization**
   - Implement hauler request system (structures request energy)
   - Optimize hauler paths to minimize travel distance
   - Add hauler capacity tracking to prevent over/under provisioning

3. **Storage Integration**
   - Prioritize storage as primary upgrader energy source
   - Implement storage filling logic for haulers (when spawn/extensions full)
   - Add terminal logistics (RCL 6+)

4. **Remote Harvesting Integration**
   - Apply static harvester + hauler pattern to remote rooms
   - Add remote container management
   - Scale hauler population for remote energy transport

5. **Performance Monitoring**
   - Track energy flow rates (input vs. consumption)
   - Monitor spawn uptime (% of time spawning)
   - Alert on energy starvation conditions

**Expected Outcomes**:

- 80-90% reduction in hauler idle time
- Scalable energy system for multi-room operation
- Predictable energy flow for economic planning

### Phase 3: Advanced Systems (Low Priority)

**Goal**: Implement advanced energy distribution and link networks.

**Tasks**:

1. **Link Network** (RCL 5+)
   - Deploy links near sources, storage, and controller
   - Implement link energy transfer logic
   - Reduce hauler load for long-distance transfers

2. **Dynamic Population Scaling**
   - Adjust harvester/hauler counts based on energy demand
   - Scale upgrader population based on storage surplus
   - Implement energy-based spawn priority adjustments

3. **Advanced Hauler Logistics**
   - Implement request batching (multiple pickups per trip)
   - Add path-based route optimization
   - Consider NP-hard hauling algorithms (see Ben Bartlett's blog)

**Expected Outcomes**:

- Near-optimal energy distribution efficiency
- CPU-efficient link-based transfers
- Self-adjusting population based on economic conditions

## Related Issues and Cross-References

### Active Issues (Energy Priority System)

**Issue #607: Spawn container energy depletion prevents larger creep spawning**

- **Status**: Open
- **Relation**: Gap 3 (Energy Priority System Missing) and Gap 5 (Upgraders Lack Storage Integration)
- **Root Cause**: Upgraders compete with spawn for energy from spawns/extensions
- **Solution**: Implement Phase 1, Task 4 (Energy Priority System) to prevent upgraders from withdrawing from spawn

**Issue #614: Upgraders should prioritize filling spawn/extensions before upgrading controller**

- **Status**: Open
- **Relation**: Gap 3 (Energy Priority System Missing)
- **Root Cause**: No energy distribution priority logic
- **Solution**: Modify upgrader recharge logic to prioritize storage/controller containers, not spawn/extensions (Phase 1, Task 4)

**Issue #638: Implement energy priority system for spawn/tower containers before controller upgrades**

- **Status**: Open
- **Relation**: Gap 3 (Energy Priority System Missing)
- **Root Cause**: Upgraders withdraw from spawn/tower containers instead of storage
- **Solution**: Implement hauler priority logic (spawn/extension > tower > storage) and upgrader storage preference (Phase 1, Tasks 2 and 4)

### Closed Issues (Architectural Foundation)

**Issue #562: Containers near spawn not being filled by harvesters**

- **Status**: Closed
- **Relation**: Precursor to Gap 4 (No Container Infrastructure)
- **Context**: Identified need for container-based energy management

**Issue #537: Stationary harvester and hauler role architecture**

- **Status**: Closed
- **Relation**: Gap 1 (No Static Harvester System) and Gap 2 (No Dedicated Hauler Role)
- **Context**: Architectural discussion that led to this implementation roadmap

### Implementation Dependencies

```
Phase 1 Task Dependencies:

1. Static Harvester Role ──┐
2. Hauler Role ───────────┼──> 5. Spawn Manager Updates
3. Container Infrastructure │
4. Energy Priority System ──┘

Phase 2 depends on Phase 1 completion
Phase 3 depends on Phase 2 completion
```

## Performance Benchmarks and Metrics

### Expected Efficiency Gains

**Current System (v1.x, no containers)**:

- Energy collection efficiency: ~60% (40% lost to travel time)
- Spawn uptime: ~70% (blocked by energy shortages)
- Upgrader idle time: ~20% (waiting for energy)

**Phase 1 Implementation (static harvesters + haulers)**:

- Energy collection efficiency: ~90% (10% container decay and hauler travel)
- Spawn uptime: ~95% (priority system prevents blocking)
- Upgrader idle time: ~5% (storage-fed, consistent supply)

**Phase 2 Optimization (route optimization + storage integration)**:

- Energy collection efficiency: ~95% (optimized hauler routes)
- Spawn uptime: ~98% (predictable energy flow)
- Upgrader idle time: ~2% (dedicated energy source)

### Key Performance Indicators (KPIs)

**Energy Flow Metrics**:

- **Harvest Rate**: Energy harvested per tick (target: 10 energy/tick per source)
- **Delivery Rate**: Energy delivered to spawn/extensions per tick (target: 8-10 energy/tick)
- **Storage Accumulation**: Energy stored per tick (target: positive after spawn/extension full)
- **Energy Loss**: Energy decayed or wasted (target: < 5% of harvest rate)

**Spawn Metrics**:

- **Spawn Uptime**: % of time spawn is spawning (target: > 95%)
- **Spawn Block Time**: Ticks with < 300 energy in spawn (target: < 1% of ticks)
- **Spawn Queue Depth**: Number of pending spawn requests (target: < 3)

**Upgrader Metrics**:

- **Upgrade Rate**: Control points added per tick (target: proportional to storage surplus)
- **Upgrader Idle Time**: % of time upgraders have no energy (target: < 5%)

**Hauler Metrics**:

- **Hauler Utilization**: % of time haulers are carrying energy (target: > 80%)
- **Average Trip Time**: Ticks per withdraw-deliver cycle (target: < 30 ticks)
- **Hauler Count**: Number of haulers relative to sources (target: 1.5-2 haulers per source)

### Monitoring Integration

**Existing Systems**:

- `src/runtime/metrics/` - CPU tracking and performance accounting
- `src/runtime/evaluation/` - Health reports and improvement recommendations

**Recommended Additions**:

- Energy flow dashboard (harvest, delivery, storage rates)
- Spawn uptime tracking (alert on < 90%)
- Hauler efficiency metrics (utilization, trip time)
- Container health monitoring (hits, energy levels)

**Alert Conditions**:

- Spawn energy < 300 for > 10 ticks (spawn blocking)
- Tower energy < 500 (defense risk)
- Container hits < 100,000 (repair urgently)
- Hauler utilization < 50% (over-provisioned)
- Storage energy declining (energy deficit)

## References and Further Reading

### Screeps Community Resources

**Static Harvesting**:

- [ScreepsPlus Wiki: Static Harvesting](https://wiki.screepspl.us/Static_Harvesting/)
- [ScreepsPlus Wiki: Energy Management](https://wiki.screepspl.us/Energy/)

**Hauler Logistics**:

- [Ben Bartlett: Screeps #4 - Hauling is (NP-)hard](https://bencbartlett.com/blog/screeps-4-hauling-is-np-hard/)
- Advanced routing algorithms and optimization strategies

**Container Mining**:

- [Screeps Forum: Harvesting from Multiple Sources](https://screeps.com/forum/topic/2364/harvesting-from-multiple-sources-within-a-room)
- Source assignment and memory management patterns

**Video Tutorials**:

- [Marvin's Screeps Tutorial: Stationary Harvesting](https://www.youtube.com/watch?v=crPpdTtUTXk)
- Visual walkthrough of container-based harvesting

### Repository Documentation

**Related Guides**:

- [Creep Roles](./strategy/creep-roles.md) - Current role implementations
- [Spawn Management](./operations/spawn-management.md) - Spawn queue and body generation
- [Remote Harvesting](./strategy/remote-harvesting.md) - Remote room energy collection
- [Memory Management](./operations/memory-management.md) - Memory structure and optimization
- [Performance Monitoring](./operations/performance-monitoring.md) - CPU and metrics tracking

**Architecture References**:

- [Task System](./task-system.md) - Task prioritization framework
- [Base Building](./base-building.md) - Room layout and structure placement
- [Scaling Strategies](./strategy/scaling-strategies.md) - Multi-room expansion

## Summary

This energy management guide synthesizes best practices from the Screeps community and provides a comprehensive roadmap for implementing efficient energy collection and distribution systems. The key takeaways are:

1. **Static Harvesting with Containers**: 90% efficiency gain over drop mining
2. **Dedicated Hauler Role**: Separates transport from harvesting for specialization
3. **Energy Priority System**: Prevents spawn blocking and maintains defense capabilities
4. **Storage Integration**: Upgraders use storage, not spawn/extensions
5. **Scalable Architecture**: Applicable to single-room and multi-room colonies

**Next Steps**:

1. Review Phase 1 implementation tasks (see Roadmap section)
2. Assign issues for high-priority tasks (static harvesters, haulers, priority system)
3. Implement Phase 1 incrementally with testing between each task
4. Monitor performance metrics and adjust based on KPIs
5. Proceed to Phase 2 once Phase 1 is stable and validated

---

_This guide was created by integrating the Screeps community energy collection guide with repository documentation. For questions or improvements, open an issue with the `documentation` label._
