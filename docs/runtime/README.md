# Runtime Documentation

This directory contains operational documentation for the .screeps-gpt runtime system. These guides explain how the bot's core systems work and how to operate, monitor, and troubleshoot them.

## Available Guides

### Core Systems

- **[Bootstrap Phases](bootstrap-phases.md)** - Complete guide to the bootstrap phase system that manages early-game RCL progression (Phase 0→1→2). Covers phase definitions, transition criteria, monitoring, troubleshooting, and manual intervention procedures.

- **Memory Management** (Coming soon) - Memory structure, initialization, cleanup strategies, and best practices for managing persistent game state.

- **Role Balancing** (Coming soon) - Dynamic role population adjustment, spawn priority system, and how roles adapt to room conditions.

### Task System

- **[Task Actions Reference](task-actions-reference.md)** - Complete reference for task types, actions, and how creeps execute assigned tasks.

### Testing

- **[Testing Strategy](testing-strategy.md)** - Test infrastructure, test types (unit, e2e, regression), and testing best practices for runtime code.

## Quick Links

### Operational Procedures

For emergency procedures and troubleshooting, see:

- [Operational Runbooks](../operations/runbooks.md)
- [Bootstrap Troubleshooting](../operations/runbooks.md#bootstrap-phase-troubleshooting)

### Strategic Context

For high-level phase progression and strategic planning:

- [Strategic Roadmap](../strategy/roadmap.md)
- [Phase 1: Foundation](../strategy/phases/phase-1-foundation.md)
- [Phase 2: Core Framework](../strategy/phases/phase-2-core-framework.md)

### Learning Resources

For implementation patterns and design decisions:

- [Bootstrap Implementation](../strategy/learning/bootstrap-implementation.md)
- [Container-Based Harvesting](../strategy/learning/container-based-harvesting.md)
- [Architecture Decisions](../strategy/decisions/)

## Documentation Standards

When adding new runtime documentation:

1. **Audience**: Target developers and operators (humans and autonomous agents)
2. **Structure**: Include Purpose, Overview, Operational Guide, Troubleshooting sections
3. **Code Examples**: Provide console commands and TypeScript snippets where relevant
4. **Cross-References**: Link to related strategic docs, runbooks, and code files
5. **Changelog**: Add changelog section for documentation history

## Related Documentation

- [Main README](../../README.md) - Project overview and quick start
- [Developer Guide (DOCS.md)](../../DOCS.md) - Contribution guidelines and development workflow
- [Agent Guidelines (AGENTS.md)](../../AGENTS.md) - Autonomous agent operational procedures
