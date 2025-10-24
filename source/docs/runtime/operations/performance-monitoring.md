# Performance Monitoring

This document describes CPU tracking, performance metrics, and optimization techniques implemented in `src/runtime/metrics/PerformanceTracker.ts` and `src/runtime/evaluation/SystemEvaluator.ts`.

## Overview

Screeps enforces strict CPU limits that throttle execution when exceeded. The performance monitoring system tracks CPU usage, identifies bottlenecks, and provides actionable alerts before problems occur.

## CPU Architecture

### CPU Allocation Model

**Free Tier**:

- Limit: 10 CPU per tick
- Bucket: 0-10,000 capacity
- Regeneration: +10 CPU per tick (up to limit)

**Subscription Tier**:

- Limit: 30+ CPU per tick (varies by account age)
- Bucket: 0-10,000 capacity
- Regeneration: +30+ CPU per tick
- Burst capacity: Can use more than limit if bucket available

### CPU Bucket Mechanics

**Bucket Behavior**:

- Accumulates unused CPU each tick
- Max capacity: 10,000 CPU
- Can borrow from bucket to exceed limit
- Depletion triggers throttling warnings

**Example Flow**:

```
Tick 1: Used 8 CPU, Limit 10 → +2 to bucket (bucket: 2)
Tick 2: Used 12 CPU, Limit 10 → -2 from bucket (bucket: 0)
Tick 3: Used 15 CPU, Limit 10 → -5 from bucket (bucket: -5) ⚠ WARNING
```

## Performance Tracking Implementation

### Per-Tick Measurement

**Tracking Flow** (executed every tick):

1. **Begin Phase** (`PerformanceTracker.begin()`):

   ```typescript
   startCpu = Game.cpu.getUsed();
   startTick = Game.time;
   ```

2. **Execute Phase** (Kernel orchestration):
   - Memory management
   - Behavior execution
   - System evaluation

3. **End Phase** (`PerformanceTracker.end()`):
   ```typescript
   cpuUsed = Game.cpu.getUsed() - startCpu;
   warnings = analyzeThresholds(cpuUsed);
   snapshot = buildSnapshot(cpuUsed, warnings);
   ```

### Performance Snapshot Schema

```typescript
interface PerformanceSnapshot {
  tick: number; // Game tick number
  cpuUsed: number; // CPU consumed this tick
  cpuLimit: number; // Account CPU limit
  cpuBucket: number; // Current bucket level
  creepCount: number; // Living creeps
  roomCount: number; // Claimed rooms
  spawnOrders: number; // Creeps spawned this tick
  warnings: string[]; // Performance alerts
  execution: BehaviorSummary; // Detailed execution stats
}
```

## Performance Thresholds

### Warning Thresholds (Configurable)

**High CPU Usage** (default: 80% of limit):

```typescript
if (cpuUsed > cpuLimit * 0.8) {
  warnings.push(`High CPU usage ${cpuUsed.toFixed(2)} / ${cpuLimit}`);
}
```

**Trigger Example**:

- Limit: 10 CPU
- Threshold: 8 CPU
- Usage: 8.5 CPU → **WARNING**

**Low Bucket** (default: 500):

```typescript
if (cpuBucket < 500) {
  warnings.push(`CPU bucket critically low (${cpuBucket})`);
}
```

**Trigger Example**:

- Bucket: 450 CPU
- Threshold: 500 CPU → **WARNING**

### Critical Thresholds (SystemEvaluator)

**CPU Bucket Depletion** (critical severity):

- Threshold: <500 bucket
- Impact: Emergency CPU bursts unavailable
- Recommendation: "Pause non-essential tasks to allow the bucket to recover."

**CPU Over-Limit** (warning severity):

- Threshold: >80% of limit
- Impact: Bucket draining over time
- Recommendation: "Profile hot paths or reduce creep behaviors to stay within CPU limits."

## CPU Cost Breakdown

### Per-Component Costs (Typical)

**Kernel Operations**:

