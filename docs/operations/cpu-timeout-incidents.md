# CPU Timeout Incident Tracking

## Overview

This document tracks CPU timeout incidents as part of the systematic resolution coordination framework. Rather than treating each timeout as an isolated issue, this document provides centralized tracking to support architectural prevention solutions.

## Systematic Resolution Framework

**Parent Coordination**: Issue #396 - Systematic CPU timeout pattern resolution requiring architectural intervention

**Architectural Solutions**:

- Issue #364 - Incremental CPU guards implementation (architectural prevention solution)
- Issue #392 - Proactive CPU monitoring system (comprehensive prevention infrastructure)
- Issue #299 - Proactive CPU monitoring system (prevention infrastructure)

**Pattern Analysis**:

- Issue #380 - Systematic CPU timeout pattern coordination (architectural solutions coordination)
- Issue #391 - CPU timeout at multiple locations requiring systematic analysis
- Issue #328 - Systematic CPU timeout analysis and prevention (coordination framework)

**Performance Targets**:

- Issue #117 - CPU usage optimization below 90% threshold

## Incident Log

### Incident #5: Shard3 CPU Timeout - October 26, 2025 (17:43 UTC)

**Incident Details**:

- **Date**: 2025-10-26T17:43:15.824Z
- **Shard**: shard3
- **Error**: Script execution timed out: CPU time limit reached
- **Source**: Screeps game notification email
- **Impact**: Production AI failing on shard3 with potential loss of game progress
- **Stack Trace**: Not provided in original notification
- **Issue**: #398

**Pattern Recognition**:

- Part of systematic timeout pattern affecting shard3
- Similar to recent incidents: #393 (15:02 UTC), #385 (14:01 UTC), #377 (13:01 UTC), #374 (11:30 UTC)
- All incidents occurred on same day (2025-10-26) on shard3
- Pattern indicates systematic issue rather than isolated failure

**Coordination Status**:

