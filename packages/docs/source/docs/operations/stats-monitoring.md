---
title: PTR Monitoring Pipeline
date: 2025-10-24T23:38:43.767Z
---

# PTR Monitoring Pipeline

The Screeps Monitoring workflow (`screeps-monitoring.yml`) keeps a pulse on Public Test Realm performance through comprehensive autonomous analysis.

## Data Collection

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
