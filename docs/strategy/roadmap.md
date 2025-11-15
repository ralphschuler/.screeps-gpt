# Strategic Roadmap

This document tracks the current state of bot development, phase completion status, success metrics, and strategic priorities.

**Last Updated**: 2025-11-15

## Current Phase: Phase 1 (Foundation)

**Completion Status**: ~85%

### Phase 1 Success Metrics

| Metric               | Target      | Current Status              |
| -------------------- | ----------- | --------------------------- |
| Energy Surplus       | >10/tick    | ⚠️ Pending telemetry (#791) |
| CPU Usage            | <5/tick     | ⚠️ Pending telemetry (#791) |
| Spawn Uptime         | >90%        | ⚠️ Pending telemetry (#791) |
| RCL Level            | 2+          | ✅ Achieved                 |
| Container Harvesting | Implemented | 🔄 In Progress (#783)       |

### Phase 1 Blockers

1. **Telemetry Blackout** (#791) - PTR stats monitoring broken, preventing validation of success metrics
2. **Container Placement Optimization** (#783) - Container-based harvesting automation pending completion

### Phase 1 Completed Items

- ✅ Project structure and TypeScript configuration
- ✅ Main game loop with kernel orchestration
- ✅ Memory initialization and reset hooks (MemoryManager)
- ✅ Creep and spawn management (harvester, upgrader, builder roles)
- ✅ Construction planning (BasePlanner for extensions and containers)
- ✅ Pixel generation (PixelGenerator)
- ✅ Structured logging (Logger)
- ✅ Unit tests for memory bootstrapping and core systems
- ✅ Regression tests for extension placement
- ✅ Bootstrap phase implementation for early-game optimization
- ✅ Dynamic role adjustment for container-based economy

### Phase 1 Remaining Items

- [ ] Enhanced spawn priority system with energy threshold checks
- [ ] Complete container-based harvesting automation (#783)
- [ ] Automated road network planning (source → spawn, source → controller)
- [ ] Dynamic role population based on room state
- [ ] CPU usage optimization (<5 CPU/tick target)

## Phase 2 Preview: Core Framework

**Status**: Foundation in place, active development

### Phase 2 Key Objectives

- Task queue system with priority levels
- Spawn queue with dynamic part generation
- Task assignment algorithm (closest idle creep, capability matching)
- Storage manager for resource distribution
- Link network optimization
- Tower automation for defense and repair
- Centralized memory segments
- Path caching with TTL management
- RoomManager abstraction

### Phase 2 Completed Items

- ✅ Task queue system design and implementation
- ✅ Spawn queue system with priority-based spawning
- ✅ Link network optimization (LinkManager)
- ✅ Tower automation (TowerManager)

### Phase 2 Remaining Items

- [ ] Task assignment algorithm refinement
- [ ] Storage manager implementation
- [ ] Memory segments for persistent data
- [ ] Path caching with TTL
- [ ] RoomManager abstraction with registry

## Strategic Priorities

### Q4 2024 / Q1 2025 Focus

1. **Complete Phase 1** - Unblock telemetry and validate success metrics
2. **Stabilize Phase 2** - Complete task assignment and storage management
3. **Improve Observability** - Restore PTR monitoring and enhance metrics collection
4. **Optimize CPU Usage** - Profile and optimize expensive operations

### Known Technical Debt

- **Memory fragmentation** - Potential optimization in Memory.creeps cleanup
- **Path caching** - Currently no path caching, causing repeated pathfinding operations
- **Task assignment** - Simple distance-based assignment, could use more sophisticated algorithms
- **Error handling** - Some edge cases lack comprehensive error handling

### Expansion Roadmap

**Phase 1 → Phase 2** (Current)

- Prerequisites: Telemetry restored, container harvesting complete, CPU <5/tick
- Estimated Duration: 2-3 weeks
- Key Risks: CPU budget constraints, memory management complexity

**Phase 2 → Phase 3** (Future)

- Prerequisites: Task system stable, storage manager operational, link network deployed
- Estimated Duration: 4-6 weeks
- Key Risks: Remote room coordination complexity, defense requirements

**Phase 3 → Phase 4** (Future)

- Prerequisites: Terminal management working, lab automation complete, factory operational
- Estimated Duration: 6-8 weeks
- Key Risks: Multi-room logistics, resource balancing across rooms

**Phase 4 → Phase 5** (Future)

- Prerequisites: Empire coordination established, combat system functional
- Estimated Duration: 8-12 weeks
- Key Risks: Inter-shard communication, colony expansion algorithms

## Success Validation

Phase completion requires:

1. **All objectives completed** - Core features implemented and tested
2. **Success metrics met** - Quantitative targets achieved and validated via telemetry
3. **No critical blockers** - All high-priority issues resolved
4. **Documentation updated** - Phase documentation, learning insights captured
5. **Regression tests passing** - All tests green, new tests added for new features

## Milestone History

- **2024-11-06**: Phase 1 bootstrapping completed (RCL 1-2 foundation)
- **2024-11-06**: Phase 2 task queue and spawn system implemented
- **2024-11-07**: Phase 3 components (link, terminal, lab, factory managers) added
- **2024-11-07**: Phase 4 combat and traffic coordination added
- **2024-11-07**: Phase 5 colony manager and analytics implemented
- **2024-11-12**: Container-based harvesting automation added
- **2024-11-12**: Round-robin task scheduling implemented
- **2024-11-13**: Strategic planning automation launched
- **2024-11-15**: Strategic documentation framework created

## Related Documentation

- [TASKS.md](../../TASKS.md) - Detailed task breakdown aligned to phases
- [Phase Documentation](phases/) - Detailed phase objectives and implementation status
- [Learning Insights](learning/) - Patterns and lessons learned
