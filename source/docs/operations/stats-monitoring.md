---
title: PTR Monitoring Pipeline
date: 2025-10-24T12:33:51.455Z
---

# PTR Monitoring Pipeline

The Screeps Stats Monitor workflow (`screeps-stats-monitor.yml`) keeps a pulse on Public Test Realm performance.

## Data Collection

- Script: [`scripts/fetch-screeps-stats.mjs`](../../scripts/fetch-screeps-stats.mjs).
- Endpoint: `/api/user/stats` (default host `https://screeps.com`). Override with `SCREEPS_STATS_HOST` or
  `SCREEPS_STATS_API` if needed.
- Authentication: `SCREEPS_STATS_TOKEN` (falls back to `SCREEPS_TOKEN`). Store the secret in GitHub Actions settings.
- Output: `reports/screeps-stats/latest.json` containing `{ fetchedAt, endpoint, payload }`.

## Copilot Analysis

- Prompt: [`.github/copilot/prompts/stats-analysis.md`](../../.github/copilot/prompts/stats-analysis.md).
- Behaviour: Copilot reads the snapshot, summarises PTR health, and either files labelled issues (`monitoring`, `copilot`, and a
  severity) or explains why no action is required.
- Duplicates: Copilot must search existing issues using the GitHub MCP server. If an identical alert exists, it comments instead
  of creating a duplicate.

## Follow-up Expectations

- Engineers triage newly opened issues promptly and log remediation steps in `CHANGELOG.md`.
- Once the issue is resolved, add a regression test that covers the failure signal whenever possible.
- Update this document if metrics, endpoints, or severity rules change.
