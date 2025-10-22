# Workflow Troubleshooting Guide

This guide covers common issues and troubleshooting steps for GitHub Actions workflows in the .screeps-gpt repository.

## Post Merge Release Workflow Issues

### Git Push Conflict with --force-with-lease

**Problem:** The post-merge release workflow fails at the "Commit changes to release branch" step with:

```
! [rejected]        HEAD -> release/v0.X.Y (stale info)
error: failed to push some refs to 'https://github.com/ralphschuler/.screeps-gpt'
```

**Root Cause:** This occurs when there's a race condition between multiple workflow runs or when the remote repository has been updated between the fetch and push operations, causing the `--force-with-lease` option to fail due to stale lease information.

**Solution (Fixed in #104):**

1. Added "Update remote refs" step before committing to ensure fresh ref information
2. Set `skip_fetch: false` in the git-auto-commit-action to fetch latest refs
3. Used `git fetch origin --prune` and `git remote prune origin` to clean up stale refs

**Prevention:** The regression test `tests/regression/post-merge-workflow-git-race-condition.test.ts` validates the fix remains in place.

**Related Issues:**

- Workflow run: #18703919715
- Fix PR: #104

### Version Bump Conflicts

**Problem:** Multiple concurrent merges to main can cause version bump conflicts.

**Mitigation:**

- The workflow includes a condition to skip if the commit message contains "chore: prepare release"
- Use of `--force-with-lease` prevents accidental overwrites
- Fresh ref fetching ensures latest state before operations

## Quality Gate Workflow Issues

### Test Failures Due to Missing Dependencies

**Problem:** Tests fail with "command not found" errors for Node.js tools.

**Solution:**

1. Ensure Node.js 16 setup is complete before running tests
2. Run `npm install` to install dependencies
3. Use proper environment variables for build tools

### Lint Failures

**Problem:** ESLint or Prettier checks fail in CI.

**Solution:**

1. Run `npm run lint:fix` locally before committing
2. Run `npm run format:write` to auto-format code
3. Check for TypeScript compilation errors

## Deploy Workflow Issues

### Screeps API Authentication

**Problem:** Deployment fails with authentication errors.

**Solution:**

1. Verify `SCREEPS_USERNAME`, `SCREEPS_PASSWORD`, and `SCREEPS_BRANCH` secrets are set
2. Check that the Screeps account has proper permissions
3. Ensure the API is accessible (not blocked by rate limits)

**Reference:** See `docs/operations/deployment-troubleshooting.md` for detailed deployment issues.

## General Troubleshooting Steps

### Check Workflow Logs

1. Navigate to the failed workflow run
2. Expand the failed step to see detailed error messages
3. Look for specific error codes or patterns

### Validate Secrets and Environment Variables

1. Check that required secrets are set in repository settings
2. Verify secret names match those used in workflows
3. Test secrets in a minimal reproduction case if possible

### Dependency Issues

1. Check for dependency conflicts in package-lock.json
2. Verify Node.js version compatibility (16.20.2)
3. Clear npm cache if needed: `npm cache clean --force`

### Concurrent Workflow Runs

1. Check if multiple workflows are running simultaneously
2. Consider adding workflow concurrency controls if needed
3. Use appropriate git strategies (force-with-lease, fresh fetches)

## Monitoring and Alerting

### Workflow Status Monitoring

The repository includes automated monitoring via:

- `copilot-ci-autofix.yml` - Automatically attempts to fix CI failures
- `copilot-review.yml` - Scheduled repository health checks

### Issue Creation

Failed workflows automatically create issues for investigation when:

1. Multiple consecutive failures occur
2. Critical path workflows (deploy, release) fail
3. Security or dependency vulnerabilities are detected

## Best Practices

### Writing Robust Workflows

1. Always fetch fresh refs before git operations
2. Use `--force-with-lease` instead of `--force` for safety
3. Include proper error handling and retry logic
4. Add regression tests for fixed issues
5. Document troubleshooting steps for common failures

### Testing Workflows

1. Use `npm run test:actions` to dry-run workflows locally
2. Test with representative data and edge cases
3. Verify secrets and environment setup in test environments
4. Include both success and failure scenarios in testing

---

For additional help, check the automation documentation in `docs/automation/overview.md` or create an issue with the `automation` and `needs/investigation` labels.
