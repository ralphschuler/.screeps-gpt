# GitHub Actions Workflow Guidelines

This document provides guidelines for creating and maintaining GitHub Actions workflows in this repository.

## Timeout Configuration

### Overview

All workflows **must** define explicit `timeout-minutes` at the job level to prevent indefinite hangs and resource waste. This is a critical reliability measure that:

- Provides faster failure feedback for developers
- Prevents hung workflows from consuming runner resources for hours
- Reduces costs on metered runner minutes
- Makes workflow behavior predictable and debuggable

### Default Behavior

Without explicit timeouts, GitHub Actions workflows default to a **360-minute (6-hour) timeout**. This is excessive for most operations and creates risk when jobs encounter:

- Network timeouts
- API rate limits
- Infinite loops
- Deadlocks
- External service failures

### Timeout Values by Workflow Type

#### Fast Operations (5-15 minutes)

**Use Cases:**

- Linting and formatting checks
- YAML validation
- Quick guard workflows
- Simple project management tasks
- Email notifications
- Label synchronization

**Example:**

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      # ... steps
```

**Applicable Workflows:**

- `guard-lint.yml` (15 min)
- `guard-format.yml` (15 min)
- `guard-yaml-lint.yml` (15 min)
- `email-notification.yml` (5 min)
- `label-sync.yml` (5 min)
- `project-*.yml` (5 min)

#### Standard Operations (15-30 minutes)

**Use Cases:**

- Build validation
- Unit test suites
- Documentation builds
- Version checks
- Security audits
- Post-merge releases

**Example:**

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      # ... steps
```

**Applicable Workflows:**

- `guard-build.yml` (15 min)
- `guard-test-unit.yml` (15 min)
- `guard-test-e2e.yml` (15 min)
- `guard-test-regression.yml` (15 min)
- `guard-coverage.yml` (15 min)
- `guard-test-docs.yml` (15 min)
- `guard-deprecation.yml` (15 min)
- `guard-security-audit.yml` (15 min)
- `guard-version.yml` (15 min)
- `docs-pages.yml` (15 min)
- `post-merge-release.yml` (15 min)
- `quality-gate-summary.yml` (30 min) - Aggregates multiple guard workflow results
- `screeps-spawn-monitor.yml` (30 min) - Periodic spawn checks and simple respawn logic

#### Deployment Operations (10-15 minutes)

**Use Cases:**

- Deployment to production
- Package publishing
- Dependency auto-merge

**Example:**

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      # ... steps
```

**Applicable Workflows:**

- `deploy.yml` (10 min)
- `publish-package.yml` (10 min)
- `dependabot-automerge.yml` (10 min)

#### Complex Operations (30-45 minutes)

**Use Cases:**

- Copilot-powered analysis
- AI-driven automation
- Issue triage and reformulation
- PR generation
- Strategic monitoring
- Comprehensive telemetry collection

**Example:**

```yaml
jobs:
  analyze:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      # ... steps
```

**Applicable Workflows:**

- `copilot-review.yml` (45 min)
- `copilot-issue-triage.yml` (45 min)
- `copilot-todo-pr.yml` (45 min)
- `copilot-todo-daily.yml` (45 min)
- `copilot-ci-autofix.yml` (45 min)
- `copilot-email-triage.yml` (45 min)
- `copilot-changelog-to-blog.yml` (45 min)
- `screeps-monitoring.yml` (45 min) - Comprehensive strategic analysis with PTR telemetry collection

**Note on Monitoring Workflows:**

The repository has two monitoring workflows with different timeout requirements:

- **`screeps-monitoring.yml` (45 min)**: Performs comprehensive strategic monitoring combining AI-powered analysis with PTR telemetry collection. Requires longer timeout due to LLM API calls, extensive data fetching, snapshot collection, and alert processing.
- **`screeps-spawn-monitor.yml` (30 min)**: Performs simpler spawn status checks and automated respawn operations. Shorter timeout is sufficient as it only checks spawn state and triggers respawn if needed, without AI analysis or extensive telemetry.

Choose 45 minutes for monitoring workflows that involve AI analysis or comprehensive data collection, and 30 minutes for simpler periodic checks.

### Implementation Guidelines

#### Job-Level Configuration

Always add `timeout-minutes` at the job level, not the workflow level:

```yaml
jobs:
  my-job:
    runs-on: ubuntu-latest
    timeout-minutes: 15 # ✅ Correct
    steps:
      - name: Step 1
        run: echo "example"
