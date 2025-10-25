# Deployment Failure Incident - October 25, 2025

## Incident Summary

**Date**: October 25, 2025  
**Severity**: CRITICAL  
**Status**: RESOLVED  
**Issue**: ralphschuler/.screeps-gpt#289

## Problem Statement

The Screeps bot lost all game presence starting October 24, 2025, with no deployments occurring for 11 consecutive releases (v0.6.0 through v0.7.15). PTR telemetry monitoring detected empty stats data, confirming complete loss of bot execution in the live environment.

## Root Cause Analysis

### Timeline

- **October 24, 2025 13:25 UTC**: Last successful deployment (v0.5.24, Run 76)
- **October 24, 2025 13:25 UTC**: Deployment runs 77-78 immediately cancelled
- **October 24-25, 2025**: 11 releases created (v0.6.0 to v0.7.15) with NO deployments triggered
- **October 25, 2025 07:02 UTC**: PTR monitoring detected empty stats, created issue

### Root Cause

The deployment workflow (`.github/workflows/deploy.yml`) had a **malformed trigger configuration**:

```yaml
on:
  release: # INCORRECT - incomplete, no event types specified
```

According to GitHub Actions specification, `release:` without activity types (e.g., `published`, `created`) will never trigger. The workflow should have been:

```yaml
on:
  push:
    tags:
      - "v*"
```

### Why This Happened

Per `DEPLOY_WORKFLOW_FIX.md`, a previous fix removed the non-functional `release.published` trigger in favor of `push.tags: v*`. However, the workflow file was incorrectly modified, resulting in the incomplete `release:` trigger that matched no events.

## Impact

**Severity**: CRITICAL

- ✗ Complete loss of game presence (no rooms controlled, no creeps spawned)
- ✗ Monitoring system compromised (PTR monitoring ineffective without active bot)
- ✗ Development pipeline blocked (cannot validate bot improvements)
- ✗ 11 consecutive releases failed to deploy (v0.6.0 through v0.7.15)

## Resolution

### Immediate Fix

1. **Corrected deployment workflow trigger** (`.github/workflows/deploy.yml`):
   - Changed from: `on: release:` (malformed)
   - Changed to: `on: workflow_run` (triggers after Post Merge Release completes)
   - This ensures deployments run automatically after successful releases
2. **Added manual deployment capability**:
   - Added `workflow_dispatch` trigger for emergency manual deployments
   - Supports optional version input parameter
   - Falls back to `package.json` version when no version specified

3. **Enhanced version extraction logic**:
   - Handles workflow_run events (extracts latest git tag)
   - Handles manual workflow dispatch with optional version input
   - Falls back to package.json version as last resort

### Deployment Recovery Options

#### Option 1: Automatic (Recommended)

Merge the fix PR to `main`. The post-merge-release workflow will:

1. Bump version to v0.7.17 (or appropriate semantic version)
2. Create GitHub Release (non-prerelease)
3. **Trigger deployment automatically** (via workflow_run)

#### Option 2: Manual Deployment via GitHub UI

1. Go to: Actions → Deploy Screeps AI → Run workflow
2. Select branch: `main` (or the branch with the fix)
3. Leave version input empty (will use current package.json version)
4. Click "Run workflow"

## Verification Steps

After deployment:

1. **Check workflow run**: Verify Deploy Screeps AI workflow completed successfully
2. **Check Screeps web interface**: Confirm bot presence and active creeps
3. **Wait 3-hour PTR cycle**: Next monitoring run should show populated stats data
4. **Review PTR stats**: Verify `reports/copilot/ptr-stats.json` shows active rooms and creeps

## Prevention Measures

### Immediate Actions

- [x] Fix deployment workflow trigger configuration
- [x] Add manual deployment capability for emergency recovery
- [x] Document incident for future reference

### Long-term Improvements

1. **Workflow Validation in CI**:
   - Add automated GitHub Actions workflow syntax validation
   - Validate that deployment workflow has proper triggers configured

2. **Enhanced Monitoring**:
   - Add deployment monitoring to detect when releases don't trigger deployments
   - Alert when version tags are created but no deployment occurs within expected time

3. **Deployment Health Checks**:
   - Post-deployment verification of bot activity
   - Automated rollback if deployment succeeds but bot doesn't activate

4. **Documentation**:
   - ✓ Maintain `DEPLOY_WORKFLOW_FIX.md` accuracy
   - Add deployment trigger testing to quality gate workflow
   - Include deployment troubleshooting guide in operations docs

## Lessons Learned

1. **GitHub Actions Trigger Syntax**: Incomplete trigger definitions (e.g., `release:` without types) silently fail
2. **Testing Critical Workflows**: Deployment workflow changes should be tested with actual tag pushes
3. **Monitoring Importance**: PTR monitoring successfully detected the deployment failure
4. **Documentation Drift**: Workflow configuration diverged from documented fix (DEPLOY_WORKFLOW_FIX.md)

## Related Documentation

- `DEPLOY_WORKFLOW_FIX.md` - Previous deployment workflow fix documentation
- `docs/automation/overview.md` - Deployment flow documentation
- Issue ralphschuler/.screeps-gpt#284 - Previous bot inactivity resolution (similar pattern)
- Issue ralphschuler/.screeps-gpt#289 - This deployment failure incident

## References

- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [GitHub Actions Events that Trigger Workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)
- Deploy Workflow Runs: [76 (success)](https://github.com/ralphschuler/.screeps-gpt/actions/runs/18781158516), [77-78 (cancelled)](https://github.com/ralphschuler/.screeps-gpt/actions/runs/18781158529)
