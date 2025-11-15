# Phase 2: Core Framework

**Status**: In Progress (60% Complete)
**RCL Target**: 3-4
**Timeline**: Started 2024-11-06, Target Completion: 2025-01-15

## Overview

Phase 2 builds the core framework for efficient resource management and task execution. This phase introduces sophisticated task queuing, spawn optimization, storage management, and energy distribution systems that enable the bot to scale beyond basic survival into efficient economy management.

## Objectives

### Primary Objectives

1. **Task Queue System** - Priority-based task generation and assignment
2. **Spawn Queue Optimization** - Dynamic body part generation and spawn prioritization
3. **Task Assignment Algorithm** - Intelligent creep-to-task matching
4. **Storage Manager** - Centralized resource distribution and storage logic
5. **Link Network** - Energy highway optimization for efficient energy transfer
6. **Tower Automation** - Automated defense and repair
7. **Memory Segments** - Persistent data storage beyond Memory object
8. **Path Caching** - TTL-based path caching to reduce pathfinding CPU cost
9. **RoomManager Abstraction** - Unified room management interface

### Success Criteria

| Criterion | Target | Status |
|-----------|--------|--------|
| Task completion rate | >90% | ⏳ Pending validation |
| Spawn queue depth | <5 tasks | ⏳ Pending validation |
| Storage fill rate | >80% | ⏳ Not yet measured |
| Link efficiency | >90% energy transferred | ⏳ Not yet measured |
| Tower uptime | 100% | ⏳ Not yet measured |
| CPU per creep | <0.5 | ⏳ Not yet measured |

## Implementation Status

### Completed Features

#### Task Queue System (100%)

Implemented 2024-11-06

- ✅ Task interface with priority levels (critical, high, normal, low)
- ✅ TaskManager with improved generation and assignment
- ✅ Task types: harvest, upgrade, build, repair, transfer
- ✅ Regression tests for task assignment scenarios
- ✅ Documentation in `docs/automation/overview.md`

**Key Capabilities**:
- Priority-based task ordering
- Automatic task generation from room state
- Task assignment tracking
- Task lifecycle management (generation → assignment → completion)

**Lessons Learned**:
- Task persistence across ticks essential for CPU efficiency
- Priority levels prevent low-priority tasks from starving critical operations
- Round-robin creep execution prevents CPU starvation in high-creep-count scenarios

#### Spawn Queue System (100%)

Implemented 2024-11-06

- ✅ SpawnManager with priority-based spawn queue
- ✅ Dynamic body part generation based on available energy
- ✅ Cold boot recovery for empty room scenarios
- ✅ 17 regression tests covering spawn scenarios
- ✅ Documentation in `docs/runtime/operations/spawn-management.md`

**Key Capabilities**:
- Priority-based spawn ordering
- Energy-adaptive body part generation (spawn larger creeps when energy available)
- Role minimum enforcement
- Emergency spawn logic for critical role shortages

**Lessons Learned**:
- Dynamic part generation enables spawning when energy limited while maximizing creep capability when energy abundant
- Cold boot recovery essential for respawn scenarios and fresh room starts
- Priority system prevents builder/repairer spam when harvesters needed

#### Link Network Optimization (100%)

Implemented 2024-11-07

- ✅ LinkManager with role-based classification
- ✅ Link roles: source, storage, controller, upgrade
- ✅ Automated energy transfers from source → consumer links
- ✅ Priority system favoring controller links

**Key Capabilities**:
- Automatic link role detection based on proximity to sources/controller/storage
- Energy transfer planning to minimize hauler traffic
- Priority-based consumer selection (controller > storage)

**Lessons Learned**:
- Link classification simplifies transfer logic dramatically
- Source links filling, controller links emptying is simple but effective heuristic
- Link network provides massive CPU savings by reducing hauler pathfinding

#### Tower Automation (100%)

Implemented 2024-11-06

- ✅ TowerManager with threat-based targeting
- ✅ Prioritized attack/heal/repair actions
- ✅ Regression tests for defense prioritization

**Key Capabilities**:
- Automatic hostile detection and targeting
- Friendly creep healing
- Structure repair (prioritizes ramparts, then other structures)
- Energy management (only repair when energy >50%)

**Lessons Learned**:
- Simple priority system (attack > heal > repair) handles most scenarios
- Energy threshold prevents tower from draining room energy on repairs
- Multiple towers automatically coordinate through shared targeting

### In Progress Features

#### Task Assignment Algorithm (25%)

**Priority**: High
**Status**: Basic distance-based assignment working, needs improvement

Current implementation:
- ✅ Distance-based assignment (closest idle creep)
- ⏳ Capability matching (assign tasks to creeps with required parts)
- ⏳ Load balancing (distribute tasks evenly across creeps)
- ⏳ Task affinity (prefer assigning similar tasks to same creep)

Planned improvements:
- Capability-based filtering (only assign repair tasks to creeps with WORK parts)
- Path cost consideration (account for terrain and road availability)
- Task clustering (group nearby tasks for same creep)
- Energy cost prediction (consider creep energy when assigning tasks)

#### Storage Manager (0%)

**Priority**: High
**Status**: Design phase

Planned features:
- Centralized resource tracking across containers, storage, terminal
- Withdrawal priority system (prefer storage > containers > terminal)
- Deposit routing (direct energy to spawns/extensions when needed, storage when surplus)
- Resource balancing across multiple rooms (future)

Design considerations:
- How to handle mixed resources (energy, minerals, etc.)
- When to use terminal vs storage
- Integration with hauler role assignment

