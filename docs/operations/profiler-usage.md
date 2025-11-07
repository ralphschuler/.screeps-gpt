# Profiler Usage Guide

## Overview

The screeps-typescript-profiler provides detailed performance profiling capabilities for identifying CPU bottlenecks and optimizing runtime execution. This TypeScript-specific profiler instruments classes and methods to track CPU usage with minimal overhead.

**Key Features:**

- Automatic CPU profiling at the class or method level using decorators
- Detailed performance reports with CPU per call, calls per tick metrics
- Integration with existing CPU monitoring and performance analysis
- Configurable enable/disable via build flags for production control
- Memory-backed profiling data accessible via Screeps console

## Quick Start

### Profiler Status

The profiler is **enabled by default** in all builds. This allows for continuous performance monitoring and analysis without requiring manual activation.

To disable the profiler (e.g., for minimal production overhead):

```bash
# Build without profiler
bun run build:no-profiler

# Or set environment variable directly
PROFILER_ENABLED=false bun run build

# Deploy without profiler
bun run deploy:no-profiler
```

The profiler can be controlled via the `PROFILER_ENABLED` environment variable during build (defaults to `true`).

### Automatic Data Collection

**✨ NEW:** The profiler now **automatically starts** data collection on the first tick after deployment when enabled. No manual start command required!

**How it works:**

1. On first tick after deployment, profiler checks its status
2. If stopped, automatically calls `Profiler.start()`
3. Data collection begins immediately
4. Monitoring workflow fetches data every 30 minutes

This ensures profiler data is always available for performance analysis without manual intervention.

### Console Commands

Access these commands in the Screeps console for manual control:

```javascript
// Check profiler status (should show "Profiler is running" after deployment)
Profiler.status();
// => "Profiler is running"

// Stop profiling (pauses data collection)
Profiler.stop();

// Restart profiling after stopping
Profiler.start();

// Output profiling report to console
Profiler.output();

// Clear profiling data and restart
Profiler.clear();
```

### Example Profiling Session

**Automatic Mode (Default):**

```javascript
// 1. Deploy code (profiler starts automatically)
// 2. Wait 100+ ticks for data collection
// 3. View the report anytime
Profiler.output();
// => Detailed performance breakdown

// 4. Data is automatically collected by monitoring workflow
// Check reports/profiler/latest.json
```

**Manual Control:**

```javascript
// 1. Stop automatic collection
Profiler.stop();

// 2. Clear existing data
Profiler.clear();

// 3. Start fresh profiling session
Profiler.start();

// 4. Wait several ticks (e.g., 100-200 ticks)

// 5. View the report
Profiler.output();
```

## Understanding Profiler Output

The profiler generates a tabular report showing performance metrics for each profiled function:

```
Function                              Tot Calls    CPU/Call  Calls/Tick    CPU/Tick   % of Tot
BehaviorController:execute                  280      1.45ms        2.80      4.06ms       45 %
Kernel:run                                  100      2.30ms        1.00      2.30ms       25 %
MemoryManager:pruneMissingCreeps            100      0.15ms        1.00      0.15ms        2 %
MemoryManager:updateRoleBookkeeping         100      0.12ms        1.00      0.12ms        1 %
PerformanceTracker:begin                    100      0.05ms        1.00      0.05ms        1 %
PerformanceTracker:end                      100      0.08ms        1.00      0.08ms        1 %
280 total ticks measured                   9.03 average CPU profiled per tick
```

### Metrics Explained

- **Function**: Class and method name (e.g., `BehaviorController:execute`)
- **Tot Calls**: Total number of times the function was called
- **CPU/Call**: Average CPU consumed per function call
- **Calls/Tick**: Average number of calls per game tick
- **CPU/Tick**: Average CPU consumed by this function per tick
- **% of Tot**: Percentage of total profiled CPU usage

**Interpreting Results:**

1. **High CPU/Tick**: Functions consuming significant CPU per tick (optimization targets)
2. **High Calls/Tick**: Functions called frequently (consider batching or caching)
3. **High CPU/Call**: Expensive individual operations (algorithm optimization opportunity)

## Profiled Modules

The following runtime modules are instrumented with profiling decorators:

### Core Runtime

- **`Kernel`**: Main game loop orchestration
  - `run()`: Overall tick execution

### Behavior System

- **`BehaviorController`**: Creep behavior management
  - `execute()`: Creep processing and spawn orders
  - `ensureRoleMinimums()`: Spawn queue management

### Memory Management

- **`MemoryManager`**: Memory hygiene operations
  - `pruneMissingCreeps()`: Dead creep cleanup
  - `updateRoleBookkeeping()`: Role count tracking

