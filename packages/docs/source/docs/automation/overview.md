---
title: Automation Overview
date: 2025-11-14T09:00:00.000Z
layout: page
---

# Automation Overview

This document expands on the workflows under `.github/workflows/` and how they combine with the Copilot CLI.

## GitHub Projects Integration

The repository includes comprehensive GitHub Projects V2 integration that automatically tracks issues, pull requests, and discussions through their entire lifecycle.

### Project Management Workflows

**Automated Item Sync** (`project-sync-items.yml`):

- Automatically adds new issues, PRs, and discussions to the project board
- Sets initial status to "Pending" and automation state to "Not Started"
- Triggers on: issue/PR opened or reopened, discussion created

**PR Status Tracking** (`project-pr-status.yml`):

- Tracks pull request lifecycle and review states
- Updates status based on draft/ready state and review outcomes
- Automation states: Draft, Ready for Review, Review Requested, Reviewed, Approved, Changes Requested, Merged, Closed without Merge
- Triggers on: PR ready_for_review, converted_to_draft, review_requested, review_submitted, closed

**Comment Activity Tracking** (`project-comment-activity.yml`):

- Marks items with active discussion when comments are added
- Helps identify items requiring attention
- Triggers on: issue_comment, pull_request_review_comment created

### Integration with Copilot Workflows

Integrated Copilot workflows update project status automatically:

**Issue Triage** (`copilot-issue-triage.yml`):

- After triage: Status → "Backlog", Automation State → "Triaged"
- Indicates issue has been processed and categorized

**Todo Automation** (`copilot-todo-pr.yml`):

- On start: Status → "In Progress", Automation State → "Implementing"
- On completion: Status → "Under Review", Automation State → "PR Created"
- Tracks automated implementation from start to PR creation

**Note**: CI Auto Issue and Repository Audit workflows do not currently update project status due to GitHub Projects limitation - workflow runs cannot be tracked as project items (only issues, PRs, and discussions are supported). However, CI Auto Issue creates tracking issues which can be added to projects.

### Project Board Configuration

The system expects the following project fields:

- **Status**: Pending, Backlog, In Progress, Under Review, Blocked, Done, Canceled
- **Priority**: Critical, High, Medium, Low, None
- **Type**: Bug, Feature, Enhancement, Chore, Question
- **Automation State**: Various states tracking automation pipeline progress
- **Domain**: Runtime, Automation, Documentation, Dependencies, Monitoring, Infrastructure

See [GitHub Projects Setup Guide](./github-projects-setup.md) for complete configuration instructions.

### Configuration Variables

Set the following repository variables to enable project integration:

- `PROJECT_NUMBER`: GitHub Project number (e.g., `1`)
- `PROJECT_OWNER`: Project owner username or organization name

**Graceful Degradation**: If these variables are not set, workflows will skip project sync operations and continue normally. This allows opt-in project integration without breaking existing functionality.

### Project Sync Composite Action

The `project-sync` composite action (`.github/actions/project-sync/action.yml`) provides centralized project management functionality:

**Features**:

- Adds items to project board using GitHub CLI
- Updates project field values (Status, Priority, Automation State)
- Gracefully handles missing configuration (non-fatal failures)
- Supports issues, pull requests, and discussions
- Provides detailed logging of sync operations

**Usage Example**:

```yaml
- name: Update project status
  uses: ./.github/actions/project-sync
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    project-number: ${{ vars.PROJECT_NUMBER }}
    project-owner: ${{ vars.PROJECT_OWNER }}
    item-type: issue
    item-url: ${{ github.event.issue.html_url }}
    status-field: In Progress
    automation-state-field: Implementing
```

### Benefits

- **Full Lifecycle Visibility**: Track items from creation through completion
- **Automation Pipeline Monitoring**: See which items are being processed by Copilot workflows
- **Bottleneck Identification**: Quickly identify items stuck in specific states
- **Historical Tracking**: Maintain project history with automation state transitions
- **Integration with Existing Tools**: Works seamlessly with Copilot workflows and label system

## Build and Deployment

The repository supports two deployment architectures:

- **Single Bundle (Default)**: All code bundled into `dist/main.js`
- **Modular**: Separate modules for each runtime component

See [Modular Deployment Architecture](./modular-deployment.md) for details on the modular system, including usage, benefits, and configuration options.

## Copilot Model Configuration

All Copilot workflows use the `copilot-exec` composite action (`.github/actions/copilot-exec/action.yml`), which provides centralized model selection with a flexible fallback chain.

### Performance Optimizations

The `copilot-exec` action includes several performance optimizations to reduce workflow execution time:

1. **Conditional Repository Checkout**: Automatically detects if the repository is already checked out and skips the checkout step when not needed
2. **npm Global Cache**: Caches the `@github/copilot` CLI installation with stable cache keys to avoid repeated downloads
3. **Project Dependency Cache**: Caches `node_modules` based on `package-lock.json` hash for faster dependency resolution
4. **Result Caching**: Caches Copilot CLI output based on prompt SHA and model to avoid redundant AI calls for identical inputs
5. **Timing Measurements**: Provides detailed execution timing in verbose mode for performance monitoring

These optimizations significantly reduce workflow execution time, particularly for workflows that run frequently like issue triage and monitoring.

### Workflow Caching Strategy

All primary workflows implement multi-layer caching to minimize execution time and GitHub Actions minutes consumption:

1. **Node.js 16 Installation Cache**: The `setup-node16` action caches Node.js binaries based on OS, architecture, and version, avoiding repeated downloads (saves ~30-60s per workflow run)

2. **Python 2 Installation Cache**: The `setup-python2` action caches Python binaries and ccache with stable cache keys, eliminating repeated builds (saves ~60-120s per workflow run)

3. **npm Dependency Cache**: All workflows cache `node_modules` and `~/.npm` based on `package-lock.json` hash with restore keys for partial matches (saves ~30-45s per workflow run)

4. **Build Output Cache**: Quality-gate and deploy workflows cache the `dist/` folder based on source file hashes, avoiding redundant builds (saves ~5-10s per workflow run)

**Expected Performance Impact:**

- Quality gate runtime: ~90 seconds with cache hits (50% improvement from ~2-3 minutes)
- Deploy workflow runtime: ~45 seconds with cache hits (60% improvement from ~1-2 minutes)
- Cache hit ratio: Expected >80% for stable codebases
- Overall workflow minutes reduction: 50%+ for active repositories

**Cache Key Strategy:**

- Stable versioned keys (e.g., `v2`) for environment setups to maximize cache hits across workflow updates
- Content-based keys (e.g., `hashFiles('src/**/*')`) for build outputs to ensure correctness
- Restore keys with prefixes for graceful fallback when exact matches fail

### Model Resolution Priority

The model is resolved in the following order:

1. **Workflow input parameter** – Explicit `model:` parameter passed to `copilot-exec`
2. **`COPILOT_MODEL` environment variable** – Can be set at workflow, job, or step level
3. **Copilot CLI default** – If no model is specified, the Copilot CLI uses its own default model

### Override Examples

**Repository-wide override** using GitHub Actions variables:

