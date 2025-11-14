# PTR Monitoring Pipeline

The Screeps Monitoring workflow (`screeps-monitoring.yml`) keeps a pulse on Public Test Realm performance through comprehensive autonomous analysis.

## Data Collection

### Bot-Side Stats Collection

The Screeps bot collects performance statistics every game tick and stores them in `Memory.stats`. This data is then retrieved by external monitoring systems via the Screeps API.

**Implementation:** [`src/runtime/metrics/StatsCollector.ts`](../../src/runtime/metrics/StatsCollector.ts)

Stats collected include:

- CPU usage (used, limit, bucket)
- Creep count
- Room count and per-room statistics
- Energy availability and capacity
- Controller level and progress
- Spawn throughput

See [Stats Collection Implementation](./stats-collection.md) for detailed documentation.

### Advanced Analytics and HTTP Reporting

**NEW in Phase 5:** The analytics system now supports HTTP POST integration for real-time telemetry export to external monitoring platforms.

**Implementation:** [`src/runtime/metrics/AnalyticsReporter.ts`](../../src/runtime/metrics/AnalyticsReporter.ts)

**Features:**

- **Batch Processing**: Configurable batch sizes for efficient network usage
- **Compression**: Optional payload compression for large datasets
- **Queue Management**: Automatic queue management with failure recovery
- **Flexible Integration**: Compatible with any HTTP endpoint accepting JSON

**Usage Example:**

```typescript
import { AnalyticsReporter } from "@runtime/metrics/AnalyticsReporter";

const reporter = new AnalyticsReporter({
  endpoint: process.env.ANALYTICS_ENDPOINT,
  apiKey: process.env.ANALYTICS_API_KEY,
  batchSize: 10,
  enableCompression: true
});

// Queue stats for batched reporting
reporter.queueReport(Memory.stats, {
  shard: Game.shard?.name,
  user: "your-username",
  version: "1.0.0"
});

// Flush reports immediately if needed
await reporter.flush();
```

**Configuration:**

- `ANALYTICS_ENDPOINT`: HTTP endpoint for stats POST requests
- `ANALYTICS_API_KEY`: Bearer token for authentication (optional)
- `ANALYTICS_BATCH_SIZE`: Number of reports to batch (default: 10)
- `ANALYTICS_COMPRESSION`: Enable payload compression (default: false)

**Supported Platforms:**

- Grafana Cloud with Loki/Prometheus
- Datadog
- New Relic
- Custom endpoints accepting JSON payloads

### API-Side Stats Retrieval

#### Resilient Telemetry Collection

The monitoring system uses a resilient multi-source strategy to ensure comprehensive bot health visibility:

**Primary Script:** [`scripts/fetch-resilient-telemetry.ts`](../../scripts/fetch-resilient-telemetry.ts)

**Collection Strategy:**

1. **Bot Aliveness Check** ([`scripts/check-bot-aliveness.ts`](../../scripts/check-bot-aliveness.ts))
   - Endpoint: `/api/user/world-status`
   - Returns: `"normal"` (active), `"lost"` (needs respawn), or `"empty"` (spawn placement needed)
   - **CRITICAL**: This is the PRIMARY indicator of bot lifecycle health
   - Independent of `Memory.stats` availability
   - Output: `reports/copilot/bot-aliveness.json`

2. **Primary Source: Stats API** ([`scripts/fetch-screeps-stats.mjs`](../../scripts/fetch-screeps-stats.mjs))
   - Endpoint: `/api/user/stats?interval=<value>` (default host `https://screeps.com`)
   - Authentication: `SCREEPS_STATS_TOKEN` (falls back to `SCREEPS_TOKEN`)
   - Interval Parameter: `SCREEPS_STATS_INTERVAL` controls time window:
     - `8` = 1 hour stats
     - `180` = 1 day stats (24 hours, default)
     - `1440` = 1 week stats (7 days)
   - Provides historical performance data from `Memory.stats`
   - Output: `reports/screeps-stats/latest.json`

3. **Fallback Source: Console Telemetry** ([`scripts/fetch-console-telemetry.ts`](../../scripts/fetch-console-telemetry.ts))
   - Activated when Stats API fails or returns empty data
   - Executes console commands to collect real-time bot metrics
   - Eliminates single-point-of-failure dependency
   - Adds metadata: `fallback_activated: true`, `primary_source_failed: true`

**Critical Distinction - Empty Stats vs Bot Failure:**

The aliveness check enables proper diagnosis of monitoring issues:

- **Bot Active + Empty Stats** = Stats collection bug in bot code (not lifecycle failure)
- **Bot Lost/Empty + Empty Stats** = Genuine bot lifecycle issue requiring respawn
- **Bot Active + Stats Available** = Normal operation

This distinction prevents false "bot lifecycle failure" alerts when the bot is executing normally but `Memory.stats` is not populated.

## Copilot Analysis

- Prompt: [`.github/copilot/prompts/screeps-monitor`](../../.github/copilot/prompts/screeps-monitor).
- Behaviour: Copilot performs comprehensive multi-phase analysis:
  - Fetches PTR telemetry using `scripts/fetch-screeps-stats.mjs`
  - Analyzes bot performance via Screeps MCP server (console access, memory, room data)
  - Detects PTR anomalies (CPU >95%, >80%, low energy) with concrete evidence
  - Evaluates repository health (codebase quality, automation effectiveness, development velocity)
  - Makes strategic decisions about priorities and improvements
  - Creates, updates, and closes issues with evidence-based recommendations
  - Strategic issues prefixed with `[Autonomous Monitor]`, PTR anomalies with `PTR:`
  - Executes `scripts/check-ptr-alerts.ts` to send push notifications for critical/high severity alerts
