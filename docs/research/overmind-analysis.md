# Overmind Architecture Analysis

**Research Date:** November 2025  
**Purpose:** Identify applicable patterns from Overmind for integration into .screeps-gpt  
**Repository:** https://github.com/bencbartlett/Overmind  
**Documentation:** https://bencbartlett.com/projects/overmind/

## Executive Summary

Overmind is a sophisticated, high-performance Screeps bot developed by Ben Bartlett, inspired by Starcraft's Zerg swarm intelligence. This analysis identifies key architectural patterns and implementation strategies that could enhance .screeps-gpt's runtime performance, multi-room scaling, and competitive capabilities.

### Key Findings

- **Hierarchical Management:** Overmind's Colony → Overlord → Task architecture provides excellent scalability
- **Task System:** Persistent, transferable task objects with validity checking reduce CPU overhead
- **Memory Optimization:** Clear separation between persistent (Memory) and ephemeral (heap) state
- **Multi-room Coordination:** Automated expansion, resource sharing, and cooperative defense
- **CPU Efficiency:** Advanced caching strategies, path reuse, and bucket-aware scheduling

## Core Architecture Patterns

### 1. Hierarchical Management Structure

**Pattern Description:**  
Overmind implements a four-tier hierarchy for colony management:

1. **Overmind (Central Brain)** - Top-level orchestrator coordinating all colonies
2. **Colonies** - Per-room autonomous managers aligned to global directives
3. **Overlords** - Specialized managers for specific tasks (mining, defense, building)
4. **HiveClusters** - Groups of related structures (energy sources, labs, bunkers)

**Current .screeps-gpt Architecture:**

- Kernel orchestration in `src/runtime/bootstrap/`
- Manager classes in `src/runtime/` (TaskManager, SpawnManager, etc.)
- Behavior controllers in `src/runtime/behavior/`

**Integration Potential:** ⭐⭐⭐⭐ (High)

**Compatibility Assessment:**

- **Compatible:** .screeps-gpt already has manager-based architecture
- **Enhancement:** Add HiveCluster abstraction for structure grouping
- **Consideration:** RoomManager abstraction mentioned in TASKS.md aligns with Colony concept

**Recommendations:**

- Introduce `Colony` class to wrap room-level management
- Create `HiveCluster` for structure group coordination (e.g., SourceCluster, StorageCluster)
- Maintain existing managers but have them report to Colony coordinator
- Implement in Phase 2-3 of roadmap (medium complexity)

### 2. Directive System (Event-Driven Tasks)

**Pattern Description:**  
Directives are temporary, event-driven tasks placed in response to game stimuli:

- Flag-based signaling for colonization, defense, expansion
- Dynamic response to threats, opportunities, resource needs
- Directive spawns appropriate Overlord to handle the situation
- Acts as intelligent "process table" for colony adaptation

**Current .screeps-gpt Architecture:**

- Task interface in `src/shared/contracts.ts`
- TaskManager with priority-based generation and assignment
- 17 regression tests for task scenarios

**Integration Potential:** ⭐⭐⭐⭐⭐ (Very High)

**Compatibility Assessment:**

- **Aligned:** Existing task system provides foundation
- **Gap:** No event-driven directive spawning mechanism
- **Opportunity:** Enhance task system with directive pattern

**Recommendations:**

- Extend task system to include Directive concept
- Implement Directive types: Colonize, Defend, Attack, Expand, Emergency
- Create DirectiveManager to monitor game state and spawn directives
- Link directives to issue #478 (task management system evaluation)
- Implement in Phase 2 (low-medium complexity)

### 3. Task Assignment & Persistence

**Pattern Description:**  
Overmind's task system features:

- Tasks are transferable, persistent objects assigned to creeps
- Decouples task assignment from execution
- Validity checking (isValidTask, isValidTarget) each tick
- Parent task chaining for complex multi-step operations
- Tasks persist between ticks, reducing recalculation overhead

