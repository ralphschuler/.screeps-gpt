# GitHub Copilot Custom Agents Evaluation

**Research Date:** November 2025  
**Purpose:** Evaluate official GitHub Copilot custom agents framework for potential migration of existing automation workflows  
**Official Documentation:** https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents  
**Related Issue:** #797

## Executive Summary

This research evaluates the official GitHub Copilot custom agents framework against the existing GitHub Actions + Copilot CLI workflow implementation in this repository. The evaluation considers feature capabilities, execution models, migration feasibility, and cost-benefit tradeoffs.

### Key Findings

- **Different Purpose:** Official custom agents are designed for IDE-based interactive assistance, NOT for workflow-based automation
- **No Scheduled Execution:** Custom agents cannot be triggered by cron schedules or GitHub events
- **No Migration Recommended:** Current workflow-based implementation is the correct architectural choice for automated CI/CD tasks
- **Complementary Use:** Custom agents and workflow automation can coexist for different use cases

### Decision: Keep Current Implementation

**Rationale:** The official GitHub Copilot custom agents framework serves a fundamentally different purpose (IDE assistance) than our current workflow automation needs (event-driven CI/CD automation). Migration would not be feasible or beneficial.

## Official Custom Agents Framework Overview

### What Are Custom Agents?

GitHub Copilot custom agents are specialized AI personas configured via markdown files that provide consistent, domain-specific assistance in supported IDEs. They are designed for:

- **Interactive IDE assistance** (VSCode, JetBrains, Eclipse, Xcode)
- **Developer experience enhancement** (code review, documentation, refactoring)
- **Consistent persona and context** across interactions
- **Organization-wide coding standards** enforcement

### Configuration Structure

Custom agents are defined in `.github/agents/` directory using markdown files with YAML frontmatter:

```markdown
---
name: readme-specialist
description: Specialized agent for creating and improving README files
tools: ["read", "search", "edit"]
metadata:
  team: Documentation
---

You are a documentation specialist focused on README files.
Limit scope to documentation files only; do not modify code files.
```

### Key Configuration Options

| Property      | Type   | Purpose                                            |
| ------------- | ------ | -------------------------------------------------- |
| `name`        | string | Unique agent identifier                            |
| `description` | string | Agent's expertise and behavior description         |
| `target`      | string | Context (e.g., `vscode`, `github-copilot`)         |
| `tools`       | array  | Available tools (`read`, `search`, `edit`)         |
| `mcp-servers` | object | MCP server configuration for extended capabilities |
| `metadata`    | object | Arbitrary annotation data                          |

### Execution Model

| Aspect             | Custom Agents                 | Current Workflow Implementation                 |
| ------------------ | ----------------------------- | ----------------------------------------------- |
| **Trigger**        | Manual (user invokes in IDE)  | Event-driven (issue opened, labeled, scheduled) |
| **Environment**    | IDE (VSCode, JetBrains, etc.) | GitHub Actions runner                           |
| **Scheduling**     | Not supported                 | Native cron scheduling                          |
| **Context**        | IDE workspace context         | Full workflow context + MCP servers             |
| **Authentication** | User's Copilot subscription   | GitHub token + Copilot CLI token                |
| **Persistence**    | Session-based                 | Stateless per run (artifacts stored)            |

## Current Implementation Analysis

### Existing Copilot Automation Workflows

The repository implements 8 specialized Copilot workflows via GitHub Actions:

| Workflow                        | Trigger               | Purpose                      | Complexity |
| ------------------------------- | --------------------- | ---------------------------- | ---------- |
| `copilot-issue-triage.yml`      | Issue opened/reopened | Reformulate and label issues | High       |
| `copilot-todo-pr.yml`           | Issue labeled `Todo`  | Implement solution via PR    | Very High  |
| `copilot-ci-autofix.yml`        | CI failure event      | Automated failure resolution | High       |
| `copilot-review.yml`            | Scheduled (daily)     | Repository audits            | Medium     |
| `copilot-strategic-planner.yml` | Scheduled (8 hours)   | Strategic analysis           | Medium     |
| `copilot-email-triage.yml`      | Email notification    | Email-to-issue conversion    | Medium     |
| `copilot-changelog-to-blog.yml` | Post-release trigger  | Blog post generation         | Medium     |
| `copilot-todo-daily.yml`        | Scheduled (daily)     | Todo prioritization          | Medium     |

