# Repository Agent Guidelines

This repository manages an autonomous Screeps AI and the automation surrounding it. This document serves as the centralized knowledge base and ruleset for GitHub Copilot and other automation agents operating within this repository.

## Agent Roles and Scope

### Primary Agents

1. **GitHub Copilot** - General-purpose code editing, issue triage, and repository maintenance
2. **Copilot Review** - Scheduled repository audits and quality assessments
3. **Copilot Todo Automation** - Automated issue resolution via draft pull requests with visible implementation progress
4. **Copilot Issue Triage** - Automatic issue reformulation and labeling
5. **Copilot Stats Monitor** - PTR telemetry analysis and anomaly detection
6. **Copilot CI AutoFix** - Automated fixing of CI failures
7. **Copilot Email Triage** - Email-to-issue conversion and triage

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

2. **Structured Knowledge Base (`docs/`)**
   - [`docs/index.md`](docs/index.md) - Documentation hub with quick start and documentation rules
   - [`docs/automation/overview.md`](docs/automation/overview.md) - Detailed workflow specifications and local validation
   - [`docs/operations/stats-monitoring.md`](docs/operations/stats-monitoring.md) - PTR monitoring pipeline and Copilot analysis
   - [`docs/operations/respawn-handling.md`](docs/operations/respawn-handling.md) - Automatic respawn detection and handling
   - [`docs/changelog/versions.md`](docs/changelog/versions.md) - Generated release history (do not edit manually)

3. **Workflow Configuration**
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

- Use bun for running scripts (`bun run <script>`). Package scripts are defined in `package.json`.
- Format code with `bun run format:write` and verify with `bun run format:check`.
- Lint TypeScript code with `bun run lint` (use `lint:fix` for automatic fixes).
- All tests are managed by Vitest. Run the relevant suites (`test:unit`, `test:e2e`, `test:regression`, `test:coverage`) before publishing changes.
- Build with `bun run build` (uses esbuild to create `dist/main.js`).
- System evaluation with `bun run analyze:system` produces `reports/system-evaluation.json`.

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
- Example: The profiler is enabled by default (`__PROFILER_ENABLED__` defaults to `true`). Use `PROFILER_ENABLED=false` or `bun run build:no-profiler` to explicitly disable.

### 3. Documentation Discipline

**Update triggers:**

- Update `README.md` when user-facing behaviour, workflows, or automation steps change.
- Keep `docs/` in sync with any workflow, runtime, or operational changes.
- Document bug investigations and incident learnings in `docs/operations/` before merging fixes.
- Maintain `TASKS.md` by adding new tasks and marking completed items with a completion note instead of removing them immediately.

**Changelog requirements:**

- Update the `[Unreleased]` section of `CHANGELOG.md` with every pull request.
- Run `bun run versions:update` after editing `CHANGELOG.md` to refresh `docs/changelog/versions.{json,md}`.
- Regenerate the documentation site with `bun run build:docs-site` when previewing changes.

**Cross-references:**

- Link new documents from `README.md`, `DOCS.md`, or `docs/index.md` for discoverability.
- Reference related files at the end of operational documents.
- Ensure agents can navigate from any documentation entry point to relevant information.

### 4. Workflow Guidelines

- Any change to `.github/workflows/` must keep the automation promises described in `README.md` and `docs/automation/overview.md`.
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
2. **post-merge-release.yml** - Auto-versioning and tagging on merge to main
3. **deploy.yml** - Screeps deployment on version tags
4. **copilot-review.yml** - Scheduled repository audits
5. **copilot-issue-triage.yml** - Automatic issue reformulation
6. **copilot-todo-pr.yml** - Automated Todo issue resolution
7. **copilot-email-triage.yml** - Email-to-issue conversion
8. **copilot-ci-autofix.yml** - Automated CI failure resolution
9. **screeps-monitoring.yml** - Comprehensive monitoring combining strategic analysis with PTR telemetry (uses `scripts/fetch-screeps-stats.mjs`)
10. **dependabot-automerge.yml** - Auto-merge non-major updates
11. **label-sync.yml** - Repository label synchronization
12. **docs-pages.yml** - GitHub Pages documentation site

### 6. Testing Artifacts

- Place long-lived automation or evaluation reports in the `reports/` directory.
- Coverage information consumed by scripts must remain compatible with `scripts/evaluate-system.ts`.
- Run `bun run test:actions` to dry-run workflows locally with the `act` CLI.

### 7. Regression Discipline

**Bug fix protocol:**

1. **Capture first**: Add or update a regression test demonstrating the bug before implementing a fix.
2. **Document**: Record the root cause, regression test name, and remediation in `docs/operations/`.
3. **Update changelog**: Add to `CHANGELOG.md` `[Unreleased]` section and run `bun run versions:update`.
4. **Reference**: Link the regression test in both documentation and changelog.

## Guardrails and Best Practices

### Security

- Never commit secrets or credentials to source code.
- Reference secrets via GitHub Actions secrets documented in `README.md`.
- Validate that dependency updates don't introduce vulnerabilities.
- Follow least-privilege principles for workflow permissions.

### Quality Gates

Before merging changes:

1. Run `bun run format:write` to format code
2. Run `bun run lint` to check code style
3. Run `bun run test:unit` for unit tests
4. Run `bun run test:e2e` for end-to-end tests (PTR profile)
5. Run `bun run test:regression` for regression tests
6. Run `bun run test:coverage` to verify coverage
7. Run `bun run analyze:system` to check system evaluation

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

Do not edit labels manually in the UI—update the YAML file instead. Legacy labels (`bug`, `enhancement`, `severity/*`) are deprecated but kept for backward compatibility.

### Issue and PR Management

- Issues labelled `Todo` trigger automated resolution via `copilot-todo-pr.yml`.
- New issues are automatically triaged and reformulated by `copilot-issue-triage.yml`.
- CI failures trigger automated fixes via `copilot-ci-autofix.yml`.
- Dependabot PRs are auto-merged for non-major updates after checks pass.

### PTR Monitoring

- Stats and strategic analysis performed every 30 minutes via `screeps-monitoring.yml`.
- Combines autonomous bot performance monitoring with PTR telemetry anomaly detection.
- PTR anomalies result in labelled issues with `monitoring`, `copilot`, `type/bug`, `state/pending`, and appropriate priority labels (prefixed with `PTR:`).
- Strategic findings result in issues prefixed with `[Autonomous Monitor]`.
- Duplicates are avoided by searching existing issues before filing new ones.
- Uses MCP servers (github, screeps-mcp, screeps-api) for comprehensive analysis.
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
4. ✓ Browse [`docs/`](docs/) knowledge base, especially `docs/automation/overview.md`
5. ✓ Review [`TASKS.md`](TASKS.md) for current priorities
6. ✓ Check [`CHANGELOG.md`](CHANGELOG.md) for recent changes
7. ✓ Run `bun install && bun run lint && bun run test:unit` to verify environment
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
