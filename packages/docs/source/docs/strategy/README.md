# Strategic Documentation

This directory contains strategic planning documentation for the Screeps GPT bot development project. It provides a structured framework for tracking bot progression through development phases, capturing learning insights, and documenting architectural decisions.

## Purpose

Strategic documentation enables:

- **Phase Tracking**: Monitor bot development progress through Phase 1-5 framework
- **Learning Capture**: Document successful patterns and failed approaches to prevent repeated mistakes
- **Decision Records**: Maintain rationale for architectural and strategic decisions
- **Autonomous Planning**: Provide context for AI agents making strategic improvement decisions

## Directory Structure

### `phases/`

Phase-specific documentation tracking objectives, implementation status, and completion criteria:

- [Phase 1: Foundation](phases/phase-1-foundation.md) - RCL 1-2 bootstrapping and basic economy
- [Phase 2: Core Framework](phases/phase-2-core-framework.md) - Task system and spawn queue
- [Phase 3: Advanced Economy](phases/phase-3-advanced-economy.md) - Remote harvesting and terminal management
- [Phase 4: Empire Coordination](phases/phase-4-empire-coordination.md) - Multi-room coordination
- [Phase 5: Multi-Room & Global Management](phases/phase-5-multi-room-global.md) - Colony scaling and shard coordination

### `learning/`

Documented patterns, insights, and lessons learned from implementation:

- [Learning Overview](learning/README.md) - Summary of key insights
- Successful patterns extracted from CHANGELOG.md
- Failed approaches and their alternatives
- Performance optimization discoveries

### `decisions/`

Architectural Decision Records (ADRs) documenting significant design choices:

- [ADR Template and Guidelines](decisions/README.md) - Template for documenting decisions
- [ADR-001: Manager-Based Architecture](decisions/adr-001-manager-based-architecture.md) - Foundation architecture pattern
- [ADR-002: Role-Based to Task-Based Migration](decisions/adr-002-role-to-task-migration.md) - Phase 2 transition strategy
- [ADR-003: Stats Collection Resilience](decisions/adr-003-stats-collection-resilience.md) - Critical infrastructure hardening

## Strategic Planning Documents

### Current State and Progress

- **[Strategic Roadmap](roadmap.md)** - Current phase status, success metrics, and upcoming milestones
- **[Technical Debt Roadmap](technical-debt-roadmap.md)** - Comprehensive debt reduction and future-proofing strategy (2025-11-17)

The Technical Debt Roadmap provides a systematic approach to reducing technical debt, improving code quality, and preparing for long-term scalability. It includes:

- Prioritized technical debt inventory (critical, high, medium, low)
- Architecture evaluation and migration strategies
- Code quality improvements and testing expansion
- Infrastructure modernization plans
- Phased implementation roadmap (12 weeks)

## Usage for Autonomous Agents

Strategic planning agents should:

1. **Read phase documentation** to understand current development stage and completion status
2. **Review learning insights** to avoid repeating failed approaches and leverage proven patterns
3. **Consult decision records** to understand architectural constraints and rationale
4. **Update strategic roadmap** when proposing new initiatives or reporting phase progress
5. **Create ADRs** when making significant architectural decisions

## Integration with Workflows

Strategic documentation is consumed by:

- **Strategic Planning Agent** (`.github/workflows/screeps-monitoring.yml`) - Analyzes bot progression and generates improvement issues
- **Issue Triage Agent** - References phases when categorizing and prioritizing issues
- **Todo Implementation Agent** - Consults learning insights during implementation
- **Review Agent** - Validates alignment with strategic roadmap during audits

## Maintenance

Strategic documentation should be updated:

- **Phase progress** - When major milestones are completed or blockers are identified
- **Learning insights** - After significant implementations or when patterns emerge from multiple issues
- **Decision records** - When making architectural choices that impact future development
- **Roadmap** - Monthly or when phase completion status changes significantly

## Related Documentation

### Operational Documentation

- [Operational Runbooks](../operations/runbooks.md) - Emergency procedures, deployment, troubleshooting (2025-11-17)
- [Testing Strategy](../runtime/testing-strategy.md) - Comprehensive testing approach and guidelines (2025-11-17)
- [Monitoring Documentation](../operations/) - Health checks, alerting, and telemetry

### Repository Documentation

- [TASKS.md](../../TASKS.md) - Tactical work items aligned to phases
- [CHANGELOG.md](../../CHANGELOG.md) - Release history and implementation details
- [AGENTS.md](../../AGENTS.md) - Agent guidelines and operational rules
- [docs/automation/overview.md](../automation/overview.md) - Workflow specifications
- [docs/research/](../research/) - Analysis of external patterns (Overmind, creep-tasks, etc.)
