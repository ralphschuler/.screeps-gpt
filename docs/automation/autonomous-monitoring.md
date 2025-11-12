# Screeps Monitoring

The Screeps Monitoring workflow is a comprehensive autonomous analysis system that serves as the "strategic brain" of the Screeps GPT project. It combines bot performance monitoring, PTR telemetry analysis, repository health assessment, and intelligent decision-making to guide project development.

## Overview

**Workflow:** `.github/workflows/screeps-monitoring.yml`  
**Schedule:** Every 30 minutes (via cron schedule)  
**Duration:** Up to 45 minutes  
**MCP Servers:** github, screeps-mcp, screeps-api

This workflow provides comprehensive autonomous oversight by analyzing the Screeps bot's in-game performance, monitoring PTR stats for anomalies, evaluating repository health, and making strategic decisions about priorities and improvements. It consolidates the functionality of the former `copilot-autonomous-monitor.yml` and `screeps-stats-monitor.yml` workflows.

## Architecture

### Multi-Phase Analysis Pipeline

The workflow executes in seven mandatory phases:

#### Phase 1: Authentication & Connection Validation

- Authenticates GitHub CLI with repository access
- Verifies Screeps MCP server connection
- Fetches PTR telemetry data using **resilient multi-source strategy**
- Fetches bot performance data from game console
- Logs all connection states for debugging

**PTR Telemetry Collection - Resilient Architecture (Deployed 2025-11-05):**

The workflow executes the resilient telemetry fetch script (`scripts/fetch-resilient-telemetry.ts`) which:

- **Primary Source**: Stats API via `scripts/fetch-screeps-stats.mjs`
  - Historical time-series data from `/api/user/stats` endpoint
  - Uses `SCREEPS_STATS_TOKEN` or `SCREEPS_TOKEN`
  - Provides comprehensive performance metrics
- **Fallback Source**: Console Telemetry via `scripts/fetch-console-telemetry.ts`
  - Real-time bot operational data via console commands
  - Activates automatically when Stats API fails
  - Uses `SCREEPS_TOKEN` for console access
  - **Eliminates monitoring blackouts**

- **Resilience Features**:
  - Automatic fallback if primary source fails
  - Graceful degradation maintains monitoring continuity
  - Stores results in `reports/screeps-stats/latest.json`
  - Copies snapshot to `reports/copilot/ptr-stats.json` for analysis
  - Creates comprehensive failure snapshot only if all sources fail
  - Tracks telemetry source and fallback status in metadata

#### Phase 2: Bot Performance Analysis

Evaluates game-side performance through three dimensions:

**A. Game State Assessment**

- Spawning status and creep population across rooms
- CPU usage patterns and efficiency metrics
- Energy economy (income, expenses, storage, construction)
- Room control level (RCL) progress and upgrade rates
- Defense capabilities and threat responses

**B. Strategic Execution Evaluation**

- Strategy alignment with documented goals
- Resource allocation and creep behavior bottlenecks
- Room expansion opportunities and territory control
- Trade and market activity analysis

**C. Memory & Performance Health**

- Memory usage and leak detection
- Tick execution time and CPU bucket trends
- Error logs and exception patterns
- Memory segment usage and cleanup

#### Phase 3: PTR Stats Anomaly Detection

Analyzes the PTR telemetry snapshot for critical performance anomalies requiring immediate attention.

**Anomaly Detection Criteria:**

**Critical Priority Anomalies** (`priority/critical`):

- CPU usage > 95% for 3+ consecutive ticks
- Memory crashes or persistent errors
- Zero creep spawning for 10+ ticks when resources available
- Room abandonment without explicit strategy

**High Priority Anomalies** (`priority/high`):

- CPU usage > 80% for 10+ consecutive ticks
- Energy efficiency drop > 20% from baseline
- Creep population deviation > 30% from target
- Construction progress stalled for 50+ ticks

**Medium Priority Anomalies** (`priority/medium`):

- Suboptimal resource allocation patterns
- Minor performance degradations < 10%
- Non-critical strategy execution delays

**Requirements:**

- All anomaly issues must have concrete evidence with exact metric values and thresholds
- All issue titles must start with `PTR:` to identify monitoring findings
- All severity labels must be justified with specific impact assessment
- All analysis must be reproducible with stored snapshot data

After Copilot analysis completes, the workflow also executes `scripts/check-ptr-alerts.ts` which:

- Reads the PTR stats snapshot from `reports/screeps-stats/latest.json`
- Analyzes for high CPU usage (>80% sustained), critical CPU (>95%), and low energy reserves
- Sends push notifications via Push by Techulus for critical and high severity alerts
- Provides real-time alerting independent of issue creation

