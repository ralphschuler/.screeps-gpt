# CPU Timeout Prevention - Systematic Analysis and Solutions

## Overview

This document details the systematic CPU timeout prevention measures implemented to address critical timeout incidents on shard3, including architectural improvements and incremental CPU guards.

**Related Issues:**

- #417: CPU timeout errors on shard3 (multiple locations)
- #396: Systematic CPU timeout pattern resolution
- #364: Incremental CPU guards implementation
- #392: Proactive CPU monitoring system

## Incident Analysis

### Timeline of Timeout Events

**Shard3 Incidents (2025-10-26):**

- Multiple timeout occurrences in same notification batch
- Critical locations: main:637, main:826, main:872, runtime:20941

### Root Cause Analysis

#### 1. Timeout Location: main:637 (PerformanceTracker.end)

**Cause:** CPU threshold checks occurring too late in tick execution
**Solution:** Implemented incremental CPU guards before expensive operations

#### 2. Timeout Location: main:826 (Kernel.run - behavior execution)

**Cause:** No CPU protection between kernel phases
**Solution:** Added CPU guards after respawn check, memory operations, and construction planning

#### 3. Timeout Location: main:872 (loop/main entry point)

**Cause:** Overall CPU budget exceeded during tick processing
**Solution:** Enhanced BehaviorController with spawn operation CPU checks

#### 4. Timeout Location: runtime:20941 (Memory access)

**Cause:** Memory operations consuming excessive CPU without protection
**Solution:** CPU guards added after memory pruning and bookkeeping operations

## Architectural Improvements

### 1. Incremental CPU Guards in Kernel

The Kernel now implements CPU budget checks at four critical execution phases:

```typescript
// Phase 1: Initial emergency check
if (game.cpu.getUsed() > game.cpu.limit * cpuEmergencyThreshold) {
  // Abort tick, evaluate, and return
}

// Phase 2: After respawn check
if (game.cpu.getUsed() > game.cpu.limit * cpuEmergencyThreshold) {
  // Abort remaining operations
}

// Phase 3: After memory operations
if (game.cpu.getUsed() > game.cpu.limit * cpuEmergencyThreshold) {
  // Abort remaining operations
}

// Phase 4: After construction planning
if (game.cpu.getUsed() > game.cpu.limit * cpuEmergencyThreshold) {
  // Abort behavior execution
}
```

**Benefits:**

- Prevents timeout by checking CPU budget between expensive operations
- Graceful degradation - still completes evaluation even when aborting
- Maintains system observability through consistent tracking

### 2. Enhanced BehaviorController CPU Protection

**Spawn Operation Guards:**

- CPU budget check before attempting to spawn creeps
- Prevents timeout during spawn planning phase
- Maintains role count consistency even when skipping spawns

**Per-Creep Processing Guards:**

- Existing CPU budget check before processing each creep
- Per-creep CPU consumption tracking
- Early termination when budget exceeded

### 3. Performance Monitoring Enhancements

**PerformanceTracker Thresholds:**

- High CPU threshold: 70% (warning)
- Critical CPU threshold: 90% (timeout risk alert)
- Low bucket threshold: 500 (capacity warning)

**Warning Levels:**

```typescript
if (cpuRatio > criticalCpuThreshold) {
  // CRITICAL: timeout risk
} else if (cpuRatio > highCpuThreshold) {
  // High CPU usage warning
}
```

## Configuration Parameters

### Kernel Configuration

```typescript
interface KernelConfig {
  cpuEmergencyThreshold?: number; // Default: 0.9 (90%)
}
```

**Recommended Values:**

- Production: 0.9 (90%) - Provides safety margin while maximizing CPU usage
- Development: 0.85 (85%) - More conservative for testing
- High-load shards: 0.95 (95%) - Aggressive but risky

### BehaviorController Configuration

```typescript
interface BehaviorControllerOptions {
  cpuSafetyMargin?: number; // Default: 0.8 (80%)
  maxCpuPerCreep?: number; // Default: 1.5 CPU units
}
```

**Recommended Values:**

- cpuSafetyMargin: 0.8 for normal operation, 0.85 for high creep counts
- maxCpuPerCreep: 1.5 for standard creeps, 2.0 for complex roles

### PerformanceTracker Configuration

```typescript
interface PerformanceTrackerOptions {
  highCpuThreshold?: number; // Default: 0.7 (70%)
  criticalCpuThreshold?: number; // Default: 0.9 (90%)
  lowBucketThreshold?: number; // Default: 500
}
```

## Emergency Response Procedures

