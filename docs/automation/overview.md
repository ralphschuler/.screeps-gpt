# Automation Overview

This document expands on the workflows under `.github/workflows/` and how they combine with the Copilot CLI.

## Quality Gate (`quality-gate.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Lint, formatting checks, unit tests, PTR e2e tests, regression tests, coverage + evaluation artifact upload, plus verification that `docs/changelog/versions.*` matches `npm run versions:update`.
- Notes: Configure PTR secrets locally before running the e2e suite. Failures here must be reproduced with a regression test before applying fixes (see repository rules in [README](../../README.md)).

## Post Merge Release (`post-merge-release.yml`)

- Trigger: Pushes to `main` (excludes release PR merges to prevent recursion).
- Behaviour: Applies lint/format fixes, bumps the version, commits to a release branch, creates a tag, opens a PR to main, and triggers the Deploy workflow via workflow completion.
- Secrets: Uses the default `GITHUB_TOKEN` with elevated `contents: write` permissions scoped to the workflow.
- Notes: Skips execution when commit message contains "chore: prepare release" to prevent recursive workflow runs when release PRs are merged.

## Deploy (`deploy.yml`)

- Trigger: Tags that match `v*` OR when Post Merge Release workflow completes successfully.
- Behaviour: Builds and pushes code to the Screeps API (defaults to the PTR environment). Automatically deploys when triggered by the release workflow. Set `SCREEPS_DEPLOY_DRY_RUN=true` for local `act` dry-runs to skip the API call.
- Secrets: `SCREEPS_TOKEN` (required), `SCREEPS_HOST`/`PORT`/`PROTOCOL`/`BRANCH` (optional overrides).
- Notes: The `workflow_run` trigger ensures deployment happens even if tag creation doesn't trigger workflows (GitHub Actions limitation with `GITHUB_TOKEN`).

## Copilot Repository Audit (`copilot-review.yml`)

- Trigger: Daily schedule + manual dispatch.
- Behaviour: Copilot authenticates with `gh`, clones the repo, audits automation/runtime quality, files or updates GitHub issues directly, and prints a JSON recap to the logs.
- Output: Summary is logged instead of uploading an artifact.

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
  - Applying appropriate labels based on content analysis
  - Linking related issues in the reformulated description
  - Establishing sub-issue connections via GitHub CLI when parent-child relationships are detected
  - Adding a single triage comment with summary and recommendations (avoids redundant comments)
- Permissions: Uses the default `GITHUB_TOKEN` with `issues: write` to edit issue metadata, add comments, and close duplicates.
- Integration: Uses GitHub MCP server for querying all issues and performing relationship analysis.

## Copilot Todo Automation (`copilot-todo-pr.yml`)

- Trigger: Issues labelled `Todo`.
- Behaviour: Copilot performs context-aware implementation by:
  - Checking for related issues, sub-tasks, and dependencies via GitHub MCP server
  - Verifying all dependent sub-tasks are completed before proceeding
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

## Copilot Daily Todo Prioritization (`copilot-todo-daily.yml`)

- Trigger: Daily schedule (9:00 AM UTC) + manual dispatch.
- Behaviour: Copilot automatically identifies the oldest actionable issue (no incomplete sub-tasks) without the Todo label, applies the Todo label to trigger automated implementation, and adds a comment explaining the prioritization. Uses GitHub MCP server to query issues and analyze dependencies.
- Permissions: Uses the default `GITHUB_TOKEN` with `issues: write` for label management.
- Concurrency: Single execution at a time via `copilot-todo-daily` concurrency group.

## Copilot Email Triage (`copilot-email-triage.yml`)

- Trigger: `repository_dispatch` events with `event_type` set to `copilot_email_triage`.
- Behaviour: Copilot reviews the email payload, files any required GitHub issues directly with `gh`, and records a concise summary in the logs.
- Notes: External webhook callers must include the email payload under `client_payload.email`.

## Dependabot Auto Merge (`dependabot-automerge.yml`)

- Trigger: Dependabot pull request updates.
- Behaviour: Automatically enables auto-merge (squash) for non-major updates when checks pass.

## Screeps Stats Monitor (`screeps-stats-monitor.yml`)

- Trigger: Every 30 minutes + manual dispatch.
- Behaviour: Copilot uses Screeps API MCP server to fetch telemetry directly from Screeps, analyse anomalies, and open/update monitoring issues through `gh` with severity labels.
- MCP Servers: Integrates with the Screeps API MCP server for direct Screeps server interaction.
- Secrets: `SCREEPS_TOKEN` (required), `SCREEPS_STATS_TOKEN`, `SCREEPS_EMAIL`, `SCREEPS_PASSWORD` (optional alternatives), plus optional host/port/protocol overrides.

## Label Sync (`label-sync.yml`)

- Trigger: Manual dispatch or pushes to `main`.
- Behaviour: Ensures the repository's labels match `.github/labels.yml`.

## Copilot CI AutoFix (`copilot-ci-autofix.yml`)

- Trigger: Failed runs of any workflow except `Copilot CI AutoFix` itself (to prevent infinite loops).
- Behaviour: Copilot downloads the failing logs, clones the affected branch, applies the fix with changelog/docs/tests updates, and pushes the result (updating the PR or opening a dedicated automation PR).

Keep this file accurate—workflows load these expectations via the Copilot CLI when planning fixes.

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
