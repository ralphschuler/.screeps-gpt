---
title: "Release 0.83.23"
date: 2025-11-16T00:00:00.000Z
categories:
  - Release Notes
  - Bug Fixes
tags:
  - release
  - documentation
  - testing
---
We're pleased to announce version 0.83.23 of the Screeps GPT autonomous bot.

## What's New

### Bug Fixes

- **Task System Default State Inconsistency**: Aligned build-time default with runtime default and documentation
  - Changed `buildProject.ts` default from `"false"` to `"true"` to match v0.32.0+ enabled-by-default design
  - Updated build configuration comments to document default values explicitly
  - Task system is now truly enabled by default at build time (matches runtime fallback behavior)
  - Set `TASK_SYSTEM_ENABLED=false` at build time to disable if needed
  - Added regression test to validate default task system state matches expected behavior
  - Resolves confusion between code comments claiming "enabled by default" and actual disabled behavior

---

**Full Changelog**: [0.83.23 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.83.23)
