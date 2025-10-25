# Tasks

## Backlog

### Strategic Planning

- [ ] Create Epic issues for each roadmap phase (Phase 1-5)
- [ ] Set up PTR monitoring for Phase 1 metrics (energy surplus, controller downgrade, spawn utilization)
- [ ] Configure evaluation pipeline to track roadmap progression milestones

### Phase 1: Foundation (HIGH Priority)

- [ ] Implement enhanced spawn priority system with energy threshold checks
- [ ] Add container-based harvesting for improved efficiency
- [ ] Automate road network planning (source → spawn, source → controller)
- [ ] Implement dynamic role population based on room state
- [ ] Optimize CPU usage for early game (<5 CPU/tick target)

### Phase 2: Core Framework (Planned)

- [ ] Design and implement task queue system with priority levels
- [ ] Create task assignment algorithm (closest idle creep, capability matching)
- [ ] Implement storage manager for resource distribution
- [ ] Add link network optimization for energy highways
- [ ] Create tower automation for defense and repair

### Future Phases

- [ ] Phase 3: Terminal management, lab automation, market integration
- [ ] Phase 4: Empire coordination, room claiming, multi-room logistics
- [ ] Phase 5: Military operations, multi-shard expansion

### Technical Improvements

- [ ] Expand creep role library beyond harvester/upgrader to cover builders and remote miners.
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
