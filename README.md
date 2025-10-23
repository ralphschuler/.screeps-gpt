# Screeps GPT Automation Stack

This repository hosts an autonomous Screeps AI that continuously develops, tests, reviews, and deploys itself. It combines a Bun-managed TypeScript codebase targeting Node.js 18–22 with a suite of GitHub Actions that enforce quality gates, drive GitHub Copilot CLI automation, and ship tagged releases straight to the Screeps MMO. Deep-dive runbooks now live in [`docs/`](docs/)—update them whenever you touch automation or incident response so Copilot stays aligned with reality.

## Prerequisites

### Local Development

- [Bun](https://bun.sh) v1.0 or later (primary package manager and script runner).
- [Node.js](https://nodejs.org/) 18.x–22.x (Node 22 is used in CI to install the Copilot CLI).
- Screeps account with an API token when deploying.
- Personal access token with Copilot Requests permission for the GitHub Copilot CLI.
- [`act`](https://github.com/nektos/act) CLI and Docker (for dry-running workflows locally).

### Docker Development (Alternative)

For a consistent, isolated development environment:

- [Docker](https://docs.docker.com/get-docker/) 20.10 or later
- [Docker Compose](https://docs.docker.com/compose/install/) v2.0 or later

Docker containers provide isolated environments with correct Node.js and Python versions without local installation. See [Docker Development Guide](docs/operations/docker-guide.md) for details.

Install project dependencies:

**Local development:**

```bash
bun install
```

**Docker development:**

```bash
bun run docker:build
```

## Day-to-day Development

### Local Development Commands

| Command                   | Purpose                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `bun run build`           | Bundle the Screeps AI into `dist/main.js` using esbuild (single bundle by default).       |
| `bun run test:unit`       | Run unit tests (Vitest).                                                                  |
| `bun run test:e2e`        | Execute end-to-end kernel simulations (configured for the Screeps PTR).                   |
| `bun run test:mockup`     | Run tick-based tests using screeps-server-mockup (skipped if isolated-vm fails to build). |
| `bun run test:regression` | Check regression scenarios for evaluation logic.                                          |
| `bun run test:coverage`   | Produce coverage reports consumed by the evaluation pipeline.                             |
| `bun run test:actions`    | Run formatting + lint checks and dry-run critical workflows with the `act` CLI.           |
| `bun run lint`            | Run ESLint with the strict TypeScript profile.                                            |
| `bun run format:write`    | Format the repository with Prettier.                                                      |
| `bun run analyze:system`  | Evaluate the current build quality and emit `reports/system-evaluation.json`.             |
| `bun run deploy`          | Build and upload the AI to the Screeps API (requires deployment secrets).                 |

### Docker Development Commands

For consistent, isolated environments without local Node.js/Python installation:

| Command                      | Purpose                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `bun run docker:build`       | Build all Docker containers (test, build, mockup).      |
| `bun run docker:build:ai`    | Build the Screeps AI in a container.                    |
| `bun run docker:test:unit`   | Run unit tests in container (Node.js 20).               |
| `bun run docker:test:e2e`    | Run end-to-end tests in container.                      |
| `bun run docker:test:mockup` | Run mockup tests in container (Node.js 16 + Python 2).  |
| `bun run docker:lint`        | Run ESLint in container.                                |
| `bun run docker:format`      | Check code formatting in container.                     |
| `bun run docker:dev`         | Start development server with hot-reload in container.  |
| `bun run docker:shell`       | Open interactive shell in test container for debugging. |

See the [Docker Development Guide](docs/operations/docker-guide.md) for detailed usage, troubleshooting, and best practices.

**Modular Build Option**: Set `MODULAR_BUILD=true` to build separate modules for each runtime component instead of a single bundle. See [`docs/automation/modular-deployment.md`](docs/automation/modular-deployment.md) for details on benefits, usage, and configuration.

### Pre-commit Hooks

This repository uses [husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/okonet/lint-staged) to enforce code quality standards before commits. When you run `bun install`, the hooks are automatically installed.

**What runs on commit:**

- **Linting**: ESLint automatically fixes and checks TypeScript files for code quality issues
- **Formatting**: Prettier formats all staged files to maintain consistent code style
- **Unit Tests**: All unit tests run to catch regressions early (typically completes in <1 second)

**Bypassing hooks:**
If you need to commit without running the hooks (e.g., work-in-progress commits), use the `--no-verify` flag:

```bash
git commit --no-verify -m "WIP: incomplete feature"
```

**Note:** The CI pipeline will still run all checks on pull requests, so bypassing hooks locally doesn't skip quality validation.

### Bug Fix Protocol

- **Capture the failure first.** Write or update a regression test that demonstrates the bug before committing any fix.
- **Document the investigation.** Summarise the root cause, the regression test name, and any mitigations in [`docs/`](docs/) (usually under `docs/operations/`).
- **Keep the changelog fresh.** Append your updates to the `[Unreleased]` section of [`CHANGELOG.md`](CHANGELOG.md) and run `bun run versions:update` so the release index stays current.

## Runtime Architecture

- `src/runtime/bootstrap/` – Kernel wiring that orchestrates memory maintenance, behavioural control, performance tracking, and evaluation.
- `src/runtime/behavior/` – High-level creep role orchestration and spawn logic.
- `src/runtime/memory/` – Helpers to keep `Memory` consistent between ticks.
- `src/runtime/metrics/` – CPU usage and execution accounting.
- `src/runtime/respawn/` – Automatic detection and handling of respawn scenarios when all spawns are lost.
- `src/runtime/evaluation/` – Generates health reports and improvement recommendations from runtime and repository signals.
- `src/shared/` – Shared contracts for metrics, evaluation results, and repository telemetry.
- `scripts/` – Node.js 18–22 compatible TypeScript automation scripts executed through Bun (build, deploy, version bump, repository evaluation).
- `tests/` – Vitest suites split into unit, e2e, and regression directories.
- `reports/` – Persistent analysis artifacts (e.g., `system-evaluation.json`).

The main loop lives in `src/main.ts` and delegates to a kernel that can be exercised in tests or tooling. The system automatically detects when all spawns are lost and flags critical respawn conditions in evaluation reports—see [`docs/operations/respawn-handling.md`](docs/operations/respawn-handling.md) for details.

## Automated Quality & Deployment

The repository defines the following GitHub workflows under `.github/workflows/` (see [`docs/automation/overview.md`](docs/automation/overview.md) for expanded notes):

1. **Quality Guards** (`guard-*.yml`) – Multiple focused workflows run on every pull request targeting `main`, including: linting (ESLint), formatting (Prettier), YAML linting, version validation, build checks, unit tests, end-to-end simulations (against the PTR profile), regression tests, and coverage collection. Each guard runs independently for better granularity and parallel execution.
2. **`post-merge-release.yml`** – Fires on `push` to `main` (excludes release commits). It applies lint/format fixes, uses **semantic versioning** based on conventional commits to automatically determine version bump type (major/minor/patch), commits the version bump directly to main with `[skip ci]`, creates a version tag, and creates a GitHub Release with auto-generated release notes using GitHub's native API.
3. **`deploy.yml`** – Listens for tags that match `v*` OR GitHub Release published events. It builds the bundle and executes `bun run deploy` to push the code to Screeps using the GitHub `production` environment for deployment protection rules (supports `SCREEPS_DEPLOY_DRY_RUN` for local workflow tests).
4. **`docs-pages.yml`** – Builds the static documentation site from `README.md`, `docs/`, and `CHANGELOG.md`, then publishes it to GitHub Pages.
5. **`copilot-review.yml`** – Scheduled and manually invokable Copilot CLI audit of the entire repository. Copilot now authenticates with `gh`, clones the repo, files any required issues directly, and prints a JSON recap to the logs.
6. **`copilot-issue-triage.yml`** – Triggered when an issue is opened; Copilot reads the issue, reformulates its title and description to outline required changes clearly, applies appropriate labels, and adds a triage comment with recommendations.
7. **`copilot-speckit.yml`** – Implements specification-driven development workflow. Issues labelled `speckit` trigger Copilot to generate a detailed implementation plan as a comment on the issue. Users can refine the plan by commenting with `@speckit` followed by feedback. When ready, `@speckit finalize` reviews the plan, applies final improvements, adds the `Todo` label to trigger automated implementation, and posts a confirmation comment.
8. **`copilot-todo-pr.yml`** – Issues labelled `Todo` trigger Copilot to clone the repo, create a draft pull request immediately for transparency, implement the fix incrementally with visible progress updates, run the Bun checks, mark the PR as ready for review, and comment back on the source issue. Users can follow along with the implementation in real-time through the draft PR.
9. **`copilot-todo-daily.yml`** – Runs daily to automatically identify the oldest actionable issue (without incomplete sub-tasks) and apply the `Todo` label to trigger automated implementation.
10. **`copilot-email-triage.yml`** – Triggered by `repository_dispatch` webhooks that contain email content; Copilot reviews the message and files any resulting GitHub issues itself, then records the triage summary in the workflow logs.
11. **`dependabot-automerge.yml`** – Enables automatic merging of Dependabot updates (excluding semver-major bumps) once required checks pass.
12. **`screeps-stats-monitor.yml`** – Runs every 30 minutes; Copilot uses the `scripts/fetch-screeps-stats.mjs` script to fetch PTR telemetry from the Screeps REST API, analyses the snapshot, and files/updates monitoring issues directly through the GitHub CLI.
13. **`label-sync.yml`** – Keeps the repository labels aligned with `.github/labels.yml`.
14. **`copilot-ci-autofix.yml`** – Watches for failures in any workflow (except itself to prevent infinite loops), lets Copilot download the logs, clone the affected branch, apply the fix with updated docs/tests/changelog, and push the result (either updating the PR or opening a fresh automation PR).

### Required Secrets

Add the following GitHub Action secrets before enabling the workflows:

| Secret                           | Used by               | Description                                                     |
| -------------------------------- | --------------------- | --------------------------------------------------------------- |
| `SCREEPS_TOKEN`                  | Deploy, Stats monitor | Screeps authentication token (primary authentication method).   |
| `SCREEPS_EMAIL` (optional)       | Stats monitor         | Screeps account email (alternative to token authentication).    |
| `SCREEPS_PASSWORD` (optional)    | Stats monitor         | Screeps account password (alternative to token authentication). |
| `SCREEPS_HOST` (optional)        | Deploy, Stats monitor | Hostname for Screeps server (default `screeps.com`).            |
| `SCREEPS_PORT` (optional)        | Deploy, Stats monitor | Port for Screeps server (default `443`).                        |
| `SCREEPS_PROTOCOL` (optional)    | Deploy, Stats monitor | Protocol (`https` by default).                                  |
| `SCREEPS_BRANCH` (optional)      | Deploy workflow       | Destination Screeps branch (default `main`).                    |
| `SCREEPS_STATS_TOKEN` (optional) | Stats monitor         | Token for the stats API (falls back to `SCREEPS_TOKEN`).        |
| `COPILOT_TOKEN` (optional)       | Copilot workflows     | GitHub personal access token with Copilot Requests scope.       |
| `PUSH_TOKEN` (optional)          | All workflows         | Push by Techulus API key for push notifications.                |

**Note on Authentication:** The Stats Monitor workflow now uses the Screeps API MCP server for direct server interaction. It supports both token-based (`SCREEPS_TOKEN`) and email/password authentication (`SCREEPS_EMAIL` + `SCREEPS_PASSWORD`). Token authentication is recommended for security.

### Push Notifications

The repository supports real-time push notifications via [Push by Techulus](https://push.techulus.com) for critical events:

- Deploy pipeline successes and failures
- Quality gate failures on pull requests
- PTR monitoring alerts (high CPU usage, low energy, anomalies)

Push notifications are **optional**. If `PUSH_TOKEN` is not configured, workflows continue normally without sending notifications. The notification system includes rate limiting and error handling to prevent spam and ensure workflow reliability.

See [`docs/automation/push-notifications.md`](docs/automation/push-notifications.md) for detailed configuration and usage instructions.

### Copilot Model Configuration

All Copilot workflows use a configurable model selection system. The model is resolved in this priority order:

1. **Workflow input parameter** – Workflows can explicitly specify a model when calling `copilot-exec`
2. **`COPILOT_MODEL` environment variable** – Set at workflow or repository level
3. **Copilot CLI default** – If no model is specified, Copilot CLI uses its own default model

To specify a model for a specific workflow, set the `model` input parameter when calling the `copilot-exec` action, or set the `COPILOT_MODEL` environment variable in the workflow file or use GitHub's repository variables/secrets feature.

All workflows rely on the default `GITHUB_TOKEN` for repository operations (pushes, PRs, issue management). Follow [Graphite's guidance on GitHub Action permissions](https://graphite.dev/guides/github-actions-permissions) when altering workflows so least-privilege scopes are preserved. See [DOCS.md](DOCS.md) for a deeper dive into automation prompts, PTR conventions, and recommended Screeps resources.

## Labels

Repository labels are synchronised via [`label-sync.yml`](.github/workflows/label-sync.yml) from [`.github/labels.yml`](.github/labels.yml). Do not edit labels manually in the UI—update the YAML file instead. The repository uses a standardized three-tier labeling system:

**Process Labels** – Workflow triggers and automation:

- `Todo` – Triggers Copilot Todo automation.
- `monitoring` – Created by the stats monitor for PTR anomalies.
- `needs/regression-test` – Apply when a bug report lacks coverage.

**State Labels** – Issue lifecycle management:

- `state/pending`, `state/backlog`, `state/in-progress`, `state/blocked`, `state/canceled`, `state/done`

**Type Labels** – Issue classification:

- `type/bug`, `type/feature`, `type/enhancement`, `type/chore`, `type/question`

**Priority Labels** – Urgency and importance:

- `priority/critical`, `priority/high`, `priority/medium`, `priority/low`, `priority/none`

**Domain Labels** – Technical areas:

- `automation`, `documentation`, `runtime`, `monitoring`, `dependencies`, `regression`

**Workflow Labels** – Common GitHub patterns:

- `good-first-issue`, `help-wanted`, `wontfix`, `duplicate`, `invalid`

**Note:** Legacy labels (`bug`, `enhancement`, `severity/*`) are deprecated in favor of the new `type/*` and `priority/*` labels but are temporarily kept for backward compatibility.

## Repository Evaluation Pipeline

`scripts/evaluate-system.ts` aggregates coverage output and environment hints into a `RepositorySignal`, runs the same `SystemEvaluator` that powers the runtime health checks, and records the result in `reports/system-evaluation.json`. Use this command locally after running the test + coverage suite to understand whether the current code is considered ready for deployment and which improvements are recommended.

## Documentation Site & Release Index

- Generate the static documentation site locally with `bun run build:docs-site`. The output is written to `build/docs-site/` and matches what GitHub Pages serves from the `docs-pages` workflow.
- Keep the changelog index synchronised by running `bun run versions:update` after editing `CHANGELOG.md`; the command updates `docs/changelog/versions.{json,md}` which power the release history page.
- The hosted site provides light/dark themes and surfaces links to every documented release.

## TASKS.md Protocol

`TASKS.md` tracks active and recently completed work. Keep it up to date when addressing issues or adding new objectives. Completed tasks should be annotated with a completion note before eventual removal to preserve context.

## Agent Guidelines

For GitHub Copilot and automation agents operating in this repository, comprehensive guidelines are maintained in [`AGENTS.md`](AGENTS.md). This document covers:

- Agent roles, scope, and operational boundaries
- Complete knowledge base references (documentation, workflows, runtime architecture)
- Operational rules (tooling, coding standards, documentation discipline)
- Guardrails and best practices (security, quality gates, labels)
- Required secrets and workflow configuration
- Agent onboarding checklist

Contributors and agents should review `AGENTS.md` before making changes to ensure alignment with repository conventions and automation expectations.

## Contributing

1. **Install dependencies**:
   - Local: `bun install`
   - Docker: `bun run docker:build`
2. Read [`AGENTS.md`](AGENTS.md) to understand repository conventions and agent guidelines.
3. Make changes, updating documentation and tasks along the way.
4. **Run quality checks**:
   - Local: `bun run format:write`, `bun run lint`, and the relevant test suites
   - Docker: `bun run docker:format`, `bun run docker:lint`, `bun run docker:test:unit`
5. Regenerate the system evaluation report if behaviour or test coverage changes.
6. Submit a pull request and allow the automation to verify your changes.

**Docker Development**: For isolated, reproducible environments, use Docker commands (e.g., `bun run docker:test:unit`). See [Docker Development Guide](docs/operations/docker-guide.md) for details.

The automation stack is designed to improve iteratively; feel free to enhance the behaviours, evaluation heuristics, or workflows, but keep the guarantees above intact.
