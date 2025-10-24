---
title: Improvement Metrics and Measurement
date: 2025-10-24T12:33:51.451Z
---

# Improvement Metrics and Measurement

This document defines metrics for measuring AI strategy effectiveness and validating that changes improve performance without introducing regressions.

## Overview

Measuring Screeps AI performance requires tracking multiple dimensions: resource efficiency, CPU usage, progression rate, and stability. This document provides a framework for objective evaluation.

## Core Metrics Categories

### 1. Resource Efficiency Metrics

**Energy Per Tick (EPT)**

**Definition**: Average energy harvested per game tick

**Calculation**:

```typescript
EPT = totalEnergyHarvested / ticksElapsed;
```

**Baseline Targets**:

- RCL 1: 8-12 EPT (2 harvesters, 1 source)
- RCL 2: 15-20 EPT (3-4 harvesters, 2 sources)
- RCL 3: 20-25 EPT (4-5 harvesters, 2 sources)
- RCL 4+: 25-35 EPT (optimized harvesters)

**Collection Method**:

```javascript
// Add to Memory tracking
if (!Memory.metrics) Memory.metrics = { energyHistory: [] };
Memory.metrics.energyHistory.push({
  tick: Game.time,
  energy: totalEnergyHarvested
});

// Calculate EPT over last 100 ticks
const recent = Memory.metrics.energyHistory.slice(-100);
const totalEnergy = recent.reduce((sum, m) => sum + m.energy, 0);
const EPT = totalEnergy / recent.length;
```

**Improvement Indicator**: Higher EPT = better efficiency

---

**Harvest Efficiency Ratio**

**Definition**: Percentage of time harvesters spend actively harvesting

**Calculation**:

```typescript
HarvestEfficiency = (harvestTicks / totalHarvesterTicks) * 100;
```

**Baseline Targets**:

- Good: >60% (most time harvesting)
- Acceptable: 40-60% (some travel overhead)
- Poor: <40% (too much idle/travel time)

**Collection Method**:

```typescript
// Track per-harvester in Memory
creep.memory.stats = {
  harvestTicks: creep.memory.stats?.harvestTicks || 0,
  totalTicks: creep.memory.stats?.totalTicks || 0
};

// Increment when harvesting
if (creep.memory.task === "harvest") {
  creep.memory.stats.harvestTicks++;
}
creep.memory.stats.totalTicks++;
```

**Improvement Indicator**: Higher percentage = better

---

**Energy Waste Rate**

**Definition**: Energy lost due to overharvesting or storage overflow

**Calculation**:

```typescript
WasteRate = (energyWasted / totalEnergyHarvested) * 100;
```

**Baseline Targets**:

- Excellent: <5% waste
- Good: 5-10% waste
- Poor: >10% waste

**Collection Method**:

```javascript
// Detect waste events
if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
  Memory.metrics.wastedEnergy++;
}
```

**Improvement Indicator**: Lower percentage = better

### 2. CPU Efficiency Metrics

**CPU Per Tick**

**Definition**: Average CPU consumed per game tick

**Calculation**:

```typescript
avgCPU = totalCPU / ticksElapsed;
```

**Baseline Targets** (10 CPU limit):

- RCL 1: 1.5-2.5 CPU/tick
- RCL 2: 2.5-4.0 CPU/tick
- RCL 3: 3.5-5.5 CPU/tick
- RCL 4+: 5.0-8.0 CPU/tick

**Collection Method**:

```typescript
// Tracked by PerformanceTracker automatically
const snapshot = tracker.end(game, execution);
const cpuUsed = snapshot.cpuUsed;
```

**Improvement Indicator**: Lower CPU = better (if functionality maintained)

---

**CPU Per Creep**

**Definition**: Average CPU consumed per living creep

**Calculation**:

```typescript
CPUPerCreep = cpuUsed / creepCount;
```

**Baseline Targets**:

- Excellent: <0.3 CPU/creep
- Good: 0.3-0.5 CPU/creep
- Acceptable: 0.5-0.8 CPU/creep
- Poor: >0.8 CPU/creep

**Collection Method**:

```typescript
const cpuPerCreep = snapshot.cpuUsed / snapshot.creepCount;
```

**Improvement Indicator**: Lower CPU/creep = better efficiency

---

**CPU Bucket Trend**

**Definition**: Change in CPU bucket over time

**Calculation**:

```typescript
BucketTrend = (currentBucket - startBucket) / ticksElapsed;
```

**Baseline Targets**:

