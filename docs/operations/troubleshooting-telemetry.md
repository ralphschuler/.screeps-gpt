# Troubleshooting Telemetry Collection

## Overview

This operational runbook provides step-by-step troubleshooting procedures for telemetry collection issues. Use this guide when monitoring workflows fail or data quality degrades.

## Quick Diagnostics

### Run Health Check

```bash
npx tsx packages/utilities/scripts/telemetry-health-check.ts
```

This command validates:

- Snapshot completeness
- PTR stats health
- Data freshness
- Overall success rate

### Expected Healthy Output

```
=== Health Report ===
Overall Health: HEALTHY
Success Rate: 100.0%

Recommendations:
  1. All telemetry health checks passed ✓
```

## Common Issues

### Issue 1: Timestamp-Only Snapshots

**Symptoms**:

- Bot snapshots contain only `{"timestamp": "..."}`
- No game state data (CPU, rooms, creeps)
- Health check shows incomplete snapshot

**Root Causes**:

1. Stats API unavailable
2. Console fallback failed
3. Invalid SCREEPS_TOKEN

**Diagnosis**:

```bash
# Check PTR stats source
cat reports/copilot/ptr-stats.json | grep "source"

# Check for error messages
cat reports/copilot/ptr-stats.json | grep "error"

# Test Stats API manually
curl -H "X-Token: $SCREEPS_TOKEN" \
  https://screeps.com/api/user/stats?interval=180
```

**Resolution Steps**:

1. **Verify Token**:

   ```bash
   echo $SCREEPS_TOKEN  # Should be non-empty
   ```

2. **Test Console Fallback**:

   ```bash
   npx tsx packages/utilities/scripts/fetch-console-telemetry.ts
   ```

3. **Check Workflow Logs**:
   - Navigate to Actions → Screeps Monitoring
   - Review "Collect PTR stats" step
   - Look for error messages

4. **Update Token** (if expired):
   - Regenerate token in Screeps account settings
   - Update GitHub secret `SCREEPS_TOKEN`

### Issue 2: PTR Stats Collection Failure

**Symptoms**:

- `ptr-stats.json` shows `"success": false`
- `metadata.source` is `"none"`
- Health check critical status

**Root Causes**:

1. All telemetry sources failed
2. Network connectivity issues
3. Authentication failure

**Diagnosis**:

```bash
# Check failure details
cat reports/copilot/ptr-stats.json | jq '.metadata'

# Test network connectivity
curl -I https://screeps.com

# Verify credentials
curl -H "X-Token: $SCREEPS_TOKEN" https://screeps.com/api/user/me
```

**Resolution Steps**:

1. **Check Error Message**:

   ```bash
   cat reports/copilot/ptr-stats.json | jq '.metadata.error'
   ```

2. **Test Each Source**:

   ```bash
   # Test Stats API
   npx tsx packages/utilities/scripts/fetch-screeps-stats.mjs

   # Test Console
   npx tsx packages/utilities/scripts/fetch-console-telemetry.ts
   ```

3. **Verify Environment**:

   ```bash
   # Required variables
   echo $SCREEPS_TOKEN
   echo $SCREEPS_HOST
   echo $SCREEPS_SHARD
   ```

4. **Manual Collection**:
   ```bash
   # Run full collection manually
   npx tsx packages/utilities/scripts/collect-ptr-stats.ts
   ```

### Issue 3: Stale Telemetry Data

**Symptoms**:

- Health check reports data >30 minutes old
- Monitoring workflow not updating files
- Analytics showing old data

**Root Causes**:

1. Workflow not running (cron issue)
2. Collection step failing silently
3. Workflow concurrency conflict
4. GitHub Actions quota exceeded

**Diagnosis**:

```bash
# Check file ages
ls -lh reports/bot-snapshots/
ls -lh reports/copilot/ptr-stats.json

# Check workflow schedule
cat .github/workflows/screeps-monitoring.yml | grep "cron"

# Check recent runs
gh run list --workflow=screeps-monitoring.yml --limit 5
```

**Resolution Steps**:

1. **Verify Workflow Status**:
   - Go to Actions → Screeps Monitoring
   - Check last run time
   - Review run status (success/failure)

2. **Check Cron Schedule**:

   ```yaml
   # Should run every 30 minutes
   schedule:
     - cron: "*/30 * * * *"
   ```