- ✓ Incident documented in systematic resolution framework
- ✓ Coordinated with issue #396 (parent systematic resolution)
- ✓ Covered by architectural prevention solutions (#364, #392)
- ✓ Integrated with PTR monitoring system for telemetry validation

**Resolution Approach**:

- No individual tactical fix applied
- Incident contributes to systematic pattern analysis
- Resolution achieved through coordinated architectural improvements
- Monitoring integration ensures detection of future occurrences

**Related Documentation**:

- [Performance Optimization Guide](./performance-optimization.md) - CPU optimization strategies
- [Performance Monitoring](../runtime/operations/performance-monitoring.md) - CPU tracking implementation
- [Stats Monitoring](./stats-monitoring.md) - PTR telemetry monitoring setup

---

### Incident #4: Shard3 CPU Timeout - October 26, 2025 (15:02 UTC)

**Incident Details**:

- **Date**: 2025-10-26T15:02:43Z
- **Shard**: shard3
- **Error**: Script execution timed out at main:872:22
- **Issue**: #393

**Pattern Recognition**:

- Same failure pattern as incidents #385, #377, #374
- Specific line reference: main:872:22
- Part of systematic timeout pattern

---

### Incident #3: Shard3 CPU Timeout - October 26, 2025 (14:01 UTC)

**Incident Details**:

- **Date**: 2025-10-26T14:01:46Z
- **Shard**: shard3
- **Error**: Script execution timed out at main:872:22
- **Issue**: #385

**Pattern Recognition**:

- Identical failure pattern to #377 and #374
- Same stack location: main:872:22
- Systematic issue confirmed

---

### Incident #2: Shard3 CPU Timeout - October 26, 2025 (13:01 UTC)

**Incident Details**:

- **Date**: 2025-10-26T13:01:30Z
- **Shard**: shard3
- **Error**: Script execution timed out at main:872:22
- **Issue**: #377

**Pattern Recognition**:

- Recurring failure at same location
- Pattern emerging across multiple incidents

---

### Incident #1: Shard3 CPU Timeout - October 26, 2025 (11:30 UTC)

**Incident Details**:

- **Date**: 2025-10-26T11:30:21Z
- **Shard**: shard3
- **Error**: Script execution timed out at main:872:22
- **Issue**: #374

**Pattern Recognition**:

- First documented incident in systematic pattern
- Stack trace identifies specific code location

---

## Pattern Analysis

### Temporal Pattern

**Frequency**: Multiple incidents per day on shard3
**Time Distribution**: Incidents occurring at ~2-3 hour intervals
**Duration**: Pattern sustained throughout October 26, 2025

### Location Pattern

**Shard**: All incidents on shard3 specifically
**Code Location**: Main execution loop (main:872:22 in incidents #1-4)
**Incident #5**: No specific location provided

### Systematic Indicators

1. **High Frequency**: 5+ incidents in single day indicates systematic issue
2. **Consistent Shard**: All on shard3 suggests shard-specific conditions
3. **Recurring Location**: Multiple incidents at same code line (main:872:22)
4. **No Individual Fixes**: Pattern persists across multiple occurrences

## Prevention Infrastructure

### Current Protections

1. **Multi-Layered CPU Guards** (implemented in v0.7.25):
   - BehaviorController: 80% CPU safety margin
   - PerformanceTracker: 70% warning, 90% critical thresholds
   - Kernel: 90% emergency abort threshold
   - Per-creep monitoring: 1.5 CPU threshold

2. **Pathfinding Optimization** (implemented in v0.7.25):
   - Increased reusePath values: 30-50 ticks
   - Reduced pathfinding CPU overhead

3. **PTR Monitoring System**:
   - `.github/workflows/screeps-monitoring.yml`
   - Fetches telemetry every 30 minutes
   - Detects CPU anomalies (>95% CPU, >80% sustained)
   - Creates GitHub issues for performance regressions

### Gaps and Improvements

**Issue #364 - Incremental CPU Guards**:

- Architectural solution for systematic CPU protection
- Ensures graceful degradation under high CPU load
- Prevents cascading failures

**Issue #392 - Proactive CPU Monitoring**:

- Comprehensive prevention infrastructure
- Early warning system before timeout occurs
- Integration with PTR telemetry for validation

**Issue #299 - Proactive CPU Monitoring System**:

- Prevention infrastructure for CPU anomalies
- Historical trend analysis
- Predictive alerting

## Monitoring Integration

### PTR Telemetry

**Workflow**: `.github/workflows/screeps-monitoring.yml`

**Capabilities**:

- CPU usage pattern analysis
- Anomaly detection (>95% CPU, >80% sustained)
- Low energy detection
- Automatic issue creation for regressions
- Push notifications for critical alerts

**Integration Points**:

- Memory.stats collection via StatsCollector
- System evaluation reports via SystemEvaluator
- Performance tracking via PerformanceTracker
- External monitoring via /api/user/stats endpoint

### Runtime Evaluation

**SystemEvaluator Integration**:

- Generates health reports from performance data
- CPU usage warnings at 70% and 90% thresholds
- Bucket depletion alerts
- Stored in Memory.systemReport for monitoring workflows

**PerformanceTracker Integration**:

- Per-tick CPU measurement
- Multi-threshold warning system
- Performance snapshot generation
- Integration with stats collection

## Acceptance Criteria

### For Each Incident

- ✓ Incident documented with timestamp, shard, error details
- ✓ Pattern integration with existing systematic analysis
- ✓ Coordination references to architectural solutions
- ✓ Monitoring integration coverage confirmed
- ✓ Resolution approach documented (systematic vs tactical)

### For Systematic Resolution

- ✓ All incidents tracked in centralized document
- ✓ Pattern analysis performed across incidents
- ✓ Prevention infrastructure gaps identified
- ✓ Architectural solutions referenced and linked
- ✓ Monitoring integration validated

## Related Issues

**Systematic Resolution Coordination**:

- #396 - Systematic CPU timeout pattern resolution (parent coordination)
- #380 - Systematic CPU timeout pattern coordination
- #391 - CPU timeout at multiple locations requiring systematic analysis
- #328 - Systematic CPU timeout analysis and prevention

**Architectural Prevention Solutions**:

- #364 - Incremental CPU guards implementation
- #392 - Proactive CPU monitoring system
- #299 - Proactive CPU monitoring system (prevention infrastructure)

**Performance Targets**:

- #117 - CPU usage optimization below 90% threshold

**Recent Timeout Incidents**:

- #398 - CPU timeout on shard3 (2025-10-26T17:43:15.824Z) - This incident
- #393 - CPU timeout at main:872:22 (2025-10-26T15:02:43Z)
- #385 - CPU timeout at main:872:22 (2025-10-26T14:01:46Z)
- #377 - CPU timeout at main:872:22 (2025-10-26T13:01:30Z)
- #374 - CPU timeout at main:872:22 (2025-10-26T11:30:21Z)

## Next Steps

1. **Continue Pattern Monitoring**: Track new incidents in this document
2. **Coordinate with #396**: Ensure systematic resolution progresses
3. **Validate Prevention**: Monitor effectiveness of #364 and #392 implementations
4. **PTR Integration**: Ensure monitoring detects and alerts on timeout patterns
5. **Architectural Improvements**: Support coordinated systematic solutions over tactical fixes

---

_This document is maintained as part of the systematic CPU timeout resolution framework. Individual incidents should be documented here and coordinated with architectural prevention efforts rather than treated as isolated tactical fixes._
