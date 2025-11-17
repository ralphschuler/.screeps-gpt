---
title: "Release 0.7.11"
date: 2025-10-24T00:00:00.000Z
categories:
  - Release Notes
  - Bug Fixes
  - Improvements
tags:
  - release
  - automation
  - documentation
  - testing
  - monitoring
  - deployment
  - security
---
We're pleased to announce version 0.7.11 of the Screeps GPT autonomous bot.

## What's New

### Improvements

- **Consolidated monitoring workflows for improved efficiency**
  - Merged `copilot-autonomous-monitor.yml` and `screeps-stats-monitor.yml` into single `screeps-monitoring.yml` workflow
  - Combines autonomous strategic monitoring with PTR telemetry analysis in unified execution
  - Reduces workflow overhead from two parallel runs to one consolidated run every 30 minutes
  - Maintains all existing functionality: MCP server integration, PTR anomaly detection, strategic analysis, push notifications
  - Updated all documentation references to reflect consolidation
  - Updated `copilot-ci-autofix.yml` workflow trigger list
  - Created unified prompt template `.github/copilot/prompts/screeps-monitor` with 7-phase analysis pipeline

### Bug Fixes

- **Post Merge Release workflow permission error (run #18794330724)**
  - Excluded workflow files from prettier formatting in .prettierignore
  - Resolves GitHub rejection when pushing commits after workflows:write permission was removed
  - Prevents workflow file modifications during automated release process
  - Maintains security by avoiding workflows:write permission requirement
- **TypeScript type safety violations in fetch-screeps-stats test (run #18793984308)**
  - Removed unnecessary eslint-disable comments that weren't effective
  - Added proper TypeScript types to vitest mocks using `ReturnType<typeof vi.fn>`
  - Replaced `(global.fetch as any)` patterns with properly typed `mockFetch` variable
  - Added type assertions for mock.calls access patterns with explicit types like `[string, RequestInit]`
  - Used optional chaining for safer header access in assertions
  - Resolves linting failures that were blocking post-merge release workflow

---

**Full Changelog**: [0.7.11 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.7.11)
