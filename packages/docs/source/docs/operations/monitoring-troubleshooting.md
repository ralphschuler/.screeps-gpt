# Monitoring Troubleshooting Guide

This guide helps diagnose and resolve issues with the Screeps monitoring system, including bot snapshot collection, telemetry gathering, and health checks.

## Common Issues

### Bot Snapshots Show 0 Creeps Despite Active Bot

**Symptoms:**
- Health monitoring shows bot is "operational"
- Bot snapshots consistently show `creeps: { total: 0 }`
- User confirms bot is running with active creeps

**Root Causes:**

1. **Multi-Shard Data Collection Issue**
   - The bot is running on multiple shards but monitoring only collects from one
   - Shard discovery returns empty rooms list despite rooms being claimed
   - Console telemetry not querying all active shards

2. **Bot Runtime Not Exporting Stats**
   - `StatsCollector` not running or disabled
   - Memory.stats not being populated with creep data
   - Runtime errors preventing stats export

3. **Actual Spawn Failure**
   - Bot truly has 0 creeps due to spawn system failure
   - Workforce collapse not yet detected by health monitoring
   - Emergency spawn logic not triggering

**Diagnostic Steps:**

1. **Check Shard Discovery**
   ```bash
   npx tsx packages/utilities/scripts/lib/shard-discovery.ts
   ```
   Expected output: List of shards with room counts
   
   If discovery fails or returns 0 rooms:
   - Verify `SCREEPS_TOKEN` has correct permissions
   - Check `/api/user/rooms` endpoint accessibility
   - Confirm bot actually has claimed rooms on MMO/PTR

2. **Check Console Telemetry**
   ```bash
   SCREEPS_SHARD=shard3 npx tsx packages/utilities/scripts/fetch-console-telemetry.ts
   ```
   Expected output: Tick, CPU, rooms, and creep counts
   
   If telemetry fails:
   - Verify bot code is deployed and running
   - Check console API permissions
   - Confirm no syntax errors preventing bot execution

3. **Check Stats API Data**
   ```bash
   cat reports/screeps-stats/latest.json
   ```
   Look for `creeps.count` field
   
   If stats show 0 creeps:
   - Bot runtime may not be exporting data
   - Check `Memory.stats` in game console
   - Verify `StatsCollector` is initialized in main loop

4. **Verify Snapshot Collection Logs**
   - Check GitHub Actions workflow logs for `Collect bot state snapshot` step
   - Look for validation errors or warnings
   - Confirm multi-shard collection attempted

**Resolution:**

For multi-shard issues:
- Snapshot collection now uses console API for all shards
- Ensure `SCREEPS_TOKEN` has permission for all shards
- Verify shard discovery returns correct room list

For runtime export issues:
- Check `packages/bot/src/main.ts` initializes `StatsCollector`
- Enable diagnostic logging: `Memory.experimentalFeatures.statsDebug = true`
- Verify no runtime errors in game console

For actual spawn failures:
- See [Spawn System Troubleshooting](./spawn-troubleshooting.md)
- Check for CPU timeout or bucket depletion
- Review emergency spawn logic

### Snapshot Validation Failures

**Symptoms:**
- Workflow fails with "Snapshot validation failed" error
- Logs show "CRITICAL" validation errors
- Monitoring workflow stops committing snapshots

**Validation Rules:**

1. **Critical Errors (Fatal)**:
   - No substantive data (only timestamp)
   - Claimed rooms but 0 creeps detected (after 12+ hours)

2. **Warnings (Non-Fatal)**:
   - CPU bucket critically low (< 100)
   - Data identical to previous snapshot for 12+ hours
   - Shard discovery incomplete

**Resolution:**

For "no substantive data" errors:
- Both Stats API and Console API failed
- Check bot deployment status
- Verify API token permissions
- Check for API outages

For "0 creeps despite claimed rooms" errors:
- Likely spawn system failure or multi-shard collection issue
- Run diagnostic steps above to identify root cause
- May indicate actual emergency requiring manual intervention

For non-fatal warnings:
- Snapshots still committed but flagged
- Monitor for trends (repeated warnings may indicate issues)
- Low bucket warnings may precede CPU timeout

### Stale Data Detection

**Symptoms:**
- Snapshots show identical data across multiple days
- Controller progress not advancing
- Creep counts unchanged for extended periods

**Diagnostic Approach:**

1. **Check Data Timestamps**
   ```bash
   jq '.timestamp' reports/bot-snapshots/snapshot-*.json | tail -3
   ```
   Confirm timestamps are recent and advancing

2. **Compare Consecutive Snapshots**
   ```bash
   diff <(jq -S '.' reports/bot-snapshots/snapshot-2025-11-28.json) \
        <(jq -S '.' reports/bot-snapshots/snapshot-2025-11-29.json)
   ```
   Should show differences in tick, CPU, controller progress

