# Changelog

All notable changes to this project are documented here. This changelog now maintains the full release history—update the
`[Unreleased]` section with your changes and run `pnpm run versions:update` to refresh the release index.

## [Unreleased]

### Fixed

- Fixed esbuild version mismatch during pnpm install causing "Expected 0.25.11 but got 0.18.20" postinstall errors (run ID: 18700270798)
- Regenerated pnpm-lock.yaml to resolve persistent version conflicts and applied prettier formatting
- Verified existing regression test `lockfile should have consistent esbuild versions` covers this issue

## [0.1.0] - 2024-06-01

- Added a curated `docs/` knowledge base and updated automation guidance so every fix documents findings and regression coverage.
- Extended the shared `copilot-exec` action to support GitHub MCP configuration and fuel new prompt templates for stats analysis and CI auto-fixes.
- Introduced scheduled Screeps stats monitoring, label synchronisation, and Copilot-driven CI auto-fix workflows with supporting scripts and prompts.
