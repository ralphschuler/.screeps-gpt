---
title: "Release 0.44.0: Bootstrap Phase"
date: 2025-11-10T00:00:00.000Z
categories:
  - Release Notes
  - Features
tags:
  - release
  - automation
  - documentation
  - testing
  - performance
  - monitoring
---
We're pleased to announce version 0.44.0 of the Screeps GPT autonomous bot.

## What's New

### New Features

- **Bootstrap Phase**: Implemented automated first-room resource optimization with harvester-focused spawning
  - Added `BootstrapPhaseManager` class for bootstrap phase state management
  - Integrated bootstrap logic with Kernel and BehaviorController
  - Adjusts role minimums during bootstrap phase (6 harvesters, 1 upgrader, 0 builders = 80%+ harvesters)
  - Automatically activates for new rooms with controller level < 2
  - Exits when controller level 2 reached OR stable infrastructure (4+ harvesters, 300+ energy)
  - Tracks bootstrap state in Memory with persistence across code reloads
  - Configurable completion criteria via `BootstrapConfig`
  - Comprehensive documentation in `docs/runtime/bootstrap.md`
  - 37 unit tests validating bootstrap activation, completion, role minimums, and integration
  - Resolves #530: Implement bootstrap phase for optimal first-room resource utilization
- **Operational Milestones Documentation**: Created `docs/operations/milestones.md` for tracking progression achievements
  - Documented E46S58 controller level 2 upgrade milestone (2025-11-08, shard3)
  - Established milestone tracking framework for controller upgrades, territorial expansion, and infrastructure development
  - Includes automation recommendations for future milestone detection
  - Related to #533: Monitoring verification for controller upgrade detection

---

**Full Changelog**: [0.44.0 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.44.0)
