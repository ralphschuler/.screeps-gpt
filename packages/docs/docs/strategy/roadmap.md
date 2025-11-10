# Screeps GPT Bot Development Roadmap

This document provides a comprehensive technical roadmap for evolving the Screeps GPT bot from its current basic functionality to a mature, multi-shard autonomous system. The roadmap is organized into five major phases, each building upon the previous one while maintaining alignment with Screeps community best practices.

## Vision and Goals

**Mission**: Develop an autonomous Screeps bot that demonstrates advanced AI-driven gameplay while serving as a platform for exploring collaborative multi-agent development patterns.

**Core Objectives**:

- **Autonomous Operation**: Minimize manual intervention through intelligent decision-making
- **Scalability**: Support multi-room and eventually multi-shard expansion
- **Modularity**: Maintain clean separation between framework and implementation
- **Quality**: Ensure comprehensive testing, monitoring, and evaluation at every stage
- **Community Alignment**: Follow established Screeps best practices and maturity benchmarks

## Current State Assessment

**What We Have** (as of v0.7.x):

- ✅ Basic kernel orchestration and tick processing (`src/runtime/bootstrap/`)
- ✅ Role-based creep behavior system (harvester, upgrader, builder, remote miner)
- ✅ Memory consistency helpers and CPU tracking
- ✅ Automatic respawn detection and handling
- ✅ Health evaluation and system reporting
- ✅ Comprehensive CI/CD with automated deployment
- ✅ PTR monitoring and performance tracking
- ✅ Multi-agent automation infrastructure

**What We Need**:

- Task-based work distribution system
- Advanced economy management (containers, links, storage optimization)
- Multi-room coordination and remote mining
- Defensive capabilities and threat response
- Market integration and resource trading
- Territory expansion and room claiming strategies
- Combat operations and military tactics

## Development Phases

