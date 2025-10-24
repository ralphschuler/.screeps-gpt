# Deploy Workflow Fix Documentation

## Problem Summary

The Deploy Screeps AI workflow (`.github/workflows/deploy.yml`) was not triggering on release publication events, causing deployment to be skipped when new releases were created.

## Root Cause Analysis

### Initial Observations

1. Post-merge release workflow successfully creates releases (v0.5.1, v0.4.0, v0.2.0)
2. Deploy workflow shows "skipped" status on `workflow_run` events
3. Deploy workflow succeeds when triggered by tag push (`push` events)

### GitHub Actions Trigger Behavior

The deploy workflow had two triggers configured:
- `push.tags: v*` - **Works correctly** ✅
- `release.published` - **Never fires** ❌

**Key Finding:** GitHub Actions has a security measure that prevents workflows triggered by `GITHUB_TOKEN` from triggering other workflows. This is designed to prevent infinite workflow loops and excessive resource consumption.

### Why `release.published` Never Triggered

1. The `post-merge-release.yml` workflow creates releases using `GITHUB_TOKEN`
2. GitHub Actions blocks `release.published` events when releases are created by workflows using `GITHUB_TOKEN`
3. Only releases created manually (via UI) or with a Personal Access Token (PAT) would trigger `release.published`

**Evidence:**
- [Stack Overflow Discussion](https://stackoverflow.com/questions/69063452/github-actions-on-release-created-workflow-trigger-not-working)
- [GitHub Community Discussion](https://github.com/orgs/community/discussions/25281)

## Solution

### Changes Made

1. **Removed non-functional trigger** from `.github/workflows/deploy.yml`:
   - Deleted `release.published` trigger
   - Kept only `push.tags: v*` trigger

2. **Simplified version extraction logic**:
   - Removed conditional logic for release events
   - Direct extraction from `github.ref_name`
   - Added `::notice::` logging for better visibility

3. **Updated documentation** in `docs/automation/overview.md`:
   - Explained why only `push.tags` trigger is used
   - Added context about GitHub Actions trigger restrictions
   - Clarified the deployment flow

### Files Changed

```
.github/workflows/deploy.yml    | 21 ++++-----------------
docs/automation/overview.md     |  4 ++--
2 files changed, 6 insertions(+), 19 deletions(-)
```

## Impact

### Before Fix

- ✅ Deployment works via tag push
- ❌ Confusing "skipped" workflow runs on `workflow_run` events
- ❌ Misleading workflow configuration suggesting release events work

### After Fix

- ✅ Deployment works via tag push (unchanged)
- ✅ No more confusing "skipped" runs
- ✅ Clear, accurate workflow configuration
- ✅ Simplified, maintainable code
- ✅ Accurate documentation

## Deployment Flow

The current deployment flow (working correctly):

1. Developer merges PR to `main`
2. `post-merge-release.yml` triggers on push to `main`
3. Release workflow:
   - Bumps version in `package.json`
   - Updates `CHANGELOG.md`
   - Commits changes to `main`
   - **Pushes version tag** (e.g., `v0.5.1`)
   - Creates GitHub Release
4. `deploy.yml` triggers on **tag push** (not release event)
5. Deploy workflow:
   - Builds code
   - Deploys to Screeps
   - Runs autospawner
   - Sends notifications

## Alternative Solutions Considered

### Option 1: Use PAT instead of GITHUB_TOKEN
- ❌ Requires creating and maintaining a Personal Access Token
- ❌ Additional security considerations
- ❌ More complex setup
- ❌ Not necessary since tag push works perfectly

### Option 2: Keep both triggers
- ❌ Confusing and misleading
- ❌ Only one trigger actually works
- ❌ Makes troubleshooting harder

### Option 3: Remove tag push, keep release trigger (with PAT)
- ❌ Requires PAT setup
- ❌ More moving parts
- ❌ Current tag-based approach works reliably

**Selected Solution:** Remove non-functional trigger, keep working trigger
- ✅ Simple and clear
- ✅ No additional setup required
- ✅ Maintains existing working behavior
- ✅ Easy to understand and maintain

## Validation

### Automated Tests

1. YAML syntax validation: ✅ Pass
2. yamllint checks: ✅ Pass
3. CodeQL security scan: ✅ Pass (0 alerts)
4. Validation script: ✅ Pass

### Manual Verification

- [x] Workflow file syntax is valid
- [x] No security vulnerabilities introduced
- [x] Documentation accurately reflects behavior
- [x] Changes follow repository conventions

## Future Releases

Future releases will deploy automatically via this flow:

1. Merge to `main` → Tag pushed → Deploy triggered ✅
2. No manual intervention required ✅
3. Clear workflow execution without skipped runs ✅

## References

- Issue: #[issue_number]
- Commit: e0714e8
- GitHub Actions Documentation: [Triggering a workflow](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow)
- Related: [How to automate tagging and release workflows in GitHub](https://graphite.dev/guides/how-to-automate-tagging-and-release-workflows-in-github)
