---
title: Spec-Kit Workflow Guide
date: 2025-10-24T12:33:51.454Z
---

# Spec-Kit Workflow Guide

The spec-kit workflow implements specification-driven development, allowing teams to create, refine, and finalize detailed implementation plans before code changes are made.

## Overview

The spec-kit workflow provides a structured planning phase that separates specification from implementation. It consists of three stages:

1. **Plan Generation**: Create a detailed implementation plan
2. **Plan Refinement**: Iteratively improve the plan based on feedback
3. **Plan Finalization**: Review and approve the plan, then trigger automated implementation

## Workflow Stages

### 1. Plan Generation

**Trigger**: Add the `speckit` label to an issue

**What happens**:

- Copilot analyzes the issue requirements
- Creates a comprehensive implementation plan as a comment
- Plan includes:
  - Problem Statement
  - Solution Overview
  - Implementation Steps
  - Acceptance Criteria
  - Dependencies
  - Risk Assessment

**Example**:

```
# Issue: Add support for new tower targeting logic

1. User adds `speckit` label to the issue
2. Copilot posts a comment with heading "## 📋 Specification-Driven Implementation Plan"
3. The plan outlines files to change, test requirements, and acceptance criteria
```

### 2. Plan Refinement

**Trigger**: Comment on the issue starting with `@speckit` followed by feedback

**What happens**:

- Copilot fetches the existing plan from issue comments
- Analyzes the feedback and requested changes
- Updates the existing plan comment (does not create a new comment)
- Adds a "Revision History" section tracking changes

**Example**:

```
@speckit Please add error handling for edge cases where there are no valid targets

# Copilot response:
- Updates the existing plan comment
- Adds error handling steps to Implementation Steps
- Documents the change in Revision History
```

**Refinement commands**:

- `@speckit [feedback]` - Request specific changes or additions to the plan
- `@speckit [question]` - Ask clarifying questions about the implementation
- Multiple refinement iterations are supported

### 3. Plan Finalization

**Trigger**: Comment `@speckit finalize` on the issue

**What happens**:

- Copilot reviews the entire plan for completeness
- Makes final improvements if needed
- Updates the plan comment with finalized version
- Adds the `Todo` label to the issue
- Posts a confirmation comment

**Example**:

```
@speckit finalize

# Copilot response:
1. Reviews and polishes the plan
2. Updates the plan comment
3. Adds `Todo` label to trigger copilot-todo-pr.yml
4. Posts: "✅ Plan finalized and ready for implementation. Issue labeled with `Todo` for automation."
```

## Integration with Todo Automation

Once a plan is finalized and the `Todo` label is applied:

1. The `copilot-todo-pr.yml` workflow is triggered automatically
2. Copilot implements the changes following the finalized plan
3. A draft PR is created for transparency
4. The issue references the plan during implementation

This ensures implementation aligns with the approved specification.

## Best Practices

### When to Use Spec-Kit

**Good use cases**:

- Complex features requiring multiple file changes
- Changes affecting multiple systems or components
- Features that benefit from stakeholder review before implementation
- Situations where multiple approaches need evaluation
- Changes with significant risk or architectural impact

**When direct implementation is better**:

- Simple bug fixes with clear solutions
- Documentation-only updates
- Dependency updates
- Obvious refactoring improvements

### Writing Effective Refinement Comments

**Good refinement comments**:

```
@speckit Please add validation for negative coordinates in the pathfinding logic

@speckit The solution should handle the case when Memory.rooms is undefined

@speckit Can we add a fallback strategy if the primary approach fails?
```

**Less effective comments**:

```
@speckit Make it better

@speckit This won't work

@speckit Add more stuff
```

Be specific about what you want changed, added, or clarified.

### Plan Quality Indicators

A high-quality plan should:

- ✅ Have concrete, numbered implementation steps
- ✅ Reference specific files and functions to modify
- ✅ Include test requirements (unit tests, regression tests)
- ✅ Define measurable acceptance criteria
- ✅ Identify potential risks and mitigation strategies
- ✅ Consider edge cases and error handling
- ✅ Align with repository conventions (from AGENTS.md)

## Permissions and Security

The spec-kit workflow follows repository security guidelines:

- **Permissions**: Uses `contents: read` and `issues: write` only
- **Token**: Uses `COPILOT_TOKEN` secret for authentication
- **Scope**: Can only comment on issues and manage labels
- **Branch Protection**: Cannot directly modify code (only the Todo automation does that)

## Workflow Files

- **Workflow**: `.github/workflows/copilot-speckit.yml`
- **Plan Generation Prompt**: `.github/copilot/prompts/speckit-plan`
- **Plan Refinement Prompt**: `.github/copilot/prompts/speckit-refine`
- **Label Definition**: `.github/labels.yml` (speckit label)

## Troubleshooting

### Plan not generated after adding label

**Possible causes**:

- Workflow permissions may be insufficient
- COPILOT_TOKEN secret may be missing or invalid
- GitHub Actions may be disabled for the repository

**Solution**:

- Check workflow run logs in Actions tab
- Verify COPILOT_TOKEN is set in repository secrets
- Ensure workflows are enabled in repository settings

### Refinement creates duplicate comments

**Expected behavior**: The workflow should update the existing plan comment, not create duplicates.

**If this occurs**:

- Report as a bug - the prompt includes explicit instructions to edit existing comments
- The plan comment has a unique heading "## 📋 Specification-Driven Implementation Plan"
- GitHub API should be used to find and update the comment

### Finalization doesn't add Todo label

**Possible causes**:

- Issue permissions may be insufficient
- Comment doesn't exactly match `@speckit finalize` (case-sensitive, no trailing text)

**Solution**:

- Check workflow logs for error messages
- Ensure the comment is exactly: `@speckit finalize`
- Verify the user has permission to add labels

## Examples

### Complete Workflow Example

```
# 1. User opens issue
Title: Implement automatic tower repair prioritization
Body: Towers should prioritize repairing critical structures...

# 2. User adds `speckit` label
[Copilot posts implementation plan]

## 📋 Specification-Driven Implementation Plan

### Problem Statement
Towers currently have no prioritization logic...

### Solution Overview
Implement a scoring system that prioritizes critical structures...

### Implementation Steps
1. Create `src/runtime/tower/prioritization.ts`
2. Add scoring function for structure types...
[...]

# 3. User requests refinement
@speckit Please add handling for when multiple towers target the same structure

[Copilot updates the plan with coordination logic]

# 4. User finalizes
@speckit finalize

[Copilot adds Todo label, confirms finalization]

# 5. Todo automation implements
[copilot-todo-pr.yml creates PR with implementation]
```

## See Also

- [Automation Overview](./overview.md) - Complete workflow documentation
- [Todo Automation](../copilot/prompts/todo-issue) - Implementation phase details
- [Repository Guidelines](../../AGENTS.md) - Development conventions
