---
title: "Release 0.7.13"
date: 2025-10-25T00:00:00.000Z
categories:
  - Release Notes
  - Bug Fixes
tags:
  - release
  - automation
  - testing
  - monitoring
---
We're pleased to announce version 0.7.13 of the Screeps GPT autonomous bot.

## What's New

### Bug Fixes

- **Regression test failure for copilot-exec force-response parameter (run #18795077062)**
  - Updated test to use correct workflow filenames after monitoring workflow consolidation
  - Changed `screeps-stats-monitor.yml` to `screeps-monitoring.yml` in test expectations
  - Removed reference to deleted `copilot-autonomous-monitor.yml` workflow
  - Test now correctly validates backward compatibility for force-response parameter

---

**Full Changelog**: [0.7.13 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.7.13)
