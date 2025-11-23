# Screeps GPT

**An autonomous AI playground where multiple GitHub Copilot agents collaboratively develop, test, review, and deploy a Screeps bot.**

Screeps GPT is an experimental project that demonstrates how a swarm of specialized AI agents can autonomously manage the entire software development lifecycle of a [Screeps](https://screeps.com/) MMO bot. Built on GitHub Actions and the GitHub Copilot CLI, the system orchestrates development workflows, enforces quality standards, and continuously improves both the bot's game strategy and the development infrastructure itself.

## What is Screeps GPT?

Screeps GPT combines:

- **Autonomous Development**: AI agents write code, fix bugs, implement features, and refactor components based on issue specifications and monitoring feedback
- **Intelligent Automation**: GitHub Actions workflows powered by Copilot CLI handle code reviews, testing, deployment, and system monitoring
- **Self-Improving System**: The bot continuously evaluates its own performance in the Screeps game and generates improvement recommendations
- **Collaborative Agent Swarm**: Multiple specialized Copilot agents work together—some focus on code quality, others on documentation, deployment, or performance monitoring

## System Architecture

The project operates through three integrated layers:

### 1. Runtime AI (Screeps Bot)

A TypeScript-based Screeps bot with autonomous creep management, resource optimization, and strategic decision-making. The bot runs in the Screeps MMO and is designed to be continuously improved by the agent swarm.

**Key Components:**

- Behavior controllers for creep roles (harvesters, upgraders, builders, miners)
- Bootstrap phase system for optimal early-game RCL progression ([docs](docs/runtime/bootstrap-phases.md))
- Memory management and state persistence
- Performance monitoring and CPU optimization
- Health evaluation and improvement recommendation system

### 2. Development Infrastructure

Yarn-managed TypeScript codebase with comprehensive testing, linting, and build automation.

**Technology Stack:**

- **Runtime**: Node.js 18–22 with Yarn 4+ (Berry)
- **Build**: esbuild for fast bundling
- **Testing**: Vitest with unit, e2e, and regression test suites (including documentation build validation)
- **Quality**: ESLint, Prettier, pre-commit hooks

### 3. AI Agent Orchestration

GitHub Actions workflows that orchestrate specialized Copilot agents for different automation tasks.

**Agent Types:**

- **Issue Triage Agent**: Reformulates and labels incoming issues
- **Todo Agent**: Implements features from issue specifications
- **Review Agent**: Performs scheduled repository audits
- **CI Auto Issue Agent**: Creates tracking issues for failing workflows
- **Stats Monitor Agent**: Collects PTR performance data and bot telemetry
- **Spec-Kit Agent**: Generates detailed implementation plans from requirements

See [Automation Overview](packages/docs/source/docs/automation/overview.md) for complete workflow documentation.

## Repository Structure

The repository is organized as a monorepo with clear package boundaries:

```
/
  /packages
    /bot                 # Core Screeps AI implementation
    /docs                # Hexo documentation site
    /utilities           # Build tooling and deployment scripts
    /screeps-profiler    # CPU profiling library
    /screeps-perf        # Performance optimization library
    /screeps-metrics     # Metrics collection library
    /screeps-logger      # Logging library
    /screeps-*           # Additional Screeps utility packages
  /.github         # GitHub workflows, actions, configs
  /reports         # CI/CD reports and artifacts
  /tests           # Test suites (unit, e2e, regression)
  package.json     # Root workspace configuration
```

**Package Details:**

- **`packages/bot/`** - Game runtime code, behaviors, memory management, and AI logic
- **`packages/docs/`** - Documentation site built with Hexo (source, themes, config)
- **`packages/utilities/`** - Build scripts, deployment tools, monitoring utilities
- **`packages/screeps-profiler/`** - CPU profiling with decorator support and build-time optimization
- **`packages/screeps-perf/`** - Performance optimizations (array methods, memory cleanup, pathfinding cache)
- **`packages/screeps-metrics/`** - Metrics collection using official game APIs
- **`packages/screeps-logger/`** - Logging utilities for Screeps

All packages share a common root configuration for TypeScript, ESLint, and testing, while maintaining independent `package.json` files for isolated dependency management.

## Quick Start

### Prerequisites

- [Yarn](https://yarnpkg.com) v1.22+ (or Docker for containerized development)
- [Node.js](https://nodejs.org/) 18.x–22.x
- Screeps account with API token

### Installation

**Option 1: Local Development**

```bash
yarn install
yarn build
yarn test:unit
```

**Option 2: Docker Development**

```bash
yarn docker:build
yarn docker:test:unit
```

### Deploy to Screeps

```bash
# Configure secrets: SCREEPS_TOKEN, SCREEPS_HOST (optional)
yarn deploy
```

**Task System (Default Since v0.32.0):**

The bot uses a priority-based task management system by default. **Benchmark testing shows 58.8% lower CPU usage** compared to the legacy role-based system.

The legacy role-based system is still available if needed:

```bash
# Disable task system via environment variable (build-time)
TASK_SYSTEM_ENABLED=false npm run build

# Or in-game console (runtime)
Memory.experimentalFeatures = { taskSystem: false };
```

See [Task System Architecture](docs/runtime/task-system.md) and [Evaluation Report](docs/runtime/task-system-evaluation.md) for details.

### Room Visuals

The runtime includes an in-game visualization system for debugging and monitoring bot activities. Enable room visuals via:

```bash
# Environment variable (build-time)
ROOM_VISUALS_ENABLED=true npm run build

# Or in-game console (runtime)
Memory.experimentalFeatures = { roomVisuals: true };
```

Room visuals display:

- Creep positions and roles with color-coded markers
- Energy harvesting operations (lines from harvesters to sources)
- Construction and repair targets with progress indicators
- Spawn queue status and production progress
- CPU usage and tick counter per room

Visuals are disabled by default to minimize CPU usage. See [Logging and Room Visuals](docs/runtime/logging-and-visuals.md) for configuration options and usage guide.

**📚 [Complete Getting Started Guide →](docs/getting-started.md)**

## Key Features

### 🤖 Autonomous Agent Swarm

Multiple specialized Copilot agents collaborate on different aspects of development:

- **Code Generation**: Implement features from specifications
- **Quality Assurance**: Automated testing, linting, and code review
- **Deployment**: Build, test, and deploy to Screeps servers
- **Monitoring**: Track bot performance and file improvement issues
- **Documentation**: Keep docs synchronized with code changes

### 🔄 Continuous Integration & Deployment

- **Quality Guards**: Automated linting, formatting, testing, and coverage checks on every PR
- **Semantic Versioning**: Automatic version bumping based on conventional commits
- **Automated Releases**: Tagged releases with auto-generated changelogs
- **Screeps Deployment**: Push to Screeps servers on new releases with automatic spawn status verification
- **Spawn Monitoring**: Scheduled checks every 30 minutes ensure bot stays active between deployments
- **Auto-Respawn**: Automatic respawn when all spawns are lost, with intelligent room selection and spawn placement
- **CI Issue Tracking**: Automatic issue creation for failing workflows with circuit breaker protection

### 📊 Self-Evaluation & Improvement

- **Runtime Evaluation**: Bot analyzes its own performance and generates improvement recommendations
- **Resilient PTR Monitoring**: Multi-source telemetry collection (Stats API + Console fallback) eliminates monitoring blackouts
- **Data Collection Pipeline**: Automated bot performance monitoring every 30 minutes collecting snapshots, stats, and profiler data
- **Data-Driven Baselines**: Automatic statistical baseline establishment from 48+ hours of performance data for intelligent anomaly detection
- **30-Day Analytics**: Automated collection and visualization of bot performance metrics with interactive charts
- **Performance Benchmarking**: Private Screeps server testing with bot-vs-bot competitive simulation
- **Regression Testing**: Comprehensive test suites prevent quality degradation
- **Coverage Tracking**: Ensure critical code paths remain tested

### 👁️ Visual Debugging & Communication

- **Creep Communication**: Emoji-based visual feedback for creep actions via `creep.say()`
- **Configurable Verbosity**: Four levels from disabled to verbose for different debugging needs
- **Room Visuals**: Optional task goal visualization with lines and circles
- **Runtime Configuration**: Toggle communication settings in-game without redeployment
- **CPU-Aware**: Built-in CPU budget management (<1% overhead with default settings)

### 📚 Documentation-First Approach

- **Auto-generated Docs Site**: GitHub Pages site built from markdown documentation
- **Living Documentation**: Docs stay synchronized with code through automation
- **Agent Knowledge Base**: Comprehensive guides for both humans and AI agents

## Documentation

### 📖 Core Documentation

- **[Getting Started Guide](docs/getting-started.md)** - Complete setup and development workflow
- **[Developer Guide](DOCS.md)** - In-depth learning resources and best practices
- **[Agent Guidelines](AGENTS.md)** - Comprehensive automation agent documentation

### 🔧 Technical Documentation

- **[Automation Overview](packages/docs/source/docs/automation/overview.md)** - Complete workflow documentation
- **[Runtime Architecture](docs/getting-started.md#runtime-architecture)** - Bot component overview
- **[Creep Communication System](docs/runtime/creep-communication.md)** - Visual feedback and debugging
- **[Docker Development](docs/operations/docker-guide.md)** - Containerized development guide
- **[Deployment](docs/operations/deployment-troubleshooting.md)** - Deployment and troubleshooting
- **[Performance Testing](docs/testing/private-server.md)** - Bot benchmarking with private Screeps server

### 📊 Monitoring & Operations

- **[Resource Allocation](docs/operations/resource-allocation.md)** - Account configuration and CPU/memory limits
- **[CPU Timeout Diagnostic Runbook](docs/operations/cpu-timeout-diagnosis.md)** - CPU timeout diagnosis and resolution
- **[Monitoring Alert Playbook](docs/operations/monitoring-alerts-playbook.md)** - Alert response procedures
- **[CPU Optimization Strategies](docs/runtime/operations/cpu-optimization-strategies.md)** - CPU budget allocation and optimization
- **[PTR Monitoring](docs/operations/stats-monitoring.md)** - Performance tracking on test realm
- **[Respawn Handling](docs/operations/respawn-handling.md)** - Automatic respawn detection
- **[Workflow Troubleshooting](docs/operations/workflow-troubleshooting.md)** - Common CI/CD issues

### 🎯 Strategy & Development

- **[Strategic Roadmap](docs/strategy/roadmap.md)** - Current phase status, success metrics, and strategic priorities (Phase 1-5)
- **[Phase Documentation](docs/strategy/phases/)** - Detailed objectives and implementation status for each development phase
- **[Learning Insights](docs/strategy/learning/)** - Documented patterns, lessons learned, and strategic insights
- **[Architectural Decisions](docs/strategy/decisions/)** - ADRs documenting significant design choices
- **[Creep Roles](docs/runtime/strategy/creep-roles.md)** - Bot behavior documentation
- **[Task System Architecture](docs/runtime/task-system.md)** - Priority-based task management system (experimental)
- **[Task Prioritization](docs/runtime/strategy/task-prioritization.md)** - Decision-making logic
- **[Scaling Strategies](docs/runtime/strategy/scaling-strategies.md)** - Room expansion plans
- **[Competitive Bot Development Guide](docs/reference/screeps-competitive-guide.md)** - Advanced strategies reference covering game mechanics, optimization, and competitive play
- **[Overmind Architecture Analysis](docs/research/overmind-analysis.md)** - Research on Overmind bot patterns for integration (Task persistence, CPU optimization, multi-room scaling)

**[📚 Complete Documentation Index →](docs/index.md)**

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork and clone** the repository
2. **Install dependencies**: `yarn install` (or use Docker: `yarn docker:build`)
3. **Review documentation**: Read [AGENTS.md](AGENTS.md) for repository conventions
4. **Make your changes**: Update code, tests, and documentation together
5. **Run quality checks**: `yarn format:write && yarn lint && yarn test:unit && yarn test:docs`
6. **Submit a PR**: The automation will validate your changes

**Need help?** Check out:

- [Contributing Guidelines](docs/getting-started.md#contributing) - Detailed contribution workflow
- [Good First Issues](https://github.com/ralphschuler/.screeps-gpt/labels/good-first-issue) - Beginner-friendly tasks
- [TASKS.md](TASKS.md) - Active development priorities

## Automation Workflows

The repository uses 14 GitHub Actions workflows orchestrating the agent swarm:

- **Quality Guards** (`guard-*.yml`) - Linting, formatting, testing, coverage on every PR
- **Post-Merge Release** - Semantic versioning and automated releases (triggers deployment and blog generation)
- **Deploy** - Automatic deployment to Screeps triggered by post-merge-release completion, with post-deployment spawn status checking
- **Blog Generation** - Automated changelog-to-blog conversion triggered by post-merge-release completion
- **Copilot Agents** - Issue triage, Todo automation, code review, CI issue tracking
- **PTR Monitor** - Continuous bot data collection (snapshots, stats, telemetry, profiler data)
- **Spec-Kit** - Specification-driven development workflow
- **Stale Issue Management** - Automated cleanup of inactive issues (60-day inactivity threshold)

**Workflow Dependencies:** The post-merge-release workflow triggers both deploy and blog generation workflows automatically upon successful completion, ensuring coordinated release execution.

**[Complete Workflow Documentation →](packages/docs/source/docs/automation/overview.md)**

### Stale Issue Policy

Issues inactive for **60 days** are automatically labeled as `stale` and will be closed after **14 additional days** of inactivity. This helps maintain a clean issue backlog and ensures active issues remain visible.

**Exempt Issues:** Issues labeled with `pinned`, `security`, `priority/critical`, or `priority/high` are never marked as stale.

**Preventing Auto-Close:** To keep an issue open, either:

- Add a comment to show continued interest
- Remove the `stale` label manually
- Add one of the exempt labels

## Configuration

### Required Secrets

Configure these GitHub secrets for full automation functionality:

**Screeps API Access:**

- `SCREEPS_TOKEN` - Screeps API authentication token
- `SCREEPS_EMAIL` - (Optional) Screeps account email
- `SCREEPS_PASSWORD` - (Optional) Screeps account password
- `SCREEPS_STATS_TOKEN` - (Optional) Screeps Stats API token

**Notifications:**

- `PUSH_TOKEN` - Push by Techulus API token for push notifications (optional)
- `SMTP_HOST` - SMTP server hostname for email notifications (optional)
- `SMTP_PORT` - SMTP server port (default: 587, optional)
- `SMTP_USER` - SMTP username for email authentication (optional)
- `SMTP_PASSWORD` - SMTP password for email authentication (optional)
- `SMTP_FROM` - From email address (defaults to SMTP_USER if not specified, optional)

**CI/CD:**

- `COPILOT_TOKEN` - GitHub Copilot CLI token for autonomous agent operations
- `PUSH_TOKEN` - GitHub token with push access for automated commits

### Repository Variables

Configure these GitHub repository variables:

**Screeps Configuration:**

- `SCREEPS_HOST` - Screeps server host (default: screeps.com)
- `SCREEPS_SHARD` - Target shard (default: shard3)
- `SCREEPS_BRANCH` - Deployment branch (default: default)
- `PROFILER_ENABLED` - Enable profiler in production builds (default: true). Set to `false` to disable CPU profiling and reduce bundle size

**Notifications:**

- `EMAIL_NOTIFY_TO` - Email address for critical notifications (e.g., `screeps-gpt+notify@nyphon.de`)

**GitHub Projects Integration (Optional):**

- `PROJECT_NUMBER` - GitHub Project number for automated issue/PR tracking (e.g., `1`)
- `PROJECT_OWNER` - GitHub username or organization that owns the project (e.g., `ralphschuler`)

If `PROJECT_NUMBER` and `PROJECT_OWNER` are not set, project sync workflows will gracefully skip project operations. To validate your project configuration, run:

```bash
npm run validate:project-config
```

See [GitHub Projects Setup Guide](docs/automation/github-projects-setup.md) for detailed project integration documentation.

See [Push Notification Documentation](docs/automation/push-notifications.md) for details on notification setup.

## Project Status

- ✅ **Active Development**: Bot runs autonomously on Screeps PTR
- ✅ **Full CI/CD**: Automated testing, versioning, and deployment
- ✅ **Agent Swarm**: Multiple Copilot agents collaborating on development
- 🚧 **Continuous Improvement**: Self-evaluating and evolving strategies

## Using as an NPC Bot

This package can be used as an NPC bot on your Screeps private server. The package is published to GitHub Packages npm registry.

### Installation

```bash
# Configure npm to use GitHub Packages for @ralphschuler scope
npm config set @ralphschuler:registry https://npm.pkg.github.com

# Install the package
npm install @ralphschuler/screeps-gpt
```

**Note**: You'll need a GitHub personal access token with `read:packages` scope to install packages from GitHub Packages. Configure it with:

```bash
npm login --scope=@ralphschuler --registry=https://npm.pkg.github.com
```

### Using on Private Server

Once installed, you can spawn the bot on your private server using the Screeps console:

```javascript
// List available bots
help(bots);

// Spawn the bot in a specific room
bots.spawn("screeps-gpt", "W7N3", {
  name: "ScreensGPT", // Bot player name (optional)
  cpu: 100, // CPU limit (optional, default: 100)
  gcl: 1, // Global Control Level (optional, default: 1)
  x: 25, // Spawn X position (optional, default: random)
  y: 25 // Spawn Y position (optional, default: random)
});
```

The bot AI is located in the `dist/main.js` file, which is the compiled and bundled version of the entire codebase.

### Publishing Updates

The package is automatically published to GitHub Packages when a new release is created. The workflow can also be triggered manually via GitHub Actions.

## License

MIT © OpenAI Automations

---

**Built with:** TypeScript • Yarn • GitHub Actions • GitHub Copilot CLI • Screeps API
