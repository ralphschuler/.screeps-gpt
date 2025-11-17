# Profiler Enablement Verification

## Overview

This guide provides step-by-step verification procedures to confirm that the profiler data collection is properly enabled and functioning in production.

## Prerequisites

- Profiler must be enabled in build (`PROFILER_ENABLED=true`, default)
- Code must be deployed to production
- Monitoring workflow must have valid `SCREEPS_TOKEN` secret
- Console access to Screeps server (optional, for manual verification)

## Automated Verification

The monitoring workflow (`screeps-monitoring.yml`) automatically ensures profiler is enabled:

### Workflow Steps

1. **Ensure Profiler Running** (Step added in this issue)
   - Checks if profiler is initialized and running
   - Starts profiler via console if not already running
   - Acts as backup to auto-start feature in main.ts

2. **Fetch Profiler Data**
   - Retrieves `Memory.profiler` data via console command
   - Saves snapshot to `reports/profiler/latest.json`

3. **Validate Profiler Health**
   - Checks data freshness (< 60 minutes)
   - Validates profiler is collecting data
   - Reports warnings or errors

### Monitoring Schedule

- **Frequency**: Every 30 minutes (cron: `*/30 * * * *`)
- **Also runs**: After each deployment (workflow_run trigger)
- **Manual trigger**: Via workflow_dispatch

## Manual Verification

### Step 1: Verify Build Configuration

Check that profiler is enabled during deployment:

```bash
# In deploy.yml workflow, confirm:
PROFILER_ENABLED: ${{ vars.PROFILER_ENABLED || 'true' }}

# If vars.PROFILER_ENABLED is not set, it defaults to 'true'
```

### Step 2: Verify Auto-Start Feature

After deployment, the profiler should auto-start on first tick:

```javascript
// In Screeps console, check profiler status
Profiler.status();
// Expected: "Profiler is running"

// Check when it started
Memory.profiler.start;
// Expected: tick number (e.g., 12345)
```

### Step 3: Verify Data Collection

Wait 50-100 ticks, then check if data is being collected:

```javascript
// Check data structure
Object.keys(Memory.profiler.data).length;
// Expected: > 0 (number of profiled functions)

// View total profiled ticks
Memory.profiler.total;
// Expected: number of ticks since start

// Get sample function data
Memory.profiler.data["BehaviorController:execute"];
// Expected: { calls: N, time: X.XX }
```

### Step 4: Verify Monitoring Integration

Check that monitoring workflow collected profiler data:

