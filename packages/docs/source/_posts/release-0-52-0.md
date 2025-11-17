---
title: "Release 0.52.0: Bot Aliveness Heartbeat Monitoring"
date: 2025-11-12T00:00:00.000Z
categories:
  - Release Notes
  - Features
tags:
  - release
  - automation
  - documentation
  - testing
  - monitoring
---

We're pleased to announce version 0.52.0 of the Screeps GPT autonomous bot.

## What's New

### New Features

- **Bot Aliveness Heartbeat Monitoring**: Implemented automated bot heartbeat monitoring with graduated failure detection to catch outages within 30 minutes instead of 8+ hours
  - Created `packages/utilities/scripts/check-bot-health.ts` with multi-stage health checks (PTR stats → world-status API → console fallback)
  - Implemented graduated alert thresholds: 0-15 min (silent), 15-30 min (warning), 30-60 min (HIGH), 60+ min (CRITICAL)
  - Added persistent health state tracking in `reports/monitoring/health.json` with 100-entry detection history
  - Integrated health check into `.github/workflows/screeps-monitoring.yml` (runs every 30 minutes)
  - Enhanced `packages/utilities/scripts/check-ptr-alerts.ts` to generate bot outage alerts with push/email notifications
  - Added comprehensive test suite `tests/unit/check-bot-health.test.ts` with 9 tests covering persistence, thresholds, and history tracking
  - Updated documentation in `docs/automation/autonomous-monitoring.md` with Phase 3.5: Bot Aliveness Heartbeat specification
  - Health state committed alongside bot snapshots for historical tracking and trend analysis
  - Addresses monitoring blind spot where bot death was indistinguishable from telemetry failures
  - Resolves #561: Implement automated bot aliveness heartbeat with early failure detection

---

**Full Changelog**: [0.52.0 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.52.0)
