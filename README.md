# Screeps GPT Automation Stack

This repository hosts an autonomous Screeps AI that continuously develops, tests, reviews, and deploys itself. It combines a Node.js 16 + TypeScript codebase with npm package manager and a suite of GitHub Actions that enforce quality gates, drive GitHub Copilot CLI automation, and ship tagged releases straight to the Screeps MMO. Deep-dive runbooks now live in [`docs/`](docs/)—update them whenever you touch automation or incident response so Copilot stays aligned with reality.

## Prerequisites

- [Node.js](https://nodejs.org/) v16.x (the repository uses Node 16 with Python 2 for native dependencies).
- [npm](https://www.npmjs.com/) v8.0 or later (bundled with Node.js 16).
- Screeps account with an API token when deploying.
- Personal access token with Copilot Requests permission for the GitHub Copilot CLI.
- [`act`](https://github.com/nektos/act) CLI and Docker (for dry-running workflows locally).

Install project dependencies with:

```bash
npm install
```

## Day-to-day Development

| Command                   | Purpose                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run build`           | Bundle the Screeps AI into `dist/main.js` using esbuild.                                  |
| `npm run test:unit`       | Run unit tests (Vitest).                                                                  |
| `npm run test:e2e`        | Execute end-to-end kernel simulations (configured for the Screeps PTR).                   |
| `npm run test:mockup`     | Run tick-based tests using screeps-server-mockup (skipped if isolated-vm fails to build). |
| `npm run test:regression` | Check regression scenarios for evaluation logic.                                          |
| `npm run test:coverage`   | Produce coverage reports consumed by the evaluation pipeline.                             |
| `npm run test:actions`    | Run formatting + lint checks and dry-run critical workflows with the `act` CLI.           |
| `npm run lint`            | Run ESLint with the strict TypeScript profile.                                            |
| `npm run format:write`    | Format the repository with Prettier.                                                      |
| `npm run analyze:system`  | Evaluate the current build quality and emit `reports/system-evaluation.json`.             |
| `npm run deploy`          | Build and upload the AI to the Screeps API (requires deployment secrets).                 |

### Bug Fix Protocol

- **Capture the failure first.** Write or update a regression test that demonstrates the bug before committing any fix.
- **Document the investigation.** Summarise the root cause, the regression test name, and any mitigations in [`docs/`](docs/) (usually under `docs/operations/`).
- **Keep the changelog fresh.** Append your updates to the `[Unreleased]` section of [`CHANGELOG.md`](CHANGELOG.md) and run `npm run versions:update` so the release index stays current.

## Runtime Architecture

- `src/runtime/bootstrap/` – Kernel wiring that orchestrates memory maintenance, behavioural control, performance tracking, and evaluation.
- `src/runtime/behavior/` – High-level creep role orchestration and spawn logic.
- `src/runtime/memory/` – Helpers to keep `Memory` consistent between ticks.
- `src/runtime/metrics/` – CPU usage and execution accounting.
- `src/runtime/respawn/` – Automatic detection and handling of respawn scenarios when all spawns are lost.
- `src/runtime/evaluation/` – Generates health reports and improvement recommendations from runtime and repository signals.
- `src/shared/` – Shared contracts for metrics, evaluation results, and repository telemetry.
- `scripts/` – Node.js 16 + TypeScript automation scripts (build, deploy, version bump, repository evaluation).
- `tests/` – Vitest suites split into unit, e2e, and regression directories.
- `reports/` – Persistent analysis artifacts (e.g., `system-evaluation.json`).

The main loop lives in `src/main.ts` and delegates to a kernel that can be exercised in tests or tooling. The system automatically detects when all spawns are lost and flags critical respawn conditions in evaluation reports—see [`docs/operations/respawn-handling.md`](docs/operations/respawn-handling.md) for details.

## Automated Quality & Deployment

The repository defines the following GitHub workflows under `.github/workflows/` (see [`docs/automation/overview.md`](docs/automation/overview.md) for expanded notes):

1. **`quality-gate.yml`** – Runs on every pull request targeting `main` and executes linting, formatting checks, unit tests, end-to-end simulations (against the PTR profile), regression tests, and coverage collection.
2. **`post-merge-release.yml`** – Fires on `push` to `main` (excludes release commits). It applies lint/format fixes, uses **semantic versioning** based on conventional commits to automatically determine version bump type (major/minor/patch), commits the version bump directly to main with `[skip ci]`, creates a version tag, and creates a GitHub Release with auto-generated release notes using GitHub's native API.
3. **`deploy.yml`** – Listens for tags that match `v*` OR GitHub Release published events. It builds the bundle and executes `npm run deploy` to push the code to Screeps using the GitHub `production` environment for deployment protection rules (supports `SCREEPS_DEPLOY_DRY_RUN` for local workflow tests).
4. **`docs-pages.yml`** – Builds the static documentation site from `README.md`, `docs/`, and `CHANGELOG.md`, then publishes it to GitHub Pages.
5. **`copilot-review.yml`** – Scheduled and manually invokable Copilot CLI audit of the entire repository. Copilot now authenticates with `gh`, clones the repo, files any required issues directly, and prints a JSON recap to the logs.
6. **`copilot-issue-triage.yml`** – Triggered when an issue is opened; Copilot reads the issue, reformulates its title and description to outline required changes clearly, applies appropriate labels, and adds a triage comment with recommendations.
7. **`copilot-todo-pr.yml`** – Issues labelled `Todo` trigger Copilot to clone the repo, create a draft pull request immediately for transparency, implement the fix incrementally with visible progress updates, run the npm checks, mark the PR as ready for review, and comment back on the source issue. Users can follow along with the implementation in real-time through the draft PR.
8. **`copilot-todo-daily.yml`** – Runs daily to automatically identify the oldest actionable issue (without incomplete sub-tasks) and apply the `Todo` label to trigger automated implementation.
9. **`copilot-email-triage.yml`** – Triggered by `repository_dispatch` webhooks that contain email content; Copilot reviews the message and files any resulting GitHub issues itself, then records the triage summary in the workflow logs.
10. **`dependabot-automerge.yml`** – Enables automatic merging of Dependabot updates (excluding semver-major bumps) once required checks pass.
11. **`screeps-stats-monitor.yml`** – Runs every 30 minutes; Copilot fetches PTR telemetry using Screeps credentials, analyses the snapshot, and files/updates monitoring issues directly through the GitHub CLI.
12. **`label-sync.yml`** – Keeps the repository labels aligned with `.github/labels.yml`.
13. **`copilot-ci-autofix.yml`** – Watches for failures in any workflow (except itself to prevent infinite loops), lets Copilot download the logs, clone the affected branch, apply the fix with updated docs/tests/changelog, and push the result (either updating the PR or opening a fresh automation PR).

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

**Note on Authentication:** The Stats Monitor workflow now uses the Screeps API MCP server for direct server interaction. It supports both token-based (`SCREEPS_TOKEN`) and email/password authentication (`SCREEPS_EMAIL` + `SCREEPS_PASSWORD`). Token authentication is recommended for security.

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

- Generate the static documentation site locally with `npm run build:docs-site`. The output is written to `build/docs-site/` and matches what GitHub Pages serves from the `docs-pages` workflow.
- Keep the changelog index synchronised by running `npm run versions:update` after editing `CHANGELOG.md`; the command updates `docs/changelog/versions.{json,md}` which power the release history page.
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

1. Install dependencies with `npm install`.
2. Read [`AGENTS.md`](AGENTS.md) to understand repository conventions and agent guidelines.
3. Make changes, updating documentation and tasks along the way.
4. Run `npm run format:write`, `npm run lint`, and the relevant test suites.
5. Regenerate the system evaluation report if behaviour or test coverage changes.
6. Submit a pull request and allow the automation to verify your changes.

The automation stack is designed to improve iteratively; feel free to enhance the behaviours, evaluation heuristics, or workflows, but keep the guarantees above intact.