### Performance Monitoring

- **`PerformanceTracker`**: CPU usage tracking
  - `begin()`: Start-of-tick CPU capture
  - `end()`: End-of-tick CPU calculation

- **`StatsCollector`**: Stats data persistence
  - `collect()`: Memory.stats population

## Adding Profiling to New Code

### Class-Level Profiling

Instrument an entire class by decorating the class definition:

```typescript
import { profile } from "@profiler";

@profile
export class MyNewSystem {
  public process(): void {
    // All methods will be automatically profiled
  }
}
```

### Method-Level Profiling

Selectively profile specific methods:

```typescript
import { profile } from "@profiler";

export class MyNewSystem {
  @profile
  public expensiveOperation(): void {
    // Only this method will be profiled
  }

  public cheapOperation(): void {
    // This method is not profiled
  }
}
```

**Best Practices:**

- Profile classes/methods that are likely CPU-intensive
- Avoid profiling trivial getters/setters (minimal overhead but clutters reports)
- Use method-level profiling for granular bottleneck identification
- Profile I/O-heavy operations (pathfinding, room scanning, object queries)

## Integration with Monitoring

### PTR Monitoring

Profiling data is particularly valuable in conjunction with PTR monitoring:

1. **Detection Phase**: PTR monitoring detects high CPU usage (#117, #299, #392)
2. **Analysis Phase**: Enable profiler to identify specific bottlenecks
3. **Optimization Phase**: Target high CPU/Tick functions for refactoring
4. **Validation Phase**: Re-profile to confirm performance improvements

### Automated Monitoring Integration

The **Screeps Monitoring** workflow (`screeps-monitoring.yml`) now automatically collects profiler data:

**Automatic Collection:**

- Workflow fetches `Memory.profiler` data via console every 30 minutes
- Profiler snapshot saved to `reports/profiler/latest.json`
- Data included in monitoring artifacts for historical analysis
- Monitoring agent analyzes profiler data and creates performance issues

**Workflow Trigger:**

```yaml
schedule:
  - cron: "*/30 * * * *" # Every 30 minutes
workflow_run:
  workflows:
    - "Deploy Screeps AI" # After each deployment
```

**What Gets Collected:**

- Profiler status (enabled/disabled/no-data)
- Total ticks profiled
- Top 20 CPU consumers with detailed metrics
- Function-level performance breakdowns
- CPU percentage distribution

**Monitoring Agent Actions:**

When profiler data is available, the monitoring agent will:

1. Identify functions consuming > 20% of total profiled CPU
2. Flag expensive operations (> 1.0ms per call)
3. Detect excessive function calls (> 5x per tick)
4. Create GitHub issues for significant bottlenecks
5. Correlate profiler hotspots with PTR CPU alerts

### Profiler Health Checks

**✨ NEW:** The monitoring workflow now includes automated profiler health validation:

**Health Check Script:** `scripts/check-profiler-health.ts`

**What it validates:**

- ✅ Profiler report exists at `reports/profiler/latest.json`
- ✅ Report is parseable and not corrupted
- ✅ Profiler is enabled and collecting data
- ✅ Data is fresh (< 60 minutes old)
- ✅ Summary statistics are available

**Health Status Levels:**

1. **Healthy** 🟢: Profiler is operational with valid data
   - All checks passing
   - Summary statistics reported
   - Top CPU consumers identified

2. **Warning** 🟡: Profiler has non-critical issues
   - Profiler not running (auto-start should fix on next tick)
   - No data collected yet (wait for 100+ ticks)
   - Stale data (> 60 minutes old, check workflow schedule)

3. **Error** 🔴: Profiler data unavailable
   - Report file missing
   - Fetch failed (check credentials)
   - Data corrupted or unparseable

**Manual Health Check:**

```bash
# Run health check locally
bun run scripts/check-profiler-health.ts

# Expected output when healthy:
# Status: HEALTHY
# Profiler is operational
#
# Details:
#   - Total ticks: 1000
#   - Functions profiled: 15
#   - Avg CPU/tick: 8.50ms
#   - Top consumer: BehaviorController:execute (4.25ms/tick)
```

**Troubleshooting:**

If profiler health check fails:

1. **"Profiler report not found"**
   - Run: `bun run scripts/fetch-profiler-console.ts`
   - Check `SCREEPS_TOKEN` environment variable
   - Verify monitoring workflow is running

2. **"Profiler is not running"**
   - Wait one tick after deployment (auto-start)
   - Or manually: `Profiler.start()` in console

3. **"Profiler has no data yet"**
   - Wait 100+ ticks for meaningful data
   - Check next monitoring cycle (every 30 minutes)

4. **"Data is stale"**
   - Check monitoring workflow schedule
   - Verify workflow is not failing
   - Review GitHub Actions logs

### Performance Evaluation

The profiler complements the existing `SystemEvaluator`:

- **SystemEvaluator**: Aggregate CPU warnings and performance snapshots
- **Profiler**: Function-level execution breakdowns
- **Monitoring Agent**: Automated analysis and issue creation

**Manual Workflow:**

```bash
# 1. Check system evaluation for high CPU warnings
bun run analyze:system

# 2. Deploy (profiler is enabled by default)
bun run deploy

# 3. Run profiling session in Screeps console
Profiler.start()
# ... wait 100-200 ticks ...
Profiler.stop()
Profiler.output()

# 4. Analyze output and optimize bottlenecks

# 5. (Optional) Rebuild without profiler for minimal overhead
bun run build:no-profiler
bun run deploy:no-profiler
```

**Automated Workflow:**

```bash
# 1. Deploy (profiler is enabled by default)
bun run deploy

# 2. Start profiler in console
Profiler.start()

# 3. Wait for monitoring workflow to run (every 30 min)
# Monitoring agent will automatically:
# - Fetch profiler data from Memory.profiler
# - Analyze performance bottlenecks
# - Create issues for CPU-intensive functions
# - Provide optimization recommendations

# 4. Review generated issues with label "monitoring,performance"

# 5. After optimizations, redeploy and verify
bun run deploy
```

## Performance Overhead

The profiler introduces minimal overhead when enabled:

- **Per-Call Overhead**: ~0.01-0.02 CPU per instrumented function call
- **Memory Overhead**: Profiling data stored in `Memory.profiler`
- **Build Impact**: Slightly larger bundle size when enabled

**Recommendations:**

- The profiler is **enabled by default** for continuous monitoring
- Data collection only occurs when `Profiler.start()` is called in console
- Clear profiling data periodically to prevent Memory bloat: `Profiler.clear()`
- For minimal overhead deployments, use `bun run build:no-profiler` to disable

## Troubleshooting

### Profiler Not Available in Console

**Symptom**: `Profiler` is undefined in console

**Solutions**:

1. Verify build was done with profiler enabled (default behavior)
2. Check deployed code includes profiler initialization in `main.ts`
3. Ensure `__PROFILER_ENABLED__` flag was injected during build
4. If you explicitly disabled the profiler with `PROFILER_ENABLED=false`, rebuild without that flag

```bash
# Rebuild and redeploy (profiler enabled by default)
bun run build
bun run deploy
```

### Empty or Minimal Profiling Data

**Symptom**: `Profiler.output()` shows no data or very few entries

**Solutions**:

1. Ensure `Profiler.start()` was called before data collection
2. Wait sufficient ticks (100-200) for meaningful data accumulation
3. Verify profiled classes/methods are actually executing
4. Check that `Memory.profiler` exists and has data

### High Memory Usage

**Symptom**: Profiling data consuming excessive memory

**Solutions**:

1. Run `Profiler.clear()` to reset data after analysis
2. Stop profiling during normal operation: `Profiler.stop()`
3. Limit profiling sessions to diagnostic periods only
4. Consider profiling specific modules rather than entire codebase

## Configuration

### Build-Time Configuration

The profiler is controlled via environment variable (enabled by default):

```bash
# Build with profiler (default)
bun run build

# Disable profiler explicitly
export PROFILER_ENABLED=false
bun run build
# Or use the convenience script
bun run build:no-profiler
```

### Runtime Configuration

The profiler stores data in `Memory.profiler`:

```typescript
interface ProfilerMemory {
  data: { [name: string]: ProfilerData };
  start?: number; // Tick when profiling started
  total: number; // Total ticks profiled
}

interface ProfilerData {
  calls: number; // Total function calls
  time: number; // Total CPU consumed
}
```

**Manual Inspection**:

```javascript
// Check profiling status
Memory.profiler.start;
// => undefined (stopped) or tick number (running)

// View raw profiling data
JSON.stringify(Memory.profiler.data);
```

## Accessing Profiler Reports

### Via GitHub Actions Artifacts

Profiler data is automatically collected and uploaded as workflow artifacts:

1. Navigate to [Actions > Screeps Monitoring](https://github.com/ralphschuler/.screeps-gpt/actions/workflows/screeps-monitoring.yml)
2. Select a workflow run
3. Download the `screeps-monitor-report-XXXXX` artifact
4. Extract and review `reports/profiler/latest.json`

**Snapshot Structure:**

```json
{
  "fetchedAt": "2025-11-05T23:00:00.000Z",
  "source": "console",
  "isEnabled": true,
  "hasData": true,
  "profilerMemory": { ... },
  "summary": {
    "totalTicks": 150,
    "totalFunctions": 12,
    "averageCpuPerTick": 8.45,
    "topCpuConsumers": [
      {
        "name": "BehaviorController:execute",
        "calls": 300,
        "cpuPerCall": 1.45,
        "callsPerTick": 2.0,
        "cpuPerTick": 2.9,
        "percentOfTotal": 34.3
      }
    ]
  }
}
```

### Via Console Commands

For real-time analysis, use console commands:

```javascript
// View profiler status
Profiler.status();

// Get formatted report
Profiler.output();

// Access raw data programmatically
JSON.stringify(Memory.profiler.data);

// Calculate custom metrics
Object.entries(Memory.profiler.data)
  .sort((a, b) => b[1].time - a[1].time)
  .slice(0, 5)
  .map(([name, data]) => ({ name, totalCpu: data.time }));
```

## Related Documentation

- [Performance Optimization Guide](./performance-optimization.md) - Overall performance strategies
- [CPU Monitoring](./stats-monitoring.md) - PTR-based CPU monitoring
- [Stats Collection](./stats-collection.md) - Memory.stats telemetry
- [Screeps Monitoring Workflow](../../.github/workflows/screeps-monitoring.yml) - Automated monitoring configuration

## Advanced Usage

### Selective Profiling Workflow

For targeted performance analysis:

1. **Identify Problem Area**: Use PTR alerts or `analyze:system` to detect high CPU
2. **Enable Profiler**: `PROFILER_ENABLED=true bun run build && bun run deploy`
3. **Short Profiling Session**: Profile 50-100 ticks to minimize overhead
4. **Analyze Results**: Identify top CPU consumers
5. **Disable Profiler**: Rebuild without profiler after analysis

### Profiling During CI/CD

The profiler can be used in regression testing:

```bash
# Run regression tests with profiler enabled
PROFILER_ENABLED=true bun run test:regression

# Or build for e2e testing with profiling
PROFILER_ENABLED=true bun run test:e2e
```

Note: Profiler adds minimal test overhead since it's disabled by default in test environments.

## API Reference

### `Profiler.start()`

Begins profiling data collection. Records the current game tick as the start time.

**Returns**: `string` - "Profiler started"

### `Profiler.stop()`

Pauses profiling data collection. Updates total profiled ticks.

**Returns**: `string` - "Profiler stopped" or "Profiler is not running"

### `Profiler.status()`

Checks current profiling state.

**Returns**: `string` - "Profiler is running" or "Profiler is stopped"

### `Profiler.output()`

Generates and prints detailed profiling report to console.

**Returns**: `string` - "Done"

### `Profiler.clear()`

Resets all profiling data. If profiler is running, restarts data collection from current tick.

**Returns**: `string` - "Profiler Memory cleared"

## Examples

### Example 1: Identifying Behavior Bottleneck

```javascript
// 1. Start profiling
Profiler.start();

// 2. Wait 100 ticks
// ... (in Screeps console, check Game.time)

// 3. Stop and analyze
Profiler.stop();
Profiler.output();

// Output shows:
// BehaviorController:execute    100    2.5ms    1.00    2.5ms    80%
// => BehaviorController is consuming 80% of profiled CPU

// 4. Investigate BehaviorController.execute() method
// 5. Optimize identified bottleneck
```

### Example 2: Continuous Monitoring

```javascript
// Profile over a longer period
Profiler.clear();
Profiler.start();

// Wait 500 ticks for statistically significant data

Profiler.stop();
Profiler.output();

// Analyze aggregate performance across many ticks
```

### Example 3: Comparing Before/After Optimization

```javascript
// Before optimization
Profiler.clear();
Profiler.start();
// ... wait 100 ticks ...
Profiler.stop();
Profiler.output();
// Note: BehaviorController:execute shows 3.0ms CPU/Tick

// After code optimization
Profiler.clear();
Profiler.start();
// ... wait 100 ticks ...
Profiler.stop();
Profiler.output();
// Verify: BehaviorController:execute now shows 1.5ms CPU/Tick
// => 50% improvement!
```

## Summary

The screeps-typescript-profiler is a powerful tool for identifying and resolving CPU bottlenecks in the Screeps runtime. Use it strategically during performance analysis periods, then disable it for optimal production performance.

**Key Takeaways:**

- Profiler is enabled by default for continuous monitoring capability
- Start data collection with `Profiler.start()` during diagnostic periods
- Profile for 100-200 ticks for meaningful data
- Focus optimization on high CPU/Tick functions
- Clear profiling data after analysis with `Profiler.clear()`
- Integrate profiling with existing monitoring workflows
