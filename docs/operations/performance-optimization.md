# Performance Optimization Guide

## Overview

This guide provides comprehensive strategies for optimizing CPU and memory usage in the Screeps bot. Performance optimization is critical for maintaining reliable bot operation, preventing script execution timeouts, and staying within resource limits.

**Target Goals:**

- Maintain CPU usage below 90% of limit to prevent timeout risk
- Keep CPU bucket healthy (>500) for burst capacity
- Minimize memory footprint and prevent memory leaks
- Optimize pathfinding and movement operations
- Implement efficient data structures and algorithms

## Table of Contents

1. [CPU Optimization](#cpu-optimization)
2. [Memory Management](#memory-management)
3. [Pathfinding Optimization](#pathfinding-optimization)
4. [Profiling and Monitoring](#profiling-and-monitoring)
5. [Performance Patterns](#performance-patterns)
6. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## CPU Optimization

### Understanding CPU Limits

The Screeps game engine enforces strict CPU limits per tick:

- **CPU Limit**: Maximum CPU per tick (varies by subscription level)
- **CPU Bucket**: Buffer for burst CPU usage (max 10,000)
- **Timeout Risk**: Script execution halts if CPU limit is exceeded

**Official Documentation**: [CPU Limit Guidelines](https://docs.screeps.com/cpu-limit.html)

### CPU Budget Management

Our bot implements multi-layered CPU protection:

#### 1. BehaviorController Safety Margin (80%)

The `BehaviorController` stops processing creeps when CPU usage reaches 80% of the limit:

```typescript
// Default configuration in BehaviorController
const cpuSafetyMargin = 0.8; // Stop at 80% CPU usage
const maxCpuPerCreep = 1.5; // Warn if single creep exceeds 1.5 CPU
```

**Implementation**: [`src/runtime/behavior/BehaviorController.ts`](../../src/runtime/behavior/BehaviorController.ts)

**Benefits**:

- Prevents timeout by leaving CPU headroom for system operations
- Allows bucket recovery during high-load ticks
- Provides early warning when creep behaviors become expensive

#### 2. PerformanceTracker Thresholds

The `PerformanceTracker` generates warnings at different CPU usage levels:

```typescript
// Default thresholds
const highCpuThreshold = 0.7; // Warning at 70% CPU
const criticalCpuThreshold = 0.9; // Critical at 90% CPU
const lowBucketThreshold = 500; // Bucket warning threshold
```

**Implementation**: [`src/runtime/metrics/PerformanceTracker.ts`](../../src/runtime/metrics/PerformanceTracker.ts)

**Warning Levels**:

- **70% CPU**: "High CPU usage" warning - review behaviors and consider optimization
- **90% CPU**: "CRITICAL" warning - immediate timeout risk, urgent optimization needed
- **Bucket < 500**: "CPU bucket critically low" - cannot sustain burst usage

#### 3. Kernel Emergency Threshold (90%)

The `Kernel` aborts tick processing if CPU reaches 90% to prevent timeout:

```typescript
// Emergency CPU protection in Kernel
const cpuEmergencyThreshold = 0.9; // Abort at 90% CPU
```

**Implementation**: [`src/runtime/bootstrap/kernel.ts`](../../src/runtime/bootstrap/kernel.ts)

**Behavior**:

- Monitors CPU usage throughout the tick
- Aborts remaining operations if threshold exceeded
- Still completes critical operations (performance tracking, evaluation)
- Logs emergency warning for monitoring systems

### CPU Optimization Strategies

#### Strategy 1: Minimize Expensive Operations

**Most Expensive Operations** (in descending order):

1. **PathFinder.search()** - Complex pathfinding across rooms (5-20 CPU)
2. **Room.find()** - Scanning entire room for objects (0.5-5 CPU)
3. **creep.moveTo()** without path caching - Pathfinding each tick (1-10 CPU)
4. **Array operations on large datasets** - Filter, map, reduce (0.1-1 CPU)

**Optimization Techniques**:

```typescript
// ✅ GOOD: Cache room scans
const sources = room.memory.sources || (room.memory.sources = room.find(FIND_SOURCES).map(s => s.id));

// ❌ BAD: Scan room every tick
const sources = room.find(FIND_SOURCES);
```

```typescript
// ✅ GOOD: Use high reusePath for stable targets
creep.moveTo(controller, { reusePath: 30 }); // Reuse path for 30 ticks

// ❌ BAD: Pathfind every tick
creep.moveTo(controller); // Default reusePath: 5
```

#### Strategy 2: Early Termination

Implement CPU checks in expensive loops:

```typescript
// Process creeps with CPU budget checks
for (const creep of creeps) {
  if (Game.cpu.getUsed() > cpuBudget) {
    console.log(`CPU budget exceeded, skipping ${remainingCreeps} creeps`);
    break;
  }

  // Process creep behavior...
}
```

**Current Implementation**: The `BehaviorController` implements this pattern to prevent timeout.

#### Strategy 3: Defer Non-Critical Work

Use tick-based scheduling for non-essential operations:

```typescript
// Run expensive operations only every N ticks
if (Game.time % 10 === 0) {
  // Run room planning, threat assessment, etc.
}

// Rotate expensive operations across ticks
const tickMod = Game.time % 5;
if (tickMod === 0) {
  // Update energy network
} else if (tickMod === 1) {
  // Update construction priorities
} // etc.
```

#### Strategy 4: Use Caching and Memoization

Cache expensive calculations in Memory or global objects:

```typescript
// Global cache (reset each tick)
global.roomCache = global.roomCache || {};

function getEnergyStructures(room: Room) {
  if (!global.roomCache[room.name]) {
    global.roomCache[room.name] = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION
    });
  }
  return global.roomCache[room.name];
}
```

**Important**: Use `global` for per-tick caching, `Memory` for persistent data.

---

## Memory Management

### Memory Best Practices

Memory in Screeps persists between ticks and has a size limit. Efficient memory usage prevents performance degradation and parsing overhead.

#### 1. Clean Up Dead Creep Memory

**Implementation**: [`src/runtime/memory/MemoryManager.ts`](../../src/runtime/memory/MemoryManager.ts)

```typescript
// Automatically prune dead creep memories
const memoryManager = new MemoryManager();
memoryManager.pruneMissingCreeps(Memory, Game.creeps);
```

**Why This Matters**:

- Dead creep memories accumulate over time
- Large Memory object increases JSON parsing CPU cost
- Each tick, Memory is deserialized from JSON (CPU cost ~0.5-2.0 per 100KB)

#### 2. Store References, Not Objects

```typescript
// ✅ GOOD: Store object ID
creep.memory.targetSourceId = source.id;

// Later: Retrieve object
const source = Game.getObjectById(creep.memory.targetSourceId);

// ❌ BAD: Cannot store game objects
creep.memory.targetSource = source; // This won't work!
```

**Memory Storage Rules**:

- Store IDs, names, coordinates, primitive values
- Do NOT store game objects (Creep, Structure, etc.)
- Game objects are reconstructed each tick from the game state

#### 3. Use Efficient Data Structures

```typescript
// ✅ GOOD: Use objects for lookup tables
const roleIndex = {
  harvester: true,
  upgrader: true,
  builder: true
};
if (roleIndex[role]) {
  /* ... */
}

// ❌ BAD: Use arrays for frequent lookups
const roles = ["harvester", "upgrader", "builder"];
if (roles.includes(role)) {
  /* O(n) lookup */
}
```

#### 4. Limit Memory Depth

Deep object nesting increases serialization cost:

```typescript
// ✅ GOOD: Flat structure
Memory.rooms.W0N0 = {
  sources: ["id1", "id2"],
  controller: "ctrl-id",
  lastScan: 12345
};

// ❌ BAD: Deep nesting
Memory.rooms.W0N0.data.resources.sources.active[0].metadata.lastUpdate = 12345;
```

#### 5. Periodic Memory Cleanup

Implement scheduled cleanup for stale data:

```typescript
// Clean up old data every 1000 ticks
if (Game.time % 1000 === 0) {
  for (const roomName in Memory.rooms) {
    if (!Game.rooms[roomName]) {
      delete Memory.rooms[roomName];
    }
  }
}
```

### Memory Optimization Patterns

#### Pattern 1: Lazy Initialization

Only allocate memory when needed:

```typescript
function getRoomMemory(roomName: string) {
  Memory.rooms = Memory.rooms || {};
  Memory.rooms[roomName] = Memory.rooms[roomName] || {};
  return Memory.rooms[roomName];
}
```

#### Pattern 2: Memory Compression

For large datasets, consider storing compressed representations:

```typescript
// Instead of storing full path array
creep.memory.path = [
  { x: 10, y: 20 },
  { x: 11, y: 20 } /* ... */
];

// Store serialized path (built-in Screeps feature)
const path = room.findPath(start, end);
creep.memory.pathSerialized = Room.serializePath(path);

// Later: deserialize
const path = Room.deserializePath(creep.memory.pathSerialized);
```

---

## Pathfinding Optimization

Pathfinding is one of the most CPU-intensive operations in Screeps. Optimizing movement can yield significant CPU savings.

### Movement Optimization Strategies

#### Strategy 1: Increase reusePath Values

Our bot uses optimized `reusePath` values to minimize pathfinding overhead:

```typescript
// Standard movement: reusePath = 30 (local targets)
creep.moveTo(source, { reusePath: 30 });

// Remote mining movement: reusePath = 40 (distant sources)
creep.moveTo(source, { range: 1, reusePath: 40 });

// Long-distance movement: reusePath = 50 (cross-room travel)
creep.moveTo(targetRoom, { reusePath: 50 });
```

**Implementation**: See `BehaviorController.ts` role behaviors

**Trade-offs**:

- Higher reusePath = less frequent pathfinding = lower CPU
- Risk: Creeps may follow stale paths if environment changes
- Optimal for stable environments (your own rooms)
- Use lower values in hostile/dynamic areas

#### Strategy 2: Cached Pathfinding

Store paths in Memory for repeated use:

```typescript
interface CreepMemory {
  cachedPath?: string;
  pathAge?: number;
}

function moveWithCachedPath(creep: Creep, target: RoomPosition) {
  const memory = creep.memory;

  // Invalidate old paths
  if (memory.pathAge && memory.pathAge > 50) {
    delete memory.cachedPath;
    delete memory.pathAge;
  }

  // Use cached path
  if (memory.cachedPath) {
    const path = Room.deserializePath(memory.cachedPath);
    creep.moveByPath(path);
    memory.pathAge = (memory.pathAge || 0) + 1;
  } else {
    // Generate new path
    const path = creep.pos.findPathTo(target);
    memory.cachedPath = Room.serializePath(path);
    memory.pathAge = 0;
    creep.moveByPath(path);
  }
}
```

#### Strategy 3: Avoid Redundant Pathfinding

Check if creep is already on the path:

```typescript
// Check if already moving toward target
if (creep.fatigue === 0 && creep.memory.isMoving) {
  // Already on path, skip pathfinding
  return;
}

// Only pathfind when needed
if (creep.pos.getRangeTo(target) > 1) {
  creep.moveTo(target, { reusePath: 30 });
  creep.memory.isMoving = true;
}
```

#### Strategy 4: Use Appropriate Range Values

Specify target range to reduce pathfinding complexity:

```typescript
// Energy pickup: range 1 required
creep.moveTo(droppedEnergy, { range: 1 });

// Controller upgrade: range 3 sufficient
creep.moveTo(controller, { range: 3 });

// Repair structure: range 3 sufficient
creep.moveTo(structure, { range: 3 });
```

**Benefits**: Larger range values may find shorter paths in complex terrain.

#### Strategy 5: Room Visibility Optimization

PathFinder requires room visibility. Minimize cross-room pathfinding:

```typescript
// ❌ Expensive: Pathfinding across 5 invisible rooms
creep.moveTo(new RoomPosition(25, 25, "W10N10"));

// ✅ Better: Cache route, move room-by-room
const route = Game.map.findRoute(creep.room, "W10N10");
const nextRoom = route[0].room;
creep.moveTo(new RoomPosition(25, 25, nextRoom));
```

### Visual Pathfinding Debugging

Enable visual debugging to identify pathfinding issues:

```typescript
creep.moveTo(target, {
  visualizePathStyle: { stroke: "#ffffff" },
  reusePath: 30
});
```

---

## Profiling and Monitoring

### Built-in Performance Tracking

Our bot includes comprehensive performance monitoring:

#### PerformanceTracker

**Purpose**: Track CPU usage and generate warnings

```typescript
import { PerformanceTracker } from "@runtime/metrics";

const tracker = new PerformanceTracker();

// At tick start
tracker.begin(Game);

// Execute game logic...

// At tick end
const snapshot = tracker.end(Game, behaviorSummary);
```

**Metrics Captured**:

- CPU used per tick
- CPU limit and bucket levels
- Creep and room counts
- Spawn orders
- Warning messages for high CPU usage

**Output**: `PerformanceSnapshot` object with all metrics

#### StatsCollector

**Purpose**: Persist performance data for external monitoring

```typescript
import { StatsCollector } from "@runtime/metrics";

const collector = new StatsCollector();
collector.collect(Game, Memory, snapshot);
```

**Data Storage**: Writes to `Memory.stats` for retrieval via Screeps API

**External Integration**:

- PTR monitoring workflow fetches stats via `/api/user/stats`
- GitHub Actions monitor for CPU anomalies
- Push notifications for critical alerts

**Documentation**: See [Stats Monitoring](./stats-monitoring.md)

#### SystemEvaluator

**Purpose**: Generate actionable health reports from performance data

```typescript
import { SystemEvaluator } from "@runtime/evaluation";

const evaluator = new SystemEvaluator();
const report = evaluator.evaluate(snapshot, repositorySignal, Memory);
```

**Report Findings**:

- CPU usage warnings (70%, 90% thresholds)
- Bucket depletion alerts
- Creep population issues
- Spawn throughput problems

**Integration**: Reports stored in `Memory.systemReport` for monitoring workflows

### External Performance Tools

#### Screeps Profiler Integration

For detailed CPU profiling, integrate screeps-profiler:

**Related Issue**: [#137 - Screeps-profiler integration](https://github.com/ralphschuler/.screeps-gpt/issues/137)

```typescript
// Example usage (when integrated)
const profiler = require("screeps-profiler");

profiler.enable();
profiler.wrap(() => {
  // Your main loop
});

// Profile specific functions
profiler.registerObject(MyClass, "MyClass");
profiler.registerFN(myFunction, "myFunction");
```

**Benefits**:

- Identify CPU-intensive functions
- Measure per-function CPU cost
- Generate detailed profiling reports

#### Browser Console Tools

Use in-game console for quick profiling:

```javascript
// Measure CPU for a specific operation
const startCPU = Game.cpu.getUsed();
// ... your code ...
console.log(`Operation used ${Game.cpu.getUsed() - startCPU} CPU`);

// Check current tick stats
console.log(JSON.stringify(Memory.stats, null, 2));

// Review system evaluation
console.log(Memory.systemReport?.report.summary);
```

### Automated Monitoring

Our repository includes automated performance monitoring:

#### PTR Monitoring Workflow

**Workflow**: `.github/workflows/screeps-monitoring.yml`

**Capabilities**:

- Fetches PTR telemetry every 30 minutes
- Analyzes CPU usage patterns
- Detects anomalies (>95% CPU, >80% sustained, low energy)
- Creates GitHub issues for performance regressions
- Sends push notifications for critical alerts

**Documentation**: See [Stats Monitoring](./stats-monitoring.md)

#### Related Issues

- [#117 - PTR CPU monitoring alerts](https://github.com/ralphschuler/.screeps-gpt/issues/117)
- [#299 - Proactive CPU monitoring system](https://github.com/ralphschuler/.screeps-gpt/issues/299)
- [#287 - Recurring CPU timeout regression](https://github.com/ralphschuler/.screeps-gpt/issues/287)

---

## Performance Patterns

### Pattern 1: Early Exit Pattern

Exit functions early when conditions are met:

```typescript
function processCreep(creep: Creep) {
  // Early exits for invalid states
  if (!creep.memory.role) return;
  if (creep.spawning) return;
  if (creep.fatigue > 0) return;

  // Expensive processing only if needed
  runCreepBehavior(creep);
}
```

### Pattern 2: Batching Pattern

Group operations to reduce overhead:

```typescript
// ❌ BAD: Multiple find operations
const containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
const extensions = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION });
const spawns = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_SPAWN });

// ✅ GOOD: Single find, then filter
const structures = room.find(FIND_STRUCTURES);
const containers = structures.filter(s => s.structureType === STRUCTURE_CONTAINER);
const extensions = structures.filter(s => s.structureType === STRUCTURE_EXTENSION);
const spawns = structures.filter(s => s.structureType === STRUCTURE_SPAWN);
```

### Pattern 3: Incremental Processing Pattern

Spread expensive work across multiple ticks:

```typescript
// Process one room per tick instead of all at once
const rooms = Object.values(Game.rooms);
const currentIndex = Game.time % rooms.length;
const roomToProcess = rooms[currentIndex];

analyzeRoomThreats(roomToProcess);
```

### Pattern 4: Priority Queue Pattern

Process high-priority creeps first when CPU is limited:

```typescript
const creeps = Object.values(Game.creeps);

// Sort by priority (harvesters first, then builders, etc.)
creeps.sort((a, b) => {
  const priorities = { harvester: 3, upgrader: 2, builder: 1 };
  return (priorities[b.memory.role] || 0) - (priorities[a.memory.role] || 0);
});

// Process in priority order
for (const creep of creeps) {
  if (Game.cpu.getUsed() > cpuBudget) break;
  processCreep(creep);
}
```

### Pattern 5: Tick-Based State Machines

Use tick offsets to distribute load:

```typescript
// Each creep operates on a different tick offset
const tickOffset = creep.name.charCodeAt(0) % 5;
const shouldAct = (Game.time + tickOffset) % 5 === 0;

if (shouldAct) {
  // Expensive pathfinding or planning
  creep.memory.plan = calculateBestAction(creep);
}

// Execute cached plan
executePlan(creep, creep.memory.plan);
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Per-Tick Room Scans

```typescript
// ❌ VERY BAD: Scanning every tick
for (const creep of Object.values(Game.creeps)) {
  const sources = creep.room.find(FIND_SOURCES);
  // ... use sources
}

// ✅ GOOD: Cache in room memory
if (!room.memory.sources) {
  room.memory.sources = room.find(FIND_SOURCES).map(s => s.id);
}
const sources = room.memory.sources.map(id => Game.getObjectById(id));
```

### Anti-Pattern 2: Unnecessary Object Creation

```typescript
// ❌ BAD: Creating new objects in loops
for (const creep of creeps) {
  const result = { name: creep.name, role: creep.memory.role };
  processResult(result);
}

// ✅ GOOD: Reuse references
for (const creep of creeps) {
  processCreep(creep.name, creep.memory.role);
}
```

### Anti-Pattern 3: Duplicate Lookups

```typescript
// ❌ BAD: Multiple lookups for same object
Game.getObjectById(creep.memory.targetId).energy;
Game.getObjectById(creep.memory.targetId).energyCapacity;
Game.getObjectById(creep.memory.targetId).pos;

// ✅ GOOD: Lookup once
const target = Game.getObjectById(creep.memory.targetId);
if (target) {
  console.log(target.energy, target.energyCapacity, target.pos);
}
```

### Anti-Pattern 4: Deep Memory Nesting

```typescript
// ❌ BAD: Deeply nested memory structure
Memory.empire.colonies.W0N0.departments.logistics.deliveries.pending[0].creep.target.type = "spawn";

// ✅ GOOD: Flat structure with clear keys
Memory.rooms.W0N0.pendingDeliveries = [{ creepName: "hauler1", targetType: "spawn" }];
```

### Anti-Pattern 5: Synchronous Pathfinding

```typescript
// ❌ BAD: Pathfinding to distant rooms every tick
for (const remoteCreep of remoteCreeps) {
  remoteCreep.moveTo(new RoomPosition(25, 25, "W10N10"));
}

// ✅ GOOD: Use room-to-room routing with caching
if (!creep.memory.route) {
  creep.memory.route = Game.map.findRoute(creep.room, targetRoom);
}
const route = creep.memory.route;
// Move to next room in route...
```

### Anti-Pattern 6: Ignoring CPU Budget

```typescript
// ❌ BAD: Processing all creeps regardless of CPU
for (const creep of Object.values(Game.creeps)) {
  runExpensiveBehavior(creep);
}

// ✅ GOOD: Respect CPU budget
for (const creep of Object.values(Game.creeps)) {
  if (Game.cpu.getUsed() > Game.cpu.limit * 0.8) {
    console.log("CPU budget exceeded, deferring remaining creeps");
    break;
  }
  runExpensiveBehavior(creep);
}
```

---

## Performance Testing

### Regression Tests

Our repository includes comprehensive performance regression tests to prevent degradation:

**Test Files**:

- `tests/regression/cpu-timeout-prevention.test.ts` - Validates CPU budget management
- `tests/regression/cpu-optimization-90-percent.test.ts` - Ensures 90% threshold compliance

**What They Test**:

- BehaviorController stops at 80% CPU by default
- PerformanceTracker warns at 70%, critical at 90%
- Kernel aborts at 90% emergency threshold
- Per-creep CPU tracking detects expensive behaviors
- Movement operations use optimal reusePath values

**Running Tests**:

```bash
bun run test:regression
```

### Performance Benchmarking

When optimizing, always benchmark before and after:

```typescript
// Baseline measurement
const startCPU = Game.cpu.getUsed();
const startTime = Game.time;

// Run for 100 ticks, record average CPU
// Then apply optimization and compare

const endCPU = Game.cpu.getUsed();
console.log(`Average CPU: ${(endCPU - startCPU) / 100}`);
```

---

## Resources

### Official Screeps Documentation

- [Game Loop Documentation](https://docs.screeps.com/game-loop.html)
- [CPU Limit Guidelines](https://docs.screeps.com/cpu-limit.html)
- [Memory Documentation](https://docs.screeps.com/global-objects.html#Memory-object)
- [PathFinder API](https://docs.screeps.com/api/#PathFinder)

### Internal Documentation

- [Stats Collection Implementation](./stats-collection.md)
- [PTR Monitoring Pipeline](./stats-monitoring.md)
- [Respawn Handling](./respawn-handling.md)

### Related Code

- **CPU Tracking**: [`src/runtime/metrics/PerformanceTracker.ts`](../../src/runtime/metrics/PerformanceTracker.ts)
- **Stats Collection**: [`src/runtime/metrics/StatsCollector.ts`](../../src/runtime/metrics/StatsCollector.ts)
- **Behavior Control**: [`src/runtime/behavior/BehaviorController.ts`](../../src/runtime/behavior/BehaviorController.ts)
- **System Evaluation**: [`src/runtime/evaluation/SystemEvaluator.ts`](../../src/runtime/evaluation/SystemEvaluator.ts)
- **Memory Management**: [`src/runtime/memory/MemoryManager.ts`](../../src/runtime/memory/MemoryManager.ts)

### Related Issues

- [#117 - PTR CPU monitoring alerts](https://github.com/ralphschuler/.screeps-gpt/issues/117)
- [#299 - Proactive CPU monitoring system](https://github.com/ralphschuler/.screeps-gpt/issues/299)
- [#287 - Recurring CPU timeout regression](https://github.com/ralphschuler/.screeps-gpt/issues/287)
- [#137 - Screeps-profiler integration](https://github.com/ralphschuler/.screeps-gpt/issues/137)

---

## Summary

Effective performance optimization in Screeps requires:

1. **CPU Budget Discipline**: Respect 80% safety margin, implement early termination
2. **Memory Hygiene**: Clean up dead objects, use efficient structures, limit depth
3. **Pathfinding Optimization**: Use high reusePath values, cache paths, minimize cross-room pathfinding
4. **Continuous Monitoring**: Leverage built-in metrics, automated alerts, regression tests
5. **Performance Patterns**: Apply batching, caching, incremental processing, early exits

By following these guidelines and leveraging our existing performance infrastructure, you can maintain efficient bot operation and prevent performance regressions.

**Remember**: Performance optimization is an ongoing process. Profile regularly, test changes, and monitor production metrics to ensure sustained efficiency.
