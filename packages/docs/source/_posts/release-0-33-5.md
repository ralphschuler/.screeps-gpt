---
title: "Release 0.33.5"
date: 2025-11-09T00:00:00.000Z
categories:
  - Release Notes
  - Improvements
tags:
  - release
  - documentation
  - performance
---

We're pleased to announce version 0.33.5 of the Screeps GPT autonomous bot.

## What's New

### Improvements

- **Account Upgraded to Lifetime Subscription**: Screeps account upgraded from free tier to lifetime subscription
  - CPU allocation increased from 20 to 50 (150% increase, +30 CPU)
  - Memory allocation remains at 2048 KB (unchanged)
  - Updated CPU thresholds to reflect new resource allocation:
    - PerformanceTracker: highCpuThreshold 70% → 75%, criticalCpuThreshold remains 90%
    - SystemEvaluator: cpuUsageWarningRatio 80% → 85%, cpuCriticalRatio remains 95%
    - BehaviorController: cpuSafetyMargin 80% → 85%
    - Kernel: cpuEmergencyThreshold remains 90% (last line of defense)
  - Benefits: Reduced CPU constraint concerns, enables advanced features (profiler, task management system) with better margins, reduces timeout risk
  - Strategic opportunity: Focus shifts from aggressive CPU optimization to sophisticated AI development with better safety margins
  - Documentation: Added comprehensive resource allocation guide at `docs/operations/resource-allocation.md`
  - Impact: Helps mitigate CPU timeout incidents (#468, #494) and enables evaluation of previously disabled features (#478, #475)

---

**Full Changelog**: [0.33.5 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.33.5)
