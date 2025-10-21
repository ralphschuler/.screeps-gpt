# Changelog

All notable changes to this project are documented here. This changelog now maintains the full release history—update the
`[Unreleased]` section with your changes and run `bun run versions:update` to refresh the release index.

## [Unreleased]

- Fixed YAML syntax issues by collapsing Copilot-driven workflows down to a single `copilot-exec` step authenticated with the GitHub CLI.
- Rewrote Copilot prompts so the automation now clones the repo, files issues, and opens pull requests directly, updating the README and automation overview to reflect the new behaviour.

## [0.1.0] - 2024-06-01

- Added a curated `docs/` knowledge base and updated automation guidance so every fix documents findings and regression coverage.
- Extended the shared `copilot-exec` action to support GitHub MCP configuration and fuel new prompt templates for stats analysis and CI auto-fixes.
- Introduced scheduled Screeps stats monitoring, label synchronisation, and Copilot-driven CI auto-fix workflows with supporting scripts and prompts.
