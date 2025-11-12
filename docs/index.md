# Screeps GPT Knowledge Base

This directory supplements the top-level [README](../README.md) with deeper operational notes for the autonomous Screeps GPT
stack. Keep these documents current whenever you touch automation, workflows, or runtime behaviour—the GitHub Copilot CLI reads
them before acting.

## Quick Start

For a complete setup guide, see the **[Getting Started Guide](getting-started.md)**.

**Quick reference:**

1. **Install prerequisites**: Bun 1.0+, Node.js 18.x–22.x
2. **Install dependencies**: `bun install`
3. **Run quality checks**: `bun run lint && bun run test:unit`
4. **Build & deploy**: `bun run build && bun run deploy`

## Documentation Rules

- Update the files under `docs/` whenever you change automation, runtime behaviour, or operating procedures.
- Capture lessons learned from bug fixes or regressions, including links to the relevant tests.
- Cross-reference new documents from `README.md` or other entry points so the automation agents discover them.
- Update `CHANGELOG.md` in the `[Unreleased]` section and run `bun run versions:update` so `docs/changelog/versions.*` stays in sync.
- Preview the GitHub Pages site with `bun run build:docs-site` whenever you adjust documentation or changelog content.

## Additional Guides

### Getting Started & Setup

- [Getting Started Guide](getting-started.md) - Complete setup instructions, prerequisites, development workflow, and contributing guidelines

### Automation & Workflows

- [Agent Guidelines](../AGENTS.md) - Comprehensive rules and knowledge base for GitHub Copilot and automation agents
- [Automation Overview](automation/overview.md)
- [Label System Guide](automation/label-system.md) - Standardized labeling system for issue and PR management
- [Semantic Versioning Guide](automation/semantic-versioning-guide.md) - Conventional commits and automated version bumping
- [Push Notifications Guide](automation/push-notifications.md) - Real-time alerts for critical repository and Screeps bot events

### Runtime Strategy & Behavior

- [Energy Management](runtime/energy-management.md) - Comprehensive energy collection and distribution strategies
- [Creep Roles](runtime/strategy/creep-roles.md) - Role definitions, decision trees, and performance characteristics
- [Task Prioritization](runtime/strategy/task-prioritization.md) - Task switching, efficiency optimization, and load balancing
- [Scaling Strategies](runtime/strategy/scaling-strategies.md) - RCL progression, multi-room expansion, and CPU budgeting
- [Remote Harvesting](runtime/strategy/remote-harvesting.md) - Remote room scouting, mapping, and resource extraction

### Strategic Planning & Roadmap

- [Development Roadmap](strategy/roadmap.md) - Comprehensive bot evolution plan from RCL 1-2 to multi-shard operations
- [Architecture Alignment](strategy/architecture.md) - Mapping roadmap phases to existing codebase structure
- **Phase Implementation Guides**:
  - [Phase 1: RCL 1-2 Foundation](strategy/phases/01-foundation.md) - Stable early-game economy and automation
  - [Phase 2: Core Task Framework](strategy/phases/02-core-framework.md) - Task-based architecture and resource management
  - [Phase 3: Economy Expansion](strategy/phases/03-economy-expansion.md) - Terminal, labs, market, and factory automation
  - [Phase 4: Multi-Room Management](strategy/phases/04-multi-room.md) - Empire coordination and colonization
  - [Phase 5: Advanced Combat & Multi-Shard](strategy/phases/05-advanced-combat.md) - Military operations and cross-shard presence
- **External Analysis & Inspiration**:
  - [Jon Winsley Blog Analysis](strategy/external-analysis/jon-winsley-analysis.md) - Real-world Screeps development patterns, CPU optimization, and task management insights
  - [Screeps Quorum Analysis](strategy/external-analysis/screeps-quorum-analysis.md) - Community-driven architecture and governance patterns

### Operations & Monitoring

- [CPU Timeout Diagnostic Runbook](operations/cpu-timeout-diagnosis.md) - Comprehensive CPU timeout diagnosis, resolution, and prevention guide
- [Monitoring Alert Playbook](operations/monitoring-alerts-playbook.md) - Alert classification, response procedures, and auto-resolution guidelines
- [CPU Optimization Strategies](runtime/operations/cpu-optimization-strategies.md) - Kernel CPU budgets, incremental protection, and behavior optimization
- [Memory Management](runtime/operations/memory-management.md) - Memory patterns, cleanup strategies, and corruption recovery
- [Performance Monitoring](runtime/operations/performance-monitoring.md) - CPU tracking, optimization techniques, and alerting
- [Performance Optimization](operations/performance-optimization.md) - CPU and memory optimization strategies, pathfinding, and profiling
- [CPU Timeout Incident Tracking](operations/cpu-timeout-incidents.md) - Systematic CPU timeout pattern documentation and coordination
- [PTR Monitoring Pipeline](operations/stats-monitoring.md)
- [Respawn Handling](operations/respawn-handling.md)
- [Deployment Troubleshooting](operations/deployment-troubleshooting.md) - Deployment issues, timeout scenarios, retry logic, and API error handling
- [Workflow Troubleshooting](operations/workflow-troubleshooting.md) - GitHub Actions workflow issues and fixes

### Development Guidelines

- [Strategy Testing](runtime/development/strategy-testing.md) - Testing methodologies, validation procedures, and benchmarking
- [Safe Refactoring](runtime/development/safe-refactoring.md) - Guidelines for preserving game performance during code changes
- [Improvement Metrics](runtime/development/improvement-metrics.md) - Measuring strategy effectiveness and detecting regressions
- [Developer Onboarding Resources](../DOCS.md)
- [Release History](changelog/versions.md)

Contributions should expand these notes rather than duplicating content in ad-hoc Markdown files.

```

```
