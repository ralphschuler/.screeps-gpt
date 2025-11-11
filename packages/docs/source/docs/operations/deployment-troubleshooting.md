---
title: Deployment Troubleshooting Guide
date: 2025-10-24T12:33:51.455Z
---

# Deployment Troubleshooting Guide

This guide covers common issues with the Screeps deployment process and how to resolve them.

## Overview

The deployment workflow (`.github/workflows/deploy.yml`) automatically deploys the compiled bot code to Screeps when:

1. A version tag matching `v*` is pushed
2. The Post Merge Release workflow completes successfully

The deployment uses `scripts/deploy.ts` which:

1. Builds the project (`bun run build` → `dist/main.js`)
2. Reads the compiled bundle
3. Uploads it to the Screeps API using the `screeps-api` package

## Common Issues and Solutions

### Issue: Deployment completes but code doesn't appear in Screeps

**Symptoms:**

- GitHub Actions workflow shows success
- No errors in logs
- Code not visible in Screeps account

**Root Cause:**
This was caused by incorrect API call format. The `screeps-api` package expects modules as an object `{ moduleName: code }`, but the script was passing an array format `[{ name: "moduleName", body: code }]`.

**Resolution:**
Fixed in commit `663008e`. The deployment script now correctly formats the API call:

```typescript
// ✓ Correct format
await api.code.set(branch, { main: source });

// ✗ Incorrect format (old bug)
await api.code.set(branch, [{ name: "main", body: source }]);
```

**Verification:**
Run regression test: `bun run test:regression -- tests/regression/deploy-api-format.test.ts`

### Issue: "SCREEPS_TOKEN secret is required for deployment"

**Symptoms:**

- Deployment fails immediately
- Error message: "SCREEPS_TOKEN secret is required for deployment"

**Root Cause:**
Missing or improperly configured `SCREEPS_TOKEN` secret in GitHub repository settings.

**Resolution:**

1. Go to repository Settings → Secrets and variables → Actions
2. Create a new repository secret named `SCREEPS_TOKEN`
3. Value should be your Screeps API token (get from Screeps account settings)
4. Re-run the deployment workflow

### Issue: "Failed to read build output at dist/main.js"

**Symptoms:**

- Error message: "✗ Failed to read build output at dist/main.js"
- Deployment fails before upload attempt

**Root Cause:**
Build step failed or `dist/main.js` was not generated.

**Resolution:**

1. Check build logs for errors: `bun run build`
2. Ensure `src/main.ts` exists and has no syntax errors
3. Verify `buildProject.ts` configuration is correct
4. Check disk space and file permissions

### Issue: Connection refused or timeout errors

**Symptoms:**

- Error message: "connect ECONNREFUSED" or timeout
- Status: 5xx errors from Screeps API

**Root Cause:**
Network issues or Screeps API downtime. The deployment script includes retry logic (3 attempts with exponential backoff).

**Resolution:**

1. Check Screeps server status
2. Verify `SCREEPS_HOST` configuration (default: screeps.com)
3. Check `SCREEPS_PORT` and `SCREEPS_PROTOCOL` settings
4. Wait and let the retry logic handle transient failures
5. For persistent issues, run manually: `bun run deploy`

### Issue: Authentication errors (401/403)

**Symptoms:**

- Error message: "✗ Failed to upload code to Screeps API"
- Status: 401 (Unauthorized) or 403 (Forbidden)

**Root Cause:**
Invalid or expired API token, or insufficient permissions.

**Resolution:**

1. Generate a new API token in Screeps account settings
2. Update `SCREEPS_TOKEN` secret in repository settings
3. Ensure token has code upload permissions
4. Verify you're targeting the correct server (PTR vs. main)

### Issue: Empty string environment variables

**Symptoms:**

- Connection to `::1:80` or empty hostname
- Error: "connect ECONNREFUSED ::1:80"

**Root Cause:**
GitHub Actions passing empty strings instead of undefined for unset variables.

**Resolution:**
Already fixed. The deployment script uses `||` operator for defaults:

```typescript
const hostname = process.env.SCREEPS_HOST || "screeps.com";
```

**Verification:**
Run regression test: `bun run test:regression -- tests/regression/deploy-env-vars.test.ts`

## Testing Deployment Locally

### Dry Run Mode

Test deployment without actually uploading code:

```bash
SCREEPS_DEPLOY_DRY_RUN=true bun run deploy
```

This will:

- ✓ Build the project
- ✓ Read and validate `dist/main.js`
- ✓ Show deployment parameters
- ✗ Skip actual API upload

### Full Local Deployment

Deploy to your Screeps account from your local machine:

```bash
export SCREEPS_TOKEN="your-api-token-here"
export SCREEPS_BRANCH="dev"  # Optional, defaults to "main"
bun run deploy
```

### Testing with Act CLI

Dry-run the deployment workflow locally:

```bash
# Set up test secrets
echo "SCREEPS_TOKEN=test-token" >> tests/actions/secrets.env

# Run the workflow
bun run test:actions
```

## Monitoring Deployment

### Success Indicators

When deployment succeeds, you'll see:

```
✓ Build output loaded (XXXXX bytes)
Uploading code to screeps.com:443/ on branch "main"...
✓ Successfully deployed dist/main.js to branch main
  Modules uploaded: main (XXXXX bytes)
```

### Logs and Debugging

1. **GitHub Actions Logs**: Go to Actions tab → Deploy workflow → Select run
2. **Enhanced Logging**: The deployment script now includes:
   - Progress indicators (✓, ✗, ⚠)
   - Detailed error messages
   - Retry attempt notifications
   - API response data on failures

## Configuration Reference

### Environment Variables

| Variable                 | Default       | Description                    |
| ------------------------ | ------------- | ------------------------------ |
| `SCREEPS_TOKEN`          | _(required)_  | API authentication token       |
| `SCREEPS_BRANCH`         | `main`        | Target deployment branch       |
| `SCREEPS_HOST`           | `screeps.com` | Server hostname                |
| `SCREEPS_PORT`           | `443`         | Server port                    |
| `SCREEPS_PROTOCOL`       | `https`       | Connection protocol            |
| `SCREEPS_PATH`           | `/`           | API base path                  |
| `SCREEPS_DEPLOY_DRY_RUN` | _(unset)_     | Skip actual upload (test mode) |

### Deployment Targets

**Official Servers:**

- Main server: `screeps.com` (default)
- PTR server: Set `SCREEPS_HOST=screeps.com` with PTR API token

**Private Servers:**

```bash
export SCREEPS_HOST="your-server.com"
export SCREEPS_PORT="21025"
export SCREEPS_PROTOCOL="http"
export SCREEPS_PATH="/"
```

## Related Files

- `.github/workflows/deploy.yml` - Deployment automation
- `scripts/deploy.ts` - Core deployment logic
- `scripts/buildProject.ts` - Build compilation
- `tests/regression/deploy-api-format.test.ts` - API format regression test
- `tests/regression/deploy-env-vars.test.ts` - Environment variable handling test

## Further Help

If you encounter issues not covered in this guide:

1. Check GitHub Actions logs for detailed error messages
2. Run `bun run deploy` locally with debugging enabled
3. Verify `screeps-api` package version and compatibility
4. Review Screeps API documentation for server-specific requirements
5. File an issue with reproduction steps and error logs
