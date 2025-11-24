# Repository Agent Guidelines

This repository manages an autonomous Screeps AI and the automation surrounding it. This document serves as the centralized knowledge base and ruleset for GitHub Copilot and other automation agents operating within this repository.

## Agent Roles and Scope

### Primary Agents

The repository uses a **unified agent architecture** where similar operations are consolidated into single agents with role-based behavior:

1. **GitHub Copilot** - General-purpose code editing, issue triage, and repository maintenance
2. **Copilot Issue Agent** (Unified) - Multi-mode issue management with role-based behavior
   - **Triage mode** - Automatic issue reformulation and labeling
   - **Resolve mode** - Automated issue resolution via draft pull requests with visible implementation progress
3. **Copilot Audit Agent** - Scheduled repository audits and quality assessments
4. **Screeps Monitoring** - PTR telemetry analysis, anomaly detection, and strategic analysis
5. **CI Auto Issue** - Automated issue creation for CI failures with circuit breaker pattern
6. **Copilot Email Triage** - Email-to-issue conversion and triage

### Consolidation Benefits

The unified agent pattern provides:

- **Reduced maintenance burden** - Single agent to maintain instead of multiple similar agents
- **Consistent behavior** - Shared infrastructure and validation logic across modes
- **Easier testing** - Single entry point for related operations
- **Clear intent** - Mode parameter makes operational intent explicit
- **Simplified debugging** - Consistent logging and error handling

### Operational Boundaries

Agents operate within these constraints:

- **Read-only by default**: Most agents only read repository data and file issues
- **Write access**: Limited to specific workflows with explicit `contents: write` or `pull_requests: write` permissions
- **Authentication**: All agents use the default `GITHUB_TOKEN` with least-privilege scopes
- **Prompt templates**: Located in `.github/copilot/prompts/` and rendered via the `copilot-exec` composite action
- **MCP integration**: Agents have access to multiple Model Context Protocol (MCP) servers:
  - **GitHub MCP** - Repository operations (issues, PRs, code search, commits)
  - **Playwright MCP** - Browser automation for web-based monitoring and testing
- **Screeps integration**: Direct Screeps API access via `scripts/fetch-screeps-stats.mjs` (fetches user stats from `/api/user/stats`)

## Knowledge Base

### Core Documentation

All agents should reference these documents before making changes:

1. **Root Documentation**
   - [`README.md`](README.md) - Main repository overview, prerequisites, automation summary, and workflow descriptions
   - [`DOCS.md`](DOCS.md) - Developer guide with onboarding walkthrough and Screeps learning resources
   - [`CHANGELOG.md`](CHANGELOG.md) - Release history and unreleased changes
   - [`TASKS.md`](TASKS.md) - Active, in-progress, and recently completed tasks
   - [`AGENTS.md`](AGENTS.md) - This file; agent rules and knowledge base

2. **Structured Knowledge Base (`packages/docs/source/docs/`)**
   - **CRITICAL**: All new documentation MUST be created in `packages/docs/source/docs/`, NOT in root `docs/`
   - [`packages/docs/source/docs/index.md`](packages/docs/source/docs/index.md) - Documentation hub with quick start and documentation rules
   - [`packages/docs/source/docs/automation/overview.md`](packages/docs/source/docs/automation/overview.md) - Detailed workflow specifications and local validation
   - [`packages/docs/source/docs/operations/stats-monitoring.md`](packages/docs/source/docs/operations/stats-monitoring.md) - PTR monitoring pipeline and Copilot analysis
   - [`packages/docs/source/docs/operations/respawn-handling.md`](packages/docs/source/docs/operations/respawn-handling.md) - Automatic respawn detection and handling
   - [`packages/docs/source/docs/changelog/versions.md`](packages/docs/source/docs/changelog/versions.md) - Generated release history (do not edit manually)
   - **Note**: Root `docs/` contains legacy documentation being migrated out

3. **Strategic Documentation (`docs/strategy/`)**
   - [`docs/strategy/roadmap.md`](docs/strategy/roadmap.md) - Current phase status, success metrics, and strategic priorities
   - [`docs/strategy/phases/`](docs/strategy/phases/) - Phase-specific documentation (Phase 1-5)
   - [`docs/strategy/learning/`](docs/strategy/learning/) - Documented patterns and lessons learned
   - [`docs/strategy/decisions/`](docs/strategy/decisions/) - Architectural Decision Records (ADRs)

4. **Workflow Configuration**
   - `.github/workflows/*.yml` - GitHub Actions workflow definitions
   - `.github/copilot/prompts/*` - Prompt templates for Copilot automation
   - `.github/actions/copilot-exec/action.yml` - Shared Copilot CLI execution action
   - `.github/labels.yml` - Repository label definitions

