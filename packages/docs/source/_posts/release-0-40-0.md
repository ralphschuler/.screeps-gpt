---
title: "Release 0.40.0: Pathfinding Abstraction Layer"
date: 2025-11-10T00:00:00.000Z
categories:
  - Release Notes
  - Features
tags:
  - release
  - documentation
  - testing
  - performance
  - security
---

We're pleased to announce version 0.40.0 of the Screeps GPT autonomous bot.

## What's New

### New Features

- **Pathfinding Abstraction Layer**: Integrated screeps-cartographer for advanced pathfinding optimization
  - Created `PathfindingProvider` interface for flexible pathfinding implementations
  - Implemented `DefaultPathfinder` using native Screeps PathFinder (baseline)
  - Implemented `CartographerPathfinder` using screeps-cartographer library
  - Added `PathfindingManager` with configuration system to toggle between providers
  - Integrated with TaskManager and TaskAction for task-based movement
  - Added `pathfindingProvider` configuration option to BehaviorController and TaskManager
  - Maintains backward compatibility with native pathfinding as default
  - Comprehensive documentation in `docs/runtime/pathfinding.md`
  - 14 unit tests covering provider selection, configuration, and behavior
  - Build size increased from 579.6kb to 713.2kb (+134kb for screeps-cartographer)
  - No security vulnerabilities detected in new dependency
  - Provides foundation for CPU-efficient pathfinding with caching and optimization
  - Task system automatically uses configured pathfinding provider
  - Test infrastructure updated to properly mock screeps-cartographer (Game, Memory, PathFinder globals)
  - All 506 existing tests continue to pass
  - Addresses #533: screeps-cartographer integration for advanced pathfinding

---

**Full Changelog**: [0.40.0 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.40.0)