```
Memory Manager:       ~0.1 CPU/tick
Performance Tracker:  ~0.05 CPU/tick
System Evaluator:     ~0.1 CPU/tick
Respawn Manager:      ~0.05 CPU/tick
────────────────────────────────────
Kernel Overhead:      ~0.3 CPU/tick
```

**Per-Creep Operations**:

```
Role validation:      ~0.02 CPU/creep
Task execution:       ~0.3-0.5 CPU/creep
  - Pathfinding:      ~0.1-0.3 CPU (cached)
  - Action execution: ~0.05 CPU
  - State update:     ~0.05 CPU
────────────────────────────────────
Total per Creep:      ~0.35-0.55 CPU
```

**Spawn Operations**:

```
Population check:     ~0.05 CPU/role
Creep creation:       ~0.1 CPU/spawn attempt
────────────────────────────────────
Spawn Logic:          ~0.15-0.2 CPU/tick
```

### Typical CPU Budgets

**RCL 1 (3 creeps)**:

```
Kernel:      0.3 CPU
3 Creeps:    1.2 CPU  (3 × 0.4)
Spawning:    0.2 CPU
──────────────────────
Total:       1.7 CPU  (17% of 10 CPU limit)
```

**RCL 3 (8 creeps)**:

```
Kernel:      0.3 CPU
8 Creeps:    3.2 CPU  (8 × 0.4)
Spawning:    0.2 CPU
──────────────────────
Total:       3.7 CPU  (37% of 10 CPU limit)
```

**RCL 5 (15 creeps)**:

```
Kernel:      0.3 CPU
15 Creeps:   6.0 CPU  (15 × 0.4)
Spawning:    0.3 CPU
──────────────────────
Total:       6.6 CPU  (66% of 10 CPU limit)
```

## Performance Optimization Techniques

### 1. Pathfinding Optimization

**Current Implementation**: `reusePath: 5`

**Cost Analysis**:

- Fresh pathfinding: 0.5-2.0 CPU
- Cached path: 0.05-0.1 CPU
- **Savings: 90-95%**

**Tuning Options**:

```typescript
// Conservative (stable rooms)
moveTo(target, { reusePath: 10 }); // Recalc every 10 ticks
// Savings: +50% CPU reduction

// Aggressive (dynamic rooms)
moveTo(target, { reusePath: 3 }); // Recalc every 3 ticks
// Cost: +30% CPU increase

// Balanced (default)
moveTo(target, { reusePath: 5 }); // Current setting
```

### 2. Task Execution Optimization

**Batch Operations**:

```typescript
// Bad: Individual finds per creep
creeps.forEach(c => {
  const sources = c.room.find(FIND_SOURCES); // Repeated work!
});

// Good: Find once, share results
const sources = room.find(FIND_SOURCES);
creeps.forEach(c => {
  const closestSource = c.pos.findClosestByPath(sources);
});
```

**Savings**: ~0.2 CPU per creep (for 5+ creeps in same room)

### 3. Memory Access Optimization

**Cache Frequently Accessed Data**:

```typescript
// Bad: Multiple memory reads
if (creep.memory.role === "harvester") {
  const role = creep.memory.role; // Read again!
  const task = creep.memory.task;
}

// Good: Cache in local variable
const memory = creep.memory; // Single read
if (memory.role === "harvester") {
  const role = memory.role;
  const task = memory.task;
}
```

**Savings**: ~0.05 CPU per creep

### 4. Conditional Execution

**Skip Expensive Operations When Unnecessary**:

```typescript
// Bad: Always check all spawns
for (const spawn of spawns) {
  if (spawn.spawning === null) {
    /* spawn logic */
  }
}

// Good: Early exit when no spawning needed
if (roleCount >= roleMinimum) {
  return; // Skip spawn logic entirely
}
```

**Savings**: ~0.1-0.2 CPU per tick when spawning not needed

## Performance Monitoring Procedures

### Real-Time Monitoring (In Console)

**Check Current CPU Usage**:

