# Debugging Copilot Workflows

This guide explains how to debug and troubleshoot Copilot automation workflows using uploaded artifacts.

## Overview

All copilot-exec workflows automatically upload their execution logs as artifacts. These logs provide valuable insights into:

- AI decision-making processes
- Prompt rendering and execution
- Error messages and stack traces
- Automation behavior and outcomes

## Accessing Artifacts

### Via GitHub Actions UI

1. Navigate to **Actions** tab in the repository
2. Select the workflow run you want to inspect
3. Scroll to the **Artifacts** section at the bottom of the run summary
4. Click on the artifact name to download

### Via GitHub CLI

```bash
# List artifacts for a specific run
gh run view <run-id> --repo ralphschuler/.screeps-gpt

# Download specific artifact
gh run download <run-id> --name <artifact-name> --repo ralphschuler/.screeps-gpt
```

## Artifact Naming Convention

Artifacts follow a consistent naming pattern:

| Workflow | Artifact Name Pattern |
|----------|----------------------|
| Strategic Planner | `strategic-planner-report-{run_id}` |
| Issue Triage | `issue-triage-logs-{issue_number}-{run_id}` |
| Repository Audit | `repository-audit-logs-{run_id}` |
| Todo PR | `todo-issue-logs-{issue_number}-{run_id}` |
| Todo Daily | `todo-daily-prioritization-logs-{run_id}` |
| Email Triage | `email-triage-logs-{run_id}` |
| Changelog to Blog | `changelog-to-blog-logs-{version}` |

## Log Contents

Each log file contains:

- **Prompt**: The rendered prompt sent to Copilot CLI
- **Response**: Full Copilot CLI output
- **Timestamps**: Execution timing information
- **Errors**: Any error messages or failures

## Retention Policy

Artifacts are retained for **30 days** to balance:
- Storage costs
- Debugging utility
- Audit trail requirements

After 30 days, artifacts are automatically deleted by GitHub.

## Troubleshooting Common Issues

### Empty or Missing Logs

If the artifact is empty or missing:

1. Check if the workflow step failed before log generation
2. Verify the `output-path` parameter in the copilot-exec step
3. Review the workflow run logs for errors

### Cache Hit (No Fresh Response)

If Copilot returns a cached response:

1. Set `force-response: true` in the copilot-exec step
2. Or modify the prompt to generate a new cache key

### Timeout Errors

If the workflow times out:

1. Increase the `timeout` parameter in copilot-exec
2. Review the log for slow operations
3. Check MCP server connectivity

## Workflows with Artifact Upload

The following workflows upload copilot-exec logs:

- `copilot-strategic-planner.yml` - Strategic analysis reports
- `copilot-issue-triage.yml` - Issue triage decisions
- `copilot-review.yml` - Repository audit findings
- `copilot-todo-pr.yml` - Implementation progress
- `copilot-todo-daily.yml` - Daily prioritization
- `copilot-email-triage.yml` - Email processing
- `copilot-changelog-to-blog.yml` - Blog post generation

## Best Practices

1. **Download artifacts promptly** - Before the 30-day retention expires
2. **Use verbose mode** - Set `verbose: "true"` for detailed logging
3. **Check related artifacts** - Multiple workflows may have related logs
4. **Compare with successful runs** - Diff against working workflow runs

## Related Documentation

- [Automation Overview](./overview.md)
- [Copilot Environment](./copilot-environment.md)
- [Prompt Audit](./prompt-audit.md)
