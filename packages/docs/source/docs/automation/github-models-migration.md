---
title: GitHub Models in Actions Migration Assessment
date: 2025-11-25T12:00:00.000Z
layout: page
---

# GitHub Models in Actions Migration Assessment

This document assesses the feasibility and opportunities for migrating from the current Copilot CLI-based automation to GitHub Models in Actions (`actions/ai-inference`).

## Executive Summary

**Recommendation**: The repository should adopt a **hybrid approach** - keeping the current Copilot CLI for complex agentic workflows while adopting `actions/ai-inference` for simpler, focused AI tasks.

### Key Findings

1. **`actions/ai-inference` is ideal for simple, single-prompt AI tasks** (e.g., text classification, summarization, structured extraction)
2. **Copilot CLI excels at complex, multi-step agentic workflows** (e.g., issue triage with code search, automated PR creation)
3. **Both approaches can coexist** in the same repository
4. **Migration should be incremental**, starting with low-risk workflows

## Current Architecture

The repository uses GitHub Copilot CLI via the `copilot-exec` composite action for AI automation:

### Current Stack

```
┌──────────────────────────────────────────────────┐
│                 GitHub Workflows                  │
│  (copilot-*.yml, screeps-monitoring.yml, etc.)   │
└──────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────┐
│            copilot-exec Composite Action          │
│  - Prompt rendering (envsubst)                    │
│  - MCP server integration                         │
│  - Result caching                                 │
│  - Model configuration                            │
└──────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────┐
│              Specialized Agent Actions            │
│  - copilot-issue-agent (triage/resolve modes)    │
│  - copilot-audit-agent                           │
│  - copilot-review-agent                          │
└──────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────┐
│               Prompt Templates                    │
│  .github/copilot/prompts/                        │
│  - issue-triage, todo-issue, etc.                │
└──────────────────────────────────────────────────┘
```

### Current Capabilities

| Feature | Current Implementation |
|---------|----------------------|
| Prompt Templates | Plain text with `${}` variable substitution |
| Model Context Protocol | GitHub MCP, Playwright MCP, Screeps MCP |
| Tool Calling | Full access to MCP tools (create issues, PRs, search code) |
| Multi-Step Reasoning | Supports complex agentic workflows |
| Caching | SHA256-based result caching |
| Model Selection | Configurable via input or env var |

## GitHub Models in Actions (`actions/ai-inference`)

GitHub Models in Actions provides a simpler, more direct way to call AI models from GitHub Actions workflows.

### Key Features

```yaml
# Simple inline prompt
- uses: actions/ai-inference@v1
  with:
    prompt: "Summarize this issue: ${{ github.event.issue.body }}"

# File-based prompt
- uses: actions/ai-inference@v1
  with:
    prompt-file: './.github/prompts/sample.prompt.yml'
    input: |
      var1: hello
      var2: world

# Structured output with JSON schema
- uses: actions/ai-inference@v1
  with:
    prompt: "Classify this issue"
    responseFormat: json_schema
    jsonSchema: |
      {
        "type": "object",
        "properties": {
          "type": {"enum": ["bug", "feature", "question"]},
          "priority": {"enum": ["low", "medium", "high"]}
        }
      }
```

### Required Permissions

```yaml
permissions:
  models: read  # Required for GitHub Models access
  contents: read
  issues: write  # If modifying issues
```

### Prompt File Format (`.prompt.yml`)

```yaml
messages:
  - role: system
    content: Be as concise as possible
  - role: user
    content: 'Compare {{a}} and {{b}}, please'
model: openai/gpt-4o
responseFormat: json_schema
jsonSchema: |
  {
    "type": "object",
    "properties": {
      "comparison": {"type": "string"}
    }
  }
```

## Comparison: Copilot CLI vs. GitHub Models in Actions

| Aspect | Copilot CLI (Current) | GitHub Models (`actions/ai-inference`) |
|--------|----------------------|---------------------------------------|
| **Complexity** | High - full agent with tools | Low - single prompt/response |
| **Tool Access** | MCP servers (GitHub, Playwright, etc.) | None - AI response only |
| **Multi-Step** | Yes - complex reasoning chains | No - single request/response |
| **Structured Output** | Text-based | Native JSON schema support |
| **Setup** | Requires `@github/copilot` npm install | First-party action, no setup |
| **Permissions** | Standard GitHub token | Requires `models: read` |
| **Caching** | Custom implementation | Not built-in |
| **Variable Substitution** | envsubst (`$VAR` or `${VAR}`) | Template syntax (`{{var}}`) |
| **Model Selection** | Flexible, env-based | Prompt file or action input |
| **Best For** | Complex agentic automation | Simple AI classification/extraction |

