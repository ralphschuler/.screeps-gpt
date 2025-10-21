# Automation Overview

This document expands on the workflows under `.github/workflows/` and how they combine with the Copilot CLI.

## Quality Gate (`quality-gate.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Lint, formatting checks, unit tests, PTR e2e tests, regression tests, coverage + evaluation artifact upload, plus verification that `docs/changelog/versions.*` matches `bun run versions:update`.
- Notes: Configure PTR secrets locally before running the e2e suite. Failures here must be reproduced with a regression test before applying fixes (see repository rules in [README](../../README.md)).

## Post Merge Release (`post-merge-release.yml`)

- Trigger: Pushes to `main`.
- Behaviour: Applies lint/format fixes, bumps the version, commits, and tags `v*` releases.
- Secrets: Uses the default `GITHUB_TOKEN` with elevated `contents: write` permissions scoped to the workflow.

## Deploy (`deploy.yml`)

- Trigger: Tags that match `v*`.
- Behaviour: Builds and pushes code to the Screeps API (defaults to the PTR environment). Set `SCREEPS_DEPLOY_DRY_RUN=true` for local `act` dry-runs to skip the API call.
- Secrets: `SCREEPS_TOKEN` (required), `SCREEPS_HOST`/`PORT`/`PROTOCOL`/`BRANCH` (optional overrides).

## Copilot Repository Audit (`copilot-review.yml`)

- Trigger: Daily schedule + manual dispatch.
- Behaviour: Copilot authenticates with `gh`, clones the repo, audits automation/runtime quality, files or updates GitHub issues directly, and prints a JSON recap to the logs.
- Output: Summary is logged instead of uploading an artifact.

## Documentation Pages (`docs-pages.yml`)

- Trigger: Pushes to `main`, published releases, and manual dispatches.
- Behaviour: Executes `bun run versions:update` and `bun run build:docs-site`, then publishes `build/docs-site` to GitHub Pages.
- Permissions: Requires `pages: write` and `id-token: write`.

## Copilot Issue Triage (`copilot-issue-triage.yml`)

- Trigger: Issues opened.
- Behaviour: Copilot reads the newly created issue, reformulates its title and description to clearly outline required changes and expectations, applies appropriate labels based on content, and adds a triage comment with recommendations.
- Permissions: Uses the default `GITHUB_TOKEN` with `issues: write` to edit issue metadata and add comments.

## Copilot Todo Automation (`copilot-todo-pr.yml`)

- Trigger: Issues labelled `Todo`.
- Behaviour: Copilot clones the repository, implements the fix while running Bun checks, pushes a `copilot/todo-*` branch, opens a PR with automation labels, and comments back on the triggering issue.
- Permissions: Uses the default `GITHUB_TOKEN` for `gh` pushes, PR creation, and issue comments.

## Copilot Email Triage (`copilot-email-triage.yml`)

- Trigger: `repository_dispatch` events with `event_type` set to `copilot_email_triage`.
- Behaviour: Copilot reviews the email payload, files any required GitHub issues directly with `gh`, and records a concise summary in the logs.
- Notes: External webhook callers must include the email payload under `client_payload.email`.

## Dependabot Auto Merge (`dependabot-automerge.yml`)

- Trigger: Dependabot pull request updates.
- Behaviour: Automatically enables auto-merge (squash) for non-major updates when checks pass.

## Screeps Stats Monitor (`screeps-stats-monitor.yml`)

- Trigger: Every 30 minutes + manual dispatch.
- Behaviour: Copilot uses Screeps API credentials to fetch telemetry, analyse anomalies, and open/update monitoring issues through `gh` with severity labels.
- Secrets: `SCREEPS_STATS_TOKEN` (or reuse `SCREEPS_TOKEN`).

## Label Sync (`label-sync.yml`)

- Trigger: Manual dispatch or pushes to `main`.
- Behaviour: Ensures the repository's labels match `.github/labels.yml`.

## Copilot CI AutoFix (`copilot-ci-autofix.yml`)

- Trigger: Failed runs of `quality-gate`.
- Behaviour: Copilot downloads the failing logs, clones the affected branch, applies the fix with changelog/docs/tests updates, and pushes the result (updating the PR or opening a dedicated automation PR).

Keep this file accurate—workflows load these expectations via the Copilot CLI when planning fixes.

---

### Local workflow validation

Run `bun run test:actions` to execute linting, formatting checks, and dry-run the key workflows (`quality-gate`, `post-merge-release`, `deploy`, `docs-pages`, `copilot-email-triage`) using the `act` CLI. Populate placeholder secrets in `tests/actions/secrets.env` before invoking the command.
