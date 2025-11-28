# GitHub Projects Integration Guide

## Overview

This guide provides a comprehensive overview of the GitHub Projects V2 integration implemented for automated Copilot workflow management. The integration tracks issues, pull requests, and discussions through their entire lifecycle on a project board.

## Architecture

### Components

1. **project-sync Composite Action** (`.github/actions/project-sync/action.yml`)
   - Centralized project management operations
   - Adds items to project board via GitHub CLI
   - Updates project field values (Status, Priority, Automation State)
   - Gracefully handles missing configuration and permission issues

2. **Project Sync Workflows**
   - `project-sync-items.yml` - Auto-adds new issues/PRs/discussions
   - `project-pr-status.yml` - Tracks PR lifecycle and review states
   - `project-comment-activity.yml` - Marks items with active discussion

3. **Integrated Copilot Workflows**
   - `copilot-issue-triage.yml` - Updates status after triage
   - `copilot-todo-pr.yml` - Tracks Todo automation progress

**Note**: CI AutoFix (`copilot-ci-autofix.yml`) and Repository Audit (`copilot-review.yml`) workflows are not integrated with project tracking because GitHub Projects cannot track workflow runs - only issues, PRs, and discussions can be added to projects.

## Lifecycle Tracking

### Issue Lifecycle

1. **Creation** → Status: `Pending`, Automation State: `Not Started`
2. **Triage** → Status: `Backlog`, Automation State: `Triaged`
3. **Todo Label Applied** → Status: `In Progress`, Automation State: `Implementing`
4. **PR Created** → Status: `Under Review`, Automation State: `PR Created`
5. **Comment Added** → Automation State: `Active Discussion`
6. **Closed** → Status: `Done` or `Canceled`

### Pull Request Lifecycle

1. **Creation** → Status: `Pending`, Automation State: `Not Started`
2. **Draft** → Status: `In Progress`, Automation State: `Draft`
3. **Ready for Review** → Status: `Under Review`, Automation State: `Ready for Review`
4. **Review Requested** → Automation State: `Review Requested`
5. **Approved** → Automation State: `Approved`
6. **Changes Requested** → Status: `In Progress`, Automation State: `Changes Requested`
7. **Merged** → Status: `Done`, Automation State: `Merged`
8. **Closed without Merge** → Status: `Canceled`, Automation State: `Closed without Merge`

## Configuration

### Required Repository Variables

Set these in repository Settings → Actions → Variables:

- **PROJECT_NUMBER**: GitHub Project number (e.g., `1`)
- **PROJECT_OWNER**: Project owner username or organization (e.g., `ralphschuler`)

### Project Board Fields

The system expects these fields in your GitHub Project:

| Field Name       | Type          | Options                                                              |
| ---------------- | ------------- | -------------------------------------------------------------------- |
| Status           | Single Select | Pending, Backlog, In Progress, Under Review, Blocked, Done, Canceled |
| Priority         | Single Select | Critical, High, Medium, Low, None                                    |
| Type             | Single Select | Bug, Feature, Enhancement, Chore, Question                           |
| Automation State | Single Select | Not Started, Triaged, Implementing, PR Created, etc.                 |
| Domain           | Single Select | Runtime, Automation, Documentation, Dependencies, etc.               |

See [GitHub Projects Setup Guide](./github-projects-setup.md) for detailed field configuration.

## Usage

### Using the project-sync Action

```yaml
- name: Update project
  uses: ./.github/actions/project-sync
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    project-number: ${{ vars.PROJECT_NUMBER }}
    project-owner: ${{ vars.PROJECT_OWNER }}
    item-type: issue # or pull_request, discussion
    item-url: ${{ github.event.issue.html_url }}
    status-field: In Progress
    priority-field: High
    automation-state-field: Implementing
```

### Action Inputs

| Input                    | Required | Default        | Description                              |
| ------------------------ | -------- | -------------- | ---------------------------------------- |
| `github-token`           | No       | `github.token` | GitHub token with project scope          |
| `project-number`         | No       | -              | Project number from URL                  |
| `project-owner`          | No       | -              | Project owner (user or org)              |
| `item-type`              | Yes      | -              | `issue`, `pull_request`, or `discussion` |
| `item-url`               | Yes      | -              | Full URL of item to add                  |
| `status-field`           | No       | -              | Status value to set                      |
| `priority-field`         | No       | -              | Priority value to set                    |
| `automation-state-field` | No       | -              | Automation state value to set            |

### Action Outputs

| Output    | Description                                          |
| --------- | ---------------------------------------------------- |
| `item-id` | Project item ID if successfully added                |
| `status`  | Operation status (`success`, `skipped`, or `failed`) |

## Graceful Degradation

The integration is designed to fail gracefully:

- **Missing Configuration**: Workflows skip project sync with a warning
- **Permission Errors**: Non-fatal failures logged but don't block workflow
- **API Failures**: Operations continue even if project updates fail
- **Field Mismatches**: Individual field updates fail independently

This ensures project integration is opt-in and doesn't break existing functionality.

## Monitoring & Troubleshooting

### Check Workflow Logs

1. Navigate to Actions tab in repository
2. Select a workflow run that should sync to project
3. Expand the project sync step to see detailed logs
4. Look for warnings or errors in sync operations

### Common Issues

**Items not appearing in project:**

- Verify `PROJECT_NUMBER` and `PROJECT_OWNER` variables are set
- Check project permissions (should be accessible by repository)
- Review workflow logs for permission errors

**Field updates failing:**

- Verify field names match exactly (case-sensitive)
- Ensure field options include the values being set
- Check that fields are Single Select type, not Text

**Permission denied errors:**

- Ensure workflow has `repository-projects: write` permission
- Verify project is owned by same user/org as repository
- Consider using PAT with `project` scope if needed

## Benefits

1. **Full Lifecycle Visibility**: Track all items from creation to completion
2. **Automation Pipeline Monitoring**: See which items are being processed
3. **Bottleneck Identification**: Quickly find items stuck in specific states
4. **Historical Tracking**: Maintain project history with state transitions
5. **Integration with Existing Tools**: Works seamlessly with label system and Copilot workflows

## Future Enhancements

Potential improvements for the project integration:

- **Custom Views**: Add automated view creation based on project configuration
- **Status Sync from Labels**: Automatically update project status based on label changes
- **Metrics Dashboard**: Track automation success rates and cycle times
- **Discussion Integration**: Add full support for GitHub Discussions tracking
- **Advanced Field Mapping**: Support for custom field types (Date, Number, etc.)
- **Batch Operations**: Bulk update project items for efficiency

## Related Documentation

- [GitHub Projects Setup Guide](./github-projects-setup.md) - Step-by-step setup instructions
- [Automation Overview](./overview.md) - Complete workflow automation documentation
- [Label System](./label-system.md) - Repository label structure and usage
- [GitHub Projects Documentation](https://docs.github.com/en/issues/planning-and-tracking-with-projects) - Official GitHub docs

## Support

For issues or questions about project integration:

1. Check this guide and troubleshooting section
2. Review workflow logs in Actions tab
3. Consult [GitHub Projects Setup Guide](./github-projects-setup.md)
4. File an issue with `automation` and `documentation` labels
