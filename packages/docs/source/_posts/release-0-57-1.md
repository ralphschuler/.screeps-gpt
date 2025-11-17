---
title: "Release 0.57.1"
date: 2025-11-12T00:00:00.000Z
categories:
  - Release Notes
  - Bug Fixes
tags:
  - release
  - documentation
  - testing
  - performance
  - monitoring
---
We're pleased to announce version 0.57.1 of the Screeps GPT autonomous bot.

## What's New

### Bug Fixes

- **Task System CPU Starvation Prevention**: Implemented round-robin scheduling to ensure fair creep execution under CPU constraints
  - Added `tickOffset` rotation to prevent same creeps from being consistently skipped
  - Added `lastExecuted` tracking map to monitor execution gaps per creep
  - Added `getStarvationStats()` method for monitoring fairness metrics
  - With 25 creeps and CPU allowing 12/tick: old system permanently starved 13 creeps, new system cycles all with max 14-tick gaps
  - Created 13 unit tests in `tests/unit/taskManager-round-robin.test.ts` validating fair scheduling
  - Created 7 regression tests in `tests/regression/task-system-cpu-starvation.test.ts` for high creep count scenarios
  - Updated `docs/runtime/task-system.md` with round-robin scheduling documentation
  - All creeps now get equal opportunity to execute tasks, eliminating permanent starvation
  - Resolves issue: Task system CPU threshold checking may cause starvation with high creep counts
- **StatsCollector Error Handling**: Added comprehensive error handling to prevent silent stats collection failures
  - Wrapped main collection in try/catch to prevent exceptions from blocking Memory.stats writes
  - Isolated room stats collection to prevent one bad room from breaking entire collection
  - Added fallback mechanism to ensure Memory.stats always has valid structure with safe property access
  - Resolves #658: Bot executes normally but Stats API returns empty data

---

**Full Changelog**: [0.57.1 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.57.1)