### Architecture Components

1. **Composite Action (`copilot-exec`)**: Shared infrastructure for Copilot CLI execution
   - Environment rendering for prompt templates
   - MCP server configuration and merging
   - Caching for performance optimization
   - Timeout and error handling

2. **Specialized Agents**: Role-based composite actions
   - `copilot-issue-agent`: Multi-mode issue management (triage/resolve)
   - `copilot-audit-agent`: Repository quality assessment
   - `copilot-review-agent`: Code review automation
   - `copilot-triage-agent`: Issue classification

3. **Prompt Templates**: Context-rich instructions in `.github/copilot/prompts/`
   - `issue-triage`: Issue reformulation and labeling
   - `todo-issue`: Implementation task resolution
   - `strategic-planner`: Performance analysis
   - `repository-audit`: Quality assessment

4. **MCP Integration**: Extended capabilities
   - GitHub MCP server (issues, PRs, code search)
   - Playwright MCP server (web automation)

## Feature Comparison Matrix

| Feature                    | Current Workflow Implementation  | Official Custom Agents                 | Notes                  |
| -------------------------- | -------------------------------- | -------------------------------------- | ---------------------- |
| **Scheduled Execution**    | ✅ Native cron support           | ❌ Not supported                       | Critical gap           |
| **Event-Driven Triggers**  | ✅ Full GitHub event support     | ❌ Manual invocation only              | Critical gap           |
| **Issue Automation**       | ✅ Full CRUD operations          | ⚠️ Limited (read context only)         | Workflows are superior |
| **PR Creation**            | ✅ Automated PR creation         | ⚠️ Via coding agent (separate feature) | Different mechanism    |
| **CI/CD Integration**      | ✅ Native workflow integration   | ❌ Not designed for CI/CD              | Critical gap           |
| **MCP Server Support**     | ✅ Full support via config       | ✅ Full support via config             | Equivalent             |
| **Context Management**     | ✅ Custom prompts with env vars  | ✅ YAML frontmatter + markdown         | Equivalent             |
| **Authentication**         | ✅ GitHub tokens + Copilot token | ✅ User subscription                   | Different models       |
| **IDE Integration**        | ❌ Not applicable                | ✅ Native IDE integration              | Custom agents superior |
| **Developer Experience**   | ⚠️ Workflow logs only            | ✅ Interactive chat                    | Custom agents superior |
| **Organization Discovery** | ❌ Not applicable                | ✅ Hierarchical discovery              | Custom agents only     |
| **Caching**                | ✅ Custom caching implementation | ❌ Session-based only                  | Workflows superior     |
| **Artifact Storage**       | ✅ GitHub Actions artifacts      | ❌ Not supported                       | Workflows superior     |
| **Cost Model**             | GitHub Actions minutes           | Copilot subscription                   | Different              |

## Migration Feasibility Assessment

### ❌ Cannot Migrate: Scheduled Workflows

The following workflows require scheduled execution, which custom agents do not support:

| Workflow                        | Schedule      | Why Migration is Not Feasible               |
| ------------------------------- | ------------- | ------------------------------------------- |
| `copilot-review.yml`            | Daily 9:00 AM | Custom agents have no scheduling capability |
| `copilot-strategic-planner.yml` | Every 8 hours | Periodic analysis requires cron triggers    |
| `copilot-todo-daily.yml`        | Daily 9:00 AM | Daily prioritization requires automation    |

### ❌ Cannot Migrate: Event-Driven Workflows

The following workflows respond to GitHub events, which custom agents cannot intercept:

| Workflow                        | Event Trigger         | Why Migration is Not Feasible                    |
| ------------------------------- | --------------------- | ------------------------------------------------ |
| `copilot-issue-triage.yml`      | Issue opened/reopened | Custom agents cannot subscribe to events         |
| `copilot-todo-pr.yml`           | Issue labeled         | Custom agents cannot react to label changes      |
| `copilot-ci-autofix.yml`        | CI failure            | Custom agents cannot intercept workflow failures |
| `copilot-email-triage.yml`      | Email notification    | Custom agents cannot receive external triggers   |
| `copilot-changelog-to-blog.yml` | Post-release          | Custom agents cannot chain from other workflows  |

### ⚠️ Potential Complementary Use

Custom agents could complement (not replace) existing automation for:

| Use Case                    | Implementation        | Benefit                                   |
| --------------------------- | --------------------- | ----------------------------------------- |
| **Interactive Code Review** | Custom agent in IDE   | Real-time feedback during development     |
| **Documentation Writing**   | Custom agent for docs | Consistent style and structure            |
| **Onboarding Assistance**   | Custom agent for repo | Help new contributors understand codebase |

## Cost-Benefit Analysis

### Benefits of Keeping Current Implementation

| Benefit                    | Impact   | Details                                             |
| -------------------------- | -------- | --------------------------------------------------- |
| **Proven Reliability**     | High     | 8 workflows in production with established patterns |
| **Full Event Support**     | Critical | Can respond to any GitHub event                     |
| **Scheduling Capability**  | Critical | Essential for periodic tasks                        |
| **CI/CD Integration**      | High     | Native integration with build/test/deploy           |
| **Artifact Storage**       | Medium   | Persistent storage of reports and logs              |
| **Custom Caching**         | Medium   | Performance optimization for prompt results         |
| **Existing Documentation** | Medium   | AGENTS.md, workflow docs, operational guides        |

### Costs of Migration Attempt

| Cost                       | Impact   | Details                                      |
| -------------------------- | -------- | -------------------------------------------- |
| **Feature Loss**           | Critical | Would lose scheduling and event triggers     |
| **Architectural Mismatch** | Critical | Custom agents designed for different purpose |
| **Implementation Effort**  | High     | Would require complete redesign              |
| **User Behavior Change**   | High     | Would require manual invocation              |
| **Testing Infrastructure** | High     | Existing tests would not apply               |

### Potential Benefits of Custom Agents (Complementary)

| Benefit                    | Impact | Details                                           |
| -------------------------- | ------ | ------------------------------------------------- |
| **IDE Integration**        | Medium | Better developer experience for interactive tasks |
| **Organization Discovery** | Low    | Hierarchical agent management                     |
| **Consistent Persona**     | Low    | Already achieved via prompt templates             |

## Recommendations

### Primary Recommendation: No Migration

**Decision:** Maintain current GitHub Actions + Copilot CLI workflow implementation.

**Rationale:**

1. Official custom agents are designed for IDE-based interactive assistance
2. Current workflows require event-driven and scheduled execution
3. Migration would result in loss of critical automation capabilities
4. No feature benefit that justifies the migration cost

### Secondary Recommendation: Evaluate Complementary Use

Consider adding custom agents for IDE-based interactive assistance (separate from automation):

| Agent                             | Purpose                            | Priority |
| --------------------------------- | ---------------------------------- | -------- |
| `screeps-runtime-expert.agent.md` | Help with runtime code development | Low      |
| `docs-specialist.agent.md`        | Assist with documentation writing  | Low      |
| `test-engineer.agent.md`          | Guide test development             | Low      |

**Implementation:** If desired, these would be additive (new agents in `.github/agents/`) rather than replacing existing workflows.

### Future Considerations

Monitor GitHub's official agent framework for:

1. **Event-Driven Triggers**: If custom agents gain event subscription capability
2. **Scheduled Execution**: If custom agents gain cron-like scheduling
3. **Workflow Integration**: If custom agents can be invoked from GitHub Actions
4. **API Access**: If custom agents gain programmatic invocation capability

