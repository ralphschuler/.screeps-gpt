# Autonomous Bot Monitoring

The Daily Autonomous Bot Monitor is a comprehensive strategic analysis workflow that serves as the "brain" of the Screeps GPT project. It combines bot performance monitoring, repository health analysis, and intelligent decision-making to guide project development.

## Overview

**Workflow:** `.github/workflows/copilot-autonomous-monitor.yml`  
**Schedule:** Daily at 06:00 UTC  
**Duration:** Up to 45 minutes  
**MCP Servers:** github, screeps-mcp, screeps-api

This workflow provides comprehensive autonomous oversight by analyzing both the Screeps bot's in-game performance and the repository's development infrastructure, then making strategic decisions about priorities and improvements.

## Architecture

### Multi-Phase Analysis Pipeline

The workflow executes in six mandatory phases:

#### Phase 1: Authentication & Connection Validation

- Authenticates GitHub CLI with repository access
- Verifies Screeps MCP server connection
- Fetches bot performance data from game console
- Logs all connection states for debugging

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

#### Phase 3: Repository Health Analysis

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

#### Phase 4: Strategic Decision Making

Applies intelligent prioritization based on impact assessment:

**Priority Levels:**

- **Critical** (`priority/critical`): Bot non-functional, memory crashes, security vulnerabilities, complete automation failures
- **High** (`priority/high`): Major performance degradation (>20%), strategy execution failures, important CI/CD issues, documentation gaps preventing improvements
- **Medium** (`priority/medium`): Optimization opportunities, refactoring needs, workflow improvements, non-blocking doc updates
- **Low** (`priority/low`): Minor quality improvements, nice-to-have features, documentation polish

#### Phase 5: Autonomous Issue Management

For each identified action:

1. Searches existing issues to prevent duplicates
2. Creates new issues with evidence-based descriptions
3. Updates existing issues with new analysis
4. Closes resolved issues when fixes are validated

**Issue Quality Requirements:**

- Concrete evidence from bot performance or repository analysis
- Measurable impact assessment
- Actionable recommendations with alternatives
- Clear success criteria and validation methods

#### Phase 6: Strategic Recommendations

Generates comprehensive analysis report:

- Overall bot health score (0-100 scale)
- Top 3 priorities for game performance
- Top 3 priorities for development infrastructure
- Emerging opportunities (expansion, optimization, automation)
- Risk assessment and mitigation strategies

## Safety Controls

### Allowed Actions

✅ Read bot state, memory, and console output  
✅ Execute read-only console commands for analysis  
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
- Daily execution schedule (not hourly/continuous)

### Error Handling

- **Screeps API unavailable**: Creates monitoring issue, continues with repository analysis
- **GitHub API fails**: Logs error, stores analysis locally
- **MCP tools fail**: Fallbacks to available tools, notes limitations in output

## Configuration

### Required Secrets

**Screeps Access:**

- `SCREEPS_TOKEN` (required) - Screeps API authentication token
- `SCREEPS_HOST` (optional) - Server hostname, defaults to `screeps.com`
- `SCREEPS_SHARD` (optional) - Default shard, defaults to `shard3`
- `SCREEPS_STATS_HOST` (optional) - PTR stats endpoint
- `SCREEPS_STATS_API` (optional) - PTR stats API URL

**GitHub Access:**

- `COPILOT_TOKEN` (required) - GitHub token with Copilot Requests scope
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

1. Navigate to Actions → Daily Autonomous Bot Monitor
2. Click "Run workflow" button
3. Select branch (typically `main`)
4. Monitor execution in workflow run logs

### Schedule

Automatically runs daily at 06:00 UTC (optimal for daily strategic analysis after overnight bot activity).

### Viewing Results

**Workflow Logs:**

- Detailed execution logs available in GitHub Actions run
- Verbose logging enabled for debugging and audit trail
- JSON summary output at end of logs

**Issue Creation:**

- New issues tagged with `monitoring`, `copilot`, `automation` labels
- Issue titles prefixed with `[Autonomous Monitor]`
- Evidence and recommendations included in issue body

**Artifacts:**

- Analysis report uploaded as workflow artifact
- 30-day retention for historical tracking
- Download from workflow run page

## Integration with Other Workflows

### Complements Existing Monitoring

- **Screeps Stats Monitor** (`screeps-stats-monitor.yml`): Provides high-frequency PTR metrics every 30 minutes
- **Copilot Repository Review** (`copilot-review.yml`): Focuses on code quality and automation health
- **Autonomous Monitor**: Strategic "big picture" analysis combining game and development perspectives

### Triggers Downstream Automation

Issues created by the autonomous monitor can trigger:

- **Copilot Todo Automation** when labeled with `Todo`
- **Copilot Spec-Kit** for detailed implementation planning when labeled with `speckit`
- **CI Autofix** if monitoring identifies workflow failures

### Data Flow

```
Daily Schedule (06:00 UTC)
    ↓
[Authenticate & Connect]
    ↓
[Analyze Bot Performance] ← Screeps MCP Server
    ↓
[Analyze Repository Health] ← GitHub MCP Server
    ↓
[Strategic Decision Making]
    ↓
[Issue Management] → Creates/Updates Issues
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

- Update prompt template (`.github/copilot/prompts/autonomous-monitor`) to refine analysis criteria
- Adjust console commands in Phase 2 for specific metrics
- Customize priority thresholds in Phase 4 based on project needs

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
- [Screeps Stats Monitor](overview.md#screeps-stats-monitor-screeps-stats-monitoryml) - High-frequency metrics
- [Copilot Repository Review](overview.md#copilot-repository-review-copilot-reviewyml) - Code quality audits
- [Issue Triage Workflow](overview.md#copilot-issue-triage-copilot-issue-triageyml) - Issue processing
- [Todo Automation](overview.md#copilot-todo-automation-copilot-todo-pryml) - Automated implementation
