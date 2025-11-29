---
title: PTR Stats Schema Reference
date: 2025-11-29T12:00:00.000Z
layout: page
---

# PTR Stats Schema Reference

This document provides the complete schema documentation for PTR (Public Test Realm) stats files, enabling strategic planning agents and automation systems to consume telemetry data for performance validation and analysis.

## Overview

PTR stats collection provides comprehensive telemetry data for:

- **Performance validation** - Validate optimization impact before production
- **Trend analysis** - Track 7-day and 30-day performance trends
- **Data-driven planning** - Enable autonomous performance optimization
- **Regression detection** - Alert on performance degradation

## Data Files Location

| File | Description | Update Frequency |
|------|-------------|------------------|
| `reports/copilot/ptr-stats.json` | Aggregated PTR stats from all shards | Every 30 minutes |
| `reports/screeps-stats/latest.json` | Raw Memory.stats export | Every 30 minutes |
| `reports/profiler/latest.json` | CPU profiler snapshot | Every 30 minutes |
| `reports/monitoring/historical-trends.json` | 7-day and 30-day trend analysis | Every 30 minutes |
| `reports/monitoring/baselines.json` | Performance baselines | On demand |
| `reports/bot-snapshots/*.json` | Daily bot state snapshots | Daily |

## PTR Stats Schema (`reports/copilot/ptr-stats.json`)

```typescript
interface PTRStats {
  metadata: {
    /** ISO 8601 timestamp when stats were collected */
    collectedAt: string;
    /** Data source: "stats_api", "console", or "none" */
    source: "stats_api" | "console" | "none";
    /** Whether collection succeeded */
    success: boolean;
    /** Error message if collection failed */
    error?: string;
    /** Whether console fallback was activated */
    fallbackActivated: boolean;
    /** List of shards where bot has rooms */
    shards?: string[];
    /** Total rooms across all shards */
    totalRooms?: number;
  };
  /** Aggregated stats by shard name */
  stats: Record<string, ShardStats> | null;
  /** Per-shard collection details */
  shardStats?: ShardStatsEntry[];
  /** Raw data if no processed stats available */
  raw?: unknown;
}

interface ShardStats {
  latest: {
    /** Game tick when stats were recorded */
    time: number;
    cpu: {
      /** CPU used in the tick (ms) */
      used: number;
      /** CPU limit for the tick */
      limit: number;
      /** Current CPU bucket level (0-10000) */
      bucket: number;
    };
    creeps: {
      /** Total creep count */
      count: number;
      /** Creeps by role name */
      byRole?: Record<string, number>;
    };
    rooms: {
      /** Number of controlled rooms */
      count: number;
      /** Per-room stats indexed by room name */
      [roomName: string]: RoomStats | number;
    };
    memory?: {
      /** Memory usage in bytes */
      used: number;
    };
    structures?: {
      containers?: number;
      roads?: number;
      towers?: number;
      extensions?: number;
      spawns?: number;
    };
    spawns?: number;
    activeSpawns?: number;
    health?: {
      score: number;
      state: string;
      workforce: number;
      energy: number;
      spawn: number;
      infrastructure: number;
      warningCount: number;
      recoveryMode: string;
    };
  };
}

interface RoomStats {
  /** Energy available for spawning */
  energyAvailable: number;
  /** Maximum energy capacity */
  energyCapacityAvailable: number;
  /** Room Control Level (1-8) */
  controllerLevel: number;
  /** Progress points toward next RCL */
  controllerProgress: number;
  /** Total points required for next RCL */
  controllerProgressTotal: number;
}
```

## Historical Trends Schema (`reports/monitoring/historical-trends.json`)

```typescript
interface HistoricalTrendReport {
  /** ISO 8601 timestamp when analysis was performed */
  generatedAt: string;
  /** Number of snapshots analyzed */
  snapshotsAnalyzed: number;
  periods: {
    sevenDay: PeriodTrend;
    thirtyDay: PeriodTrend;
  };
  /** Overall health assessment */
  overallHealth: "healthy" | "warning" | "critical";
  /** Recommended actions */
  recommendations: string[];
  /** Active alerts */
  alerts: TrendAlert[];
}

interface PeriodTrend {
  period: string;
  days: number;
  dataPointCount: number;
  dateRange: {
    start: string;
    end: string;
  };
  cpu: {
    used: MetricTrend | null;
    bucket: MetricTrend | null;
    bucketHealth: "healthy" | "warning" | "critical";
  };
  creeps: {
    total: MetricTrend | null;
  };
  rooms: {
    count: MetricTrend | null;
    averageRcl: MetricTrend | null;
    totalProgress: MetricTrend | null;
  };
  energy: {
    total: MetricTrend | null;
    perRoom: MetricTrend | null;
  };
  memory: {
    used: MetricTrend | null;
    usedPercent: MetricTrend | null;
  };
  spawns: {
    utilization: MetricTrend | null;
  };
  regressions: string[];
  improvements: string[];
}

interface MetricTrend {
  /** Current period average value */
  current: number;
  /** Previous period average value */
  previous: number;
  /** Absolute change (current - previous) */
  change: number;
  /** Percentage change */
  changePercent: number;
  /** Trend direction */
  trend: "increasing" | "decreasing" | "stable";
  /** Whether this constitutes a regression */
  isRegression: boolean;
}

interface TrendAlert {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  metric: string;
}
```

