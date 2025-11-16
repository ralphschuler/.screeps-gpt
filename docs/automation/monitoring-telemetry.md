# Monitoring Telemetry System

## Overview

The monitoring telemetry system provides resilient, multi-source data collection for bot state tracking, performance analysis, and autonomous improvement validation. This system implements a three-tier fallback strategy to ensure ≥95% telemetry collection success rate.

## Architecture

### Data Collection Flow

```
Monitoring Workflow → PTR Stats Collection → Resilient Telemetry
                                                      ↓
                            ┌─────────────────────────┼─────────────────────────┐
                            │                         │                         │
                      Stats API              Console Telemetry          Failure Snapshot
                      (Primary)                 (Fallback)
                            │                         │                         │
                            └─────────────────────────┼─────────────────────────┘
                                                      ↓
                                            PTR Stats + Metadata
                                                      ↓
                                            Bot Snapshot Collection
                                                      ↓
                                            Telemetry Health Check
```

## Components

### 1. PTR Stats Collection

**Script**: `packages/utilities/scripts/collect-ptr-stats.ts`

Orchestrates resilient telemetry collection and saves to `reports/copilot/ptr-stats.json`.

**Output Format**:

```json
{
  "metadata": {
    "collectedAt": "2025-11-16T08:00:00.000Z",
    "source": "stats_api|console|none",
    "success": true,
    "fallbackActivated": false
  },
  "stats": {
    /* game stats data */
  }
}
```

### 2. Multi-Source Fallback Strategy

**Script**: `packages/utilities/scripts/fetch-resilient-telemetry.ts`

Three-tier fallback:

1. **Primary**: Stats API via Memory.stats (`/api/user/stats`)
2. **Fallback**: Console telemetry (5 chunked queries)
3. **Failure**: Comprehensive error snapshot

### 3. Console Telemetry

**Script**: `packages/utilities/scripts/fetch-console-telemetry.ts`

Collects real-time data via chunked console commands:

- Tick & CPU metrics
- GCL progress
- Room statistics (RCL, energy)
- Creep counts by role
- Resource totals

**Features**:

- Expression size validation
- Retry logic (3 attempts, exponential backoff)
- Includes game tick field

### 4. Bot Snapshot Collection

**Script**: `packages/utilities/scripts/collect-bot-snapshot.ts`

Creates daily snapshots with complete game state:

- Timestamp & tick
- CPU (used, limit, bucket)
- Rooms (RCL, energy, controller progress)
- Creeps (total, by role)
- Spawns (total, active)

**Output**: `reports/bot-snapshots/snapshot-YYYY-MM-DD.json`

### 5. Telemetry Health Check

**Script**: `packages/utilities/scripts/telemetry-health-check.ts`

Validates telemetry quality:

**Checks**:

- Snapshot completeness (required fields present)
- PTR stats completeness (metadata + data)
- Freshness (≤30 minutes)
- Success rate calculation

**Health Levels**:

- Healthy: ≥95%
- Degraded: 75-94%
- Critical: <75%

## Environment Variables

```bash
SCREEPS_TOKEN      # Authentication token (required)
SCREEPS_HOST       # Server hostname (default: screeps.com)
SCREEPS_SHARD      # Shard name (default: shard3)
SCREEPS_PORT       # Server port (optional)
SCREEPS_PROTOCOL   # Protocol (default: https)
```

## Monitoring Workflow

Workflow runs every 30 minutes via cron:

1. **PTR Stats Collection** - Multi-source telemetry
2. **Bot Snapshot** - Daily state snapshot
3. **Health Validation** - Quality checks
4. **Analytics** - Generate insights
5. **Alerts** - Notify on issues

## File Locations

```
reports/
├── copilot/
│   └── ptr-stats.json          # PTR stats with metadata
├── screeps-stats/
│   └── latest.json             # Raw API/console data
├── bot-snapshots/
│   └── snapshot-YYYY-MM-DD.json # Daily snapshots
└── monitoring/
    ├── health.json             # Health status
    └── baselines.json          # Performance baselines
```

## Usage

### Collect PTR Stats

```bash
npx tsx packages/utilities/scripts/collect-ptr-stats.ts
```

### Check Health

```bash
npx tsx packages/utilities/scripts/telemetry-health-check.ts
```

### Collect Snapshot

```bash
npx tsx packages/utilities/scripts/collect-bot-snapshot.ts
```

## Metrics & Targets

| Metric                  | Target  | Current    |
| ----------------------- | ------- | ---------- |
| Collection Success Rate | ≥95%    | Monitoring |
| Data Freshness          | ≤30 min | Monitoring |
| Fallback Activation     | <10%    | Acceptable |

## Troubleshooting

See [Troubleshooting Telemetry](../operations/troubleshooting-telemetry.md) for detailed guidance.

**Common Issues**:

- Timestamp-only snapshots → Check Stats API availability
- Collection failures → Verify SCREEPS_TOKEN
- Stale data → Check workflow execution
- Critical health → Review fallback logs

## Related Documentation

- [Troubleshooting Telemetry](../operations/troubleshooting-telemetry.md)
- [Monitoring Baselines](../operations/monitoring-baselines.md)
- [Stats Collection](../../packages/docs/docs/operations/stats-collection.md)
