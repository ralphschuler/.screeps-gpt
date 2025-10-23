# Getting Started with Screeps GPT

This guide walks you through setting up your development environment and getting started with the Screeps GPT autonomous AI development project.

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

Docker containers provide isolated environments with correct Node.js and Python versions without local installation. See [Docker Development Guide](operations/docker-guide.md) for details.

## Installation

### Local Development

Install project dependencies:

```bash
bun install
```

### Docker Development

Build Docker containers:

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

See the [Docker Development Guide](operations/docker-guide.md) for detailed usage, troubleshooting, and best practices.

**Modular Build Option**: Set `MODULAR_BUILD=true` to build separate modules for each runtime component instead of a single bundle. See [`automation/modular-deployment.md`](automation/modular-deployment.md) for details on benefits, usage, and configuration.

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
- **Document the investigation.** Summarise the root cause, the regression test name, and any mitigations in [`docs/`](../) (usually under `docs/operations/`).
- **Keep the changelog fresh.** Append your updates to the `[Unreleased]` section of [`CHANGELOG.md`](../CHANGELOG.md) and run `bun run versions:update` so the release index stays current.

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

The main loop lives in `src/main.ts` and delegates to a kernel that can be exercised in tests or tooling. The system automatically detects when all spawns are lost and flags critical respawn conditions in evaluation reports—see [`operations/respawn-handling.md`](operations/respawn-handling.md) for details.

## Required Secrets

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

## Push Notifications

The repository supports real-time push notifications via [Push by Techulus](https://push.techulus.com) for critical events:

- Deploy pipeline successes and failures
- Quality gate failures on pull requests
- PTR monitoring alerts (high CPU usage, low energy, anomalies)

Push notifications are **optional**. If `PUSH_TOKEN` is not configured, workflows continue normally without sending notifications. The notification system includes rate limiting and error handling to prevent spam and ensure workflow reliability.

See [`automation/push-notifications.md`](automation/push-notifications.md) for detailed configuration and usage instructions.

## Repository Evaluation Pipeline

`scripts/evaluate-system.ts` aggregates coverage output and environment hints into a `RepositorySignal`, runs the same `SystemEvaluator` that powers the runtime health checks, and records the result in `reports/system-evaluation.json`. Use this command locally after running the test + coverage suite to understand whether the current code is considered ready for deployment and which improvements are recommended.

## Documentation Site & Release Index

- Generate the static documentation site locally with `bun run build:docs-site`. The output is written to `build/docs-site/` and matches what GitHub Pages serves from the `docs-pages` workflow.
- Keep the changelog index synchronised by running `bun run versions:update` after editing `CHANGELOG.md`; the command updates `docs/changelog/versions.{json,md}` which power the release history page.
- The hosted site provides light/dark themes and surfaces links to every documented release.

## TASKS.md Protocol

`TASKS.md` tracks active and recently completed work. Keep it up to date when addressing issues or adding new objectives. Completed tasks should be annotated with a completion note before eventual removal to preserve context.

## Contributing

1. **Install dependencies**:
   - Local: `bun install`
   - Docker: `bun run docker:build`
2. Read [`AGENTS.md`](../AGENTS.md) to understand repository conventions and agent guidelines.
3. Make changes, updating documentation and tasks along the way.
4. **Run quality checks**:
   - Local: `bun run format:write`, `bun run lint`, and the relevant test suites
   - Docker: `bun run docker:format`, `bun run docker:lint`, `bun run docker:test:unit`
5. Regenerate the system evaluation report if behaviour or test coverage changes.
6. Submit a pull request and allow the automation to verify your changes.

**Docker Development**: For isolated, reproducible environments, use Docker commands (e.g., `bun run docker:test:unit`). See [Docker Development Guide](operations/docker-guide.md) for details.

The automation stack is designed to improve iteratively; feel free to enhance the behaviours, evaluation heuristics, or workflows, but keep the guarantees above intact.

## Next Steps

- Explore [Automation Overview](automation/overview.md) to understand the GitHub Actions workflows
- Review [Agent Guidelines](../AGENTS.md) for Copilot automation conventions
- Read [Developer Guide](../DOCS.md) for additional learning resources and best practices
- Check [Runtime Strategy Documentation](runtime/strategy/creep-roles.md) to understand bot behavior