### When CPU Timeout Occurs

1. **Immediate Response:**
   - Check Memory object size (use `JSON.stringify(Memory).length`)
   - Review recent code deployments for performance regressions
   - Check creep count and room count for unexpected growth

2. **Analysis:**
   - Review system report warnings for critical CPU alerts
   - Check which execution phase triggered emergency shutdown
   - Analyze per-creep CPU consumption patterns

3. **Mitigation:**
   - Temporarily reduce cpuSafetyMargin if too conservative
   - Reduce minimum role counts to decrease creep processing load
   - Clear unnecessary Memory data to reduce parsing overhead

### Graceful Degradation Strategy

The system implements graceful degradation through:

1. **Progressive Shutdown:**
   - Most critical operations execute first (respawn check, memory cleanup)
   - Less critical operations can be skipped (construction planning, creep behavior)

2. **Maintaining Observability:**
   - System evaluation always completes, even during emergency shutdown
   - Performance tracking provides insights into where CPU was spent

3. **Consistent State:**
   - Memory operations complete before behavior execution
   - Role counts remain accurate even when spawns are skipped

## Regression Test Coverage

### Test Suite: cpu-timeout-shard3-systematic.test.ts

**Coverage Areas:**

1. Incremental CPU guards at each kernel execution phase
2. BehaviorController spawn operation CPU protection
3. Memory access CPU protection
4. PerformanceTracker warning generation
5. Full integration test for complete tick cycle

**Test Scenarios:**

- CPU spike after respawn check
- CPU spike after memory operations
- CPU spike after construction planning
- CPU spike before spawn operations
- Memory operations within budget
- Critical CPU threshold detection
- Complete tick cycle with multiple guards

## Performance Optimization Best Practices

### 1. Memory Management

**Avoid:**

- Storing large objects in Memory
- Deep object nesting in creep memory
- Unnecessary Memory reads/writes per tick

**Prefer:**

- Flat memory structures
- Caching frequently accessed data
- Lazy initialization of memory fields

### 2. Creep Behavior Optimization

**Avoid:**

- Multiple `room.find()` calls per creep
- Recalculating paths every tick
- Complex nested conditionals in role logic

**Prefer:**

- Caching find results at room level
- Path reuse with `reusePath` option
- State machine patterns for role logic

### 3. CPU Budget Allocation

**Recommended Distribution:**

- Memory operations: 10-15% of CPU limit
- Construction planning: 5-10% of CPU limit
- Creep behavior: 60-70% of CPU limit
- Evaluation/metrics: 5-10% of CPU limit
- Reserve buffer: 10-15% for safety

## Monitoring and Alerting

### Real-Time Monitoring

**System Report Warnings:**

- Monitor `memory.systemReport.report.findings` for critical alerts
- Track CPU usage trends across ticks
- Monitor bucket levels for capacity planning

**PTR Telemetry Integration:**

- CPU usage patterns
- Timeout incident frequency
- Performance degradation trends

### Alert Thresholds

**Immediate Action Required:**

- CPU bucket below 500
- CPU usage above 95% for 5+ consecutive ticks
- Emergency CPU threshold triggered

**Investigation Required:**

- CPU usage above 80% average over 100 ticks
- Increasing trend in per-creep CPU consumption
- Multiple high CPU warnings per tick

## Future Enhancements

### Planned Improvements

1. **Adaptive CPU Budgeting:**
   - Dynamic threshold adjustment based on bucket level
   - Per-room CPU allocation for multi-room scenarios

2. **Advanced Profiling:**
   - Per-role CPU consumption tracking
   - Hot path identification and optimization
   - Automatic regression detection

3. **Predictive Timeout Prevention:**
   - Machine learning models for CPU usage prediction
   - Proactive load shedding before threshold reached

4. **Enhanced Monitoring:**
   - Integration with PTR telemetry for real-time alerting
   - Historical CPU usage analysis and trending
   - Correlation with game events (attacks, expansion)

## Related Documentation

- [Performance Monitoring](./performance-monitoring.md) - Comprehensive performance tracking guide
- [Memory Management](./memory-management.md) - Memory optimization strategies
- [Architecture](../../strategy/architecture.md) - Overall system architecture

## References

- Issue #417: CPU timeout errors on shard3
- Issue #396: Systematic CPU timeout pattern resolution
- Issue #364: Incremental CPU guards implementation
- Issue #392: Proactive CPU monitoring system
- Issue #117: CPU usage optimization below 90% threshold

---

**Last Updated:** 2025-10-27  
**Version:** 1.0.0  
**Status:** Active
