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

- [ADR Template](decisions/README.md) - Template for documenting decisions
- Individual ADRs for major architectural choices

## Strategic Roadmap

See [roadmap.md](roadmap.md) for current phase status, success metrics, and upcoming milestones.

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

- [TASKS.md](../../TASKS.md) - Tactical work items aligned to phases
- [CHANGELOG.md](../../CHANGELOG.md) - Release history and implementation details
- [AGENTS.md](../../AGENTS.md) - Agent guidelines and operational rules
- [docs/automation/overview.md](../automation/overview.md) - Workflow specifications
