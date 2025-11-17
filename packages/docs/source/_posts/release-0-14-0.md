---
title: "Release 0.14.0"
date: 2025-11-07T00:00:00.000Z
categories:
  - Release Notes
  - Bug Fixes
tags:
  - release
  - documentation
  - testing
  - performance
  - monitoring
  - deployment
---

We're pleased to announce version 0.14.0 of the Screeps GPT autonomous bot.

## What's New

### Bug Fixes

- **Modular Build Documentation and Validation (#506)**
  - Updated modular deployment documentation to accurately reflect ES2018 target (was incorrectly documented as ES2021)
  - Expanded module list documentation to include all 15 generated modules (behavior, bootstrap, defense, evaluation, infrastructure, memory, metrics, planning, respawn, scouting, tasks, types, utils, visuals)
  - Updated deployment size estimates to reflect actual builds (~95KB single bundle vs ~384KB modular)
  - Added build-time validation to verify expected artifacts are generated
  - Validation ensures `main.js` is always present and all runtime modules are generated in modular builds
  - ES2018 target compliance regression test now passes with complete modular build validation
  - Root cause: Documentation was outdated and lacked validation to catch missing artifacts during builds

---

**Full Changelog**: [0.14.0 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.14.0)
