# Screeps GPT Knowledge Base

This directory supplements the top-level [README](../README.md) with deeper operational notes for the autonomous Screeps GPT
stack. Keep these documents current whenever you touch automation, workflows, or runtime behaviour—the GitHub Copilot CLI reads
them before acting.

## Quick Start

1. **Install prerequisites**
   - [Node.js](https://nodejs.org) 16.x with Python 2 for native dependencies.
   - [npm](https://www.npmjs.com) 8.0 or newer (bundled with Node.js 16).
   - Node.js 22 is used in CI to install the Copilot CLI.
   - Screeps account with Public Test Realm (PTR) access for end-to-end trials.
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Local quality gates**
   ```bash
   npm run lint
   npm run format:check
   npm run test:unit
   npm run test:e2e   # PTR configuration
   npm run test:regression
   npm run test:coverage
   npm run test:actions
   npm run analyze:system
   ```
4. **Build & deploy**
   - Bundle with `npm run build`.
   - Deploy to PTR: `SCREEPS_HOST=ptr.screeps.com npm run deploy` (requires `SCREEPS_TOKEN`).

## Documentation Rules

- Update the files under `docs/` whenever you change automation, runtime behaviour, or operating procedures.
- Capture lessons learned from bug fixes or regressions, including links to the relevant tests.
- Cross-reference new documents from `README.md` or other entry points so the automation agents discover them.
- Update `CHANGELOG.md` in the `[Unreleased]` section and run `npm run versions:update` so `docs/changelog/versions.*` stays in sync.
- Preview the GitHub Pages site with `npm run build:docs-site` whenever you adjust documentation or changelog content.

## Additional Guides

### Automation & Workflows

- [Agent Guidelines](../AGENTS.md) - Comprehensive rules and knowledge base for GitHub Copilot and automation agents
- [Automation Overview](automation/overview.md)
- [Spec-Kit Workflow Guide](automation/spec-kit-workflow.md) - Specification-driven development with plan generation and refinement
- [Label System Guide](automation/label-system.md) - Standardized labeling system for issue and PR management
- [Semantic Versioning Guide](automation/semantic-versioning-guide.md) - Conventional commits and automated version bumping
- [Push Notifications Guide](automation/push-notifications.md) - Real-time alerts for critical repository and Screeps bot events

### Runtime Strategy & Behavior

- [Creep Roles](runtime/strategy/creep-roles.md) - Role definitions, decision trees, and performance characteristics
- [Task Prioritization](runtime/strategy/task-prioritization.md) - Task switching, efficiency optimization, and load balancing
- [Scaling Strategies](runtime/strategy/scaling-strategies.md) - RCL progression, multi-room expansion, and CPU budgeting

### Operations & Monitoring

- [Memory Management](runtime/operations/memory-management.md) - Memory patterns, cleanup strategies, and corruption recovery
- [Performance Monitoring](runtime/operations/performance-monitoring.md) - CPU tracking, optimization techniques, and alerting
- [PTR Monitoring Pipeline](operations/stats-monitoring.md)
- [Respawn Handling](operations/respawn-handling.md)
- [Deployment Troubleshooting](operations/deployment-troubleshooting.md) - Common deployment issues and solutions
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
