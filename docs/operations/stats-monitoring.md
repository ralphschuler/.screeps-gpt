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

### API-Side Stats Retrieval

- Script: [`scripts/fetch-screeps-stats.mjs`](../../scripts/fetch-screeps-stats.mjs).
- Endpoint: `/api/user/stats?interval=<value>` (default host `https://screeps.com`). Override with `SCREEPS_STATS_HOST` or
  `SCREEPS_STATS_API` if needed.
- Authentication: `SCREEPS_STATS_TOKEN` (falls back to `SCREEPS_TOKEN`). Store the secret in GitHub Actions settings.
- Interval Parameter: `SCREEPS_STATS_INTERVAL` controls the statistics time window:
  - `8` = 1 hour stats
  - `180` = 1 day stats (24 hours, default)
  - `1440` = 1 week stats (7 days)
- Output: `reports/screeps-stats/latest.json` containing `{ fetchedAt, endpoint, payload }`.

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