1. Navigate to repository Settings → Secrets and variables → Actions → Variables
2. Create a new variable `COPILOT_MODEL` with value `gpt-4o`
3. Reference in workflows: `COPILOT_MODEL: ${{ vars.COPILOT_MODEL }}`

**Workflow-specific override**:

```yaml
- name: Run Copilot with specific model
  uses: ./.github/actions/copilot-exec
  with:
    model: "gpt-4o"
    prompt-path: .github/copilot/prompts/custom-prompt
```

**Environment variable override**:

```yaml
env:
  COPILOT_MODEL: "gpt-4o"
```

### Logging and Validation

The `copilot-exec` action logs the selected model at runtime. Enable verbose mode to see the full resolution chain:

```yaml
with:
  verbose: "true"
```

This will output:

- Which configuration source was used (input, env var, config file, or default)
- The final selected model
- Cache key information

## Specialized Copilot Agent Actions

The repository uses a specialized agent architecture for Copilot automation, where each agent handles a specific type of task with focused functionality and minimal input requirements.

### Architecture Overview

**Design Principles:**

- **Unified Agent Pattern**: Similar operations consolidated into single agents with role-based behavior
- **Mode-Based Execution**: Agents accept a `mode` parameter to select operational behavior
- **Minimal Input Requirements**: Accept only essential parameters (copilot-token + task-specific inputs)
- **Consistent Interface**: Standardized input/output patterns across all agents
- **Composable**: Agents can be combined in workflows without conflicts
- **Built on copilot-exec**: All agents leverage the existing `copilot-exec` composite action

**Consolidation Benefits:**

- **Reduced Maintenance**: Single agent to maintain instead of multiple similar agents (~70% shared logic)
- **Consistent Behavior**: Shared infrastructure and validation logic across modes
- **Easier Testing**: Single entry point for related operations
- **Clear Intent**: Mode parameter makes operational intent explicit
- **Simplified Debugging**: Consistent logging and error handling

**Agent Implementations:**

All specialized agents are located in `.github/actions/copilot-*-agent/` directories and provide wrappers around `copilot-exec` with task-specific configurations. The repository uses **unified agents** where appropriate to consolidate similar operations.

### Available Agents

**copilot-issue-agent** (`.github/actions/copilot-issue-agent/`) - **UNIFIED AGENT**:

- **Purpose**: Multi-mode issue management with role-based behavior
- **Modes**:
  - `triage` - Reformulate and label new issues with duplicate detection
  - `resolve` - Implement solutions via draft PRs with progress tracking
- **Key Features**:
  - Context-aware issue analysis with duplicate detection
  - Automatic reformulation of title and description (triage mode)
  - Intelligent label application based on content (triage mode)
  - Related issue linking and relationship management
  - Code implementation with progress tracking (resolve mode)
  - Dependency and sub-task validation (resolve mode)
  - Incremental commits and automated testing (resolve mode)
- **Required Inputs**: `copilot-token`, `mode`, `issue-number`, `issue-title`, `issue-url`, `issue-author`
- **Used By**: `copilot-issue-triage.yml` (triage mode), `copilot-todo-pr.yml` (resolve mode)
- **Replaces**: `copilot-triage-agent` and `copilot-dev-agent` (legacy)

**copilot-review-agent** (`.github/actions/copilot-review-agent/`):

- **Purpose**: Repository reviews and quality assessment
- **Key Features**:
  - Comprehensive repository audit
  - Automated issue filing for identified problems
  - Duplicate detection and prevention
  - Severity assessment and prioritization
- **Required Inputs**: `copilot-token`
- **Used By**: Currently available but not used by any workflow (uses `repository-review` prompt for more comprehensive analysis than `repository-audit`)

**copilot-audit-agent** (`.github/actions/copilot-audit-agent/`):

- **Purpose**: Scheduled repository health checks
- **Key Features**:
  - Periodic repository health assessment
  - Automation and workflow quality evaluation
  - Strategic recommendations for improvements
  - Trend analysis and performance tracking
- **Required Inputs**: `copilot-token`
- **Used By**: `copilot-review.yml`

**Strategic Planning Workflow** (`copilot-strategic-planner.yml`):

- **Purpose**: Autonomous strategic planning and improvement roadmap generation
- **Key Features**:
  - Bot performance analysis from snapshots and PTR telemetry
  - Profiler-driven CPU bottleneck identification
  - Strategic opportunity identification across six categories
  - Evidence-based issue creation with priorities
  - Documentation updates for strategic alignment
  - Learning feedback loop from past implementations
- **Data Sources**: Bot snapshots, PTR stats, profiler data, documentation, issue history
- **Schedule**: Every 8 hours
- **Documentation**: [Strategic Planning Guide](./strategic-planning.md)
- **Used By**: Direct workflow invocation via `copilot-exec` with `strategic-planner` prompt



### Usage Examples

**Using the Unified Issue Agent (Triage Mode):**

```yaml
- name: Triage issue
  uses: ./.github/actions/copilot-issue-agent
  with:
    copilot-token: ${{ secrets.COPILOT_TOKEN }}
    mode: triage
    issue-number: ${{ github.event.issue.number }}
    issue-title: ${{ toJSON(github.event.issue.title) }}
    issue-body: ${{ toJSON(github.event.issue.body || '') }}
    issue-url: ${{ toJSON(github.event.issue.html_url) }}
    issue-author: ${{ toJSON(github.event.issue.user.login) }}
```

**Using the Unified Issue Agent (Resolve Mode):**

```yaml
- name: Resolve issue via PR
  uses: ./.github/actions/copilot-issue-agent
  with:
    copilot-token: ${{ secrets.COPILOT_TOKEN }}
    mode: resolve
    issue-number: ${{ github.event.issue.number }}
    issue-title: ${{ toJSON(github.event.issue.title) }}
    issue-body: ${{ toJSON(github.event.issue.body || '') }}
    issue-url: ${{ toJSON(github.event.issue.html_url) }}
    issue-author: ${{ toJSON(github.event.issue.user.login) }}
    timeout: "45"
```

**Using the Audit Agent:**