1. Navigate to [GitHub Actions → Screeps Monitoring](https://github.com/ralphschuler/.screeps-gpt/actions/workflows/screeps-monitoring.yml)
2. Select latest workflow run
3. Check "Ensure profiler is running" step logs:
   - Should show "✓ Profiler is already running" (if auto-start worked)
   - Or "✓ Profiler started successfully" (if backup start was needed)
4. Check "Fetch profiler data from console" step logs:
   - Should show "✓ Profiler data fetched successfully"
   - Should report total ticks, functions, and active status
5. Download workflow artifact `screeps-monitor-report-XXXXX`
6. Extract and inspect `reports/profiler/latest.json`:

```json
{
  "fetchedAt": "2025-11-17T14:00:00.000Z",
  "source": "console",
  "isEnabled": true,      // ✓ Profiler running
  "hasData": true,        // ✓ Data collected
  "profilerMemory": {...},
  "summary": {
    "totalTicks": 150,
    "totalFunctions": 12,
    "averageCpuPerTick": 8.45
  }
}
```

### Step 5: Verify Health Check

The profiler health check validates data quality:

```bash
# Run locally (if you have access to reports/profiler/latest.json)
npx tsx packages/utilities/scripts/check-profiler-health.ts

# Expected output when healthy:
# Status: HEALTHY
# Profiler is operational
# Details:
#   - Total ticks: 1000
#   - Functions profiled: 15
#   - Avg CPU/tick: 8.50ms
```

## Troubleshooting

### Issue: Profiler Status Shows "Profiler is stopped"

**Cause**: Auto-start didn't work or profiler was manually stopped

**Solution**:

1. Check deployment logs for "[Profiler] Auto-started profiler data collection"
2. Wait for next monitoring cycle (runs every 30 min)
3. Or manually start: `Profiler.start()` in console

### Issue: "Profiler not available" Error

**Cause**: Code built with `PROFILER_ENABLED=false`

**Solution**:

1. Check deploy.yml workflow env:
   ```yaml
   PROFILER_ENABLED: ${{ vars.PROFILER_ENABLED || 'true' }}
   ```
2. Verify no override in repository variables
3. Redeploy with profiler enabled:
   ```bash
   PROFILER_ENABLED=true bun run deploy
   ```

### Issue: No Data in Memory.profiler.data

**Cause**: Not enough ticks have passed or no profiled functions executed

**Solution**:

1. Check `Memory.profiler.start` is defined (profiler running)
2. Wait 100+ ticks for meaningful data
3. Verify profiled decorators are on executed functions
4. Check that `__PROFILER_ENABLED__` is true in deployed code

### Issue: Health Check Reports "Data is stale"

**Cause**: Monitoring workflow not running on schedule

**Solution**:

1. Check GitHub Actions workflow runs
2. Verify workflow is not disabled
3. Check for API rate limits or token expiry
4. Manually trigger workflow via workflow_dispatch

### Issue: Console Command Fails

**Cause**: Invalid `SCREEPS_TOKEN` or network issues

**Solution**:

1. Verify `SCREEPS_TOKEN` secret is set correctly
2. Check token has not expired
3. Verify network connectivity to Screeps server
4. Check `SCREEPS_HOST` matches your server (screeps.com or private server)

## Success Criteria Validation

Use this checklist to confirm profiler enablement is complete:

- [ ] **Build Configuration**: `PROFILER_ENABLED=true` in deploy.yml
- [ ] **Auto-Start Feature**: Code includes auto-start logic in main.ts
- [ ] **Console Backup**: Monitoring workflow ensures profiler is running
- [ ] **Data Collection**: `reports/profiler/latest.json` exists with valid data
- [ ] **Health Check**: Profiler health check passes (status: healthy)
- [ ] **Monitoring Integration**: Workflow artifact contains profiler snapshot
- [ ] **Documentation**: This verification guide is complete

## Acceptance Criteria (from Issue)

Track completion of original issue requirements:

- [x] **Profiler enabled in deployment**: ✅ Default `PROFILER_ENABLED=true`
- [x] **Console initialization**: ✅ Auto-start + monitoring backup
- [ ] **Data collection verified**: 🔄 Awaiting next monitoring cycle
- [x] **Monitoring integration**: ✅ Workflow updated with ensure-profiler step
- [ ] **Baseline established**: 🔄 Will be created after first data collection
- [x] **Documentation updated**: ✅ This guide created

**Note**: Items marked 🔄 require actual deployment and monitoring cycle to complete.

## Next Steps After Verification

Once profiler is confirmed operational:

1. **Establish Baseline**: Capture initial profiler snapshot for comparison
2. **Monitor Trends**: Track CPU consumption over time
3. **Identify Bottlenecks**: Flag functions consuming > 30% of CPU
4. **Optimize Hot Paths**: Target high CPU/tick functions
5. **Validate Improvements**: Re-profile after optimizations

## Related Documentation

- [Profiler Usage Guide](./profiler-usage.md) - Complete profiler documentation
- [Screeps Monitoring Workflow](../../.github/workflows/screeps-monitoring.yml) - Workflow configuration
- [Performance Optimization](./performance-optimization.md) - Optimization strategies

## Scripts Reference

**Profiler Management Scripts** (in `packages/utilities/scripts/`):

- `ensure-profiler-running.ts` - 🆕 Ensures profiler is started via console
- `fetch-profiler-console.ts` - Fetches profiler data from Memory.profiler
- `check-profiler-health.ts` - Validates profiler data quality

**Usage Examples**:

```bash
# Ensure profiler is running (idempotent)
npx tsx packages/utilities/scripts/ensure-profiler-running.ts

# Fetch latest profiler data
npx tsx packages/utilities/scripts/fetch-profiler-console.ts

# Check profiler health
npx tsx packages/utilities/scripts/check-profiler-health.ts
```

## Monitoring Workflow Integration

The monitoring workflow now includes profiler enablement as a standard step:

```yaml
- name: Ensure profiler is running
  env:
    SCREEPS_TOKEN: ${{ secrets.SCREEPS_TOKEN }}
    # ... other env vars
  run: |
    npx tsx packages/utilities/scripts/ensure-profiler-running.ts || \
      echo "::warning::Failed to ensure profiler is running"
  continue-on-error: true

- name: Fetch profiler data from console
  # ... fetches Memory.profiler data

- name: Validate profiler health
  # ... checks data quality
```

This ensures profiler data collection is resilient and automatically recovers from failures.
