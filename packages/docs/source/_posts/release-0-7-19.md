---
title: "Release 0.7.19"
date: 2025-10-25T00:00:00.000Z
categories:
  - Release Notes
  - Bug Fixes
tags:
  - release
  - automation
  - testing
  - deployment
---
We're pleased to announce version 0.7.19 of the Screeps GPT autonomous bot.

## What's New

### Bug Fixes

- **Deploy workflow trigger mechanism (run #18800751206)**
  - Updated deploy workflow to use `workflow_run` events instead of `release` events
  - Fixed version resolution logic to use `git describe --tags --abbrev=0` for workflow_run triggers
  - Improved conditional logic to handle both workflow_run and workflow_dispatch events properly
  - Resolves regression tests expecting modernized CI/CD integration with Post Merge Release workflow

---

**Full Changelog**: [0.7.19 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.7.19)
