# Strategic Planning Automation

The Strategic Planning Agent is an autonomous system that analyzes bot performance, identifies improvement opportunities, and creates actionable implementation issues to drive continuous bot optimization.

## Overview

The strategic planner completes the autonomous development loop:

```
Monitoring → Strategic Planning → Implementation → Validation → Monitoring
     ↑                                                              ↓
     └──────────────────── Learning Feedback ──────────────────────┘
```

**Workflow:** `.github/workflows/copilot-strategic-planner.yml`  
**Prompt:** `.github/copilot/prompts/strategic-planner`  
**Schedule:** Every 8 hours  
**Purpose:** Proactive improvement roadmap generation

## Architecture

### Data Integration

The strategic planner integrates multiple data sources:

**Bot Snapshots** (`reports/bot-snapshots/`):

- Current game state (rooms, RCL, creeps, resources)
- Historical state progression
- Collected by `packages/utilities/scripts/collect-bot-snapshot.ts`

**PTR Telemetry** (`reports/copilot/ptr-stats.json`):

- CPU usage patterns and trends
- Energy efficiency metrics
- Resource management statistics
- Collected by strategic monitoring workflow

**Profiler Data** (`reports/profiler/latest.json`):

- Function-level CPU consumption
- Bottleneck identification
- Optimization targets ranked by impact
- Collected when profiler is enabled

**Documentation** (`docs/` directory):

- Strategic goals and roadmap
- Architecture documentation
- Current capabilities and limitations
- Phase progression plans

**Issue History** (GitHub API):

- Open issues (current backlog)
- Closed issues (successful implementations)
- Failed attempts (lessons learned)
- Dependencies and blockers

## Strategic Planning Process

### Phase 1: Data Collection

1. **Authenticate GitHub CLI** for repository access
2. **Gather bot performance data** from snapshots and PTR stats
3. **Review profiler insights** if available
4. **Read strategic documentation** to understand goals
5. **Query issue history** for context

### Phase 2: Bot Performance Analysis

**Game State Assessment:**

- Room count and RCL progression
- Creep population and composition
- Resource availability and storage
- Expansion opportunities

**Performance Metrics:**

- CPU usage trends and efficiency
- Memory utilization patterns
- Energy income vs expenses
- Upgrade and construction rates

**Strategic Execution:**

- Progress toward documented goals
- Strategy implementation gaps
- Infrastructure completeness
- Automation coverage

**Profiler Analysis** (when available):

- Top CPU consumers (>20% total CPU)
- Expensive operations (>1.0ms per call)
- Optimization opportunities

### Phase 3: Opportunity Identification

The agent identifies improvements across six categories:

#### 1. Performance Optimization

- CPU bottlenecks requiring algorithm improvements
- Memory efficiency opportunities
- Caching and batch processing
- Profiler-identified hotspots

**Priority:**

- CPU savings >10%: High
- CPU savings 5-10%: Medium
- CPU savings <5%: Low

#### 2. Economic Improvements

- Energy harvesting efficiency
- Resource allocation optimization
- Storage and logistics
- Market trading opportunities

**Priority:**

- Energy gain >20%: High
- Energy gain 10-20%: Medium
- Energy gain <10%: Low

#### 3. Strategic Expansion

- Multi-room scaling
- Remote mining operations
- Territory control
- Colony coordination

**Priority:**

- Blocks progression: Critical
- Enables next phase: High
- Optimization: Medium

#### 4. Defense and Combat

- Tower placement and targeting
- Creep defense strategies
- Threat detection and response
- Safe mode management

**Priority:**

- Security vulnerability: Critical
- Insufficient defense: High
- Optimization: Medium

#### 5. Infrastructure

- Road network optimization
- Container and link placement
- Spawn efficiency
- Storage management

**Priority:**

- Blocks development: High
- Efficiency improvement: Medium
- Nice-to-have: Low

#### 6. Automation Gaps

- Missing monitoring or alerting
- Incomplete workflows
- Documentation deficiencies
- Testing coverage gaps

**Priority:**

- Blocks autonomous operation: High
- Reduces reliability: Medium
- Quality improvement: Low

### Phase 4: Learning from History

**Success Analysis:**

- What implementations worked well
- Patterns in successful approaches
- Strategies to replicate

**Failure Analysis:**

- Why approaches didn't work
- Avoided strategies
- Alternative approaches to consider

**Blocker Understanding:**

- Current blocked work
- Dependencies preventing progress
- Alternative paths to unblock

### Phase 5: Strategic Decision Making

**Decision Framework:**

1. **Impact**: Performance/strategic improvement magnitude
2. **Effort**: Implementation complexity
3. **Dependencies**: Required prerequisite work
4. **Risk**: Potential failure modes
5. **Learning**: Value for continuous improvement

**Priority Assignment:**