The roadmap is divided into five phases, each with specific goals, deliverables, and success metrics aligned with the [Screeps Maturity Matrix](https://wiki.screepspl.us/Maturity_Matrix/).

### Phase 1: RCL 1-2 Foundation (Current → RCL 2 Stable)

**Duration**: 2-3 weeks  
**Priority**: HIGH  
**Maturity Target**: Early Game Tier

**Goals**:

- Stabilize basic economy at RCL 1-2
- Optimize spawn queue management
- Establish reliable harvesting patterns
- Implement basic construction automation

**Key Deliverables**:

1. Enhanced spawn priority system with energy threshold checks
2. Container-based harvesting for improved efficiency
3. Road network automation (source → spawn, source → controller)
4. Dynamic role population based on room state
5. CPU optimization for early-game operations (<5 CPU/tick target)

**Success Metrics**:

- Consistent energy surplus of 10+ energy/tick at RCL 2
- Controller downgrade timer never below 10,000 ticks
- Spawn utilization >70% of available time
- CPU usage <5 per tick with 3-5 creeps
- Zero respawns due to economic failure

**Architecture Impact**:

- Enhance `src/runtime/behavior/BehaviorController.ts` with dynamic population scaling
- Add container placement logic to `src/runtime/behavior/`
- Extend `src/runtime/evaluation/SystemEvaluator.ts` with economy health checks

**Reference**: See [Phase 1 Implementation Guide](./phases/01-foundation.md)

---

### Phase 2: Core Task Framework (RCL 3-4)

**Duration**: 3-4 weeks  
**Priority**: HIGH  
**Maturity Target**: Mid-Game Tier

**Goals**:

- Transition from role-based to task-based architecture
- Implement centralized task assignment and prioritization
- Add storage and link management
- Establish multi-source coordination

**Key Deliverables**:

1. Task queue system with priority levels
2. Task assignment algorithm (closest idle creep, workload balancing)
3. Storage manager for resource distribution
4. Link network for energy highways
5. Tower automation for defense and repair
6. Remote harvesting coordination for adjacent rooms

**Success Metrics**:

- Task assignment latency <5 ticks on average
- Storage maintains 20k+ energy reserves
- Link efficiency >80% (energy transferred vs capacity)
- Remote rooms contribute 30%+ of total income
- Tower defense responds within 3 ticks of threat detection

**Architecture Impact**:

- Create `src/runtime/tasks/` module:
  - `TaskQueue.ts` - Priority queue implementation
  - `TaskAssigner.ts` - Assignment algorithm
  - `TaskTypes.ts` - Task definitions and interfaces
- Create `src/runtime/managers/`:
  - `StorageManager.ts` - Resource distribution
  - `LinkManager.ts` - Link network optimization
  - `TowerManager.ts` - Automated defense and repair
- Refactor `BehaviorController.ts` to delegate to task system

**Reference**: See [Phase 2 Implementation Guide](./phases/02-core-framework.md)

---

### Phase 3: Economy Expansion (RCL 5-6)

**Duration**: 4-5 weeks  
**Priority**: MEDIUM  
**Maturity Target**: Late-Game Tier

**Goals**:

- Optimize energy logistics with terminal integration
- Implement advanced mineral harvesting and processing
- Establish market trading strategies
- Enhance CPU efficiency for larger operations

**Key Deliverables**:

1. Terminal manager for inter-room resource transfer
2. Lab automation for mineral compounds
3. Market interface for buying/selling resources
4. Factory automation (if RCL 7+)
5. Mineral harvester and hauler roles
6. CPU profiling and optimization tools

**Success Metrics**:

- Mineral production sustains lab operations continuously
- Market trades generate positive credit balance
- Terminal maintains balanced resource stockpiles
- CPU efficiency <15 per tick with 15-20 creeps
- Energy income >40 per tick per room

**Architecture Impact**:

- Extend `src/runtime/managers/`:
  - `TerminalManager.ts` - Resource logistics
  - `LabManager.ts` - Reaction automation
  - `MarketManager.ts` - Trading strategies
  - `FactoryManager.ts` - Production automation
- Add `src/runtime/economy/` module for market intelligence
- Enhance `src/runtime/metrics/PerformanceTracker.ts` with detailed CPU profiling

**Reference**: See [Phase 3 Implementation Guide](./phases/03-economy-expansion.md)

---

### Phase 4: Multi-Room Management (2-4 Rooms)

**Duration**: 5-6 weeks  
**Priority**: MEDIUM  
**Maturity Target**: Empire Tier

**Goals**:

- Coordinate multiple rooms efficiently
- Implement room claiming and colonization
- Establish inter-room logistics and support
- Balance CPU across expanding empire

**Key Deliverables**:

1. Room manager coordination layer
2. Automated room claiming with scout creeps
3. Remote spawn assistance during colonization
4. Inter-room hauling and resource sharing
5. Empire-wide threat detection and response
6. CPU allocation per room with load balancing

**Success Metrics**:

- Successfully claim and stabilize 2-4 rooms
- Inter-room energy transfer efficiency >70%
- New rooms reach RCL 3 within 50k ticks
- CPU usage scales linearly (<10 per room)
- No room failures due to resource starvation

**Architecture Impact**:

- Create `src/runtime/empire/`:
  - `EmpireManager.ts` - Multi-room coordination
  - `ColonyManager.ts` - Room claiming and bootstrapping
  - `ScoutManager.ts` - Room reconnaissance
- Extend `src/runtime/managers/StorageManager.ts` for inter-room transfers
- Add empire-level evaluation to `SystemEvaluator.ts`

**Reference**: See [Phase 4 Implementation Guide](./phases/04-multi-room.md)

---

### Phase 5: Advanced Combat & Multi-Shard (4+ Rooms, Multi-Shard)

**Duration**: 6-8 weeks  
**Priority**: LOW (Future)  
**Maturity Target**: Advanced Tier

**Goals**:

- Implement offensive and defensive military operations
- Coordinate multi-shard presence
- Establish automated diplomatic protocols
- Achieve CPU efficiency at scale

**Key Deliverables**:

1. Military creep roles (attacker, defender, healer, ranger)
2. Squad coordination and formation movement
3. Siege and room conquest strategies
4. Inter-shard portal logistics
5. Automated safe mode and rampart management
6. Threat assessment and response automation

**Success Metrics**:

- Successfully defend against player attacks
- Conduct offensive operations to claim contested rooms
- Maintain presence on 2+ shards simultaneously
- CPU efficiency <12 per room across shards
- GCL progression >1 level per week

**Architecture Impact**:

- Create `src/runtime/military/`:
  - `SquadManager.ts` - Formation and tactics
  - `DefenseManager.ts` - Automated defense coordination
  - `SiegeManager.ts` - Offensive operations
  - `ThreatAssessment.ts` - Enemy analysis
- Create `src/runtime/shard/`:
  - `ShardCoordinator.ts` - Multi-shard management
  - `PortalManager.ts` - Inter-shard logistics
- Extend evaluation system for combat effectiveness

**Reference**: See [Phase 5 Implementation Guide](./phases/05-advanced-combat.md)

---

## Architecture Alignment

The roadmap phases map to the existing codebase structure as follows:

### Current Structure (`src/runtime/`)

```
src/runtime/
├── bootstrap/         # Kernel orchestration (Phase 1 enhancements)
├── behavior/          # Current role system (Phase 1-2 transition)
├── memory/            # Memory helpers (all phases)
├── metrics/           # Performance tracking (all phases)
├── respawn/           # Respawn detection (Phase 1-2)
├── evaluation/        # Health reporting (all phases)
└── types/             # Shared contracts (all phases)
```

### Planned Additions

```
src/runtime/
├── tasks/             # Phase 2: Task framework
│   ├── TaskQueue.ts
│   ├── TaskAssigner.ts
│   └── TaskTypes.ts
├── managers/          # Phase 2-3: Resource management
│   ├── StorageManager.ts
│   ├── LinkManager.ts
│   ├── TowerManager.ts
│   ├── TerminalManager.ts
│   ├── LabManager.ts
│   ├── MarketManager.ts
│   └── FactoryManager.ts
├── economy/           # Phase 3: Market intelligence
│   └── MarketAnalyzer.ts
├── empire/            # Phase 4: Multi-room coordination
│   ├── EmpireManager.ts
│   ├── ColonyManager.ts
│   └── ScoutManager.ts
├── military/          # Phase 5: Combat operations
│   ├── SquadManager.ts
│   ├── DefenseManager.ts
│   ├── SiegeManager.ts
│   └── ThreatAssessment.ts
└── shard/             # Phase 5: Multi-shard management
    ├── ShardCoordinator.ts
    └── PortalManager.ts
```

For detailed architecture alignment, see [Architecture Mapping Document](./architecture.md).

---

## Integration with Evaluation System

Each phase includes measurable success criteria that can be tracked by the existing evaluation pipeline:

### Phase 1 Metrics (SystemEvaluator Extensions)

```typescript
interface Phase1Metrics {
  energySurplus: number; // target: 10+ per tick
  controllerDowngradeBuffer: number; // target: >10000 ticks
  spawnUtilization: number; // target: >70%
  cpuPerCreep: number; // target: <1.5
  economicFailures: number; // target: 0
}
```

### Phase 2 Metrics

```typescript
interface Phase2Metrics {
  taskAssignmentLatency: number; // target: <5 ticks
  storageReserves: number; // target: >20000 energy
  linkEfficiency: number; // target: >80%
  remoteIncomeRatio: number; // target: >30%
  towerResponseTime: number; // target: <3 ticks
}
```

### PTR Monitoring Integration

The existing `screeps-monitoring.yml` workflow can be extended to track roadmap progression:

- Daily reports include phase-specific metrics
- Automated issue creation when metrics fall below targets
- Trend analysis to identify regressions
- Benchmark comparisons against community standards

See [Evaluation Integration Guide](./architecture.md#evaluation-integration) for implementation details.

---

## Implementation Guidelines

### Development Workflow

1. **Epic Creation**: Each phase should have a GitHub Epic issue tracking overall progress
2. **Task Breakdown**: Break each deliverable into smaller implementable tasks
3. **Test-Driven**: Write tests before implementing new features
4. **Incremental Deployment**: Deploy and validate each component on PTR before proceeding
5. **Documentation**: Update strategy docs as implementation evolves

### Quality Gates

Before advancing to the next phase:

- ✅ All phase success metrics achieved on PTR
- ✅ CPU usage within target limits
- ✅ Test coverage >85% for new code
- ✅ No critical evaluation findings
- ✅ Documentation updated to reflect changes

### Automation Support

The existing Copilot agent infrastructure can assist with:

- **Issue Triage**: Automatically classify roadmap-related issues
- **Todo Automation**: Implement specific tasks from phase guides
- **Code Review**: Validate implementations against strategy guidelines
- **Monitoring**: Track progression metrics and create alerts

---

## Community Alignment

This roadmap aligns with Screeps community best practices:

### Screeps Maturity Matrix Mapping

| Phase   | Maturity Tier | Key Capabilities                        |
| ------- | ------------- | --------------------------------------- |
| Phase 1 | Early Game    | Basic economy, spawn queue management   |
| Phase 2 | Mid-Game      | Task system, remote mining, towers      |
| Phase 3 | Late-Game     | Terminal, labs, market, mineral economy |
| Phase 4 | Empire        | Multi-room, colonization, logistics     |
| Phase 5 | Advanced      | Combat, multi-shard, diplomatic         |

### Great Filters

The roadmap addresses common failure points ("Great Filters"):

1. **Early Economy Collapse** (Phase 1): Container harvesting, spawn optimization
2. **RCL 3-4 Stagnation** (Phase 2): Task framework, storage management
3. **CPU Ceiling** (Phase 3): Profiling, optimization, efficiency focus
4. **Expansion Challenges** (Phase 4): Colonization automation, logistics
5. **Combat Readiness** (Phase 5): Military systems, threat response

### Reference Resources

- [Screeps Wiki: Getting Started](https://wiki.screepspl.us/Getting_Started/)
- [Screeps Wiki: Great Filters](https://wiki.screepspl.us/Great_Filters/)
- [Screeps Wiki: Maturity Matrix](https://wiki.screepspl.us/Maturity_Matrix/)

---

## Roadmap Maintenance

This roadmap is a living document and should be updated as:

- Implementation reveals new requirements or challenges
- Community best practices evolve
- Game mechanics change with Screeps updates
- Monitoring data suggests alternative approaches

**Update Schedule**: Review and revise quarterly or after completing each phase.

**Feedback**: Create GitHub issues with label `strategy` for roadmap suggestions.

---

## Next Steps

To begin implementation:

1. **Review Phase 1 Guide**: See [01-foundation.md](./phases/01-foundation.md) for detailed tasks
2. **Create Epic Issue**: Use template in `.github/ISSUE_TEMPLATE/epic.md` (if available)
3. **Set Up Tracking**: Configure PTR monitoring for Phase 1 metrics
4. **Start Implementation**: Begin with highest-priority Phase 1 deliverables

For architectural context, see [Architecture Alignment](./architecture.md).

For evaluation integration details, see [Architecture Alignment - Evaluation Integration](./architecture.md#evaluation-integration).