### Runtime Architecture

Agents working on runtime code should understand:

- `src/runtime/bootstrap/` - Kernel orchestration and system wiring
- `src/runtime/behavior/` - Creep roles and spawn logic
- `src/runtime/memory/` - Memory consistency helpers
- `src/runtime/metrics/` - CPU tracking and performance accounting
- `src/runtime/respawn/` - Automatic respawn detection
- `src/runtime/evaluation/` - Health reports and improvement recommendations
- `src/shared/` - Shared contracts and types
- `scripts/` - Build, deploy, and automation scripts
- `tests/` - Unit, e2e, regression, and mockup test suites
- `reports/` - Persistent analysis artifacts

## Operational Rules

### 1. Tooling

- Use yarn for running scripts (`yarn <script>`). Package scripts are defined in `package.json`.
- Format code with `yarn format:write` and verify with `yarn format:check`.
- Lint TypeScript code with `yarn lint` (use `lint:fix` for automatic fixes).
- All tests are managed by Vitest. Run the relevant suites (`test:unit`, `test:e2e`, `test:regression`, `test:coverage`) before publishing changes.
- Build with `yarn build` (uses esbuild to create `dist/main.js`).
- System evaluation with `yarn analyze:system` produces `reports/system-evaluation.json`.

### 2. Coding Standards

- TypeScript must compile with the strict settings defined in `tsconfig.json`. Avoid using `any` unless there is no alternative and document why.
- Prefer small, testable modules. Share contracts through `src/shared/` rather than duplicating types.
- Add TSDoc blocks for exported classes and functions when behaviour is non-trivial.
- Keep runtime code deterministic; guard use of `Math.random()` behind helper utilities if predictable output matters for tests.
- Node.js 18.x–22.x is the supported runtime window (see `.nvmrc` for the default Node 20 toolchain).

**Feature Enablement Policy:**

- **All new features and capabilities must be enabled by default** from the point of implementation.
- Features should be opt-out rather than opt-in (e.g., `FEATURE_ENABLED=false` to disable, not `FEATURE_ENABLED=true` to enable).
- This ensures continuous monitoring, testing, and immediate value delivery without manual activation.
- Only disable features when there is a documented performance or compatibility concern.
- Example: The profiler is enabled by default (`__PROFILER_ENABLED__` defaults to `true`). Use `PROFILER_ENABLED=false` or `yarn build:no-profiler` to explicitly disable.

**Deprecation and Obsolescence Policy:**

- **Obsolete or deprecated code is removed immediately** - no grace period, no backwards compatibility concerns.
- Code only needs to work with the current version of itself, not with any previous versions.
- When a better implementation exists, the old one is deleted entirely, not marked as deprecated.
- Feature flags or dual code paths for backwards compatibility are NOT permitted.
- If code is identified as obsolete (e.g., BehaviorController when RoleControllerManager exists), delete it immediately.
- This policy ensures:
  - Clean, maintainable codebase without legacy cruft
  - No confusion about which code path is active
  - Faster development without compatibility constraints
  - Reduced cognitive load when reading and maintaining code

### 3. Documentation Discipline

**Update triggers:**

- Update `README.md` when user-facing behaviour, workflows, or automation steps change.
- **CRITICAL**: Keep `packages/docs/source/docs/` in sync with any workflow, runtime, or operational changes - NOT root `docs/`
- Document bug investigations and incident learnings in `packages/docs/source/docs/operations/` before merging fixes.
- Maintain `TASKS.md` by adding new tasks and marking completed items with a completion note instead of removing them immediately.

**Changelog requirements:**

- Update the `[Unreleased]` section of `CHANGELOG.md` with every pull request.
- Run `yarn versions:update` after editing `CHANGELOG.md` to refresh `packages/docs/source/docs/changelog/versions.{json,md}`.
- Regenerate the documentation site with `yarn build:docs-site` when previewing changes.

**Cross-references:**

- Link new documents from `README.md`, `DOCS.md`, or `packages/docs/source/docs/index.md` for discoverability.
- Reference related files at the end of operational documents.
- Ensure agents can navigate from any documentation entry point to relevant information.

**Documentation Location Rules (MANDATORY):**

- ✅ **ALWAYS** create new documentation in `packages/docs/source/docs/`
- ✅ Structure: `packages/docs/source/docs/{category}/{filename}.md`
- ✅ Categories: `automation/`, `operations/`, `runtime/`, `changelog/`, `security/`, `analytics/`
- ❌ **NEVER** create documentation in root `docs/` (legacy location being phased out)
- ❌ **NEVER** create documentation in `packages/docs/docs/` (generated output)

