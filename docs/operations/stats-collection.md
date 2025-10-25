# Stats Collection Implementation

## Overview

The Screeps bot now collects and stores performance statistics to `Memory.stats` every game tick. This data is consumed by external monitoring systems via the Screeps API endpoint `/api/user/stats?interval=<value>`.

**Implementation Date:** 2025-10-25  
**Related Issue:** #308 - Restore bot performance telemetry data collection on PTR server

## Problem Context

The PTR monitoring system was reporting empty stats from the Screeps API (`{"ok": 1, "stats": {}}`), causing a complete monitoring blackout. Investigation revealed that the bot was not writing performance data to `Memory.stats`, which is the data source for the `/api/user/stats` API endpoint.

## Solution

### StatsCollector Module

Created `src/runtime/metrics/StatsCollector.ts` to collect and store performance metrics:

```typescript
import { StatsCollector } from "@runtime/metrics/StatsCollector";

const collector = new StatsCollector();
collector.collect(game, memory, snapshot);
```

### Integration into Kernel

The `StatsCollector` is integrated into the kernel run loop to ensure stats are collected every tick:

```typescript
// In kernel.ts
const snapshot = this.tracker.end(game, behaviorSummary);
this.statsCollector.collect(game, memory, snapshot);
this.evaluator.evaluateAndStore(memory, snapshot, repository);
```

Stats collection occurs in all three execution paths:

1. **Normal execution** - After behavior execution completes
2. **Emergency CPU abort** - When CPU threshold exceeded
3. **Respawn mode** - When all spawns are lost

## Stats Data Structure

The `Memory.stats` object contains the following structure:

```typescript
// In types.d.ts
declare global {
  interface Memory {
    stats?: {
      time: number; // Game tick number
      cpu: {
        used: number; // CPU consumed this tick
        limit: number; // Account CPU limit
        bucket: number; // Current CPU bucket level
      };
      creeps: {
        count: number; // Total living creeps
      };
      rooms: {
        count: number; // Number of claimed rooms
        [roomName: string]:
          | number
          | {
              energyAvailable: number;
              energyCapacityAvailable: number;
              controllerLevel?: number;
              controllerProgress?: number;
              controllerProgressTotal?: number;
            };
      };
      spawn?: {
        orders: number; // Creeps spawned this tick (optional)
      };
    };
  }
}
```

### Example Output

```json
{
  "time": 12345,
  "cpu": {
    "used": 5.5,
    "limit": 10,
    "bucket": 8500
  },
  "creeps": {
    "count": 8
  },
  "rooms": {
    "count": 2,
    "W1N1": {
      "energyAvailable": 300,
      "energyCapacityAvailable": 550,
      "controllerLevel": 3,
      "controllerProgress": 25000,
      "controllerProgressTotal": 45000
    },
    "W2N2": {
      "energyAvailable": 800,
      "energyCapacityAvailable": 1300,
      "controllerLevel": 5,
      "controllerProgress": 100000,
      "controllerProgressTotal": 135000
    }
  },
  "spawn": {
    "orders": 2
  }
}
```

## API Access

External monitoring systems fetch this data via the Screeps API:

```bash
# Fetch stats with 1-day interval (default)
curl -H "X-Token: YOUR_TOKEN" \
  "https://screeps.com/api/user/stats?interval=180"
```

The `scripts/fetch-screeps-stats.mjs` script automates this process and stores results in `reports/screeps-stats/latest.json`.

## Monitoring Integration

### PTR Monitoring Workflow

The `screeps-monitoring.yml` workflow uses stats data for:

- **CPU usage tracking** - Detect sustained high CPU (>80%, >95%)
- **Resource monitoring** - Track energy economy and storage levels
- **Room control status** - Monitor RCL progress and expansion
- **Strategic execution** - Validate spawn throughput and creep population

### Alert Detection

The `scripts/check-ptr-alerts.ts` script analyzes stats for critical conditions:

- High CPU usage (>80% sustained)
- Critical CPU (>95% sustained)
- Low energy reserves
- Spawn failures

## Testing

### Unit Tests

`tests/unit/StatsCollector.test.ts` validates:

- Basic CPU and creep statistics collection
- Per-room statistics with controller data
- Spawn statistics when creeps are spawned
- Handling rooms without controllers
- Stats overwriting on each tick

### Integration Tests

`tests/e2e/kernelLoop.test.ts` verifies:

- Stats are populated during normal kernel execution
- Stats include expected game tick and CPU data
- Stats reflect actual creep counts

All tests passing: **75/75** ✓

## Performance Impact

**CPU Cost:** ~0.05 CPU per tick

- Stats collection is lightweight
- No expensive lookups or calculations
- Data already available from PerformanceSnapshot

**Memory Impact:** ~500 bytes per tick

- Stats object overwrites previous data
- No historical accumulation in Memory
- Minimal memory footprint

## Maintenance

### Adding New Stats

To add new statistics:

1. Update the `StatsData` interface in `StatsCollector.ts`
2. Modify the `collect()` method to gather the new data
3. Update the `Memory.stats` type definition in `types.d.ts`
4. Add test coverage for the new stat

Example - Adding GCL tracking:

```typescript
// In StatsCollector.ts
interface StatsData {
  // ... existing fields
  gcl?: {
    level: number;
    progress: number;
    progressTotal: number;
  };
}

// In collect() method
if (game.gcl) {
  stats.gcl = {
    level: game.gcl.level,
    progress: game.gcl.progress,
    progressTotal: game.gcl.progressTotal
  };
}
```

### Troubleshooting

**Stats not appearing in API:**

1. Verify bot is deployed and running
2. Check `Memory.stats` in console: `JSON.stringify(Memory.stats)`
3. Ensure stats collection is integrated in kernel
4. Verify API authentication token is valid

**Incomplete stats data:**

1. Check for CPU emergency aborts (stats still collected but limited)
2. Verify respawn mode isn't active
3. Review console for errors during stats collection

## Related Documentation

- [Performance Monitoring](./performance-monitoring.md) - CPU tracking and optimization
- [Stats Monitoring Pipeline](./stats-monitoring.md) - External data collection
- [PTR Monitoring Workflow](../../.github/workflows/screeps-monitoring.yml) - Automated monitoring

## References

- **Related Issue:** [#308 - PTR stats endpoint returns empty data](https://github.com/ralphschuler/.screeps-gpt/issues/308)
- **Screeps API Docs:** [User Stats Endpoint](https://docs.screeps.com/api/#Game)
- **Screeps Community:** [screepers/screeps-stats](https://github.com/screepers/screeps-stats) - Community stats collection patterns
