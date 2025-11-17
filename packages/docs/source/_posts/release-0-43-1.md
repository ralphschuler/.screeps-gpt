---
title: "Release 0.43.1"
date: 2025-11-10T00:00:00.000Z
categories:
  - Release Notes
  - Bug Fixes
tags:
  - release
  - testing
  - performance
  - monitoring
---

We're pleased to announce version 0.43.1 of the Screeps GPT autonomous bot.

## What's New

### Bug Fixes

- **Console Telemetry Fallback**: Fixed "expression size too large" error by implementing chunked query strategy
  - Split single large console command into 5 smaller, focused queries (CPU, GCL, rooms, creeps, resources)
  - Each query limited to 1000-1200 characters to stay within Screeps API limits
  - Added retry logic with exponential backoff (3 attempts, 1s/2s/4s delays)
  - Added expression size validation before sending commands to API
  - Restored monitoring resilience when Stats API returns empty data
  - Added comprehensive test suite (`tests/unit/fetch-console-telemetry.test.ts`) with 9 test cases
  - Resolves #526: Console fallback "expression size too large" error
  - Related to #523: PTR telemetry blackout requiring console fallback

---

**Full Changelog**: [0.43.1 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.43.1)
