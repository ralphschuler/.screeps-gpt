---
title: "Release 0.18.0: Phase 3 Advanced Economy"
date: 2025-11-07T00:00:00.000Z
categories:
  - Release Notes
  - Features
  - Bug Fixes
tags:
  - release
  - automation
  - documentation
  - testing
  - performance
---
We're pleased to announce version 0.18.0 of the Screeps GPT autonomous bot.

## What's New

### New Features

- **Phase 3 Advanced Economy**: Complete implementation of RCL 6-8 economy features
  - LinkManager: Automated energy distribution through link networks with role-based classification
  - TerminalManager: Inter-room resource logistics with priority-based transfer queue
  - LabManager: Compound production and creep boosting with state management (Tier 1 compounds only)
  - FactoryManager: Automated commodity production with priority queue system
- **Phase 4 Empire Coordination**: Initial implementation of empire-wide coordination features
  - CombatManager: Squad-based combat coordination with threat assessment
  - TrafficManager: Priority-based movement coordination with collision avoidance
- Unit tests for all new managers (LinkManager, TerminalManager, LabManager, FactoryManager, CombatManager, TrafficManager)
- Documentation for Phase 3 and Phase 4 features in `docs/automation/overview.md`
- Optional Memory persistence support for all Phase 3/4 managers with RoomPosition serialization

### Bug Fixes

- Fixed RoomPosition serialization in LinkManager and TrafficManager Memory persistence
- Fixed recipe system in LabManager to use Screeps constants instead of string literals
- Fixed engagement double-counting in CombatManager for hybrid attack/ranged creeps
- Fixed squad ID generation to prevent collisions using member composition hash
- Fixed boost array mutation during iteration in LabManager
- Optimized TerminalManager to avoid redundant room.find() calls

---

**Full Changelog**: [0.18.0 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.18.0)
