# GitHub Projects Integration Setup Guide

This guide explains how to set up and configure the GitHub Projects V2 integration for automated Copilot workflow management.

## Overview

The repository includes automated workflows that sync issues, pull requests, and discussions to a GitHub Projects board, tracking them through their entire lifecycle with intelligent status updates based on workflow events.

## Prerequisites

- Repository admin access
- Ability to create GitHub Projects (user or organization)
- GitHub token with `project` scope (for workflow automation)

## Step 1: Create GitHub Project

### Option A: Create via GitHub UI

1. Navigate to your GitHub profile or organization
2. Click on "Projects" tab
3. Click "New project"
4. Choose "Board" or "Table" template
5. Name your project (e.g., "Screeps GPT Development")
6. Note the project number from the URL (e.g., `https://github.com/users/USERNAME/projects/1` → project number is `1`)

### Option B: Create via GitHub CLI

```bash
# For user projects
gh project create --owner USERNAME --title "Screeps GPT Development"

# For organization projects
gh project create --owner ORGNAME --title "Screeps GPT Development"
```

## Step 2: Configure Project Fields

Add the following custom fields to your project:

### Status Field (Single Select)

- **Name**: Status
- **Options**:
  - Pending (🟡)
  - Backlog (⚪)
  - In Progress (🔵)
  - Under Review (🟣)
  - Blocked (🔴)
  - Done (🟢)
  - Canceled (⚫)

### Priority Field (Single Select)

- **Name**: Priority
- **Options**:
  - Critical (🔴)
  - High (🟠)
  - Medium (🟡)
  - Low (🟢)
  - None (⚪)

### Type Field (Single Select)

- **Name**: Type
- **Options**:
  - Bug
  - Feature
  - Enhancement
  - Chore
  - Question

### Automation State Field (Single Select)

- **Name**: Automation State
- **Options**:
  - Not Started
  - Triaged
  - Implementing
  - PR Created
  - Ready for Review
  - Under Review
  - Reviewed
  - Approved
  - Changes Requested
  - Autofix Attempted
  - Audit Completed
  - Active Discussion
  - Merged
  - Closed without Merge
  - Completed

> **Clarification of Automation State meanings:**
>
> - **Not Started**: No work has begun on the issue/PR
> - **Triaged**: Issue/PR has been reviewed and categorized but work hasn't started
> - **Implementing**: Work is actively in progress (coding, writing, etc.)
> - **PR Created**: A pull request has been opened for the issue
> - **Ready for Review**: PR is complete and ready for reviewers to begin
> - **Under Review**: Reviewers are actively reviewing the PR
> - **Reviewed**: Review process complete but not yet approved (comments/changes requested but no approval)
> - **Approved**: PR has received necessary approvals from reviewers
> - **Changes Requested**: Reviewers have requested changes to the PR
> - **Autofix Attempted**: Automated fix has been attempted by CI/automation
> - **Audit Completed**: Final audit or check (security, compliance) has been completed
> - **Active Discussion**: Issue/PR currently has active discussion (design, requirements)
> - **Merged**: PR has been merged into the main branch
> - **Closed without Merge**: PR/issue was closed without merging
> - **Completed**: All work finished, no further action required

### Domain Field (Single Select)

- **Name**: Domain
- **Options**:
  - Runtime
  - Automation
  - Documentation
  - Dependencies
  - Monitoring
  - Infrastructure

## Step 3: Configure Repository Variables

Set the following repository variables to enable project integration:

1. Navigate to repository Settings → Secrets and variables → Actions → Variables
2. Add the following variables:

| Variable Name    | Value                        | Description                                                |
| ---------------- | ---------------------------- | ---------------------------------------------------------- |
| `PROJECT_NUMBER` | `1` (or your project number) | GitHub Project number from the URL                         |
| `PROJECT_OWNER`  | `username` or `orgname`      | GitHub username or organization name that owns the project |

**Example Configuration:**

- `PROJECT_NUMBER`: `1`
- `PROJECT_OWNER`: `ralphschuler`

## Step 4: Configure Permissions (Optional)

If using a Personal Access Token (PAT) for enhanced permissions:

