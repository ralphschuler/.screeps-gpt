---
title: Deployment Rollback Runbook
date: 2025-11-27T01:00:00.000Z
---

# Deployment Rollback Runbook

This guide covers manual rollback procedures when automatic rollback fails or when manual intervention is required.

## Overview

The deployment workflow includes automatic rollback when health checks fail. However, there may be situations where manual rollback is necessary:

1. Automatic rollback fails
2. Issues detected after health check window
3. Need to rollback to a specific version
4. Debugging requires temporary rollback

## Automatic Rollback Process

When a deployment health check fails, the workflow automatically:

1. **Detects failure** - CPU usage is zero or aliveness check fails
2. **Gets previous version** - Finds the last successful release tag
3. **Rebuilds previous code** - Checks out and builds the previous version
4. **Redeploys** - Uploads the previous version to Screeps
5. **Creates issue** - Opens a GitHub issue for investigation

### Health Check Criteria

The deployment is considered healthy if:

- **CPU > 0**: Bot code is executing
- **Aliveness = active**: Bot API confirms execution
- **Creeps exist** (optional): Spawning is working

A deployment fails validation if:

- CPU usage is 0 AND aliveness check fails

## Manual Rollback Procedures

### Option 1: Re-run Previous Deployment

The simplest approach - trigger deployment of a known-good version:

```bash
# Via GitHub CLI
gh workflow run deploy.yml -f version=v0.170.0

# Or via GitHub UI:
# 1. Go to Actions → Deploy Screeps AI
# 2. Click "Run workflow"
# 3. Enter the version to deploy (e.g., v0.170.0)
```

### Option 2: Local Rollback

Deploy directly from your local machine:

```bash
# 1. Clone the repository (if needed)
git clone https://github.com/ralphschuler/.screeps-gpt.git
cd .screeps-gpt

# 2. Checkout the target version
git fetch --tags
git checkout v0.170.0

# 3. Install dependencies and build
yarn install --frozen-lockfile
yarn build

# 4. Deploy (requires SCREEPS_TOKEN)
export SCREEPS_TOKEN="your-api-token"
yarn deploy
```

### Option 3: Direct Screeps Console

For emergency situations, deploy code directly via Screeps console:

1. Go to [Screeps](https://screeps.com) and open your game
2. Open the console (bottom of screen)
3. Upload code directly via the Memory/Code panel

**Note:** This bypasses all automation and won't trigger health checks.

## Rollback Decision Tree

```
Deploy fails health check
│
├── Automatic rollback succeeds?
│   ├── YES → Monitor bot, investigate issue
│   └── NO → Manual intervention required
│
├── Previous version available?
│   ├── YES → Use Option 1 (re-run deployment)
│   └── NO → Use Option 3 (direct console)
│
└── Is this an emergency?
    ├── YES → Use Option 3 for fastest recovery
    └── NO → Use Option 1 or 2 for proper tracking
```

## Verification After Rollback

After rolling back, verify the bot is operational:

### 1. Check Bot Aliveness

```bash
export SCREEPS_TOKEN="your-token"
npx tsx packages/utilities/scripts/check-bot-aliveness.ts
```

Expected output:

```
✅ Bot is ACTIVE and executing in game
```

### 2. Collect Bot Snapshot

```bash
npx tsx packages/utilities/scripts/collect-bot-snapshot.ts
```

Verify the snapshot shows:

- CPU usage > 0
- Creeps present
- Rooms controlled

### 3. Check Screeps Console

Log into Screeps and verify:

- No error messages in console
- Creeps are spawning and working
- No "CPU overflow" warnings

## Preventing Future Failures

After successful rollback, investigate the root cause:

1. **Review deployment logs** - Check GitHub Actions for errors
2. **Test locally** - Build and dry-run deploy locally
3. **Check code changes** - Review commits since last good version
4. **Validate bundle** - Run `yarn analyze:system` to check build

### Common Causes

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| CPU = 0 | Syntax error | Fix code, re-deploy |
| No creeps | Spawn logic broken | Check spawn priority |
| Memory errors | Invalid Memory access | Add null checks |
| API errors | Rate limiting | Add backoff logic |

## Related Documentation

- [Deployment Troubleshooting Guide](deployment-troubleshooting.md)
- [Stats Monitoring Guide](stats-monitoring.md)
- [Spawn Recovery Automation](spawn-recovery-automation.md)

## Emergency Contacts

For critical issues affecting production:

1. Check the #screeps channel in Discord
2. Review open issues on GitHub
3. Check workflow run logs for detailed errors

---

_Last updated: 2025-11-27_