**Current .screeps-gpt Architecture:**

- TaskManager with priority-based assignment
- Task interface with type, target, priority fields
- Closest idle creep assignment algorithm

**Integration Potential:** ⭐⭐⭐⭐ (High)

**Compatibility Assessment:**

- **Compatible:** Task interface already exists
- **Enhancement:** Add task persistence and validity checking
- **Performance Gain:** Reduce per-tick recalculation by persisting tasks

**Recommendations:**

- Add task validity methods to Task interface
- Implement task persistence in creep memory
- Add parent task chaining for multi-step operations
- Create task reuse pool to reduce object creation
- Implement in Phase 2 (low complexity, high value)

## Performance Optimization Patterns

### 4. CPU Management & Caching

**Pattern Description:**  
Overmind employs multi-layered caching strategies:

**Memory vs Heap Pattern:**

- **Persistent State (Memory):** Colony info, creep roles, critical data
  - JSON-serializable only
  - Survives global resets
  - CPU cost for serialization/deserialization
- **Ephemeral State (Heap/Global):** Computed values, object caches
  - Class instances, functions, Game object references
  - Fast access, no serialization cost
  - Lost on global reset, must be reconstructable

**Caching Strategies:**

- Path caching with TTL management
- Cost matrix reuse for pathfinding
- Pre-filtered game object lists
- Bucket-aware scheduling for expensive operations

**Current .screeps-gpt Architecture:**

- Memory management in `src/runtime/memory/`
- CPU tracking in `src/runtime/metrics/`
- Profiler integration across managers
- Memory consistency helpers

**Integration Potential:** ⭐⭐⭐⭐⭐ (Very High)

**Compatibility Assessment:**

- **Foundation Present:** Memory and metrics infrastructure exists
- **Enhancement Needed:** Decorator-based caching pattern
- **Quick Win:** Implement heap caching for frequently accessed data

**Recommendations:**

