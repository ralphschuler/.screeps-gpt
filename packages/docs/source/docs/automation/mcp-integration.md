---
title: MCP Server Integration Guide
date: 2025-11-28T09:00:00.000Z
layout: page
---

# MCP Server Integration Guide

This guide documents how to effectively use Model Context Protocol (MCP) servers in Copilot workflows to access Screeps game knowledge, official documentation, and community wisdom.

## Overview

The repository integrates three Screeps-specific MCP servers that extend Copilot's capabilities with real-time access to game information:

| MCP Server | Docker Image | Purpose |
|------------|--------------|---------|
| **screeps-docs-mcp** | `ghcr.io/ralphschuler/screeps-docs-mcp` | Official Screeps API documentation |
| **screeps-wiki-mcp** | `ghcr.io/ralphschuler/screeps-wiki-mcp` | Community wiki knowledge and strategies |
| **screeps-mcp** | `ghcr.io/ralphschuler/screeps-mcp` | Live game API access (console, memory, stats) |

All Screeps MCP servers are run using Docker containers for improved isolation and reproducibility.

## Configuration Files

MCP server configurations are stored in `.github/mcp/`:

```
.github/mcp/
├── all-servers.json       # All servers combined (recommended)
├── screeps-mcp.json       # Live game API server
├── screeps-docs-mcp.json  # Official documentation server
├── screeps-wiki-mcp.json  # Community wiki server
├── screeps-api.json       # Full API configuration
└── playwright.json        # Browser automation (optional)
```

## Available Tools

### Screeps Documentation MCP (`screeps-docs-mcp`)

Access official Screeps API documentation and game mechanics:

| Tool | Description | Example Use Case |
|------|-------------|------------------|
| `screeps_docs_search` | Search documentation for topics | Finding pathfinding optimization techniques |
| `screeps_docs_get_api` | Get specific API object documentation | Understanding `Spawn.spawnCreep()` parameters |
| `screeps_docs_get_mechanics` | Get game mechanics documentation | Learning how CPU limit works |
| `screeps_docs_list_apis` | List all available API objects | Discovering available structures |
| `screeps_docs_list_mechanics` | List all mechanics topics | Finding all game mechanics categories |

### Screeps Wiki MCP (`screeps-wiki-mcp`)

Access community knowledge, strategies, and best practices:

| Tool | Description | Example Use Case |
|------|-------------|------------------|
| `screeps_wiki_search` | Search wiki articles | Finding base layout patterns |
| `screeps_wiki_get_article` | Fetch specific wiki article | Getting detailed bunker designs |
| `screeps_wiki_list_categories` | List wiki categories | Browsing available strategy guides |
| `screeps_wiki_get_table` | Extract table data from articles | Getting `BODYPART_COST` or `STRUCTURE_HITS` constants |

### Screeps MCP (`screeps-mcp`)

Access live game data and execute console commands:

| Tool | Description | Example Use Case |
|------|-------------|------------------|
| `screeps_console` | Execute console commands | Running diagnostic commands |
| `screeps_memory_get` | Read Memory objects | Checking room configurations |
| `screeps_memory_set` | Update Memory objects | Adjusting runtime settings |
| `screeps_stats` | Query performance metrics | Getting current CPU/energy stats |

## Usage Patterns

### Strategic Planning Workflow

When analyzing bot performance or planning improvements, use MCP tools to gather context:

```javascript
// Research optimization techniques before proposing changes
screeps_wiki_search("cpu optimization techniques");
screeps_docs_get_mechanics("pathfinding");

// Get API details for structures being modified
screeps_docs_get_api("StructureLink");
screeps_docs_get_api("StructureTerminal");

// Get game constants for calculations
screeps_wiki_get_table("BODYPART_COST");
screeps_wiki_get_table("CONTROLLER_LEVELS");
```

### Issue Triage Workflow

When triaging issues related to game mechanics:

```javascript
// For harvesting issues
screeps_docs_get_api("Source");
screeps_wiki_search("harvesting patterns");

// For pathfinding issues
screeps_docs_get_mechanics("pathfinding");
screeps_wiki_search("pathfinder optimization");

// For combat issues
screeps_docs_get_api("Tower");
screeps_wiki_search("tower targeting");
```

### Development Workflow

When implementing new features:

```javascript
// Before implementing a feature, research best practices
screeps_wiki_search("link network design");
screeps_docs_get_api("StructureLink");

// Get constants for implementation
screeps_wiki_get_table("STRUCTURE_HITS");
screeps_wiki_get_table("LINK_CAPACITY");
```

## Workflow Integration

### Using MCP Servers in Workflows

Add MCP servers to any workflow using the `copilot-exec` action:

```yaml
- name: Run Copilot with Screeps knowledge
  uses: ./.github/actions/copilot-exec
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    SCREEPS_TOKEN: ${{ secrets.SCREEPS_TOKEN }}
    SCREEPS_SHARD: ${{ vars.SCREEPS_SHARD || 'shard1' }}
  with:
    copilot-token: ${{ secrets.COPILOT_TOKEN }}
    prompt-path: .github/copilot/prompts/my-prompt
    additional-mcp-config: '@.github/mcp/all-servers.json'
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SCREEPS_TOKEN` | Yes (for screeps-mcp) | API token for live game access |
| `SCREEPS_SHARD` | No | Target shard (default: shard1) |
| `DOCS_CACHE_TTL` | No | Documentation cache lifetime (default: 3600s) |
| `WIKI_CACHE_TTL` | No | Wiki cache lifetime (default: 3600s) |

## Best Practices

### When to Use MCP Tools

**Do use MCP tools when:**
- Implementing new game features that require accurate API knowledge
- Triaging issues related to game mechanics
- Planning strategic improvements to bot behavior
- Validating assumptions about game constants
- Researching optimization techniques from community knowledge

**Don't use MCP tools when:**
- Working on infrastructure-only changes (CI/CD, documentation structure)
- Making simple code refactoring changes
- Fixing build/lint errors that don't relate to game logic

### Research Before Implementation

Always gather game knowledge before proposing or implementing changes:

1. **Search official docs** for API specifications
2. **Search wiki** for community best practices
3. **Get specific constants** when calculations are needed
4. **Validate assumptions** against current documentation

### Include Context in Issues

When creating strategic issues, include relevant game knowledge:

```markdown
## Game Mechanics Reference

**API Documentation:**
- `StructureLink.transferEnergy()` supports up to 30 range
- Link cooldown is calculated as `Math.max(1, Math.abs(delay))`

**Community Knowledge:**
- Wiki recommends source-to-storage link networks for RCL 5+
- Optimal link placement within 2 range of storage

**Game Constants:**
- `LINK_CAPACITY`: 800
- `LINK_COOLDOWN`: 1
- `LINK_LOSS_RATIO`: 0.03
```

## Workflows Using MCP Servers

The following workflows leverage Screeps MCP servers:

| Workflow | MCP Servers | Purpose |
|----------|-------------|---------|
| `copilot-strategic-planner.yml` | All servers | Strategic analysis with game knowledge |
| `copilot-issue-triage.yml` | Docs + Wiki | Context-aware issue reformulation |
| `copilot-todo-daily.yml` | All servers | Informed prioritization decisions |
| `screeps-monitoring.yml` | screeps-mcp | Live game monitoring |

## Testing MCP Servers

### MCP Inspector Integration

Each MCP server package includes automated tests using the official MCP SDK client for protocol compliance testing. This approach implements the testing methodology from [MCP Inspector](https://github.com/modelcontextprotocol/inspector).

**Available test commands:**

```bash
# Test individual MCP servers
cd packages/screeps-mcp && npm run test:inspector
cd packages/screeps-docs-mcp && npm run test:inspector
cd packages/screeps-wiki-mcp && npm run test:inspector

# Test all MCP servers from root
yarn test:mcp:inspector

# Interactive inspection (UI mode - requires Node.js 22.7.5+)
cd packages/screeps-mcp && npm run inspect

# CLI inspection
cd packages/screeps-mcp && npm run inspect:cli
```

**What is tested:**

- **Protocol compliance**: Connection establishment and capability negotiation
- **Tools listing**: All registered tools are properly exposed with descriptions
- **Resources listing**: All resources are available with correct URI schemes
- **Schema validation**: Tool input schemas are properly defined

### Manual Testing with MCP Inspector

For interactive debugging and testing, use the MCP Inspector UI:

```bash
# Start the Inspector with a specific MCP server
npx @modelcontextprotocol/inspector node packages/screeps-mcp/dist/server.js

# The Inspector UI opens at http://localhost:6274
```

The Inspector provides:
- Visual interface for tool and resource exploration
- Real-time testing of tool calls
- Request/response logging
- Protocol compliance verification

## Troubleshooting

### Common Issues

**MCP server not responding:**
- Verify `SCREEPS_TOKEN` is set in repository secrets
- Check workflow logs for MCP initialization errors
- Ensure `additional-mcp-config` path is correct

**Outdated documentation returned:**
- Increase `DOCS_CACHE_TTL` or `WIKI_CACHE_TTL` to refresh cache
- MCP servers cache responses; restart workflow to clear cache

**Tool calls timing out:**
- MCP servers may have rate limits
- Add delays between multiple consecutive tool calls
- Consider caching frequently-accessed constants locally

### Verifying MCP Availability

In workflow logs, successful MCP initialization shows:

```
[copilot-exec] MCP servers configured: github, screeps-mcp, screeps-docs, screeps-wiki
[copilot-exec] Additional MCP config loaded from: .github/mcp/all-servers.json
```

## Related Documentation

- [Automation Overview](overview.html) - Complete workflow documentation
- [Autonomous Monitoring](autonomous-monitoring.html) - Monitoring workflow details
- [Debugging Workflows](debugging-workflows.html) - Troubleshooting workflow issues
- [AGENTS.md](../../../../../../../AGENTS.md) - Agent-specific MCP usage guidelines
