---
title: "Release 0.80.0"
date: 2025-11-15T00:00:00.000Z
categories:
  - Release Notes
  - Bug Fixes
tags:
  - release
  - automation
  - testing
---

We're pleased to announce version 0.80.0 of the Screeps GPT autonomous bot.

## What's New

### Bug Fixes

- **CI Autofix Circuit Breaker**: Implemented circuit breaker to prevent infinite retry loops in CI autofix workflow
  - Added circuit breaker logic to track consecutive failures (max 3 attempts)
  - Implemented 15-minute backoff period between retry attempts
  - Created automatic escalation to GitHub issues when circuit breaker trips
  - Added diagnostic logging showing retry attempts and circuit breaker status
  - Circuit breaker resets on successful autofix or after backoff period
  - Prevents workflow saturation from repeated failed autofix attempts
  - Checks for existing escalation issues to avoid duplicates
  - Added comprehensive regression test suite (16 tests) in `tests/regression/ci-autofix-circuit-breaker.test.ts`
  - Resolves issue: fix(automation): CI autofix workflow saturation - 17+ consecutive action_required failures

---

**Full Changelog**: [0.80.0 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.80.0)
