# PTR Infrastructure Failures - Troubleshooting Guide

This guide documents the systematic PTR telemetry blackout patterns and provides troubleshooting procedures for distinguishing network failures from empty response patterns.

## Resilient Monitoring Architecture

**Deployed:** 2025-11-05  
**Purpose:** Eliminate single-point-of-failure dependency on Screeps Stats API

### Multi-Source Telemetry Strategy

The monitoring infrastructure now implements a resilient fallback strategy using multiple telemetry sources:

1. **Primary Source: Stats API** (`scripts/fetch-screeps-stats.mjs`)
   - Historical time-series data from `/api/user/stats` endpoint
   - Rich performance metrics over configurable intervals (1hr, 1day, 1week)
   - Preferred source when available

2. **Fallback Source: Console Telemetry** (`scripts/fetch-console-telemetry.ts`)
   - Direct bot telemetry via console commands
   - Real-time operational data (CPU, GCL, rooms, creeps, energy)
   - Activates automatically when Stats API fails
   - **Eliminates monitoring blackouts** during API unavailability

3. **Resilient Coordinator** (`scripts/fetch-resilient-telemetry.ts`)
   - Orchestrates multi-source collection strategy
   - Tries Stats API first, falls back to Console if needed
   - Creates comprehensive failure snapshot only if both sources fail

### Fallback Activation

**Alert Type:** `fallback_activated`  
**Severity:** `medium` (informational)  
**Meaning:** System working as designed - resilience deployed successfully

When you see this alert:

- ✅ Monitoring is **operational** (using Console telemetry)
- ⚠️ Primary Stats API is experiencing issues
- 📊 Performance data is still being collected
- 🔄 System will automatically return to Stats API when available

**Action Required:** None immediately. Create issue only if Stats API failure persists >2 hours.

### Complete Infrastructure Failure

**Alert Type:** `infrastructure_failure`  
**Severity:** `critical`  
**Meaning:** All telemetry sources failed - complete monitoring blackout

This should be extremely rare with the resilient architecture. If this occurs:

