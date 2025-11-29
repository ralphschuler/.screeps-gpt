---
title: PTR Monitoring Pipeline
date: 2025-10-24T23:38:43.767Z
---

# PTR Monitoring Pipeline

The Screeps Monitoring workflow (`screeps-monitoring.yml`) keeps a pulse on Public Test Realm performance through comprehensive autonomous analysis.

## Data Collection

### Primary Stats Collection

The workflow uses a resilient multi-source telemetry collection strategy:

1. **Primary**: Stats API via `scripts/fetch-screeps-stats.mjs`
   - Endpoint: `/api/user/memory?path=stats&shard=<shard>` (fetches `Memory.stats`)
   - Falls back to Memory API when Stats API is unavailable
2. **Fallback**: Console telemetry via `scripts/fetch-console-telemetry.ts`
   - Direct bot console queries when API sources fail
3. **Orchestration**: `scripts/collect-ptr-stats.ts` coordinates collection and saves to `reports/copilot/ptr-stats.json`

### Output Files

| File | Description | Committed |
|------|-------------|-----------|
| `reports/copilot/ptr-stats.json` | PTR stats with metadata and source info | ✓ |
| `reports/screeps-stats/latest.json` | Raw stats from API or console | ✓ |
| `reports/profiler/latest.json` | CPU profiler data | ✓ |
| `reports/bot-snapshots/snapshot-YYYY-MM-DD.json` | Daily bot state snapshots | ✓ |
| `reports/monitoring/baselines.json` | Performance baselines | ✓ |
| `reports/monitoring/health.json` | Bot health status | ✓ |

### Report Storage Policy

All reports in `reports/` are tracked in version control to maintain historical analysis data. This includes:

**Tracked directories:**

- `reports/bot-snapshots/` - Daily performance snapshots
- `reports/monitoring/` - Strategic analysis and health monitoring
- `reports/copilot/` - Copilot workflow analysis artifacts
- `reports/performance/` - Performance test results and baselines
- `reports/deployments/` - Deployment history and rollback data
- `reports/evaluations/` - System evaluation reports
- `reports/profiler/` - Profiler data and CPU tracking
- `reports/ptr-stats/` - PTR telemetry and stats
- `reports/screeps-stats/` - Screeps game stats
- `reports/room-analysis/` - Room layout and efficiency analysis
- `reports/game-constants/` - Cached game constant reference data

**Excluded directories (binary/large files):**

- `reports/video-frames/` - Frame images for video rendering
- `reports/videos/` - Rendered video files
- `reports/replay-data/` - Raw replay data files

### Stats Data Structure

The bot populates `Memory.stats` via `StatsCollector.ts` with the following metrics:

```typescript
Memory.stats = {
  time: number,           // Game tick
  cpu: {
    used: number,         // CPU used this tick
    limit: number,        // CPU limit
    bucket: number        // CPU bucket level
  },
  creeps: {
    count: number,        // Total creep count
    byRole?: Record<string, number>  // Creeps by role
  },
  rooms: {
    count: number,        // Controlled room count
    [roomName]: {         // Per-room stats
      energyAvailable: number,
      energyCapacityAvailable: number,
      controllerLevel?: number,
      controllerProgress?: number,
      controllerProgressTotal?: number,
      energyStored?: number,
      constructionSites?: number
    }
  },
  memory?: { used: number },           // Memory usage in bytes
  structures?: { ... },                // Structure counts
  constructionSites?: { count, byType },
  spawns?: number,
  activeSpawns?: number,
  health?: { ... }                     // Health metrics from HealthProcess
};
```

### Authentication

- `SCREEPS_TOKEN`: Primary authentication token (required)
- `SCREEPS_HOST`: Server hostname (default: `screeps.com`)
- `SCREEPS_SHARD`: Target shard (default: `shard3`)

Store secrets in GitHub Actions repository settings.

## Copilot Analysis

- Prompt: [`.github/copilot/prompts/screeps-monitor`](../../.github/copilot/prompts/screeps-monitor).
- Behaviour: Copilot performs comprehensive multi-phase analysis:
  - Fetches PTR telemetry using `scripts/fetch-screeps-stats.mjs`
  - Analyzes bot performance via Screeps MCP server (console access, memory, room data)
  - Detects PTR anomalies (CPU >95%, >80%, low energy) with concrete evidence
  - **Controller Health Monitoring**: Tracks downgrade timers across all rooms
    - Critical alerts for < 12 hours to downgrade
    - Warning alerts for < 24 hours to downgrade
    - Info logging for < 48 hours to downgrade
  - Evaluates repository health (codebase quality, automation effectiveness, development velocity)
  - Makes strategic decisions about priorities and improvements
  - Creates, updates, and closes issues with evidence-based recommendations
  - Strategic issues prefixed with `[Autonomous Monitor]`, PTR anomalies with `PTR:`
  - Executes `scripts/check-ptr-alerts.ts` to send push notifications and email alerts for critical/high severity issues