#### Path Caching (0%)

**Priority**: Medium
**Status**: Not yet started

Planned features:
- TTL-based cache for frequently used paths
- Cache invalidation when terrain changes (construction, rampart placement)
- Memory segment storage for persistent caching
- Cache hit/miss metrics for monitoring

Design considerations:
- Cache storage location (Memory vs RawMemory segments)
- Cache key format (from/to positions, opts hash)
- Cache size limits and eviction policy

#### RoomManager Abstraction (0%)

**Priority**: Medium
**Status**: Not yet started

Planned features:
- Unified interface for room operations
- Manager registry for different room subsystems
- Room state tracking (owned, reserved, remote, hostile)
- Room transition handling (claim, unclaim, reservation)

Design considerations:
- How to structure manager hierarchy
- Communication between managers
- Room state persistence

### Pending Features

#### Memory Segments (0%)

**Priority**: Low
**Status**: Not yet started

Use cases:
- Path cache persistence
- Historical room stats
- Scouting data for multiple shards
- Long-term strategic data

#### Centralized Memory Management (0%)

**Priority**: Low
**Status**: MemoryManager exists, but not centralized

Potential improvements:
- Automatic garbage collection of stale data
- Memory budget enforcement
- Compression for large data structures

## Blockers

### Critical Blockers

None currently. Phase 2 can progress independently of Phase 1 blockers.

### Non-Critical Issues

1. **Task Assignment Efficiency**
   - Current distance-based algorithm suboptimal for complex room layouts
   - Workaround: Works adequately for simple layouts, optimization can wait

2. **Storage Manager Design**
   - Design not yet finalized, blocking implementation
   - Workaround: Haulers manually find closest container/storage

3. **Path Caching Storage**
   - Unclear whether to use Memory vs RawMemory segments
   - Workaround: No path caching, higher CPU cost but functional

## Lessons Learned

### Successful Patterns

1. **Round-Robin Task Scheduling**
   - Implemented to prevent CPU starvation in high-creep-count scenarios (v0.57.1)
   - Tick offset rotation ensures all creeps get fair execution opportunities
   - Related: [Learning: Round-Robin Task Scheduling](../learning/round-robin-scheduling.md)

2. **Priority-Based Systems**
   - Priority queues (spawn queue, task queue) consistently outperform FIFO approaches
   - Simple priority levels (critical, high, normal, low) sufficient for most use cases
   - Priority enables emergency response (e.g., spawn critical roles first)

3. **Dynamic Body Part Generation**
   - Spawn queue adapts creep size to available energy
   - Enables functioning economy at any energy level
   - Maximizes creep capability when energy abundant

### Failed Approaches

1. **Static Task Lists**
   - Initial design regenerated task list every tick
   - Problem: High CPU cost, poor task persistence
   - Solution: Task queue with lifecycle management, tasks persist across ticks

2. **Global Creep Assignment**
   - Attempted to assign tasks to any idle creep globally
   - Problem: Creeps assigned to distant tasks, high pathfinding cost
   - Solution: Room-local task assignment, cross-room only for remote operations

## Dependencies

### Prerequisites from Phase 1

- ✅ Stable spawn system
- ✅ Role management
- ✅ Memory management
- ✅ Basic task execution

### Required for Phase 3

Phase 3 (Advanced Economy) depends on Phase 2:

- **Remote Harvesting**: Requires task assignment algorithm and storage manager
- **Terminal Management**: Requires storage manager operational
- **Lab Automation**: Requires resource distribution system
- **Road Automation**: Requires path analysis data

## Testing

### Test Coverage

- **Unit Tests**: 13+ tests for task system, 17 tests for spawn system
- **Regression Tests**: Task assignment scenarios, spawn queue scenarios, CPU starvation prevention
- **E2E Tests**: Limited coverage for Phase 2 features

### Test Gaps

- ⚠️ No tests for storage manager (not yet implemented)
- ⚠️ No tests for path caching (not yet implemented)
- ⚠️ Limited integration tests for link network
- ⚠️ No performance tests for task assignment algorithm

## Metrics & Monitoring

### Key Performance Indicators

| KPI | Target | Measurement Method |
|-----|--------|-------------------|
| Tasks completed/tick | >10 | TaskManager metrics |
| Task queue depth | <20 | TaskManager.getTasks().length |
| Spawn queue depth | <5 | SpawnManager.getQueue().length |
| Creep idle time | <10% | Track ticks since last task assignment |
| CPU per task | <0.1 | Profile task generation and assignment |

### Current Monitoring

- Task system has built-in starvation tracking (`getStarvationStats()`)
- Spawn system logs queue depth in console
- Link transfers visible in game UI
- Tower actions visible in game UI

## Next Steps

1. **Implement Storage Manager** - Critical for Phase 2 completion
2. **Improve Task Assignment** - Capability matching and load balancing
3. **Add Path Caching** - Reduce CPU cost of pathfinding
4. **Create RoomManager** - Unify room operation interface
5. **Phase 2 Validation** - Measure KPIs, validate success criteria
6. **Begin Phase 3 Planning** - Remote harvesting and advanced economy design

## Related Documentation

- [Strategic Roadmap](../roadmap.md) - Overall phase progression
- [Phase 1: Foundation](phase-1-foundation.md) - Previous phase
- [Phase 3: Advanced Economy](phase-3-advanced-economy.md) - Next phase
- [Learning: Round-Robin Scheduling](../learning/round-robin-scheduling.md) - CPU fairness pattern
- [TASKS.md](../../../TASKS.md) - Detailed task breakdown for Phase 2