## Migration Opportunities

### Workflows Suitable for `actions/ai-inference`

These workflows could benefit from migration to GitHub Models:

#### 1. **Simple Classification Tasks** (NEW OPPORTUNITY)

```yaml
# Example: Auto-label issues by type
- uses: actions/ai-inference@v1
  id: classify
  with:
    prompt: |
      Classify this GitHub issue into one of: bug, feature, question, documentation
      
      Title: ${{ github.event.issue.title }}
      Body: ${{ github.event.issue.body }}
    responseFormat: json_schema
    jsonSchema: |
      {
        "type": "object",
        "properties": {
          "type": {"enum": ["bug", "feature", "question", "documentation"]},
          "confidence": {"type": "number"}
        },
        "required": ["type", "confidence"]
      }
  permissions:
    models: read
    
- name: Apply label
  run: |
    gh issue edit ${{ github.event.issue.number }} --add-label "type/${{ fromJSON(steps.classify.outputs.response).type }}"
```

#### 2. **Simple Summarization** (NEW OPPORTUNITY)

```yaml
# Example: Summarize PR changes for release notes
- uses: actions/ai-inference@v1
  id: summarize
  with:
    prompt: |
      Summarize these PR changes for release notes in one paragraph:
      
      ${{ github.event.pull_request.body }}
```

#### 3. **Structured Data Extraction** (NEW OPPORTUNITY)

```yaml
# Example: Extract action items from issue body
- uses: actions/ai-inference@v1
  id: extract
  with:
    prompt: |
      Extract action items from this issue:
      
      ${{ github.event.issue.body }}
    responseFormat: json_schema
    jsonSchema: |
      {
        "type": "object",
        "properties": {
          "actionItems": {
            "type": "array",
            "items": {"type": "string"}
          }
        }
      }
```

### Workflows to Keep on Copilot CLI

These workflows require tool calling and multi-step reasoning that `actions/ai-inference` cannot provide:

| Workflow | Reason to Keep on Copilot CLI |
|----------|------------------------------|
| `copilot-issue-triage.yml` | Requires GitHub MCP to search code, find duplicates, create sub-issues |
| `copilot-todo-pr.yml` | Requires file editing, git operations, PR creation |
| `copilot-review.yml` | Requires code inspection, cross-file analysis |
| `screeps-monitoring.yml` | Requires Screeps MCP for console access, memory inspection |
| `copilot-strategic-planner.yml` | Requires multi-source data aggregation, issue management |

## Proposed Hybrid Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         GitHub Workflows                              │
└──────────────────────────────────────────────────────────────────────┘
                    │                                │
    ┌───────────────┴───────────────┐   ┌───────────┴───────────────┐
    │    Simple AI Tasks            │   │  Complex Agentic Tasks    │
    │                               │   │                           │
    │  ┌─────────────────────────┐  │   │  ┌─────────────────────┐  │
    │  │ actions/ai-inference@v1 │  │   │  │ copilot-exec action │  │
    │  │                         │  │   │  │                     │  │
    │  │ • Classification        │  │   │  │ • MCP integration   │  │
    │  │ • Summarization         │  │   │  │ • Tool calling      │  │
    │  │ • Extraction            │  │   │  │ • Multi-step work   │  │
    │  │ • JSON schema output    │  │   │  │ • File operations   │  │
    │  └─────────────────────────┘  │   │  └─────────────────────┘  │
    │                               │   │                           │
    │  Use Cases:                   │   │  Use Cases:               │
    │  • Issue type classification  │   │  • Issue triage + code    │
    │  • Priority detection         │   │  • Todo automation        │
    │  • Commit msg generation      │   │  • Repository audits      │
    │  • PR summary                 │   │  • Screeps monitoring     │
    └───────────────────────────────┘   └───────────────────────────┘
