---
title: "Release 0.165.1: Codex-Exec Unifies the Automation Stack"
date: 2025-11-26T00:00:00.000Z
categories:
  - Release Notes
tags:
  - release
  - automation
  - workflows
  - openai-codex
  - ai-agents
---

## Introduction

Release 0.165.1 is all about tightening the automation spine that keeps Screeps GPT operating around the clock. We replaced the aging bespoke `copilot-exec` implementation with a thin compatibility layer that now delegates directly to `codex-exec`, our wrapper around the official `openai/codex-action@v1`. The goal is simple: eliminate redundant maintenance while keeping every workflow, agent, and regression suite humming without extra configuration.

## Key Features

- Unified every Copilot-powered workflow on top of the new `codex-exec` composite action.
- Preserved the legacy `copilot-exec` interface so existing prompts, tokens, and cache strategies continue to work.
- Hardened regression coverage to ensure delegation, caching, and token plumbing behave exactly like before (`tests/regression/copilot-exec-force-response.test.ts`).
- Synchronized documentation across the automation knowledge base (`packages/docs/source/docs/automation/overview.md`, `.github/copilot-instructions.md`, and `AGENTS.md`) so future agents understand the new stack.

## Technical Details

The heart of the release lives in `.github/actions/copilot-exec/action.yml`. Instead of carrying a full implementation, the action now contains a single step named “Delegate to codex-exec” that forwards every input—`prompt-path`, caching flags, MCP configuration, and the recently-added `force-response` switch—into `.github/actions/codex-exec/action.yml`. We intentionally kept parameter names untouched and map `copilot-token` to `codex-token` inside the wrapper. That small detail lets fifty-plus workflows continue using `secrets.GITHUB_TOKEN` or `secrets.OPENAI_API_KEY` without mechanical edits while still unlocking Codex-specific features such as official caching semantics.

The new `codex-exec` action brings several quality-of-life improvements straight from the upstream OpenAI tooling. It lazily checks whether the repository has already been cloned before invoking `actions/checkout@v4`, so matrix workflows no longer pay an extra checkout cost when one job has already cloned the repo. Prompt rendering happens via `envsubst`, and we hash the rendered prompt to create deterministic cache keys stored under `.codex-cache/output.txt`. A `Restore result cache` step uses `actions/cache@v4` and short-circuits the run when the exact prompt/model pair has already been answered, meaning routine automation (issue triage, changelog digestion, PTR monitoring) now hits cached responses far more often. When a cache miss occurs, the action shells out to `openai/codex-action@v1` with the resolved working directory, keeping execution logs and artifacts consistent with upstream expectations.

From an architecture standpoint, this migration aligns with the zero-tolerance policy for obsolete code that we documented in `AGENTS.md`. Maintaining a custom CLI required shadowing upstream API changes and re-implementing token handling. Delegating to Codex collapses that surface area into a single wrapper while still letting us enforce guardrails like sandbox mode (`allow-all-paths`) and verbose telemetry. It also standardizes how we pass MCP configuration via the `additional-mcp-config` parameter, which is critical because workflows such as `.github/workflows/copilot-review.yml` and `.github/workflows/copilot-issue-triage.yml` rely on the same MCP servers (GitHub + Playwright). Instead of each workflow owning its own integration glue, they all inherit the logic from `codex-exec` through the compatibility wrapper.

## Bug Fixes

This release did not ship discrete bug fixes. However, the automation overhaul effectively resolves the maintenance drag caused by divergent CLI implementations. By relying on the official Codex action, we no longer hit drift where local changes lag behind upstream API behavior, and the `force-response` parameter in `tests/regression/copilot-exec-force-response.test.ts` guarantees cache busting works when workflows demand fresh data.

## Breaking Changes

None. Every workflow keeps calling `copilot-exec` under the same contract. The compatibility layer translates inputs behind the scenes, so there is no need to rename steps, update secrets, or tweak outputs. Specialized agents located under `.github/actions/copilot-*-agent/` still expose their own ergonomics but ultimately call `codex-exec` under the hood, which the regression suite explicitly verifies.

## Impact

Operationally, consolidating on `codex-exec` cuts the automation maintenance footprint while improving reliability:

- **Consistent Behavior**: Workflows such as `copilot-changelog-to-blog.yml`, `copilot-email-triage.yml`, and `copilot-strategic-planner.yml` now share the exact same execution engine, eliminating subtle drift that previously showed up when the custom CLI adopted a feature later than another workflow needed it.
- **Faster Runs**: Conditional checkout and prompt result caching shave tens of seconds off high-frequency workflows. Because the cache key is now the prompt SHA plus model, unrelated changes elsewhere in the repo no longer invalidate AI outputs.
- **Simpler Secret Management**: Documentation updates in `packages/docs/source/docs/automation/overview.md` and `.github/copilot-instructions.md` reiterate that workflows map `copilot-token` to `codex-token`, so rotating secrets or onboarding a new agent involves changing values in one place.
- **Auditability**: The regression suite ensures `.github/workflows/*` either call `codex-exec` directly or depend on a specialized agent that does. The tests also check that every migrated workflow reads `codex-token: \\${{ secrets.OPENAI_API_KEY }}`, giving us high confidence that future contributors won’t accidentally fall back to the deprecated path.

## What’s Next

With the execution layer modernized, the next releases will focus on two fronts. First, we want to expose Codex-specific telemetry (latency, token counts, cache hits) directly inside the guard workflows so maintainers can spot drift before it shows up in PTR monitoring. Second, we plan to document an end-to-end recipe for writing new agents that plug into `codex-exec` without duplicating logic—think of it as a “starter kit” that lives beside `packages/docs/source/docs/automation/overview.md`. Expect additional instrumentation and authoring guidance as we continue refining the autonomous development pipeline.
