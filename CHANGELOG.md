# Changelog

All notable changes to this project are documented here. This changelog now maintains the full release history—update the
`[Unreleased]` section with your changes and run `bun run versions:update` to refresh the release index.

## [Unreleased]

### Fixed

- **Hexo Documentation Build**: Fixed markdown renderer loading in Hexo build script
  - Added proper plugin loading mechanism using global hexo variable for hexo-renderer-marked
  - Ensures markdown files are rendered to HTML instead of staying as .md files
  - Fixes documentation site deployment generating raw markdown files instead of HTML
  - Fixes run ID: 18781158449
- **Screeps Spawn Monitor Shard Parsing**: Fixed shard/room parsing in autospawn script API calls
  - Parse shard name and room name from format "shard3/E45S25" for terrain and spawn placement API calls
  - Pass shard parameter correctly to `roomTerrain()` and `placeSpawn()` API methods
  - Fixes "Failed to get room terrain" error when spawn placement tries to analyze multi-shard rooms
  - Fixes run ID: 18780039750
- **Screeps Spawn Monitor API Failure**: Fixed terrain API method call in autospawn script
  - Use correct `api.raw.game.roomTerrain(roomName, 1)` instead of invalid `api.raw.game["room-terrain"]({ room, shard })`
  - Removed unused shard parsing logic that was unnecessary for working API call
  - Fixes "api.raw.game.room-terrain is not a function" error
  - Fixes run ID: 18779690172
- **Screeps Spawn Monitor API Failure**: Fixed incorrect API call for room terrain on sharded servers
  - Fixed screeps-api call to use correct room-terrain endpoint with proper shard parameter
  - Parse shard from room name format (shard3/E45S25) instead of passing invalid parameters
  - Resolves "Failed to get room terrain" error in autospawn workflow
  - Fixes run ID: 18779519651
- **Documentation Site Build Failure**: Fixed duplicate dependencies in package.json causing lockfile conflicts in CI
  - Removed duplicate `tsx` and `marked` entries from dependencies section (keeping them in devDependencies)
  - Updated bun.lock to reflect proper dependency resolution
  - Fixes run ID: 18777257201

### Added

- **Daily Autonomous Bot Monitoring workflow**
  - Created `.github/workflows/copilot-autonomous-monitor.yml` scheduled daily at 06:00 UTC
  - Comprehensive strategic analysis combining bot performance and repository health
  - Six-phase analysis pipeline: authentication, bot performance, repository health, strategic decisions, issue management, strategic reporting
  - MCP server integration via `.github/mcp/screeps-mcp.json` for bot console access using `@ralphschuler/screeps-api-mcp`
  - Direct Screeps console interaction for analyzing spawning, CPU, energy, RCL, defense, and strategic execution
  - GitHub repository analysis for codebase quality, automation effectiveness, and development velocity
  - Intelligent autonomous issue creation/update/close with evidence-based recommendations (up to 10 issues per run)
  - Bot health scoring (0-100) with top priorities and strategic recommendations
  - Safety controls: read-only by default, rate limiting (daily schedule, max 5 console commands per phase), prohibited destructive actions
  - Comprehensive documentation in `docs/automation/autonomous-monitoring.md` with architecture, usage, troubleshooting, and best practices
  - Updated `README.md` to include Autonomous Monitor Agent in agent types list
  - Addresses issue ralphschuler/.screeps-gpt#239 (autonomous monitoring and strategic automation)

- **Documentation restructuring for improved navigation**
  - Created comprehensive `docs/getting-started.md` with detailed setup instructions, prerequisites, development commands, runtime architecture, and contributing workflow
  - Refactored `README.md` to focus on concise project overview emphasizing Copilot agent swarm concept
  - Added clear description of Screeps GPT as autonomous AI playground where multiple GitHub Copilot agents collaboratively develop a Screeps bot
  - Documented system architecture with three integrated layers: Runtime AI, Development Infrastructure, and AI Agent Orchestration
  - Included key features section highlighting autonomous agent swarm, CI/CD, self-evaluation, and documentation-first approach
  - Organized documentation links into categorized sections: Core, Technical, Monitoring & Operations, and Strategy & Development
  - Improved onboarding experience with clear navigation from README to detailed documentation
  - Addresses issue ralphschuler/.screeps-gpt#[issue_number] (documentation restructuring)
- **Docker containerization for development, testing, and building**
  - Created `Dockerfile.test` with Node.js 20 + Python 2 for running test suites
  - Created `Dockerfile.build` with Node.js 20 for building the Screeps AI
  - Created `Dockerfile.mockup` with Node.js 16 + Python 2 for screeps-server-mockup compatibility
  - Added `docker-compose.yml` orchestrating dev, test, build, lint, and format services
  - Added `.dockerignore` to optimize Docker build context
  - Added Docker commands to package.json: `docker:test:unit`, `docker:test:e2e`, `docker:test:mockup`, `docker:build:ai`, `docker:lint`, `docker:format`, `docker:dev`, `docker:shell`
  - Created comprehensive Docker Development Guide at `docs/operations/docker-guide.md`
  - Updated README.md with Docker prerequisites, commands table, and contributing workflow
  - Provides isolated, reproducible development environments without local Node.js/Python installation
  - Enables simultaneous support for Node.js 20 (testing/building) and Node.js 16 (mockup tests)
  - Addresses issues #188 (Node.js migration), #204 (Bun integration), #200 (act CLI consistency)
