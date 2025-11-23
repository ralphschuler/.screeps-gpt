# Automation Overview

This document provides a comprehensive overview of the repository's automation architecture, including consolidated agent workflows, composite actions, and workflow specifications.

## Architecture Overview

The automation system is built around **GitHub Actions workflows** that leverage **GitHub Copilot CLI** through reusable **composite actions**. The system follows a **unified agent pattern** where similar operations are consolidated into parameterized agents with role-based behavior.

### Core Components

1. **Workflows** (`.github/workflows/*.yml`) - Event-driven automation triggers
2. **Composite Actions** (`.github/actions/*/action.yml`) - Reusable agent implementations
3. **Prompt Templates** (`.github/copilot/prompts/*`) - Role-specific instructions for Copilot
4. **Scripts** (`packages/utilities/scripts/*.ts`) - Utility scripts for telemetry and analysis

## Unified Agent Architecture

### Consolidation Principle

The repository uses a **unified agent pattern** to reduce maintenance burden and improve consistency:

- **Similar operations** are consolidated into single agents with mode parameters
- **Distinct responsibilities** remain in separate agents
- **Shared infrastructure** (copilot-exec) provides consistent execution environment

### Consolidated Agents

#### 1. Copilot Issue Agent

**Location**: `.github/actions/copilot-issue-agent/`

**Purpose**: Unified issue management with role-based behavior

**Modes**:
- `triage` - Reformulate and label new issues with duplicate detection
- `resolve` - Implement solutions via draft PRs with progress tracking
- `analyze` - Context gathering and relationship analysis

**Used By**:
- `copilot-issue-triage.yml` - Automatic triage on issue open/reopen
- `copilot-todo-pr.yml` - Automatic implementation when `Todo` label applied

**Benefits**:
- Single action to maintain instead of separate triage/dev agents
- Consistent issue handling across lifecycle stages
- Shared context gathering and relationship detection
- Unified error handling and logging

#### 2. Copilot Audit Agent

**Location**: `.github/actions/copilot-audit-agent/`

**Purpose**: Scheduled repository health checks and quality assessments

**Used By**:
- `copilot-review.yml` - Daily repository audits

**Responsibilities**:
- TypeScript runtime correctness analysis
- Automation workflow quality evaluation
- Documentation gap detection
- Strategic recommendations

#### 3. Screeps Monitoring

**Location**: `.github/workflows/screeps-monitoring.yml` (standalone workflow)

**Purpose**: PTR telemetry collection and strategic analysis

**Note**: Kept separate due to distinct telemetry focus and complex data pipeline

**Responsibilities**:
- PTR stats collection with resilient telemetry
- Bot state snapshot management
- Performance baseline establishment
- Health check and anomaly detection

## Workflow Specifications

### Issue Management Workflows

#### Copilot Issue Triage

**File**: `.github/workflows/copilot-issue-triage.yml`

**Trigger**: `issues` (opened, reopened)

**Purpose**: Automatic issue reformulation and labeling

**Flow**:
1. Check out repository
2. Run unified issue agent in `triage` mode
3. Update project status to "Backlog" with "Triaged" automation state

**Key Features**:
- Duplicate detection using GitHub MCP server
- Automatic title reformulation with conventional commit prefixes
- Context-aware label application
- Related issue and PR linking
- Sub-task relationship detection

#### Copilot Todo PR

**File**: `.github/workflows/copilot-todo-pr.yml`

**Trigger**: `issues` (labeled with "Todo")

**Purpose**: Automatic issue resolution via draft pull requests

**Flow**:
1. Check out repository
2. Update project status to "In Progress" with "Implementing" automation state
3. Run unified issue agent in `resolve` mode
4. Update project status to "Under Review" with "PR Created" automation state on success

**Key Features**:
- Dependency validation before implementation
- Draft PR creation with implementation plan
- Incremental progress updates via `report_progress` tool
- Automated testing and validation
- PR marked ready for review after validation

### Quality Assurance Workflows

#### Copilot Repository Audit

**File**: `.github/workflows/copilot-review.yml`

**Trigger**: `schedule` (daily at 9 AM UTC), `workflow_dispatch`

**Purpose**: Scheduled repository health checks and quality assessments

**Flow**:
1. Check out repository
2. Run audit agent with comprehensive analysis
3. Create or update issues for actionable findings

