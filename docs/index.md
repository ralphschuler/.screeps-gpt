# Screeps GPT Knowledge Base

This directory supplements the top-level [README](../README.md) with deeper operational notes for the autonomous Screeps GPT
stack. Keep these documents current whenever you touch automation, workflows, or runtime behaviour—the GitHub Copilot CLI reads
them before acting.

## Quick Start

1. **Install prerequisites**
   - [Node.js](https://nodejs.org) 16.x with Python 2 for native dependencies.
   - [npm](https://www.npmjs.com) 8.0 or newer (bundled with Node.js 16).
   - Node.js 22 is used in CI to install the Copilot CLI.
   - Screeps account with Public Test Realm (PTR) access for end-to-end trials.
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Local quality gates**
   ```bash
   npm run lint
   npm run format:check
   npm run test:unit
   npm run test:e2e   # PTR configuration
   npm run test:regression
   npm run test:coverage
   npm run test:actions
   npm run analyze:system
   ```
4. **Build & deploy**
   - Bundle with `npm run build`.
   - Deploy to PTR: `SCREEPS_HOST=ptr.screeps.com npm run deploy` (requires `SCREEPS_TOKEN`).

## Documentation Rules

- Update the files under `docs/` whenever you change automation, runtime behaviour, or operating procedures.
- Capture lessons learned from bug fixes or regressions, including links to the relevant tests.
- Cross-reference new documents from `README.md` or other entry points so the automation agents discover them.
- Update `CHANGELOG.md` in the `[Unreleased]` section and run `npm run versions:update` so `docs/changelog/versions.*` stays in sync.
- Preview the GitHub Pages site with `npm run build:docs-site` whenever you adjust documentation or changelog content.

## Additional Guides

- [Starter Bot Guide](starter-bot-guide.md) - Understanding and extending the basic Screeps bot implementation
- [Agent Guidelines](../AGENTS.md) - Comprehensive rules and knowledge base for GitHub Copilot and automation agents
- [Automation Overview](automation/overview.md)
- [PTR Monitoring Pipeline](operations/stats-monitoring.md)
- [Respawn Handling](operations/respawn-handling.md)
- [Developer Onboarding Resources](../DOCS.md)
- [Release History](changelog/versions.md)

Contributions should expand these notes rather than duplicating content in ad-hoc Markdown files.

```

```
