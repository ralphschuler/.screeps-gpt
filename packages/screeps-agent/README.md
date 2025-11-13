# @ralphschuler/screeps-agent

Autonomous agent system for Screeps bot development with Docker-based MCP server interaction.

## Overview

This package provides an autonomous agent that can perform development tasks for Screeps bots, including code review, feature implementation, testing, and deployment orchestration. The agent integrates with the Screeps MCP (Model Context Protocol) server to interact with game state and bot runtime.

## Features

- **Autonomous Development**: AI-driven code implementation and fixes
- **Code Review**: Automated review against Screeps best practices
- **Testing Integration**: Execute and validate test suites
- **Deployment Management**: Orchestrate deployments with health monitoring
- **MCP Integration**: Seamless connection to Screeps MCP server
- **Docker Support**: Containerized execution environment
- **Multiple Autonomy Levels**: Manual, semi-auto, and full-auto modes
- **Comprehensive Logging**: Detailed action tracking and reporting

## Installation

```bash
npm install @ralphschuler/screeps-agent
```

## Quick Start

### Local Execution

```bash
# Set environment variables
export SCREEPS_TOKEN="your-screeps-token"
export SCREEPS_HOST="screeps.com"
export SCREEPS_SHARD="shard3"

# Run agent
npx screeps-agent --task=run_tests
```

### Docker Execution

```bash
# Build Docker image
docker-compose build agent

# Run agent with task
SCREEPS_TOKEN="your-token" AGENT_TASK="run_tests" docker-compose up agent
```

## Configuration

### Environment Variables

**Required (one of):**

- `SCREEPS_TOKEN` - Screeps API token (recommended)
- `SCREEPS_EMAIL` + `SCREEPS_PASSWORD` - Screeps account credentials

**Optional:**

- `SCREEPS_HOST` - Screeps server host (default: "screeps.com")
- `SCREEPS_PORT` - Screeps server port (default: 443)
- `SCREEPS_PROTOCOL` - Protocol: "http" or "https" (default: "https")
- `SCREEPS_SHARD` - Target shard name (default: "shard3")
- `GITHUB_TOKEN` - GitHub token for repository operations
- `GITHUB_REPOSITORY` - Repository in owner/repo format
- `GITHUB_BASE_BRANCH` - Base branch for PRs (default: "main")
- `AUTONOMY_LEVEL` - Agent autonomy: "manual", "semi-auto", "full-auto" (default: "manual")
- `TIMEOUT` - Maximum execution time in minutes (default: 45)

## Agent Tasks

The agent supports the following task types:

### `review_pr`

Review pull request changes against Screeps best practices.

```bash
npx screeps-agent --task=review_pr
```

**Checks:**

- TypeScript strict mode compliance
- Performance patterns (pathfinding, caching)
- CPU efficiency
- Memory leak detection
- Screeps API best practices

### `implement_feature`

Implement features based on specifications.

```bash
npx screeps-agent --task=implement_feature
```

**Capabilities:**

- Generate implementation plans
- Create/modify code files
- Generate unit tests
- Update documentation

### `run_tests`

Execute test suites and validate results.

```bash
npx screeps-agent --task=run_tests
```

**Test Suites:**

- Unit tests
- E2E tests
- Regression tests
- Build validation
- Linting checks

### `optimize_performance`

Analyze and optimize bot performance.

```bash
npx screeps-agent --task=optimize_performance
```

**Analysis:**

- CPU usage monitoring
- Memory optimization
- Pathfinding efficiency
- Task prioritization

### `analyze_code`

Perform static code analysis.

```bash
npx screeps-agent --task=analyze_code
```

### `update_docs`

Update documentation based on code changes.

```bash
npx screeps-agent --task=update_docs
```

## Autonomy Levels

### Level 1: Manual (Default)

Agent suggests changes and waits for human approval before proceeding.

```bash
AUTONOMY_LEVEL=manual npx screeps-agent --task=implement_feature
```

**Use Cases:**

- Initial development
- Critical bug fixes
- Experimental features

### Level 2: Semi-Auto

Agent implements changes and creates PRs for human review.

```bash
AUTONOMY_LEVEL=semi-auto npx screeps-agent --task=implement_feature
```

**Use Cases:**

- Routine feature implementation
- Code refactoring
- Documentation updates

### Level 3: Full-Auto (Future)

Agent implements, tests, and merges changes autonomously.

```bash
AUTONOMY_LEVEL=full-auto npx screeps-agent --task=implement_feature
```

**Use Cases:**

- Automated dependency updates
- Performance optimizations
- Minor bug fixes

## MCP Integration

The agent connects to the Screeps MCP server for game state access:

```typescript
import { ScreensAgent } from "@ralphschuler/screeps-agent";

const agent = new ScreensAgent({
  name: "my-agent",
  version: "1.0.0",
  screeps: {
    token: process.env.SCREEPS_TOKEN,
    host: "screeps.com",
    shard: "shard3"
  },
  autonomyLevel: "manual"
});

await agent.initialize();

const result = await agent.executeTask({
  task: "run_tests",
  parameters: { suites: ["unit", "e2e"] }
});

await agent.shutdown();
```

### MCP Resources Available

- `screeps://game/rooms` - Room state and structures
- `screeps://game/creeps` - Creep status and roles
- `screeps://game/spawns` - Spawn queue and status
- `screeps://memory` - Bot memory structure
- `screeps://stats` - Performance and telemetry

### MCP Tools Available

- `screeps.console` - Execute console commands
- `screeps.memory.get` - Read memory
- `screeps.memory.set` - Update memory
- `screeps.stats` - Query performance metrics

## API

### ScreensAgent

Main agent class for orchestrating development tasks.

#### Constructor

```typescript
new ScreensAgent(config: AgentConfig)
```

#### Methods

##### `initialize(): Promise<void>`

Initialize the agent and connect to MCP server.

##### `executeTask(context: TaskContext): Promise<TaskResult>`

Execute a development task.

##### `shutdown(): Promise<void>`

Disconnect and shutdown the agent.

### MCPClient

Low-level MCP client for Screeps operations.

#### Methods

##### `connect(): Promise<void>`

Connect to Screeps MCP server.

##### `getResource(uri: string): Promise<unknown>`

Get a resource from the MCP server.

##### `invokeTool(name: string, args: Record<string, unknown>): Promise<unknown>`

Invoke a tool on the MCP server.

### Capabilities

#### CodeReviewCapability

```typescript
const capability = new CodeReviewCapability(mcpClient);
const result = await capability.reviewChanges(files);
```

#### ImplementationCapability

```typescript
const capability = new ImplementationCapability(mcpClient);
const result = await capability.implementFeature(spec);
```

#### TestingCapability

```typescript
const capability = new TestingCapability(mcpClient);
const result = await capability.executeTests(["unit", "e2e"]);
```

#### DeploymentCapability

```typescript
const capability = new DeploymentCapability(mcpClient);
const result = await capability.deployBot("1.0.0");
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm run test
```

### Docker Development

```bash
# Build and run development container
docker-compose up agent-dev

# Run tests in container
docker-compose up agent-test
```

## Security

### Authentication

The agent supports two authentication methods:

1. **API Token** (recommended): Set `SCREEPS_TOKEN`
2. **Email/Password**: Set `SCREEPS_EMAIL` and `SCREEPS_PASSWORD`

API tokens are preferred as they can be easily revoked.

### Memory Safety

All memory operations include built-in safety checks to prevent prototype pollution attacks.

### Access Controls

- All operations require valid Screeps authentication
- Read operations are safe and non-destructive
- Write operations should be used with caution
- Human approval required for sensitive operations (autonomy level 1-2)

## Troubleshooting

### Connection Issues

```bash
# Verify MCP server is accessible
npx @ralphschuler/screeps-mcp

# Check authentication
SCREEPS_TOKEN="your-token" npx screeps-agent --task=run_tests
```

### Docker Issues

```bash
# Rebuild Docker image
docker-compose build --no-cache agent

# Check logs
docker-compose logs agent
```

### Performance Issues

```bash
# Increase timeout
TIMEOUT=90 npx screeps-agent --task=implement_feature

# Monitor CPU usage
npx screeps-agent --task=optimize_performance
```

## Examples

### Example 1: Code Review

```bash
# Review pull request changes
export SCREEPS_TOKEN="your-token"
export GITHUB_TOKEN="your-github-token"
export GITHUB_REPOSITORY="owner/repo"

npx screeps-agent --task=review_pr
```

### Example 2: Feature Implementation

```bash
# Implement new feature
export SCREEPS_TOKEN="your-token"
export AUTONOMY_LEVEL="semi-auto"

npx screeps-agent --task=implement_feature
```

### Example 3: Performance Optimization

```bash
# Analyze and optimize performance
export SCREEPS_TOKEN="your-token"

npx screeps-agent --task=optimize_performance
```

## Contributing

Contributions are welcome! Please follow the repository's contribution guidelines.

## License

MIT © OpenAI Automations

## Related Packages

- [@ralphschuler/screeps-mcp](../screeps-mcp) - Screeps MCP server
- [@ralphschuler/screeps-gpt](../..) - Main Screeps bot repository

## Changelog

See [CHANGELOG.md](../../CHANGELOG.md) for version history.