```javascript
Game.cpu.getUsed(); // CPU used so far this tick
Game.cpu.limit; // Your CPU limit
Game.cpu.bucket; // Current bucket level
```

**Monitor Per-Creep Costs**:

```javascript
// Measure specific creep CPU
const startCpu = Game.cpu.getUsed();
const creep = Game.creeps["harvester-12345-789"];
// ... execute creep logic ...
const cpuCost = Game.cpu.getUsed() - startCpu;
console.log(`Creep cost: ${cpuCost.toFixed(3)} CPU`);
```

**Bucket Trend Analysis**:

```javascript
// Track bucket over time (run multiple times)
console.log(`Tick ${Game.time}, Bucket: ${Game.cpu.bucket}`);
```

### Historical Analysis (Memory)

**Review Last System Report**:

```javascript
const report = Memory.systemReport;
console.log(`Tick: ${report?.report.tick}`);
console.log(`CPU Used: ${report?.report.snapshot?.cpuUsed}`);
console.log(`Warnings: ${report?.report.findings.length}`);
```

**Calculate Average CPU** (manual tracking):

```javascript
// Store snapshots in Memory (add to kernel)
Memory.cpuHistory = Memory.cpuHistory || [];
Memory.cpuHistory.push(Game.cpu.getUsed());
if (Memory.cpuHistory.length > 100) Memory.cpuHistory.shift();

// Calculate average
const avg = Memory.cpuHistory.reduce((a, b) => a + b) / Memory.cpuHistory.length;
console.log(`Average CPU: ${avg.toFixed(2)}`);
```

## Performance Alerting

### Automated Alerts (SystemEvaluator)

**Alert Severity Levels**:

1. **Warning** (yellow):
   - CPU usage >80% of limit
   - Bucket <2000 (trending concern)
   - Low spawn throughput

2. **Critical** (red):
   - CPU bucket <500
   - No creeps in play
   - Test failures detected

### Alert Delivery

**Console Logs**:

```
[evaluation] System stable: no anomalies detected.
[evaluation] 2 issues detected.
```

**Memory Storage**:

```typescript
Memory.systemReport = {
  lastGenerated: 12345,
  report: {
    tick: 12345,
    summary: "2 issues detected.",
    findings: [
      {
        severity: "warning",
        title: "High CPU usage",
        detail: "CPU usage 8.50 exceeds 80% of the limit 10.",
        recommendation: "Profile hot paths or reduce creep behaviors..."
      }
    ]
  }
};
```

**External Monitoring** (GitHub Actions):

- `screeps-monitoring.yml` polls Memory every 30 minutes
- Combines strategic analysis with PTR telemetry monitoring
- Sends push notifications for critical findings
- Tracks bucket trends over time

## Performance Degradation Response

### Level 1: Early Warning (CPU >80%)

**Immediate Actions**:

1. Check bucket trend (increasing or decreasing?)
2. Review recent code changes
3. Profile creep operations
4. No immediate action required if bucket stable

**Preventive Actions**:

- Increase pathfinding cache duration
- Optimize task execution logic
- Review for redundant operations

### Level 2: Bucket Draining (Bucket <2000)

**Immediate Actions**:

1. Reduce upgrader count by 1-2
2. Increase `reusePath` parameter to 10+
3. Monitor bucket recovery
4. Identify CPU spikes

**Preventive Actions**:

- Defer non-essential creeps
- Disable advanced features temporarily
- Focus on core operations only

### Level 3: Critical (Bucket <500)

**Immediate Actions**:

1. **Emergency Mode**: Disable all upgraders
2. Reduce to minimum harvesters only
3. Skip evaluation and logging
4. Monitor every tick until recovery

**Recovery Plan**:

```javascript
// Emergency CPU reduction (in console)
for (const name in Game.creeps) {
  const creep = Game.creeps[name];
  if (creep.memory.role === "upgrader") {
    creep.suicide(); // Remove upgraders immediately
  }
}
```

**Resume Normal Operations**:

- Wait for bucket >2000
- Gradually re-enable upgraders (1 at a time)
- Monitor bucket stability
- Investigate root cause