- Duplicates: Copilot searches existing issues using the GitHub MCP server. If an identical alert exists, it comments instead of creating a duplicate.
- MCP Integration: Uses github, screeps-mcp, and screeps-api MCP servers for comprehensive access

## Controller Health Monitoring

The workflow includes automated controller downgrade detection to prevent room loss incidents:

### Alert Thresholds

- **Critical (< 12 hours)**: Email + push notification sent immediately
- **Warning (< 24 hours)**: Email + push notification for attention needed
- **Info (< 48 hours)**: Logged for monitoring awareness

### Metrics Collected

- `ticksToDowngrade`: Actual downgrade timer from game state via console telemetry
- `controllerProgress`: Current progress toward next RCL
- `upgraderCount`: Number of active upgrader creeps per room
- `energyAvailable`: Energy immediately available for upgrading
- `RCL`: Room Control Level

### Email Notifications

Critical and warning controller alerts include:

- Room name and RCL
- Time remaining until downgrade (hours and ticks)
- Controller progress percentage
- Upgrader count and energy availability
- Direct link to workflow run for investigation

### Manual Check

Run the controller health check manually:

```bash
yarn tsx packages/utilities/scripts/check-controller-health.ts
```

Exit codes:
- `0`: All healthy or info-level only
- `1`: Warning alerts detected
- `2`: Critical alerts detected

## Follow-up Expectations

- Engineers triage newly opened issues promptly and log remediation steps in `CHANGELOG.md`.
- Once the issue is resolved, add a regression test that covers the failure signal whenever possible.
- Update this document if metrics, endpoints, or severity rules change.

## Troubleshooting

### "invalid params" Error

If the workflow fails with an "invalid params" error from the Screeps API:

1. **Check interval parameter**: Ensure `SCREEPS_STATS_INTERVAL` (if set) is one of: `8`, `180`, or `1440`
2. **Verify authentication**: Confirm `SCREEPS_TOKEN` or `SCREEPS_STATS_TOKEN` is valid and not expired
3. **Review API endpoint**: Ensure the endpoint URL is correct (should include `?interval=<value>`)

The script includes retry logic with exponential backoff (3 attempts) for transient failures.

### Authentication Failures

If authentication fails (401/403 errors):

1. Regenerate your Screeps auth token at https://screeps.com/a/#!/account/auth-tokens
2. Update the `SCREEPS_TOKEN` or `SCREEPS_STATS_TOKEN` secret in GitHub repository settings
3. Verify the token has the necessary permissions to access user stats

### No Data Available

If the snapshot shows no stats data:

1. Check that your Screeps account has recent activity on the target server
2. Verify you're targeting the correct server (PTR vs. official)
3. Confirm the interval parameter matches the expected data range

## Performance Baselines

Performance baselines are automatically established when sufficient data is collected.

### Requirements

- Minimum 48 snapshots (24-48 hours at 30-minute intervals)
- Snapshots must contain valid performance data (CPU, rooms, creeps)

### Baseline Metrics

Once established, baselines track:

- **CPU Usage**: Mean, std deviation, 95th percentile, warning/critical thresholds
- **CPU Bucket**: Mean, trend rate, warning/critical thresholds
- **Energy**: Per-room income, total storage, accumulation rate
- **Creeps**: Total count and per-role counts with thresholds
- **Spawn Uptime**: Percentage of time spawns are active
- **RCL Progress**: Rate of controller level progression

### Manual Establishment

To manually establish or re-establish baselines:

```bash
# Check if enough data exists
npx tsx packages/utilities/scripts/check-baseline-readiness.ts

# Establish baselines (requires 48+ snapshots)
npx tsx packages/utilities/scripts/establish-baselines.ts
```

## Profiler Data Collection

The profiler collects function-level CPU usage data for optimization analysis.

### Enabling Profiler

The profiler is automatically enabled when:

1. Bot is built with `PROFILER_ENABLED=true`
2. Bot completes first tick (initializes `Memory.profiler`)
3. `Profiler.start()` is called (auto-started by main loop)

### Profiler Output

`reports/profiler/latest.json` contains:

```typescript
{
  fetchedAt: string,
  source: "console",
  isEnabled: boolean,
  hasData: boolean,
  profilerMemory?: {
    data: Record<string, { time: number, calls: number }>,
    total: number,
    start?: number
  },
  summary?: {
    totalTicks: number,
    totalFunctions: number,
    averageCpuPerTick: number,
    topCpuConsumers: Array<{
      name: string,
      cpuPerTick: number,
      percentOfTotal: number
    }>
  }
}
```

### Manual Profiler Commands

Run these in the Screeps console:

```javascript
// Start profiler
Profiler.start()

// Stop profiler
Profiler.stop()

// Get profiler output
Profiler.output(10)  // Top 10 CPU consumers
```