```yaml
- name: Run repository audit
  uses: ./.github/actions/copilot-audit-agent
  with:
    copilot-token: ${{ secrets.COPILOT_TOKEN }}
    run-url: https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

### Benefits of Unified Agent Architecture

1. **Reduced Maintenance Burden**: Single agent to maintain instead of multiple similar agents
2. **Consistent Behavior**: Shared infrastructure and validation logic across operational modes
3. **Easier Testing**: Single entry point for all issue management operations
4. **Clear Intent**: Mode parameter makes operational purpose explicit
5. **Simplified Debugging**: Consistent logging and error handling across modes
6. **Better Maintainability**: Agent-specific changes affect all related operations consistently
7. **Clear Contracts**: Well-defined input/output interfaces for each automation type
8. **Optimized Configuration**: Mode-specific defaults and timeouts for each task type
9. **Reusability**: Agents can be easily reused across multiple workflows with different modes

### Backward Compatibility

The generic `copilot-exec` composite action remains available for custom use cases and workflows that don't fit into the specialized agent categories. All specialized agents are built on top of `copilot-exec`, ensuring consistent behavior and shared optimizations.

### Creating New Agents

To create a new specialized agent:

1. Create a new directory: `.github/actions/copilot-{name}-agent/`
2. Define the agent action in `action.yml` with:
   - Clear description of purpose and features
   - Minimal required inputs specific to the task
   - Sensible defaults for optional parameters
   - Output path for result logs
3. Use `copilot-exec` as the underlying implementation
4. Map agent inputs to appropriate environment variables
5. Reference an existing or new prompt template in `.github/copilot/prompts/`
6. Update this documentation with the new agent's details

## Task Management System

The runtime includes a priority-based task management system for coordinating creep work assignments:

### Task Flow

1. **Task Generation** - Each tick, the `TaskManager` scans rooms to generate tasks based on:
   - Active sources (harvest tasks)
   - Construction sites (build tasks)
   - Damaged structures (repair tasks)
   - Controllers (upgrade tasks)
   - Energy distribution needs (transfer/withdraw tasks)

2. **Task Assignment** - Idle creeps (no current task) are matched with pending tasks:
   - Tasks are sorted by priority (CRITICAL > HIGH > NORMAL > LOW > IDLE)
   - Prerequisites are checked (body parts, energy, capacity, proximity)
   - Highest priority compatible task is assigned to each creep

3. **Task Execution** - Assigned creeps execute their tasks:
   - CPU budget is monitored to prevent timeouts
   - Task actions return completion status
   - Completed tasks are removed from the queue
   - Failed/expired tasks are cleaned up

4. **Cleanup** - Each tick removes:
   - Completed tasks
   - Expired tasks (past deadline)
   - Tasks with invalid targets (deleted objects)

### Task Interface

Tasks implement the `Task` interface defined in `src/shared/contracts.ts`:

- **id**: Unique identifier
- **type**: Human-readable type (e.g., "harvest", "build")
- **status**: PENDING, INPROCESS, COMPLETE, or FAILED
- **priority**: TaskPriority enum value
- **targetId**: Game object ID being targeted
- **targetRoom**: Room name for cross-room tasks
- **canAssign(creep)**: Check if task can be assigned
- **assign(creep)**: Assign task to a creep
- **execute(creep)**: Execute the task action
- **isExpired()**: Check if task has exceeded deadline

### CPU Threshold Management

The `TaskManager` respects CPU budgets to prevent script timeouts:

- Configurable threshold (default 80% of limit)
- Stops processing creeps when threshold is reached
- Logs warnings when creeps are skipped
- Ensures critical operations complete before timeout

### Testing

Task system behavior is validated by regression tests in `tests/regression/task-assignment.test.ts` covering:

- Task generation for different room states
- Priority-based assignment logic
- CPU threshold enforcement
- Task cleanup and expiration
- Error handling for invalid targets

## Quality Guards

Quality checks are consolidated into efficient guard workflows using strategy matrices for parallel execution and faster feedback:

### Guard - Code Quality (`guard-code-quality.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Runs multiple code quality checks in parallel using strategy matrix:
  - **lint** - ESLint code quality checks
  - **format** - Prettier formatting validation
  - **yaml-lint** - YAML workflow file linting
- Benefits: Single workflow file, parallel execution, reduced overhead

### Guard - Tests (`guard-tests.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Runs all test suites in parallel using strategy matrix:
  - **unit** - Unit test execution
  - **e2e** - PTR end-to-end tests
  - **regression** - Regression test validation
  - **docs** - Documentation build and validation tests
- Benefits: Single workflow file, parallel test execution, faster feedback
- Notes: E2E tests in `tests/e2e/` are mocked and do not require PTR secrets or a live Screeps server. They only use `SCREEPS_TEST_REALM` and `SCREEPS_HOST` environment variables for labeling, with defaults that work without secrets. Regression test failures must be reproduced with a regression test before applying fixes (see repository rules in [README](../../README.md)).

### Guard - Version Index (`guard-version.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Verification that `docs/changelog/versions.json` and `docs/changelog/versions.md` match `yarn run versions:update`.

### Guard - Build (`guard-build.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Build validation with caching.

### Guard - Coverage (`guard-coverage.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Test coverage reporting and evaluation artifact upload.

## Quality Gate (Guard Workflows)

The quality gate system has been refactored from a monolithic `quality-gate.yml` into modular guard workflows for better granularity, parallel execution, and faster feedback:

### Individual Guard Workflows

#### Required Guards (enforced for branch protection)

- **guard-tests.yml** - Executes all test suites in parallel (unit, e2e, regression, docs)
- **guard-build.yml** - Validates build process (compilation and bundling)
- **guard-code-quality.yml** - Runs code quality checks in parallel (lint, format, yaml-lint)

These three consolidated guards are required for branch protection and must pass for a pull request to be merged.

#### Optional/Supplementary Guards

- **guard-version.yml** - Checks version consistency
- **guard-coverage.yml** - Reports test coverage metrics
- **guard-deprecation.yml** - Detects deprecated API usage
- **guard-security-audit.yml** - Performs security vulnerability scanning

These supplementary guards provide additional quality signals and reporting, but are not required for branch protection. Failures in these checks will be surfaced in the PR, but do not block merging.

### Quality Gate Summary (`quality-gate-summary.yml`)

Provides a single, reliable quality gate status for PRs by aggregating results from consolidated guard workflows:

- **Trigger**: Pull requests to `main` branch
- **Behaviour**: Polls guard workflow results and reports unified pass/fail status
- **Required Guards for Branch Protection**: Tests, Build, Code Quality (see above)
- **Features**:
  - Waits up to 25 minutes for guards to complete
  - Treats `action_required` (cancelled by concurrency) as non-blocking
  - Provides single check for branch protection requirements
  - Never cancelled by concurrency to ensure definitive reporting
  - Monitors consolidated workflows for efficient parallel execution

> **Note:** Only the required guards listed above are enforced for branch protection. Optional/supplementary guards provide additional feedback but do not block merging.

This consolidated architecture using strategy matrices allows multiple checks to run in parallel within each guard workflow, providing faster feedback while maintaining clear separation of concerns.

## Post Merge Release (`post-merge-release.yml`)

- Trigger: Pushes to `main` (excludes release commits to prevent recursion).
- Behaviour: Applies lint/format fixes, uses semantic versioning based on conventional commits to determine version bump type (major/minor/patch), commits version bump directly to main, creates a version tag, and creates a GitHub Release using the native API with auto-generated release notes.
- Semantic Versioning: Analyzes commits since the last version tag using conventional commit format:
  - `feat:` commits trigger **minor** version bumps (0.1.0 → 0.2.0)
  - `fix:`, `chore:`, `docs:` trigger **patch** version bumps (0.1.0 → 0.1.1)
  - `BREAKING CHANGE:` in commit body or `!` after type triggers **major** version bumps (1.0.0 → 2.0.0)
  - Note: During pre-1.0 development, major bumps are converted to minor bumps per semver specification
- Secrets: Uses the default `GITHUB_TOKEN` with elevated `contents: write` and `pull-requests: write` permissions.
- Notes: Skips execution when commit message contains "chore(release):" to prevent recursive workflow runs. No longer creates release PRs - releases are created automatically.