```

## Implementation Plan

### Phase 1: Preparation (No Breaking Changes)

1. **Add `models: read` permission** to relevant workflows as a non-functional change
2. **Create `.github/prompts/` directory** for `actions/ai-inference` prompt files
3. **Document migration patterns** in this guide

### Phase 2: Introduce Simple AI Tasks

1. **Create new lightweight workflows** using `actions/ai-inference`:
   - Issue type classification
   - PR description summarization
   - Commit message improvement

2. **Add as supplements**, not replacements, to existing workflows

### Phase 3: Optimize Existing Workflows

1. **Identify hybrid opportunities** where a workflow could use both:
   - `actions/ai-inference` for initial classification
   - Copilot CLI for complex follow-up actions

2. **Measure cost and performance**:
   - Compare API costs
   - Compare execution time
   - Compare output quality

### Phase 4: Full Adoption

1. **Migrate suitable workflows** completely to `actions/ai-inference`
2. **Standardize prompt file format** across the repository
3. **Update documentation** and agent guidelines

## Example Migration: Issue Classification Pre-Filter

This example shows how to add `actions/ai-inference` as a pre-filter before the existing Copilot CLI triage:

```yaml
name: Copilot Issue Triage

on:
  issues:
    types: [opened, reopened]

permissions:
  contents: read
  issues: write
  models: read  # NEW: Required for GitHub Models
  repository-projects: write

jobs:
  # NEW: Quick classification step
  classify:
    runs-on: ubuntu-latest
    outputs:
      issue-type: ${{ steps.classify.outputs.type }}
      needs-triage: ${{ steps.classify.outputs.needs_triage }}
    steps:
      - uses: actions/ai-inference@v1
        id: classify
        with:
          prompt: |
            Analyze this GitHub issue and classify it.
            
            Title: ${{ github.event.issue.title }}
            Body: ${{ github.event.issue.body }}
            
            Determine:
            1. The type (bug, feature, question, documentation, spam)
            2. Whether it needs detailed triage (true/false)
            
            Spam or obvious questions may not need full triage.
          responseFormat: json_schema
          jsonSchema: |
            {
              "type": "object",
              "properties": {
                "type": {"enum": ["bug", "feature", "question", "documentation", "spam"]},
                "needs_triage": {"type": "boolean"},
                "reason": {"type": "string"}
              },
              "required": ["type", "needs_triage"]
            }

  # EXISTING: Full triage (only if needed)
  triage:
    needs: classify
    if: needs.classify.outputs.needs-triage == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v6
      - uses: ./.github/actions/copilot-issue-agent
        with:
          copilot-token: ${{ secrets.COPILOT_TOKEN }}
          mode: triage
          # ... rest of existing configuration
```

## Benefits of Adoption

### 1. **Reduced Complexity**

For simple tasks, `actions/ai-inference` eliminates:
- npm installation of Copilot CLI
- MCP server configuration
- Complex prompt templates with tool instructions

### 2. **Structured Outputs**

Native JSON schema support ensures type-safe responses:
```yaml
responseFormat: json_schema
jsonSchema: |
  {
    "type": "object",
    "properties": {
      "labels": {"type": "array", "items": {"type": "string"}},
      "priority": {"enum": ["low", "medium", "high", "critical"]}
    }
  }
```

### 3. **Cost Optimization**

Simple classification tasks don't need the overhead of full agent execution:
- Faster execution time
- Lower API costs for simple prompts
- No npm install/cache overhead

### 4. **First-Party Support**

`actions/ai-inference` is maintained by GitHub:
- Better integration with Actions ecosystem
- Future compatibility guaranteed
- Documentation and support

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Feature limitations | Use hybrid approach - keep Copilot CLI for complex tasks |
| Permission changes | The `models: read` permission is low-risk, read-only |
| Prompt format differences | Gradual migration, keep existing prompts working |
| Model availability | GitHub Models shares same underlying infrastructure |
| Response quality | Test thoroughly before migrating critical workflows |

## Conclusion

The repository should **adopt a hybrid approach**:

1. **Keep Copilot CLI** for complex, multi-step agentic workflows that require:
   - MCP tool calling (GitHub, Playwright, Screeps)
   - File operations and git interactions
   - Multi-phase reasoning with state

2. **Adopt `actions/ai-inference`** for new, simple AI tasks:
   - Classification and categorization
   - Text summarization
   - Structured data extraction
   - Pre-filters for existing workflows

3. **Migrate incrementally** with low-risk workflows first

This approach maximizes the benefits of both technologies while minimizing disruption to existing automation.

## Related Documentation

- [Automation Overview](./overview.md)
- [Agent Guidelines](../../../../AGENTS.md)
- [Copilot Exec Action](./../../../.github/actions/copilot-exec/action.yml)
- [GitHub Models in Actions (External)](https://github.com/actions/ai-inference)
