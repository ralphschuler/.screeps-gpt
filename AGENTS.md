# Repository Agent Guidelines

This repository manages an autonomous Screeps AI and the automation surrounding it. When modifying files inside this repository, follow these rules:

1. **Tooling**
   - Use Bun for running scripts (`bun run <script>`). Package scripts are defined in `package.json`.
   - Format code with `bun run format:write` and verify with `bun run format:check`.
   - Lint TypeScript code with `bun run lint` (use `lint:fix` for automatic fixes).
   - All tests are managed by Vitest. Run the relevant suites (`test:unit`, `test:e2e`, `test:regression`, `test:coverage`) before publishing changes.

2. **Coding Standards**
   - TypeScript must compile with the strict settings defined in `tsconfig.json`. Avoid using `any` unless there is no alternative and document why.
   - Prefer small, testable modules. Share contracts through `src/shared/` rather than duplicating types.
   - Add TSDoc blocks for exported classes and functions when behaviour is non-trivial.
   - Keep runtime code deterministic; guard use of `Math.random()` behind helper utilities if predictable output matters for tests.

3. **Documentation**
   - Update the root `README.md` when user-facing behaviour, workflows, or automation steps change.
   - Keep the structured knowledge base under [`docs/`](docs/) in sync with any workflow, runtime, or operational changes. Copilot automation reads these files before making edits.
   - Document bug investigations and incident learnings in `docs/` before merging fixes, referencing the regression tests that cover them.
   - Maintain `TASKS.md` by adding new tasks and marking completed items with a completion note instead of removing them immediately.

4. **Workflows**
   - Any change to `.github/workflows/` must keep the automation promises described in `README.md` and `docs/automation/overview.md`.
   - Follow [Graphite's GitHub Actions permissions guidance](https://graphite.dev/guides/github-actions-permissions) to ensure least-privilege scopes.
   - Secrets referenced by workflows must be documented in `README.md` under the automation section.
   - Use the GitHub Copilot CLI with the GitHub MCP server via the shared `copilot-exec` composite action and template prompts.

5. **Testing Artifacts**
   - Place long-lived automation or evaluation reports in the `reports/` directory.
   - Coverage information consumed by scripts must remain compatible with `scripts/evaluate-system.ts`.

6. **Regression Discipline**
   - Add or update a regression test demonstrating any bug before implementing a fix.
   - Record a concise summary of the bug, the regression test name, and remediation notes in `CHANGELOG.md` (overwrite previous entries each pull request so it only lists the new changes).

More specific instructions may be defined by nested `AGENTS.md` files within subdirectories.
