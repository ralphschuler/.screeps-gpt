---
title: "Release 0.83.7"
date: 2025-11-15T00:00:00.000Z
categories:
  - Release Notes
  - Bug Fixes
tags:
  - release
  - testing
  - performance
  - monitoring
---

We're pleased to announce version 0.83.7 of the Screeps GPT autonomous bot.

## What's New

### Bug Fixes

- **Memory.stats Collection Failure**: Fixed TypeScript interface conflict preventing stats collection and causing monitoring blackout
  - Root cause: `profiler/typings.d.ts` declared `interface Memory` without `declare global`, creating conflicting local interface
  - This prevented the global Memory interface in `types.d.ts` from recognizing `stats` property
  - Solution: Removed conflicting Memory interface declaration from profiler typings
  - Added regression test `memory-stats-interface.test.ts` to prevent future interface conflicts
  - Resolves issue #684 (Memory.stats collection failure) and unblocks strategic monitoring capabilities
  - Restores PTR telemetry collection, enabling performance analysis and anomaly detection

---

**Full Changelog**: [0.83.7 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.83.7)
