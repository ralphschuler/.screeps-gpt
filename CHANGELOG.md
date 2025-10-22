# Changelog

All notable changes to this project are documented here. This changelog now maintains the full release history—update the
`[Unreleased]` section with your changes and run `npm run versions:update` to refresh the release index.

## [Unreleased]

### Added

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
