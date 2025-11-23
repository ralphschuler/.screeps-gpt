# Copilot Issue Agent

Unified composite action for GitHub issue management operations with role-based behavior.

## Overview

This action consolidates issue management functionality into a single, parameterized agent that can operate in different modes:

- **`triage`** - Reformulate and label new issues with duplicate detection
- **`resolve`** - Implement solutions via draft PRs with progress tracking
- **`analyze`** - Context gathering and relationship analysis only

## Features

- **Role-based behavior** - Single agent with multiple operational modes
- **Context-aware analysis** - Duplicate detection, relationship mapping, code context gathering
- **Automatic reformulation** - Clear titles and structured descriptions (triage mode)
- **Implementation automation** - Draft PRs with incremental commits (resolve mode)
- **Intelligent dependency management** - Sub-task validation and blocking detection
- **Consistent infrastructure** - Uses shared `copilot-exec` action

## Usage

### Triage Mode (Issue Reformulation)

```yaml
- name: Triage new issue
  uses: ./.github/actions/copilot-issue-agent
  with:
    copilot-token: ${{ secrets.COPILOT_TOKEN }}
    mode: triage
    issue-number: ${{ github.event.issue.number }}
    issue-title: ${{ toJSON(github.event.issue.title) }}
    issue-body: ${{ toJSON(github.event.issue.body || '') }}
    issue-url: ${{ toJSON(github.event.issue.html_url) }}
    issue-author: ${{ toJSON(github.event.issue.user.login) }}
```

### Resolve Mode (Implementation)

```yaml
- name: Resolve issue via PR
  uses: ./.github/actions/copilot-issue-agent
  with:
    copilot-token: ${{ secrets.COPILOT_TOKEN }}
    mode: resolve
    issue-number: ${{ github.event.issue.number }}
    issue-title: ${{ toJSON(github.event.issue.title) }}
    issue-body: ${{ toJSON(github.event.issue.body || '') }}
    issue-url: ${{ toJSON(github.event.issue.html_url) }}
    issue-author: ${{ toJSON(github.event.issue.user.login) }}
    timeout: "45"
```

### Analyze Mode (Context Gathering)

```yaml
- name: Analyze issue context
  uses: ./.github/actions/copilot-issue-agent
  with:
    copilot-token: ${{ secrets.COPILOT_TOKEN }}
    mode: analyze
    issue-number: ${{ github.event.issue.number }}
    issue-title: ${{ toJSON(github.event.issue.title) }}
    issue-body: ${{ toJSON(github.event.issue.body || '') }}
    issue-url: ${{ toJSON(github.event.issue.html_url) }}
    issue-author: ${{ toJSON(github.event.issue.user.login) }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `copilot-token` | Yes | - | Personal access token with Copilot Requests scope |
| `mode` | Yes | - | Operation mode: `triage`, `resolve`, or `analyze` |
| `issue-number` | Yes | - | GitHub issue number to process |
| `issue-title` | Yes | - | Issue title (JSON-encoded) |
| `issue-body` | No | `""` | Issue body content (JSON-encoded) |
| `issue-url` | Yes | - | Issue HTML URL |
| `issue-author` | Yes | - | Issue author username (JSON-encoded) |
| `repository` | No | `${{ github.repository }}` | Repository name in owner/repo format |
| `verbose` | No | `"false"` | Enable verbose logging for debugging |
| `timeout` | No | `"45"` | Maximum time in minutes for execution |

## Outputs

| Output | Description |
|--------|-------------|
| `output-path` | Absolute path to the agent output log file |
| `mode` | The operation mode that was executed |

## Implementation Details

### Mode Selection

The agent validates the mode parameter and selects the appropriate prompt template:

- **`triage`** → `.github/copilot/prompts/issue-triage`
- **`resolve`** → `.github/copilot/prompts/todo-issue`
- **`analyze`** → `.github/copilot/prompts/issue-analysis`

### Cache Behavior

- **Triage mode**: Cache disabled (`force-response: true`) for time-sensitive duplicate detection
- **Resolve mode**: Cache enabled for efficiency when re-running implementations
- **Analyze mode**: Cache enabled for repeated context gathering

### Integration with Workflows

This action is used by:

- `.github/workflows/copilot-issue-triage.yml` - Uses `triage` mode on issue open/reopen
- `.github/workflows/copilot-todo-pr.yml` - Uses `resolve` mode when `Todo` label applied

## Benefits of Consolidation

1. **Reduced maintenance burden** - Single action to update instead of multiple
2. **Consistent behavior** - Shared infrastructure and validation logic
3. **Easier testing** - Single entry point for all issue operations
4. **Clear separation of concerns** - Mode parameter makes intent explicit
5. **Simplified debugging** - Consistent logging and error handling

## Migration from Legacy Actions

### Before (Triage)
```yaml
uses: ./.github/actions/copilot-triage-agent
```

### After (Triage)
```yaml
uses: ./.github/actions/copilot-issue-agent
with:
  mode: triage
```

### Before (Todo/Development)
```yaml
uses: ./.github/actions/copilot-dev-agent
```

### After (Todo/Development)
```yaml
uses: ./.github/actions/copilot-issue-agent
with:
  mode: resolve
```

## Related Documentation

- [Automation Overview](../../../docs/automation/overview.md)
- [Agent Guidelines](../../../AGENTS.md)
- [Copilot Exec Action](../copilot-exec/action.yml)
