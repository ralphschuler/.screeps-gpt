# Changelog

All notable changes to this project are documented here. This changelog now maintains the full release history—update the
`[Unreleased]` section with your changes and run `npm run versions:update` to refresh the release index.

## [Unreleased]

### Added

- **Configurable Copilot model selection** (#146)
  - Removed hardcoded `gpt-5` default from copilot-exec action
  - Created centralized model configuration file (`.github/copilot/model-config.json`) with default `gpt-4.1`
  - Implemented priority-based model resolution: input parameter → COPILOT_MODEL env var → config file → hardcoded default
  - Added model validation and logging to copilot-exec composite action
  - Updated documentation (README.md, docs/automation/overview.md) with configuration examples
  - Supports repository-level and workflow-level model overrides via environment variables
  - Maintains backward compatibility with explicit model parameters in workflows

- **Copilot exec pre-checkout + dependency caching optimisation** (#101)
  - Added detection & conditional checkout to composite action (skips if .git present)
  - Implemented node_modules cache keyed by OS + package-lock.json hash with restore keys fallback
  - Added conditional npm ci install only on cache miss and when package.json exists
  - Added total duration metric step for performance tracking
  - Backward compatible: existing workflows need no changes

- **Standardized label system with state, type, and priority categories** (#138)
  - Implemented three-tier labeling system for improved issue and PR management
  - Added state labels: `state/pending`, `state/backlog`, `state/in-progress`, `state/blocked`, `state/canceled`, `state/done`
  - Added type labels: `type/bug`, `type/feature`, `type/enhancement`, `type/chore`, `type/question`
  - Added priority labels: `priority/critical`, `priority/high`, `priority/medium`, `priority/low`, `priority/none`
  - Added workflow labels: `good-first-issue`, `help-wanted`, `wontfix`, `duplicate`, `invalid`
  - Preserved existing domain labels (automation, runtime, documentation, monitoring, dependencies, regression)
  - Preserved process labels (Todo, monitoring, copilot, needs/regression-test)
  - Updated all issue templates to use new label structure
  - Updated all copilot prompts to use new labels (issue-triage, stats-analysis, repository-audit, ci-autofix, email-triage)
  - Updated documentation (README.md, AGENTS.md, copilot-instructions.md) with comprehensive label guidance
  - Created comprehensive label system guide at `docs/automation/label-system.md`
  - Maintained backward compatibility by keeping deprecated labels (bug, enhancement, severity/\*) marked as deprecated

### Changed

- **Modernized CI/CD deployment workflow to use standard GitHub DevOps practices** (#126)
  - Replaced manual release PR creation with automated semantic versioning based on conventional commits
  - Post-merge workflow now commits version bumps directly to main instead of creating release branches and PRs
  - Implemented semantic version bumping: `feat:` → minor, `fix:`/`chore:` → patch, `BREAKING CHANGE:` → major
  - GitHub Releases are now created automatically using GitHub's native API with auto-generated release notes
  - Deploy workflow now uses GitHub's `production` environment for deployment protection and tracking
  - Deploy workflow triggers on both version tags and GitHub Release published events
  - Removed `workflow_run` trigger complexity in favor of native release events
  - Added `version:bump-semantic` npm script and `scripts/bump-version-semantic.ts` for semantic versioning
  - Updated documentation in README.md and docs/automation/overview.md to reflect new CI/CD workflow

### Fixed

- Fixed vitest dependency conflict in Deploy Screeps AI workflow by upgrading @vitest/coverage-v8 from ^0.33.0 to ^3.2.4 for compatibility with vitest ^3.2.4 (workflow run: 18705052117)
- Fixed email triage workflow not creating issues by removing contradictory JSON formatting in prompt template (#115)
- Fixed CI failure in `npm run versions:update` by adding missing trailing newline to `docs/changelog/versions.md` (regression test: `tests/regression/versions-file-trailing-newline.test.ts`, workflow run: 18703566323)
- Fixed git push conflict in post-merge release workflow by adding remote ref updates before commit operations (regression test: `tests/regression/post-merge-workflow-git-race-condition.test.ts`, workflow run: 18703919715)
- **Fixed automatic Todo label assignment in issue triage** by removing Todo from automatic labeling per issue #78 to prevent unwanted automation triggers

### Added

- **Specialized PR templates for Copilot automation workflows** (#130)
  - Created `.github/PULL_REQUEST_TEMPLATE/copilot-todo.md` for Todo workflow PRs with automation-specific checklists
  - Created `.github/PULL_REQUEST_TEMPLATE/copilot-quickfix.md` for CI autofix PRs with validation-focused content
  - Templates reduce cognitive load by removing irrelevant manual checklist items
  - Improved reviewer guidance specific to Copilot-generated changes
  - Maintained quality standards while tailoring context to automated change types
  - Ready workflow integration (requires manual application due to workflow permission constraints)
- **Enhanced Copilot prompt templates with action enforcement rules** (#127)
  - Added mandatory action requirements with explicit "MUST" criteria for all workflows
  - Implemented comprehensive failure handling for GitHub API issues, missing data, and timeout conditions
  - Added explicit output quality requirements and validation criteria
  - Included actionable finding criteria and severity assessment guidelines
  - Added pre/post-execution validation steps for all automated operations
- **Standardized prompt template naming and structure**
  - Renamed `todo-issue` → `todo-automation` for consistency with workflow purpose
  - Renamed `repository-audit` → `repository-review` for clarity
  - Updated corresponding workflow files to reference new prompt paths
- **Enhanced action appropriateness criteria**
  - Added explicit guidelines for when automatic fixes are appropriate vs. manual intervention required
  - Implemented quality gates preventing inappropriate automation of complex issues
  - Added concrete thresholds and examples for anomaly detection and severity assessment
- **Comprehensive prompt template audit documentation** in `docs/automation/prompt-audit.md`
  - Detailed analysis of existing templates with strengths and gaps identified
  - Enhancement framework and recommendations for consistent action enforcement
  - Impact assessment and validation requirements for template changes

- Created `.github/copilot-instructions.md` with repository-specific guidelines for GitHub Copilot coding agent
- Includes coding standards, development workflow, testing expectations, and documentation requirements
- References comprehensive documentation in AGENTS.md, README.md, and docs/ for detailed guidance
- **Integrated Screeps API MCP server** with GitHub Copilot workflows for direct Screeps server interaction
- **Integrated Playwright MCP server** for browser automation capabilities
- Added MCP server configuration files: `.github/mcp/screeps-api.json` and `.github/mcp/playwright.json`
- Enhanced `copilot-exec` action to support multiple MCP servers via `additional-mcp-config` parameter
- Added comprehensive MCP server documentation in `AGENTS.md` and `docs/automation/overview.md`
- Implemented a basic Screeps runtime with headcount-based spawning and simple harvester/upgrader state machines

### Changed

- Migrated from pnpm to npm as the package manager
- Updated all workflow files to use npm instead of pnpm
- Updated documentation to reference npm commands
- Added .nvmrc file to specify Node.js 16.20.2
- Updated package.json to remove pnpm references and specify npm in engines
- **Copilot CI AutoFix workflow now monitors all workflow failures** (except itself) instead of only Quality Gate failures, enabling automated fixes for any CI failure
- Updated `screeps-stats-monitor.yml` to use Screeps API MCP server for direct telemetry access
- Enhanced `.github/copilot/prompts/stats-analysis` to document available MCP servers
- Updated README.md secrets documentation to include MCP authentication variables
- **Enhanced Copilot Todo automation workflow** to create draft pull requests immediately and show visible implementation progress
  - Draft PRs are created at the start of the automation process for transparency
  - Implementation progress is shown through frequent commits and PR description updates using the `report_progress` tool
  - Users can follow along with the implementation in real-time
  - PRs are marked as ready for review only after all validation passes
  - Updated `.github/copilot/prompts/todo-issue` with new draft PR workflow
  - Updated documentation in `README.md`, `docs/automation/overview.md`, and `AGENTS.md`

### Fixed

- Fixed build error caused by node-gyp attempting to use Python 2 syntax with Python 3
- Moved `@screeps/common`, `@screeps/driver`, `@screeps/engine`, and `screeps-server-mockup` packages to `optionalDependencies` to allow installation to succeed even when native modules fail to build
- Added `.npmrc` to configure build behavior for optional dependencies
- Mockup tests now gracefully skip when isolated-vm build fails (as documented in tests/mockup/README.md)
- **Fixed post-merge workflow recursive execution** by adding condition to skip when release PRs are merged back to main
- **Fixed deployment workflow not triggering** by adding `workflow_run` trigger to chain deployment after successful release preparation
- Simplified tag creation in post-merge workflow from GitHub API to git commands for clarity
- Deploy workflow now falls back to latest version tag when no tag exists on triggering commit (resolves workflow run 18701965424)
- **Fixed deployment failure with empty environment variables** - Changed deploy script to use `||` instead of `??` operator so empty string secrets default to proper Screeps API values (resolves workflow run 18702433741)

### Removed

## [0.1.0] - 2024-06-01

- Added a curated `docs/` knowledge base and updated automation guidance so every fix documents findings and regression coverage.
- Extended the shared `copilot-exec` action to support GitHub MCP configuration and fuel new prompt templates for stats analysis and CI auto-fixes.
- Introduced scheduled Screeps stats monitoring, label synchronisation, and Copilot-driven CI auto-fix workflows with supporting scripts and prompts.