1. Verify `SCREEPS_TOKEN` is valid and has proper permissions
2. Check Screeps infrastructure status
3. Review network connectivity
4. Escalate immediately per [Escalation Patterns](#escalation-patterns)

## Failure Classification

### Network Failure (Complete Infrastructure Failure)

**Characteristics:**

- API endpoint completely unreachable
- No HTTP response received
- Fetch fails with network error (no status code)
- Failure type: `network_error`

**Failure Snapshot Format:**

```json
{
  "status": "api_unavailable",
  "failureType": "network_error",
  "timestamp": "2025-10-27T05:37:00.000Z",
  "error": "fetch failed",
  "attempted_endpoint": "https://screeps.com/api/user/stats?interval=180",
  "httpStatus": null,
  "httpStatusText": null
}
```

**Alert Type:** `api_endpoint_unreachable`  
**Severity:** `critical`

**Troubleshooting Steps:**

1. **Check Screeps infrastructure status**
   - Visit https://screeps.com to verify if the main site is accessible
   - Check official Screeps Discord/Slack for maintenance announcements
   - Review Screeps status page if available

2. **Verify network connectivity**
   - Test basic network connectivity: `ping screeps.com`
   - Check DNS resolution: `nslookup screeps.com`
   - Verify firewall/proxy settings in GitHub Actions environment

3. **Review recent infrastructure patterns**
   - Check if this is part of systematic blackout pattern (multiple consecutive failures)
   - Review timeline of previous network failures
   - Determine if pattern is recurring at specific intervals

4. **Implement fallback monitoring**
   - Wait for automatic retry with exponential backoff
   - Monitor for recovery in next scheduled run
   - Create monitoring issue if failure persists beyond 2 hours

### HTTP Server Error (5xx)

**Characteristics:**

- HTTP response received with 5xx status code
- Server-side failure (500, 502, 503, 504)
- Failure type: `http_error_5xx`

**Failure Snapshot Format:**

```json
{
  "status": "api_unavailable",
  "failureType": "http_error_500",
  "timestamp": "2025-10-27T05:37:00.000Z",
  "error": "Failed to fetch Screeps stats (500 Internal Server Error): ...",
  "attempted_endpoint": "https://screeps.com/api/user/stats?interval=180",
  "httpStatus": 500,
  "httpStatusText": "Internal Server Error"
}
```

**Alert Type:** `api_server_error`  
**Severity:** `critical`

**Troubleshooting Steps:**

1. Verify error is not transient (retry logic should handle temporary failures)
2. Check Screeps infrastructure status for reported issues
3. Monitor for recovery in subsequent runs
4. Create issue if persists beyond 1 hour

### Authentication Failure (401/403)

**Characteristics:**

- HTTP 401 Unauthorized or 403 Forbidden
- Token authentication failed
- Failure type: `http_error_401` or `http_error_403`

**Alert Type:** `api_authentication_failed`  
**Severity:** `high`

**Troubleshooting Steps:**

1. **Verify token validity**
   - Check if `SCREEPS_TOKEN` or `SCREEPS_STATS_TOKEN` secret is set
   - Regenerate token at https://screeps.com/a/#!/account/auth-tokens
   - Update GitHub repository secret

2. **Check token permissions**
   - Ensure token has `stats` read permission
   - Verify token is not expired
   - Test token with curl: `curl -H "X-Token: $TOKEN" https://screeps.com/api/user/stats?interval=180`

3. **Update workflow secrets**
   - Navigate to repository Settings → Secrets and variables → Actions
   - Update `SCREEPS_TOKEN` with new value
   - Trigger workflow manually to verify fix

### Empty Response Pattern (Data Unavailable)

**Characteristics:**

- HTTP 200 OK response received
- Valid JSON payload with empty stats: `{"ok": 1, "stats": {}}`
- No network or HTTP error
- Bot not collecting stats or no recent activity

**Alert Type:** `no_data`  
**Severity:** `medium`

**Failure Snapshot Format:**

```json
{
  "fetchedAt": "2025-10-27T05:37:00.000Z",
  "endpoint": "https://screeps.com/api/user/stats?interval=180",
  "payload": {
    "ok": 1,
    "stats": {}
  }
}
```

**Troubleshooting Steps:**

1. **Verify bot deployment and activity**
   - Check if bot is running in the game
   - Verify StatsCollector integration is active
   - Run `JSON.stringify(Memory.stats)` in console to check stats generation

2. **Check game activity**
   - Confirm account has recent activity on target server
   - Verify bot has controlled rooms
   - Check if bot has been respawned recently

3. **Review stats collection interval**
   - Ensure interval parameter matches expected data range
   - Verify bot has been active within the interval window
   - Check if targeting correct server (PTR vs official)

4. **Validate Memory.stats collection**
   - See [Stats Collection Implementation](./stats-collection.md)
   - Verify StatsCollector is called every tick
   - Check for errors in bot logs

## Escalation Patterns

### Historical Incidents

**Systematic PTR Blackout Pattern:**

- Issue #438 - Systematic PTR telemetry blackout infrastructure vulnerability
- Issue #428 - Critical PTR telemetry blackout preventing performance validation
- Issue #427 - PTR telemetry blackout during CPU crisis
- Issue #420 - Complete PTR telemetry blackout preventing performance validation
- Issue #398 - Critical PTR telemetry blackout preventing operational monitoring
- Issue #375 - PTR telemetry blackout with empty stats pattern
- Issue #351 - Persistent PTR telemetry blackout blocking performance monitoring
- Issue #331 - Critical PTR telemetry blackout with zero data

**Pattern Analysis:**

- Previous incidents (8 total): Empty stats responses (HTTP 200, empty data)
- Current escalation: Complete API endpoint unavailability (network error)
- Frequency: Recurring pattern indicating systematic infrastructure vulnerability
- Impact: Blocks performance validation and monitoring capabilities

### Escalation Criteria

**Critical Priority (Immediate Action Required):**

- Network failures persisting > 2 hours
- Server errors (5xx) persisting > 1 hour
- Multiple consecutive failures within 24 hours
- Part of systematic blackout pattern (3+ failures in 7 days)

**High Priority (Action Required Within 24 Hours):**

- Authentication failures
- Single network or server error (may be transient)
- Empty response pattern lasting > 4 hours

**Medium Priority (Monitor):**

- Empty response pattern < 4 hours
- Transient errors that recover on retry
- Single isolated incident

## Monitoring Resilience

### Multi-Source Architecture (Deployed 2025-11-05)

The monitoring system now uses a resilient multi-source strategy:

**Primary Collection: Stats API**

- Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
- Skip retry for client errors (401, 403, 400, 422)
- Historical time-series data for trend analysis

**Fallback Collection: Console Telemetry**

- Activates automatically when Stats API fails
- Direct bot operational data via console commands
- Real-time metrics: CPU, GCL, rooms, creeps, energy
- **Eliminates monitoring blackouts**

**Orchestration Script:** `scripts/fetch-resilient-telemetry.ts`

- Coordinates multi-source collection
- Transparent fallback activation
- Comprehensive failure tracking

### Failure Snapshot Creation

When telemetry sources are unavailable:

**Stats API Failure:**

1. Creates failure snapshot with network/HTTP error details
2. Triggers automatic fallback to Console telemetry
3. Marks snapshot with `fallback_activated: true`
4. **Monitoring continues** with Console data

**Complete Infrastructure Failure:**

1. Both Stats API and Console fail
2. Creates comprehensive failure snapshot
3. Includes attempted sources and diagnostic information
4. Alerts with `critical` severity

### Alert Notification

The `check-ptr-alerts.ts` script:

- Analyzes snapshots from any telemetry source
- Detects fallback activation as `medium` priority (informational)
- Escalates complete infrastructure failure as `critical`
- Sends push notifications for critical/high severity failures
- Supports both Stats API and Console data formats

### Snapshot Metadata

All snapshots now include resilience tracking:

```json
{
  "source": "stats_api" | "console",
  "fallback_activated": true | false,
  "primary_source_failed": true | false,
  "payload": { /* telemetry data */ }
}
```

## Prevention Measures

### Monitoring System Improvements (Implemented)

1. **✅ Enhanced Error Detection**
   - Classify failure types (network, HTTP, empty, infrastructure_failure)
   - Track failure patterns over time
   - Detect systematic blackout sequences
   - Distinguish fallback activation from critical failures

2. **✅ Graceful Degradation**
   - Continue repository analysis when primary source unavailable
   - Automatic fallback to secondary telemetry source
   - Store failure snapshots for post-recovery analysis
   - Maintain monitoring continuity during Stats API outages

3. **✅ Redundant Monitoring Channels** (Deployed 2025-11-05)
   - ✅ Direct console access via Screeps API
   - ✅ Real-time bot telemetry collection
   - ✅ Multi-source resilient architecture
   - ✅ **Eliminates single-point-of-failure dependency**

### Validation Framework

**Pre-deployment Validation:**

- Test token validity before deployment
- Verify API endpoint accessibility
- Validate interval parameter configuration

**Continuous Monitoring:**

- Track API availability over time
- Monitor for systematic patterns
- Alert on sustained failures

**Post-recovery Analysis:**

- Review failure timeline
- Analyze root cause
- Document incident in operations log

## Related Documentation

- [Stats Monitoring Pipeline](./stats-monitoring.md) - Overall monitoring architecture
- [Stats Collection Implementation](./stats-collection.md) - Bot-side stats generation
- [Autonomous Monitoring](../automation/autonomous-monitoring.md) - Strategic monitoring workflow
- [Workflow Troubleshooting](./workflow-troubleshooting.md) - General workflow debugging

## References

- Screeps API Documentation: https://docs.screeps.com/api/
- GitHub Actions Secrets: Repository Settings → Secrets and variables
- Monitoring Workflow: `.github/workflows/screeps-monitoring.yml`
- Fetch Script: `scripts/fetch-screeps-stats.mjs`
- Alert Script: `scripts/check-ptr-alerts.ts`