## Deploy (`deploy.yml`)

- Trigger: Tags that match `v*` pattern (e.g., `v1.0.0`, `v0.5.1`).
- Behaviour: Builds and pushes code to the Screeps API. After successful deployment, automatically checks spawn status and triggers respawn if needed. Uses GitHub's `production` environment for deployment protection rules and approval workflows. Set `SCREEPS_DEPLOY_DRY_RUN=true` for local `act` dry-runs to skip the API call. Sends push notifications on deployment success (Priority 3) and failure (Priority 5) via Push by Techulus.
- Environment: Uses GitHub environment `production` with URL `https://screeps.com` for deployment tracking and protection rules.
- Auto-Respawn: The `screeps-autospawner` action checks spawn status after deployment. If the bot is already active (status: "normal"), it exits early with no action. If the bot needs respawning (status: "lost" or "empty"), it is automatically respawned—no manual intervention is required.
- Push Notifications: Sent for all deployment outcomes with workflow run links. See [Push Notifications Guide](push-notifications.md) for details.
- Secrets: `SCREEPS_TOKEN` (required), `SCREEPS_HOST`/`PORT`/`PROTOCOL`/`BRANCH` (optional overrides). `PUSH_TOKEN` (optional) for deployment alerts.
- Notes: Deployment is triggered automatically when the `post-merge-release.yml` workflow pushes a version tag. The workflow uses only the `push.tags` trigger because GitHub Actions does not trigger `release.published` events when releases are created by workflows using `GITHUB_TOKEN` (security measure to prevent recursive workflow execution). The autospawner ensures the bot is active after each deployment.

## Publish Package (`publish-package.yml`)

- Trigger: Release published + manual dispatch with optional version tag input.
- Behaviour: Publishes the bot as an npm package to GitHub Packages registry for use as an NPC bot on private Screeps servers. The workflow builds the project, verifies the output, and publishes to `@ralphschuler/screeps-gpt` on GitHub Packages.
- Package Configuration: The package includes the `screeps_bot: true` flag in package.json, making it compatible with Screeps private server bot loading. The main entry point is `dist/main.js`.
- Installation: Users can install via `npm install @ralphschuler/screeps-gpt` after configuring npm to use GitHub Packages registry.
- Usage: On private servers, spawn the bot with `bots.spawn('screeps-gpt', 'ROOM_NAME', options)`.
- Permissions: Requires `packages: write` permission to publish to GitHub Packages.
- Secrets: Uses `GITHUB_TOKEN` for authentication.
- Notes: The `prepublishOnly` script ensures the project is built before publishing. Published artifacts include dist/main.js, dist/main.js.map, README.md, and LICENSE.

## Copilot Repository Review (`copilot-review.yml`)

- Trigger: Daily schedule + manual dispatch.
- Behaviour: Copilot authenticates with `gh`, clones the repo, audits automation/runtime quality, files or updates GitHub issues directly, and prints a JSON recap to the logs.
- Output: Summary is logged instead of uploading an artifact.
- Action Enforcement: Mandatory comprehensive audit with actionable finding criteria, issue quality validation, duplicate prevention, and severity assessment guidelines.

## Documentation Pages (`docs-pages.yml`)

- Trigger: Pushes to `main`, published releases, and manual dispatches.
- Behaviour: Builds and deploys documentation site with post-deployment validation:
  1. **Build**: Executes `bun run versions:update`, generates analytics data, and builds documentation site with Hexo
  2. **Deploy**: Publishes `build/docs-site` to GitHub Pages
  3. **Validate**: Runs E2E tests against deployed site to verify accessibility and functionality
- Testing: Post-deployment validation includes homepage accessibility checks, key page validation, link checking, and asset loading verification
- Permissions: Requires `pages: write` and `id-token: write`.
- Notes: E2E tests run against https://nyphon.de/.screeps-gpt/ after deployment completes. Test failures indicate deployment issues requiring investigation.

## Changelog to Blog Automation (`copilot-changelog-to-blog.yml`)

- Trigger: Version tags matching `v*` pattern (e.g., `v0.12.0`) + manual dispatch with version input.
- Behaviour: Automatically converts CHANGELOG.md entries into comprehensive blog posts by:
  - Extracting the changelog section for the specified version
  - Using Copilot to generate a detailed blog post with design rationale and implementation context
  - Creating proper front matter (title, date, categories, tags) based on release content
  - Writing blog post to `source/_posts/release-{version-slug}.md`
  - Including technical deep-dives that explain WHY decisions were made, not just WHAT changed
  - Referencing specific files, functions, and modules with architectural context
  - Connecting features to broader project goals (autonomous development, workflow automation)
- Integration: Works seamlessly with the release process - `post-merge-release.yml` creates version tags which automatically trigger blog post generation.
- Output: Blog posts are committed directly to the repository, triggering `docs-pages.yml` to rebuild and deploy the documentation site.
- Manual Execution: Use workflow_dispatch with version parameter (e.g., "0.12.0") to generate blog posts for existing releases.
- Validation: Checks if blog post already exists before generation to avoid duplicates.
- Content Style: Technical but accessible, targeting developers interested in Screeps automation and AI-driven development.
- Target Length: 800-1500 words depending on release complexity.
- Permissions: Uses the default `GITHUB_TOKEN` with `contents: write` for committing blog posts.
- Concurrency: Single execution per tag via `${{ github.workflow }}-${{ github.ref }}` concurrency group.
- Action Enforcement: Mandatory changelog extraction validation, comprehensive blog post structure with introduction/features/technical details/impact/future sections, design rationale for all major features, and proper markdown formatting.

## Copilot Issue Triage (`copilot-issue-triage.yml`)

