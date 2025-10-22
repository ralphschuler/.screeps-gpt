# Automation Overview

This document expands on the workflows under `.github/workflows/` and how they combine with the Copilot CLI.

## Quality Gate (`quality-gate.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Lint, formatting checks, unit tests, PTR e2e tests, regression tests, coverage + evaluation artifact upload, plus verification that `docs/changelog/versions.*` matches `npm run versions:update`.
- Notes: Configure PTR secrets locally before running the e2e suite. Failures here must be reproduced with a regression test before applying fixes (see repository rules in [README](../../README.md)).

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

- Trigger: Tags that match `v*` OR GitHub Release published events.
- Behaviour: Builds and pushes code to the Screeps API. Uses GitHub's `production` environment for deployment protection rules and approval workflows. Set `SCREEPS_DEPLOY_DRY_RUN=true` for local `act` dry-runs to skip the API call.
- Environment: Uses GitHub environment `production` with URL `https://screeps.com` for deployment tracking and protection rules.
- Secrets: `SCREEPS_TOKEN` (required), `SCREEPS_HOST`/`PORT`/`PROTOCOL`/`BRANCH` (optional overrides).
- Notes: Deployment is triggered automatically when releases are published, leveraging GitHub's native CI/CD features.

## Copilot Repository Review (`copilot-review.yml`)

- Trigger: Daily schedule + manual dispatch.
- Behaviour: Copilot authenticates with `gh`, clones the repo, audits automation/runtime quality, files or updates GitHub issues directly, and prints a JSON recap to the logs.
- Output: Summary is logged instead of uploading an artifact.
- Action Enforcement: Mandatory comprehensive audit with actionable finding criteria, issue quality validation, duplicate prevention, and severity assessment guidelines.

## Documentation Pages (`docs-pages.yml`)

- Trigger: Pushes to `main`, published releases, and manual dispatches.
- Behaviour: Executes `npm run versions:update` and `npm run build:docs-site`, then publishes `build/docs-site` to GitHub Pages.
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
  - Running npm checks (`npm run lint`, `npm run test:unit`, etc.) and reporting results
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

## Screeps Stats Monitor (`screeps-stats-monitor.yml`)

- Trigger: Every 30 minutes + manual dispatch.
- Behaviour: Copilot uses Screeps API MCP server to fetch telemetry directly from Screeps, analyse anomalies, and open/update monitoring issues through `gh` with severity labels.
- MCP Servers: Integrates with the Screeps API MCP server for direct Screeps server interaction.
- Secrets: `SCREEPS_TOKEN` (required), `SCREEPS_STATS_TOKEN`, `SCREEPS_EMAIL`, `SCREEPS_PASSWORD` (optional alternatives), plus optional host/port/protocol overrides.
- Action Enforcement: Mandatory telemetry validation, explicit anomaly detection criteria with severity thresholds, and concrete evidence requirements for all monitoring issues.

## Label Sync (`label-sync.yml`)

- Trigger: Manual dispatch or pushes to `main`.
- Behaviour: Ensures the repository's labels match `.github/labels.yml`.

## Copilot CI AutoFix (`copilot-ci-autofix.yml`)

- Trigger: Failed runs of any workflow except `Copilot CI AutoFix` itself (to prevent infinite loops).
- Behaviour: Copilot downloads the failing logs, analyzes the workflow context (PR vs non-PR trigger), clones the affected branch, applies the fix with changelog/docs/tests updates, and pushes the result based on context-aware decision logic.
- Context Awareness: The workflow passes `TRIGGER_EVENT` and event payload to enable intelligent decision-making about fix application strategy.
- Fix Application Strategy:
  - **PR-triggered failures**: Commits directly to the PR branch for fast iteration
  - **Main branch failures**: Creates new PR (`copilot/autofix-{run_id}`) to avoid direct commits to protected branches
  - **Feature branch failures**: Commits directly to the feature branch
  - **Scheduled/manual triggers**: Creates new PR for review and validation
- Branch Protection: Never pushes directly to `main` or production branches - always creates a PR to maintain audit trail and review process.
- Action Enforcement: Mandatory root cause analysis, minimal targeted fixes with validation, explicit criteria for fix appropriateness, and comprehensive failure handling for complex issues.

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
2. **Screeps API MCP** - Direct Screeps server interaction, console commands, room data, memory segments
3. **Playwright MCP** - Browser automation for web-based monitoring and testing

### Configuration

MCP server configurations are stored in `.github/mcp/` as JSON files defining server commands and environment variables:

- `.github/mcp/screeps-api.json` - Screeps API server configuration
- `.github/mcp/playwright.json` - Playwright server configuration

### Usage in Workflows

Enable additional MCP servers by passing the configuration file path to the `additional-mcp-config` parameter:

```yaml
- uses: ./.github/actions/copilot-exec
  env:
    SCREEPS_TOKEN: ${{ secrets.SCREEPS_TOKEN }}
  with:
    prompt-path: .github/copilot/prompts/my-prompt
    additional-mcp-config: "@.github/mcp/screeps-api.json"
```

The action automatically merges the additional MCP configuration with the base GitHub MCP server configuration.

### Authentication

MCP servers requiring authentication use environment variables passed through the workflow:

- **Screeps API**: `SCREEPS_TOKEN`, `SCREEPS_EMAIL`, `SCREEPS_PASSWORD`, plus optional `SCREEPS_HOST`, `SCREEPS_PORT`, `SCREEPS_PROTOCOL`
- **Playwright**: No authentication required (uses headless browser)

All credentials must be stored as GitHub Actions secrets and referenced in workflow `env` sections. Never hardcode credentials in MCP configuration files.

### Current Integrations

- **screeps-stats-monitor.yml**: Uses Screeps API MCP for direct telemetry access

See `AGENTS.md` for detailed MCP server capabilities and best practices.

---

### Local workflow validation

Run `npm run test:actions` to execute linting, formatting checks, and dry-run the key workflows (`quality-gate`, `post-merge-release`, `deploy`, `docs-pages`, `copilot-email-triage`) using the `act` CLI. Populate placeholder secrets in `tests/actions/secrets.env` before invoking the command.
