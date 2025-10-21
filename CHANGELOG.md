# Changelog

All notable changes to this project are documented here. This changelog now maintains the full release history—update the
`[Unreleased]` section with your changes and run `bun run versions:update` to refresh the release index.

## [Unreleased]

### Fixed

- Fixed build error caused by node-gyp attempting to use Python 2 syntax with Python 3
- Moved `@screeps/common`, `@screeps/driver`, `@screeps/engine`, and `screeps-server-mockup` packages to `optionalDependencies` to allow installation to succeed even when native modules fail to build
- Added `.npmrc` to configure build behavior for optional dependencies
- Mockup tests now gracefully skip when isolated-vm build fails (as documented in tests/mockup/README.md)

## [0.1.0] - 2024-06-01

- Added a curated `docs/` knowledge base and updated automation guidance so every fix documents findings and regression coverage.
- Extended the shared `copilot-exec` action to support GitHub MCP configuration and fuel new prompt templates for stats analysis and CI auto-fixes.
- Introduced scheduled Screeps stats monitoring, label synchronisation, and Copilot-driven CI auto-fix workflows with supporting scripts and prompts.