#### Phase 3.5: Bot Aliveness Heartbeat (Graduated Failure Detection)

**Deployed:** 2025-11-12 - Addresses 8+ hour bot outage detection gap (Issue #559)

The workflow executes automated bot aliveness heartbeat monitoring with graduated failure detection to catch bot outages within 30 minutes (vs. previous 8+ hour detection time).

**Multi-Stage Health Check:**

The health check (`packages/utilities/scripts/check-bot-health.ts`) performs graduated detection:

1. **Stage 1: PTR Stats Validation** (fast, cached)
   - Checks if `reports/screeps-stats/latest.json` contains recent game data
   - If stats present → Bot is operational (immediate success)
   - If no stats → Proceed to Stage 2

2. **Stage 2: Bot Aliveness Check** (world-status API, 1 minute timeout)
   - Uses `./scripts/check-bot-aliveness.ts` to query Screeps world-status API
   - Returns: `active`, `respawn_needed`, `spawn_placement_needed`, or `unknown`
   - If `active` → Bot is operational
   - If other status → Proceed to failure tracking

3. **Stage 3: Console Fallback** (future enhancement)
   - Planned: Direct console ping when world-status API fails
   - Minimal telemetry collection via console commands
   - Provides definitive bot state when other methods fail

**Graduated Alert Thresholds:**

The system implements escalating detection to prevent false positives:

- **0-15 minutes**: No alert (normal API fluctuation or temporary outage)
- **15-30 minutes**: Warning level logged, retry health check
- **30-60 minutes**: HIGH priority alert issued
- **60+ minutes**: CRITICAL priority, manual intervention required

**Health State Persistence:**

Health state is maintained in `reports/monitoring/health.json`:

```json
{
  "last_successful_ping": "2025-11-12T10:00:00Z",
  "last_failed_ping": null,
  "consecutive_failures": 0,
  "health_status": "operational|degraded|critical",
  "last_known_tick": 12345678,
  "last_bot_status": "active",
  "detection_history": [
    {
      "timestamp": "2025-11-12T10:00:00Z",
      "status": "success",
      "aliveness": "active"
    }
  ]
}
```

The health state is:

- Persisted across monitoring runs (committed to repository)
- Used to track consecutive failure count
- Maintains detection history (last 100 entries)
- Enables graduated alerting based on failure duration

**Alert Integration:**

Health check results are integrated into `check-ptr-alerts.ts`:

- Reads health check results from `reports/monitoring/health-check-latest.json`
- Creates bot outage alerts when thresholds exceeded
- Sends push notifications and email alerts for HIGH/CRITICAL outages
- Alert messages include failure duration and consecutive failure count

**Benefits:**

- **Early Detection**: Bot outages detected within 30 minutes (vs. 8+ hours)
- **Zero False Positives**: Graduated thresholds prevent alerts from temporary glitches
- **Historical Tracking**: Persistent state enables trend analysis and failure pattern detection
- **Actionable Alerts**: Clear severity levels guide intervention urgency

#### Phase 4: Repository Health Analysis

Evaluates development infrastructure through GitHub MCP tools:

**A. Codebase Quality**

- Recent CI/CD failures and workflow health
- Open issues and PR blockers
- Code coverage trends and test quality
- Technical debt and refactoring needs

**B. Automation Effectiveness**

- Copilot agent activity assessment
- Deployment frequency and success rates
- Monitoring alert patterns
- Documentation freshness

**C. Development Velocity**

- Commit frequency and momentum
- Feature implementation backlog
- Dependency and blocking analysis

#### Phase 5: Strategic Decision Making

Applies intelligent prioritization based on impact assessment:

**Priority Levels:**

- **Critical** (`priority/critical`): Bot non-functional, memory crashes, security vulnerabilities, complete automation failures
- **High** (`priority/high`): Major performance degradation (>20%), strategy execution failures, important CI/CD issues, documentation gaps preventing improvements
- **Medium** (`priority/medium`): Optimization opportunities, refactoring needs, workflow improvements, non-blocking doc updates
- **Low** (`priority/low`): Minor quality improvements, nice-to-have features, documentation polish

#### Phase 6: Autonomous Issue Management

For each identified action:

1. Searches existing issues to prevent duplicates
2. Creates new issues with evidence-based descriptions
   - For strategic issues: Title prefixed with `[Autonomous Monitor]`
   - For PTR anomalies: Title prefixed with `PTR:`
3. Updates existing issues with new analysis
4. Closes resolved issues when fixes are validated

**Issue Quality Requirements:**

- Concrete evidence from bot performance, PTR stats, or repository analysis
- Measurable impact assessment
- Actionable recommendations with alternatives
- Clear success criteria and validation methods

#### Phase 7: Strategic Recommendations

Generates comprehensive analysis report:

- Overall bot health score (0-100 scale)
- PTR performance status (operational/degraded/critical)
- Top 3 priorities for game performance
- Top 3 priorities for development infrastructure
- Emerging opportunities (expansion, optimization, automation)
- Risk assessment and mitigation strategies

## Safety Controls

### Allowed Actions

✅ Read bot state, memory, and console output  
✅ Execute read-only console commands for analysis  
✅ Fetch and analyze PTR telemetry data  
✅ Create, update, comment on, and close GitHub issues  
✅ Search repository code and documentation  
✅ Analyze workflow logs and automation health

### Prohibited Actions

❌ Execute destructive console commands  
❌ Modify Memory without explicit approval  
❌ Create or merge pull requests automatically  
❌ Change repository settings or secrets  
❌ Deploy code changes automatically

### Rate Limiting

- Maximum 10 GitHub issues created per run
- Maximum 5 Screeps console commands per analysis phase
- Graceful degradation if APIs unavailable
- Runs every 30 minutes (not continuously)

### Error Handling

- **Screeps API unavailable**: Creates monitoring issue, continues with repository analysis
- **PTR telemetry fetch fails**: Documents failure, continues with strategic monitoring
- **GitHub API fails**: Logs error, stores analysis locally
- **MCP tools fail**: Fallbacks to available tools, notes limitations in output

## Configuration

### Required Secrets

**Screeps Access:**

- `SCREEPS_TOKEN` (required) - Screeps API authentication token
- `SCREEPS_STATS_TOKEN` (optional) - Alternative stats token
- `SCREEPS_HOST` (optional) - Server hostname, defaults to `screeps.com`
- `SCREEPS_SHARD` (optional) - Default shard, defaults to `shard3`
- `SCREEPS_PORT`, `SCREEPS_PROTOCOL` (optional) - Server connection parameters
- `SCREEPS_STATS_HOST` (optional) - PTR stats endpoint
- `SCREEPS_STATS_API` (optional) - PTR stats API URL

**GitHub Access:**

- `COPILOT_TOKEN` (required) - GitHub token with Copilot Requests scope
- `PUSH_TOKEN` (optional) - Push by Techulus token for real-time PTR alerts
- Default `GITHUB_TOKEN` used for repository operations (issues, PRs)

### Permissions

```yaml
permissions:
  contents: read
  issues: write
  pull-requests: read
```

## Usage

### Manual Trigger

Execute the workflow manually from GitHub Actions UI:

1. Navigate to Actions → Screeps Monitoring
2. Click "Run workflow" button
3. Select branch (typically `main`)
4. Monitor execution in workflow run logs

### Schedule

Automatically runs every 30 minutes (cron: `*/30 * * * *`) to provide high-frequency monitoring of both strategic health and PTR performance metrics. Also triggers automatically on completion of the "Deploy Screeps AI" workflow.

### Viewing Results

**Workflow Logs:**

- Detailed execution logs available in GitHub Actions run
- Verbose logging enabled for debugging and audit trail
- JSON summary output at end of logs

**Issue Creation:**

- New issues tagged with `monitoring`, `copilot`, `automation` labels
- Strategic issue titles prefixed with `[Autonomous Monitor]`
- PTR anomaly issue titles prefixed with `PTR:`
- Evidence and recommendations included in issue body

**Artifacts:**

- Analysis report uploaded as workflow artifact
- PTR stats snapshot stored in `reports/screeps-stats/latest.json`
- Copilot analysis snapshot in `reports/copilot/ptr-stats.json`
- 30-day retention for historical tracking
- Download from workflow run page

**Push Notifications:**

- Critical and high severity PTR alerts sent via Push by Techulus
- Notifications include alert type, severity, and link to workflow run
- Requires `PUSH_TOKEN` secret for real-time alerting
- See [Push Notifications Guide](push-notifications.md) for configuration details

## Integration with Other Workflows

### Consolidated Monitoring

This workflow consolidates two previously separate monitoring systems:

- **Strategic Autonomous Monitoring**: Comprehensive analysis of bot performance and repository health using MCP servers
- **PTR Stats Monitoring**: High-frequency telemetry collection with anomaly detection and push notifications

The consolidation provides:

- Single workflow execution instead of two parallel runs every 30 minutes
- Combined analysis correlating PTR metrics with strategic performance
- Unified issue creation with consistent labeling and evidence
- Reduced workflow complexity and execution overhead

### Triggers Downstream Automation

Issues created by the monitoring workflow can trigger:

- **Copilot Todo Automation** when labeled with `Todo`
- **CI Autofix** if monitoring identifies workflow failures

### Data Flow

```
Every 30 Minutes (Cron + Deploy Completion)
    ↓
[Authenticate & Connect]
    ↓
[Fetch PTR Telemetry] → reports/screeps-stats/latest.json
    ↓
[Analyze Bot Performance] ← Screeps MCP Server
    ↓
[Detect PTR Anomalies] ← PTR Stats Snapshot
    ↓
[Analyze Repository Health] ← GitHub MCP Server
    ↓
[Strategic Decision Making]
    ↓
[Issue Management] → Creates/Updates Issues (Strategic + PTR)
    ↓
[Check PTR Alerts] → Send Push Notifications
    ↓
[Strategic Report] → Workflow Artifact
    ↓
[Triggers Downstream] → Todo/Spec-Kit Workflows
```

## Best Practices

### Monitoring the Monitor

- Review workflow execution logs weekly for patterns
- Validate that created issues are actionable and accurate
- Adjust priority thresholds if too many/few issues created
- Monitor execution time to ensure 45-minute timeout is sufficient

### Tuning Analysis

- Update prompt template (`.github/copilot/prompts/screeps-monitor`) to refine analysis criteria
- Adjust console commands in Phase 2 for specific metrics
- Customize priority thresholds in Phase 5 based on project needs
- Configure PTR anomaly detection thresholds in Phase 3

### Issue Quality

- Issues should be self-contained with all evidence included
- Validate that recommendations are actionable and specific
- Check for duplicate prevention (search before create)
- Ensure severity labels match actual impact

### Safety Validation

- Audit issue creation patterns to prevent noise
- Verify no destructive actions attempted
- Review rate limiting effectiveness
- Check error handling for API failures

## Troubleshooting

### Workflow Fails to Start

- Check `COPILOT_TOKEN` secret is configured
- Verify `SCREEPS_TOKEN` secret exists
- Review workflow syntax with yamllint

### Screeps MCP Connection Fails

- Validate `SCREEPS_TOKEN` has correct permissions
- Check `SCREEPS_HOST` if using private server
- Review MCP config in `.github/mcp/screeps-mcp.json`

### PTR Telemetry Failures

The monitoring system distinguishes between critical infrastructure failures and application-level issues:

- **Network Failures** (Critical): API endpoint completely unreachable
- **Server Errors** (Critical): HTTP 5xx responses from Screeps API
- **Authentication Failures** (High): HTTP 401/403 token issues
- **Empty Response Pattern** (Medium): HTTP 200 with no stats data

See [PTR Infrastructure Failures Guide](../operations/ptr-infrastructure-failures.md) for comprehensive troubleshooting procedures and escalation criteria.

### No Issues Created

- Review strategic decision-making logs for criteria matching
- Check if existing issues prevent duplicates
- Verify bot performance is within normal thresholds

### Timeout Issues

- Review execution logs for slow operations
- Check if MCP servers are responsive
- Consider reducing analysis scope or increasing timeout

### Rate Limiting Hit

- Verify max 10 issues per run not exceeded
- Check max 5 console commands per phase
- Review error handling logs for API failures

## Future Enhancements

Potential improvements to consider:

- **Trend Analysis**: Track bot health score over time for regression detection
- **Predictive Analysis**: Machine learning to predict issues before they occur
- **Resource Optimization**: Automatic tuning of spawning and upgrade strategies
- **Cross-Shard Analysis**: Compare performance across multiple shards
- **Market Intelligence**: Automated trade and market strategy optimization
- **Expansion Planning**: Territory analysis for optimal room claiming

## Related Documentation

- [Automation Overview](overview.md) - Complete workflow documentation
- [PTR Infrastructure Failures](../operations/ptr-infrastructure-failures.md) - Network failure troubleshooting
- [Stats Monitoring Pipeline](../operations/stats-monitoring.md) - PTR telemetry collection
- [Push Notifications](push-notifications.md) - PTR alert notification setup
- [Copilot Repository Review](overview.md#copilot-repository-review-copilot-reviewyml) - Code quality audits
- [Issue Triage Workflow](overview.md#copilot-issue-triage-copilot-issue-triageyml) - Issue processing
- [Todo Automation](overview.md#copilot-todo-automation-copilot-todo-pryml) - Automated implementation
