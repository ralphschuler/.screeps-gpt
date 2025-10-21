# Screeps GPT Knowledge Base

This directory supplements the top-level [README](../README.md) with deeper operational notes for the autonomous Screeps GPT
stack. Keep these documents current whenever you touch automation, workflows, or runtime behaviour—the GitHub Copilot CLI reads
them before acting.

## Quick Start

1. **Install prerequisites**
   - [Node.js](https://nodejs.org) 16.x with Python 2 for native dependencies.
   - [pnpm](https://pnpm.io) 8.0 or newer.
   - Node.js 22 is used in CI to install the Copilot CLI.
   - Screeps account with Public Test Realm (PTR) access for end-to-end trials.
2. **Install dependencies**
   ```bash
   pnpm install
   ```
3. **Local quality gates**
   ```bash
   pnpm run lint
   pnpm run format:check
   pnpm run test:unit
   pnpm run test:e2e   # PTR configuration
   pnpm run test:regression
   pnpm run test:coverage
   pnpm run test:actions
   pnpm run analyze:system
   ```
4. **Build & deploy**
   - Bundle with `pnpm run build`.
   - Deploy to PTR: `SCREEPS_HOST=ptr.screeps.com pnpm run deploy` (requires `SCREEPS_TOKEN`).

## Documentation Rules

- Update the files under `docs/` whenever you change automation, runtime behaviour, or operating procedures.
- Capture lessons learned from bug fixes or regressions, including links to the relevant tests.
- Cross-reference new documents from `README.md` or other entry points so the automation agents discover them.
- Update `CHANGELOG.md` in the `[Unreleased]` section and run `pnpm run versions:update` so `docs/changelog/versions.*` stays in sync.
- Preview the GitHub Pages site with `pnpm run build:docs-site` whenever you adjust documentation or changelog content.

## Additional Guides

- [Automation Overview](automation/overview.md)
- [PTR Monitoring Pipeline](operations/stats-monitoring.md)
- [Copilot Automation Prompts](../.github/copilot/README.md) *(if present)*
- [Developer Onboarding Resources](../DOCS.md)
- [Release History](changelog/versions.md)

Contributions should expand these notes rather than duplicating content in ad-hoc Markdown files.
```
