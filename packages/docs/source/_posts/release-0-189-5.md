---
title: "Release 0.189.5: Fixing Copilot CLI MCP Configuration"
date: 2025-11-29T10:52:48.000Z
categories:
  - Release Notes
tags:
  - release
  - automation
  - copilot
  - mcp
  - bug-fix
---

We're pleased to announce **Screeps GPT v0.189.5**, a focused maintenance release that resolves a critical automation infrastructure issue affecting all GitHub Copilot workflows. This release restores proper Model Context Protocol (MCP) server integration, ensuring our autonomous agent swarm can access external tools and APIs as designed.

## Key Changes

This release addresses a single but critical bug in our automation infrastructure:

- **Fixed MCP Configuration in copilot-exec Action** - Resolved `error: unknown option '--mcp-config'` by using the standard Copilot CLI configuration path (`~/.config/github-copilot/servers.json`) instead of an unsupported command-line flag.

## Technical Details

### The Problem: Unsupported --mcp-config Flag

Our `copilot-exec` composite action, which powers all GitHub Copilot-driven workflows in this repository, was attempting to configure MCP servers using the `--mcp-config` command-line flag. However, this flag is **not supported** by the Copilot CLI, leading to workflow failures across the automation infrastructure.

**Error encountered:**
```
error: unknown option '--mcp-config'
Try 'copilot --help' for more information.
```

This broke critical automation workflows including:
- Strategic planning and monitoring
- Issue triage and reformulation
- Todo automation for implementation
- CI autofix workflows
- PTR telemetry analysis

All workflows that relied on MCP servers (Screeps API, Screeps Documentation, GitHub integration) were affected.

### Why This Approach Was Wrong

The initial implementation assumed the Copilot CLI accepted configuration via command-line flags, similar to many other CLI tools. This was a reasonable assumption but didn't align with how the Copilot CLI actually works.

The Copilot CLI follows a **configuration file convention** rather than command-line configuration. It automatically reads MCP server definitions from a standard location in the user's home directory: `~/.config/github-copilot/servers.json`.

### The Solution: Standard Configuration Path

**File:** `.github/actions/copilot-exec/action.yml`

The fix was straightforward but important:

1. **Changed configuration file location** from `$HOME/.copilot-mcp-config.json` to `~/.config/github-copilot/servers.json`
2. **Removed the `--mcp-config` flag** from command execution
3. **Removed unused environment variables** (`MCP_CONFIG_FILE` and `COPILOT_MCP_CONFIG`)
4. **Ensured the config directory exists** with `mkdir -p`

**Key changes:**

```yaml
# Before: Custom location with unsupported flag
mcp_config_file="$HOME/.copilot-mcp-config.json"
cmd=(copilot -p "$prompt" --mcp-config "$MCP_CONFIG_FILE")

# After: Standard Copilot CLI location
mcp_config_dir="$HOME/.config/github-copilot"
mcp_config_file="$mcp_config_dir/servers.json"
mkdir -p "$mcp_config_dir"
cmd=(copilot -p "$prompt")
# MCP config is read automatically from standard location
```

The Copilot CLI now automatically discovers and loads MCP server configurations without requiring explicit flags.

### Why This Design Is Better

1. **Follows CLI conventions** - Uses the standard XDG Base Directory specification (`~/.config/`)
2. **Automatic discovery** - No need for explicit flag passing; the CLI knows where to look
3. **Cleaner command invocation** - Reduced complexity in command construction
4. **Better maintainability** - Aligns with official Copilot CLI behavior and documentation
5. **Implicit configuration** - MCP servers are available to all Copilot CLI invocations without explicit wiring

### Design Rationale: Why Standard Paths Matter

Configuration management in CLI tools has evolved toward convention-based approaches rather than flag-based configuration. The [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html) establishes `~/.config/` as the standard location for user-specific configuration files on Unix-like systems.

By following this convention:
- Users can inspect and modify MCP server configurations directly
- Multiple tools can share configurations when appropriate
- Backup and migration workflows are simplified
- The tool's behavior is predictable and discoverable

The initial approach of using a custom location (`$HOME/.copilot-mcp-config.json`) and command-line flags added unnecessary complexity and didn't align with how the Copilot CLI ecosystem works.

## Impact

### Immediate Benefits

- **Restored automation functionality** - All Copilot-driven workflows can now execute successfully
- **MCP server integration working** - Screeps API, documentation, and GitHub MCP servers are accessible
- **Reduced configuration complexity** - Cleaner action implementation with fewer environment variables
- **Better alignment with Copilot CLI** - Following official conventions reduces future breaking changes

### Affected Workflows

This fix restores functionality to **20+ automation workflows** in the repository:

**Strategic & Monitoring:**
- `screeps-monitoring.yml` - PTR telemetry analysis and strategic planning
- `copilot-strategic-planner.yml` - Autonomous bot improvement recommendations

**Development Automation:**
- `copilot-todo-pr.yml` - Automated Todo issue implementation
- `copilot-issue-triage.yml` - Intelligent issue reformulation
- `copilot-ci-autofix.yml` - Automated CI failure resolution

**Quality Gates:**
- All guard workflows that use Copilot for analysis
- Post-merge automation for release management

### MCP Server Ecosystem

The fix ensures proper integration with our MCP server stack:

1. **Screeps API MCP** (`@ralphschuler/screeps-api-mcp`) - Direct Screeps console and API access
2. **Screeps Docs MCP** (`@modelcontextprotocol/server-screeps`) - Official game documentation
3. **Screeps Wiki MCP** (`@modelcontextprotocol/server-screeps-wiki`) - Community knowledge base
4. **GitHub MCP** (built-in) - Repository operations and code search

These servers enable autonomous agents to:
- Query game state and performance metrics
- Reference accurate API documentation
- Search community best practices
- Create issues, manage PRs, and modify code

## Related Issues

- **Closes #1545** - error: unknown option '--mcp-config'
- **Fixes #1275** - MCP configuration not working in Copilot workflows
- **Implemented via PR #1546**

## Breaking Changes

None. This is a pure bug fix that restores intended functionality. No user-facing behavior changes.

## What's Next

With automation infrastructure restored, the focus returns to:

1. **Task System Enhancements** - Continuing work on cross-room coordination (#1526)
2. **Performance Optimization** - CPU profiling and bottleneck analysis (#961)
3. **Strategic Planning** - Autonomous improvement recommendations from monitoring data
4. **Multi-Room Expansion** - Coordinating resource logistics across multiple rooms

## Acknowledgments

This fix was implemented by the Copilot coding agent in response to issue #1545, demonstrating the value of having autonomous agents that can fix their own infrastructure when issues are clearly documented.

**Implemented by:** @Copilot  
**Reviewed by:** @ralphschuler

---

**Full Changelog:** [v0.189.3...v0.189.5](https://github.com/ralphschuler/.screeps-gpt/compare/v0.189.3...v0.189.5)

**Download:** [v0.189.5 Release](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.189.5)
