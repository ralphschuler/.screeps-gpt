# Tasks

## Backlog

### Strategic Planning

- [ ] Create Epic issues for each roadmap phase (Phase 1-5)
- [ ] Set up PTR monitoring for Phase 1 metrics (energy surplus, controller downgrade, spawn utilization)
- [ ] Configure evaluation pipeline to track roadmap progression milestones

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
- [ ] Add container-based harvesting for improved efficiency
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
- [ ] Implement storage manager for resource distribution
- [x] Add link network optimization for energy highways _(Partial: RCL 5 link placement added)_
- [x] Create tower automation for defense and repair _(2025-11-06)_
  - TowerManager with threat-based targeting
  - Prioritized attack/heal/repair actions
  - Regression tests for defense prioritization
- [ ] Add centralized memory segments for persistent data
- [ ] Implement path caching with TTL management
- [ ] Create RoomManager abstraction with manager registry

### Future Phases

- [x] Phase 3: Remote harvesting, improved base planning, road automation, defense _(2025-11-06)_
  - ScoutManager for remote room mapping
  - Enhanced BasePlanner with RCL 2-5 layouts
  - RoadPlanner for automated road placement
  - TowerManager for intelligent defense
- [ ] Phase 3: Terminal management, lab automation, market integration
- [ ] Phase 4: Empire coordination, room claiming, multi-room logistics
- [ ] Phase 5: Military operations, multi-shard expansion

### Technical Improvements

- [x] Expand creep role library beyond harvester/upgrader to cover builders and remote miners _(Already implemented)_
- [x] Add remote harvesting and room scouting system _(2025-11-06)_
- [ ] Add automated simulation snapshots for regression verification of behaviour changes.
- [ ] Review Screeps Quorum automation patterns for scalable role orchestration.
- [ ] Design PTR stat baselines so the monitor can score trends automatically.

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
