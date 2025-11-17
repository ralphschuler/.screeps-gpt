---
title: "Release 0.54.0: Container-Based Harvesting Automation"
date: 2025-11-12T00:00:00.000Z
categories:
  - Release Notes
  - Features
tags:
  - release
  - automation
  - testing
  - performance
---

We're pleased to announce version 0.54.0 of the Screeps GPT autonomous bot.

## What's New

### New Features

- **Container-Based Harvesting Automation**: Implemented dynamic role adjustment system that transitions to efficient container-based economy when infrastructure is ready
  - Added repairer role for structure maintenance (prioritizes roads and containers, then other structures)
  - Repairer body optimized for repair work: 2 WORK, 1 CARRY, 2 MOVE (300 energy cost)
  - System automatically detects containers near energy sources and adjusts role spawning:
    - Spawns 1 stationary harvester per source with adjacent container
    - Spawns 2 haulers per controlled room for energy transport
    - Spawns 1 repairer per controlled room for infrastructure maintenance
    - Reduces regular harvester minimum from 4 to 2 when using container-based system
  - Added repairer memory interface and task constants (repairerGather, repair)
  - Created comprehensive test suite in `tests/unit/repairer.test.ts` (3 tests)
  - Repairer gathers energy from containers/storage, repairs infrastructure prioritizing roads/containers
  - System seamlessly transitions between mobile harvesters and stationary+hauler economy
  - Resolves #667: Add repairer and hauler to the system with container-based automation

---

**Full Changelog**: [0.54.0 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.54.0)
