# GitHub Copilot Instructions

This repository hosts an autonomous Screeps AI with comprehensive automation. When working on this codebase, follow these guidelines to ensure consistency and quality.

## Technology Stack

- **Runtime**: Node.js 18.x-22.x
- **Language**: TypeScript (strict mode enabled)
- **Package Manager**: Yarn 4+ (Berry)
- **Build Tool**: esbuild
- **Testing Framework**: Vitest
- **Linting**: ESLint with TypeScript plugin
- **Formatting**: Prettier
- **Target Environment**: Screeps MMO game engine

## Core Principles

- **Minimal changes**: Make the smallest possible modifications to achieve the goal
- **Test-driven**: Write or update tests before fixing bugs
- **Documentation-first**: Update docs when behavior changes
- **Quality gates**: Always run lint, format, and relevant test suites before committing
- **No backwards compatibility**: Obsolete or deprecated code is removed immediately; code only needs to work with itself, not previous versions
- **Fix all issues**: When working on a task, fix all related issues encountered regardless of who introduced them. CI failures and technical debt discovered during implementation should be addressed. The only exception is the performance benchmark workflow.

## Suitable Tasks for Copilot

### Recommended Task Types

- **Bug fixes** with clear reproduction steps and existing test coverage
- **Test coverage improvements** for existing functionality
- **Documentation updates** to reflect code changes
- **Linting and formatting fixes** using existing tooling
- **Dependency updates** (non-breaking changes)
- **Performance optimizations** with measurable benchmarks
- **CI/CD workflow improvements** within the `.github/workflows/` directory

### Tasks Requiring Careful Review

- **New features** affecting game behavior or strategy
- **Architectural changes** to the runtime kernel or evaluation system
- **Complex refactoring** across multiple modules
- **Security-sensitive code** (authentication, secrets handling, deployment)
- **Algorithm changes** affecting AI decision-making

## Deprecation and Code Removal Policy

**This repository has a zero-tolerance policy for obsolete code:**

- **Remove obsolete/deprecated code immediately** - no grace period, no feature flags, no dual code paths
- **Code only needs to work with itself** - backwards compatibility with previous versions is NOT a concern
- **When better implementations exist, delete the old ones** - don't mark as deprecated, just remove
- **No compatibility layers** - if code is replaced, remove the old version entirely

**Examples of immediate removal:**

- If a new architecture replaces an old one (e.g., RoleControllerManager replaces BehaviorController), delete the old controller
- If a better algorithm is implemented, remove the old one
- If a feature is reimplemented, delete the original implementation

**Benefits of this policy:**

- Clean, maintainable codebase without legacy cruft
- No confusion about which code path is active or should be used
- Faster development without compatibility constraints
- Reduced cognitive load when reading and maintaining code
- Smaller bundle sizes and better performance

## Repository Structure

### Runtime Code (`packages/screeps-bot/src/`)

- `packages/screeps-bot/src/SwarmBot.ts` - Main bot controller class
- `packages/screeps-bot/src/core/` - Logger, profiler, scheduler, and room management
- `packages/screeps-bot/src/memory/` - Memory schemas and management
- `packages/screeps-bot/src/logic/` - Pheromone system, evolution, defense, expansion, and strategic layers
- `packages/screeps-bot/src/roles/` - Creep role families (economy, military, utility, power)
- `packages/screeps-bot/src/layouts/` - Blueprint system for structure placement
- `packages/screeps-bot/src/intershard/` - Multi-shard coordination via InterShardMemory

### Supporting Infrastructure

- `packages/utilities/scripts/` - Build, deploy, and automation scripts (TypeScript executed with Bun)
- `tests/` - Vitest suites (unit, e2e, regression, mockup) (root level)
- `reports/` - Persistent analysis artifacts (root level)
- `.github/workflows/` - GitHub Actions automation
- `.github/copilot/prompts/` - Prompt templates for Copilot automation

## Coding Standards

### TypeScript

- Strict mode enabled in `tsconfig.json` - avoid `any` unless absolutely necessary
- Prefer small, testable modules
- Share contracts through `packages/screeps-bot/src/memory/` schemas rather than duplicating types
- Add TSDoc blocks for non-trivial exported classes and functions
- Keep runtime code deterministic; guard `Math.random()` behind helper utilities

### Naming Conventions

- Use `camelCase` for variables and functions
- Use `PascalCase` for classes and types
- Use `SCREAMING_SNAKE_CASE` for constants
- Prefix private properties with underscore `_` when appropriate

