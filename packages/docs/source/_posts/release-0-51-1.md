---
title: "Release 0.51.1"
date: 2025-11-12T00:00:00.000Z
categories:
  - Release Notes
  - Bug Fixes
tags:
  - release
  - automation
  - documentation
  - testing
  - performance
  - monitoring
  - deployment
---
We're pleased to announce version 0.51.1 of the Screeps GPT autonomous bot.

## What's New

### Bug Fixes

- **PTR Telemetry Blackout Regression**: Implemented comprehensive prevention measures for recurring stats collection failures (#550)
  - Added validation to StatsCollector to detect Memory.stats write failures
  - Created `scripts/validate-telemetry-health.ts` for automated health checks
  - Integrated telemetry health validation into monitoring workflow (runs every 30 minutes)
  - Added post-deployment validation step (5 min wait + health check)
  - Created regression test suite `tests/regression/stats-collection-blackout.test.ts` with 8 test cases
  - Enhanced documentation in `docs/operations/stats-collection.md` with troubleshooting and recovery procedures
  - Implements automated detection of empty stats within 15 minutes
  - Prevents recurrence of issues #523, #331, #345 through proactive monitoring
  - Resolves #550: PTR telemetry blackout regression - empty stats data despite successful deployments

---

**Full Changelog**: [0.51.1 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.51.1)
