# Profiler Usage Guide

This guide covers the Screeps profiler functionality, including how to use it, the memory retention policy, and external archival.

## Overview

The profiler is a CPU performance monitoring tool that tracks the execution time of decorated functions. It stores data in `Memory.profiler` and provides console commands for analysis.

## Enabling the Profiler

The profiler is enabled at build time via the `PROFILER_ENABLED` environment variable:

```bash
# Build with profiler enabled (default)
yarn build

# Build without profiler
yarn build:no-profiler
```

The profiler auto-starts on the first tick when enabled. You can verify its status via the Screeps console:

```javascript
Profiler.status()  // Returns "Profiler is running" or "Profiler is stopped"
```

## Console Commands

Access the profiler through the `Profiler` global in the Screeps console:

| Command | Description |
|---------|-------------|
| `Profiler.start()` | Start collecting profiler data |
| `Profiler.stop()` | Stop collecting data |
| `Profiler.status()` | Check if profiler is running |
| `Profiler.output()` | Print CPU usage summary to console |
| `Profiler.clear()` | Clear all collected data |

## Memory Retention Policy

To prevent unbounded memory growth, the profiler implements a retention policy that limits the number of tracked functions.

### Configuration

```typescript
// packages/bot/src/main.ts
const MAX_PROFILER_ENTRIES = 500;          // Max function entries to retain
const PROFILER_RETENTION_INTERVAL = 100;   // Run policy every 100 ticks
```

### How It Works

1. **Periodic Check**: Every 100 ticks, the retention policy checks `Memory.profiler.data`
2. **Entry Count**: If entries exceed `MAX_PROFILER_ENTRIES` (500), pruning occurs
3. **Priority Retention**: Entries are sorted by total CPU time (descending)
4. **Pruning**: The least significant entries (lowest CPU time) are removed
5. **Logging**: Pruning events are logged: `"Profiler retention: pruned N entries, kept 500"`

### Why 500 Entries?

- Typical bot has 100-300 profiled functions
- 500 entries provide ample room for all significant functions
- Prevents memory bloat during extended operation (24+ hours)
- Minimizes serialization overhead per tick

## External Archival

The monitoring workflow archives profiler data every 30 minutes to preserve historical data while keeping Memory lean.

### Archive Script

```bash
# Manual archival
yarn tsx packages/utilities/scripts/archive-profiler-data.ts

# Skip clearing (archive only)
SKIP_PROFILER_CLEAR=true yarn tsx packages/utilities/scripts/archive-profiler-data.ts
```

### Archive Location

Archives are stored in `reports/profiler/`:

```
reports/profiler/
├── latest.json           # Most recent snapshot (for health checks)
├── archive-index.json    # Index of all archives
├── archive-2024-01-15T12-30-00.json
├── archive-2024-01-15T13-00-00.json
└── ...
```

### Archive Contents

Each archive contains:

```json
{
  "fetchedAt": "2024-01-15T12:30:00.000Z",
  "source": "console-archive",
  "isEnabled": true,
  "hasData": true,
  "profilerMemory": {
    "data": { ... },
    "start": 12345678,
    "total": 5000
  },
  "summary": {
    "totalTicks": 5000,
    "totalFunctions": 250,
    "averageCpuPerTick": 8.5,
    "topCpuConsumers": [ ... ]
  }
}
```

## Monitoring Integration

The `screeps-monitoring.yml` workflow includes profiler management:

1. **Ensure Running**: `ensure-profiler-running.ts` - Verify profiler is active
2. **Fetch Data**: `fetch-profiler-console.ts` - Get current profiler data
3. **Archive Data**: `archive-profiler-data.ts` - Save and clear profiler data
4. **Health Check**: `check-profiler-health.ts` - Validate profiler status

## Health Check

The profiler health check (`check-profiler-health.ts`) reports:

- **healthy**: Profiler running, has data, data is fresh (<1 hour)
- **warning**: Profiler stopped, no data, or stale data
- **error**: Report missing, parse failure, or fetch error

## Troubleshooting

### Profiler Not Running

```javascript
// In console
Profiler.start()
```

Or wait for the next deployment - auto-start is enabled by default.

### High Memory Usage

The retention policy should prevent this. If you see excessive `Memory.profiler` size:

1. Check if retention policy is running (look for log messages)
2. Manually clear: `Profiler.clear()` followed by `Profiler.start()`
3. Wait for next monitoring workflow archival

### Missing Historical Data

Check `reports/profiler/archive-index.json` for archive history. Archives are uploaded as workflow artifacts with 30-day retention.

## Best Practices

1. **Let it run**: Leave profiler enabled for continuous monitoring
2. **Check periodically**: Use `Profiler.output()` to review CPU hotspots
3. **Archive before analysis**: Archive data before major performance optimization
4. **Don't over-decorate**: Profile only significant functions to reduce overhead

## Related Documentation

- [Monitoring Baselines](monitoring-baselines.md) - Performance baseline management
- [Stats Monitoring](stats-monitoring.md) - General metrics monitoring
- [Troubleshooting Telemetry](troubleshooting-telemetry.md) - Debugging telemetry issues

## Related Issues

- [#1490](https://github.com/ralphschuler/.screeps-gpt/issues/1490) - Profiler memory retention policy implementation
