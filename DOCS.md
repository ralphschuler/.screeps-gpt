# Screeps GPT Developer Guide

This document augments the main [README](README.md) with a practical onboarding walkthrough and curated learning resources for contributors who want to extend the autonomous Screeps AI. Detailed runbooks and workflow notes now live under [`docs/`](docs/); update both this guide and the knowledge base when behaviour changes so Copilot has the latest context.

For GitHub Copilot and automation agents, comprehensive operational guidelines are maintained in [`AGENTS.md`](AGENTS.md).

## Quick Start

1. **Install prerequisites**
   - [Bun](https://bun.sh) 1.0 or newer.
   - Node.js 18.x–22.x (Node 22 is used in CI to install the Copilot CLI).
   - A Screeps account with access to the Public Test Realm (PTR) for end-to-end experiments.
2. **Install dependencies**
   ```bash
   bun install
   ```
3. **Run the local quality gates**
   ```bash
   bun run lint
   bun run format:check
   bun run test:unit
   bun run test:e2e   # executes against the PTR profile
   bun run test:regression
   bun run test:docs  # validates documentation build and deployment
   bun run test:coverage
   bun run test:actions
   bun run analyze:system
   ```

```
4. **Build and deploy**
 - Produce a Screeps bundle with `bun run build`.
 - Deploy to Screeps PTR with `SCREEPS_HOST=ptr.screeps.com bun run deploy` (requires `SCREEPS_TOKEN`).
5. **Read the automation specs**
 - Workflow definitions live in [`.github/workflows/`](.github/workflows/) and are summarised in [`docs/automation/overview.md`](docs/automation/overview.md).
 - Prompts for Copilot-driven automation live in [`.github/copilot/prompts/`](.github/copilot/prompts/).
 - Operational procedures (PTR monitoring, CI auto-fixes, etc.) live in [`docs/operations/`](docs/operations/).

## Working with GitHub Copilot CLI Automation

The repository replaces previous Codex integrations with the [GitHub Copilot CLI](https://github.com/github/copilot-cli). The composite action at [`.github/actions/copilot-exec`](.github/actions/copilot-exec/action.yml) centralises CLI installation, prompt rendering, and execution.

- **Repository audits** are scheduled via [`copilot-review.yml`](.github/workflows/copilot-review.yml). The prompt template enforces structured JSON so findings can be filed as GitHub issues automatically.
- **Todo labelled issues** trigger [`copilot-todo-pr.yml`](.github/workflows/copilot-todo-pr.yml). Copilot applies code edits, returns a structured summary, and opens a pull request that surfaces test expectations.
- Copilot workflows rely on the default `GITHUB_TOKEN`; adjust workflow `permissions` when access scopes need to change.

## Reference Resources

Use the following material to deepen your Screeps expertise and tooling knowledge:

- **Internal References**:
  - [Competitive Screeps Bot Development Guide](docs/reference/screeps-competitive-guide.md) - Comprehensive strategic reference covering game mechanics, optimization techniques, and competitive play patterns
- Official Screeps Documentation: [Game Guide](https://docs.screeps.com/index.html) · [API Reference](https://docs.screeps.com/api/)
- Type Definitions & Tooling:
  - [`@types/screeps`](https://www.npmjs.com/package/@types/screeps)
  - [`@types/screeps-profiler`](https://www.npmjs.com/package/@types/screeps-profiler)
  - [`screeps-typescript-starter` guide](https://screepers.gitbook.io/screeps-typescript-starter/)
- Build & Deployment Utilities:
  - [`rollup-plugin-screeps`](https://www.npmjs.com/package/rollup-plugin-screeps)
  - [`screeps-api`](https://www.npmjs.com/package/screeps-api) (used by our deployment script)
  - [`screeps-multimeter`](https://www.npmjs.com/package/screeps-multimeter)
- Runtime Enhancements:
  - [`screeps-movement`](https://www.npmjs.com/package/screeps-movement)
  - [`screeps-profiler`](https://www.npmjs.com/package/screeps-profiler)
  - [`screeps-calculator`](https://www.npmjs.com/package/screeps-calculator)
  - [`screeps-cartographer`](https://www.npmjs.com/package/screeps-cartographer)
  - [`screeps-viz`](https://www.npmjs.com/package/screeps-viz)
  - [`screeps-pathfinding`](https://www.npmjs.com/package/screeps-pathfinding)
  - [`screeps-lru-cache`](https://www.npmjs.com/package/screeps-lru-cache)
  - [`screeps-cache`](https://www.npmjs.com/package/screeps-cache)
  - [`screeps-stats`](https://www.npmjs.com/package/screeps-stats)
  - [`screeps-spawn`](https://www.npmjs.com/package/screeps-spawn)

For architectural inspiration and large-scale automation patterns, explore the open-source [Screeps Quorum](https://github.com/ScreepsQuorum/screeps-quorum) project. Many of its patterns (task queues, modular role controllers, etc.) can inform incremental improvements in this repository.

## Documentation Expectations

- When you fix a defect or address an operational issue, record the scenario and your findings in `docs/` (usually under `docs/operations/`) before landing the fix.
- Add a regression test that reproduces the bug *before* applying the fix; reference that test in both the documentation and `CHANGELOG.md`.
- Update the `[Unreleased]` section of `CHANGELOG.md` with every pull request and run `bun run versions:update` to refresh the generated release index under `docs/changelog/`.
- Regenerate the static documentation site locally with `bun run build:docs-site` when editing docs so you can preview what GitHub Pages will publish.

## Maintenance Tips

- Keep [`TASKS.md`](TASKS.md) updated as you work. Archive completed tasks for visibility before pruning them.
- Document any new secrets or automation requirements in the [README](README.md) so future contributors can bootstrap the environment quickly.
- Store long-lived metrics, evaluations, and PTR experiment outputs under [`reports/`](reports/).
- When expanding automation prompts, prefer reusing the shared `copilot-exec` action so configuration stays consistent.

Happy coding and may your creeps thrive on the PTR!
```