- **Builder and remote miner creep roles**
  - Registered new role definitions in the behavior controller with dedicated state machines and spawn configurations
  - Extended runtime types/memory helpers to track remote assignments deterministically
  - Added unit, e2e, and regression tests covering spawn logic plus travel/mine/return transitions
  - Documented strategy updates in `docs/runtime/strategy/creep-roles.md` and `docs/runtime/strategy/scaling-strategies.md`

### Fixed

- **Deterministic creep naming in BehaviorController**
  - Replaced `Math.random()` with memory-persisted counter for creep name generation
  - Ensures deterministic AI behavior for reliable testing and debugging
  - Creep names now follow pattern: `{role}-{game.time}-{counter}` (e.g., `harvester-100-0`)
  - Documented the deterministic spawn naming scheme in `docs/runtime/strategy/creep-roles.md` so monitoring agents can trace counter resets
  - Added unit tests verifying deterministic naming behavior across test runs
  - Added regression test to prevent future `Math.random()` usage in runtime code
  - Resolves issue #174 and aligns with repository coding standards for deterministic runtime
  - Improves testing reliability and debugging consistency for autonomous AI validation

### Changed

- **Documented Bun-first workflow and Node.js 18–22 support window**
  - Updated README.md, AGENTS.md, DOCS.md, and docs/index.md to highlight Bun commands and supported Node versions.
  - Verified `package.json` engines and scripts align with the documented workflow.
  - Updated script messaging to reference `bun run versions:update` where applicable.
- **Updated package dependencies while maintaining Node.js 16 compatibility**
  - Updated `semver` from 7.6.2 to 7.7.3 to address ReDoS security vulnerability (GHSA-c2qf-rxjj-qqgw)
  - Verified all build, lint, and test pipelines function correctly after update (66 tests passing)
  - Maintained Node.js 16.x compatibility as required by package.json engines field
  - Created comprehensive security assessment document at `docs/security/dependency-vulnerabilities.md`
  - Documented remaining 48 vulnerabilities: 79% are in optional testing dependencies, not production
  - Verified production bundle excludes all vulnerable dependencies (axios, lodash, angular, etc.)
  - Remaining vulnerabilities are acceptable risks per security assessment

- **Simplified Copilot model configuration**
  - Removed `.github/copilot/model-config.json` file
  - Updated `copilot-exec` action to only pass `--model` flag when a model is explicitly specified
  - Model resolution now: input parameter → COPILOT_MODEL env var → Copilot CLI default
  - When no model is specified, Copilot CLI uses its own default model selection
  - Updated documentation in README.md and docs/automation/overview.md

### Fixed

- **Fixed Vitest CI failure in Node.js 16 environment (run 18742323437)**
  - Improved `crypto.getRandomValues()` polyfill in `tests/setup.ts` to use `randomBytes()` instead of `webcrypto`
  - Fixes Vitest startup error: "TypeError: crypto.getRandomValues is not a function"
  - Resolves post-merge-release workflow failures where husky pre-commit hook failed during version bump
  - Maintains Node.js 16.x compatibility as required by package.json engines field
  - Node.js 16 doesn't include Web Crypto API, but it's required by Vite/Vitest
  - Uses Node.js built-in `randomBytes()` to implement the crypto polyfill
  - Ensures all test suites run successfully in CI workflows using Node.js 16

- **Node.js 16 compatibility for lint-staged in CI workflows**
  - Downgraded `lint-staged` from v16.2.5 to v13.3.0 to maintain Node.js 16.14.0+ compatibility
  - Fixes `post-merge-release.yml` workflow failure caused by `nano-spawn@2.0.0` dependency requiring Node.js 17+ (`node:readline/promises`)
  - Repository continues to use Node.js 16.x for native dependency compatibility (Python 2 requirement)
  - Removed unused `@typescript-eslint/no-unsafe-return` ESLint disable directive in `tests/mockup/setup.ts`
  - Verified no other dependencies have Node.js version incompatibilities

### Added

- **Push notification system for repository and Screeps bot monitoring**
  - Integrated Push by Techulus API for real-time alerts on critical events
  - Created `scripts/send-push-notification.ts` with rate limiting and error handling
  - Added composite action `.github/actions/send-push-notification` for workflow integration
  - Implemented notifications in deploy workflow (success/failure alerts)
  - Implemented notifications in quality-gate workflow (build failure alerts)
  - Implemented PTR monitoring alerts via `scripts/check-ptr-alerts.ts`
  - Added automated notifications for high CPU usage (>80% sustained), critical CPU (>95%), and low energy
  - Created comprehensive documentation at `docs/automation/push-notifications.md`
  - Added unit tests for notification utility with 100% coverage
  - Rate limiting: 5 second minimum interval, max 10 notifications per minute
  - Graceful degradation: notification failures never break workflows
  - Secure implementation: PUSH_TOKEN stored as GitHub secret, no sensitive data in notifications
  - Complements existing email notification system (#134)
  - Integrates with PTR monitoring infrastructure (#152, #117)

- **ESLint flat config migration with Node 16 structuredClone polyfill** (#156)
  - Migrated from deprecated `.eslintrc.cjs` to modern `eslint.config.mjs` flat configuration format
  - Added `.eslintrc-polyfill.cjs` to provide `structuredClone` implementation for Node.js 16.x compatibility
  - Updated npm lint scripts to use flat config (removed `ESLINT_USE_FLAT_CONFIG=false`)
  - Updated lint-staged configuration to use simplified ESLint commands
  - Preserved all existing ESLint rules and TypeScript plugin configurations
  - Resolves ESLint deprecation warnings for v10.0.0 preparation
  - Fixes `ReferenceError: structuredClone is not defined` when running ESLint with @typescript-eslint v8+ on Node 16

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