### File Organization

- One primary export per file when possible
- Group related functionality in directories with index.ts
- Keep test files adjacent to source or in parallel test directories

### Internal Utilities and Libraries

**Prefer these internal modules:**

- `packages/screeps-bot/src/memory/` - Use memory schemas and management for consistent Memory object access
- `packages/screeps-bot/src/logic/` - Use pheromone, evolution, and strategic logic modules
- `packages/screeps-bot/src/core/` - Use core modules for profiling, logging, and scheduling

**External libraries:**

- Use `screeps-api` for deployment and server interaction
- Use `zod` for runtime type validation
- Use `semver` for version comparison and validation
- Avoid adding new dependencies unless absolutely necessary

## Development Workflow

### Available Commands

```bash
yarn build              # Bundle AI into dist/main.js
yarn lint               # Run ESLint (use lint:fix for auto-fixes)
yarn format:write       # Format code with Prettier
yarn test:unit          # Run unit tests
yarn test:e2e           # Run end-to-end simulations (PTR profile)
yarn test:regression    # Run regression tests
yarn test:coverage      # Generate coverage reports
yarn test:actions       # Dry-run workflows locally with act
yarn analyze:system     # Evaluate build quality
yarn deploy             # Deploy to Screeps (requires secrets)
```

### Before Committing

1. Run `yarn format:write` to format code
2. Run `yarn lint` to check code style
3. Run relevant test suites (`test:unit`, `test:e2e`, `test:regression`)
4. Update `CHANGELOG.md` `[Unreleased]` section
5. Run `yarn versions:update` after changelog updates

### Bug Fix Protocol

1. **Capture first**: Add/update regression test demonstrating the bug
2. **Document**: Record root cause, test name, and remediation in `packages/docs/source/docs/operations/`
3. **Update changelog**: Add to `CHANGELOG.md` `[Unreleased]` section
4. **Reference**: Link regression test in documentation and changelog

## Testing Expectations

- Use Vitest for all tests
- Place unit tests in `tests/unit/`
- Place end-to-end tests in `tests/e2e/`
- Place regression tests in `tests/regression/`
- Aim for meaningful coverage, not just percentage targets
- Mock Screeps globals when testing runtime code
- Use `screeps-server-mockup` for tick-based integration tests when applicable

## Documentation Requirements

### When to Update Docs