These features would enable reconsideration of migration.

## Implementation Notes

### If Adding Complementary Custom Agents

Directory structure for optional IDE agents:

```
.github/
├── agents/                           # Official custom agents (IDE-focused)
│   ├── screeps-runtime-expert.agent.md
│   ├── docs-specialist.agent.md
│   └── test-engineer.agent.md
├── actions/                          # Existing composite actions
│   ├── copilot-exec/
│   ├── copilot-issue-agent/
│   └── ...
├── copilot/
│   └── prompts/                      # Existing prompt templates (workflows)
│       ├── issue-triage
│       ├── todo-issue
│       └── ...
└── workflows/                        # Existing automation workflows
    ├── copilot-issue-triage.yml
    ├── copilot-todo-pr.yml
    └── ...
```

### Documentation Updates

If complementary agents are added:

- Update `AGENTS.md` to distinguish IDE agents from workflow automation
- Add usage guidance in `README.md` developer section
- Create `packages/docs/source/docs/automation/custom-agents.md` for detailed guidance

## Related Issues

### Direct Dependencies

- **#640** - Consolidate similar Copilot agent workflows (workflow optimization)
- **#671** - CI autofix workflow circuit breaker improvements
- **#790** - Documentation path migration for agent prompts
- **#696** - Troubleshooting guides for automation

### Historical Context

- **#471** - Changelog-to-blog automation (implemented with current pattern)
- **#55** - Copilot instructions file (implemented custom instructions)
- **#573** - Screeps development strategies reference

## Conclusion

The official GitHub Copilot custom agents framework is designed for a fundamentally different use case (IDE-based interactive assistance) than our current automation needs (event-driven CI/CD automation). **No migration is recommended.**

The current implementation using GitHub Actions + Copilot CLI workflows is the architecturally correct choice for:

- Scheduled tasks (daily audits, periodic analysis)
- Event-driven automation (issue triage, label triggers)
- CI/CD integration (failure resolution, deployment triggers)
- Artifact management (reports, logs, analysis results)

Custom agents may be considered as a **complementary addition** for IDE-based developer assistance, but this would be a separate initiative, not a replacement for existing automation.

## References

### Official Documentation

- [Creating custom agents](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents)
- [Custom agents configuration](https://docs.github.com/en/copilot/reference/custom-agents-configuration)
- [Your first custom agent (tutorial)](https://docs.github.com/copilot/tutorials/customization-library/custom-agents/your-first-custom-agent)
- [Enhancing Copilot agent mode with MCP](https://docs.github.com/copilot/tutorials/enhancing-copilot-agent-mode-with-mcp)
- [Preparing for custom agents in enterprise](https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-for-enterprise/manage-agents/prepare-for-custom-agents)

### Blog Posts and Changelogs

- [Custom agents for GitHub Copilot (Changelog)](https://github.blog/changelog/2025-10-28-custom-agents-for-github-copilot/)
- [GitHub Copilot CLI: Custom agents and delegation](https://github.blog/changelog/2025-10-28-github-copilot-cli-use-custom-agents-and-delegate-to-copilot-coding-agent/)
- [Custom agents in JetBrains, Eclipse, Xcode (Preview)](https://github.blog/changelog/2025-11-18-custom-agents-available-in-github-copilot-for-jetbrains-eclipse-and-xcode-now-in-public-preview/)
- [How to write a great agents.md](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)

### Current Implementation References

- [AGENTS.md](../../AGENTS.md) - Repository agent guidelines
- [packages/docs/source/docs/automation/overview.md](../../packages/docs/source/docs/automation/overview.md) - Automation architecture
- [.github/actions/copilot-exec/action.yml](../../.github/actions/copilot-exec/action.yml) - Copilot CLI composite action

---

_This research document evaluates the official GitHub Copilot custom agents framework for potential migration of existing automation workflows. Based on the analysis, no migration is recommended as the frameworks serve different purposes._