3. **Manual Trigger**:
   - Go to Actions → Screeps Monitoring
   - Click "Run workflow" → "Run workflow"

4. **Review Logs**:
   - Check for `continue-on-error: true` hiding failures
   - Look for timeout errors
   - Check for rate limiting

### Issue 4: Critical Health Status

**Symptoms**:

- Health check reports <75% success rate
- Multiple components failing
- Persistent data quality issues

**Root Causes**:

1. Infrastructure outage (Stats API down)
2. Token expiration
3. Network connectivity problems
4. Workflow configuration error

**Diagnosis**:

```bash
# Full health report
npx tsx packages/utilities/scripts/telemetry-health-check.ts

# Check all sources
npx tsx packages/utilities/scripts/fetch-resilient-telemetry.ts

# Review recommendations
npx tsx packages/utilities/scripts/telemetry-health-check.ts 2>&1 | \
  grep -A 20 "Recommendations"
```

**Resolution Steps**:

1. **Follow Health Recommendations**:
   - Health check provides specific guidance
   - Address each recommendation in order

2. **Check Screeps Status**:
   - Visit https://status.screeps.com
   - Check for known outages
   - Review maintenance schedules

3. **Validate Configuration**:

   ```bash
   # Check workflow syntax
   yamllint .github/workflows/screeps-monitoring.yml

   # Validate environment secrets
   gh secret list
   ```

4. **Escalate If Needed**:
   - If all sources consistently fail
   - If Screeps infrastructure is down
   - Open issue with diagnostic information

### Issue 5: Bot Aliveness Check JSON Parse Error

**Symptoms**:

- Bot aliveness check fails with "undefined" is not valid JSON error
- Script exits with error code 2 (unknown status)
- Lifecycle detection blocked (respawn/spawn-placement-needed states)
- Monitoring reports "FAILING" status despite bot being active

**Root Causes**:

1. Screeps console API returns "undefined" string when bot has no game presence
2. Empty response from `/api/user/console` endpoint
3. Malformed JSON response from console command
4. Network timeout or authentication failure

**Diagnosis**:

```bash
# Check bot aliveness status
cat reports/copilot/bot-aliveness.json

# Look for parsing errors in workflow logs
gh run view --log | grep "JSON parse"

# Test aliveness check manually
SCREEPS_TOKEN=$SCREEPS_TOKEN \
SCREEPS_SHARD=shard3 \
npx tsx packages/utilities/scripts/check-bot-aliveness.ts
```

**Resolution Steps**:

1. **Check Raw Response**:
   - Script now logs first 200 chars of raw response
   - Look for "undefined", empty string, or malformed JSON
   - Review console command output format

2. **Verify Bot Game Presence**:

   ```bash
   # Check if bot has spawns
   cat reports/copilot/bot-aliveness.json | jq '.aliveness'

   # Expected values:
   # - "active": Bot has spawns and is executing
   # - "respawn_needed": Bot has rooms but no spawns
   # - "spawn_placement_needed": Bot needs to place spawn
   # - "unknown": Unable to determine status
   ```

3. **Review Error Details**:

   ```bash
   # Check error reason
   cat reports/copilot/bot-aliveness.json | jq '.error'

   # Common errors:
   # - "Console returned empty response": API returned undefined/empty
   # - "JSON parse error": Malformed response
   # - "Console command failed": API returned ok: 0
   ```

4. **Validate Environment**:

   ```bash
   # Ensure token is valid
   echo $SCREEPS_TOKEN

   # Test console access
   curl -X POST https://screeps.com/api/user/console \
     -H "X-Token: $SCREEPS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"expression":"Game.time","shard":"shard3"}'
   ```

**Defensive Parsing (Implemented)**:

The script now handles edge cases gracefully:

- **Empty/undefined responses**: Returns `spawn_placement_needed` status
- **Malformed JSON**: Returns `unknown` status with parse error details
- **Non-object responses**: Returns `spawn_placement_needed` with invalid structure error
- **API failures**: Returns `unknown` status with API error message

**Expected Behavior**:

```json
{
  "timestamp": "2025-11-16T22:00:00.000Z",
  "aliveness": "active",
  "status": "normal",
  "error": null,
  "interpretation": {
    "active": "Bot is executing game logic and has active spawns"
  }
}
```

**Fallback Strategy**:

When aliveness check fails, monitoring workflow should:

