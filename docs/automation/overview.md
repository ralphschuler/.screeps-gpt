# Automation Overview

This document expands on the workflows under `.github/workflows/` and how they combine with the Copilot CLI.

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

These optimizations significantly reduce workflow execution time, particularly for workflows that run frequently like issue triage and CI autofix.

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

## Quality Guards

Quality checks are split into separate guard workflows for better granularity and parallel execution:

### Guard - Lint (`guard-lint.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: ESLint code quality checks.

### Guard - Format (`guard-format.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Prettier formatting validation.

### Guard - YAML Lint (`guard-yaml-lint.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: YAML workflow file linting.

### Guard - Version Index (`guard-version.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Verification that `docs/changelog/versions.json` and `docs/changelog/versions.md` match `bun run versions:update`.

### Guard - Build (`guard-build.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Build validation with caching.

### Guard - Unit Tests (`guard-test-unit.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Unit test execution.

### Guard - E2E Tests (`guard-test-e2e.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: PTR end-to-end tests.
- Notes: Configure PTR secrets locally before running the e2e suite.

### Guard - Regression Tests (`guard-test-regression.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Regression test validation.
- Notes: Failures here must be reproduced with a regression test before applying fixes (see repository rules in [README](../../README.md)).

### Guard - Coverage (`guard-coverage.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Test coverage reporting and evaluation artifact upload.

## Quality Gate (`quality-gate.yml`)

**Deprecated:** The monolithic quality-gate workflow has been split into multiple focused guard workflows (guard-lint, guard-format, etc.) for better granularity and parallel execution. This workflow is kept for backward compatibility but may be removed in a future version.

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

## Copilot Repository Review (`copilot-review.yml`)

- Trigger: Daily schedule + manual dispatch.
- Behaviour: Copilot authenticates with `gh`, clones the repo, audits automation/runtime quality, files or updates GitHub issues directly, and prints a JSON recap to the logs.
- Output: Summary is logged instead of uploading an artifact.
- Action Enforcement: Mandatory comprehensive audit with actionable finding criteria, issue quality validation, duplicate prevention, and severity assessment guidelines.

## Documentation Pages (`docs-pages.yml`)

- Trigger: Pushes to `main`, published releases, and manual dispatches.
- Behaviour: Executes `bun run versions:update` and `bun run build:docs-site`, then publishes `build/docs-site` to GitHub Pages.
- Permissions: Requires `pages: write` and `id-token: write`.

## Copilot Issue Triage (`copilot-issue-triage.yml`)