## CPU Profiling Techniques

### Manual Profiling

**Profile Entire Tick**:

```javascript
const start = Game.cpu.getUsed();
// ... your code ...
const end = Game.cpu.getUsed();
console.log(`Total: ${(end - start).toFixed(3)} CPU`);
```

**Profile Specific Operations**:

```javascript
function profileOperation(name, operation) {
  const start = Game.cpu.getUsed();
  const result = operation();
  const cost = Game.cpu.getUsed() - start;
  console.log(`${name}: ${cost.toFixed(3)} CPU`);
  return result;
}

// Usage
profileOperation("Memory Pruning", () => {
  memoryManager.pruneMissingCreeps(Memory, Game.creeps);
});
```

### Automated Profiling

**Instrument Kernel** (temporary for analysis):

```typescript
// Add to kernel.ts
const profile = {
  memory: 0,
  behavior: 0,
  evaluation: 0
};

let t = game.cpu.getUsed();
this.memoryManager.pruneMissingCreeps(memory, game.creeps);
profile.memory = game.cpu.getUsed() - t;

t = game.cpu.getUsed();
const behaviorSummary = this.behavior.execute(game, memory, roleCounts);
profile.behavior = game.cpu.getUsed() - t;

t = game.cpu.getUsed();
this.evaluator.evaluateAndStore(memory, snapshot, repository);
profile.evaluation = game.cpu.getUsed() - t;

console.log(JSON.stringify(profile));
```

## Performance Benchmarks

### Target Performance Metrics

| Metric          | Target     | Warning    | Critical    |
| --------------- | ---------- | ---------- | ----------- |
| CPU/tick        | <50% limit | >80% limit | >100% limit |
| CPU bucket      | >5000      | <2000      | <500        |
| CPU/creep       | <0.5 CPU   | >1.0 CPU   | >2.0 CPU    |
| Kernel overhead | <0.5 CPU   | >1.0 CPU   | >2.0 CPU    |

### Expected Performance (By RCL)

| RCL | Creeps | CPU Used | % of 10 Limit | Bucket Trend | Status       |
| --- | ------ | -------- | ------------- | ------------ | ------------ |
| 1   | 3      | 1.7      | 17%           | Increasing   | ✓ Excellent  |
| 2   | 5      | 2.5      | 25%           | Increasing   | ✓ Good       |
| 3   | 8      | 3.7      | 37%           | Stable       | ✓ Good       |
| 4   | 12     | 5.5      | 55%           | Stable       | ✓ Acceptable |
| 5   | 15     | 6.6      | 66%           | Stable       | ⚠ Monitor   |
| 6   | 18     | 8.5      | 85%           | Decreasing   | ⚠ Warning   |

**Note**: Free tier (10 CPU limit) becomes constraining at RCL 5+. Subscription recommended for further growth.

## Best Practices Summary

### DO:

- ✓ Monitor CPU usage every tick
- ✓ Track bucket trends over time
- ✓ Profile new features before deployment
- ✓ Cache pathfinding results
- ✓ Optimize hot paths (operations in inner loops)
- ✓ Set conservative thresholds for alerts

### DON'T:

- ✗ Ignore bucket drain warnings
- ✗ Add creeps without CPU budget
- ✗ Recalculate paths every tick
- ✗ Iterate Memory.creeps unnecessarily
- ✗ Run expensive operations every tick

### MONITOR:

- ⚠ CPU usage trend (should be stable)
- ⚠ Bucket level (should stay >5000)
- ⚠ Per-creep CPU cost (should be <0.5)
- ⚠ Kernel overhead (should be <0.5)

## Related Documentation

- [Scaling Strategies](../strategy/scaling-strategies.md) - CPU budgets for different room counts
- [Memory Management](./memory-management.md) - Memory access optimization
- [Creep Roles](../strategy/creep-roles.md) - Per-role CPU costs
- [Stats Monitoring](./stats-monitoring.md) - External monitoring setup
