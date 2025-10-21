# Changelog

All notable changes to this project are documented here. This changelog now maintains the full release history—update the
`[Unreleased]` section with your changes and run `bun run versions:update` to refresh the release index.

## [Unreleased]

### Added

- Implemented automatic respawn detection when all spawns are lost
- Added `RespawnManager` class to monitor and track respawn conditions
- Extended Memory interface with `respawn` state tracking
- Integrated respawn checks into the kernel's main loop
- Updated `SystemEvaluator` to flag respawn conditions as critical findings
- Added comprehensive unit tests for `RespawnManager` (7 test cases)
- Added end-to-end tests for respawn scenarios (3 test cases)
- Created documentation for respawn handling in `docs/operations/respawn-handling.md`

### Changed

- Kernel now checks for respawn condition before processing normal behavior
- SystemEvaluator now receives Memory context to evaluate respawn state
- System evaluation includes respawn status in critical findings

## [0.1.0] - 2024-06-01

- Added a curated `docs/` knowledge base and updated automation guidance so every fix documents findings and regression coverage.
- Extended the shared `copilot-exec` action to support GitHub MCP configuration and fuel new prompt templates for stats analysis and CI auto-fixes.
- Introduced scheduled Screeps stats monitoring, label synchronisation, and Copilot-driven CI auto-fix workflows with supporting scripts and prompts.
