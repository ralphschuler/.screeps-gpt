---
title: Multi-Shard Monitoring
date: 2025-11-28
---

# Multi-Shard Monitoring

This document describes the multi-shard discovery and monitoring capabilities that enable comprehensive telemetry collection across all shards where the bot operates.

## Overview

The monitoring infrastructure now automatically discovers all shards where the bot has active rooms before collecting stats and telemetry. This eliminates the need for manual shard configuration when the bot expands to additional shards.

## How It Works

### Shard Discovery

The shard discovery service (`packages/utilities/scripts/lib/shard-discovery.ts`) queries the Screeps API to identify all shards where the bot has rooms:

1. Queries `/api/user/rooms` to get the complete list of rooms across all shards
2. Groups rooms by shard
3. Returns a structured result with shard names and associated rooms
4. Caches results for 5 minutes to reduce API load

### Multi-Shard Stats Collection

The PTR stats collector (`packages/utilities/scripts/collect-ptr-stats.ts`) now:

1. Discovers all active shards using the shard discovery service
2. Iterates through each discovered shard
3. Collects telemetry from each shard using resilient fallback (Stats API → Console API)
4. Aggregates stats from all shards into a unified report
5. Includes per-shard breakdown in the output

### Multi-Shard Snapshots

Bot snapshots (`packages/utilities/scripts/collect-bot-snapshot.ts`) now include:

- List of all discovered shards
- Total room count across shards
- Per-room shard association in room data

## Configuration

No additional configuration is required. The system uses the existing environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `SCREEPS_TOKEN` | API authentication token | Required |
| `SCREEPS_HOST` | Screeps server hostname | `screeps.com` |
| `SCREEPS_SHARD` | Fallback shard if discovery fails | `shard3` |
| `SCREEPS_PROTOCOL` | API protocol | `https` |
| `SCREEPS_PORT` | API port | `443` |

## API Response Format

### Shard Discovery Result

```typescript
interface ShardDiscoveryResult {
  shards: ShardInfo[];
  totalRooms: number;
  discoveredAt: string;
}

interface ShardInfo {
  name: string;
  rooms: string[];
}
```

### PTR Stats with Multi-Shard Support

```typescript
interface PTRStats {
  metadata: {
    collectedAt: string;
    source: "stats_api" | "console" | "none";
    success: boolean;
    error?: string;
    fallbackActivated: boolean;
    shards?: string[];         // List of discovered shards
    totalRooms?: number;       // Total rooms across all shards
  };
  stats: Record<string, unknown> | null;
  shardStats?: ShardStats[];   // Per-shard breakdown
}
```

### Bot Snapshot with Shard Metadata

```typescript
interface BotSnapshot {
  timestamp: string;
  shards?: ShardMetadata[];    // Discovered shards
  totalRooms?: number;         // Total rooms across shards
  rooms?: Record<string, {
    rcl: number;
    energy: number;
    energyCapacity: number;
    shard?: string;            // Shard where room is located
    // ... other fields
  }>;
  // ... other fields
}
```

## Fallback Behavior

If shard discovery fails (API error, network issues, etc.), the system:

1. Logs a warning about the discovery failure
2. Falls back to using the `SCREEPS_SHARD` environment variable
3. Continues collection from the configured default shard
4. Does not fail the entire monitoring cycle

## Caching

The shard discovery service implements caching to reduce API calls:

- Cache duration: 5 minutes
- Cache is automatically invalidated after expiration
- Cache can be manually cleared using `clearShardDiscoveryCache()`
- Cache status can be queried using `getShardDiscoveryCacheStatus()`

## Monitoring Workflow Integration

The `screeps-monitoring.yml` workflow automatically benefits from multi-shard support:

1. **Collect PTR stats** - Now collects from all discovered shards
2. **Collect bot snapshot** - Now includes shard metadata
3. **Analytics generation** - Processes multi-shard data
4. **Health checks** - Validates data across all shards

## Troubleshooting

### No Shards Discovered

If shard discovery returns no shards:

1. Verify `SCREEPS_TOKEN` is valid and not expired
2. Check that the bot has at least one owned room
3. Verify network connectivity to Screeps API
4. Check Screeps server status

### Partial Shard Collection

If some shards fail while others succeed:

1. Check the `shardStats` array in PTR stats output
2. Look for per-shard errors in the `error` field
3. The system continues collecting from available shards
4. Overall success is reported if at least one shard succeeds

### Cache Issues

To force a fresh discovery:

1. Wait for cache expiration (5 minutes)
2. Or call `clearShardDiscoveryCache()` programmatically
3. Or restart the monitoring workflow

## Related Files

- `packages/utilities/scripts/lib/shard-discovery.ts` - Shard discovery service
- `packages/utilities/scripts/collect-ptr-stats.ts` - Multi-shard stats collection
- `packages/utilities/scripts/collect-bot-snapshot.ts` - Multi-shard snapshots
- `packages/utilities/scripts/fetch-resilient-telemetry.ts` - Per-shard telemetry with fallback
- `packages/utilities/scripts/types/bot-snapshot.ts` - Snapshot type definitions

## See Also

- [Stats Collection](./stats-collection.md)
- [Stats Monitoring](./stats-monitoring.md)
- [Troubleshooting Telemetry](./troubleshooting-telemetry.md)