1. Create a fine-grained PAT with the following permissions:
   - Repository permissions: Read access to issues and pull requests
   - Account permissions: Read and write access to projects
2. Add as repository secret named `GITHUB_TOKEN` or `PROJECT_TOKEN`
3. Update workflow files to use the custom token if needed

**Note**: The default `GITHUB_TOKEN` provided by GitHub Actions should work for most cases if the project is owned by the same user/org as the repository.

## Step 5: Verify Integration

Once configured, the following workflows will automatically sync items to your project:

### Automatic Item Addition

- **Trigger**: New issues, PRs, or discussions are created
- **Workflow**: `project-sync-items.yml`
- **Initial Status**: Pending
- **Initial Automation State**: Not Started

### Status Updates on Events

- **Issue Triage**: Sets status to "Backlog" and automation state to "Triaged"
- **Todo Label Applied**: Sets status to "In Progress" and automation state to "Implementing"
- **PR Created**: Sets status to "Under Review" and automation state to "PR Created"
- **PR Ready for Review**: Updates automation state to "Ready for Review"
- **PR Approved**: Updates automation state to "Approved"
- **PR Changes Requested**: Sets status back to "In Progress"
- **PR Merged**: Sets status to "Done" and automation state to "Merged"
- **Comment Activity**: Updates automation state to "Active Discussion"

## Step 6: Create Project Views

Set up useful views in your project board:

### 1. Status Board View

- Group by: Status
- Sort by: Priority (descending)
- Filter: Status != Done, Canceled

### 2. Automation Pipeline View

- Group by: Automation State
- Sort by: Created (ascending)
- Filter: Status = In Progress, Under Review

### 3. Priority Table View

- Layout: Table
- Sort by: Priority (descending), Created (descending)
- Columns: Title, Status, Priority, Type, Automation State, Domain

### 4. Completed Items View

- Filter: Status = Done OR Status = Canceled
- Sort by: Updated (descending)

## Troubleshooting

### Project Sync Not Working

**Symptoms**: Items not appearing in project board

**Solutions**:

1. Verify `PROJECT_NUMBER` and `PROJECT_OWNER` variables are set correctly
2. Check workflow run logs for permission errors
3. Ensure the project exists and is accessible
4. Verify repository has `repository-projects: write` permission in workflow files

### Field Update Failures

**Symptoms**: Items added but field values not updating

**Solutions**:

1. Verify field names match exactly (case-sensitive)
2. Ensure that field option values used in workflows exist as options in the project board configuration and match exactly (case-sensitive)
3. Review workflow logs for specific field update errors
4. Ensure field types are Single Select (not Text or other types)

### Permission Errors

**Symptoms**: "Resource not accessible by integration" errors

**Solutions**:

1. Verify the project is owned by the same user/org as the repository
2. Check that workflow permissions include `repository-projects: write`
3. Consider using a PAT with `project` scope if default token insufficient
4. Ensure the project is not private if using default token

## Disabling Project Integration

To disable project integration while keeping workflows functional:

1. Remove or leave empty the `PROJECT_NUMBER` and `PROJECT_OWNER` repository variables
2. Workflows will skip project sync operations and log a warning
3. All other workflow functionality remains intact

This allows gradual rollout or temporary disabling without modifying workflow files.

## Advanced Configuration

### Custom Field Mappings

Edit workflow files to customize which status values are set for different events:

```yaml
- name: Update project status
  uses: ./.github/actions/project-sync
  with:
    status-field: Custom Status Value
    automation-state-field: Custom State Value
```

### Additional Fields

Add more custom fields to your project and update workflows to populate them:

```yaml
- name: Update project with domain
  uses: ./.github/actions/project-sync
  with:
    item-url: ${{ github.event.issue.html_url }}
    # Custom fields can be added to the composite action
```

## Related Documentation

- [Automation Overview](./overview.md) - Complete workflow automation guide
- [Label System](./label-system.md) - Repository label structure and usage
- [GitHub Projects Documentation](https://docs.github.com/en/issues/planning-and-tracking-with-projects) - Official GitHub documentation

## Support

For issues with project integration:

1. Check workflow run logs in the Actions tab
2. Verify configuration variables are set correctly
3. Review troubleshooting section above
4. File an issue with `automation` and `type/bug` labels
