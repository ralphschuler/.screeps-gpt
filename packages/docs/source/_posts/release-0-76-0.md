---
title: "Release 0.76.0: Dying Creep Energy Dropping"
date: 2025-11-14T00:00:00.000Z
categories:
  - Release Notes
  - Features
tags:
  - release
  - documentation
  - testing
  - performance
---
We're pleased to announce version 0.76.0 of the Screeps GPT autonomous bot.

## What's New

### New Features

- **Dying Creep Energy Dropping**: Implemented automatic energy dropping behavior for creeps approaching end of life
  - Creeps with TTL below threshold (default: 50 ticks) automatically drop all carried energy
  - Prevents energy waste from creep despawning
  - Configurable via `Memory.dyingCreepBehavior` (enabled/disabled and threshold)
  - Visual feedback: dying creeps display "💀" emoji
  - Works with both task-based and role-based execution systems
  - Minimal CPU overhead: ~0.01 CPU per creep per tick
  - Created helper functions in `packages/bot/src/runtime/behavior/creepHelpers.ts`:
    - `isCreepDying(creep, threshold)`: Detects dying creeps
    - `handleDyingCreepEnergyDrop(creep)`: Handles energy drop logic
  - Integrated into BehaviorController pre-execution checks
  - Added 11 unit tests in `tests/unit/creepHelpers.test.ts`
  - Added 8 integration tests in `tests/unit/behaviorController.test.ts`
  - Created comprehensive documentation in `docs/runtime/creep-lifecycle.md`
  - Total test coverage: 795 passing tests
  - Resolves issue: feat(runtime): implement energy dropping behavior for dying creeps

---

**Full Changelog**: [0.76.0 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.76.0)