## Profiler Schema (`reports/profiler/latest.json`)

```typescript
interface ProfilerSnapshot {
  /** ISO 8601 timestamp when data was fetched */
  fetchedAt: string;
  /** Data source identifier */
  source: string;
  /** Whether profiler is currently running */
  isEnabled: boolean;
  /** Whether profiler has collected data */
  hasData: boolean;
  /** Raw profiler memory if available */
  profilerMemory?: ProfilerMemory;
  /** Calculated summary if data available */
  summary?: ProfilerSummary;
  /** Error message if collection failed */
  error?: string;
}

interface ProfilerSummary {
  /** Total ticks profiled */
  totalTicks: number;
  /** Number of functions profiled */
  totalFunctions: number;
  /** Average CPU used per tick */
  averageCpuPerTick: number;
  /** Top CPU consumers sorted by usage */
  topCpuConsumers: FunctionProfile[];
}

interface FunctionProfile {
  /** Function name */
  name: string;
  /** Total call count */
  calls: number;
  /** Average CPU per call */
  cpuPerCall: number;
  /** Average calls per tick */
  callsPerTick: number;
  /** Average CPU per tick for this function */
  cpuPerTick: number;
  /** Percentage of total CPU */
  percentOfTotal: number;
}
```

## Regression Detection Thresholds

The historical trend analysis uses these thresholds to detect regressions:

| Metric | Warning Threshold | Critical Threshold |
|--------|-------------------|-------------------|
| CPU Used | +10% increase | - |
| CPU Bucket | < 5000 | < 1000 |
| Creep Count | -20% decrease | - |
| Energy Reserves | -30% decrease | - |
| Memory Usage | +20% increase | - |

## Strategic Planning Agent Integration

### Consuming PTR Stats

```typescript
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadPTRStats(): PTRStats | null {
  const path = resolve("reports", "copilot", "ptr-stats.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

function loadHistoricalTrends(): HistoricalTrendReport | null {
  const path = resolve("reports", "monitoring", "historical-trends.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

// Example: Check for performance regressions
const trends = loadHistoricalTrends();
if (trends?.overallHealth === "critical") {
  console.log("Critical alerts:", trends.alerts);
  console.log("Recommendations:", trends.recommendations);
}
```

### Key Metrics for Optimization Decisions

| Metric | Good Value | Action Trigger |
|--------|-----------|----------------|
| `cpu.bucket` | > 9000 | < 5000: Optimize CPU usage |
| `cpu.used` | < 50% of limit | > 80%: Review hot functions |
| `creeps.total` | Stable or growing | -20%: Check spawn logic |
| `memory.usedPercent` | < 50% | > 80%: Prune memory |
| Profiler hotspots | < 5ms/tick each | > 5ms: Optimize function |

### Automated Issue Creation

When alerts are detected, the system can create GitHub issues:

```typescript
if (trends.alerts.some(a => a.severity === "critical")) {
  // Create issue for critical regression
  // Include affected metrics, recommendations, and links to profiler data
}
```

## Related Documentation

- [Analytics Documentation](./index.md)
- [Operations Monitoring](../operations/stats-monitoring.md)
- [Performance Monitoring](../runtime/operations/performance-monitoring.md)
- [Automation Overview](../automation/overview.md)

## Data Collection Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                 screeps-monitoring.yml (every 30min)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │ collect-ptr-    │    │ collect-bot-    │                    │
│  │ stats.ts        │    │ snapshot.ts     │                    │
│  └────────┬────────┘    └────────┬────────┘                    │
│           │                      │                              │
│           ▼                      ▼                              │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │ ptr-stats.json  │    │ snapshot-*.json │                    │
│  └────────┬────────┘    └────────┬────────┘                    │
│           │                      │                              │
│           └──────────┬───────────┘                              │
│                      ▼                                          │
│           ┌─────────────────────┐                               │
│           │ analyze-historical- │                               │
│           │ trends.ts           │                               │
│           └────────┬────────────┘                               │
│                    ▼                                            │
│           ┌─────────────────────┐                               │
│           │ historical-         │                               │
│           │ trends.json         │                               │
│           └────────┬────────────┘                               │
│                    ▼                                            │
│           ┌─────────────────────┐                               │
│           │ check-ptr-          │──► Push/Email Alerts          │
│           │ alerts.ts           │                               │
│           └─────────────────────┘                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
