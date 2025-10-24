# PTR Monitoring Pipeline

The Screeps Stats Monitor workflow (`screeps-stats-monitor.yml`) keeps a pulse on Public Test Realm performance.

## Data Collection

- Script: [`scripts/fetch-screeps-stats.mjs`](../../scripts/fetch-screeps-stats.mjs).
- Endpoint: `/api/user/stats?interval=<value>` (default host `https://screeps.com`). Override with `SCREEPS_STATS_HOST` or
  `SCREEPS_STATS_API` if needed.
- Authentication: `SCREEPS_STATS_TOKEN` (falls back to `SCREEPS_TOKEN`). Store the secret in GitHub Actions settings.
- Interval Parameter: `SCREEPS_STATS_INTERVAL` controls the statistics time window:
  - `8` = 1 hour stats (480 data points at 5-minute intervals)
  - `180` = 1 day stats (24 hours, default)
  - `1440` = 1 week stats (7 days)
- Output: `reports/screeps-stats/latest.json` containing `{ fetchedAt, endpoint, payload }`.

## Copilot Analysis

- Prompt: [`.github/copilot/prompts/stats-analysis.md`](../../.github/copilot/prompts/stats-analysis.md).
- Behaviour: Copilot reads the snapshot, summarises PTR health, and either files labelled issues (`monitoring`, `copilot`, and a
  severity) or explains why no action is required.
- Duplicates: Copilot must search existing issues using the GitHub MCP server. If an identical alert exists, it comments instead
  of creating a duplicate.

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
