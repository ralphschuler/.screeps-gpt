# Getting Started with Screeps GPT

This guide walks you through setting up your development environment and getting started with the Screeps GPT autonomous AI development project. Whether you're a new contributor or running your own instance of the bot, this guide provides step-by-step instructions from repository clone to bot deployment.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Repository Setup](#repository-setup)
- [Installation](#installation)
- [IDE Setup](#ide-setup)
- [Day-to-day Development](#day-to-day-development)
- [Deployment Guide](#deployment-guide)
- [Repository Structure](#repository-structure)
- [Runtime Architecture](#runtime-architecture)
- [Required Secrets](#required-secrets)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Next Steps](#next-steps)

## Prerequisites

### Local Development

- [Bun](https://bun.sh) v1.0 or later (primary package manager and script runner).
- [Node.js](https://nodejs.org/) 18.x–22.x (Node 22 is used in CI to install the Copilot CLI).
- Screeps account with an API token when deploying.
- Personal access token with Copilot Requests permission for the GitHub Copilot CLI.
- [`act`](https://github.com/nektos/act) CLI and Docker (for dry-running workflows locally).

### Docker Development (Alternative)

For a consistent, isolated development environment:

- [Docker](https://docs.docker.com/get-docker/) 20.10 or later
- [Docker Compose](https://docs.docker.com/compose/install/) v2.0 or later

Docker containers provide isolated environments with correct Node.js and Python versions without local installation. See [Docker Development Guide](operations/docker-guide.md) for details.

## Repository Setup

### 1. Clone the Repository

First, clone the repository to your local machine:

```bash
# Clone via HTTPS
git clone https://github.com/ralphschuler/.screeps-gpt.git
cd .screeps-gpt

# Or clone via SSH (if you have SSH keys configured)
git clone git@github.com:ralphschuler/.screeps-gpt.git
cd .screeps-gpt
```

### 2. Verify Prerequisites

Ensure you have the required tools installed:

```bash
# Check Bun version (should be 1.0+)
bun --version

# Check Node.js version (should be 18.x-22.x)
node --version

# Optional: Check Docker and act for workflow testing
docker --version
act --version
```

## Installation

### Local Development

Install project dependencies:

```bash
bun install
```

### Docker Development

Build Docker containers:

```bash
bun run docker:build
```

### Initial Verification

After installation, verify your setup by running the quality checks:

```bash
# Run linting
bun run lint

# Run unit tests
bun run test:unit

# Build the AI bundle
bun run build
```

If all commands complete successfully, your environment is ready for development!

## IDE Setup

### Visual Studio Code (Recommended)

The repository includes VS Code configuration files in `.vscode/`. Recommended extensions:

**Essential Extensions:**

- **ESLint** (`dbaeumer.vscode-eslint`) - TypeScript linting with auto-fix
- **Prettier** (`esbenp.prettier-vscode`) - Code formatting
- **TypeScript Vue Plugin** (`Vue.volar`) - TypeScript support

**Helpful Extensions:**

- **GitLens** (`eamodio.gitlens`) - Enhanced Git integration
- **GitHub Copilot** (`GitHub.copilot`) - AI-powered code suggestions
- **Docker** (`ms-azuretools.vscode-docker`) - Docker container management
- **Vitest** (`ZixuanChen.vitest-explorer`) - Test explorer integration

### VS Code Settings

Create or update `.vscode/settings.json` with these recommended settings:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.validate": ["javascript", "typescript"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### Other IDEs

**WebStorm / IntelliJ IDEA:**

- Enable ESLint in Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
- Enable Prettier in Settings → Languages & Frameworks → JavaScript → Prettier
- Configure TypeScript to use the project's version

**Vim / Neovim:**

- Use `coc-eslint` and `coc-prettier` plugins
- Install `typescript-language-server` for TypeScript support

## Day-to-day Development

### Local Development Commands

| Command                   | Purpose                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `bun run build`           | Bundle the Screeps AI into `dist/main.js` using esbuild (single bundle by default).       |
| `bun run test:unit`       | Run unit tests (Vitest).                                                                  |
| `bun run test:e2e`        | Execute end-to-end kernel simulations (configured for the Screeps PTR).                   |
| `bun run test:mockup`     | Run tick-based tests using screeps-server-mockup (skipped if isolated-vm fails to build). |
| `bun run test:regression` | Check regression scenarios for evaluation logic.                                          |
| `bun run test:coverage`   | Produce coverage reports consumed by the evaluation pipeline.                             |
| `bun run test:actions`    | Run formatting + lint checks and dry-run critical workflows with the `act` CLI.           |
| `bun run lint`            | Run ESLint with the strict TypeScript profile.                                            |
| `bun run format:write`    | Format the repository with Prettier.                                                      |
| `bun run analyze:system`  | Evaluate the current build quality and emit `reports/system-evaluation.json`.             |
| `bun run deploy`          | Build and upload the AI to the Screeps API (requires deployment secrets).                 |

### Docker Development Commands

For consistent, isolated environments without local Node.js/Python installation:

| Command                      | Purpose                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `bun run docker:build`       | Build all Docker containers (test, build, mockup).      |
| `bun run docker:build:ai`    | Build the Screeps AI in a container.                    |
| `bun run docker:test:unit`   | Run unit tests in container (Node.js 20).               |
| `bun run docker:test:e2e`    | Run end-to-end tests in container.                      |
| `bun run docker:test:mockup` | Run mockup tests in container (Node.js 16 + Python 2).  |
| `bun run docker:lint`        | Run ESLint in container.                                |
| `bun run docker:format`      | Check code formatting in container.                     |
| `bun run docker:dev`         | Start development server with hot-reload in container.  |
| `bun run docker:shell`       | Open interactive shell in test container for debugging. |

See the [Docker Development Guide](operations/docker-guide.md) for detailed usage, troubleshooting, and best practices.

**Modular Build Option**: Set `MODULAR_BUILD=true` to build separate modules for each runtime component instead of a single bundle. See [`automation/modular-deployment.md`](automation/modular-deployment.md) for details on benefits, usage, and configuration.

### Pre-commit Hooks

This repository uses [husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/okonet/lint-staged) to enforce code quality standards before commits. When you run `bun install`, the hooks are automatically installed.

**What runs on commit:**

- **Linting**: ESLint automatically fixes and checks TypeScript files for code quality issues
- **Formatting**: Prettier formats all staged files to maintain consistent code style
- **Unit Tests**: All unit tests run to catch regressions early (typically completes in <1 second)

**Bypassing hooks:**
If you need to commit without running the hooks (e.g., work-in-progress commits), use the `--no-verify` flag:

```bash
git commit --no-verify -m "WIP: incomplete feature"
```

**Note:** The CI pipeline will still run all checks on pull requests, so bypassing hooks locally doesn't skip quality validation.

### Bug Fix Protocol

- **Capture the failure first.** Write or update a regression test that demonstrates the bug before committing any fix.
- **Document the investigation.** Summarise the root cause, the regression test name, and any mitigations in [`docs/`](../) (usually under `docs/operations/`).
- **Keep the changelog fresh.** Append your updates to the `[Unreleased]` section of [`CHANGELOG.md`](../CHANGELOG.md) and run `bun run versions:update` so the release index stays current.

## Deployment Guide

This section provides step-by-step instructions for deploying the Screeps AI bot to Screeps servers.

### Prerequisites for Deployment

Before deploying, ensure you have:

1. **Screeps Account**: Create an account at [screeps.com](https://screeps.com) or the PTR server
2. **API Token**: Generate a token from your Screeps account settings
3. **Built AI Bundle**: Run `bun run build` to create `dist/main.js`

### Obtaining Your Screeps API Token

1. Log in to [screeps.com](https://screeps.com) (or [ptr.screeps.com](https://ptr.screeps.com) for PTR)
2. Navigate to **Account Settings** → **Auth Tokens**
3. Click **Generate New Token**
4. Copy the token (you won't be able to see it again!)
5. Store it securely - you'll use it for deployment

### Environment Configuration

Create a `.env` file in the repository root (this file is `.gitignore`d):

```bash
# Required for deployment
SCREEPS_TOKEN=your-api-token-here

# Optional - defaults to screeps.com
SCREEPS_HOST=screeps.com
SCREEPS_PORT=443
SCREEPS_PROTOCOL=https

# Optional - deployment branch (default: main)
SCREEPS_BRANCH=main
```

**Important:** Never commit your `.env` file or expose your API token in code!

### Deployment to Production (screeps.com)

Deploy to the main Screeps server:

```bash
# Build the AI
bun run build

# Deploy with environment variables from .env
bun run deploy

# Or set variables inline
SCREEPS_TOKEN=your-token-here bun run deploy

# Deploy to a specific branch
SCREEPS_BRANCH=main bun run deploy
```

**Deployment Process:**

1. The script validates your token and connection
2. Uploads `dist/main.js` to the specified branch
3. Verifies successful deployment
4. The bot will start running on the next game tick

### Deployment to PTR (Public Test Realm)

The PTR is recommended for testing changes before production deployment:

```bash
# Build the AI
bun run build

# Deploy to PTR
SCREEPS_HOST=ptr.screeps.com bun run deploy

# Or add to your .env file
SCREEPS_HOST=ptr.screeps.com
SCREEPS_TOKEN=your-ptr-token-here
```

**PTR vs Production:**

- **PTR (ptr.screeps.com)**: Test environment with faster ticks, no consequences for failures
- **Production (screeps.com)**: Main game server with slower ticks and persistent progress
- PTR and production require **separate API tokens** from their respective account settings

### Verifying Deployment

After deployment, verify the bot is running:

1. **In-game Console**: Open the Screeps game interface
2. **Check Console Output**: Look for initialization messages from your bot
3. **Monitor CPU Usage**: Check the CPU usage panel - your bot should be consuming resources
4. **Check Memory**: Run `Memory` in the console to see bot state

```javascript
// In Screeps console
Memory; // View bot's memory state
Object.keys(Game.creeps); // List all active creeps
```

### Automated Deployment via GitHub Actions

The repository includes automated deployment on version tags:

1. **Make your changes** and commit them
2. **Update CHANGELOG.md** in the `[Unreleased]` section
3. **Create a PR** - automation will run quality checks
4. **Merge the PR** - automation creates a version tag
5. **Deploy workflow triggers** - bot deploys automatically to Screeps

See [Deployment Troubleshooting](operations/deployment-troubleshooting.md) for common issues and solutions.

### Build Options

**Standard Build (Single Bundle):**

```bash
bun run build
```

**Modular Build (Separate Modules):**

```bash
MODULAR_BUILD=true bun run build
```

**Build Without Profiler:**

```bash
bun run build:no-profiler
```

See [Modular Deployment Guide](automation/modular-deployment.md) for details on build options.

## Repository Structure

Understanding the repository layout helps you navigate and contribute effectively.

### Top-Level Directories

```
.screeps-gpt/
├── .github/          # GitHub Actions workflows and configuration
│   ├── actions/      # Reusable composite actions
│   ├── copilot/      # Copilot agent prompts and configurations
│   └── workflows/    # CI/CD workflow definitions
├── docs/             # Documentation and knowledge base
│   ├── automation/   # Workflow and automation guides
│   ├── operations/   # Operational runbooks and troubleshooting
│   ├── runtime/      # Bot runtime documentation
│   └── strategy/     # Game strategy and planning
├── packages/         # Monorepo package structure
│   ├── bot/          # Core Screeps AI implementation
│   │   └── src/      # Source code (main.ts, runtime/, shared/)
│   ├── utilities/    # Build, deploy, and automation scripts
│   │   └── scripts/  # TypeScript utility scripts
│   ├── docs/         # Hexo documentation site
│   ├── actions/      # GitHub composite actions (placeholder)
│   └── console/      # Screeps console integration (placeholder)
├── tests/            # Test suites
│   ├── unit/         # Unit tests (Vitest)
│   ├── e2e/          # End-to-end tests
│   ├── mockup/       # Screeps server mockup tests
│   └── regression/   # Regression test suites
├── dist/             # Build output (git-ignored)
├── reports/          # Analysis and evaluation reports
└── themes/           # Documentation site themes
```

### Key Files

| File                | Purpose                           |
| ------------------- | --------------------------------- |
| `package.json`      | Dependencies and npm scripts      |
| `tsconfig.json`     | TypeScript compiler configuration |
| `vitest.config.ts`  | Test framework configuration      |
| `eslint.config.mjs` | ESLint linting rules              |
| `.prettierrc`       | Code formatting rules             |
| `CHANGELOG.md`      | Version history and changes       |
| `AGENTS.md`         | Comprehensive agent guidelines    |
| `DOCS.md`           | Developer guide and resources     |
| `TASKS.md`          | Active development tasks          |

### Source Code Structure (`packages/bot/src/`)

The `packages/bot/src/` directory contains the core bot implementation:

```
packages/bot/src/
├── main.ts                    # Bot entry point and main loop
├── runtime/
│   ├── bootstrap/             # Kernel initialization and system wiring
│   ├── behavior/              # Creep role logic and spawn management
│   │   ├── roles/             # Individual creep role implementations
│   │   └── spawn-logic.ts     # Spawn queue and creep production
│   ├── memory/                # Memory management and consistency
│   ├── metrics/               # CPU tracking and performance monitoring
│   ├── respawn/               # Auto-respawn detection and handling
│   ├── evaluation/            # Health checks and improvement recommendations
│   └── tasks/                 # Task system (experimental)
└── shared/                    # Shared types, interfaces, and contracts
    ├── contracts/             # Type definitions and interfaces
    └── types/                 # Shared type declarations
```

### Script Files (`packages/utilities/scripts/`)

Automation and build scripts executed by Bun:

| Script               | Purpose                        |
| -------------------- | ------------------------------ |
| `build.ts`           | Bundle AI with esbuild         |
| `deploy.ts`          | Deploy to Screeps API          |
| `bump-version.ts`    | Version management             |
| `evaluate-system.ts` | Generate system health reports |
| `test-actions.ts`    | Dry-run workflows locally      |

### Documentation Structure (`packages/docs/docs/`)

| Directory     | Contents                                |
| ------------- | --------------------------------------- |
| `automation/` | GitHub Actions workflows, CI/CD guides  |
| `operations/` | Troubleshooting, monitoring, deployment |
| `runtime/`    | Bot behavior, strategy, performance     |
| `strategy/`   | Roadmap, architecture, planning         |

## Runtime Architecture

- `packages/bot/src/runtime/bootstrap/` – Kernel wiring that orchestrates memory maintenance, behavioural control, performance tracking, and evaluation.
- `packages/bot/src/runtime/behavior/` – High-level creep role orchestration and spawn logic.
- `packages/bot/src/runtime/memory/` – Helpers to keep `Memory` consistent between ticks.
- `packages/bot/src/runtime/metrics/` – CPU usage and execution accounting.
- `packages/bot/src/runtime/respawn/` – Automatic detection and handling of respawn scenarios when all spawns are lost.
- `packages/bot/src/runtime/evaluation/` – Generates health reports and improvement recommendations from runtime and repository signals.
- `packages/bot/src/shared/` – Shared contracts for metrics, evaluation results, and repository telemetry.
- `packages/utilities/scripts/` – Node.js 18–22 compatible TypeScript automation scripts executed through Bun (build, deploy, version bump, repository evaluation).
- `tests/` – Vitest suites split into unit, e2e, and regression directories.
- `reports/` – Persistent analysis artifacts (e.g., `system-evaluation.json`).

The main loop lives in `packages/bot/src/main.ts` and delegates to a kernel that can be exercised in tests or tooling. The system automatically detects when all spawns are lost and flags critical respawn conditions in evaluation reports—see [`operations/respawn-handling.md`](operations/respawn-handling.md) for details.

## Required Secrets

Add the following GitHub Action secrets before enabling the workflows:

| Secret                           | Used by               | Description                                                     |
| -------------------------------- | --------------------- | --------------------------------------------------------------- |
| `SCREEPS_TOKEN`                  | Deploy, Stats monitor | Screeps authentication token (primary authentication method).   |
| `SCREEPS_EMAIL` (optional)       | Stats monitor         | Screeps account email (alternative to token authentication).    |
| `SCREEPS_PASSWORD` (optional)    | Stats monitor         | Screeps account password (alternative to token authentication). |
| `SCREEPS_HOST` (optional)        | Deploy, Stats monitor | Hostname for Screeps server (default `screeps.com`).            |
| `SCREEPS_PORT` (optional)        | Deploy, Stats monitor | Port for Screeps server (default `443`).                        |
| `SCREEPS_PROTOCOL` (optional)    | Deploy, Stats monitor | Protocol (`https` by default).                                  |
| `SCREEPS_BRANCH` (optional)      | Deploy workflow       | Destination Screeps branch (default `main`).                    |
| `SCREEPS_STATS_TOKEN` (optional) | Stats monitor         | Token for the stats API (falls back to `SCREEPS_TOKEN`).        |
| `COPILOT_TOKEN` (optional)       | Copilot workflows     | GitHub personal access token with Copilot Requests scope.       |
| `PUSH_TOKEN` (optional)          | All workflows         | Push by Techulus API key for push notifications.                |

**Note on Authentication:** The Stats Monitor workflow now uses the Screeps API MCP server for direct server interaction. It supports both token-based (`SCREEPS_TOKEN`) and email/password authentication (`SCREEPS_EMAIL` + `SCREEPS_PASSWORD`). Token authentication is recommended for security.

## Push Notifications

The repository supports real-time push notifications via [Push by Techulus](https://push.techulus.com) for critical events:

- Deploy pipeline successes and failures
- Quality gate failures on pull requests
- PTR monitoring alerts (high CPU usage, low energy, anomalies)

Push notifications are **optional**. If `PUSH_TOKEN` is not configured, workflows continue normally without sending notifications. The notification system includes rate limiting and error handling to prevent spam and ensure workflow reliability.

See [`automation/push-notifications.md`](automation/push-notifications.md) for detailed configuration and usage instructions.

## Repository Evaluation Pipeline

`packages/utilities/scripts/evaluate-system.ts` aggregates coverage output and environment hints into a `RepositorySignal`, runs the same `SystemEvaluator` that powers the runtime health checks, and records the result in `reports/system-evaluation.json`. Use this command locally after running the test + coverage suite to understand whether the current code is considered ready for deployment and which improvements are recommended.

## Troubleshooting

This section covers common issues you might encounter during setup, development, and deployment.

### Installation Issues

#### Problem: Bun installation fails or command not found

**Solution:**

```bash
# On macOS/Linux - install or update Bun
curl -fsSL https://bun.sh/install | bash

# Reload your shell configuration
source ~/.bashrc  # or ~/.zshrc

# Verify installation
bun --version
```

#### Problem: `bun install` fails with dependency resolution errors

**Solution:**

```bash
# Clear Bun cache
rm -rf ~/.bun/install/cache

# Delete lock file and node_modules
rm -rf node_modules bun.lock

# Reinstall dependencies
bun install
```

#### Problem: Node.js version incompatibility

**Solution:**

```bash
# Check your Node.js version
node --version

# If using nvm, switch to a compatible version
nvm install 20
nvm use 20

# Or install Node.js 20 LTS from nodejs.org
```

### Build Issues

#### Problem: Build fails with TypeScript errors

**Solution:**

```bash
# Ensure TypeScript dependencies are installed
bun install

# Check for type errors
npx tsc --noEmit

# Review error messages and fix type issues
```

#### Problem: esbuild fails or produces corrupted bundle

**Solution:**

```bash
# Clean build artifacts
rm -rf dist

# Rebuild from scratch
bun run build

# Check build output
ls -lh dist/main.js
```

### Test Issues

#### Problem: Tests fail on first run

**Solution:**

```bash
# Some tests require build artifacts
bun run build

# Run tests again
bun run test:unit

# Check specific test output
bun run test:unit -- --reporter=verbose
```

#### Problem: Mockup tests fail with "isolated-vm" errors

**Solution:**
The mockup tests require Python 2 and may not work on all systems. This is expected:

```bash
# Mockup tests are optional - skip if they fail
bun run test:unit
bun run test:e2e

# Use Docker for mockup tests if needed
bun run docker:test:mockup
```

### Deployment Issues

#### Problem: "Unauthorized" error during deployment

**Solution:**

```bash
# Verify your API token is correct
echo $SCREEPS_TOKEN

# Generate a new token from Screeps account settings
# Update your .env file or environment variable
SCREEPS_TOKEN=your-new-token-here bun run deploy
```

#### Problem: "Connection timeout" during deployment

**Solution:**

```bash
# Check your internet connection
ping screeps.com

# Try with explicit host configuration
SCREEPS_HOST=screeps.com SCREEPS_PORT=443 SCREEPS_PROTOCOL=https bun run deploy

# For PTR, use correct host
SCREEPS_HOST=ptr.screeps.com bun run deploy
```

#### Problem: Deployment succeeds but bot doesn't run

**Solution:**

1. **Check in-game console** for error messages
2. **Verify Memory is initialized**: Run `Memory` in console
3. **Check CPU usage**: Should be >0 if bot is running
4. **Look for spawn errors**: Run `Object.values(Game.spawns)[0].spawning`

```javascript
// Debug in Screeps console
console.log(JSON.stringify(Memory, null, 2));
console.log(`CPU used: ${Game.cpu.getUsed()}`);
console.log(`Creeps: ${Object.keys(Game.creeps).length}`);
```

#### Problem: "Module not found" errors in deployed code

**Solution:**
Ensure all imports use correct paths and the bundle includes all dependencies:

```bash
# Rebuild with verbose output
bun run build

# Check bundle size and structure
ls -lh dist/main.js
head -n 50 dist/main.js
```

### Git and Pre-commit Issues

#### Problem: Pre-commit hooks fail

**Solution:**

```bash
# Run checks manually to see detailed errors
bun run format:write
bun run lint
bun run test:unit

# Fix issues, then commit again
git add .
git commit -m "Your message"

# Or bypass hooks temporarily (not recommended)
git commit --no-verify -m "WIP"
```

#### Problem: Husky hooks not installed

**Solution:**

```bash
# Reinstall hooks
bun run prepare

# Or manually install husky
bunx husky install
```

### Docker Issues

#### Problem: Docker build fails

**Solution:**

```bash
# Clean Docker cache
docker system prune -a

# Rebuild containers
bun run docker:build

# Check Docker daemon is running
docker ps
```

#### Problem: Permission denied in Docker container

**Solution:**

```bash
# Run with proper permissions
docker compose run --rm --user $(id -u):$(id -g) test

# Or use the shell for debugging
bun run docker:shell
```

### IDE and Editor Issues

#### Problem: VS Code shows TypeScript errors but build succeeds

**Solution:**

1. **Reload VS Code**: Cmd/Ctrl + Shift + P → "Reload Window"
2. **Restart TypeScript server**: Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
3. **Check TypeScript version**: Ensure VS Code uses workspace TypeScript

```json
// .vscode/settings.json
{
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

#### Problem: ESLint not working in editor

**Solution:**

```bash
# Install ESLint extension for VS Code
code --install-extension dbaeumer.vscode-eslint

# Restart VS Code
```

### Performance Issues

#### Problem: Bot uses too much CPU in Screeps

**Solution:**

1. **Check CPU usage** in game: Look at Game.cpu.getUsed()
2. **Review logs**: Check for excessive operations
3. **Profile your code**: Use the built-in profiler

```javascript
// Enable profiling in Screeps console
Memory.profiler = { enabled: true };

// Check results after a few ticks
Memory.profiler;
```

See [CPU Optimization Strategies](runtime/operations/cpu-optimization-strategies.md) for detailed guidance.

#### Problem: Slow local build/test times

**Solution:**

```bash
# Use Bun's native speed
bun run build  # Much faster than npm

# Run specific tests instead of full suite
bun run test:unit -- packages/bot/src/runtime/behavior

# Use Docker to avoid local environment issues
bun run docker:build:ai
```

### Getting Help

If you encounter issues not covered here:

1. **Check existing documentation**:
   - [Deployment Troubleshooting](operations/deployment-troubleshooting.md)
   - [Workflow Troubleshooting](operations/workflow-troubleshooting.md)
   - [Docker Development Guide](operations/docker-guide.md)

2. **Search GitHub Issues**: Look for similar problems in [repository issues](https://github.com/ralphschuler/.screeps-gpt/issues)

3. **Create a new issue**: Use the issue templates to report bugs or ask questions

4. **Review logs**: Include relevant error messages and logs when asking for help

## Documentation Site & Release Index

- Generate the static documentation site locally with `bun run build:docs-site`. The output is written to `build/docs-site/` and matches what GitHub Pages serves from the `docs-pages` workflow.
- Keep the changelog index synchronised by running `bun run versions:update` after editing `CHANGELOG.md`; the command updates `docs/changelog/versions.{json,md}` which power the release history page.
- The hosted site provides light/dark themes and surfaces links to every documented release.

## TASKS.md Protocol

`TASKS.md` tracks active and recently completed work. Keep it up to date when addressing issues or adding new objectives. Completed tasks should be annotated with a completion note before eventual removal to preserve context.

## Contributing

1. **Install dependencies**:
   - Local: `bun install`
   - Docker: `bun run docker:build`
2. Read [`AGENTS.md`](../AGENTS.md) to understand repository conventions and agent guidelines.
3. Make changes, updating documentation and tasks along the way.
4. **Run quality checks**:
   - Local: `bun run format:write`, `bun run lint`, and the relevant test suites
   - Docker: `bun run docker:format`, `bun run docker:lint`, `bun run docker:test:unit`
5. Regenerate the system evaluation report if behaviour or test coverage changes.
6. Submit a pull request and allow the automation to verify your changes.

**Docker Development**: For isolated, reproducible environments, use Docker commands (e.g., `bun run docker:test:unit`). See [Docker Development Guide](operations/docker-guide.md) for details.

The automation stack is designed to improve iteratively; feel free to enhance the behaviours, evaluation heuristics, or workflows, but keep the guarantees above intact.

## Next Steps

- Explore [Automation Overview](automation/overview.md) to understand the GitHub Actions workflows
- Review [Agent Guidelines](../AGENTS.md) for Copilot automation conventions
- Read [Developer Guide](../DOCS.md) for additional learning resources and best practices
- Check [Runtime Strategy Documentation](runtime/strategy/creep-roles.md) to understand bot behavior