- **Critical**: Bot non-functional, security issues, data loss risks
- **High**: >20% performance degradation, blocking progression, >10% optimization
- **Medium**: 5-10% optimization, quality improvements, infrastructure
- **Low**: <5% optimization, documentation, cleanup

### Phase 6: Issue Generation

**Issue Structure:**

```markdown
## Strategic Context

Why this matters for bot performance

## Current State Analysis

- Bot performance metrics
- PTR stats evidence
- Profiler insights
- Documentation context

## Proposed Changes

Specific implementation approach with file references

## Expected Impact

Quantified performance improvement and strategic value

## Acceptance Criteria

Measurable success conditions

## Dependencies

Links to blocking issues

## Implementation Approach

Files to modify and test coverage

## Monitoring Validation

How to verify success
```

**Issue Naming Convention:**

- Format: `<type>(<domain>): <actionable objective>`
- Examples:
  - `feat(runtime): implement remote mining for W1N1`
  - `fix(performance): optimize path caching in movement logic`
  - `chore(monitoring): add CPU bottleneck alerts`

**Required Labels:**

- Process: `automation`, `strategic-planning`, `state/pending`
- Type: `type/feature`, `type/enhancement`, `type/bug`
- Priority: `priority/critical`, `priority/high`, `priority/medium`, `priority/low`
- Domain: `runtime`, `monitoring`, `documentation`, etc.

### Phase 7: Documentation Updates

**Strategy Documentation** (`docs/strategy/`):

- Update roadmap with new priorities
- Document strategic shifts
- Maintain phase alignment
- Record optimization targets

**Automation Documentation** (`docs/automation/`):

- Keep workflow descriptions current
- Document new capabilities
- Update integration guides

**Operations Documentation** (`docs/operations/`):

- Document recurring solutions
- Update troubleshooting guides
- Maintain runbooks

### Phase 8: Strategic Recommendations

**Executive Summary:**

- Overall bot health score (0-100)
- Current strategic phase and progress
- Key bottlenecks and opportunities
- Top 3 priority recommendations

**Resource Allocation:**

- Focus areas for development
- Work to defer or deprioritize
- Risk mitigation priorities

**Learning Insights:**

- Unexpected data patterns
- Strategic assumptions to validate
- Monitoring gaps to address

## Integration with Ecosystem

### Complementary Workflows

**Strategic Monitoring** (`screeps-monitoring.yml`):

- Provides performance data for analysis
- Creates monitoring issues for anomalies
- Feeds into strategic planning context

**Issue Triage** (`copilot-issue-triage.yml`):

- Reformulates strategic planning issues
- Adds context and relationships
- Applies consistent labeling

**Todo Automation** (`copilot-todo-pr.yml`):

- Implements generated strategic issues
- Creates pull requests for solutions
- Closes the development loop

**CI Autofix** (`copilot-ci-autofix.yml`):

- Addresses quality gates
- Maintains code health
- Complements strategic improvements

### Data Flow

```
Bot Snapshots ──┐
PTR Stats ──────┼──> Strategic Planner ──> Issues ──> Todo Automation ──> PRs
Profiler Data ──┤                            ↓                              ↓
Documentation ──┘                      Documentation                    Deployed
                                          Updates                         Code
```

## Configuration

### Workflow Schedule

**Default:** Every 8 hours (`0 */8 * * *`)

**Rationale:**

- Balances responsiveness with API rate limits
- Allows time for monitoring data collection
- Provides regular strategic check-ins
- Can be triggered manually for urgent analysis

### Permissions

**Required:**

- `contents: read` - Access repository files and data
- `issues: write` - Create and update issues

**Not Required:**

- No code modification permissions
- No PR creation permissions
- No secret access

### Rate Limits

**Constraints:**

- Maximum 10 issues per run
- Focus on high-impact opportunities
- Avoid micro-optimizations without profiler evidence
- Group related improvements into comprehensive issues

**Quality Standards:**

- Every issue must have concrete evidence
- Every priority must be justified
- Every acceptance criterion must be measurable
- Every implementation approach must reference files

## Usage Examples

### Manual Trigger

Trigger strategic planning manually for urgent analysis:

```bash
gh workflow run copilot-strategic-planner.yml
```

### Reviewing Strategic Issues

Strategic planning issues are labeled `strategic-planning`:

```bash
gh issue list --label strategic-planning
```

### Monitoring Planning Outcomes

Check strategic planning workflow runs:

```bash
gh run list --workflow=copilot-strategic-planner.yml
```

View specific run details:

```bash
gh run view <run-id>
```

Download planning report:

```bash
gh run download <run-id>
```

## Best Practices

### For Strategic Planning Agent

**Data Analysis:**

- Always check data availability before drawing conclusions
- Cross-reference multiple data sources for validation
- Note data gaps and limitations in analysis
- Use historical trends, not single data points

**Opportunity Identification:**

- Prioritize high-impact, evidence-backed improvements
- Consider implementation complexity vs benefit
- Check for dependencies and prerequisites
- Avoid premature optimization