- Trigger: Issues opened or reopened.
- Behaviour: Copilot performs comprehensive context-aware triage by:
  - Fetching all existing open issues for duplicate detection and relationship analysis
  - **Gathering code context** by searching for related files in `.github/workflows/`, `.github/actions/`, `src/`, `tests/` directories
  - **Cross-referencing issues** to find related open and closed issues with similar keywords or technical context
  - **Cross-referencing pull requests** to find related PRs that touch similar code or address related problems
  - Detecting and handling duplicate issues automatically (comments on both issues, closes duplicate with "duplicate" reason)
  - Identifying related issues, sub-tasks, and parent-child relationships
  - Reformulating title and description to clearly outline required changes and expectations
  - Including discovered context in reformulated body: "Related Code", "Related Issues", "Related PRs" sections
  - Applying appropriate labels based on content analysis (**excludes automatic Todo labeling** per issue #78)
  - Linking related issues in the reformulated description
  - Establishing sub-issue connections via GitHub CLI when parent-child relationships are detected
  - Adding a single triage comment with summary, discovered context, and recommendations (avoids redundant comments)
- Permissions: Uses the default `GITHUB_TOKEN` with `issues: write` to edit issue metadata, add comments, and close duplicates.
- Integration: Uses GitHub MCP server for querying issues, searching code, and performing relationship analysis.
- Action Enforcement: Mandatory reformulation, labeling, and triage comments with failure handling for API issues.

## Copilot Todo Automation (`copilot-todo-pr.yml`)

- Trigger: Issues labelled `Todo`.
- Behaviour: Copilot performs context-aware implementation by:
  - Checking for related issues, sub-tasks, and dependencies via GitHub MCP server
  - Verifying all dependent sub-tasks are completed before proceeding (blocks execution if incomplete)
  - Cloning the repository and creating a `copilot/todo-*` branch
  - **Creating a draft pull request immediately** for transparency and user visibility
  - Implementing the fix incrementally with frequent progress updates using the `report_progress` tool
  - Showing which files are being modified and why through commit messages and PR description updates
  - Running npm checks (`bun run lint`, `bun run test:unit`, etc.) and reporting results
  - Considering any related issues mentioned in the issue body during implementation
  - Mentioning related issues in the PR description when applicable
  - **Marking the PR as ready for review** once all changes are validated
  - Commenting back on the triggering issue with the draft PR link
  - Noting if the issue is a parent with sub-tasks that may need updates
- Permissions: Uses the default `GITHUB_TOKEN` for `gh` pushes, PR creation, issue comments, and PR status updates.
- Integration: Uses GitHub MCP server for dependency and relationship analysis.
- Visibility: Users can follow along with the implementation process in real-time through the draft PR and commit history.
- Action Enforcement: Mandatory dependency validation, PR creation, progress reporting, and validation testing with comprehensive failure handling.

## Copilot Daily Todo Prioritization (`copilot-todo-daily.yml`)

- Trigger: Daily schedule (9:00 AM UTC) + manual dispatch.
- Behaviour: Copilot automatically identifies the oldest actionable issue (no incomplete sub-tasks) without the Todo label, applies the Todo label to trigger automated implementation, and adds a comment explaining the prioritization. Uses GitHub MCP server to query issues and analyze dependencies.
- Permissions: Uses the default `GITHUB_TOKEN` with `issues: write` for label management.
- Concurrency: Single execution at a time via `copilot-todo-daily` concurrency group.
- Action Enforcement: Mandatory actionability validation with explicit criteria, comprehensive dependency analysis, and professional explanatory comments for all label assignments.

## Copilot Email Triage (`copilot-email-triage.yml`)

- Trigger: `repository_dispatch` events with `event_type` set to `copilot_email_triage`.
- Behaviour: Copilot reviews the email payload, files any required GitHub issues directly with `gh`, and records a concise summary in the logs.
- Notes: External webhook callers must include the email payload under `client_payload.email`.
- Action Enforcement: Mandatory email content validation, actionable item criteria, and high-quality issue creation with proper structure and labeling.

## Dependabot Auto Merge (`dependabot-automerge.yml`)

- Trigger: Dependabot pull request updates.
- Behaviour: Automatically enables auto-merge (squash) for non-major updates when checks pass.

## Screeps Monitoring (`screeps-monitoring.yml`)

- Trigger: Every 30 minutes (cron schedule) + on "Deploy Screeps AI" completion + manual dispatch.
- Behaviour: Comprehensive autonomous monitoring workflow combining strategic analysis with PTR telemetry monitoring. Copilot performs multi-phase analysis:
  - **PTR Telemetry Collection**: Fetches stats from Screeps API using `scripts/fetch-screeps-stats.mjs`, stores in `reports/screeps-stats/latest.json`
  - **Bot Performance Analysis**: Direct console access via screeps-mcp MCP server to evaluate spawning, CPU usage, energy economy, RCL progress, defense capabilities, and strategic execution
  - **PTR Anomaly Detection**: Analyzes telemetry for critical conditions (CPU >95%, >80%, low energy) with concrete evidence requirements
  - **Repository Health Analysis**: GitHub MCP server integration to assess codebase quality, automation effectiveness, CI/CD health, and development velocity
  - **Strategic Decision Making**: Intelligent prioritization of development tasks based on game performance impact and infrastructure health
  - **Autonomous Issue Management**: Creates, updates, and closes issues with evidence-based recommendations (strategic issues prefixed with `[Autonomous Monitor]`, PTR anomalies with `PTR:`)
  - **Strategic Reporting**: Generates comprehensive analysis report with bot health score (0-100), PTR status, top priorities, and actionable recommendations
  - **Alert Notifications**: Executes `scripts/check-ptr-alerts.ts` to send push notifications for critical/high severity PTR alerts
- MCP Integration: Uses three MCP servers for comprehensive analysis:
  - `github` - Repository operations (issues, PRs, code search, workflow logs)
  - `screeps-mcp` - Bot console access (commands, memory, room data) via `@ralphschuler/screeps-api-mcp`
  - `screeps-api` - User stats and shard info via native Screeps API
- Safety Controls: Read-only analysis mode by default with prohibited destructive actions, rate limiting (every 30 minutes, max 10 issues, max 5 console commands per phase), and graceful error handling
- Secrets: `SCREEPS_TOKEN` (required), `SCREEPS_STATS_TOKEN`, `SCREEPS_EMAIL`, `SCREEPS_PASSWORD`, `SCREEPS_HOST`, `SCREEPS_PORT`, `SCREEPS_PROTOCOL`, `SCREEPS_SHARD` (optional), `SCREEPS_STATS_HOST`, `SCREEPS_STATS_API` (optional), `COPILOT_TOKEN` (required), `PUSH_TOKEN` (optional for notifications).
- Permissions: `contents: read`, `issues: write`, `pull-requests: read`.
- Timeout: 45 minutes with verbose logging enabled for debugging.
- Output: Timestamped analysis report uploaded as workflow artifact (30-day retention), PTR stats snapshot, and minified JSON summary in logs.
- Push Notifications: Automatically sent for critical and high severity PTR alerts via Push by Techulus. See [Push Notifications Guide](push-notifications.md) for details.
- Action Enforcement: Seven-phase workflow with mandatory authentication, PTR telemetry fetch, bot performance analysis, PTR anomaly detection, repository health checks, strategic decision-making, autonomous issue management, and strategic recommendations output.
- Documentation: See [Screeps Monitoring Guide](./autonomous-monitoring.md) for detailed usage, configuration, and best practices.
- Consolidation: This workflow replaces the former `copilot-autonomous-monitor.yml` and `screeps-stats-monitor.yml` workflows, combining strategic monitoring with high-frequency PTR analysis.

## Report Storage and Historical Trend Analysis

The monitoring and evaluation workflows implement persistent report storage for historical comparison and trend analysis. This enables data-driven insights into bot performance evolution and system health trends over time.

### Report Types

The system tracks and persists several types of reports:

1. **PTR Stats Reports** (`reports/ptr-stats/`)
   - Telemetry snapshots from Screeps Stats API or console fallback
   - CPU usage, energy levels, and resource metrics
   - Saved with timestamps for historical tracking
   - Managed by `scripts/check-ptr-alerts.ts`

2. **System Evaluation Reports** (`reports/evaluations/`)
   - Runtime health assessments from `SystemEvaluator`
   - Test results, lint errors, coverage metrics
   - Findings and recommendations for improvements
   - Managed by `scripts/evaluate-system.ts`

3. **Profiler Snapshots** (`reports/profiler/`)
   - CPU profiling data from Memory.profiler
   - Function-level performance metrics
   - Managed by `scripts/fetch-profiler-console.ts`

4. **Copilot Workflow Logs** (`reports/copilot/`)
   - Monitoring and analysis reports
   - Excluded from git via `.gitignore`
   - Stored as workflow artifacts with 30-day retention

### Storage Infrastructure

The report storage system is implemented in `scripts/lib/report-storage.ts` and provides:

- **Timestamped Storage**: Reports saved with ISO 8601 timestamps in filenames
- **Type-based Organization**: Reports grouped by type in subdirectories
- **Retention Policies**: Automatic cleanup of old reports (30 days default, minimum 10 reports retained)
- **Efficient Loading**: Helper functions to load latest reports or specific historical snapshots

**Report Filename Format**: `{type}-YYYY-MM-DDTHH-MM-SS-SSSZ.json`

**Example**: `ptr-stats-2025-11-07T00-30-15-123Z.json`

### Historical Comparison

The comparison system is implemented in `scripts/lib/report-comparison.ts` and provides:

**PTR Stats Comparison**:

- CPU usage trend analysis (percentage change)
- Energy reserve trend analysis (percentage change)
- Automatic alerting on significant changes (>10% CPU, >20% energy)
- Formatted trend reports for workflow logs

**System Evaluation Comparison**:

- Finding count changes (added/removed/resolved)
- Summary change detection
- Quality trend analysis over time
- Formatted trend reports with actionable insights

### Integration with Workflows

**Screeps Monitoring** (`screeps-monitoring.yml`):

- Saves PTR stats snapshots on each run
- Compares current stats with previous run
- Logs trend analysis in workflow output
- Applies 30-day retention policy automatically

**System Evaluation** (`analyze:system` script):

- Saves evaluation reports with timestamps
- Compares current evaluation with previous
- Tracks finding resolution and new issues
- Applies retention policy after each run

### Retention Policy

Default configuration (configurable per report type):

- **Maximum Age**: 30 days
- **Minimum Reports**: 10 (always kept regardless of age)
- **Cleanup Frequency**: On each monitoring/evaluation run
- **Manual Cleanup**: `npx tsx scripts/cleanup-old-reports.ts`

The retention policy ensures historical data availability while managing repository size by removing old reports that exceed both the age threshold and minimum count requirement.

### Repository Size Management

**Storage Strategy**:

- Only timestamped JSON reports committed to git
- Copilot logs excluded via `.gitignore` (ephemeral, stored as artifacts)
- Compact JSON format for efficiency
- Automatic cleanup prevents unbounded growth

**Expected Storage Impact**:

- PTR stats: ~2-3 KB per report, 10-30 reports = 30-90 KB
- Evaluations: ~1-2 KB per report, 10-30 reports = 10-60 KB
- Profiler: ~5-10 KB per report, 10-30 reports = 50-300 KB
- **Total Maximum**: ~400-500 KB for all report types combined

### Usage Examples

**Load and compare PTR stats**:

```typescript
import { listReports, loadReport } from "./scripts/lib/report-storage";
import { comparePTRStats, formatPTRTrendReport } from "./scripts/lib/report-comparison";

// Load the two most recent reports
const reports = await listReports("ptr-stats");
const current = reports.length > 0 ? await loadReport<PTRStatsSnapshot>("ptr-stats", reports[0].filename) : null;
const previous = reports.length > 1 ? await loadReport<PTRStatsSnapshot>("ptr-stats", reports[1].filename) : null;

const comparison = comparePTRStats(current, previous);
console.log(formatPTRTrendReport(comparison));
```

**Save a report**:

```typescript
import { saveReport } from "./scripts/lib/report-storage";

const report = {
  tick: 1000,
  data: {
    /* ... */
  }
};
const path = await saveReport("ptr-stats", report);
console.log(`Report saved to: ${path}`);
```

**Apply retention policy**:

```typescript
import { applyRetentionPolicy } from "./scripts/lib/report-storage";

const deleted = await applyRetentionPolicy("ptr-stats", {
  maxAgeDays: 30,
  minReportsToKeep: 10
});
console.log(`Cleaned up ${deleted} old reports`);
```

### Future Enhancements

Potential improvements for report storage infrastructure:

- **External Storage**: Consider GitHub Artifacts API or external storage for long-term archives
- **Aggregated Reports**: Weekly/monthly summary reports with trend statistics
- **Visualization**: Generate charts and graphs from historical data
- **Alerting Thresholds**: Configurable alert rules based on historical baselines
- **Performance Dashboards**: Real-time dashboards showing key metrics over time

## Screeps Spawn Monitor (`screeps-spawn-monitor.yml`)

- Trigger: Manual dispatch or pushes to `main`.
- Behaviour: Ensures the repository's labels match `.github/labels.yml`.

## CI Auto Issue (`ci-auto-issue.yml`)

- Trigger: Failed runs of any workflow except `CI Auto Issue` itself (to prevent infinite loops).
- Behaviour: Automatically creates GitHub issues to track CI failures for manual review and resolution.
- **Circuit Breaker Pattern**: Implements intelligent throttling to prevent alert fatigue:
  - Tracks consecutive failures (max: 3)
  - 15-minute backoff period after threshold
  - Creates escalation issues when circuit breaker trips
- **Issue Creation**:
  - Checks for existing issues to avoid duplicates
  - Includes workflow details, failed jobs, commit info, and run URLs
  - Applies labels: `automation`, `ci-failure`, `type/bug`, `priority/high`, `state/pending`
  - Updates existing issues with new failure information
- **Workflow Details**: Fetches run information and lists all failed jobs for context
- **Escalation Issues**: Created when circuit breaker trips with `priority/critical` and `ci-escalation` labels
- **Email Notifications**: Sends high-priority email alerts for CI failures
- **Design Philosophy**: Issue creation is more predictable and transparent than automatic fixes, providing visible tracking and manual control

## Stale Issue Management (`stale-issue-management.yml`)

- Trigger: Daily schedule (midnight UTC) + manual dispatch.
- Behaviour: Automatically identifies and manages inactive issues to prevent backlog accumulation:
  - Issues inactive for **60 days** are labeled as `stale` with warning message
  - Stale issues receive **14-day grace period** before auto-close
  - Auto-closed issues include message explaining closure and reopening process
  - Removes `stale` label automatically when issues receive activity
- Exempt Issues: Issues with the following labels are never marked as stale:
  - `pinned` - Permanently relevant issues
  - `security` - Security-related concerns
  - `priority/critical` - Critical priority items
  - `priority/high` - High priority items
- Stale Warning Message: _"This issue has been inactive for 60 days and will be closed in 14 days unless there is activity. If this issue is still relevant, please comment or remove the `stale` label."_
- Close Message: _"This issue was automatically closed due to inactivity. If this issue is still relevant, please reopen it or create a new issue with updated context."_
- Configuration:
  - Processes up to 100 issues per run for efficiency
  - Does not process pull requests (issues only)
  - Concurrency controlled to prevent overlapping runs
- Integration: Works seamlessly with label-sync workflow and existing label system
- Permissions: Requires `issues: write` and `pull-requests: write` (PR write for future extensibility)
- Action: Uses `actions/stale@v9` for reliable stale detection and management
- Notes: Users can prevent auto-close by commenting on the issue, removing the `stale` label, or adding an exempt label. This automation helps maintain issue backlog visibility and reduces maintenance burden.

Keep this file accurate—workflows load these expectations via the Copilot CLI when planning fixes.

---

## Enhanced Prompt Template Patterns

As of issue #127, all Copilot prompt templates follow enhanced patterns with explicit action enforcement rules and output validation requirements.

### Action Enforcement Framework

All prompts include mandatory action requirements that must be completed for successful workflow execution:

```markdown
## MANDATORY ACTIONS (failure to complete any item is a workflow failure)

- [ ] **MUST authenticate GitHub CLI** with provided token and verify permissions
- [ ] **MUST validate input parameters** before proceeding with operations
- [ ] **MUST create/update specified outputs** with required format and quality
- [ ] **MUST validate outputs** meet quality requirements before completion
```

### Output Quality Requirements

All generated content must meet explicit quality standards:

- **Actionable Content**: All issues, PRs, and comments must include specific next steps
- **Professional Language**: All generated text must be concise and professional
- **Concrete Evidence**: All findings must reference specific files, metrics, or reproduction steps
- **Proper Structure**: All outputs must follow repository conventions and formatting standards

### Failure Handling Patterns

All prompts include comprehensive failure handling for common scenarios:

- **API Failures**: GitHub/Screeps API unavailability with graceful degradation
- **Missing Data**: Input validation with clear error messages and exit conditions
- **Complex Issues**: Escalation to manual review when automatic handling is inappropriate
- **Timeout Conditions**: Resource limits and progress preservation for long operations

### Validation and Quality Gates

Pre-execution validation ensures all required resources are available:

- Environment variables and tokens are present and valid
- Required permissions are verified before operations begin
- Input data meets expected format and quality requirements

Post-execution validation confirms successful completion:

- All mandatory actions completed successfully
- Generated outputs exist and are accessible
- Content quality meets established standards

### Prompt Template Naming

Standardized naming conventions for clarity:

- `issue-triage` - GitHub issue triage and reformulation
- `todo-automation` - Automated issue implementation (renamed from `todo-issue`)
- `repository-review` - Comprehensive repository auditing (renamed from `repository-audit`)
- `email-triage` - Email to GitHub issue conversion
- `stats-analysis` - Screeps telemetry monitoring and anomaly detection
- `todo-daily-prioritization` - Automated Todo label assignment

### Action Appropriateness Criteria

Each prompt includes explicit criteria for when automatic actions are appropriate versus when manual intervention is required. This prevents inappropriate automation and ensures quality outcomes.

---

## MCP Server Integration

The `copilot-exec` composite action supports Model Context Protocol (MCP) servers that extend Copilot's capabilities beyond the standard GitHub operations.

### Available MCP Servers

1. **GitHub MCP** (default) - Repository operations, code search, commit inspection
2. **Playwright MCP** - Browser automation for web-based monitoring and testing

### Configuration

MCP server configurations are stored in `.github/mcp/` as JSON files defining server commands and environment variables:

- `.github/mcp/playwright.json` - Playwright server configuration

### Usage in Workflows

Enable additional MCP servers by passing the configuration file path to the `additional-mcp-config` parameter:

```yaml
- uses: ./.github/actions/copilot-exec
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    prompt-path: .github/copilot/prompts/my-prompt
    additional-mcp-config: "@.github/mcp/playwright.json"
```

The action automatically merges the additional MCP configuration with the base GitHub MCP server configuration.

### Authentication

MCP servers requiring authentication use environment variables passed through the workflow:

- **Screeps API**: `SCREEPS_TOKEN`, `SCREEPS_EMAIL`, `SCREEPS_PASSWORD`, plus optional `SCREEPS_HOST`, `SCREEPS_PORT`, `SCREEPS_PROTOCOL`
- **Playwright**: No authentication required (uses headless browser)

All credentials must be stored as GitHub Actions secrets and referenced in workflow `env` sections. Never hardcode credentials in MCP configuration files.

### Current Integrations

- **screeps-monitoring.yml**: Uses the `scripts/fetch-screeps-stats.mjs` script to fetch telemetry from the Screeps REST API and integrates with screeps-mcp MCP server for console access

See `AGENTS.md` for detailed MCP server capabilities and best practices.

---

### Local workflow validation

Run `bun run test:actions` to execute linting, formatting checks, and dry-run the key workflows (`quality-gate`, `post-merge-release`, `deploy`, `docs-pages`, `copilot-email-triage`) using the `act` CLI. Populate placeholder secrets in `tests/actions/secrets.env` before invoking the command.

## Phase 3: Economy Expansion Automation

The repository includes comprehensive automation for Phase 3 economy expansion features (RCL 3-5), supporting remote harvesting, improved base planning, road automation, and intelligent defense.

### Remote Harvesting and Mapping

**ScoutManager** (`src/runtime/scouting/ScoutManager.ts`) discovers and maps remote rooms for resource extraction:

- **Room Intelligence**: Collects data on sources, minerals, ownership, hostiles, and Source Keepers
- **Memory Persistence**: Stores room data in `Memory.scout` with configurable lifetime (default: 10,000 ticks)
- **Target Selection**: Ranks rooms by path distance, source count, and safety for optimal remote mining
- **Data Cleanup**: Automatically removes stale data to prevent memory bloat
- **Corruption Recovery**: Handles memory loss/corruption gracefully without crashes

**Key Features**:

- Discovers source locations, mineral types, and hostile presence
- Filters out owned, Source Keeper, and hostile rooms automatically
- Updates path distances for route optimization
- Supports re-scouting for data freshness

**Documentation**: [Remote Harvesting Guide](../runtime/strategy/remote-harvesting.md)

### Construction and Base Planning

**BasePlanner** (`src/runtime/planning/BasePlanner.ts`) manages automatic structure placement with bunker/stamp layouts:

- **RCL Progression**: Supports RCL 2-5 with extension, tower, storage, and link placement
- **Bunker Layout**: Compact radial pattern centered on spawn for efficient energy distribution
- **Smart Placement**: Avoids walls using distance transform algorithm
- **RCL-Based Queuing**: Automatically unlocks new structures as controller levels up

**Layout Coverage (RCL 2-5)**:

- RCL 2: 5 extensions, 1 container
- RCL 3: 10 extensions, 1 tower
- RCL 4: 20 extensions, 1 storage
- RCL 5: 30 extensions, 2 towers, 2 links

**ConstructionManager** (`src/runtime/planning/ConstructionManager.ts`) creates construction sites automatically based on planner output.

### Road and Building Automation

**RoadPlanner** (`src/runtime/infrastructure/RoadPlanner.ts`) automates road placement using pathfinding results:

- **Path-Based Planning**: Uses room.findPath() to determine optimal road positions
- **Auto-Placement**: Connects sources to spawns and controllers automatically
- **Deduplication**: Prevents duplicate roads on overlapping paths
- **Terrain Awareness**: Skips wall tiles automatically
- **Throttling**: Limits construction sites per tick to manage CPU (default: 1 per tick)

**Road Types**:

- Source roads: Connect energy sources to spawns
- Controller roads: Connect sources to controller for upgrading efficiency
- Auto-mode: Combines both types with deduplication

**Usage**:

```typescript
const roadPlanner = new RoadPlanner();
const result = roadPlanner.autoPlaceRoads(room, Game);
console.log(`Created ${result.created} road sites`);
```

### Improved Defense

**TowerManager** (`src/runtime/defense/TowerManager.ts`) implements threat-based targeting with intelligent prioritization:

- **Threat Assessment**: Evaluates hostiles based on attack/heal parts, distance, and health
- **Priority System**:
  1. Attack hostiles (healers prioritized first)
  2. Heal damaged friendlies
  3. Repair critical structures (<30% health)
- **Smart Targeting**: Focuses fire on wounded enemies for faster kills
- **Multi-Tower Coordination**: All towers target highest-threat hostile

**Threat Scoring**:

- +100 per attack part (ATTACK, RANGED_ATTACK, WORK)
- +150 per heal part (high priority - can sustain other hostiles)
- +50 for proximity (closer = more dangerous)
- +50 for wounded enemies (<50% health, easier to kill)

**Actions Tracked**:

- `attack`: Hostile creeps attacked
- `heal`: Friendly creeps healed
- `repair`: Structures repaired

**Documentation**: All Phase 3 features include comprehensive test coverage (unit + regression tests) and are documented in the appropriate guides.

## Advanced Economy Automation (Phase 4)

### Link Network Management

The LinkManager automates energy distribution through link networks:

- **Role Classification**: Automatically identifies links as source, storage, controller, or upgrade links based on proximity to game objects
- **Energy Transfer**: Source links automatically transfer energy when full to controller/storage links with free capacity
- **Priority System**: Controller links receive energy first, followed by storage links
- **Network Tracking**: Maintains link metadata and transfer history for optimization

### Terminal Operations

The TerminalManager handles inter-room resource logistics:

- **Energy Balancing**: Maintains minimum energy reserve (default 20,000) in terminals
- **Resource Transfers**: Priority-based queue for inter-room resource requests
- **Cooldown Management**: Waits for terminal cooldown before executing transfers
- **Request Cleanup**: Automatically removes old requests (>1000 ticks)

### Lab Automation

The LabManager coordinates compound production and creep boosting:

- **Production Mode**: Automatically produces compounds using input/output lab configuration
- **Boosting Mode**: Priority system for creep boosting requests
- **State Management**: Tracks lab states (idle, production, boosting, cooldown)
- **Recipe System**: Built-in recipes for Tier 1 compounds (UH, UO, KH, KO, LH, LO, ZH, ZO, GH, GO)

### Factory Automation

The FactoryManager handles commodity production:

- **Production Queue**: Priority-based orders for commodity production
- **Auto-Production**: Automatically produces batteries when idle
- **Resource Validation**: Checks factory has required components before production
- **Order Management**: Removes completed orders and cleans up old orders (>5000 ticks)

### Combat Coordination

The CombatManager provides squad-based combat operations:

- **Squad Formation**: Create and manage squads with offense/defense/raid roles
- **Threat Assessment**: Identifies hostile creeps and structures with threat scoring
- **Engagement Logic**: Commands squads to engage targets by priority
- **Squad Lifecycle**: Automatically disbands squads when all members die

### Traffic Management

The TrafficManager coordinates creep movement with collision avoidance:

- **Priority Movement**: Higher priority creeps get path preference
- **Collision Detection**: Detects and resolves creep blocking situations
- **Position Reservation**: Reserves positions for high-priority creeps
- **Swap Logic**: Requests blocking creeps to move for higher priority traffic

## Phase 5: Performance Optimizations and Error Handling

### Profiling and CPU Optimization

All runtime managers use the `@profile` decorator for automated CPU profiling:

- **Automatic Profiling**: The profiler tracks CPU usage for all decorated methods
- **Auto-Start Collection**: Profiler automatically begins data collection on first tick after deployment
- **Performance Monitoring**: Detailed breakdown of CPU costs per manager and method
- **Health Validation**: Automated health checks in monitoring workflow (`check-profiler-health.ts`)
- **Zero-Cost in Production**: Profiling can be disabled via `PROFILER_ENABLED=false`
- **Build Integration**: Profiler is conditionally included based on environment variable

**Implementation:** [`src/profiler/Profiler.ts`](../../src/profiler/Profiler.ts)

**Monitoring:**

- Profiler data fetched automatically every 30 minutes via `fetch-profiler-console.ts`
- Health checks validate data availability and freshness
- Reports saved to `reports/profiler/latest.json`
- See [Profiler Usage Guide](../operations/profiler-usage.md) for detailed documentation

### Memory Efficiency

Memory optimization strategies across the codebase:

- **Batch Processing**: AnalyticsReporter batches reports to reduce memory overhead
- **Queue Management**: Automatic cleanup of old data (e.g., shard messages >1000 ticks)
- **Lazy Loading**: Managers only load state from Memory when configured
- **State Persistence**: Explicit save operations prevent unnecessary memory writes

### Error Handling and Recovery

Comprehensive error handling across all managers:

- **Graceful Degradation**: Managers continue operating when non-critical operations fail
- **Logging**: All errors logged with context via Logger utility
- **Recovery Patterns**: Failed operations re-queued with limits to prevent unbounded growth
- **Validation**: Input validation prevents invalid state from propagating

**Example from AnalyticsReporter:**

```typescript
try {
  await this.sendReports(reports);
  this.logger.log(`Successfully sent ${reports.length} reports`);
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  this.logger.error(`Failed to send reports: ${errorMsg}`);
  // Re-queue with limit
  if (this.reportQueue.length < this.batchSize * 2) {
    this.reportQueue.push(...reports);
  }
}
```

### Testing Coverage

Comprehensive test coverage for error scenarios:

- **Unit Tests**: Error handling tested with invalid inputs and edge cases
- **Regression Tests**: High-volume scenarios validate memory and performance
- **Integration Tests**: End-to-end testing with StatsCollector integration
- **Coverage Metrics**: 80%+ coverage for new Phase 5 implementations

### Best Practices

1. **Use the profiler**: Always decorate manager classes with `@profile`
2. **Handle errors**: Catch and log errors, never let them crash the kernel
3. **Validate inputs**: Check parameters before expensive operations
4. **Limit growth**: Prevent unbounded queue/array growth with explicit limits
5. **Log context**: Include relevant context in log messages for debugging
6. **Test errors**: Write tests for error paths and recovery scenarios

### Performance Metrics

**Colony Manager:**

- Room tracking: <1ms for 10 rooms
- Message processing: <10ms for 100 messages
- Expansion evaluation: <5ms per check

**Analytics Reporter:**

- Queue insertion: <0.1ms per report
- Batch flush: <50ms for 100 reports
- High-volume: 1000 reports in <200ms

See test suites for detailed performance benchmarks.
