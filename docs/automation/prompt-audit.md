# Copilot Prompt Template Audit

This document provides a comprehensive audit of existing Copilot prompt templates, identifying gaps in action enforcement and output specification patterns.

## Audit Date

**Performed**: October 22, 2025  
**Issue**: #127 - Refactor and enhance Copilot prompt templates with action enforcement rules

## Current Prompt Templates

### 1. `issue-triage` - GitHub Issue Triage

**Purpose**: Triages newly created issues, reformulates content, applies labels  
**Workflow**: `.github/workflows/copilot-issue-triage.yml`

**Strengths**:

- Clear step-by-step process with numbered instructions
- Comprehensive workflow covering duplicate detection, relationship analysis
- Explicit output format requirements (JSON structure)
- Detailed relationship detection and sub-task linking
- Single comment rule to avoid redundancy

**Action Enforcement Gaps**:

- ⚠️ Line 74: Includes `Todo` in automatic labeling which contradicts issue #78
- ⚠️ Missing explicit "must update" requirements for issue reformulation
- ⚠️ No fallback instructions when GitHub MCP server is unavailable
- ⚠️ Limited validation requirements for generated outputs

**Recommendations**:

- Remove `Todo` from automatic labeling per issue #78
- Add explicit action enforcement rules ("MUST reformulate", "MUST apply labels")
- Include fallback instructions for API failures
- Add output validation requirements

### 2. `todo-issue` - Todo Automation

**Purpose**: Implements fixes for issues labeled with `Todo`  
**Workflow**: `.github/workflows/copilot-todo-pr.yml`

**Strengths**:

- Comprehensive execution checklist with clear phases
- Strong progress reporting requirements using `report_progress` tool
- Explicit validation requirements (npm commands)
- Clear PR lifecycle management (draft → ready)
- JSON output structure for workflow capture

**Action Enforcement Gaps**:

- ⚠️ Missing explicit failure handling when sub-tasks are incomplete
- ⚠️ No validation rules for commit message quality
- ⚠️ Limited guidance on file modification scope
- ⚠️ No timeout handling for long-running operations

**Recommendations**:

- Add explicit blocking dependency handling with exit conditions
- Include commit message validation requirements
- Add file modification scope guidelines
- Include timeout and resource management rules

### 3. `ci-autofix` - CI Failure Auto-Fixing

**Purpose**: Automatically fixes CI failures with minimal changes  
**Workflow**: `.github/workflows/copilot-ci-autofix.yml`

**Strengths**:

- Clear playbook structure with numbered steps
- Explicit scope limitation ("minimal fix")
- JSON output capture for workflow logging
- Branch strategy handling (PR vs main)

**Action Enforcement Gaps**:

- ⚠️ Missing explicit requirements for root cause analysis
- ⚠️ No validation that fixes actually resolve the reported failure
- ⚠️ Limited guidance on when NOT to attempt automatic fixes
- ⚠️ No fallback instructions when logs are insufficient

**Recommendations**:

- Add mandatory root cause analysis step
- Include fix validation requirements
- Add explicit criteria for when to create issues instead of fixing
- Include fallback instructions for complex failures

### 4. `repository-audit` - Repository Quality Auditing

**Purpose**: Performs scheduled repository audits and creates improvement issues  
**Workflow**: `.github/workflows/copilot-review.yml`

**Strengths**:

- Clear auditing scope (runtime, automation, documentation)
- Explicit issue creation workflow with duplicate prevention
- JSON output structure for logging
- Concrete reproduction steps requirement

**Action Enforcement Gaps**:

- ⚠️ Missing explicit requirements for actionable findings
- ⚠️ No validation rules for issue quality before creation
- ⚠️ Limited guidance on severity assessment criteria
- ⚠️ No timeout handling for long audit operations

**Recommendations**:

- Add explicit criteria for what constitutes an "actionable finding"
- Include issue quality validation requirements
- Add severity assessment guidelines with examples
- Include audit timeout and resource limits

### 5. `email-triage` - Email to GitHub Issue Conversion

**Purpose**: Converts actionable emails into GitHub issues  
**Workflow**: `.github/workflows/copilot-email-triage.yml`

**Strengths**:

- Clear decision criteria for actionable vs non-actionable emails
- JSON output with explicit `issues_created` tracking
- Detailed issue creation requirements

**Action Enforcement Gaps**:

- ⚠️ Missing validation rules for email content quality
- ⚠️ No explicit requirements for issue title/body structure
- ⚠️ Limited fallback handling for malformed emails

**Recommendations**:

- Add email content validation requirements
- Include explicit issue structure requirements
- Add fallback instructions for edge cases

### 6. `screeps-monitor` - Screeps Monitoring

