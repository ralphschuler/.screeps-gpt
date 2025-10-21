# Changelog

All notable changes to this project are documented here. This changelog now maintains the full release history—update the
`[Unreleased]` section with your changes and run `pnpm run versions:update` to refresh the release index.

## [Unreleased]

### Fixed

- Fixed pnpm lockfile configuration compatibility issue causing ERR_PNPM_LOCKFILE_CONFIG_MISMATCH during CI runs (run ID: 18699813713)
- Added regression test for pnpm lockfile compatibility to prevent future lockfile configuration mismatches

## [0.1.0] - 2024-06-01

- Added a curated `docs/` knowledge base and updated automation guidance so every fix documents findings and regression coverage.
- Extended the shared `copilot-exec` action to support GitHub MCP configuration and fuel new prompt templates for stats analysis and CI auto-fixes.
- Introduced scheduled Screeps stats monitoring, label synchronisation, and Copilot-driven CI auto-fix workflows with supporting scripts and prompts.