1. Check `bot-aliveness.json` for error details
2. Fall back to Memory.stats collection as secondary indicator
3. Report lifecycle state as "unknown" but continue monitoring
4. Alert if both aliveness check and Memory.stats fail

### Issue 6: High Fallback Rate

**Symptoms**:

- PTR stats consistently show `"fallbackActivated": true`
- Primary Stats API rarely used
- Console telemetry as primary source

**Root Causes**:

1. Stats API intermittent failures
2. Memory.stats not being written
3. Runtime StatsCollector issues

**Diagnosis**:

```bash
# Check fallback pattern
for file in reports/copilot/ptr-stats-*.json; do
  echo "$file: $(cat $file | jq '.metadata.source')";
done

# Check Memory.stats in runtime
# (requires game console access)
# Game console: JSON.stringify(Memory.stats)
```

**Resolution Steps**:

1. **Verify Runtime Stats Collection**:
   - Check kernel initialization (lines 113-122)
   - Review StatsCollector diagnostic logs
   - Ensure Memory.stats is written every tick

2. **Test Stats API Directly**:

   ```bash
   # Should return recent stats
   curl -H "X-Token: $SCREEPS_TOKEN" \
     https://screeps.com/api/user/stats?interval=8
   ```

3. **Review StatsCollector**:
   - Check for errors in game console
   - Verify CPU budget allows stats collection
   - Check diagnostic logging output

4. **Accept Gracefully**:
   - If Stats API is consistently unavailable
   - Console fallback is working as designed
   - Monitor for Screeps infrastructure fixes

## Preventive Maintenance

### Weekly Checks

- Review telemetry health check output
- Monitor fallback activation rate
- Check for stale data warnings
- Validate workflow execution schedule

### Monthly Tasks

- Rotate SCREEPS_TOKEN (security best practice)
- Review workflow logs for patterns
- Update baseline metrics
- Test manual collection procedures

### Quarterly Reviews

- Audit telemetry success rate trends
- Review and update troubleshooting procedures
- Validate backup strategies
- Test disaster recovery procedures

## Monitoring Commands

### Health Status

```bash
npx tsx packages/utilities/scripts/telemetry-health-check.ts
```

### Manual Collection

```bash
# Full collection
npx tsx packages/utilities/scripts/collect-ptr-stats.ts

# Snapshot only
npx tsx packages/utilities/scripts/collect-bot-snapshot.ts

# Console fallback
npx tsx packages/utilities/scripts/fetch-console-telemetry.ts
```

### Data Validation

```bash
# Check snapshot completeness
cat reports/bot-snapshots/snapshot-$(date +%Y-%m-%d).json | \
  jq 'keys'

# Check PTR stats metadata
cat reports/copilot/ptr-stats.json | jq '.metadata'

# Validate data freshness
stat -c %y reports/copilot/ptr-stats.json
```

## Escalation Criteria

Escalate to development team when:

1. **All sources fail** for >2 hours
2. **Critical health** persists for >24 hours
3. **Workflow consistently fails** (>3 consecutive runs)
4. **Data corruption** detected (invalid JSON, missing required fields)
5. **Screeps infrastructure** issues affecting multiple users

## Escalation Information

When opening an issue, include:

```bash
# Collect diagnostics
{
  echo "=== Health Check ==="
  npx tsx packages/utilities/scripts/telemetry-health-check.ts

  echo -e "\n=== PTR Stats Metadata ==="
  cat reports/copilot/ptr-stats.json | jq '.metadata'

  echo -e "\n=== Recent Workflow Runs ==="
  gh run list --workflow=screeps-monitoring.yml --limit 5

  echo -e "\n=== File Status ==="
  ls -lh reports/copilot/ptr-stats.json
  ls -lh reports/bot-snapshots/ | tail -5

  echo -e "\n=== Environment ==="
  echo "SCREEPS_HOST: ${SCREEPS_HOST:-<not set>}"
  echo "SCREEPS_SHARD: ${SCREEPS_SHARD:-<not set>}"
} > telemetry-diagnostics.txt
```

## Related Documentation

- [Monitoring Telemetry](../automation/monitoring-telemetry.md)
- [Monitoring Baselines](./monitoring-baselines.md)
- [Stats Collection](../../packages/docs/docs/operations/stats-collection.md)

## References

- **Scripts**: `packages/utilities/scripts/`
- **Tests**: `tests/regression/monitoring/`
- **Workflow**: `.github/workflows/screeps-monitoring.yml`
