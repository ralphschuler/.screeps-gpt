# Tasks

## Backlog

### Strategic Planning

- [ ] Create Epic issues for each roadmap phase (Phase 1-5)
- [ ] Set up PTR monitoring for Phase 1 metrics (energy surplus, controller downgrade, spawn utilization)
- [ ] Configure evaluation pipeline to track roadmap progression milestones

### Technical Debt Reduction (2025-11-17)

**Documentation**: [Technical Debt Roadmap](docs/strategy/technical-debt-roadmap.md)

**Critical Priority (Weeks 1-2)**:

- [ ] Fix quality gate workflow reliability (timing issues, guard summary aggregation)
- [ ] Add BehaviorController unit tests (#694) - 15-20 tests
- [ ] Add RespawnManager unit tests (#694) - 10-15 tests
- [ ] Complete stats collection hardening (#722, #724) - redundant validation pathways
- [ ] Document emergency procedures runbook (#696) - completed initial version

**High Priority (Weeks 3-6)**:

- [ ] Complete Phase 2 task framework implementation (#723, #653, #715)
- [ ] Implement unsafe type assertion fixes (#690) - use Zod for runtime validation
- [ ] Add kernel integration tests (#634) - full-tick mockup tests
- [ ] Create operational runbooks (#802) - completed initial version
- [ ] Establish performance baselines (#820) - metrics and thresholds
- [ ] Write ADRs for key architectural patterns - completed 3 initial ADRs
- [ ] **Migrate all role controllers to xstate state machines** - See `.github/ISSUE_TEMPLATE/xstate-migration.md`
  - Phase 1 (High): BuilderController, HaulerController, RepairerController (3/11 remaining)
  - Phase 2 (Medium): StationaryHarvesterController, RemoteMinerController, RemoteHaulerController, RemoteBuilderController (4/11 remaining)
  - Phase 3 (Low): AttackerController, HealerController, DismantlerController, ClaimerController (4/11 remaining)
  - ✅ Completed: HarvesterController, UpgraderController, ScoutController (3/14 total)

**Medium Priority (Weeks 7-12)**:

- [ ] Implement CPU bucket-aware scheduler (#793) - profiler-based with priority deferral
- [ ] Add RoomManager abstraction - multi-room preparation
- [ ] Implement path caching system - Overmind pattern with TTL
- [ ] Fix Date.now() non-determinism (#693) - use Game.time wrapper
- [ ] Complete workflow modernization - label migration, dependency optimization
- [ ] Multi-room architecture preparation - Phase 4 planning

### Phase 1: Foundation (HIGH Priority)

- [x] Complete Phase 1 bootstrapping and RCL 1-2 foundation _(2025-11-06)_
  - Project structure already established (src/runtime, src/shared, main.ts)
  - TypeScript strict mode enabled, formatting and linting configured
  - Main game loop implemented with kernel orchestration
  - Memory initialization and reset hooks implemented via MemoryManager
  - Creep and spawn management implemented with harvester, upgrader, builder roles
  - Construction planning implemented with BasePlanner for extensions and containers
  - Pixel generation implemented with PixelGenerator (triggers when bucket full)
  - Structured logging implemented with Logger (timestamps, log levels, context)
  - Unit tests added for memory bootstrapping, pixel generation, and logging
  - Regression test added for extension placement at RCL 1-2
- [ ] Implement enhanced spawn priority system with energy threshold checks
- [x] Add container-based harvesting for improved efficiency _(2025-11-17)_
  - Stationary harvester role implemented with 5 WORK parts
  - Hauler role implemented with CARRY-heavy body composition
  - Dynamic role spawning based on container detection
  - Container repair logic with 50% health threshold
  - Source containers prioritized over controller containers
- [ ] Automate road network planning (source → spawn, source → controller)
- [ ] Implement dynamic role population based on room state
- [ ] Optimize CPU usage for early game (<5 CPU/tick target)

### Phase 2: Core Framework (In Progress)

- [x] Design and implement task queue system with priority levels _(2025-11-06)_
  - Task interface defined in src/shared/contracts.ts
  - TaskManager enhanced with improved generation and assignment
  - Regression test added for task assignment scenarios
  - Documentation updated in docs/automation/overview.md
- [x] Implement spawn queue system with dynamic part generation _(2025-11-06)_
  - SpawnManager class with priority-based spawn queue
  - Dynamic body part generation based on available energy
  - Cold boot recovery logic for empty room scenarios
  - 17 regression tests covering all spawn scenarios
  - Documentation in docs/runtime/operations/spawn-management.md
- [ ] Create task assignment algorithm (closest idle creep, capability matching)
  - Includes generating energy gathering subtasks for spawn/extension filling (TaskPrerequisite.ts:140)
- [ ] Implement storage manager for resource distribution
- [x] Add link network optimization for energy highways _(2025-11-07)_
  - LinkManager with role-based classification (source, storage, controller, upgrade)
  - Automated energy transfers from source links to consumer links
  - Priority system favoring controller links
- [x] Create tower automation for defense and repair _(2025-11-06)_
  - TowerManager with threat-based targeting
  - Prioritized attack/heal/repair actions
  - Regression tests for defense prioritization
- [ ] Add centralized memory segments for persistent data
- [ ] Implement path caching with TTL management
- [ ] Create RoomManager abstraction with manager registry

### Phase 3: Advanced Economy (Completed)

- [x] Remote harvesting, improved base planning, road automation, defense _(2025-11-06)_
  - ScoutManager for remote room mapping
  - Enhanced BasePlanner with RCL 2-5 layouts
  - RoadPlanner for automated road placement
  - TowerManager for intelligent defense
- [x] Terminal management _(2025-11-07)_
  - TerminalManager for inter-room resource logistics
  - Energy balancing with configurable reserves
  - Priority-based resource transfer queue
- [x] Lab automation _(2025-11-07)_
  - LabManager with production and boosting modes
  - Compound production with input/output lab coordination
  - Creep boosting request system
  - Built-in recipes for Tier 1 compounds
- [x] Factory automation _(2025-11-07)_
  - FactoryManager for commodity production
  - Priority-based production queue
  - Auto-production of batteries when idle

### Phase 4: Empire Coordination (In Progress)

- [x] Combat and movement coordination _(2025-11-07)_
  - CombatManager for squad-based operations
  - Squad formation with offense/defense/raid roles
  - Threat assessment and engagement logic
  - TrafficManager for collision avoidance
  - Priority-based movement with position reservation
- [ ] Empire coordination and room claiming
- [ ] Multi-room logistics and resource balancing
- [ ] Automated expansion and colonization

### Phase 5: Multi-Room & Global Management (Completed)

- [x] Colony and shard scaling _(2025-11-07)_
  - ColonyManager for multi-room expansion and inter-shard communication
  - Expansion queue with priority-based room claiming
  - Multi-room tracking and coordination
  - Inter-shard messaging for resource coordination
  - Memory persistence for colony state
  - Comprehensive unit and regression tests (34 tests total)
- [x] Analytics and observability _(2025-11-07)_
  - AnalyticsReporter with HTTP POST integration
  - Batch processing and compression support
  - Queue management with failure recovery
  - Integration with existing StatsCollector
  - Comprehensive unit and regression tests (32 tests total)
- [x] Performance optimizations and error handling _(2025-11-07)_
  - Existing profiler integration across all managers
  - Error handling and logging in manager classes
  - Documentation updated in docs/automation/overview.md
  - Memory efficiency through batch processing
  - CPU optimization via profiling decorators

### Technical Improvements

- [x] Expand creep role library beyond harvester/upgrader to cover builders and remote miners _(Already implemented)_
- [x] Add remote harvesting and room scouting system _(2025-11-06)_
- [ ] Add automated simulation snapshots for regression verification of behaviour changes.
- [ ] Review Screeps Quorum automation patterns for scalable role orchestration.
- [ ] Design PTR stat baselines so the monitor can score trends automatically.

### Jon Winsley Blog Analysis Implementation (2025-11-10)

**High Priority - Performance & CPU Optimization** (Related: #392, #426, #494, #495):

- [ ] Implement CPU bucket-aware scheduling for expensive operations
- [ ] Add profiler integration across all managers with per-module tracking
- [ ] Create CPU usage dashboard using RoomVisuals
- [ ] Review and simplify over-engineered abstractions (apply "Great Purge" philosophy)
- [ ] Implement proactive CPU timeout monitoring and alerting

**High Priority - Task Management Enhancement** (Related: #478):

- [ ] Evaluate Objective-based architecture vs. current centralized task system
- [ ] Implement operational mode switching (DISABLED/MINIMAL/NORMAL/PRIORITY) for managers
- [ ] Add dynamic priority adjustment based on room state (RCL, threats, resources)
- [ ] Create simplified task assignment algorithm (closest idle creep with capability match)

**High Priority - Memory Optimization** (Related: #487, #494):

- [ ] Implement decorator-based caching pattern (separate Memory vs. heap storage)
- [ ] Clearly separate persistent state (Memory) from ephemeral state (heap)
- [ ] Review serialization patterns for efficiency (store IDs not objects)
- [ ] Add automated cache invalidation logic

**Medium Priority - Monitoring & Analytics** (Related: #496, #468):

- [ ] Implement RoomVisuals dashboards for real-time metrics
- [ ] Create damage report analysis pattern for post-mortem debugging
- [ ] Add Grafana integration for historical metrics and trend analysis
- [ ] Implement post-mortem template for operational failures

**Medium Priority - Logistics Optimization** (Related: #493):

- [ ] Separate short-range and long-range hauling responsibilities
- [ ] Implement central storage hub for extension/spawn refilling
- [ ] Add spawn uptime monitoring and alerting
- [ ] Optimize energy delivery timing to prevent spawn starvation

**Medium Priority - Remote Mining Architecture**:

- [ ] Implement Office/Territory hierarchical organization model
- [ ] Create dedicated miner/hauler roles with optimized body parts
- [ ] Add automated site selection based on resource/terrain scoring
- [ ] Implement defense protocols for vulnerable remote rooms

**Lower Priority - Strategic Planning**:

- [ ] Implement strategic phase detection (Early/Infrastructure/Expansion/Optimization)
- [ ] Add threat-responsive strategy switching
- [ ] Create resource-aware task allocation system
- [ ] Implement "questioning everything" architecture review process

### Overmind Architecture Research (2025-11-15)

**Research Documentation:** [`docs/research/overmind-analysis.md`](docs/research/overmind-analysis.md)

**Quick Wins - High Value, Low-Medium Complexity**:

- [ ] Task Persistence & Validity (Phase 2) - Related: #478
  - Add isValid() and isValidTarget() methods to Task interface
  - Store assigned tasks in creep memory
  - Implement task reuse pool and parent task chaining
- [ ] Decorator-Based Caching Pattern (Phase 2) - Related: #487, #494
  - Create @cache(heap) and @cache(memory) decorators
  - Implement cache invalidation and TTL management
  - Separate persistent vs ephemeral state clearly
- [ ] Directive System (Phase 2) - Related: #478
  - Create Directive base class and types (Colonize, Defend, Attack, Expand)
  - Create DirectiveManager for game state monitoring
  - Integrate with existing task system

**Medium-Term Improvements**:

- [ ] CPU Bucket-Aware Scheduling (Phase 2-3) - Related: #392, #426, #494, #495
  - Create OperationScheduler with priority queue
  - Add bucket threshold monitoring and operation deferral
  - Create CPU usage dashboard with RoomVisuals
- [ ] Path Caching System (Phase 2-3) - Related: #392, #494
  - Create PathCache manager with TTL
  - Implement cost matrix caching
  - Add invalidation on structure changes
- [ ] Remote Mining Manager (Phase 3-4)
  - Create RemoteMiningManager with site scoring
  - Add RemoteMiner and RemoteHauler roles
  - Automated container placement and defense coordination

**Long-Term Enhancements**:

- [ ] HiveCluster Abstraction (Phase 3-4) - Architectural refactoring
- [ ] DEFCON Threat System (Phase 4-5) - Progressive defense response
- [ ] Hauling Optimization (Phase 3-4) - Related: #493, #607, #614
- [ ] Market Automation (Phase 5+) - Automated resource trading

**Note:** See full analysis in `docs/research/overmind-analysis.md` for detailed patterns, compatibility assessment, and implementation recommendations.

### Overmind-RL Reinforcement Learning Research (2025-11-15)

**Research Documentation:** [`docs/research/overmind-rl-analysis.md`](docs/research/overmind-rl-analysis.md)

**Decision: NOT RECOMMENDED for Current Integration**

**Key Findings:**

- RL integration requires 870 hours + $10,000 (realistic estimate)
- Proven Overmind patterns require 140 hours + $0
- RL is 6x more expensive with uncertain ROI
- Architecture misalignment: Python dependency conflicts with TypeScript-only runtime
- Training complexity: GPU infrastructure, distributed training, specialized expertise
- Runtime overhead: Python inference bridge introduces 10-200ms latency

**Alternative Recommendation:** Focus on proven Overmind architectural patterns (task persistence, caching, CPU scheduling) that provide clearer ROI and align with current architecture.

**Revisit Conditions:**

- Bot reaches top-tier competitive performance (12-24 months)
- Specific high-value RL use case identified with quantified benefit
- Team acquires RL expertise or hires specialist
- Infrastructure budget supports $10k+ annual RL costs

**Note:** See full analysis in `docs/research/overmind-rl-analysis.md` for comprehensive architecture evaluation, cost breakdown, use case analysis, and integration roadmap.

### The International Architecture Research (2025-11-24)

**Research Documentation:** [`docs/research/the-international-analysis.md`](docs/research/the-international-analysis.md)

**Key Findings:**

- Modular, accessible architecture with clear separation of concerns
- CPU-efficient caching strategies for pathfinding and base planning
- Finite State Machine pattern for creep role management
- Automated base planning with stamp-based layouts and terrain analysis
- Federal resource balancing across multi-room empire
- Tower defense with threat evaluation and coordinated fire
- Focus on documentation and customization for community learning

**Phase 1: Critical CPU Optimizations (Immediate - High Value)**

- [ ] Memory-centric Caching Infrastructure - ⭐⭐⭐⭐⭐ - Related: #392, #426, #494
  - Create @cache decorator for automatic cache management
  - Cache pathfinding, base planning, role assignments
  - Implement smart invalidation strategies
  - Target: 20-30% CPU reduction, 80%+ cache hit rate
- [ ] Hauling Optimization System - ⭐⭐⭐⭐⭐ - Related: #493, #607, #614, #638
  - Implement TransportRequestGroup pattern
  - Add anti-ping-pong logic for purposeful movement
  - Dynamic hauler scaling based on throughput
  - Target: <10% idle hauler time, improved energy flow

**Phase 2: Core Infrastructure (Short-term - High Value)**

- [ ] Finite State Machine for Creeps - ⭐⭐⭐⭐ - Related: #478
  - Create FSM base class with state/transition methods
  - Define states for each creep role
  - Add state visualization for debugging
  - Migrate existing behavior controllers to FSM
- [ ] Automated Base Planning System - ⭐⭐⭐⭐⭐ - Related: #478
  - Implement stamp-based layouts (bunker, extensions, labs)
  - Add terrain analysis with distance transforms
  - Create anchor calculation algorithm
  - Build progressive planning by RCL
  - Visual debugging for planned layouts
- [ ] Tower Defense Enhancement - ⭐⭐⭐⭐
  - Implement threat evaluation and priority targeting
  - Add coordinated fire for multiple towers
  - Enhance repair prioritization (critical/normal/low thresholds)
  - Create visual indicators for tower operations

**Phase 3: Multi-room Scaling (Medium-term - Medium-High Value)**

- [ ] Remote Mining Enhancement - ⭐⭐⭐⭐ - Related: #607, #614, #638
  - Dedicated miner/hauler roles with optimal body composition
  - Dynamic hauler scaling based on distance and throughput
  - Automated road building and maintenance
  - Safety checks and invader response
- [ ] Federal Resource Balancing - ⭐⭐⭐⭐ - Related: #607, #614
  - Declarative resource config (min/max per structure type)
  - Automatic balancing across empire
  - Terminal coordination for inter-room transfers
  - Distribution efficiency metrics
- [ ] Energy Management State Machine - ⭐⭐⭐⭐ - Related: #607, #614, #638
  - Supply/demand monitoring with state machine
  - Link network optimization for energy highways
  - Task memory to avoid duplicate work
  - Energy routing algorithms

**Phase 4: Advanced Features (Long-term - Medium Value)**

- [ ] Defensive Infrastructure - ⭐⭐⭐⭐
  - Strategic rampart placement in base planning
  - Repair threshold system (critical > 300 HP)
  - Observer network for early threat detection
  - Pathing manipulation with walls
- [ ] Military Operations Manager - ⭐⭐⭐
  - Specialized combat roles (defender, healer, ranger, attacker)
  - Formation support (quads and duos)
  - Automated threat response
  - Manual override via console

**Comparison with Overmind:**

- **Accessibility:** International simpler and more customizable, Overmind more sophisticated
- **Cooperation:** International basic inter-bot communication, Overmind advanced Assimilator hivemind
- **Combat:** International functional defense, Overmind adaptive swarm intelligence
- **CPU:** International more efficient baseline, Overmind historically higher but improving
- **Integration:** Use International patterns for clarity and efficiency, Overmind patterns for advanced automation

**Integration Strategy:**

1. Start with high-value, low-risk patterns (FSM, tower defense)
2. Implement critical CPU optimizations early (caching, hauling)
3. Build complex systems incrementally (base planning, balancing)
4. Test and measure impact at every phase
5. Maintain compatibility with existing systems

**Note:** See full analysis in `docs/research/the-international-analysis.md` for detailed patterns, comparison with Overmind and other bots, compatibility assessment, and comprehensive implementation roadmap.

## In Progress

- [ ] Measure Copilot-driven change quality and feed outcomes into system evaluation reports.

## Recently Completed

- [x] Enhanced Copilot Todo automation workflow to create draft PRs with visible implementation progress _(2025-10-22)_.
  - Draft PRs are created immediately when Todo label is applied for transparency
  - Implementation progress shown through frequent commits and PR description updates
  - Users can follow along with the automation process in real-time
  - PRs marked as ready for review only after validation passes
- [x] Set up Copilot instructions for the repository with `.github/copilot-instructions.md` file _(2025-10-21)_.
- [x] Implemented issue triage workflow using copilot-exec action to automatically reformulate and label new issues _(2025-10-21)_.
- [x] Added Copilot-driven stats monitoring, label sync, and CI auto-fix automation with refreshed docs _(2025-10-21)_.
- [x] Migrated automation to GitHub Copilot CLI, enabled Dependabot auto-merge, and documented PTR practices _(2025-10-21)_.
- [x] Bootstrap Bun-powered Screeps kernel with automated build/test/deploy workflows _(2025-10-21)_.
- [x] Added repository health evaluation pipeline and reporting _(2025-10-21)_.