```

#### Multiple Jobs

Each job should have its own appropriate timeout:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15 # Build needs 15 minutes
    steps:
      # ... build steps

  deploy:
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 10 # Deploy needs 10 minutes
    steps:
      # ... deploy steps
```

#### Conditional Jobs

Jobs with conditions still need timeouts:

```yaml
jobs:
  conditional-job:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    timeout-minutes: 15 # ✅ Still required
    steps:
      # ... steps
```

### Selecting Appropriate Timeouts

When choosing a timeout value, consider:

1. **Expected Duration**: Add 2-3x buffer over typical execution time
2. **Failure Modes**: Consider slow API responses, network issues
3. **Runner Type**: Self-hosted runners may have different performance
4. **External Dependencies**: Account for third-party service latency
5. **Error Budget**: Balance between allowing retries and failing fast

#### Testing Timeouts

After setting a timeout, validate it works correctly:

```bash
# Monitor workflow execution times
gh run list --workflow=guard-lint.yml --limit 10

# View run duration
gh run view <run-id> --log
```

#### Adjusting Timeouts

Timeouts may need adjustment based on:

- Workflow evolution (new steps added)
- Repository growth (larger codebases)
- Dependency updates (slower/faster operations)
- Infrastructure changes (faster runners)

**Review workflow execution history quarterly** to ensure timeouts remain appropriate.

### Best Practices

#### ✅ Do

- **Always** add explicit `timeout-minutes` to every job
- Use conservative (higher) values initially, then tune based on metrics
- Document rationale for unusual timeout values in workflow comments
- Monitor workflow execution times regularly
- Adjust timeouts when adding/removing significant work

#### ❌ Don't

- Never rely on the default 360-minute timeout
- Don't use overly tight timeouts that cause false failures
- Don't forget timeouts when copying workflow templates
- Don't use the same timeout for all workflow types

### Workflow Template

Use this template when creating new workflows:

```yaml
---
name: My New Workflow

on:
  pull_request:
    branches:
      - main

permissions:
  contents: read

concurrency:
  group: my-workflow-${{ github.ref }}
  cancel-in-progress: true

jobs:
  my-job:
    runs-on: ubuntu-latest
    timeout-minutes: 15 # ⚠️ REQUIRED: Set appropriate value
    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Setup Environment
        # ... setup steps

      - name: Run Task
        # ... task steps
```

### Review Checklist

When reviewing new or modified workflows, verify:

- [ ] Every job has explicit `timeout-minutes`
- [ ] Timeout value is appropriate for job type
- [ ] Timeout considers expected duration + buffer
- [ ] Unusual values are documented with comments
- [ ] Multi-job workflows have per-job timeouts

### Emergency Response

If a workflow hangs despite timeout configuration:

1. **Immediate**: Cancel the run manually via GitHub UI
2. **Investigation**: Check workflow logs for hang location
3. **Short-term**: Reduce timeout to prevent future long hangs
4. **Root Cause**: Identify and fix the underlying issue
5. **Validation**: Test fix with intentional timeout scenario

### References

- **GitHub Actions Documentation**: [Workflow syntax - timeout-minutes](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idtimeout-minutes)
- **Good Examples**:
  - `screeps-monitoring.yml`: 45-minute timeout for complex strategic monitoring with AI analysis and PTR telemetry
  - `screeps-spawn-monitor.yml`: 30-minute timeout for simpler spawn status checks and automated respawn
  - `quality-gate-summary.yml`: 30-minute timeout for aggregating multiple guard workflow results
- **Related Documentation**:
  - `docs/automation/overview.md`: Overall automation architecture
  - `AGENTS.md`: Agent-specific guidelines and best practices

### Maintenance

This document should be updated when:

- New workflow types are introduced
- Timeout patterns change
- Best practices evolve
- GitHub Actions features change

**Last Updated**: 2025-11-12
**Maintained By**: Repository maintainers and automation team