**Key Features**:
- Runtime correctness analysis
- Automation workflow validation
- Documentation gap detection
- Duplicate issue prevention
- Automated issue creation with proper labels

### Monitoring Workflows

#### Screeps Monitoring

**File**: `.github/workflows/screeps-monitoring.yml`

**Trigger**: `schedule` (every 30 minutes), `workflow_run`, `workflow_dispatch`

**Purpose**: Comprehensive PTR monitoring and strategic analysis

**Flow**:
1. Collect PTR stats with resilient telemetry
2. Collect bot state snapshots
3. Validate telemetry health
4. Generate analytics from snapshots
5. Establish performance baselines (when ready)
6. Ensure profiler is running
7. Fetch and validate profiler data
8. Bot health check with graduated detection
9. Check for critical alerts and send notifications
10. Commit snapshots and health state

**Key Features**:
- Resilient telemetry with fallback sources
- Performance baseline establishment
- Graduated health detection
- Critical alert notifications (email + push)
- Automatic snapshot commits with retry logic

## Shared Infrastructure

### Copilot Exec Action

**Location**: `.github/actions/copilot-exec/`

**Purpose**: Standardized Copilot CLI execution with caching and MCP support

**Features**:
- Automatic prompt rendering with environment variable substitution
- Content-based caching for efficiency
- Configurable timeout (default 30 minutes)
- MCP (Model Context Protocol) configuration support
- Conditional repository checkout
- Dependency caching for faster execution
- Verbose logging for debugging

**Used By**: All Copilot agents (issue, audit, etc.)

**Benefits**:
- Consistent execution environment across agents
- Reduced workflow execution time via caching
- Simplified agent implementation (focus on prompts)
- Centralized error handling and logging

### Project Sync Action

**Location**: `.github/actions/project-sync/`

**Purpose**: GitHub Projects integration for automation state tracking

**Features**:
- Item status field updates
- Automation state field tracking
- Consistent state management across workflows

**Used By**: Issue triage and todo workflows

## Prompt Engineering

### Prompt Structure

All prompts follow a consistent structure:

1. **Role definition** - Agent identity and responsibilities
2. **Context provision** - Environment variables and metadata
3. **Mandatory actions** - Required steps with failure criteria
4. **Output requirements** - Expected results and formats
5. **Failure handling** - Graceful degradation strategies
6. **Execution checklist** - Step-by-step process
7. **Final output validation** - Verification and JSON output format

### Prompt Templates

| Template | Location | Purpose |
|----------|----------|---------|
| `issue-triage` | `.github/copilot/prompts/issue-triage` | Issue reformulation and labeling |
| `todo-issue` | `.github/copilot/prompts/todo-issue` | Issue resolution via PR |
| `repository-audit` | `.github/copilot/prompts/repository-audit` | Repository health checks |

### Environment Variables

Prompts use environment variable substitution for dynamic content:

- `${REPO_NAME}` - Repository name
- `${ISSUE_NUMBER}` - Issue number
- `${ISSUE_TITLE}` - Issue title (JSON-encoded)
- `${ISSUE_BODY}` - Issue body (JSON-encoded)
- `${ISSUE_HTML_URL}` - Issue URL
- `${ISSUE_AUTHOR}` - Issue author
- `${RUN_ID}` - Workflow run ID
- `${RUN_URL}` - Workflow run URL
- `${AGENT_MODE}` - Operation mode for unified agents

## Local Testing

### Testing Workflows with act

Use the `test:actions` script to dry-run workflows locally:

```bash
yarn test:actions
```

This uses `act` to simulate GitHub Actions workflow execution without requiring a live GitHub environment.

### Testing Composite Actions

Composite actions can be tested by:

1. Creating a minimal test workflow
2. Triggering with `workflow_dispatch`
3. Inspecting action outputs and logs

### Testing Prompt Templates

Prompts can be tested by:

1. Rendering with environment variables: `envsubst < prompt-file`
2. Validating syntax and structure
3. Running through Copilot CLI locally (requires Copilot access)

## Integration Points

### GitHub API Operations

Agents interact with GitHub through:

- **GitHub CLI** (`gh`) - Issue/PR creation, updates, comments
- **GitHub MCP Server** - Advanced queries (code search, relationship detection)
- **GitHub Actions API** - Workflow run metadata and job logs

### External Integrations

- **Screeps API** - PTR stats and bot state collection
- **Email SMTP** - Critical alert notifications
- **Push Notifications** - Mobile alert delivery

