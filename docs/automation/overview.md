# Automation Overview

This document expands on the workflows under `.github/workflows/` and how they combine with the Copilot CLI.

## Copilot Model Configuration

All Copilot workflows use the `copilot-exec` composite action (`.github/actions/copilot-exec/action.yml`), which provides centralized model selection with a flexible fallback chain.

### Performance Optimizations

The `copilot-exec` action includes several performance optimizations to reduce workflow execution time:

1. **Conditional Repository Checkout**: Automatically detects if the repository is already checked out and skips the checkout step when not needed
2. **npm Global Cache**: Caches the `@github/copilot` CLI installation with stable cache keys to avoid repeated downloads
3. **Project Dependency Cache**: Caches `node_modules` based on `package-lock.json` hash for faster dependency resolution
4. **Result Caching**: Caches Copilot CLI output based on prompt SHA and model to avoid redundant AI calls for identical inputs
5. **Timing Measurements**: Provides detailed execution timing in verbose mode for performance monitoring

These optimizations significantly reduce workflow execution time, particularly for workflows that run frequently like issue triage and CI autofix.

### Workflow Caching Strategy

All primary workflows implement multi-layer caching to minimize execution time and GitHub Actions minutes consumption:

1. **Node.js 16 Installation Cache**: The `setup-node16` action caches Node.js binaries based on OS, architecture, and version, avoiding repeated downloads (saves ~30-60s per workflow run)

2. **Python 2 Installation Cache**: The `setup-python2` action caches Python binaries and ccache with stable cache keys, eliminating repeated builds (saves ~60-120s per workflow run)

3. **npm Dependency Cache**: All workflows cache `node_modules` and `~/.npm` based on `package-lock.json` hash with restore keys for partial matches (saves ~30-45s per workflow run)

4. **Build Output Cache**: Quality-gate and deploy workflows cache the `dist/` folder based on source file hashes, avoiding redundant builds (saves ~5-10s per workflow run)

**Expected Performance Impact:**

- Quality gate runtime: ~90 seconds with cache hits (50% improvement from ~2-3 minutes)
- Deploy workflow runtime: ~45 seconds with cache hits (60% improvement from ~1-2 minutes)
- Cache hit ratio: Expected >80% for stable codebases
- Overall workflow minutes reduction: 50%+ for active repositories

**Cache Key Strategy:**

- Stable versioned keys (e.g., `v2`) for environment setups to maximize cache hits across workflow updates
- Content-based keys (e.g., `hashFiles('src/**/*')`) for build outputs to ensure correctness
- Restore keys with prefixes for graceful fallback when exact matches fail

### Model Resolution Priority

The model is resolved in the following order:

1. **Workflow input parameter** – Explicit `model:` parameter passed to `copilot-exec`
2. **`COPILOT_MODEL` environment variable** – Can be set at workflow, job, or step level
3. **Copilot CLI default** – If no model is specified, the Copilot CLI uses its own default model

### Override Examples

**Repository-wide override** using GitHub Actions variables:

1. Navigate to repository Settings → Secrets and variables → Actions → Variables
2. Create a new variable `COPILOT_MODEL` with value `gpt-4o`
3. Reference in workflows: `COPILOT_MODEL: ${{ vars.COPILOT_MODEL }}`

**Workflow-specific override**:

```yaml
- name: Run Copilot with specific model
  uses: ./.github/actions/copilot-exec
  with:
    model: "gpt-4o"
    prompt-path: .github/copilot/prompts/custom-prompt
```

**Environment variable override**:

```yaml
env:
  COPILOT_MODEL: "gpt-4o"
```

### Logging and Validation

The `copilot-exec` action logs the selected model at runtime. Enable verbose mode to see the full resolution chain:

```yaml
with:
  verbose: "true"
```

This will output:

- Which configuration source was used (input, env var, config file, or default)
- The final selected model
- Cache key information

## Quality Guards

Quality checks are split into separate guard workflows for better granularity and parallel execution:

### Guard - Lint (`guard-lint.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: ESLint code quality checks.

### Guard - Format (`guard-format.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Prettier formatting validation.