- Increasing: >0 (gaining bucket)
- Stable: ~0 (balanced usage)
- Decreasing: <0 (losing bucket) ⚠️

**Collection Method**:

```javascript
Memory.metrics.bucketHistory = Memory.metrics.bucketHistory || [];
Memory.metrics.bucketHistory.push({
  tick: Game.time,
  bucket: Game.cpu.bucket
});

// Calculate trend over last 1000 ticks
const recent = Memory.metrics.bucketHistory.slice(-1000);
const start = recent[0].bucket;
const end = recent[recent.length - 1].bucket;
const trend = (end - start) / recent.length;
```

**Improvement Indicator**: Positive or zero trend = sustainable

### 3. Progression Metrics

**Room Control Level (RCL) Progression Rate**

**Definition**: Average ticks per RCL level

**Calculation**:

```typescript
TicksPerLevel = ticksElapsed / (currentRCL - startRCL);
```

**Baseline Targets**:

- RCL 1→2: ~5,000-8,000 ticks
- RCL 2→3: ~10,000-15,000 ticks
- RCL 3→4: ~15,000-25,000 ticks
- RCL 4→5: ~25,000-40,000 ticks

**Collection Method**:

```javascript
// Track RCL changes
if (!Memory.metrics.rclHistory) Memory.metrics.rclHistory = [];
if (room.controller.level > Memory.lastRCL) {
  Memory.metrics.rclHistory.push({
    level: room.controller.level,
    tick: Game.time
  });
  Memory.lastRCL = room.controller.level;
}
```

**Improvement Indicator**: Fewer ticks per level = faster progression

---

**Controller Upgrade Rate (CPT)**

**Definition**: Average control points generated per tick

**Calculation**:

```typescript
CPT = controllerPoints / ticksElapsed;
```

**Baseline Targets**:

- RCL 1: 0.5-1.0 CPT (1 upgrader)
- RCL 2: 1.0-2.0 CPT (1-2 upgraders)
- RCL 3: 2.0-4.0 CPT (2-3 upgraders)
- RCL 4+: 4.0-8.0 CPT (3-5 upgraders)

**Collection Method**:

```javascript
// Track controller progress
Memory.metrics.controllerPoints = {
  start: room.controller.progress,
  tick: Game.time
};

// Calculate rate periodically
const elapsed = Game.time - Memory.metrics.controllerPoints.tick;
const gained = room.controller.progress - Memory.metrics.controllerPoints.start;
const CPT = gained / elapsed;
```

**Improvement Indicator**: Higher CPT = faster upgrades

### 4. Stability Metrics

**Population Stability**

**Definition**: Variance in creep population over time

**Calculation**:

```typescript
StdDev = sqrt(variance(populationHistory));
```

**Baseline Targets**:

- Excellent: StdDev <1 (very stable)
- Good: StdDev 1-2 (minor fluctuations)
- Poor: StdDev >2 (unstable population)

**Collection Method**:

```javascript
Memory.metrics.populationHistory = Memory.metrics.populationHistory || [];
Memory.metrics.populationHistory.push({
  tick: Game.time,
  count: Object.keys(Game.creeps).length
});

// Calculate standard deviation
const counts = Memory.metrics.populationHistory.map(p => p.count);
const mean = counts.reduce((a, b) => a + b) / counts.length;
const variance = counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / counts.length;
const stdDev = Math.sqrt(variance);
```

**Improvement Indicator**: Lower variance = more stable

---

**Spawn Uptime Percentage**

**Definition**: Percentage of ticks spawns are actively spawning

**Calculation**:

```typescript
SpawnUptime = (spawningTicks / totalTicks) * 100;
```

**Baseline Targets**:

- Healthy: 60-80% (continuous production)
- Acceptable: 40-60% (periodic production)
- Poor: <40% (insufficient energy or demand)

**Collection Method**:

```javascript
let spawningTicks = 0;
for (const spawn of Object.values(Game.spawns)) {
  if (spawn.spawning) spawningTicks++;
}

Memory.metrics.spawnStats = {
  spawningTicks: (Memory.metrics.spawnStats?.spawningTicks || 0) + spawningTicks,
  totalTicks: (Memory.metrics.spawnStats?.totalTicks || 0) + 1
};

const uptime = (Memory.metrics.spawnStats.spawningTicks / Memory.metrics.spawnStats.totalTicks) * 100;
```

**Improvement Indicator**: 60-80% is optimal (too high = bottleneck, too low = underutilized)

---

**Error Rate**

**Definition**: Number of errors or warnings per 1000 ticks

