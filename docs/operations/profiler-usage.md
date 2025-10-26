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

### Enable Profiler

The profiler is controlled via the `PROFILER_ENABLED` environment variable during build:

```bash
# Build with profiler enabled
bun run build:profiler

# Or set environment variable directly
PROFILER_ENABLED=true bun run build

# Deploy with profiler enabled
bun run deploy:profiler
```

By default, the profiler is **disabled** to minimize production overhead.

### Console Commands

Once deployed with profiler enabled, access these commands in the Screeps console:

```javascript
// Start profiling
Profiler.start();

// Stop profiling (pauses data collection)
Profiler.stop();

// Check profiler status
Profiler.status();

// Output profiling report
Profiler.output();

// Clear profiling data
Profiler.clear();
```

### Example Profiling Session

```javascript
// 1. Start profiling
Profiler.start();
// => "Profiler started"

// 2. Wait several ticks (e.g., 100-200 ticks) for meaningful data

// 3. Stop profiling
Profiler.stop();
// => "Profiler stopped"

// 4. View the report
Profiler.output();
// => Detailed performance breakdown (see below)
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

### Performance Evaluation

The profiler complements the existing `SystemEvaluator`:

- **SystemEvaluator**: Aggregate CPU warnings and performance snapshots
- **Profiler**: Function-level execution breakdowns

**Workflow:**

```bash
# 1. Check system evaluation for high CPU warnings
bun run analyze:system

# 2. If CPU usage is high, deploy with profiler
bun run deploy:profiler

# 3. Run profiling session in Screeps console
Profiler.start()
# ... wait 100-200 ticks ...
Profiler.stop()
Profiler.output()

# 4. Analyze output and optimize bottlenecks

# 5. Rebuild without profiler for production
bun run build
bun run deploy
```

## Performance Overhead

The profiler introduces minimal overhead when enabled:

- **Per-Call Overhead**: ~0.01-0.02 CPU per instrumented function call
- **Memory Overhead**: Profiling data stored in `Memory.profiler`
- **Build Impact**: Slightly larger bundle size when enabled

**Recommendations:**

- Use profiler **only** during performance analysis periods
- Disable profiler in production builds for maximum efficiency
- Clear profiling data periodically to prevent Memory bloat

## Troubleshooting

### Profiler Not Available in Console

**Symptom**: `Profiler` is undefined in console

**Solutions**:

1. Verify build was done with `PROFILER_ENABLED=true`
2. Check deployed code includes profiler initialization in `main.ts`
3. Ensure `__PROFILER_ENABLED__` flag was injected during build

```bash
# Rebuild and redeploy with profiler enabled
PROFILER_ENABLED=true bun run build
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

The profiler is controlled via environment variable:

```bash
# Enable profiler in build
export PROFILER_ENABLED=true
bun run build

# Disable profiler (default)
export PROFILER_ENABLED=false
bun run build
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

## Related Documentation

- [Performance Optimization Guide](./performance-optimization.md) - Overall performance strategies
- [CPU Monitoring](./stats-monitoring.md) - PTR-based CPU monitoring
- [Stats Collection](./stats-collection.md) - Memory.stats telemetry

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

- Enable profiler only during diagnostic periods
- Profile for 100-200 ticks for meaningful data
- Focus optimization on high CPU/Tick functions
- Clear profiling data after analysis
- Integrate profiling with existing monitoring workflows