### Guard - YAML Lint (`guard-yaml-lint.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: YAML workflow file linting.

### Guard - Version Index (`guard-version.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Verification that `docs/changelog/versions.json` and `docs/changelog/versions.md` match `npm run versions:update`.

### Guard - Build (`guard-build.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Build validation with caching.

### Guard - Unit Tests (`guard-test-unit.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Unit test execution.

### Guard - E2E Tests (`guard-test-e2e.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: PTR end-to-end tests.
- Notes: Configure PTR secrets locally before running the e2e suite.

### Guard - Regression Tests (`guard-test-regression.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Regression test validation.
- Notes: Failures here must be reproduced with a regression test before applying fixes (see repository rules in [README](../../README.md)).

### Guard - Coverage (`guard-coverage.yml`)

- Trigger: Pull requests targeting `main`.
- Permissions: `contents: read` only.
- Jobs: Test coverage reporting and evaluation artifact upload.

## Quality Gate (`quality-gate.yml`)

**Deprecated:** The monolithic quality-gate workflow has been split into multiple focused guard workflows (guard-lint, guard-format, etc.) for better granularity and parallel execution. This workflow is kept for backward compatibility but may be removed in a future version.

## Post Merge Release (`post-merge-release.yml`)

- Trigger: Pushes to `main` (excludes release commits to prevent recursion).
- Behaviour: Applies lint/format fixes, uses semantic versioning based on conventional commits to determine version bump type (major/minor/patch), commits version bump directly to main, creates a version tag, and creates a GitHub Release using the native API with auto-generated release notes.
- Semantic Versioning: Analyzes commits since the last version tag using conventional commit format:
  - `feat:` commits trigger **minor** version bumps (0.1.0 → 0.2.0)
  - `fix:`, `chore:`, `docs:` trigger **patch** version bumps (0.1.0 → 0.1.1)
  - `BREAKING CHANGE:` in commit body or `!` after type triggers **major** version bumps (1.0.0 → 2.0.0)
  - Note: During pre-1.0 development, major bumps are converted to minor bumps per semver specification
- Secrets: Uses the default `GITHUB_TOKEN` with elevated `contents: write` and `pull-requests: write` permissions.
- Notes: Skips execution when commit message contains "chore(release):" to prevent recursive workflow runs. No longer creates release PRs - releases are created automatically.

## Deploy (`deploy.yml`)

- Trigger: Tags that match `v*` OR GitHub Release published events.
- Behaviour: Builds and pushes code to the Screeps API. Uses GitHub's `production` environment for deployment protection rules and approval workflows. Set `SCREEPS_DEPLOY_DRY_RUN=true` for local `act` dry-runs to skip the API call. Sends push notifications on deployment success (Priority 3) and failure (Priority 5) via Push by Techulus.
- Environment: Uses GitHub environment `production` with URL `https://screeps.com` for deployment tracking and protection rules.
- Push Notifications: Sent for all deployment outcomes with workflow run links. See [Push Notifications Guide](push-notifications.md) for details.
- Secrets: `SCREEPS_TOKEN` (required), `SCREEPS_HOST`/`PORT`/`PROTOCOL`/`BRANCH` (optional overrides). `PUSH_TOKEN` (optional) for deployment alerts.
- Notes: Deployment is triggered automatically when releases are published, leveraging GitHub's native CI/CD features.

## Copilot Repository Review (`copilot-review.yml`)

- Trigger: Daily schedule + manual dispatch.
- Behaviour: Copilot authenticates with `gh`, clones the repo, audits automation/runtime quality, files or updates GitHub issues directly, and prints a JSON recap to the logs.
- Output: Summary is logged instead of uploading an artifact.
- Action Enforcement: Mandatory comprehensive audit with actionable finding criteria, issue quality validation, duplicate prevention, and severity assessment guidelines.

## Documentation Pages (`docs-pages.yml`)

- Trigger: Pushes to `main`, published releases, and manual dispatches.
- Behaviour: Executes `npm run versions:update` and `npm run build:docs-site`, then publishes `build/docs-site` to GitHub Pages.
- Permissions: Requires `pages: write` and `id-token: write`.