3. **Verify Bot Activity**
   - Check game console for recent activity
   - Confirm CPU usage is not zero
   - Verify creeps are moving/working

**Resolution:**

If data is truly stale:
- Bot may have stopped running (check health monitoring)
- API caching may be returning old data (rare)
- Monitoring workflow may not be running (check schedule)

If bot is active but data appears stale:
- Multi-shard collection may be missing active shard
- Console API may be querying wrong shard
- Stats export may be broken

## Validation Error Reference

### CRITICAL: X room(s) claimed but 0 creeps detected

**Meaning**: Bot has claimed rooms but no creeps exist, indicating spawn failure or incomplete data collection.

**Actions**:
1. Verify bot is actually running on all shards
2. Check spawn system status
3. Review multi-shard discovery results
4. Confirm console telemetry collected from all shards

**Workflow Behavior**: Fails workflow (no snapshot committed)

### Data appears stale: identical to snapshot from X hours ago

**Meaning**: Snapshot data hasn't changed in 12+ hours, suggesting stale data or inactive bot.

**Actions**:
1. Check bot activity in game
2. Verify monitoring workflow is running on schedule
3. Confirm API endpoints are returning fresh data

**Workflow Behavior**: Warning only (snapshot still committed)

### CPU metrics are all zero

**Meaning**: CPU used, limit, and bucket all reported as 0, indicating data collection failure.

**Actions**:
1. Verify Stats API and Console API connectivity
2. Check bot deployment status
3. Confirm API token permissions

**Workflow Behavior**: Warning only (snapshot still committed)

### WARNING: CPU bucket critically low (X)

**Meaning**: CPU bucket below 100, bot at risk of CPU timeout.

**Actions**:
1. Monitor for CPU optimization opportunities
2. Check for infinite loops or inefficient code
3. Review recent deployments for performance regressions

**Workflow Behavior**: Warning only (snapshot still committed)

### Shard discovery found 0 rooms but snapshot has X room(s)

**Meaning**: Shard discovery incomplete but stats API returned room data (inconsistency).

**Actions**:
1. Verify shard discovery permissions
2. Check `/api/user/rooms` endpoint
3. Confirm bot has claimed rooms

**Workflow Behavior**: Warning only (snapshot still committed)

## Multi-Shard Collection Architecture

**Data Sources**:

1. **Shard Discovery** (`lib/shard-discovery.ts`)
   - Queries `/api/user/rooms` for all bot-controlled shards
   - Returns list of shards with room names
   - Cached for 5 minutes to reduce API calls

2. **Console Telemetry** (`fetch-console-telemetry.ts`)
   - Executes console commands per shard to get live data
   - Queries: CPU, GCL, rooms, creeps, resources
   - Can target specific shard via `SCREEPS_SHARD` env var

3. **Stats API** (Fallback)
   - Reads `Memory.stats` from bot runtime
   - Only works for single shard (where Memory is stored)
   - Used as fallback if console API fails

**Collection Flow**:

1. Discover all shards where bot has rooms
2. For each shard:
   - Query console API for telemetry
   - Aggregate rooms, creeps, CPU data
3. Merge multi-shard data into single snapshot
4. Validate snapshot quality
5. Commit if validation passes

**Limitations**:

- Console API has rate limits (handled with retries)
- Shard discovery requires `/api/user/rooms` permission
- CPU/bucket data uses latest tick across all shards (may differ per shard)

## Monitoring Workflow Steps

The `screeps-monitoring.yml` workflow executes these steps:

1. **Collect PTR stats** - Fetch stats from Memory.stats
2. **Collect bot snapshot** - Multi-shard snapshot with validation
3. **Validate telemetry health** - Check data quality and freshness
4. **Generate analytics** - Compute trends and recommendations
5. **Check baseline readiness** - Determine if baselines can be established
6. **Establish baselines** - Set performance thresholds (if ready)
7. **Profiler data collection** - Fetch CPU profiler data
8. **Bot health check** - Ping bot and validate operational status
9. **Check PTR alerts** - Detect critical issues
10. **Commit snapshots** - Save validated data to repository

Each step has `continue-on-error: true` to ensure workflow completes even if individual steps fail.

## Related Documentation

- [Monitoring Operations](./monitoring.md) - Overview of monitoring system
- [Shard Discovery](./shard-discovery.md) - Multi-shard discovery implementation
- [Health Monitoring](./health-monitoring.md) - Bot aliveness and health checks
- [Spawn Troubleshooting](./spawn-troubleshooting.md) - Spawn system diagnostics

## Support

If issues persist after following this guide:

1. Check GitHub Actions workflow logs for detailed error messages
2. Review recent PRs for monitoring system changes
3. Open an issue with:
   - Workflow run URL
   - Relevant log excerpts
   - Recent snapshot contents
   - Expected vs actual behavior
