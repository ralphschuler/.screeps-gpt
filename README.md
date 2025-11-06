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
- Memory management and state persistence
- Performance monitoring and CPU optimization
- Health evaluation and improvement recommendation system

### 2. Development Infrastructure

Bun-managed TypeScript codebase with comprehensive testing, linting, and build automation.

**Technology Stack:**

- **Runtime**: Bun 1.3+ with TypeScript targeting Node.js 18–22
- **Build**: esbuild for fast bundling
- **Testing**: Vitest with unit, e2e, and regression test suites (including documentation build validation)
- **Quality**: ESLint, Prettier, pre-commit hooks

### 3. AI Agent Orchestration

GitHub Actions workflows that orchestrate specialized Copilot agents for different automation tasks.

**Agent Types:**

- **Issue Triage Agent**: Reformulates and labels incoming issues
- **Todo Agent**: Implements features from issue specifications
- **Review Agent**: Performs scheduled repository audits
- **CI Autofix Agent**: Automatically fixes failing workflows
- **Stats Monitor Agent**: Analyzes PTR performance and creates monitoring issues
- **Autonomous Monitor Agent**: Daily strategic analysis combining bot performance and repository health
- **Spec-Kit Agent**: Generates detailed implementation plans from requirements

See [Automation Overview](docs/automation/overview.md) for complete workflow documentation.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+ (or Docker for containerized development)
- [Node.js](https://nodejs.org/) 18.x–22.x
- Screeps account with API token

### Installation

**Option 1: Local Development**

```bash
bun install
bun run build
bun run test:unit
```

**Option 2: Docker Development**

```bash
bun run docker:build
bun run docker:test:unit
```

### Deploy to Screeps

```bash
# Configure secrets: SCREEPS_TOKEN, SCREEPS_HOST (optional)
bun run deploy

# Enable experimental task system (optional)
TASK_SYSTEM_ENABLED=true bun run deploy
```

**Experimental Features:**

The bot includes a priority-based task management system that can replace the legacy role-based behavior system. Enable it via:

```bash
# Environment variable (build-time)
TASK_SYSTEM_ENABLED=true npm run build

# Or in-game console (runtime)
Memory.experimentalFeatures = { taskSystem: true };
```

See [Task System Architecture](docs/runtime/task-system.md) for details.

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
- **CI Autofix**: Agents automatically fix failing workflows

### 📊 Self-Evaluation & Improvement

- **Runtime Evaluation**: Bot analyzes its own performance and generates improvement recommendations
- **Resilient PTR Monitoring**: Multi-source telemetry collection (Stats API + Console fallback) eliminates monitoring blackouts
- **Autonomous Strategic Analysis**: Combined bot performance and repository health monitoring every 30 minutes
- **Regression Testing**: Comprehensive test suites prevent quality degradation
- **Coverage Tracking**: Ensure critical code paths remain tested

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

- **[Automation Overview](docs/automation/overview.md)** - Complete workflow documentation
- **[Runtime Architecture](docs/getting-started.md#runtime-architecture)** - Bot component overview
- **[Docker Development](docs/operations/docker-guide.md)** - Containerized development guide
- **[Deployment](docs/operations/deployment-troubleshooting.md)** - Deployment and troubleshooting

### 📊 Monitoring & Operations

- **[PTR Monitoring](docs/operations/stats-monitoring.md)** - Performance tracking on test realm
- **[Respawn Handling](docs/operations/respawn-handling.md)** - Automatic respawn detection
- **[Workflow Troubleshooting](docs/operations/workflow-troubleshooting.md)** - Common CI/CD issues

### 🎯 Strategy & Development

- **[Development Roadmap](docs/strategy/roadmap.md)** - Comprehensive evolution plan from RCL 1-2 to multi-shard operations
- **[Architecture Alignment](docs/strategy/architecture.md)** - Roadmap integration with existing codebase
- **[Creep Roles](docs/runtime/strategy/creep-roles.md)** - Bot behavior documentation
- **[Task System Architecture](docs/runtime/task-system.md)** - Priority-based task management system (experimental)
- **[Task Prioritization](docs/runtime/strategy/task-prioritization.md)** - Decision-making logic
- **[Scaling Strategies](docs/runtime/strategy/scaling-strategies.md)** - Room expansion plans

**[📚 Complete Documentation Index →](docs/index.md)**

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork and clone** the repository
2. **Install dependencies**: `bun install` (or use Docker: `bun run docker:build`)
3. **Review documentation**: Read [AGENTS.md](AGENTS.md) for repository conventions
4. **Make your changes**: Update code, tests, and documentation together
5. **Run quality checks**: `bun run format:write && bun run lint && bun run test:unit && bun run test:docs`
6. **Submit a PR**: The automation will validate your changes

**Need help?** Check out:

- [Contributing Guidelines](docs/getting-started.md#contributing) - Detailed contribution workflow
- [Good First Issues](https://github.com/ralphschuler/.screeps-gpt/labels/good-first-issue) - Beginner-friendly tasks
- [TASKS.md](TASKS.md) - Active development priorities

## Automation Workflows

The repository uses 14 GitHub Actions workflows orchestrating the agent swarm:

- **Quality Guards** (`guard-*.yml`) - Linting, formatting, testing, coverage on every PR
- **Post-Merge Release** - Semantic versioning and automated releases
- **Deploy** - Automatic deployment to Screeps on version tags with post-deployment spawn status checking
- **Copilot Agents** - Issue triage, Todo automation, code review, CI autofix
- **PTR Monitor** - Continuous bot performance monitoring
- **Spec-Kit** - Specification-driven development workflow

**[Complete Workflow Documentation →](docs/automation/overview.md)**

## Project Status

- ✅ **Active Development**: Bot runs autonomously on Screeps PTR
- ✅ **Full CI/CD**: Automated testing, versioning, and deployment
- ✅ **Agent Swarm**: Multiple Copilot agents collaborating on development
- 🚧 **Continuous Improvement**: Self-evaluating and evolving strategies

## License

MIT © OpenAI Automations

---

**Built with:** TypeScript • Bun • GitHub Actions • GitHub Copilot CLI • Screeps API