## Best Practices

### Workflow Design

1. **Keep workflows simple** - Complex logic belongs in composite actions or scripts
2. **Use concurrency groups** - Prevent overlapping runs with `concurrency` keys
3. **Set appropriate timeouts** - Prevent runaway workflows (default 45 minutes for agents)
4. **Handle failures gracefully** - Use `continue-on-error` and `if: always()` appropriately
5. **Document triggers clearly** - Explain when and why workflows run

### Composite Action Design

1. **Single responsibility** - Each action should have one clear purpose
2. **Parameterized behavior** - Use inputs for mode selection, not separate actions
3. **Consistent outputs** - Provide predictable output paths and metadata
4. **Verbose logging** - Support debug mode with detailed execution logs
5. **Error handling** - Validate inputs and provide clear error messages

### Prompt Engineering

1. **Clear instructions** - Be explicit about mandatory actions and failure criteria
2. **Structured output** - Use JSON for machine-parseable results
3. **Graceful degradation** - Specify fallback behavior when APIs fail
4. **Context awareness** - Provide relevant environment and repository information
5. **Validation steps** - Include verification checklists in prompts

## Maintenance Guidelines

### Updating Workflows

When updating workflows:

1. Review affected composite actions and prompts
2. Test changes with `workflow_dispatch` trigger first
3. Update documentation to reflect behavior changes
4. Consider backward compatibility with existing triggers
5. Update CHANGELOG.md with workflow modifications

### Updating Composite Actions

When updating composite actions:

1. Maintain input/output compatibility
2. Version major changes (e.g., `copilot-exec@v2`)
3. Update all workflows using the action
4. Document breaking changes in action README
5. Test with all dependent workflows

### Updating Prompt Templates

When updating prompts:

1. Cache invalidation happens automatically (content-based)
2. Test prompt rendering with `envsubst`
3. Verify all environment variables are available
4. Update documentation if output format changes
5. Consider impact on downstream processing

## Consolidation Rationale

### Why Consolidate?

The unified agent pattern addresses several challenges:

1. **Reduced duplication** - Similar operations shared common code (~70%)
2. **Easier maintenance** - Single point of update for shared functionality
3. **Consistent behavior** - Uniform error handling, logging, and context gathering
4. **Clearer intent** - Mode parameter makes operation explicit
5. **Testing efficiency** - Single entry point for all issue operations

### What Was Consolidated?

- **Issue Agent** - Merged `copilot-triage-agent` and `copilot-dev-agent`
  - Shared: Issue metadata handling, context gathering, GitHub API operations
  - Different: Triage reformulates issues, resolve creates PRs
  - Approach: Mode parameter selects prompt template and behavior

### What Remained Separate?

- **Audit Agent** - Distinct purpose (repository health checks vs issue management)
- **Monitoring Workflow** - Complex telemetry pipeline with unique requirements
- **CI Auto Issue** - Simple issue creation without Copilot interaction

### Benefits Realized

1. **Maintenance burden reduced** - One action instead of two for issue operations
2. **Consistency improved** - Shared validation and error handling
3. **Documentation simplified** - Single reference for issue operations
4. **Testing streamlined** - Unified test suite for issue agent
5. **Resource efficiency** - Reduced workflow complexity

## Future Enhancements

### Potential Consolidation Opportunities

1. **Strategic Planning Agent** - Could integrate with unified agent architecture
2. **Email Triage Agent** - Similar to issue triage, could use unified pattern
3. **Additional modes** - Extend issue agent with new operational modes

### Architectural Improvements

1. **Workflow composition** - Reusable workflow fragments for common patterns
2. **Enhanced caching** - More granular cache invalidation strategies
3. **Parallel execution** - Concurrent agent operations where appropriate
4. **Metrics collection** - Automated tracking of agent performance

## Related Documentation

- [Agent Guidelines](../../AGENTS.md) - Comprehensive agent rules and knowledge base
- [Monitoring Telemetry](./monitoring-telemetry.md) - PTR monitoring details
- [Repository README](../../README.md) - Automation promises and workflow summary
- [Action READMEs](../../.github/actions/) - Individual action documentation

## Support

For questions or issues with automation:

1. Review this documentation and action READMEs
2. Check workflow run logs for detailed execution traces
3. Use `verbose: true` in action inputs for debug logging
4. Create an issue with `automation` label for assistance
