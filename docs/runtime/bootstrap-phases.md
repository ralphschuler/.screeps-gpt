# Bootstrap Phase System

**Purpose**: Structured RCL progression with dynamic role minimums for efficient room bootstrapping.  
**Status**: Active (v0.44.0+)  
**Manager**: `BootstrapPhaseManager`  
**Last Updated**: 2025-11-18

## Table of Contents

1. [Overview](#overview)
2. [Phase Definitions](#phase-definitions)
3. [Operational Guide](#operational-guide)
4. [Integration with Systems](#integration-with-systems)
5. [Troubleshooting](#troubleshooting)
6. [Manual Intervention](#manual-intervention)
7. [Monitoring and Metrics](#monitoring-and-metrics)

## Overview

The bootstrap phase system orchestrates the critical early-game transition from an empty room (RCL 0) to a self-sustaining economy (RCL 2+). It dynamically adjusts creep spawning priorities to maximize energy gathering during resource-scarce initial ticks, then transitions to balanced role distribution once infrastructure is established.

### Why Bootstrap Phases Exist

Early-game resource scarcity requires different priorities than established economy:

- **Energy Bottleneck**: Limited energy capacity (300) requires harvester-focused spawning
- **Infrastructure Gap**: No extensions means small creeps and slow energy gathering
- **Controller Risk**: Must maintain minimal upgrader presence to prevent downgrade
- **Construction Backlog**: Extensions and containers must be built before transitioning to normal operations

Without bootstrap optimization, rooms experience:

- Slow RCL progression (30%+ longer to reach RCL 2)
- Energy starvation cycles (harvest → spawn → no energy → wait)
- Controller downgrade warnings
- Inefficient CPU usage spawning inappropriate roles

### High-Level Phase Progression

```
Phase 0 (Initial Spawn)
  ↓ (Spawn first harvester manually or via spawn queue)
Phase 1 (Foundation - RCL 1-3)
  ↓ (RCL 2 reached + energy stable)
Bootstrap Complete
  ↓ (RCL 4 reached + storage built)
Phase 2 (Core Framework - RCL 4+)
  ↓ (Continue to higher phases)
Phase 3+ (Advanced Economy)
```

## Phase Definitions

### Phase 0: Initial Spawn

**RCL**: 0 (controller exists but not yet claimed/reserved)  
**Duration**: 1-10 ticks  
**Objective**: Spawn the first harvester to begin energy collection

**Entry Conditions**:

- Room has a controller
- No bootstrap flag in Memory
- Controller level < 2

**Characteristics**:

- Bootstrap manager activates automatically
- Initial spawn queue prioritizes first harvester
- Room memory initialized

**Exit Conditions**:

- First harvester spawned
- Energy capacity available (extensions begin construction)

**Role Minimums** (during bootstrap):

- Harvesters: 6 (80%+ of spawning capacity)
- Upgraders: 1 (minimal controller maintenance)
- Builders: 0 (delayed until energy surplus)

### Phase 1: Foundation (RCL 1-3)

**RCL**: 1-3  
**Duration**: Varies (typically 500-1500 ticks depending on room layout)  
**Objective**: Establish basic economy, construct extensions, reach RCL 2

**Entry Conditions**:

- Bootstrap phase active
- Controller level 1-3
- Energy capacity < 300 OR extensions < 2

**Characteristics**:

- Harvester-focused spawning (6 harvesters, 1 upgrader, 0 builders)
- Extensions constructed as energy allows
- Container placement near sources begins at RCL 2
- Road planning triggered when containers + RCL 2 achieved

**Exit Conditions** (Bootstrap Completion):

1. **Energy Threshold**: `energyCapacityAvailable >= 300` (minimum 5 extensions at 50 each)
2. **Extension Count**: At least 2 extensions constructed
3. **Controller Level**: RCL 2 reached

**Role Minimums** (post-bootstrap):

- Harvesters: 4 (balanced energy gathering)
- Upgraders: 2 (consistent controller progress)
- Builders: 2 (construction site completion)

**Transition Tracking**:

```javascript
// Memory structure for Phase 1
Memory.bootstrap = {
  isActive: true,
  startedAt: 12345, // Game tick when bootstrap started
  completedAt: undefined // Set when bootstrap exits
};

Memory.rooms[roomName] = {
  phase: "phase1",
  rclLevelDetected: 2,
  phaseActivatedAt: 12345,
  roadsPlanned: false // Set to true when road planning completes
};
```

### Phase 2: Core Framework (RCL 4+)

**RCL**: 4+  
**Duration**: Indefinite (until RCL 6)  
**Objective**: Storage-based economy, link network, advanced infrastructure

**Entry Conditions**:

- RCL 4 reached
- Controller upgraded to level 4 (storage unlocked)

**Characteristics**:

- Storage construction becomes priority
- Container-based harvesting transitions to storage-based economy
- Link network begins placement
- Hauler roles become essential

**Storage Detection**:
The bootstrap manager checks storage status and updates Memory:

```javascript
// Storage operational when >10k energy stored
Memory.rooms[roomName].storageBuilt = true;
```

**Role Adjustments**:

- Stationary harvesters (1 per source with container)
- Haulers (2 per room minimum)
- Upgraders draw from storage
- Builders prioritize storage construction

### Advanced Economy Phases (Phases 4 & 5)

**Phase Structure (per BootstrapPhaseManager.ts):**
- **Phase 1**: RCL 1-3
- **Phase 2**: RCL 4-5
- **Phase 4**: RCL 6-7
- **Phase 5**: RCL 8

> **Note:** There is no Phase 3 in the current implementation. The code intentionally skips from Phase 2 to Phase 4. Phase 3 may be reserved for future use or for legacy compatibility.
**Duration**: Indefinite  
**Objective**: Multi-room expansion, empire coordination, global optimization

These phases are beyond bootstrap scope but tracked by the same `detectRCLPhaseTransitions()` method.

## Operational Guide

### Monitoring Bootstrap Status

**Check Current Bootstrap State** (via console):

```javascript
// Check if bootstrap is active
Memory.bootstrap.isActive; // true or false

// Check when bootstrap started
Memory.bootstrap.startedAt; // Game tick number

// Check when bootstrap completed (if applicable)
Memory.bootstrap.completedAt; // Game tick number or undefined

// Check current phase for a room
Memory.rooms["W1N1"].phase; // "phase1", "phase2", etc.

// Check RCL level detected
Memory.rooms["W1N1"].rclLevelDetected; // 1, 2, 3, etc.
```

**Monitor Bootstrap Progress** (calculated metrics):

```javascript
// Bootstrap duration (if active)
const duration = Game.time - Memory.bootstrap.startedAt;
console.log(`Bootstrap active for ${duration} ticks`);

// Energy progress toward completion threshold
const room = Game.rooms["W1N1"];
console.log(`Energy: ${room.energyCapacityAvailable}/300 (target)`);

// Extension construction progress
const extensions = room.find(FIND_MY_STRUCTURES, {
  filter: s => s.structureType === STRUCTURE_EXTENSION
});
console.log(`Extensions: ${extensions.length}/2 (minimum)`);
```

### Understanding Role Adjustments

The `getBootstrapRoleMinimums()` method overrides default role counts during bootstrap:

**Bootstrap Active** (Phase 0-1):

```javascript
{
  harvester: 6,  // 85% of early creeps
  upgrader: 1,   // Minimal controller maintenance
  builder: 0     // Delayed until energy surplus
}
```

**Bootstrap Complete** (Phase 2+):

```javascript
{
  harvester: 4,  // Balanced with other roles
  upgrader: 2,   // Consistent RCL progression
  builder: 2,    // Construction and repair
  hauler: 2,     // Energy transport (if containers present)
  repairer: 1    // Infrastructure maintenance
}
```

**Integration Point** (Kernel):

```typescript
// In kernel bootstrap check
const bootstrapMinimums = this.bootstrapManager.getBootstrapRoleMinimums(Memory.bootstrap?.isActive ?? false);
// These minimums are passed to BehaviorController for spawn priority
```

### Road Planning Timing

Road planning is triggered automatically when Phase 1 prerequisites are met:

**Trigger Conditions** (checked every tick in Kernel):

1. RCL 2+ (extensions available for road construction)
2. Containers exist near sources (infrastructure ready)
3. Roads not yet planned (`Memory.rooms[roomName].roadsPlanned === false`)

**Road Planning Process**:

1. `checkRoadPlanningNeeded()` detects prerequisites met
2. Kernel calls `RoadPlanner.autoPlaceRoadsPhase1(room, game)`
3. Roads planned between: source → spawn, source → controller
4. `markRoadsPlanned(memory, roomName)` prevents redundant planning
5. Memory flag set: `Memory.rooms[roomName].roadsPlanned = true`

**Monitoring Road Planning**:

```javascript
// Check if roads have been planned for a room
Memory.rooms["W1N1"].roadsPlanned; // true or false

// See road planning logs in console
// "[Kernel] Road planning triggered for W1N1: RCL 2 reached with container infrastructure"
// "[Kernel] Phase 1 road planning completed: 12 roads planned in W1N1"
```

## Integration with Systems

### Kernel Integration

The Kernel orchestrates bootstrap phase transitions in its main loop:

```typescript
// From kernel.ts:273-322
const bootstrapStatus = this.bootstrapManager.checkBootstrapStatus(game, memory);
if (bootstrapStatus.shouldTransition && bootstrapStatus.reason) {
  this.bootstrapManager.completeBootstrap(game, memory, bootstrapStatus.reason);
}

// Detect RCL phase transitions (including RCL4 for Phase 2)
const phaseTransitions = this.bootstrapManager.detectRCLPhaseTransitions(game, memory);
if (phaseTransitions.length > 0) {
  // Log transitions and check storage status for Phase 2 rooms
}

// Check if road planning is needed for Phase 1 completion
const roadPlanningStatus = this.bootstrapManager.checkRoadPlanningNeeded(game, memory);
if (roadPlanningStatus.shouldPlan && roadPlanningStatus.roomName) {
  // Trigger immediate road planning
}
```

### Spawn Manager Integration

The BehaviorController uses bootstrap minimums to prioritize spawning:

```typescript
// Spawn priority during bootstrap
if (Memory.bootstrap?.isActive) {
  const minimums = bootstrapManager.getBootstrapRoleMinimums(true);
  // Spawn 6 harvesters before other roles
  // Only spawn 1 upgrader (controller maintenance)
  // Skip builders entirely
}
```

### Monitoring Integration

Bootstrap phase detection integrates with the monitoring workflows:

**Related Workflows**:

- `screeps-monitoring.yml` - Comprehensive monitoring combining strategic analysis with PTR telemetry
- Phase-based health checks can adapt thresholds based on current phase
- Stuck phase detection can trigger autonomous investigation issues

**Monitoring Data Points**:

```javascript
// Available for monitoring scripts
Memory.bootstrap.isActive; // Bootstrap phase active flag
Memory.bootstrap.startedAt; // Tick when bootstrap started
Memory.bootstrap.completedAt; // Tick when bootstrap completed
Memory.rooms[roomName].phase; // Current phase ("phase1", "phase2", etc.)
Memory.rooms[roomName].rclLevelDetected; // RCL level for phase
Memory.rooms[roomName].phaseActivatedAt; // When phase started
Memory.rooms[roomName].roadsPlanned; // Road planning completion
Memory.rooms[roomName].storageBuilt; // Storage operational flag
```

## Troubleshooting

### Issue: Bootstrap Phase Not Advancing

**Symptoms**:

- Bootstrap active for >1500 ticks
- RCL stuck at 1
- Energy capacity not increasing

**Diagnosis**:

```javascript
// Check bootstrap status
console.log(JSON.stringify(Memory.bootstrap, null, 2));

// Check energy and extensions
const room = Game.rooms["W1N1"];
console.log(`Energy capacity: ${room.energyCapacityAvailable}/300`);
console.log(
  `Extensions: ${
    room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_EXTENSION
    }).length
  }`
);

// Check harvester count
console.log(`Harvesters: ${_.filter(Game.creeps, c => c.memory.role === "harvester").length}/6`);
```

**Common Causes**:

1. **Insufficient Energy**: Not enough harvesters or sources too distant
2. **No Extensions**: Builder creeps not spawning or construction sites not placed
3. **Controller Not Upgrading**: Upgrader died or no energy reaching controller
4. **Memory Corruption**: Bootstrap flag incorrectly set

**Solutions**:

1. **Boost Harvester Count**: Manually spawn additional harvesters if needed
2. **Check Construction Sites**: Use BasePlanner to place extension sites if missing
3. **Force Upgrader Spawn**: Temporarily adjust spawn priority
4. **Reset Bootstrap**: See [Manual Intervention](#manual-intervention) below

### Issue: Too Few Creeps During Bootstrap

**Symptoms**:

- Only 1-2 creeps spawned
- Energy gathering insufficient
- Spawn frequently idle despite bootstrap active

**Diagnosis**:

```javascript
// Check spawn queue
const spawn = Game.spawns["Spawn1"];
console.log(`Spawning: ${spawn.spawning ? spawn.spawning.name : "idle"}`);

// Check energy available
console.log(`Energy: ${spawn.room.energyAvailable}/${spawn.room.energyCapacityAvailable}`);

// Check role minimums being applied
console.log(`Bootstrap active: ${Memory.bootstrap?.isActive}`);
```

**Common Causes**:

1. **Bootstrap Minimums Not Applied**: Kernel not calling `getBootstrapRoleMinimums()`
2. **Spawn Queue Configuration**: Priority system not respecting bootstrap minimums
3. **Energy Starvation**: Harvesters dying before replacements spawn
4. **CPU Limit**: Operations throttled due to low CPU bucket

**Solutions**:

1. **Verify Kernel Integration**: Check that bootstrap minimums reach BehaviorController
2. **Emergency Spawn**: Manually spawn harvesters via console
3. **Increase Energy Priority**: Ensure harvesters deposit to spawn first
4. **CPU Optimization**: Reduce expensive operations during bootstrap

### Issue: Storage Not Detected at RCL 4

**Symptoms**:

- RCL 4 reached
- Storage constructed
- `Memory.rooms[roomName].storageBuilt` still false
- Economy not transitioning to storage-based

**Diagnosis**:

```javascript
// Check storage status
const room = Game.rooms["W1N1"];
const storage = room.storage;
console.log(`Storage exists: ${!!storage}`);
if (storage) {
  console.log(`Storage energy: ${storage.store.getUsedCapacity(RESOURCE_ENERGY)}`);
}

// Check memory flag
console.log(`Storage built flag: ${Memory.rooms["W1N1"].storageBuilt}`);
```

**Common Causes**:

1. **Storage Energy Threshold**: Storage must have >10k energy to be marked operational
2. **Phase Transition Timing**: Storage check only runs when Phase 2 transition detected
3. **Memory Not Updated**: Kernel not calling `checkStorageStatus()`

**Solutions**:

1. **Wait for Energy**: Allow haulers to fill storage above 10k energy threshold
2. **Force Storage Check**: Manually call storage check or set Memory flag
3. **Verify Phase 2 Active**: Confirm `Memory.rooms[roomName].phase === "phase2"`

### Issue: Roads Not Being Planned

**Symptoms**:

- RCL 2 reached
- Containers built near sources
- No road construction sites
- `Memory.rooms[roomName].roadsPlanned` still false

**Diagnosis**:

```javascript
// Check road planning prerequisites
const room = Game.rooms["W1N1"];
console.log(`RCL: ${room.controller.level}`);

// Check containers near sources
const sources = room.find(FIND_SOURCES);
sources.forEach(source => {
  const containers = source.pos.findInRange(FIND_STRUCTURES, 2, {
    filter: s => s.structureType === STRUCTURE_CONTAINER
  });
  console.log(`Source ${source.id}: ${containers.length} containers`);
});

// Check planning flag
console.log(`Roads planned: ${Memory.rooms["W1N1"].roadsPlanned}`);
```

**Common Causes**:

1. **Containers Missing**: No containers within range 2 of sources
2. **RCL Too Low**: Must be RCL 2+ for road planning trigger
3. **Planning Already Complete**: Flag already set to true
4. **Kernel Not Checking**: Road planning check not running in kernel loop

**Solutions**:

1. **Build Containers**: Ensure containers constructed near sources before RCL 2
2. **Wait for RCL 2**: Road planning automatically triggers at correct RCL
3. **Force Planning**: Reset flag and wait for next kernel cycle
4. **Manual Road Placement**: Use RoadPlanner directly if automation fails

## Manual Intervention

### Force Bootstrap Completion

If bootstrap is stuck and prerequisites are met:

```javascript
// Check current status first
console.log(JSON.stringify(Memory.bootstrap, null, 2));

// Force bootstrap to complete
Memory.bootstrap.isActive = false;
Memory.bootstrap.completedAt = Game.time;
console.log("Bootstrap manually completed");

// Verify room is at appropriate phase
console.log(`Room phase: ${Memory.rooms["W1N1"].phase}`);
```

### Reset Bootstrap Phase

If bootstrap entered incorrectly or needs restart:

```javascript
// WARNING: This restarts bootstrap from beginning
delete Memory.bootstrap;
console.log("Bootstrap reset - will reinitialize next tick");

// Bootstrap manager will detect no flag and evaluate if bootstrap should start
```

### Force Phase Transition

If room phase is not advancing correctly:

```javascript
// Manually set room phase (use cautiously)
const roomName = "W1N1";
Memory.rooms[roomName].phase = "phase2"; // or desired phase
Memory.rooms[roomName].rclLevelDetected = Game.rooms[roomName].controller.level;
Memory.rooms[roomName].phaseActivatedAt = Game.time;
console.log(`Room ${roomName} manually transitioned to phase2`);
```

### Trigger Road Planning Manually

If road planning conditions are met but not triggering:

```javascript
// Reset road planning flag
const roomName = "W1N1";
Memory.rooms[roomName].roadsPlanned = false;
console.log(`Road planning flag reset for ${roomName}`);

// Road planning will trigger on next kernel cycle if prerequisites met
// Alternatively, call RoadPlanner directly:
// (requires access to InfrastructureManager instance)
```

### Emergency Harvester Spawn

If energy collection has stopped during bootstrap:

```javascript
// Force spawn a basic harvester
const spawn = Game.spawns["Spawn1"];
const body = [WORK, CARRY, MOVE]; // Basic harvester (200 energy)
const name = `harvester_${Game.time}`;

if (spawn.spawnCreep(body, name, { memory: { role: "harvester" } }) === OK) {
  console.log(`Emergency harvester ${name} spawned`);
}
```

## Monitoring and Metrics

### Key Performance Indicators

**Bootstrap Phase Duration**:

- **Target**: <1000 ticks from Phase 0 to Bootstrap Complete
- **Measurement**: `Memory.bootstrap.completedAt - Memory.bootstrap.startedAt`
- **Baseline**: 500-800 ticks typical for standard room layouts

**Energy Accumulation Rate**:

- **Target**: +10 energy/tick average during bootstrap
- **Measurement**: Track `room.energyAvailable` delta per tick
- **Indicates**: Harvester efficiency and spawn utilization

**RCL Progression Speed**:

- **Target**: RCL 1→2 in <800 ticks
- **Measurement**: Controller progress tracking
- **Indicates**: Upgrader efficiency and energy surplus

**Creep Population During Bootstrap**:

- **Target**: 6 harvesters, 1 upgrader by tick 300
- **Measurement**: Role counts from `Memory.roles` or `Game.creeps`
- **Indicates**: Spawn queue effectiveness

### Monitoring Automation

The `screeps-monitoring.yml` workflow can leverage bootstrap phase data:

**Phase-Aware Alerts**:

```javascript
// Example monitoring logic
if (Memory.bootstrap?.isActive) {
  const duration = Game.time - Memory.bootstrap.startedAt;
  if (duration > 1500) {
    // Alert: Bootstrap phase taking too long
    // Check for stuck conditions: low harvester count, no extensions, etc.
  }
}

// Phase transition alerts
if (Memory.rooms[roomName].phase === "phase2" && !Memory.rooms[roomName].storageBuilt) {
  const ticksSincePhase2 = Game.time - Memory.rooms[roomName].phaseActivatedAt;
  if (ticksSincePhase2 > 500) {
    // Alert: Phase 2 active but storage not operational
  }
}
```

**Strategic Analysis Integration**:

- Bootstrap duration compared to historical averages
- Phase progression velocity (ticks per phase)
- Resource efficiency during bootstrap vs. normal operations
- Anomaly detection for stuck phases

## Related Documentation

**Implementation Details**:

- [Bootstrap Implementation](../strategy/learning/bootstrap-implementation.md) - Technical deep-dive
- [Phase 1: Foundation](../strategy/phases/phase-1-foundation.md) - Strategic context
- [Container-Based Harvesting](../strategy/learning/container-based-harvesting.md) - Related pattern

**Operational Guides**:

- [Operational Runbooks](../operations/runbooks.md) - Emergency procedures
- Memory Management (Coming soon) - Memory structure and cleanup
- Role Balancing (Coming soon) - Dynamic role adjustment

**System Architecture**:

- [Strategic Roadmap](../strategy/roadmap.md) - Phase progression overview
- [README.md](../../README.md) - System architecture and automation

**Code References**:

- `packages/bot/src/runtime/bootstrap/BootstrapPhaseManager.ts` - Core implementation
- `packages/bot/src/runtime/bootstrap/kernel.ts` - Kernel integration (lines 273-322)
- `packages/bot/src/runtime/behavior/BehaviorController.ts` - Spawn priority integration

## Changelog

- **2025-11-18**: Initial documentation created
- **2024-11-06**: Bootstrap phase system implemented (v0.44.0)
