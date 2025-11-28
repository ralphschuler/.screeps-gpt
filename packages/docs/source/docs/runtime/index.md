---
title: Runtime Documentation
date: 2025-11-17T12:00:00.000Z
layout: page
---

# Runtime Documentation

Comprehensive documentation for the Screeps AI bot runtime behavior, strategy, and implementation.

## Overview

The runtime system is the core of the Screeps AI bot, executing every game tick to manage creeps, rooms, resources, and strategic decisions. This documentation covers the architecture, behavior patterns, and operational characteristics of the bot.

## Documentation Sections

### Architecture

- [**Behavior State Machines**](architecture/behavior-state-machines.html) - State machine architecture for creep behaviors
- [**Custom Kernel**](../../../../../docs/architecture/custom-kernel.html) - Kernel process architecture and integration
- [**Pathfinding**](pathfinding.html) - Traffic management and priority-based movement

### Strategy & Decision Making

- [**Creep Roles**](strategy/creep-roles.html) - Role definitions, decision trees, and performance characteristics
- [**Task Prioritization**](strategy/task-prioritization.html) - Task switching, efficiency optimization, and load balancing
- [**Scaling Strategies**](strategy/scaling-strategies.html) - RCL progression, multi-room expansion, and CPU budgeting

### Operations & Monitoring

- [**Memory Management**](operations/memory-management.html) - Memory patterns, cleanup strategies, and corruption recovery
- [**Performance Monitoring**](operations/performance-monitoring.html) - CPU tracking, optimization techniques, and alerting

### Development & Testing

- [**Strategy Testing**](development/strategy-testing.html) - Testing methodologies, validation procedures, and benchmarking
- [**Safe Refactoring**](development/safe-refactoring.html) - Guidelines for preserving game performance during code changes
- [**Improvement Metrics**](development/improvement-metrics.html) - Measuring strategy effectiveness and detecting regressions

## Key Concepts

### Architecture

The runtime is organized into several key subsystems:

- **Bootstrap/Kernel** - System initialization and module orchestration using decorator-based process registration
- **Behavior System** - State machine-based creep role execution using `RoleControllerManager` and dedicated role controllers
- **Memory System** - State persistence and consistency, including state machine serialization
- **Metrics System** - Performance tracking and CPU accounting
- **Evaluation System** - Health reports and improvement recommendations
- **Pathfinding System** - Traffic management and priority-based movement using screeps-pathfinding library

**State Machine Architecture**: Each creep role is implemented as a dedicated state machine with explicit states (idle, harvesting, delivering, etc.) and valid transitions. See [Behavior State Machines](architecture/behavior-state-machines.html) for details.

**Traffic Management**: The pathfinding system enables priority-based movement where higher priority creeps (harvesters, haulers) move first and can push lower priority creeps (upgraders) out of the way. See [Pathfinding](pathfinding.html) for details.

### Execution Model

Each game tick follows this execution flow:

1. **Bootstrap** - Initialize kernel and load modules
2. **Memory Cleanup** - Remove stale references and maintain consistency
3. **Role Execution** - Execute behaviors for all creeps based on their roles
4. **Spawn Management** - Queue and spawn new creeps as needed
5. **Metrics Collection** - Track CPU usage and performance
6. **Evaluation** - Generate health reports and recommendations

### Performance Considerations

- **CPU Budgeting** - Each room and role has CPU budget allocations
- **Caching** - Expensive operations are cached within the tick
- **Early Termination** - Non-critical tasks yield when CPU is constrained
- **Incremental Processing** - Large operations are spread across multiple ticks

## Related Documentation

- [Automation Guides](../automation/index.html) - CI/CD and workflow automation
- [Operations Documentation](../operations/index.html) - Deployment and troubleshooting
- [Analytics Dashboard](../analytics.html) - Performance metrics and visualization

## Quick Links

- [Main Documentation Index](../index.html)
- [GitHub Repository](https://github.com/ralphschuler/.screeps-gpt)
- [Screeps Console](https://screeps.com/console)