**Purpose**: Comprehensive autonomous monitoring combining strategic analysis with PTR telemetry monitoring  
**Workflow**: `.github/workflows/screeps-monitoring.yml`

**Strengths**:

- Clear MCP server integration guidance (github, screeps-mcp, screeps-api)
- Multi-phase analysis pipeline (7 phases)
- Explicit issue creation workflow with severity labeling
- Combined strategic analysis with PTR anomaly detection
- JSON output structure with comprehensive metrics tracking
- Automated PTR alert notifications via check-ptr-alerts.ts

**Action Enforcement Gaps**:

- ⚠️ Missing explicit criteria for strategic vs PTR issue creation
- ⚠️ No validation requirements for telemetry data quality
- ⚠️ Limited fallback handling when Screeps API is unavailable
- ⚠️ No explicit guidance on prioritizing strategic vs anomaly findings

**Recommendations**:

- Add explicit anomaly detection criteria with thresholds
- Include telemetry validation requirements
- Add fallback instructions for API failures
- Clarify prioritization when both strategic and PTR issues detected

### 7. `todo-daily-prioritization` - Daily Todo Assignment

**Purpose**: Automatically assigns Todo label to oldest actionable issue  
**Workflow**: `.github/workflows/copilot-todo-daily.yml`

**Strengths**:

- Clear dependency analysis requirements
- Explicit single-label assignment rule
- JSON output with detailed reasoning

**Action Enforcement Gaps**:

- ⚠️ Missing validation for issue actionability determination
- ⚠️ No explicit requirements for comment quality on labeled issues
- ⚠️ Limited handling of edge cases (no actionable issues)

**Recommendations**:

- Add explicit actionability validation criteria
- Include comment quality requirements
- Add comprehensive edge case handling

## Common Patterns and Anti-Patterns

### Effective Patterns Found

1. **Numbered step processes** - Clear, sequential execution flow
2. **JSON output requirements** - Structured workflow capture
3. **Explicit permission scopes** - Clear GitHub API usage boundaries
4. **MCP server integration** - Leverages additional context and capabilities
5. **Progress reporting tools** - Transparency in long-running operations

### Missing Enforcement Patterns

1. **Mandatory action requirements** - "MUST create", "MUST update", "MUST validate"
2. **Failure condition handling** - What to do when operations fail
3. **Output quality validation** - Requirements for generated content
4. **Resource and timeout limits** - Preventing runaway operations
5. **Fallback instructions** - Graceful degradation when APIs fail

## Recommended Enhancement Framework

### Action Enforcement Rules Template

```markdown
**MANDATORY ACTIONS** (failure to complete any item is a workflow failure):

- [ ] MUST authenticate GitHub CLI with provided token
- [ ] MUST validate input parameters before proceeding
- [ ] MUST create/update specified outputs with required format
- [ ] MUST validate outputs meet quality requirements before completion

**OUTPUT REQUIREMENTS**:

- All generated content MUST be actionable and specific
- All created issues MUST include concrete next steps
- All PR descriptions MUST include implementation rationale
- All comments MUST be professional and concise

**FAILURE HANDLING**:

- IF GitHub API is unavailable → Log error and exit gracefully
- IF required data is missing → Request missing information and exit
- IF operation times out → Log progress and create follow-up issue
```

### Quality Gates Template

```markdown
**PRE-EXECUTION VALIDATION**:

- Verify all required environment variables are present
- Confirm GitHub token has sufficient permissions
- Validate input data meets expected format

**POST-EXECUTION VALIDATION**:

- Verify all created outputs exist and are accessible
- Confirm generated content meets quality standards
- Validate all mandatory actions were completed successfully
```

## Next Steps

1. **Refactor existing prompts** using the enhancement framework
2. **Standardize naming conventions** (rename `todo-issue` → `todo-automation`, `repository-audit` → `repository-review`)
3. **Add comprehensive action enforcement rules** to each template
4. **Include explicit output validation requirements**
5. **Update documentation** to reflect new prompt patterns
6. **Test enhanced prompts** with dry-run scenarios

## Impact Assessment

**Low Risk Changes**:

- Adding validation requirements to existing workflows
- Including fallback instructions for error conditions
- Standardizing output format requirements

**Medium Risk Changes**:

- Removing `Todo` auto-labeling from issue triage (addresses #78)
- Renaming prompt files (requires workflow updates)
- Adding mandatory action requirements

**Validation Required**:

- All workflow integrations after prompt file renames
- Issue triage behavior after Todo label removal
- Performance impact of additional validation steps

---

**Document Version**: 1.0  
**Last Updated**: October 22, 2025  
**Related Issues**: #127, #78, #89, #101