### 4. Workflow Guidelines

- Any change to `.github/workflows/` must keep the automation promises described in `README.md` and `packages/docs/source/docs/automation/overview.md`.
- Follow [Graphite's GitHub Actions permissions guidance](https://graphite.dev/guides/github-actions-permissions) to ensure least-privilege scopes.
- Secrets referenced by workflows must be documented in `README.md` under the automation section.
- Use the GitHub Copilot CLI via the shared `copilot-exec` composite action and template prompts in `.github/copilot/prompts/`.

### 5. MCP Server Integration

Agents have access to Model Context Protocol (MCP) servers that extend their capabilities:

**Available MCP Servers:**

1. **GitHub MCP Server** (default, always enabled)
   - Repository operations: create/update issues and PRs
   - Code search: find files, symbols, and content across repositories
   - Commit inspection: review diffs and history
   - Configuration: Built into `copilot-exec` action

2. **Playwright MCP Server** ([executeautomation/playwright-mcp-server](https://github.com/executeautomation/playwright-mcp-server))
   - Browser automation for web-based monitoring
   - Page navigation and interaction
   - Screenshot capture
   - Element inspection and validation
   - Configuration: `.github/mcp/playwright.json`
   - Use cases: Web UI testing, visual regression checks, automated form filling

**Using MCP Servers in Workflows:**

To enable additional MCP servers in a workflow, use the `additional-mcp-config` parameter:

```yaml
- uses: ./.github/actions/copilot-exec
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    prompt-path: .github/copilot/prompts/my-prompt
    additional-mcp-config: "@.github/mcp/playwright.json"
```

The configuration files in `.github/mcp/` define MCP server commands and environment variables. The `copilot-exec` action automatically merges these with the base GitHub MCP configuration.

**Best Practices:**

- Reference MCP server capabilities in prompt templates so agents know what tools are available
- Use environment variables for credentials, never hardcode secrets in MCP configuration files
- Test MCP integrations locally when possible before deploying to workflows
- Document new MCP use cases in workflow-specific documentation

**Key Workflows:**

1. **Quality Guards** (guard-\*.yml) - Focused PR validation workflows (lint, format, YAML lint, version check, build, unit tests, e2e tests, regression tests, coverage)
2. **post-merge-release.yml** - Auto-versioning and tagging on merge to main (triggers deploy and blog workflows on completion)
3. **deploy.yml** - Screeps deployment triggered by post-merge-release completion or version tags
4. **copilot-changelog-to-blog.yml** - Blog post generation triggered by post-merge-release completion or version tags
5. **copilot-review.yml** - Scheduled repository audits
6. **copilot-issue-triage.yml** - Automatic issue reformulation
7. **copilot-todo-pr.yml** - Automated Todo issue resolution
8. **copilot-email-triage.yml** - Email-to-issue conversion
9. **copilot-ci-autofix.yml** - Automated CI failure resolution
10. **screeps-monitoring.yml** - Comprehensive monitoring combining strategic analysis with PTR telemetry (uses `scripts/fetch-screeps-stats.mjs`)
11. **dependabot-automerge.yml** - Auto-merge non-major updates
12. **label-sync.yml** - Repository label synchronization
13. **docs-pages.yml** - GitHub Pages documentation site

**Workflow Dependencies:**

- **post-merge-release.yml** → **deploy.yml** (via workflow_run trigger)
- **post-merge-release.yml** → **copilot-changelog-to-blog.yml** (via workflow_run trigger)
- Deploy and blog workflows only execute when post-merge-release completes successfully
- Tag push events (v\*) are maintained as backup triggers for manual deployments

### 6. Testing Artifacts

- Place long-lived automation or evaluation reports in the `reports/` directory.
- Coverage information consumed by scripts must remain compatible with `scripts/evaluate-system.ts`.
- Run `yarn test:actions` to dry-run workflows locally with the `act` CLI.

### 7. Regression Discipline

**Bug fix protocol:**

1. **Capture first**: Add or update a regression test demonstrating the bug before implementing a fix.
2. **Document**: Record the root cause, regression test name, and remediation in `packages/docs/source/docs/operations/`.
3. **Update changelog**: Add to `CHANGELOG.md` `[Unreleased]` section and run `yarn versions:update`.
4. **Reference**: Link the regression test in both documentation and changelog.

## Guardrails and Best Practices

### Security

- Never commit secrets or credentials to source code.
- Reference secrets via GitHub Actions secrets documented in `README.md`.
- Validate that dependency updates don't introduce vulnerabilities.
- Follow least-privilege principles for workflow permissions.

### Quality Gates

Before merging changes:

1. Run `yarn format:write` to format code
2. Run `yarn lint` to check code style
3. Run `yarn test:unit` for unit tests
4. Run `yarn test:e2e` for end-to-end tests (PTR profile)
5. Run `yarn test:regression` for regression tests
6. Run `yarn test:coverage` to verify coverage
7. Run `yarn analyze:system` to check system evaluation

### Labels

Repository labels are synchronized from `.github/labels.yml` using a standardized three-tier system:

**Process Labels:**

- `Todo` - Triggers Copilot Todo automation
- `monitoring` - Created by stats monitor for PTR anomalies
- `needs/regression-test` - Apply when bug report lacks coverage

**State Labels:** `state/pending`, `state/backlog`, `state/in-progress`, `state/blocked`, `state/canceled`, `state/done`

**Type Labels:** `type/bug`, `type/feature`, `type/enhancement`, `type/chore`, `type/question`

**Priority Labels:** `priority/critical`, `priority/high`, `priority/medium`, `priority/low`, `priority/none`

**Domain Labels:** `automation`, `documentation`, `runtime`, `monitoring`, `dependencies`, `regression`

**Workflow Labels:** `good-first-issue`, `help-wanted`, `wontfix`, `duplicate`, `invalid`

Do not edit labels manually in the UI—update the YAML file instead.

### Issue and PR Management

- Issues labelled `Todo` trigger automated resolution via `copilot-todo-pr.yml`.
- New issues are automatically triaged and reformulated by `copilot-issue-triage.yml`.
- CI failures trigger automatic issue creation via `ci-auto-issue.yml` for tracking and manual review.
- Dependabot PRs are auto-merged for non-major updates after checks pass.

### PTR Monitoring

- Data collection performed every 30 minutes via `screeps-monitoring.yml`.
- Collects bot snapshots, PTR stats, telemetry, and profiler data.
- Pure data pipeline focused on collecting and storing bot performance data.
- PTR anomalies can be detected by separate analysis workflows.
- Use `SCREEPS_STATS_TOKEN` or fallback to `SCREEPS_TOKEN`.

## Required Secrets

Configure these GitHub Actions secrets:

| Secret                           | Used by                | Description                                         |
| -------------------------------- | ---------------------- | --------------------------------------------------- |
| `SCREEPS_TOKEN`                  | Deploy workflow        | Screeps authentication token                        |
| `SCREEPS_HOST` (optional)        | Deploy workflow        | Hostname for Screeps server (default `screeps.com`) |
| `SCREEPS_PORT` (optional)        | Deploy workflow        | Port for Screeps server (default `443`)             |
| `SCREEPS_PROTOCOL` (optional)    | Deploy workflow        | Protocol (`https` by default)                       |
| `SCREEPS_BRANCH` (optional)      | Deploy workflow        | Destination Screeps branch (default `main`)         |
| `SCREEPS_STATS_TOKEN` (optional) | Stats monitor workflow | Token for stats API (falls back to `SCREEPS_TOKEN`) |

All workflows rely on the default `GITHUB_TOKEN` for repository operations.

## Agent Onboarding Checklist

When a new agent or contributor starts work:

1. ✓ Read this `AGENTS.md` file completely
2. ✓ Review [`README.md`](README.md) for repository overview
3. ✓ Study [`DOCS.md`](DOCS.md) for developer resources
4. ✓ Browse [`docs/`](docs/) knowledge base, especially `packages/docs/source/docs/automation/overview.md`
5. ✓ Review [`TASKS.md`](TASKS.md) for current priorities
6. ✓ Check [`CHANGELOG.md`](CHANGELOG.md) for recent changes
7. ✓ Run `yarn install && yarn lint && yarn test:unit` to verify environment
8. ✓ Understand workflow permissions in `.github/workflows/`
9. ✓ Review prompt templates in `.github/copilot/prompts/`
10. ✓ Familiarize with label definitions in `.github/labels.yml`

## Additional Resources

### Screeps Documentation

- [Game Guide](https://docs.screeps.com/index.html)
- [API Reference](https://docs.screeps.com/api/)
- [Screeps TypeScript Starter Guide](https://screepers.gitbook.io/screeps-typescript-starter/)

### Type Definitions and Tooling

- [`@types/screeps`](https://www.npmjs.com/package/@types/screeps)
- [`screeps-api`](https://www.npmjs.com/package/screeps-api)
- [`screeps-profiler`](https://www.npmjs.com/package/screeps-profiler)

### Architecture Inspiration

- [Screeps Quorum](https://github.com/ScreepsQuorum/screeps-quorum) - Large-scale automation patterns

---

More specific instructions may be defined by nested `AGENTS.md` files within subdirectories. When in doubt, refer to this document and the linked knowledge base for guidance.