- Duplicates: Copilot searches existing issues using the GitHub MCP server. If an identical alert exists, it comments instead of creating a duplicate.
- MCP Integration: Uses github, screeps-mcp, and screeps-api MCP servers for comprehensive access

## Follow-up Expectations

- Engineers triage newly opened issues promptly and log remediation steps in `CHANGELOG.md`.
- Once the issue is resolved, add a regression test that covers the failure signal whenever possible.
- Update this document if metrics, endpoints, or severity rules change.

## Troubleshooting

### Network Failures vs Empty Responses

The monitoring system distinguishes between two types of PTR telemetry failures:

**Network Failures (Critical Infrastructure):**

- API endpoint completely unreachable
- No HTTP response received
- Creates failure snapshot with `failureType: "network_error"`
- Severity: Critical - requires immediate attention

**Empty Response Pattern:**

- HTTP 200 OK received with empty stats: `{"ok": 1, "stats": {}}`
- Bot not collecting stats or no recent activity
- Severity: Medium - verify bot deployment

See [PTR Infrastructure Failures Guide](./ptr-infrastructure-failures.md) for comprehensive troubleshooting procedures.

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

If the snapshot shows no stats data (`{"ok": 1, "stats": {}}`):

1. **Verify bot is collecting stats**: Check bot deployment and ensure it's running with the StatsCollector integration
2. **Check Memory.stats in console**: Run `JSON.stringify(Memory.stats)` to verify the bot is writing stats
3. **Verify game activity**: Confirm your Screeps account has recent activity on the target server
4. **Check server target**: Verify you're targeting the correct server (PTR vs. official)
5. **Confirm interval parameter**: Ensure the interval parameter matches the expected data range

See [Stats Collection Implementation](./stats-collection.md) for troubleshooting the bot-side stats generation.

### Network Errors and API Unavailability

If the workflow fails with network errors or API unavailability:

1. **Check infrastructure status**: Verify Screeps API is operational
2. **Review failure snapshot**: Check `reports/screeps-stats/latest.json` for error details
3. **Monitor for recovery**: Script includes automatic retry with exponential backoff
4. **Create issue if persistent**: Network failures lasting > 2 hours require investigation

The script automatically creates a failure snapshot when the API is unavailable, including:

- Failure type classification (network error, HTTP error, etc.)
- Timestamp and endpoint information
- Error details for diagnostics
- Alert severity determination

See [PTR Infrastructure Failures Guide](./ptr-infrastructure-failures.md) for detailed troubleshooting and escalation procedures.

## Bot State Snapshots and Analytics

### Overview

The monitoring system automatically collects and archives bot state snapshots, generating a 30-day analytics dashboard for performance visualization.

### Snapshot Collection

**Script:** [`packages/utilities/scripts/collect-bot-snapshot.ts`](../../packages/utilities/scripts/collect-bot-snapshot.ts)

Every 30 minutes, the monitoring workflow captures a snapshot of bot state including:

- **CPU Metrics**: Used CPU, limit, and bucket level
- **Room Statistics**: RCL, energy availability, controller progress
- **Creep Data**: Total count and breakdown by role
- **Spawn Status**: Active spawns and spawn queue

**Storage:**

- Location: `reports/bot-snapshots/`
- Naming: `snapshot-YYYY-MM-DD.json` (one per day)
- Retention: Last 30 snapshots (automatically cleaned up)

### Analytics Generation

**Script:** [`packages/utilities/scripts/generate-analytics.ts`](../../packages/utilities/scripts/generate-analytics.ts)

After each snapshot collection, the system aggregates all snapshots into analytics data:

**Workflow Integration:**

1. Collect snapshot (`collect-bot-snapshot.ts`)
2. Generate analytics (`generate-analytics.ts`)
3. Commit both snapshot and analytics data to repository

**Output:**

- Location: `source/docs/analytics/data.json`
- Format: JSON with time series data points
- Metrics: CPU usage, CPU bucket, creep count, room count, average RCL, total energy

### Visualization

**Page:** [Bot Analytics](https://nyphon.de/.screeps-gpt/docs/analytics.html)

The analytics page provides interactive charts powered by Chart.js:

- **CPU Usage Chart**: Line chart showing CPU consumption over time
- **CPU Bucket Chart**: Tracks CPU bucket level for burst capacity monitoring
- **Creep Count Chart**: Bar chart displaying creep population
- **Room Statistics Chart**: Dual-axis chart with room count and average RCL

**Features:**

- Automatically updates when docs site is published
- Gracefully handles missing data (shows informative messages)
- Responsive design with clear visual legends
- 30-day historical view

### Data Flow

```
Monitoring Workflow (every 30 min)
  ↓
Collect Bot Snapshot
  ↓
Generate Analytics Data
  ↓
Commit to Repository [skip ci]
  ↓
Docs Publishing (on push to main)
  ↓
Analytics Visualization (GitHub Pages)
```

### Testing

The snapshot and analytics system includes comprehensive test coverage:

**Test File:** [`tests/unit/bot-snapshots.test.ts`](../../tests/unit/bot-snapshots.test.ts)

Tests validate:

- Snapshot file creation with date-based naming
- Data extraction from Screeps stats (CPU, rooms, creeps)
- 30-day snapshot retention and cleanup
- Empty stats handling (graceful degradation)
- Analytics data aggregation and formatting

Run tests with:

```bash
bun run test:unit tests/unit/bot-snapshots.test.ts
```