- Trigger: Issues opened or reopened.
- Behaviour: Copilot performs comprehensive context-aware triage by:
  - Fetching all existing open issues for duplicate detection and relationship analysis
  - Detecting and handling duplicate issues automatically (comments on both issues, closes duplicate with "duplicate" reason)
  - Identifying related issues, sub-tasks, and parent-child relationships
  - Reformulating title and description to clearly outline required changes and expectations
  - Applying appropriate labels based on content analysis (**excludes automatic Todo labeling** per issue #78)
  - Linking related issues in the reformulated description
  - Establishing sub-issue connections via GitHub CLI when parent-child relationships are detected
  - Adding a single triage comment with summary and recommendations (avoids redundant comments)
- Permissions: Uses the default `GITHUB_TOKEN` with `issues: write` to edit issue metadata, add comments, and close duplicates.
- Integration: Uses GitHub MCP server for querying all issues and performing relationship analysis.
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

## Copilot Spec-Kit (`copilot-speckit.yml`)

- Trigger: Issues labelled `speckit` OR issue comments starting with `@speckit`.
- Behaviour: Implements specification-driven development workflow by:
  - **Plan Generation** (on `speckit` label): Analyzes the issue and creates a detailed implementation plan following spec-kit principles, posts plan as an issue comment with clear sections (Problem Statement, Solution Overview, Implementation Steps, Acceptance Criteria, Dependencies, Risk Assessment)
  - **Plan Refinement** (on `@speckit` comment): Updates the existing plan based on user feedback, maintaining structure while incorporating improvements, tracks changes through revision history
  - **Plan Finalization** (on `@speckit finalize` comment): Reviews the plan for completeness, applies final improvements, adds the `Todo` label to trigger automated implementation, and posts confirmation comment
- Permissions: Uses the default `GITHUB_TOKEN` with `issues: write` for commenting and label management.
- Integration: Works seamlessly with Copilot Todo automation - finalized plans are automatically picked up for implementation when the `Todo` label is applied.
- Workflow Purpose: Provides a structured planning phase before implementation, allowing stakeholders to review and refine specifications before code changes are made.
- Action Enforcement: Mandatory comprehensive planning, actionable specifications aligned with repository conventions, proper comment editing (no duplicates), and clear revision tracking.
- Documentation: See [Spec-Kit Workflow Guide](./spec-kit-workflow.md) for detailed usage instructions, examples, and best practices.

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

## Screeps Spawn Monitor (`screeps-spawn-monitor.yml`)

- Trigger: Manual dispatch or pushes to `main`.
- Behaviour: Ensures the repository's labels match `.github/labels.yml`.

## Copilot CI AutoFix (`copilot-ci-autofix.yml`)

- Trigger: Failed runs of any workflow except `Copilot CI AutoFix` itself (to prevent infinite loops).
- Behaviour: Copilot downloads the failing logs, analyzes the workflow context (PR vs non-PR trigger), clones the affected branch, applies the fix with changelog/docs/tests updates, and pushes the result based on context-aware decision logic.
- Context Awareness: The workflow passes `TRIGGER_EVENT` and event payload to enable intelligent decision-making about fix application strategy.
- Timeout & Logging: Configured with 45-minute timeout and verbose logging enabled for comprehensive debugging and performance monitoring.
- **Enhanced Failure Classification**: Autofix now categorizes failures into specific types (linting, formatting, compilation, dependency, documentation, version sync) with specialized fix strategies for each category.
- **Improved Error Context Gathering**: Downloads full logs, extracts error indicators with surrounding context, identifies affected files, and checks for related failures across recent workflow runs.
- **Specialized Fix Strategies**:
  - **Linting Failures**: Auto-runs `bun run lint:fix` for ESLint/YAML violations
  - **Formatting Failures**: Auto-runs `bun run format:write` for Prettier inconsistencies
  - **Version Index Sync**: Auto-runs `bun run versions:update` for changelog misalignment
  - **Simple Compilation Errors**: Fixes missing imports, typos, and type mismatches
  - **Documentation Failures**: Fixes broken links and outdated examples
  - **Dependency Conflicts**: Updates lockfiles and resolves version incompatibilities
- **Manual Review Escalation**: Complex failures (test logic errors, security issues, performance regressions, workflow config errors) automatically create issues with `help-wanted` and `state/pending` labels instead of attempting risky automatic fixes.
- Fix Application Strategy:
  - **PR-triggered failures**: Commits directly to the PR branch for fast iteration
  - **Main branch failures**: Creates new PR (`copilot/autofix-{run_id}`) to avoid direct commits to protected branches
  - **Feature branch failures**: Commits directly to the feature branch
  - **Scheduled/manual triggers**: Creates new PR for review and validation
- Branch Protection: Never pushes directly to `main` or production branches - always creates a PR to maintain audit trail and review process.
- **Output Metrics**: JSON output includes failure_type, fix_strategy, validation_commands, and files_changed for performance tracking and improvement analysis.
- Action Enforcement: Mandatory root cause analysis, failure classification, minimal targeted fixes with validation, explicit criteria for fix appropriateness, and comprehensive failure handling for complex issues.

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
- `ci-autofix` - Continuous integration failure remediation
- `repository-review` - Comprehensive repository auditing (renamed from `repository-audit`)
- `email-triage` - Email to GitHub issue conversion
- `stats-analysis` - Screeps telemetry monitoring and anomaly detection
- `todo-daily-prioritization` - Automated Todo label assignment

### Action Appropriateness Criteria

Each prompt includes explicit criteria for when automatic actions are appropriate versus when manual intervention is required. This prevents inappropriate automation and ensures quality outcomes.

For example, CI autofix only attempts repairs for:

- ✅ Linting/formatting violations
- ✅ Simple compilation errors
- ✅ Broken tests due to trivial changes

But creates issues for manual review when encountering:

- ❌ Complex logic errors requiring design decisions
- ❌ Security vulnerabilities needing careful review
- ❌ Breaking changes affecting public APIs

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