## Copilot Issue Triage (`copilot-issue-triage.yml`)

- Trigger: Issues opened or reopened.
- Behaviour: Copilot performs comprehensive context-aware triage by:
  - Fetching all existing open issues for duplicate detection and relationship analysis
  - Detecting and handling duplicate issues automatically (comments on both issues, closes duplicate with "duplicate" reason)
  - Identifying related issues, sub-tasks, and parent-child relationships
  - Reformulating title and description to clearly outline required changes and expectations
  - Applying appropriate labels based on content analysis (**excludes automatic Todo labeling** per issue #78)
  - Linking related issues in the reformulated description
  - Establishing sub-issue connections via GitHub CLI when parent-child relationships are detected
  - Adding a single triage comment with summary and recommendations (avoids redundant comments)
- Permissions: Uses the default `GITHUB_TOKEN` with `issues: write` to edit issue metadata, add comments, and close duplicates.
- Integration: Uses GitHub MCP server for querying all issues and performing relationship analysis.
- Action Enforcement: Mandatory reformulation, labeling, and triage comments with failure handling for API issues.

## Copilot Todo Automation (`copilot-todo-pr.yml`)

- Trigger: Issues labelled `Todo`.
- Behaviour: Copilot performs context-aware implementation by:
  - Checking for related issues, sub-tasks, and dependencies via GitHub MCP server
  - Verifying all dependent sub-tasks are completed before proceeding (blocks execution if incomplete)
  - Cloning the repository and creating a `copilot/todo-*` branch
  - **Creating a draft pull request immediately** for transparency and user visibility
  - Implementing the fix incrementally with frequent progress updates using the `report_progress` tool
  - Showing which files are being modified and why through commit messages and PR description updates
  - Running npm checks (`npm run lint`, `npm run test:unit`, etc.) and reporting results
  - Considering any related issues mentioned in the issue body during implementation
  - Mentioning related issues in the PR description when applicable
  - **Marking the PR as ready for review** once all changes are validated
  - Commenting back on the triggering issue with the draft PR link
  - Noting if the issue is a parent with sub-tasks that may need updates
- Permissions: Uses the default `GITHUB_TOKEN` for `gh` pushes, PR creation, issue comments, and PR status updates.
- Integration: Uses GitHub MCP server for dependency and relationship analysis.
- Visibility: Users can follow along with the implementation process in real-time through the draft PR and commit history.
- Action Enforcement: Mandatory dependency validation, PR creation, progress reporting, and validation testing with comprehensive failure handling.

## Copilot Daily Todo Prioritization (`copilot-todo-daily.yml`)

- Trigger: Daily schedule (9:00 AM UTC) + manual dispatch.
- Behaviour: Copilot automatically identifies the oldest actionable issue (no incomplete sub-tasks) without the Todo label, applies the Todo label to trigger automated implementation, and adds a comment explaining the prioritization. Uses GitHub MCP server to query issues and analyze dependencies.
- Permissions: Uses the default `GITHUB_TOKEN` with `issues: write` for label management.
- Concurrency: Single execution at a time via `copilot-todo-daily` concurrency group.
- Action Enforcement: Mandatory actionability validation with explicit criteria, comprehensive dependency analysis, and professional explanatory comments for all label assignments.

## Copilot Email Triage (`copilot-email-triage.yml`)

- Trigger: `repository_dispatch` events with `event_type` set to `copilot_email_triage`.
- Behaviour: Copilot reviews the email payload, files any required GitHub issues directly with `gh`, and records a concise summary in the logs.
- Notes: External webhook callers must include the email payload under `client_payload.email`.
- Action Enforcement: Mandatory email content validation, actionable item criteria, and high-quality issue creation with proper structure and labeling.

## Dependabot Auto Merge (`dependabot-automerge.yml`)

- Trigger: Dependabot pull request updates.
- Behaviour: Automatically enables auto-merge (squash) for non-major updates when checks pass.

## Screeps Stats Monitor (`screeps-stats-monitor.yml`)

- Trigger: Every 30 minutes + manual dispatch.
- Behaviour: Copilot uses the `scripts/fetch-screeps-stats.mjs` Node.js script to fetch telemetry from Screeps API, analyse anomalies, and open/update monitoring issues through `gh` with severity labels. After analysis, `scripts/check-ptr-alerts.ts` examines the stats for critical conditions and sends push notifications for high CPU usage (>80%), critical CPU (>95%), and low energy reserves.
- Data Collection: Uses the native Screeps REST API endpoint `/api/user/stats` via the fetch script.
- Push Notifications: Automatically sent for critical and high severity alerts via Push by Techulus (requires `PUSH_TOKEN` secret). See [Push Notifications Guide](push-notifications.md) for details.
- Secrets: `SCREEPS_TOKEN` (required), `SCREEPS_STATS_TOKEN`, `SCREEPS_EMAIL`, `SCREEPS_PASSWORD` (optional alternatives), plus optional host/port/protocol overrides. `PUSH_TOKEN` (optional) for real-time alerts.
- Action Enforcement: Mandatory telemetry validation, explicit anomaly detection criteria with severity thresholds, and concrete evidence requirements for all monitoring issues.

## Label Sync (`label-sync.yml`)

- Trigger: Manual dispatch or pushes to `main`.
- Behaviour: Ensures the repository's labels match `.github/labels.yml`.

## Copilot CI AutoFix (`copilot-ci-autofix.yml`)

- Trigger: Failed runs of any workflow except `Copilot CI AutoFix` itself (to prevent infinite loops).
- Behaviour: Copilot downloads the failing logs, analyzes the workflow context (PR vs non-PR trigger), clones the affected branch, applies the fix with changelog/docs/tests updates, and pushes the result based on context-aware decision logic.
- Context Awareness: The workflow passes `TRIGGER_EVENT` and event payload to enable intelligent decision-making about fix application strategy.
- Fix Application Strategy:
  - **PR-triggered failures**: Commits directly to the PR branch for fast iteration
  - **Main branch failures**: Creates new PR (`copilot/autofix-{run_id}`) to avoid direct commits to protected branches
  - **Feature branch failures**: Commits directly to the feature branch
  - **Scheduled/manual triggers**: Creates new PR for review and validation
- Branch Protection: Never pushes directly to `main` or production branches - always creates a PR to maintain audit trail and review process.
- Action Enforcement: Mandatory root cause analysis, minimal targeted fixes with validation, explicit criteria for fix appropriateness, and comprehensive failure handling for complex issues.

Keep this file accurate—workflows load these expectations via the Copilot CLI when planning fixes.

---

## Enhanced Prompt Template Patterns

As of issue #127, all Copilot prompt templates follow enhanced patterns with explicit action enforcement rules and output validation requirements.

### Action Enforcement Framework

All prompts include mandatory action requirements that must be completed for successful workflow execution:

```markdown
## MANDATORY ACTIONS (failure to complete any item is a workflow failure)

- [ ] **MUST authenticate GitHub CLI** with provided token and verify permissions
- [ ] **MUST validate input parameters** before proceeding with operations
- [ ] **MUST create/update specified outputs** with required format and quality
- [ ] **MUST validate outputs** meet quality requirements before completion
```

### Output Quality Requirements

All generated content must meet explicit quality standards:

- **Actionable Content**: All issues, PRs, and comments must include specific next steps
- **Professional Language**: All generated text must be concise and professional
- **Concrete Evidence**: All findings must reference specific files, metrics, or reproduction steps
- **Proper Structure**: All outputs must follow repository conventions and formatting standards

### Failure Handling Patterns

All prompts include comprehensive failure handling for common scenarios:

- **API Failures**: GitHub/Screeps API unavailability with graceful degradation
- **Missing Data**: Input validation with clear error messages and exit conditions
- **Complex Issues**: Escalation to manual review when automatic handling is inappropriate
- **Timeout Conditions**: Resource limits and progress preservation for long operations

### Validation and Quality Gates

Pre-execution validation ensures all required resources are available:

- Environment variables and tokens are present and valid
- Required permissions are verified before operations begin
- Input data meets expected format and quality requirements

Post-execution validation confirms successful completion:

- All mandatory actions completed successfully
- Generated outputs exist and are accessible
- Content quality meets established standards

### Prompt Template Naming

Standardized naming conventions for clarity:

- `issue-triage` - GitHub issue triage and reformulation
- `todo-automation` - Automated issue implementation (renamed from `todo-issue`)
- `ci-autofix` - Continuous integration failure remediation
- `repository-review` - Comprehensive repository auditing (renamed from `repository-audit`)
- `email-triage` - Email to GitHub issue conversion
- `stats-analysis` - Screeps telemetry monitoring and anomaly detection
- `todo-daily-prioritization` - Automated Todo label assignment

### Action Appropriateness Criteria

Each prompt includes explicit criteria for when automatic actions are appropriate versus when manual intervention is required. This prevents inappropriate automation and ensures quality outcomes.

For example, CI autofix only attempts repairs for:

- ✅ Linting/formatting violations
- ✅ Simple compilation errors
- ✅ Broken tests due to trivial changes

But creates issues for manual review when encountering:

- ❌ Complex logic errors requiring design decisions
- ❌ Security vulnerabilities needing careful review
- ❌ Breaking changes affecting public APIs

---

## MCP Server Integration

The `copilot-exec` composite action supports Model Context Protocol (MCP) servers that extend Copilot's capabilities beyond the standard GitHub operations.

### Available MCP Servers

1. **GitHub MCP** (default) - Repository operations, code search, commit inspection
2. **Playwright MCP** - Browser automation for web-based monitoring and testing

### Configuration

MCP server configurations are stored in `.github/mcp/` as JSON files defining server commands and environment variables:

- `.github/mcp/playwright.json` - Playwright server configuration

### Usage in Workflows

Enable additional MCP servers by passing the configuration file path to the `additional-mcp-config` parameter:

```yaml
- uses: ./.github/actions/copilot-exec
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    prompt-path: .github/copilot/prompts/my-prompt
    additional-mcp-config: "@.github/mcp/playwright.json"
```

The action automatically merges the additional MCP configuration with the base GitHub MCP server configuration.

### Authentication

MCP servers requiring authentication use environment variables passed through the workflow:

- **Screeps API**: `SCREEPS_TOKEN`, `SCREEPS_EMAIL`, `SCREEPS_PASSWORD`, plus optional `SCREEPS_HOST`, `SCREEPS_PORT`, `SCREEPS_PROTOCOL`
- **Playwright**: No authentication required (uses headless browser)

All credentials must be stored as GitHub Actions secrets and referenced in workflow `env` sections. Never hardcode credentials in MCP configuration files.

### Current Integrations

- **screeps-stats-monitor.yml**: Uses the `scripts/fetch-screeps-stats.mjs` script to fetch telemetry from the Screeps REST API

See `AGENTS.md` for detailed MCP server capabilities and best practices.

---

## Spec-Driven Development Integration

The repository integrates [GitHub spec-kit](https://github.com/github/spec-kit) to enable specification-driven development workflows alongside existing Copilot CLI automation.

### What is Spec-Kit?

Spec-kit is GitHub's toolkit for Spec-Driven Development, where specifications become executable through AI-assisted implementation. Instead of vibe-coding features from scratch, spec-kit provides:

- **Structured specification creation** with templates and guardrails
- **Multi-step refinement** from requirements → plan → tasks → implementation
- **AI-native workflows** that integrate with GitHub Copilot and other coding assistants
- **Repeatable processes** for features, fixes, and refactoring

### Directory Structure

```
.specify/
├── README.md                   # Spec-kit usage guide
├── memory/
│   └── constitution.md         # Project principles and governance
├── scripts/
│   └── setup-prerequisites.sh  # Setup verification script
├── specs/                      # Feature specifications (one per feature)
│   └── XXX-feature-name/
│       ├── spec.md             # Functional requirements
│       ├── plan.md             # Technical implementation plan
│       └── tasks.md            # Task breakdown
└── templates/                  # Templates for specifications
    ├── spec-template.md        # Specification template
    ├── plan-template.md        # Implementation plan template
    └── tasks-template.md       # Task breakdown template
```

### Workflow Integration

Spec-kit integrates with existing automation:

1. **Copilot Todo PR** (`copilot-todo-pr.yml`):
   - Issues labeled `Todo` can reference spec-kit specifications
   - Implementation follows spec → plan → tasks workflow
   - Quality gates validate spec-kit generated code

2. **Copilot Exec Action** (`.github/actions/copilot-exec`):
   - Spec-kit prompts can be rendered through this action
   - MCP servers provide repository context
   - Result caching optimizes repeated operations

3. **Quality Guards** (`guard-*.yml`):
   - All spec-kit generated code passes through existing checks
   - Lint, format, test, and build validations apply
   - Documentation updates are validated

### Spec-Kit Slash Commands

When using AI assistants with spec-kit initialized, these commands are available:

| Command                 | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `/speckit.constitution` | Create or update project governing principles    |
| `/speckit.specify`      | Define feature requirements and user stories     |
| `/speckit.plan`         | Create technical implementation plans            |
| `/speckit.tasks`        | Generate actionable task lists                   |
| `/speckit.implement`    | Execute all tasks systematically                 |
| `/speckit.clarify`      | Structured clarification of underspecified areas |
| `/speckit.analyze`      | Cross-artifact consistency analysis              |

### Development Workflow

1. **Define Requirements** (`/speckit.specify`):

   ```
   /speckit.specify Build a new creep behavior that optimizes energy harvesting
   ```

   Creates `.specify/specs/XXX-feature-name/spec.md`

2. **Create Technical Plan** (`/speckit.plan`):

   ```
   /speckit.plan Use TypeScript strict mode, integrate with src/runtime/behavior/
   ```

   Generates `plan.md` with architecture and file structure

3. **Generate Tasks** (`/speckit.tasks`):

   ```
   /speckit.tasks
   ```

   Creates `tasks.md` with ordered, dependency-aware tasks

4. **Implement** (`/speckit.implement`):
   ```
   /speckit.implement
   ```
   Executes tasks, runs tests, updates documentation

### Repository Constitution

The `.specify/memory/constitution.md` file defines foundational principles that guide all development:

- **Code Quality**: Strict TypeScript, minimal changes, test-driven development
- **Testing Standards**: Unit, integration, and regression test requirements
- **User Experience**: Deterministic runtime, clear error handling
- **Performance**: CPU efficiency, memory management, build optimization
- **Workflow**: Quality gates, incremental commits, security validation

All spec-kit operations reference these principles to ensure consistency with repository standards.

### Validation Workflow

The `spec-kit-validate.yml` workflow validates spec-kit structure:

- **Trigger**: Pull requests and pushes affecting `.specify/`
- **Checks**: Directory structure, required files, template integrity
- **Validation**: Constitution sections, template structure, script permissions
- **Permissions**: `contents: read` only

This ensures spec-kit infrastructure remains consistent and functional.

### Setup Instructions

See `.specify/README.md` for detailed setup and usage instructions, including:

- Prerequisites (Python 3.11+, uv, spec-kit CLI)
- Installation steps
- Workflow examples
- Troubleshooting guidance

### Benefits

Spec-kit enhances existing automation by:

1. **Structured Development**: Clear progression from idea → spec → code
2. **Quality Assurance**: Built-in review checklists and validation
3. **Documentation**: Specifications serve as living documentation
4. **Reusability**: Templates ensure consistent approach across features
5. **AI Optimization**: Structured context improves AI-generated code quality

### Compatibility

Spec-kit is designed to **enhance, not replace** existing automation:

- Works alongside `copilot-exec` and Copilot CLI workflows
- Respects repository security and permission guidelines
- Integrates with existing quality gates and testing infrastructure
- Uses the same MCP server infrastructure
- Follows conventional commit format for versioning

---

### Local workflow validation

Run `npm run test:actions` to execute linting, formatting checks, and dry-run the key workflows (`quality-gate`, `post-merge-release`, `deploy`, `docs-pages`, `copilot-email-triage`) using the `act` CLI. Populate placeholder secrets in `tests/actions/secrets.env` before invoking the command.
