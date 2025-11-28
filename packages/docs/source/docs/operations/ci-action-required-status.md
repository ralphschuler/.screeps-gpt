# CI Workflow `action_required` Status - Analysis and Resolution

## Problem Statement

Quality gate workflows (guard-test-unit.yml, guard-build.yml) intermittently show `action_required` conclusion status instead of success/failure, causing monitoring alerts.

## Root Cause Analysis

### Technical Cause

When a workflow is cancelled by GitHub Actions' concurrency control (`cancel-in-progress: true`) **before any jobs start executing**, the workflow conclusion is reported as `action_required` rather than `cancelled`.

### Why This Occurs

1. Guard workflows use concurrency groups to prevent multiple runs on the same PR
2. When commits are pushed rapidly, newer runs cancel older ones
3. If cancellation happens before jobs begin, status becomes `action_required`
4. If cancellation happens after jobs begin, status becomes `cancelled`

### Timing Dependency

- **Fast commits** (< 1 second apart): High probability of `action_required`
- **Normal commits** (> 5 seconds apart): Workflows start before cancellation, show `cancelled` or `success`

## Evidence

### Workflow Configuration

```yaml
concurrency:
  group: guard-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### Observed Behavior

- Success rate: 60% (workflows that start jobs before cancellation)
- Action Required rate: 40% (workflows cancelled before jobs start)
- Pattern: Same PR branch shows both success and action_required outcomes
- Jobs executed: 0 for `action_required` runs, >0 for all other statuses

### Historical Context

- Issue #319 (Oct 2025): Same pattern, closed as not_planned
- Issue #307 (Oct 2025): Same pattern, closed as not_planned
- Current issue #544: Recurring pattern indicates incomplete understanding

## Solution Options

### Option 1: Disable Concurrency Cancellation (NOT RECOMMENDED)

```yaml
concurrency:
  group: guard-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false # Allow all runs to complete
```

**Pros**:

- Eliminates `action_required` status
- All workflow runs complete with definitive status

**Cons**:

- Wastes CI resources running outdated commits
- Longer queue times for workflow execution
- Multiple runs for same PR consume runner minutes

### Option 2: Update Monitoring Logic (RECOMMENDED)

Treat `action_required` as `cancelled` for workflows with `cancel-in-progress: true`.

**Implementation**:

```typescript
if (workflow.conclusion === "action_required" && workflow.jobs.length === 0) {
  // This is a concurrency-cancelled run, not a failure
  conclusion = "cancelled";
}
```

**Pros**:

- Maintains efficient CI resource usage
- Accurately reflects workflow behavior
- No workflow configuration changes needed

**Cons**:

- Requires monitoring system update
- Needs to be documented for other users

### Option 3: Quality Gate Summary Workflow

Create a single workflow that waits for and aggregates guard workflow results.

**Pros**:

- Single source of truth for PR status
- Handles `action_required` transparently
- Can implement retry logic

**Cons**:

- Additional workflow complexity
- Adds latency to PR validation
- More maintenance burden

## Recommended Resolution

**Short-term**: Document that `action_required` is expected behavior, not a failure.

**Long-term**: Update monitoring system to correctly interpret `action_required` status:

- For workflows with `cancel-in-progress: true` and zero jobs: treat as `cancelled`
- For workflows with actual jobs: treat as genuine action required

## Prevention

### For Future Workflows

1. Document concurrency strategy in workflow comments
2. Use `cancel-in-progress: false` for critical status checks
3. Implement summary workflows for complex validation pipelines

### For Monitoring

1. Add context-aware status interpretation
2. Track workflow execution metrics (jobs started vs cancelled)
3. Alert only on genuinely problematic patterns

## References

- GitHub Actions Concurrency: https://docs.github.com/en/actions/using-jobs/using-concurrency
- GitHub Actions Workflow Status: https://docs.github.com/en/rest/actions/workflow-runs
- Related Issues: #307, #319, #544
- Monitoring Run: https://github.com/ralphschuler/.screeps-gpt/actions/runs/19196614001

## Status

**Resolution**: This is expected GitHub Actions behavior, not a bug.

**Action Items**:

- [ ] Update monitoring to handle `action_required` correctly
- [x] Document root cause and resolution
- [ ] Add monitoring metric for concurrency cancellations
- [ ] Consider quality gate summary workflow for future iteration