- **README.md**: User-facing behavior, workflows, or automation changes
- **packages/docs/source/docs/**: **CRITICAL** - Any workflow, runtime, or operational changes MUST go here
- **TASKS.md**: Add new tasks, mark completed items (don't delete immediately)
- **AGENTS.md**: Changes to agent guidelines or automation behavior

### Documentation Structure

- Keep main documentation in root (`README.md`, `DOCS.md`, `AGENTS.md`, `TASKS.md`)
- **CRITICAL**: Place detailed runbooks in `packages/docs/source/docs/` subdirectories
- Structure: `packages/docs/source/docs/{category}/{filename}.md`
- Categories: `automation/`, `operations/`, `runtime/`, `changelog/`, `security/`, `analytics/`, `strategy/`, `research/`, `architecture/`, `features/`, `development/`
- Link new documents from `README.md`, `DOCS.md`, or `packages/docs/source/docs/index.md`
- Generate documentation site with `yarn build:docs-site`

## Automation & Workflows

This repository has extensive GitHub Actions automation. Key workflows:

- **guard-\* workflows** - Consolidated PR validation with strategy matrices (guard-code-quality.yml, guard-tests.yml, guard-build.yml, guard-coverage.yml, etc.)
- **quality-gate-summary.yml** - Aggregates guard workflow results for PR validation
- **post-merge-release.yml** - Auto-versioning and tagging
- **deploy.yml** - Screeps deployment on version tags
- **copilot-review.yml** - Scheduled repository audits
- **copilot-issue-triage.yml** - Automatic issue reformulation
- **copilot-todo-pr.yml** - Automated Todo issue resolution
- **copilot-ci-autofix.yml** - Automated CI failure resolution
- **screeps-monitoring.yml** - Comprehensive monitoring combining strategic analysis with PTR telemetry

### Workflow Guidelines

- Use the `copilot-exec` composite action for AI-powered CLI operations
  - Note: `copilot-exec` now delegates to `codex-exec` (OpenAI's official `codex-action`) for reduced maintenance
  - Maintains backward compatibility with all existing workflows
- Maintain least-privilege permissions (follow Graphite's guidance)
- Document new secrets in `README.md`
- Keep automation promises aligned with `packages/docs/source/docs/automation/overview.md`

## Security & Best Practices

- **Never commit secrets** to source code
- Reference secrets via GitHub Actions secrets
- Validate dependency updates don't introduce vulnerabilities
- Follow least-privilege principles for workflow permissions
- Use the `gh-advisory-database` tool before adding dependencies

## Labels & Issue Management

Repository labels are synchronized from `.github/labels.yml` using a standardized three-tier system:

**Process Labels:** `Todo` (automation trigger), `monitoring` (PTR alerts), `needs/regression-test`

**State Labels:** `state/pending`, `state/backlog`, `state/in-progress`, `state/blocked`, `state/canceled`, `state/done`

**Type Labels:** `type/bug`, `type/feature`, `type/enhancement`, `type/chore`, `type/question`

**Priority Labels:** `priority/critical`, `priority/high`, `priority/medium`, `priority/low`, `priority/none`

**Domain Labels:** `automation`, `documentation`, `runtime`, `monitoring`, `dependencies`, `regression`

**Workflow Labels:** `good-first-issue`, `help-wanted`, `wontfix`, `duplicate`, `invalid`

**Important:**

- Never edit labels in the UI - update `.github/labels.yml` instead
- Use `type/*` and `priority/*` labels for issue classification
- Apply `state/pending` to new issues, update states as work progresses

## Bot Architecture

The bot uses an **ant colony-inspired swarm intelligence architecture**:

### Layers

1. **Pheromone Layer** - Room-level signals that decay over time and diffuse to neighboring rooms
2. **Room Layer** - Evolution stages and postures that determine behavior priorities
3. **Cluster Layer** - Groups of rooms that coordinate resources and defense
4. **Strategic Layer** - Empire-wide decisions for expansion and war
5. **Agent Layer** - Individual creeps using simple heuristics for task selection
6. **Multi-Shard Layer** - Cross-shard coordination via InterShardMemory

### Role Families

- **Economy** - larvaWorker, harvester, hauler, builder, upgrader, queenCarrier, etc.
- **Military** - guard, healer, soldier, siegeUnit, harasser, squadMember
- **Utility** - scout, claimer, engineer, remoteWorker, terminalManager
- **Power** - powerHarvester, powerCarrier, powerQueen, powerWarrior

**Important Documentation:**

- [Screeps Bot README](packages/screeps-bot/README.md) - Full API documentation and architecture overview

## Using MCP Servers for Screeps Knowledge

When working on runtime code or strategic planning, leverage MCP servers to access accurate game information:

### Available MCP Tools

**Screeps Documentation MCP** (official API docs):

- `screeps_docs_search` - Search documentation for specific topics
- `screeps_docs_get_api` - Get API object documentation (e.g., `Spawn`, `Source`, `StructureLink`)
- `screeps_docs_get_mechanics` - Get game mechanics documentation (e.g., `pathfinding`, `claiming`)
- `screeps_docs_list_apis` - List all available Screeps API objects
- `screeps_docs_list_mechanics` - List all game mechanics topics

**Screeps Wiki MCP** (community knowledge):

- `screeps_wiki_search` - Search community wiki for strategies and patterns
- `screeps_wiki_get_article` - Fetch specific wiki articles
- `screeps_wiki_list_categories` - List available wiki categories
- `screeps_wiki_get_table` - Extract table data (useful for game constants like `BODYPART_COST`)

### When to Use MCP Tools

**Use MCP tools when:**

- Implementing features that require accurate API knowledge
- Triaging issues related to game mechanics
- Planning strategic improvements to bot behavior
- Validating assumptions about game constants
- Researching optimization techniques from community knowledge

**Research workflow:**

1. Query official API docs for structure/creep details
2. Search community wiki for optimization patterns
3. Reference game constants for accurate calculations
4. Validate assumptions against current game mechanics

For detailed documentation, see `packages/docs/source/docs/automation/mcp-integration.md`.

## Additional Resources

For comprehensive guidelines, architecture details, and agent-specific instructions, refer to:

- **[AGENTS.md](../AGENTS.md)** - Complete agent guidelines and knowledge base
- **[README.md](../README.md)** - Repository overview and automation summary
- **[DOCS.md](../DOCS.md)** - Developer guide and learning resources
- **[packages/docs/source/docs/automation/overview.md](../packages/docs/source/docs/automation/overview.md)** - Detailed workflow specifications

These documents are the authoritative source for repository conventions, automation behavior, and development practices.