- **HIGH PRIORITY** - Implement decorator-based caching (relates to #494)
  - Create `@cache(heap)` and `@cache(memory)` decorators
  - Separate persistent vs ephemeral state clearly
  - Add automated cache invalidation logic
- Implement path caching with TTL for pathfinding
- Create cost matrix cache manager
- Add bucket-aware operation scheduling
- Relates to issues: #392, #426, #494, #495, #487
- Implement in Phase 2 (medium complexity, very high value)

### 5. Pathfinding Optimization

**Pattern Description:**

- Cache paths found with PathFinder.search in Memory
- Pre-calculate and reuse cost matrices
- Only recompute paths when environment materially changes
- Minimize Room.find and filter operations in loops
- Move expensive calculations outside per-creep loops

**Current .screeps-gpt Architecture:**

- No explicit path caching system
- Standard Screeps pathfinding used in behaviors

**Integration Potential:** ⭐⭐⭐⭐ (High)

**Recommendations:**

- Create PathCache manager for path storage and reuse
- Implement cost matrix caching for frequently traversed rooms
- Add path invalidation on room structure changes
- Implement in Phase 2-3 (medium complexity, high value)

### 6. CPU Bucket-Aware Scheduling

**Pattern Description:**

- Monitor CPU bucket levels
- Defer expensive operations when bucket is low
- Run heavy calculations (overlays, planning) when bucket is full
- Spread expensive operations over multiple ticks

**Current .screeps-gpt Architecture:**

- CPU tracking via metrics system
- Profiler integration for performance monitoring

**Integration Potential:** ⭐⭐⭐⭐ (High)

**Recommendations:**

- **HIGH PRIORITY** - Implement bucket-aware scheduler (relates to #392, #494)
- Create OperationScheduler with priority queue
- Add bucket threshold checks (e.g., defer if < 5000)
- Implement tick-spreading for expensive operations
- Create CPU usage dashboard using RoomVisuals
- Relates to issues: #392, #426, #494
- Implement in Phase 2 (medium complexity, high value)

## Multi-Room Scaling Patterns

### 7. Colony Management & Expansion

**Pattern Description:**

- Each owned room becomes a Colony with autonomous management
- Overseer coordinates multiple colonies
- Automated expansion queue with priority-based claiming
- Resource sharing and coordination between colonies
- Room classification by type (Core, Controller, SourceKeeper) and stage

**Current .screeps-gpt Architecture:**

- ColonyManager implemented (Phase 5 complete)
- Multi-room tracking and coordination
- Expansion queue with priority-based claiming
- Inter-shard messaging for resource coordination

**Integration Potential:** ⭐⭐⭐ (Medium)

**Compatibility Assessment:**

- **Already Implemented:** ColonyManager exists with similar features
- **Enhancement:** Room classification and stage management
- **Opportunity:** Refine expansion criteria and coordination

**Recommendations:**

- Add room classification system (Core/Controller/SourceKeeper/Remote)
- Implement developmental stage tracking (Early/Infrastructure/Expansion)
- Enhance expansion site selection with scoring algorithm
- Already addressed in Phase 5 completion
- Minor enhancements only (low complexity, medium value)

### 8. Remote Mining Architecture

**Pattern Description:**

- Office/Territory hierarchical organization
- Dedicated miner/hauler roles with optimized body parts
- Automated site selection based on resource/terrain scoring
- Defense protocols for vulnerable remote rooms
- Container and road infrastructure planning
- Scout-based visibility acquisition

**Current .screeps-gpt Architecture:**

- ScoutManager for remote room mapping (Phase 3 complete)
- RoadPlanner for automated road placement (Phase 3 complete)
- Remote harvesting mentioned in TASKS.md
- Dedicated miner role exists in behavior controllers

**Integration Potential:** ⭐⭐⭐⭐ (High)

**Compatibility Assessment:**

- **Foundation Present:** Scout and road systems exist
- **Gap:** No dedicated remote mining orchestration
- **Opportunity:** Create specialized remote mining manager

**Recommendations:**

- Create RemoteMiningManager for orchestration
- Implement remote site scoring (distance, resources, terrain, threats)
- Add dedicated RemoteMiner and RemoteHauler roles
- Automated container placement at remote sources
- Defense coordination for remote operations
- Implement in Phase 3-4 (medium complexity, high value)

### 9. Logistics & Resource Coordination

**Pattern Description:**

- Automated pathfinding and hauling between rooms
- Terminal and trade management for mineral trading
- Central storage hub pattern for extension/spawn refilling
- Resource request and priority system
- Separate short-range and long-range hauling

**Current .screeps-gpt Architecture:**

- TerminalManager for inter-room logistics (Phase 3 complete)
- Energy balancing with configurable reserves
- Priority-based resource transfer queue

**Integration Potential:** ⭐⭐⭐ (Medium)

**Compatibility Assessment:**

- **Already Implemented:** Terminal management exists
- **Enhancement Opportunity:** Separate hauler types and storage hub pattern

**Recommendations:**

- **MEDIUM PRIORITY** - Separate short-range and long-range hauling (relates to #493)
- Implement central storage hub for spawn/extension refilling
- Add spawn uptime monitoring and alerting
- Optimize energy delivery timing to prevent starvation
- Relates to issues: #493, #607, #614
- Implement in Phase 3-4 (medium complexity, medium value)

## Combat & Defense Patterns

### 10. DEFCON System

**Pattern Description:**

- Threat level evaluation system (DEFCON 1-5)
- Progressive defensive measures based on threat escalation
- Automated spawning of appropriate defenders
- Boosted warriors and evacuation protocols at high threat levels
- Distributed reinforcement across colonies

**Current .screeps-gpt Architecture:**

- CombatManager for squad-based operations (Phase 4 complete)
- Threat assessment and engagement logic
- TowerManager for defense and repair (Phase 2 complete)

**Integration Potential:** ⭐⭐⭐ (Medium)

**Compatibility Assessment:**

- **Foundation Present:** Combat and tower systems exist
- **Enhancement:** Add formal DEFCON threat level system
- **Opportunity:** Progressive response automation

**Recommendations:**

- Implement DEFCON threat level classification
- Create progressive response plans for each level
- Add automated boosting for high-threat scenarios
- Implement evacuation protocols for DEFCON 1
- Implement in Phase 4-5 (medium complexity, medium value)

### 11. Distributed Defense & Reinforcement

**Pattern Description:**

- Colonies can reinforce each other
- Collective defense net across owned rooms
- Automated defense creep routing to threatened rooms
- Resource pooling for defense operations

**Current .screeps-gpt Architecture:**

- CombatManager with squad formation
- ColonyManager for multi-room coordination
- No explicit cross-colony defense coordination

**Integration Potential:** ⭐⭐⭐⭐ (High)

**Recommendations:**

- Extend ColonyManager to coordinate cross-colony defense
- Implement defense request/response system
- Add automated defender routing to threatened colonies
- Create defense resource pooling mechanism
- Implement in Phase 4-5 (medium complexity, high value)

## Market & Trade Patterns

### 12. Market Automation

**Pattern Description:**

- Automated buy/sell orders for minerals, energy, power
- Market rate tracking and price optimization
- Terminal cooldown and energy usage optimization
- Deal execution with safety checks
- Resource sharing via Assimilator module

**Current .screeps-gpt Architecture:**

- TerminalManager with resource transfer logic
- No explicit market trading implementation

**Integration Potential:** ⭐⭐⭐ (Medium)

**Recommendations:**

- Create MarketManager for trade automation
- Implement price tracking and analysis
- Add automated buy/sell order placement
- Implement safety checks for deals
- Implement in Phase 5 or later (medium complexity, medium value)

## Implementation Roadmap

### Quick Wins (High Value, Low-Medium Complexity)

#### 1. Task Persistence & Validity (Phase 2)

**Priority:** HIGH  
**Complexity:** Low  
**Related Issues:** #478  
**Impact:** Reduces CPU overhead by persisting tasks between ticks

**Implementation Steps:**

- Add `isValid()` and `isValidTarget()` methods to Task interface
- Store assigned tasks in creep memory
- Implement task reuse pool
- Add parent task chaining for multi-step operations

**Estimated Effort:** 1-2 days

#### 2. Decorator-Based Caching Pattern (Phase 2)

**Priority:** HIGH  
**Complexity:** Medium  
**Related Issues:** #487, #494  
**Impact:** Major CPU savings through intelligent caching

**Implementation Steps:**

- Create `@cache(heap)` and `@cache(memory)` decorators
- Implement cache invalidation logic
- Separate persistent vs ephemeral state clearly
- Add cache TTL management

**Estimated Effort:** 2-3 days

#### 3. Directive System (Phase 2)

**Priority:** HIGH  
**Complexity:** Medium  
**Related Issues:** #478  
**Impact:** Event-driven task spawning, improved adaptability

**Implementation Steps:**

- Create Directive base class
- Implement directive types (Colonize, Defend, Attack, Expand)
- Create DirectiveManager for game state monitoring
- Integrate with existing task system

**Estimated Effort:** 3-4 days

### Medium-Term Improvements (High Value, Medium Complexity)

#### 4. CPU Bucket-Aware Scheduling (Phase 2-3)

**Priority:** HIGH  
**Complexity:** Medium  
**Related Issues:** #392, #426, #494, #495  
**Impact:** Prevents CPU limit issues, enables expensive operations

**Implementation Steps:**

- Create OperationScheduler with priority queue
- Add bucket threshold monitoring
- Implement operation deferral when bucket is low
- Add tick-spreading for heavy calculations
- Create CPU usage dashboard with RoomVisuals

**Estimated Effort:** 3-5 days

#### 5. Path Caching System (Phase 2-3)

**Priority:** HIGH  
**Complexity:** Medium  
**Related Issues:** #392, #494  
**Impact:** Significant CPU savings on pathfinding

**Implementation Steps:**

- Create PathCache manager
- Implement path storage with TTL
- Add cost matrix caching
- Implement invalidation on structure changes
- Integrate with existing movement code

**Estimated Effort:** 3-4 days

#### 6. Remote Mining Manager (Phase 3-4)

**Priority:** MEDIUM  
**Complexity:** Medium  
**Related Issues:** None specific (new feature)  
**Impact:** Expanded resource income, better empire scaling

**Implementation Steps:**

- Create RemoteMiningManager
- Implement site scoring algorithm
- Add RemoteMiner and RemoteHauler roles
- Automated container placement at sources
- Defense coordination integration

**Estimated Effort:** 4-6 days

### Long-Term Enhancements (Medium Value, Medium-High Complexity)

#### 7. HiveCluster Abstraction (Phase 3-4)

**Priority:** MEDIUM  
**Complexity:** Medium-High  
**Related Issues:** None specific (architectural)  
**Impact:** Better structure coordination, cleaner architecture

**Implementation Steps:**

- Create HiveCluster base class
- Implement SourceCluster, StorageCluster, LabCluster
- Refactor existing managers to use clusters
- Add cluster-level optimization logic

**Estimated Effort:** 5-7 days

#### 8. DEFCON Threat System (Phase 4-5)

**Priority:** MEDIUM  
**Complexity:** Medium  
**Related Issues:** None specific (new feature)  
**Impact:** Progressive defense response, better threat handling

**Implementation Steps:**

- Implement DEFCON level classification
- Create progressive response plans
- Add automated boosting logic
- Implement evacuation protocols
- Integrate with existing CombatManager

**Estimated Effort:** 4-6 days

#### 9. Hauling Optimization (Phase 3-4)

**Priority:** MEDIUM  
**Complexity:** Medium  
**Related Issues:** #493, #607, #614  
**Impact:** Better energy logistics, prevents spawn starvation

**Implementation Steps:**

- Separate short-range and long-range hauling roles
- Implement central storage hub pattern
- Add spawn uptime monitoring
- Optimize energy delivery timing
- Create hauler role specialization

**Estimated Effort:** 4-5 days

#### 10. Market Automation (Phase 5+)

**Priority:** LOW  
**Complexity:** Medium  
**Related Issues:** None specific (new feature)  
**Impact:** Automated resource trading, economic optimization

**Implementation Steps:**

- Create MarketManager
- Implement price tracking
- Add automated order placement
- Implement deal safety checks
- Integrate with TerminalManager

**Estimated Effort:** 4-6 days

## Compatibility with Current Architecture

### ✅ Highly Compatible Patterns

1. **Task System Enhancement** - Builds directly on existing Task interface
2. **Caching Decorators** - Extends existing memory management infrastructure
3. **Directive System** - Natural extension of current task system
4. **Path Caching** - Integrates with existing pathfinding usage
5. **CPU Scheduling** - Leverages existing metrics and profiler

### ⚠️ Requires Refactoring

1. **HiveCluster Abstraction** - Significant structural change to group related structures
2. **Colony Hierarchy** - Would require restructuring manager relationships
3. **Hauling Specialization** - Needs role system refactoring

### ❌ Not Applicable / Low Priority

1. **Assimilator (Multi-User Coordination)** - Not applicable for single-user bot
2. **Advanced Market Trading** - Lower priority for current development stage
3. **Full Directive Flag System** - UI-dependent, may not align with automation goals

## Integration Risks & Considerations

### Complexity Management

- **Risk:** Overmind is feature-rich but complex; avoid over-engineering
- **Mitigation:** Implement patterns incrementally, focus on high-value items
- **Reference:** TASKS.md mentions "Great Purge" philosophy - simplify over-engineered abstractions

### Testing Requirements

- **Need:** Comprehensive tests for each new pattern
- **Approach:** Follow existing test structure (unit, regression, e2e)
- **Coverage:** Maintain test coverage above 70% for new code

### Documentation Maintenance

- **Need:** Update architecture documentation for each integration
- **Files:** README.md, DOCS.md, AGENTS.md, docs/automation/overview.md
- **Frequency:** After each major pattern implementation

### Performance Validation

- **Method:** Use PTR monitoring and regression testing
- **Metrics:** CPU usage, bucket stability, room performance
- **Baseline:** Establish performance baselines before/after changes
- **Tool:** `bun run analyze:system` for system evaluation

## Related Issues & Dependencies

### High Priority Integration Points

1. **Issue #478** - Task management system evaluation
   - **Patterns:** Task Persistence, Directive System
   - **Priority:** HIGH
   - **Dependency:** Foundation for task system improvements

2. **Issue #607** - Energy container depletion issues
   - **Patterns:** Hauling Optimization, Storage Hub
   - **Priority:** HIGH
   - **Dependency:** Logistics improvements

3. **Issue #614** - Upgrader energy priority management
   - **Patterns:** Task Priority, Resource Coordination
   - **Priority:** HIGH
   - **Dependency:** Task system refinement

4. **Issues #392, #426, #494, #495** - CPU optimization
   - **Patterns:** Caching, Bucket-Aware Scheduling, Path Caching
   - **Priority:** HIGH
   - **Dependency:** Performance infrastructure

5. **Issue #487** - Memory optimization
   - **Patterns:** Decorator-Based Caching, Memory/Heap Separation
   - **Priority:** HIGH
   - **Dependency:** Memory management refactoring

### Medium Priority Integration Points

1. **Issue #493** - Logistics optimization
   - **Patterns:** Hauling Specialization, Storage Hub
   - **Priority:** MEDIUM
   - **Dependency:** Role system enhancements

2. **Issue #573** - Screeps bot development strategies reference
   - **Patterns:** General architectural insights
   - **Priority:** LOW
   - **Dependency:** Documentation and knowledge base

3. **Issue #579** - Private server performance benchmarking
   - **Patterns:** Performance validation methods
   - **Priority:** MEDIUM
   - **Dependency:** Testing infrastructure

## Conclusion

Overmind's architecture provides excellent patterns for improving .screeps-gpt, particularly in:

1. **Task Management** - Persistent tasks with validity checking
2. **CPU Optimization** - Decorator-based caching and bucket-aware scheduling
3. **Multi-Room Scaling** - Remote mining and resource coordination
4. **Defensive Architecture** - DEFCON system and distributed defense

The recommended implementation order prioritizes:

1. Task system improvements (quick wins)
2. CPU and memory optimization (high impact)
3. Remote mining and logistics (scaling)
4. Advanced defense and market features (later stages)

This phased approach ensures incremental value delivery while maintaining code quality and test coverage. Each pattern integration should be accompanied by comprehensive tests, performance validation, and documentation updates.

## References

- **Overmind Repository:** https://github.com/bencbartlett/Overmind
- **Overmind Documentation:** https://bencbartlett.com/overmind-docs/
- **Overmind Project Page:** https://bencbartlett.com/projects/overmind/
- **Ben Bartlett's Blog:** https://bencbartlett.com/blog/
  - Screeps #1: Overlord Overload
  - Screeps #5: Evolution
- **Overmind Wiki:** https://github.com/bencbartlett/Overmind/wiki
- **Screeps Documentation - Caching:** https://docs.screeps.com/contributed/caching-overview.html
- **ScreepsPlus Wiki - Remote Harvesting:** https://wiki.screepspl.us/Remote_Harvesting/
- **ScreepsPlus Wiki - CPU Management:** https://wiki.screepspl.us/CPU/

---

_This document was created as part of issue research to identify integration patterns from competitive Screeps bots. It serves as a reference for future implementation work and architectural decisions._
