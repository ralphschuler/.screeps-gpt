# CPU Timeout Diagnostic Runbook

## Overview

This runbook provides comprehensive guidance for diagnosing, resolving, and preventing CPU timeout incidents in the Screeps bot. CPU timeouts occur when script execution exceeds the CPU limit, causing the game engine to halt processing and potentially impact game progress.

**Purpose**: Enable autonomous Copilot workflows and developers to quickly diagnose CPU timeout root causes and implement effective solutions without manual intervention.

**Related Documentation**:

- [CPU Timeout Incident Tracking](./cpu-timeout-incidents.md) - Historical incident log
- [Performance Optimization Guide](./performance-optimization.md) - CPU optimization strategies
- [Performance Monitoring](../runtime/operations/performance-monitoring.md) - CPU tracking implementation

---

## Table of Contents

1. [Symptom Identification](#symptom-identification)
2. [Diagnostic Procedures](#diagnostic-procedures)
3. [Resolution Actions](#resolution-actions)
4. [Prevention Strategies](#prevention-strategies)
5. [Escalation Criteria](#escalation-criteria)

---

## Symptom Identification

### Primary Indicators

#### 1. Email Notifications

**Source**: `noreply@screeps.com` automated alerts

**Content Pattern**:

```
Script execution timed out: CPU time limit reached
    at get (<runtime>:XXXXX:XX)
    at loop (main:XXX:XX)
    at __mainLoop:1:XX
```

**Key Information**:

- Timestamp (UTC)
- Shard affected
- Stack trace with line numbers
- Execution context

#### 2. GitHub Monitoring Issues

**Created by**: `.github/workflows/screeps-monitoring.yml`

**Issue Labels**: `monitoring`, `performance`, `type/bug`, `priority/high` or `priority/critical`

**Issue Content**:

- CPU usage percentage at time of detection
- Bucket level
- Trend analysis (sustained high CPU)
- PTR telemetry data

#### 3. Console Errors

**In-game console output**:

```javascript
// Script execution halted mid-tick
// No further processing after timeout
// Creeps frozen in current state
```

**Memory indicators**:

```javascript
Memory.stats.cpu.used > Memory.stats.cpu.limit;
Memory.stats.cpu.bucket < 500; // Critical bucket depletion
```

### Secondary Indicators

#### 1. Performance Degradation

- **Gradual CPU increase**: 60% → 70% → 80% → 90%+
- **Bucket drain**: Steady decline below 5000
- **Reduced creep activity**: Fewer tasks completed per tick
- **Warning messages**: High CPU usage alerts in logs

#### 2. Pattern Recognition

**Systematic Timeouts** (architectural issue):

- Multiple timeouts at same code location
- Recurring timeouts across multiple ticks
- Same shard affected repeatedly
- Similar stack traces

**Isolated Timeouts** (transient issue):

- Single occurrence
- Different code locations
- Random timing
- No pattern across ticks

---

## Diagnostic Procedures

### Step 1: Gather Initial Information

#### A. Check Email Alert Details

Extract from notification:

```bash
# Key information to collect:
- Date/time (UTC)
- Shard name (e.g., shard3)
- Stack trace (main:XXX:XX line numbers)
- Execution context (__mainLoop, bootstrap, etc.)
```

#### B. Query PTR Telemetry

**Check recent stats**:

```bash
# View latest PTR monitoring report
cat reports/screeps-stats/latest.json

# Check for CPU trends
jq '.stats[] | select(.cpu.used > 80) | {time, cpu: .cpu.used, bucket: .cpu.bucket}' reports/screeps-stats/latest.json
```

**Analyze trends**:

- CPU usage over last 100 ticks
- Bucket level changes
- Energy availability
- Creep count and activity

#### C. Review Memory.stats

**Access in-game console**:

```javascript
// Check current CPU usage
console.log(
  `CPU: ${Memory.stats.cpu.used}/${Memory.stats.cpu.limit} (${((Memory.stats.cpu.used / Memory.stats.cpu.limit) * 100).toFixed(1)}%)`
);

// Check bucket level
console.log(`Bucket: ${Memory.stats.cpu.bucket}`);

// Review performance tracker warnings
console.log(JSON.stringify(Memory.systemReport?.performance, null, 2));
```

### Step 2: Identify Root Cause Category

#### A. Emergency Threshold Exceeded (90%+)

**Symptoms**:

- CPU usage consistently above 90%
- Kernel emergency abort triggered
- BehaviorController safety margin exceeded
- Multiple creeps skipped per tick

**Root Cause**: Insufficient CPU budget for current operations

**Next Steps**: Proceed to [Resolution Actions - Emergency Response](#emergency-response)

#### B. Pathfinding CPU Spike

**Symptoms**:

- Sudden CPU spike (normal → 90%+ in single tick)
- Multiple creeps executing pathfinding simultaneously
- Stack trace shows `moveTo()` or pathfinding operations
- Bucket drained quickly

**Root Cause**: Expensive pathfinding operations without caching

**Next Steps**: Proceed to [Resolution Actions - Pathfinding Optimization](#pathfinding-optimization)

#### C. Loop Logic CPU Accumulation

**Symptoms**:

- Gradual CPU increase throughout tick
- Stack trace in main loop (main:XXX:XX)
- Many creeps/rooms being processed
- No single expensive operation

**Root Cause**: Cumulative CPU cost exceeds limit

**Next Steps**: Proceed to [Resolution Actions - CPU Budget Management](#cpu-budget-management)

#### D. Inefficient Algorithm

**Symptoms**:

- Specific operation consistently expensive
- Same stack trace across timeouts
- CPU spike at predictable point in tick
- Profiler shows hot spot

**Root Cause**: O(n²) or worse algorithm complexity

**Next Steps**: Proceed to [Resolution Actions - Algorithm Optimization](#algorithm-optimization)

#### E. Memory Leak Impact

**Symptoms**:

- Increasing CPU over time
- Memory size growing
- Serialization/deserialization expensive
- `JSON.stringify()` in stack trace

**Root Cause**: Excessive memory data impacting CPU

**Next Steps**: Proceed to [Resolution Actions - Memory Optimization](#memory-optimization)

### Step 3: Determine Scope

#### Systematic Issue Detection

**Indicators**:

- ✅ 3+ timeouts in 24 hours
- ✅ Same code location (main:XXX:XX)
- ✅ Same shard repeatedly
- ✅ Pattern persists across ticks

**Action**: Document in [CPU Timeout Incident Tracking](./cpu-timeout-incidents.md) and coordinate with architectural solutions (Issue #364, #392, #299)

#### Isolated Issue Detection

**Indicators**:

- ✅ Single occurrence
- ✅ Different code locations
- ✅ No recurrence after 24 hours
- ✅ Transient conditions (e.g., large attack wave)

**Action**: Apply tactical fix and monitor for recurrence

---

## Resolution Actions

### Emergency Response

**Immediate Actions** (within 5 minutes):

#### 1. Verify Bot Status

```bash
# Check if bot is still running
curl -H "X-Token: $SCREEPS_TOKEN" https://screeps.com/api/user/console

# Check spawn status
curl -H "X-Token: $SCREEPS_TOKEN" https://screeps.com/api/game/structures | jq '.spawns'
```

#### 2. Emergency CPU Reduction

**Temporary measures** (in-game console):

```javascript
// Reduce CPU safety margin to 70%
Memory.config = Memory.config || {};
Memory.config.cpuSafetyMargin = 0.7;

// Disable non-critical features
Memory.experimentalFeatures = Memory.experimentalFeatures || {};
Memory.experimentalFeatures.roomVisuals = false;
Memory.experimentalFeatures.profiler = false;

// Reduce creep processing limit
Memory.config.maxCreepsPerTick = 20; // Default: unlimited
```

#### 3. Monitor Recovery

```javascript
// Check CPU usage after changes
console.log(
  `CPU: ${Game.cpu.getUsed()}/${Game.cpu.limit} (${((Game.cpu.getUsed() / Game.cpu.limit) * 100).toFixed(1)}%)`
);

// Verify bucket recovery
console.log(`Bucket: ${Game.cpu.bucket} (should increase if <10000)`);
```

### Pathfinding Optimization

**Diagnosis**:

```javascript
// Check pathfinding cache hit rate
console.log(JSON.stringify(Memory.stats?.pathfinding, null, 2));

// Review creep movement patterns
for (const name in Game.creeps) {
  const creep = Game.creeps[name];
  console.log(`${name}: reusePath=${creep.memory.reusePath || 5}`);
}
```

**Resolution**:

#### 1. Increase Path Reuse

```javascript
// Update reusePath for all creeps
for (const name in Game.creeps) {
  const creep = Game.creeps[name];
  if (!creep.memory.reusePath || creep.memory.reusePath < 30) {
    creep.memory.reusePath = 30; // Increased from default 5
  }
}
```

#### 2. Implement Path Caching

**Code change in behavior controllers**:

```typescript
// Before
creep.moveTo(target);

// After (with caching)
creep.moveTo(target, {
  reusePath: 50,
  maxRooms: 1,
  visualizePathStyle: Memory.experimentalFeatures?.roomVisuals ? {} : undefined
});
```

#### 3. Serialize Pathfinding Requests

**Prevent simultaneous expensive paths**:

```typescript
// Limit pathfinding operations per tick
const maxPathfindPerTick = 5;
let pathfindCount = Memory.stats?.pathfindingThisTick || 0;

if (pathfindCount < maxPathfindPerTick) {
  creep.moveTo(target, { reusePath: 50 });
  Memory.stats.pathfindingThisTick = pathfindCount + 1;
}
```

### CPU Budget Management

**Diagnosis**:

```javascript
// Review CPU distribution
console.log(JSON.stringify(Memory.stats?.performance, null, 2));

// Check creep processing limits
console.log(`Creeps: ${Object.keys(Game.creeps).length}, Safety margin: ${Memory.config?.cpuSafetyMargin || 0.8}`);
```

**Resolution**:

#### 1. Adjust Safety Margins

```javascript
// Increase safety margin (more conservative)
Memory.config = Memory.config || {};
Memory.config.cpuSafetyMargin = 0.75; // Stop at 75% instead of 80%
```

#### 2. Implement Incremental CPU Guards

**Reference**: Issue #364 - Incremental CPU guards implementation

**Per-operation checking**:

```typescript
// Check CPU before expensive operations
if (Game.cpu.getUsed() > Game.cpu.limit * 0.8) {
  console.log("⚠ CPU limit approaching, skipping remaining operations");
  return; // Exit early
}
```

#### 3. Prioritize Critical Operations

```typescript
// Process critical creeps first
const creeps = Object.values(Game.creeps);
const critical = creeps.filter(c => c.memory.role === "harvester");
const normal = creeps.filter(c => c.memory.role !== "harvester");

// Process critical creeps
for (const creep of critical) {
  if (Game.cpu.getUsed() > Game.cpu.limit * 0.8) break;
  runCreepLogic(creep);
}

// Process remaining creeps if CPU available
for (const creep of normal) {
  if (Game.cpu.getUsed() > Game.cpu.limit * 0.8) break;
  runCreepLogic(creep);
}
```

### Algorithm Optimization

**Diagnosis**:

```javascript
// Enable profiler if not running
Memory.experimentalFeatures = Memory.experimentalFeatures || {};
Memory.experimentalFeatures.profiler = true;

// After few ticks, check profiler data
console.log(JSON.stringify(Memory.profiler, null, 2));
```

**Resolution**:

#### 1. Identify Hot Spots

**Review profiler output for functions with**:

- High CPU usage (>5 CPU per call)
- High call count (>100 calls per tick)
- High total CPU (>20 CPU per tick)

#### 2. Optimize Algorithms

**Common optimizations**:

```typescript
// Before: O(n²) - iterate all creeps for each spawn
for (const spawnName in Game.spawns) {
  for (const creepName in Game.creeps) {
    // Check if creep needs spawn...
  }
}

// After: O(n) - cache results
const roleCount = {};
for (const name in Game.creeps) {
  const role = Game.creeps[name].memory.role;
  roleCount[role] = (roleCount[role] || 0) + 1;
}
for (const spawnName in Game.spawns) {
  // Use cached roleCount instead of iterating creeps
}
```

#### 3. Cache Expensive Lookups

```typescript
// Cache room structures per tick
if (!Memory.cache) Memory.cache = {};
if (Game.time !== Memory.cache.time) {
  Memory.cache.time = Game.time;
  Memory.cache.sources = {};

  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];
    Memory.cache.sources[roomName] = room.find(FIND_SOURCES).map(s => s.id);
  }
}

// Use cached data
const sourceIds = Memory.cache.sources[room.name];
```

### Memory Optimization

**Diagnosis**:

```javascript
// Check memory size
console.log(`Memory size: ${JSON.stringify(Memory).length} bytes`);

// Identify large objects
for (const key in Memory) {
  console.log(`${key}: ${JSON.stringify(Memory[key]).length} bytes`);
}
```

**Resolution**:

#### 1. Clean Up Stale Data

```javascript
// Remove dead creep memory
for (const name in Memory.creeps) {
  if (!Game.creeps[name]) {
    delete Memory.creeps[name];
  }
}

// Clean old cache entries
if (Memory.cache && Game.time > Memory.cache.time + 100) {
  delete Memory.cache;
}
```

#### 2. Reduce Data Redundancy

```typescript
// Before: Store full objects
Memory.creeps[name].target = { x: 25, y: 25, roomName: "W1N1" };

// After: Store IDs or compact format
Memory.creeps[name].targetId = targetStructure.id;
// or
Memory.creeps[name].targetPos = "25,25,W1N1";
```

#### 3. Implement Memory Self-Healing

**Reference**: Self-Healing Memory System (v0.24.0)

**Automatic cleanup**:

```typescript
// Kernel bootstrap includes MemorySelfHealer
// Runs automatically each tick
// Detects and repairs corrupted structures
// See src/runtime/memory/MemorySelfHealer.ts
```

---

## Prevention Strategies

### 1. Proactive Monitoring

#### PTR Telemetry Integration

**Workflow**: `.github/workflows/screeps-monitoring.yml`

**Configuration**:

```yaml
# Runs every 30 minutes
schedule:
  - cron: "*/30 * * * *"

# Detection thresholds
CPU_WARNING: 80%
CPU_CRITICAL: 95%
BUCKET_LOW: 1000
BUCKET_CRITICAL: 500
```

**Alerts Created**:

- High CPU usage (>80% sustained)
- CPU spike (sudden increase >20%)
- Low bucket (<1000)
- Critical bucket (<500)

#### Runtime Evaluation System

**SystemEvaluator Integration**:

```typescript
// Generates health reports from Memory.stats
// CPU warnings at 70% and 90% thresholds
// Bucket depletion alerts
// Stored in Memory.systemReport
```

**Access reports**:

```javascript
console.log(JSON.stringify(Memory.systemReport?.performance, null, 2));
```

### 2. Incremental CPU Protection

**Reference**: Issue #364 - Incremental CPU guards implementation

**Multi-layered protection**:

#### Layer 1: BehaviorController (80%)

```typescript
// Stop processing creeps at 80% CPU
if (Game.cpu.getUsed() > Game.cpu.limit * 0.8) {
  console.log("⚠ CPU safety margin reached");
  break;
}
```

#### Layer 2: PerformanceTracker (70%/90%)

```typescript
// Warning at 70%, Critical at 90%
if (cpuPercent > 0.9) {
  console.log("🔴 CRITICAL CPU usage!");
} else if (cpuPercent > 0.7) {
  console.log("⚠ High CPU usage");
}
```

#### Layer 3: Kernel (90%)

```typescript
// Emergency abort at 90%
if (Game.cpu.getUsed() > Game.cpu.limit * 0.9) {
  console.log("🚨 Emergency CPU abort!");
  return; // Abort tick processing
}
```

### 3. Pathfinding Optimization

**Default configurations**:

```typescript
// Increased reusePath values
const DEFAULT_REUSE_PATH = 30; // Up from 5
const REMOTE_ROOM_REUSE_PATH = 50; // For long-distance paths

// Movement options
const moveOptions = {
  reusePath: 30,
  maxRooms: 1,
  visualizePathStyle: undefined, // Disable by default
  ignoreCreeps: false,
  costCallback: roomCallback // Custom cost matrix
};
```

### 4. Performance Budget Allocation

**Per-subsystem budgets**:

| Subsystem        | CPU Budget | Priority |
| ---------------- | ---------- | -------- |
| Bootstrap/Kernel | 5 CPU      | CRITICAL |
| Spawning         | 3 CPU      | HIGH     |
| Harvesters       | 20 CPU     | HIGH     |
| Upgraders        | 15 CPU     | MEDIUM   |
| Builders         | 10 CPU     | MEDIUM   |
| Other roles      | 5 CPU      | LOW      |
| Evaluation/Stats | 2 CPU      | LOW      |

**Enforcement**:

```typescript
const subsystemBudgets = {
  spawning: 3,
  harvesters: 20,
  upgraders: 15,
  builders: 10,
  other: 5
};

let cpuStart = Game.cpu.getUsed();
runSubsystem("spawning");
let cpuUsed = Game.cpu.getUsed() - cpuStart;

if (cpuUsed > subsystemBudgets.spawning) {
  console.log(`⚠ Spawning exceeded budget: ${cpuUsed.toFixed(2)}/${subsystemBudgets.spawning}`);
}
```

### 5. Scaling Controls

**Dynamic creep limits**:

```typescript
// Adjust creep count based on CPU availability
const cpuAverage = _.mean(Memory.stats?.cpu?.history || [Game.cpu.getUsed()]);
const cpuPercent = cpuAverage / Game.cpu.limit;

let maxCreeps;
if (cpuPercent > 0.9) {
  maxCreeps = 20; // Emergency reduction
} else if (cpuPercent > 0.8) {
  maxCreeps = 30; // Conservative
} else if (cpuPercent > 0.7) {
  maxCreeps = 40; // Normal
} else {
  maxCreeps = 50; // Room to grow
}

Memory.config = Memory.config || {};
Memory.config.maxCreeps = maxCreeps;
```

---

## Escalation Criteria

### Level 1: Autonomous Resolution

**Criteria**:

- ✅ Single timeout incident
- ✅ CPU spike to 90-95%
- ✅ Bucket >1000
- ✅ Known resolution pattern

**Actions**:

- Apply tactical fixes (safety margin, path reuse)
- Monitor for 24 hours
- No manual intervention required

**Responsible**: Copilot CI Autofix Agent

### Level 2: Developer Review

**Criteria**:

- ✅ 2-3 timeouts in 24 hours
- ✅ CPU consistently >85%
- ✅ Bucket <1000
- ✅ No obvious quick fix

**Actions**:

- Create GitHub issue with diagnostic data
- Tag for developer review
- Continue monitoring and interim fixes

**Responsible**: PTR Monitor + Developer

### Level 3: Architectural Intervention

**Criteria**:

- ✅ 4+ timeouts in 24 hours (systematic pattern)
- ✅ Same code location repeatedly
- ✅ Tactical fixes insufficient
- ✅ Root cause requires code refactoring

**Actions**:

- Document in [CPU Timeout Incident Tracking](./cpu-timeout-incidents.md)
- Coordinate with architectural solutions (Issue #364, #392)
- Implement comprehensive prevention infrastructure
- No individual tactical fixes

**Responsible**: Development Team + Copilot Todo Agent

**Reference Issues**:

- #364 - Incremental CPU guards implementation
- #392 - Proactive CPU monitoring system
- #299 - Proactive CPU monitoring system
- #396 - Systematic CPU timeout pattern resolution

---

## Appendix

### A. Quick Reference Commands

#### Check CPU Status

```javascript
// In-game console
console.log(
  `CPU: ${Game.cpu.getUsed()}/${Game.cpu.limit} (${((Game.cpu.getUsed() / Game.cpu.limit) * 100).toFixed(1)}%)`
);
console.log(`Bucket: ${Game.cpu.bucket}`);
```

#### Emergency CPU Reduction

```javascript
Memory.config = Memory.config || {};
Memory.config.cpuSafetyMargin = 0.7;
Memory.experimentalFeatures = { roomVisuals: false, profiler: false };
```

#### View Performance Reports

```javascript
console.log(JSON.stringify(Memory.systemReport?.performance, null, 2));
console.log(JSON.stringify(Memory.stats?.cpu, null, 2));
```

#### Check PTR Telemetry

```bash
cat reports/screeps-stats/latest.json | jq '.stats[] | {cpu: .cpu.used, bucket: .cpu.bucket}'
```

### B. Related Issues

**Systematic Resolution**:

- #396 - Systematic CPU timeout pattern resolution
- #380 - Systematic CPU timeout pattern coordination
- #391 - CPU timeout at multiple locations
- #328 - Systematic CPU timeout analysis

**Architectural Solutions**:

- #364 - Incremental CPU guards implementation
- #392 - Proactive CPU monitoring system
- #299 - Proactive CPU monitoring system

**Performance Optimization**:

- #117 - CPU usage optimization below 90% threshold
- #304 - Performance optimization guide

**Recent Incidents**:

- See [CPU Timeout Incident Tracking](./cpu-timeout-incidents.md)

### C. Monitoring Integration Points

**Runtime Metrics**:

- `src/runtime/metrics/PerformanceTracker.ts` - CPU tracking
- `src/runtime/metrics/StatsCollector.ts` - Memory.stats collection
- `src/runtime/evaluation/SystemEvaluator.ts` - Health reports

**Workflows**:

- `.github/workflows/screeps-monitoring.yml` - PTR monitoring
- `.github/workflows/copilot-ci-autofix.yml` - Automated fixes

**Scripts**:

- `scripts/fetch-screeps-stats.ts` - PTR telemetry fetching
- `scripts/analyze-performance.ts` - Performance analysis

---

_Last updated: 2025-11-08_
_Maintainer: Autonomous Copilot Workflows_
