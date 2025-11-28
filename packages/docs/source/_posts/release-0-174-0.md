---
title: "Release 0.174.0: Enhanced AI Context Awareness with Screeps MCP Integration"
date: 2025-11-28T00:23:44.057Z
categories:
  - Release Notes
tags:
  - release
  - automation
  - mcp-servers
  - copilot
  - ai-agents
---

We're excited to announce version 0.174.0 of Screeps GPT, featuring a significant enhancement to our autonomous agent ecosystem. This release integrates Screeps MCP (Model Context Protocol) servers directly into our Copilot automation workflows, enabling AI agents to access comprehensive Screeps game knowledge when making implementation decisions.

## Key Feature: Screeps MCP Server Integration

The headline feature of this release is the integration of two powerful MCP servers into our Copilot agent workflows:

- **Screeps Docs MCP**: Provides access to the official Screeps API documentation, mechanics guides, and technical references
- **Screeps Wiki MCP**: Connects to the community-maintained wiki at wiki.screepspl.us with gameplay strategies, best practices, and advanced techniques

### Why This Matters

One of the biggest challenges in autonomous bot development is ensuring that AI agents have accurate, up-to-date knowledge of the game mechanics they're working with. Previously, our Copilot agents relied solely on their training data and existing codebase context when implementing features or fixing bugs. This sometimes led to suboptimal implementations or missed opportunities to leverage advanced game mechanics.

With MCP server integration, our AI agents can now:

1. **Query Real-Time Documentation**: When implementing a feature involving energy harvesting, an agent can query the Screeps Docs MCP for precise API specifications
2. **Access Community Wisdom**: Agents can search the Screeps Wiki for established patterns and best practices (e.g., optimal creep body compositions, remote mining strategies)
3. **Make Informed Decisions**: Strategic planning agents can incorporate game mechanics knowledge when prioritizing improvements
4. **Reduce Hallucinations**: By grounding decisions in authoritative sources, we reduce the risk of implementing non-existent game features

## Technical Implementation

### MCP Tools Available to Agents

Our Copilot prompts now have access to five new tools:

- `screeps_docs_search`: Search the official Screeps documentation by keyword
- `screeps_docs_get_api`: Retrieve detailed API documentation for specific game objects or methods
- `screeps_docs_get_mechanics`: Access gameplay mechanics guides (e.g., CPU management, pathfinding, combat)
- `screeps_wiki_search`: Search the community wiki for strategy guides and patterns
- `screeps_wiki_get_article`: Retrieve complete wiki articles on specific topics

### Workflows Enhanced

We've updated nine Copilot agent prompts to utilize these MCP tools:

1. **researcher**: Uses wiki search when analyzing gameplay patterns and external bot architectures
2. **issue-triage**: Queries documentation to better understand bug reports involving game mechanics
3. **strategist**: Leverages both docs and wiki when evaluating strategic priorities
4. **strategic-planner**: Incorporates game mechanics knowledge into improvement roadmaps
5. **repository-audit**: Cross-references implementation patterns against best practices from the wiki
6. **repository-review**: Validates code changes against API documentation
7. **todo-issue**: Ensures feature implementations align with official API specifications
8. **todo-automation**: Verifies implementation approach before starting work
9. **screeps-monitor**: Uses game knowledge to provide better context in monitoring alerts

### Documentation Updates

To ensure our AI agents and human developers understand the new capabilities, we've updated three key documentation files:

- **AGENTS.md**: Added comprehensive documentation of both MCP servers, including available tools, use cases, and examples
- **Copilot Prompts**: Each affected prompt now includes instructions on when and how to use MCP tools
- **Authentication**: Documented that the MCP servers are read-only and require no additional secrets (public access)

## Design Rationale

### Why MCP Over Embedded Documentation?

We considered three approaches for providing game knowledge to our agents:

1. **Embed documentation in prompts**: Too verbose, consumes token budget, becomes stale
2. **Train custom models**: Expensive, time-consuming, not practical for a hobby project
3. **Use MCP servers**: Dynamic, always up-to-date, minimal token overhead

MCP servers won the evaluation because they provide just-in-time knowledge retrieval. Agents only query for information when needed, keeping prompt sizes manageable while ensuring access to the latest documentation.

### Selective Integration

We chose to integrate MCP tools into workflow prompts rather than making them universally available. This design decision stems from two considerations:

1. **Relevance**: Not all workflows benefit from game knowledge (e.g., build validation, linting)
2. **Cost Control**: Each MCP query consumes tokens and API calls. By limiting availability to relevant workflows, we optimize resource usage

### Read-Only Access

The MCP servers provide read-only access to documentation and wiki content. This aligns with our security principles:

- No risk of accidental game state modification
- No authentication secrets required
- Safe for untrusted or experimental agent workflows

## Impact on Development Workflow

### Improved Implementation Quality

With access to authoritative documentation, our Todo automation agent can now:

- Validate API usage patterns before implementation
- Choose optimal data structures based on game mechanics (e.g., RoomPosition serialization)
- Implement features using officially supported methods rather than workarounds

### Better Strategic Decisions

Our strategic planning agent can now:

- Prioritize features that align with established gameplay patterns
- Avoid implementing strategies that conflict with game mechanics
- Learn from the community's collective wisdom when planning improvements

### Enhanced Issue Triage

The issue triage agent can now:

- Understand whether reported bugs are actual issues or expected game behavior
- Suggest more accurate classifications by consulting documentation
- Provide better context in reformulated issues

## Example Use Case

Consider a scenario where an issue is filed: "Creeps aren't harvesting efficiently at RCL 3."

**Without MCP integration:**
- Triage agent labels it as `type/bug` based on description alone
- Todo agent implements a generic fix without understanding optimal RCL 3 patterns
- Solution may not align with game mechanics for that RCL

**With MCP integration:**
- Triage agent queries `screeps_wiki_search` for "RCL 3 harvesting"
- Discovers that RCL 3 is a transition point where container-based harvesting becomes viable
- Labels as `type/enhancement` and suggests implementing container detection
- Todo agent queries `screeps_docs_get_api` for Container and Source APIs
- Implements a container-aware harvesting strategy that aligns with community best practices

## What's Next

This MCP integration lays the groundwork for several future enhancements:

1. **Performance Metrics MCP**: We're exploring a custom MCP server to expose bot performance data to agents
2. **Codebase Analysis MCP**: A server that provides semantic code search and architecture insights
3. **Test Coverage MCP**: Integration with our test suite to help agents write better tests

We're also considering expanding MCP access to more workflows and potentially making the servers available to human developers through CLI tools.

## Migration Notes

This release requires no manual migration steps. The MCP servers are automatically available to workflows that have been updated to use them. If you're running a fork of this repository:

1. Ensure `AGENTS.md` is updated with MCP server documentation
2. Update affected Copilot prompt templates to include MCP tool instructions
3. No additional secrets or configuration required (MCP servers use public access)

## Acknowledgments

This release builds on the foundation established in v0.165.1, where we migrated to OpenAI's official `codex-action`. The MCP integration leverages the standardized MCP protocol, demonstrating the power of open standards in AI tooling.

Special thanks to the Screeps community for maintaining the excellent wiki at wiki.screepspl.us, which serves as one of our MCP data sources.

---

**Full Changelog**: [v0.173.0...v0.174.0](https://github.com/ralphschuler/.screeps-gpt/compare/v0.173.0...v0.174.0)

**Related Documentation**:
- [Automation Overview](../docs/automation/overview.md)
- [Agent Guidelines](../AGENTS.md)
- [Copilot Instructions](../.github/copilot-instructions.md)
