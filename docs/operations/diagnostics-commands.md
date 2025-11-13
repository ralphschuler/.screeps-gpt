# Console Diagnostics Commands

## Overview

The Diagnostics utility provides console-accessible commands for validating the stats collection pipeline when automated monitoring detects failures. These commands enable manual testing and debugging without requiring code changes or redeployment.

**Implementation Date:** 2025-11-13  
**Related Issue:** #685 - feat(monitoring): add console diagnostics command for stats collection validation

## Problem Context

The automated monitoring system detects `Memory.stats` failures (issue #684) but lacked manual diagnostic tools to validate the stats collection pipeline. When `Memory.stats` is empty despite active bot execution, operators had no console-accessible commands to trigger or test stats collection directly.

## Available Commands

All diagnostic commands are available globally via the `Diagnostics` namespace in the Screeps console:

### 1. testStatsCollection()

Manually trigger stats collection and validate the pipeline.

**Usage:**

```javascript
Diagnostics.testStatsCollection();
```

**Returns:**

- `✅ Stats collection successful. Keys: time, cpu, rooms, creeps` - Collection succeeded
- `❌ Stats collection failed - Memory.stats is empty` - Collection failed
- `❌ Stats collection error: <error message>` - Collection threw error

**Example:**

```javascript
> Diagnostics.testStatsCollection()
"✅ Stats collection successful. Keys: time, cpu, rooms, creeps, spawn"
```

**What it does:**

1. Validates `Game` and `Memory` object availability
2. Creates a minimal `PerformanceSnapshot` for testing
3. Instantiates `StatsCollector` and calls `collect()`
4. Validates `Memory.stats` was populated
5. Returns status message with keys collected

**Use cases:**

- Test stats collection pipeline after deployment
- Verify StatsCollector functionality after code changes
- Debug stats collection failures reported by monitoring
- Validate Memory.stats is being written correctly

---

### 2. validateMemoryStats()

Check Memory.stats structure and content validity.

**Usage:**

```javascript
Diagnostics.validateMemoryStats();
```

**Returns:**

- `✅ Memory.stats structure valid. Size: 523 bytes` - Structure is valid
- `❌ Memory.stats is undefined` - No stats data exists
- `⚠️ Missing keys: <keys>` - Required keys are missing
- `⚠️ Missing CPU keys: <keys>` - CPU stats are incomplete
- `⚠️ Memory.stats.cpu is missing or invalid` - CPU structure is invalid

**Example:**

```javascript
> Diagnostics.validateMemoryStats()
"✅ Memory.stats structure valid. Size: 1847 bytes"
```

**What it does:**

1. Checks if `Memory.stats` exists
2. Validates presence of required top-level keys: `time`, `cpu`, `rooms`, `creeps`
3. Validates CPU stats structure and keys: `used`, `limit`, `bucket`
4. Validates rooms and creeps stats structures
5. Calculates serialized size of stats data

**Use cases:**

- Verify stats structure after monitoring alert
- Check if stats contain all required fields
- Measure stats data size for memory optimization
- Diagnose partial stats collection failures

---

### 3. getLastSnapshot()

Inspect the latest PerformanceSnapshot data from Memory.systemReport.

**Usage:**

```javascript
Diagnostics.getLastSnapshot();
```

**Returns:**

- Object with `lastGenerated` and `report` properties - Snapshot data available
- `❌ No PerformanceSnapshot data available - Memory.systemReport is undefined` - No data

**Example:**

```javascript
> Diagnostics.getLastSnapshot()
{
  lastGenerated: 12345678,
  report: {
    tick: 12345678,
    summary: "System healthy - all metrics nominal",
    findings: []
  }
}
```

**What it does:**

1. Checks if `Memory.systemReport` exists
2. Returns full systemReport object including metadata and evaluation report
3. Provides access to SystemEvaluator output without code inspection

**Use cases:**

- Review last evaluation report from console
- Check when systemReport was last generated
- Inspect evaluation findings and severity levels
- Debug evaluation system behavior

---

### 4. getSystemInfo()

Get comprehensive diagnostic information about the current game state.

**Usage:**

```javascript
Diagnostics.getSystemInfo();
```

**Returns:**
Object containing game state and memory status information.

**Example:**

```javascript
> Diagnostics.getSystemInfo()
{
  game: {
    time: 12345678,
    cpu: {
      used: 45.23,
      limit: 100,
      bucket: 9850
    },
    creepCount: 15,
    roomCount: 2,
    spawnCount: 2
  },
  memory: {
    hasStats: true,
    hasSystemReport: true,
    statsKeys: ["time", "cpu", "rooms", "creeps", "spawn"]
  }
}
```

**What it does:**

1. Collects current game state information (tick, CPU, counts)
2. Checks Memory for stats and systemReport presence
3. Lists all keys present in Memory.stats
4. Returns comprehensive diagnostic snapshot

**Use cases:**

- Quick overview of bot state
- Verify Memory.stats existence without inspecting structure
- Check CPU usage and bucket levels
- Confirm active rooms, creeps, and spawns

## Diagnostic Workflow

### When Monitoring Alerts on Empty Memory.stats

**Step 1: Verify Game State**

```javascript
Diagnostics.getSystemInfo();
```

- Confirm bot is alive and processing ticks
- Check CPU usage and bucket levels
- Verify rooms and creeps exist

**Step 2: Check Memory.stats Structure**

```javascript
Diagnostics.validateMemoryStats();
```

- Determine if stats exist
- Identify missing keys or invalid structure
- Note size for memory utilization concerns

**Step 3: Test Stats Collection**

```javascript
Diagnostics.testStatsCollection();
```

- Manually trigger collection pipeline
- Verify collection succeeds
- Identify specific collection errors

**Step 4: Review System Report**

```javascript
Diagnostics.getLastSnapshot();
```

- Check for evaluation findings
- Review last generation timestamp
- Look for system health warnings

**Step 5: Document Findings**

- Record which commands succeeded/failed
- Note specific error messages
- Document Memory.stats structure if partially populated
- Create issue with diagnostic output

## Integration with Monitoring

### Automated Monitoring Alert (#684)

When automated monitoring detects `Memory.stats` is empty:

1. **Alert triggers** - GitHub Actions workflow detects empty stats
2. **Issue created** - Alert issue filed with monitoring data
3. **Console diagnostics** - Operator runs diagnostic commands
4. **Root cause** - Diagnostics identify specific failure point
5. **Fix implemented** - Code changes based on diagnostic output
6. **Validation** - Diagnostics used to verify fix

### Manual Validation After Deployment

After deploying stats collection changes:

```javascript
// Verify stats collection is working
Diagnostics.testStatsCollection();
// Expected: "✅ Stats collection successful. Keys: ..."

// Validate structure is correct
Diagnostics.validateMemoryStats();
// Expected: "✅ Memory.stats structure valid. Size: XXX bytes"

// Confirm system report is generated
Diagnostics.getLastSnapshot();
// Expected: Object with lastGenerated and report properties
```

## Error Messages Reference

### testStatsCollection() Errors

| Message                                              | Meaning                               | Action                              |
| ---------------------------------------------------- | ------------------------------------- | ----------------------------------- |
| `❌ Game object not available`                       | Game global not initialized           | Check bot deployment, restart       |
| `❌ Memory object not available`                     | Memory global not initialized         | Check bot deployment, restart       |
| `❌ Stats collection failed - Memory.stats is empty` | Collection ran but didn't write stats | Check StatsCollector implementation |
| `❌ Stats collection error: <message>`               | Exception during collection           | Review error message, check logs    |

### validateMemoryStats() Errors

| Message                                     | Meaning                      | Action                         |
| ------------------------------------------- | ---------------------------- | ------------------------------ |
| `❌ Memory.stats is undefined`              | No stats collected this tick | Run testStatsCollection()      |
| `⚠️ Missing keys: <keys>`                   | Partial collection           | Check StatsCollector logic     |
| `⚠️ Missing CPU keys: <keys>`               | CPU stats incomplete         | Verify CPU data collection     |
| `⚠️ Memory.stats.cpu is missing or invalid` | CPU structure broken         | Check CPU stats implementation |

### getLastSnapshot() Errors

| Message                                    | Meaning                       | Action                              |
| ------------------------------------------ | ----------------------------- | ----------------------------------- |
| `❌ No PerformanceSnapshot data available` | SystemEvaluator hasn't run    | Wait for next tick, check evaluator |
| `❌ Memory object not available`           | Memory global not initialized | Check bot deployment                |

### getSystemInfo() Errors

| Message                                   | Meaning                        | Action                        |
| ----------------------------------------- | ------------------------------ | ----------------------------- |
| `❌ Game or Memory objects not available` | Global objects not initialized | Check bot deployment, restart |

## Related Documentation

- **[Stats Collection Implementation](stats-collection.md)** - Overview of StatsCollector module
- **[Stats Monitoring](stats-monitoring.md)** - Automated monitoring setup
- **[Troubleshooting Empty Stats](troubleshooting-empty-stats.md)** - Common issues and fixes
- **[Monitoring Alerts Playbook](monitoring-alerts-playbook.md)** - Alert response procedures

## Implementation Details

### Source Files

- `packages/bot/src/runtime/utils/Diagnostics.ts` - Diagnostics class implementation
- `packages/bot/src/main.ts` - Global scope exposure
- `tests/unit/diagnostics.test.ts` - Comprehensive unit tests (20 tests)

### Global Exposure

The `Diagnostics` class is exposed to the global scope in `main.ts`:

```typescript
import { Diagnostics } from "@runtime/utils/Diagnostics";

if (typeof global !== "undefined") {
  (global as any).Diagnostics = Diagnostics;
}
```

This makes all static methods available in the Screeps console without imports.

### Test Coverage

The Diagnostics module has 85.71% test coverage with 20 unit tests covering:

- Successful stats collection
- Memory.stats structure validation
- Error handling for missing Game/Memory objects
- PerformanceSnapshot retrieval
- System info collection
- Edge cases and failure scenarios

## Changelog

### v0.59.0 (2025-11-13)

- **Added:** `Diagnostics.testStatsCollection()` for manual stats pipeline testing
- **Added:** `Diagnostics.validateMemoryStats()` for structure validation
- **Added:** `Diagnostics.getLastSnapshot()` for PerformanceSnapshot inspection
- **Added:** `Diagnostics.getSystemInfo()` for comprehensive system diagnostics
- **Added:** Global scope exposure in main.ts
- **Added:** Comprehensive unit test suite (20 tests)

## Support

For issues or questions about diagnostic commands:

1. **Review documentation** - Check this guide and related docs
2. **Run diagnostics** - Use all four commands to gather information
3. **Check logs** - Review console output for error messages
4. **Create issue** - Include diagnostic output in issue description
5. **Reference monitoring** - Link to related monitoring alerts

---

**Maintainer Note:** Keep this documentation synchronized with Diagnostics class implementation. Update error messages reference when diagnostic logic changes.