**Calculation**:

```typescript
ErrorRate = (errorCount / totalTicks) * 1000;
```

**Baseline Targets**:

- Excellent: 0 errors per 1000 ticks
- Acceptable: <5 errors per 1000 ticks
- Poor: >10 errors per 1000 ticks

**Collection Method**:

```javascript
// Count warnings and errors from logs
Memory.metrics.errors = (Memory.metrics.errors || 0) + errorCount;
Memory.metrics.totalTicks = (Memory.metrics.totalTicks || 0) + 1;

const errorRate = (Memory.metrics.errors / Memory.metrics.totalTicks) * 1000;
```

**Improvement Indicator**: Lower rate = more stable

## Composite Metrics

### Overall Efficiency Score (OES)

**Definition**: Weighted combination of key metrics

**Calculation**:

```typescript
OES = EPT_score * 0.3 + CPU_score * 0.3 + CPT_score * 0.2 + Stability_score * 0.2;
```

**Scoring** (0-100 scale):

- Each metric normalized to 0-100 range
- Baseline = 50 (acceptable)
- Target = 75+ (good)
- Excellent = 90+ (optimal)

**Example**:

```typescript
// Normalize EPT (baseline: 10, target: 20)
const EPT_score = Math.min(100, (currentEPT / 20) * 100);

// Normalize CPU/creep (baseline: 0.5, target: 0.3)
const CPU_score = Math.max(0, 100 - ((cpuPerCreep - 0.3) / 0.5) * 100);

// Calculate composite
const OES = EPT_score * 0.3 + CPU_score * 0.3 + CPT_score * 0.2 + Stability_score * 0.2;
```

## Metric Collection Infrastructure

### Automated Collection (in Kernel)

**Add to `src/runtime/metrics/MetricsCollector.ts`**:

```typescript
export class MetricsCollector {
  collect(game: GameContext, memory: Memory, snapshot: PerformanceSnapshot): void {
    if (!memory.metrics) {
      memory.metrics = this.initializeMetrics();
    }

    this.collectResourceMetrics(game, memory);
    this.collectCPUMetrics(snapshot, memory);
    this.collectProgressionMetrics(game, memory);
    this.collectStabilityMetrics(game, memory);

    // Prune old data (keep last 10000 ticks)
    this.pruneOldMetrics(memory, game.time);
  }
}
```

### Manual Inspection (Console)

**View Current Metrics**:

```javascript
console.log(JSON.stringify(Memory.metrics, null, 2));
```

**Calculate Summary**:

```javascript
function summarizeMetrics() {
  const m = Memory.metrics;

  // EPT
  const recentEnergy = m.energyHistory.slice(-100);
  const EPT = recentEnergy.reduce((s, e) => s + e.energy, 0) / recentEnergy.length;

  // CPU/creep
  const cpuPerCreep = Game.cpu.getUsed() / Object.keys(Game.creeps).length;

  // Bucket trend
  const bucketTrend =
    m.bucketHistory.length > 1 ? m.bucketHistory[m.bucketHistory.length - 1].bucket - m.bucketHistory[0].bucket : 0;

  console.log(`EPT: ${EPT.toFixed(2)}, CPU/creep: ${cpuPerCreep.toFixed(2)}, Bucket trend: ${bucketTrend}`);
}

summarizeMetrics();
```

## A/B Testing Framework

### Baseline Collection

**Phase 1: Establish Baseline** (1000+ ticks)

```javascript
Memory.baseline = {
  EPT: [],
  CPU: [],
  CPT: [],
  population: []
};

// Collect for 1000 ticks
for (let i = 0; i < 1000; i++) {
  // ... normal execution ...
  Memory.baseline.EPT.push(currentEPT);
  Memory.baseline.CPU.push(Game.cpu.getUsed());
}

// Calculate baseline averages
Memory.baselineAvg = {
  EPT: Memory.baseline.EPT.reduce((a, b) => a + b) / 1000,
  CPU: Memory.baseline.CPU.reduce((a, b) => a + b) / 1000
};
```

### Comparison Collection

**Phase 2: Test New Strategy** (1000+ ticks)

