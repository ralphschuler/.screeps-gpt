# GitHub Copilot Instructions

This repository hosts an autonomous Screeps AI with comprehensive automation. When working on this codebase, follow these guidelines to ensure consistency and quality.

## Technology Stack

- **Runtime**: Node.js 16.x with npm 8.0+
- **Language**: TypeScript (strict mode enabled)
- **Package Manager**: npm
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
- **Breaking changes** to APIs or contracts
- **Complex refactoring** across multiple modules
- **Security-sensitive code** (authentication, secrets handling, deployment)
- **Algorithm changes** affecting AI decision-making

## Repository Structure

### Runtime Code (`src/`)

- `src/runtime/bootstrap/` - Kernel orchestration and system wiring
- `src/runtime/behavior/` - Creep roles and spawn logic
- `src/runtime/memory/` - Memory consistency helpers
- `src/runtime/metrics/` - CPU tracking and performance accounting
- `src/runtime/respawn/` - Automatic respawn detection
- `src/runtime/evaluation/` - Health reports and improvement recommendations
- `src/shared/` - Shared contracts and types

### Supporting Infrastructure

- `scripts/` - Build, deploy, and automation scripts (Node.js 16 + TypeScript)
- `tests/` - Vitest suites (unit, e2e, regression, mockup)
- `reports/` - Persistent analysis artifacts
- `.github/workflows/` - GitHub Actions automation
- `.github/copilot/prompts/` - Prompt templates for Copilot automation

## Coding Standards

### TypeScript

- Strict mode enabled in `tsconfig.json` - avoid `any` unless absolutely necessary
- Prefer small, testable modules
- Share contracts through `src/shared/` rather than duplicating types
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

- `src/shared/` - Use shared types and contracts instead of duplicating definitions
- `src/runtime/metrics/` - Use existing CPU tracking utilities for performance monitoring
- `src/runtime/memory/` - Use memory helpers for consistent Memory object access
- `src/runtime/evaluation/` - Use evaluation types for health reports and recommendations

**External libraries:**

- Use `screeps-api` for deployment and server interaction
- Use `zod` for runtime type validation
- Use `semver` for version comparison and validation
- Avoid adding new dependencies unless absolutely necessary

## Development Workflow

### Available Commands

```bash
npm run build              # Bundle AI into dist/main.js
npm run lint               # Run ESLint (use lint:fix for auto-fixes)
npm run format:write       # Format code with Prettier
npm run test:unit          # Run unit tests
npm run test:e2e           # Run end-to-end simulations (PTR profile)
npm run test:regression    # Run regression tests
npm run test:coverage      # Generate coverage reports
npm run test:actions       # Dry-run workflows locally with act
npm run analyze:system     # Evaluate build quality
npm run deploy             # Deploy to Screeps (requires secrets)
```

### Before Committing

1. Run `npm run format:write` to format code
2. Run `npm run lint` to check code style
3. Run relevant test suites (`test:unit`, `test:e2e`, `test:regression`)
4. Update `CHANGELOG.md` `[Unreleased]` section
5. Run `npm run versions:update` after changelog updates

### Bug Fix Protocol

1. **Capture first**: Add/update regression test demonstrating the bug
2. **Document**: Record root cause, test name, and remediation in `docs/operations/`
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
- **docs/**: Any workflow, runtime, or operational changes
- **TASKS.md**: Add new tasks, mark completed items (don't delete immediately)
- **AGENTS.md**: Changes to agent guidelines or automation behavior

### Documentation Structure

- Keep main documentation in root (`README.md`, `DOCS.md`, `AGENTS.md`, `TASKS.md`)
- Place detailed runbooks in `docs/` subdirectories
- Link new documents from `README.md`, `DOCS.md`, or `docs/index.md`
- Generate documentation site with `npm run build:docs-site`

## Automation & Workflows

This repository has extensive GitHub Actions automation. Key workflows:

- **quality-gate.yml** - PR validation (lint, format, tests, coverage)
- **post-merge-release.yml** - Auto-versioning and tagging
- **deploy.yml** - Screeps deployment on version tags
- **copilot-review.yml** - Scheduled repository audits
- **copilot-issue-triage.yml** - Automatic issue reformulation
- **copilot-todo-pr.yml** - Automated Todo issue resolution
- **copilot-ci-autofix.yml** - Automated CI failure resolution
- **screeps-stats-monitor.yml** - PTR telemetry monitoring

### Workflow Guidelines

- Use the `copilot-exec` composite action for Copilot CLI operations
- Maintain least-privilege permissions (follow Graphite's guidance)
- Document new secrets in `README.md`
- Keep automation promises aligned with `docs/automation/overview.md`

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
- Use new `type/*` and `priority/*` labels instead of deprecated `bug`, `enhancement`, `severity/*` labels
- Apply `state/pending` to new issues, update states as work progresses

## Additional Resources

For comprehensive guidelines, architecture details, and agent-specific instructions, refer to:

- **[AGENTS.md](../AGENTS.md)** - Complete agent guidelines and knowledge base
- **[README.md](../README.md)** - Repository overview and automation summary
- **[DOCS.md](../DOCS.md)** - Developer guide and learning resources
- **[docs/automation/overview.md](../docs/automation/overview.md)** - Detailed workflow specifications

These documents are the authoritative source for repository conventions, automation behavior, and development practices.
