---
title: "Release 0.7.25"
date: 2025-10-26T00:00:00.000Z
categories:
  - Release Notes
  - Improvements
tags:
  - release
  - testing
  - performance
---
We're pleased to announce version 0.7.25 of the Screeps GPT autonomous bot.

## What's New

### Improvements

- **CPU optimization to maintain below 90% threshold**
  - Reduced default CPU safety margin in BehaviorController from 90% to 80% for earlier creep processing cutoff
  - Reduced per-creep CPU threshold from 2.0 to 1.5 CPU to detect expensive operations earlier
  - Lowered PerformanceTracker warning threshold from 80% to 70% CPU usage
  - Lowered PerformanceTracker critical threshold from 95% to 90% CPU usage
  - Reduced Kernel emergency CPU threshold from 95% to 90%
  - Increased movement reusePath values from 5-20 ticks to 30-50 ticks to reduce pathfinding overhead
  - Added regression test suite to validate CPU optimization thresholds and prevent future performance degradation
  - These changes significantly reduce CPU consumption by minimizing expensive pathfinding operations

---

**Full Changelog**: [0.7.25 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.7.25)
