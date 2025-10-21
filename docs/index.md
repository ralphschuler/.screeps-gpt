# Screeps GPT Knowledge Base

This directory supplements the top-level [README](../README.md) with deeper operational notes for the autonomous Screeps GPT
stack. Keep these documents current whenever you touch automation, workflows, or runtime behaviour—the GitHub Copilot CLI reads
them before acting.

## Quick Start

1. **Install prerequisites**
   - [Bun](https://bun.sh) 1.0 or newer.
   - Node.js 18+ (Node 22 is used in CI to install the Copilot CLI).
   - Screeps account with Public Test Realm (PTR) access for end-to-end trials.
2. **Install dependencies**
   ```bash
   bun install
   ```
3. **Local quality gates**
   ```bash
   bun run lint
   bun run format:check
   bun run test:unit
   bun run test:e2e   # PTR configuration
   bun run test:regression
   bun run test:coverage
   bun run analyze:system
   ```
4. **Build & deploy**
   - Bundle with `bun run build`.
   - Deploy to PTR: `SCREEPS_HOST=ptr.screeps.com bun run deploy` (requires `SCREEPS_TOKEN`).

## Documentation Rules

- Update the files under `docs/` whenever you change automation, runtime behaviour, or operating procedures.
- Capture lessons learned from bug fixes or regressions, including links to the relevant tests.
- Cross-reference new documents from `README.md` or other entry points so the automation agents discover them.

## Additional Guides

- [Automation Overview](automation/overview.md)
- [PTR Monitoring Pipeline](operations/stats-monitoring.md)
- [Copilot Automation Prompts](../.github/copilot/README.md) *(if present)*
- [Developer Onboarding Resources](../DOCS.md)

Contributions should expand these notes rather than duplicating content in ad-hoc Markdown files.
