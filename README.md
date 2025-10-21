# Screeps GPT Automation Stack

This repository hosts an autonomous Screeps AI that continuously develops, tests, reviews, and deploys itself. It combines a Bun + TypeScript codebase with a suite of GitHub Actions that enforce quality gates, drive GitHub Copilot CLI automation, and ship tagged releases straight to the Screeps MMO. Deep-dive runbooks now live in [`docs/`](docs/)—update them whenever you touch automation or incident response so Copilot stays aligned with reality.

## Prerequisites

- [Bun](https://bun.sh/) v1.0 or later (the repository uses `packageManager: "bun"`).
- Screeps account with an API token when deploying.
- Personal access token with Copilot Requests permission for the GitHub Copilot CLI.

Install project dependencies with:

```bash
bun install
```

## Day-to-day Development

| Command | Purpose |
| --- | --- |
| `bun run build` | Bundle the Screeps AI into `dist/main.js` using esbuild. |
| `bun run test:unit` | Run unit tests (Vitest). |
| `bun run test:e2e` | Execute end-to-end kernel simulations (configured for the Screeps PTR). |
| `bun run test:regression` | Check regression scenarios for evaluation logic. |
| `bun run test:coverage` | Produce coverage reports consumed by the evaluation pipeline. |
| `bun run lint` | Run ESLint with the strict TypeScript profile. |
| `bun run format:write` | Format the repository with Prettier. |
| `bun run analyze:system` | Evaluate the current build quality and emit `reports/system-evaluation.json`. |
| `bun run deploy` | Build and upload the AI to the Screeps API (requires deployment secrets). |

### Bug Fix Protocol

- **Capture the failure first.** Write or update a regression test that demonstrates the bug before committing any fix.
- **Document the investigation.** Summarise the root cause, the regression test name, and any mitigations in [`docs/`](docs/) (usually under `docs/operations/`).
- **Keep the changelog fresh.** Overwrite [`CHANGELOG.md`](CHANGELOG.md) so it only contains the changes introduced by your pull request.

## Runtime Architecture

- `src/runtime/bootstrap/` – Kernel wiring that orchestrates memory maintenance, behavioural control, performance tracking, and evaluation.
- `src/runtime/behavior/` – High-level creep role orchestration and spawn logic.
- `src/runtime/memory/` – Helpers to keep `Memory` consistent between ticks.
- `src/runtime/metrics/` – CPU usage and execution accounting.
- `src/runtime/evaluation/` – Generates health reports and improvement recommendations from runtime and repository signals.
- `src/shared/` – Shared contracts for metrics, evaluation results, and repository telemetry.
- `scripts/` – Bun-driven automation (build, deploy, version bump, repository evaluation).
- `tests/` – Vitest suites split into unit, e2e, and regression directories.
- `reports/` – Persistent analysis artifacts (e.g., `system-evaluation.json`).

The main loop lives in `src/main.ts` and delegates to a kernel that can be exercised in tests or tooling.

## Automated Quality & Deployment

The repository defines the following GitHub workflows under `.github/workflows/` (see [`docs/automation/overview.md`](docs/automation/overview.md) for expanded notes):

1. **`quality-gate.yml`** – Runs on every pull request targeting `main` and executes linting, formatting checks, unit tests, end-to-end simulations (against the PTR profile), regression tests, and coverage collection.
2. **`post-merge-release.yml`** – Fires on `push` to `main`. It applies lint/format fixes with write access, bumps the patch version via `bun run version:bump`, commits the result, and creates a new `v*` tag for release automation.
3. **`deploy.yml`** – Listens for tags that match `v*`. It builds the bundle and executes `bun run deploy` to push the code to Screeps using API credentials stored in repository secrets.
4. **`copilot-review.yml`** – Scheduled and manually invokable Copilot CLI audit of the entire repository. Copilot emits a JSON payload of findings that is converted into individual GitHub issues for tracked remediation.
5. **`copilot-todo-pr.yml`** – When an issue receives the `Todo` label the workflow checks out a fresh branch, prompts Copilot CLI to apply changes, executes the Bun quality gates, and opens a pull request with the suggested changes.
6. **`dependabot-automerge.yml`** – Enables automatic merging of Dependabot updates (excluding semver-major bumps) once required checks pass.
7. **`screeps-stats-monitor.yml`** – Runs every 30 minutes to fetch PTR telemetry, lets Copilot analyse it via the GitHub MCP server, and files monitoring issues automatically.
8. **`label-sync.yml`** – Keeps the repository labels aligned with `.github/labels.yml`.
9. **`copilot-ci-autofix.yml`** – Watches `quality-gate` failures, asks Copilot to prepare a fix (including docs, changelog, and regression tests), and either commits to the PR branch or opens a new pull request.

### Required Secrets

Add the following GitHub Action secrets before enabling the workflows:

| Secret | Used by | Description |
| --- | --- | --- |
| `SCREEPS_TOKEN` | Deploy workflow | Screeps authentication token. |
| `SCREEPS_HOST` (optional) | Deploy workflow | Hostname for Screeps server (default `screeps.com`). |
| `SCREEPS_PORT` (optional) | Deploy workflow | Port for Screeps server (default `443`). |
| `SCREEPS_PROTOCOL` (optional) | Deploy workflow | Protocol (`https` by default). |
| `SCREEPS_BRANCH` (optional) | Deploy workflow | Destination Screeps branch (default `main`). |
| `SCREEPS_STATS_TOKEN` (optional) | Stats monitor | Token for the stats API (falls back to `SCREEPS_TOKEN`). |

All workflows rely on the default `GITHUB_TOKEN` for repository operations (pushes, PRs, issue management). Follow [Graphite's guidance on GitHub Action permissions](https://graphite.dev/guides/github-actions-permissions) when altering workflows so least-privilege scopes are preserved. See [DOCS.md](DOCS.md) for a deeper dive into automation prompts, PTR conventions, and recommended Screeps resources.

## Labels

Repository labels are synchronised via [`label-sync.yml`](.github/workflows/label-sync.yml) from [`.github/labels.yml`](.github/labels.yml). Do not edit labels manually in the UI—update the YAML file instead. Key labels include:

- `Todo` – Triggers Copilot Todo automation.
- `monitoring` – Created by the stats monitor for PTR anomalies.
- `severity/{high,medium,low}` – Used by Copilot-driven alerts to convey urgency.
- `needs/regression-test` – Apply when a bug report lacks coverage.
- `documentation`, `automation`, `runtime` – Highlight affected areas for triage.

## Repository Evaluation Pipeline

`scripts/evaluate-system.ts` aggregates coverage output and environment hints into a `RepositorySignal`, runs the same `SystemEvaluator` that powers the runtime health checks, and records the result in `reports/system-evaluation.json`. Use this command locally after running the test + coverage suite to understand whether the current code is considered ready for deployment and which improvements are recommended.

## TASKS.md Protocol

`TASKS.md` tracks active and recently completed work. Keep it up to date when addressing issues or adding new objectives. Completed tasks should be annotated with a completion note before eventual removal to preserve context.

## Contributing

1. Install dependencies with `bun install`.
2. Make changes, updating documentation and tasks along the way.
3. Run `bun run format:write`, `bun run lint`, and the relevant test suites.
4. Regenerate the system evaluation report if behaviour or test coverage changes.
5. Submit a pull request and allow the automation to verify your changes.

The automation stack is designed to improve iteratively; feel free to enhance the behaviours, evaluation heuristics, or workflows, but keep the guarantees above intact.