```javascript
Memory.comparison = {
  EPT: [],
  CPU: [],
  CPT: [],
  population: []
};

// Deploy new strategy, collect for 1000 ticks
for (let i = 0; i < 1000; i++) {
  // ... new strategy execution ...
  Memory.comparison.EPT.push(currentEPT);
  Memory.comparison.CPU.push(Game.cpu.getUsed());
}

// Calculate improvement
const EPT_improvement = ((comparisonAvg.EPT - baselineAvg.EPT) / baselineAvg.EPT) * 100;
const CPU_improvement = ((baselineAvg.CPU - comparisonAvg.CPU) / baselineAvg.CPU) * 100;

console.log(`EPT improved by ${EPT_improvement.toFixed(1)}%`);
console.log(`CPU improved by ${CPU_improvement.toFixed(1)}%`);
```

## Regression Detection

### Statistical Significance

**Use T-Test** to determine if difference is meaningful:

```typescript
function tTest(sample1: number[], sample2: number[]): { significant: boolean; pValue: number } {
  const mean1 = average(sample1);
  const mean2 = average(sample2);
  const variance1 = variance(sample1);
  const variance2 = variance(sample2);

  const t = (mean1 - mean2) / Math.sqrt(variance1 / sample1.length + variance2 / sample2.length);
  const pValue = calculatePValue(t, sample1.length + sample2.length - 2);

  return {
    significant: pValue < 0.05, // 95% confidence
    pValue
  };
}

// Usage
const result = tTest(baselineCPU, newCPU);
if (result.significant && mean(newCPU) > mean(baselineCPU)) {
  console.log("REGRESSION DETECTED: CPU usage significantly increased");
}
```

### Automated Alerts

**In SystemEvaluator**:

```typescript
// Add regression checking
if (memory.baseline && snapshot.cpuUsed > memory.baseline.avgCPU * 1.1) {
  findings.push({
    severity: "warning",
    title: "CPU regression detected",
    detail: `CPU usage ${snapshot.cpuUsed.toFixed(2)} exceeds baseline ${memory.baseline.avgCPU.toFixed(2)} by 10%`,
    recommendation: "Profile recent changes and consider rollback"
  });
}
```

## Improvement Validation Checklist

Before declaring improvement successful:

- [ ] Collected 1000+ ticks of baseline metrics
- [ ] Collected 1000+ ticks of comparison metrics
- [ ] EPT improved or stable (within 5%)
- [ ] CPU/creep improved or stable (within 5%)
- [ ] Bucket trend neutral or positive
- [ ] No increase in error rate
- [ ] Population stability maintained
- [ ] Spawn uptime maintained
- [ ] Statistical significance verified (p < 0.05)
- [ ] No adverse side effects observed

## Reporting Template

### Improvement Report Format

```markdown
## Strategy Change: [Brief Description]

### Goal

[What were you trying to improve?]

### Hypothesis

[What did you expect to happen?]

### Baseline Metrics (1000 ticks)

- EPT: 12.5
- CPU/tick: 3.2
- CPU/creep: 0.42
- CPT: 2.1
- Bucket trend: +5/1000 ticks

### Comparison Metrics (1000 ticks)

- EPT: 14.8 (+18.4%)
- CPU/tick: 2.9 (-9.4%)
- CPU/creep: 0.38 (-9.5%)
- CPT: 2.1 (stable)
- Bucket trend: +12/1000 ticks (+140%)

### Statistical Significance

- EPT improvement: p=0.001 (highly significant)
- CPU reduction: p=0.023 (significant)

### Conclusion

[Success/Failure and reasoning]

### Recommendation

[Deploy/Rollback/Iterate]
```

## Best Practices

### DO:

- ✓ Collect baseline before changes
- ✓ Run comparisons for sufficient time (1000+ ticks)
- ✓ Verify statistical significance
- ✓ Track multiple dimensions (not just one metric)
- ✓ Document all measurements
- ✓ Compare like-for-like (same RCL, room conditions)

### DON'T:

- ✗ Cherry-pick favorable metrics
- ✗ Compare different RCL levels directly
- ✗ Ignore side effects (CPU increase for EPT gain)
- ✗ Make conclusions from <100 tick samples
- ✗ Optimize single metric at expense of others

### MONITOR:

- ⚠ Metric trends over time
- ⚠ Correlation between metrics
- ⚠ External factors (attacks, room conditions)
- ⚠ Long-term stability (10000+ ticks)

## Related Documentation

- [Strategy Testing](./strategy-testing.md) - Testing methodologies for changes
- [Safe Refactoring](./safe-refactoring.md) - How to modify code safely
- [Performance Monitoring](../operations/performance-monitoring.md) - Real-time monitoring
- [Creep Roles](../strategy/creep-roles.md) - Expected performance characteristics
- [Scaling Strategies](../strategy/scaling-strategies.md) - Performance by RCL