**Issue Creation:**

- Quality over quantity - comprehensive issues preferred
- Provide concrete evidence for every claim
- Link to relevant documentation and code
- Include clear acceptance criteria

**Documentation Updates:**

- Keep changes minimal and focused
- Maintain existing structure and style
- Link documentation to generated issues
- Record strategic reasoning

### For Repository Maintainers

**Reviewing Strategic Issues:**

- Validate evidence and impact claims
- Check for alignment with strategic goals
- Consider resource constraints and priorities
- Provide feedback on issue quality

**Strategic Alignment:**

- Keep `docs/strategy/` documentation current
- Update roadmap based on actual progress
- Document strategic shifts and rationale
- Maintain phase progression clarity

**Feedback Loop:**

- Close strategic issues with outcome notes
- Document what worked and what didn't
- Update strategic planner if patterns emerge
- Refine priority criteria based on experience

## Troubleshooting

### No Issues Generated

**Possible Causes:**

- Bot performing optimally (no improvements identified)
- Data sources unavailable (snapshots, PTR stats)
- All opportunities already have open issues
- Strategic planning run failed or timed out

**Resolution:**

1. Check workflow logs for errors
2. Verify data availability in `reports/`
3. Review existing open issues for coverage
4. Consider manual trigger with verbose logging

### Too Many Low-Priority Issues

**Possible Causes:**

- Threshold tuning needed for priority assignment
- Micro-optimization focus without profiler data
- Lack of high-impact opportunities

**Resolution:**

1. Review priority criteria in prompt
2. Enable profiler for evidence-based optimization
3. Close or consolidate low-impact issues
4. Focus strategic planning on key bottlenecks

### Duplicate Issues

**Possible Causes:**

- Issue search not detecting similar existing issues
- Related improvements split across multiple issues

**Resolution:**

1. Close duplicate issues with reference to original
2. Improve issue search criteria in prompt
3. Consolidate related improvements into comprehensive issues

### Documentation Conflicts

**Possible Causes:**

- Concurrent documentation updates
- Strategic planning modifying same files as manual edits

**Resolution:**

1. Review and merge documentation changes
2. Coordinate strategic planning timing with manual updates
3. Use PR-based documentation updates if conflicts persist

## Metrics and Monitoring

### Success Metrics

**Issue Quality:**

- 80%+ of generated issues implemented without major reformulation
- Clear acceptance criteria and evidence in all issues
- Appropriate priority assignment (validated by outcomes)

**Strategic Impact:**

- Measurable bot performance improvement from implemented issues
- Reduced manual planning overhead
- Improved strategic alignment across work items

**Automation Health:**

- Strategic planning runs complete successfully
- Data sources consistently available
- Documentation stays current with strategic shifts

### Monitoring Points

**Workflow Health:**

- Run success rate
- Execution time trends
- Error patterns

**Data Availability:**

- Bot snapshot freshness
- PTR stats collection success
- Profiler data presence

**Issue Outcomes:**

- Implementation success rate
- Time to implementation
- Actual vs predicted impact

## Future Enhancements

### Planned Improvements

**Enhanced Data Analysis:**

- Time-series trend analysis for performance metrics
- Correlation analysis between changes and outcomes
- Predictive modeling for strategic planning

**Improved Learning:**

- Outcome tracking for generated issues
- Automatic priority adjustment based on results
- Pattern recognition in successful implementations

**Documentation Intelligence:**

- Automated strategic roadmap updates
- Learning documentation generation
- Migration guide creation for major shifts

**Integration Expansion:**

- Direct integration with Todo automation
- Coordinated planning across multiple agents
- Strategic planning API for external tools

### Research Areas

**Strategic Intelligence:**

- Game theory analysis for multi-room strategy
- Optimization modeling for resource allocation
- Simulation-based strategic planning

**Continuous Learning:**

- Reinforcement learning from outcomes
- Meta-learning for planning strategies
- Transfer learning from similar bots

## Related Documentation

- [Automation Overview](./overview.md) - Autonomous agent ecosystem
- [Autonomous Monitoring](./autonomous-monitoring.md) - Strategic monitoring system
- [Todo Automation](./todo-automation.md) - Issue implementation workflow
- [Strategic Roadmap](../strategy/roadmap.md) - Current strategic goals
- [Architecture](../strategy/architecture.md) - Bot architecture overview

## Support

For issues with strategic planning:

1. Check workflow logs: `gh run list --workflow=copilot-strategic-planner.yml`
2. Review generated issues: `gh issue list --label strategic-planning`
3. Verify data sources: `ls -la reports/bot-snapshots/ reports/copilot/`
4. Create issue: `gh issue create --title "Strategic Planning: <issue>" --label automation`

For strategic guidance or priorities:

1. Review current roadmap: `docs/strategy/roadmap.md`
2. Check strategic planning reports: `gh run download <run-id>`
3. Consult strategic planning issues: `gh issue list --label strategic-planning`
