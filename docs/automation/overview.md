# Automation Overview

This document expands on the workflows under `.github/workflows/` and how they combine with the Copilot CLI.

## Quality Gate (`quality-gate.yml`)
- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Lint, formatting checks, unit tests, PTR e2e tests, regression tests, coverage + evaluation artifact upload.
- Notes: Configure PTR secrets locally before running the e2e suite. Failures here must be reproduced with a regression test
  before applying fixes (see repository rules in [README](../../README.md)).

## Post Merge Release (`post-merge-release.yml`)
- Trigger: Pushes to `main`.
- Behaviour: Applies lint/format fixes, bumps the version, commits, and tags `v*` releases.
- Secrets: Uses the default `GITHUB_TOKEN` with elevated `contents: write` permissions scoped to the workflow.

## Deploy (`deploy.yml`)
- Trigger: Tags that match `v*`.
- Behaviour: Builds and pushes code to the Screeps API (defaults to the PTR environment).
- Secrets: `SCREEPS_TOKEN` (required), `SCREEPS_HOST`/`PORT`/`PROTOCOL`/`BRANCH` (optional overrides).

## Copilot Repository Audit (`copilot-review.yml`)
- Trigger: Daily schedule + manual dispatch.
- Behaviour: Runs a full repository review using the GitHub MCP server to surface findings and file issues automatically.
- Output: `reports/copilot/repository-audit.json` artifact for reference.

## Copilot Todo Automation (`copilot-todo-pr.yml`)
- Trigger: Issues labelled `Todo`.
- Behaviour: Copilot applies changes on a temporary branch, runs Bun quality gates, then opens a PR with a structured summary.
- Permissions: Uses the default `GITHUB_TOKEN` for branch pushes and PR creation.

## Dependabot Auto Merge (`dependabot-automerge.yml`)
- Trigger: Dependabot pull request updates.
- Behaviour: Automatically enables auto-merge (squash) for non-major updates when checks pass.

## Screeps Stats Monitor (`screeps-stats-monitor.yml`)
- Trigger: Every 30 minutes + manual dispatch.
- Behaviour: Fetches PTR stats with `scripts/fetch-screeps-stats.mjs`, sends them to Copilot for analysis, and files monitoring
  issues when anomalies are detected.
- Secrets: `SCREEPS_STATS_TOKEN` (or reuse `SCREEPS_TOKEN`).

## Label Sync (`label-sync.yml`)
- Trigger: Manual dispatch or pushes to `main`.
- Behaviour: Ensures the repository's labels match `.github/labels.yml`.

## Copilot CI AutoFix (`copilot-ci-autofix.yml`)
- Trigger: Failed runs of `quality-gate`.
- Behaviour: Downloads the failing logs, invokes Copilot to prepare a fix (respecting docs/changelog rules), and either commits
  to the PR branch or opens a new PR when the failure occurs on `main`.

Keep this file accurate—workflows load these expectations via the Copilot CLI when planning fixes.
