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

## Timeout Scenarios

### Issue: Deployment times out during upload

**Symptoms:**

- GitHub Actions workflow times out (default: 30 minutes)
- Large bundle size (>1MB compressed)
- Slow network connection to Screeps API
- No error message, just timeout

**Root Cause:**
Large bundles or slow connections can exceed workflow timeout limits.

**Resolution:**

#### 1. Increase Workflow Timeout

Update `.github/workflows/deploy.yml`:

```yaml
jobs:
  deploy:
    timeout-minutes: 60 # Increase from default 30
```

#### 2. Optimize Bundle Size

```bash
# Check current bundle size
ls -lh dist/main.js

# Build without profiler to reduce size
bun run build:no-profiler
```

**Typical bundle sizes:**

- With profiler: 800-1200 KB
- Without profiler: 400-600 KB
- Target: <500 KB for reliable deployment

#### 3. Enable Retry Logic

The deployment script includes retry logic (3 attempts, exponential backoff). Verify it's active:

```typescript
// scripts/deploy.ts
const maxRetries = 3;
const retryDelay = 1000; // Start with 1s, doubles each retry
```

If timeouts persist:

```typescript
// Increase retry attempts
const maxRetries = 5;
const retryDelay = 2000; // More conservative initial delay
```

### Issue: Connection timeout during API authentication

**Symptoms:**

- Error: "connect ETIMEDOUT" or "connect ECONNREFUSED"
- Occurs during authentication phase
- May work locally but fail in CI

**Root Cause:**
Network issues, firewall restrictions, or Screeps API downtime.

**Resolution:**

#### 1. Verify API Accessibility

```bash
# Test API connectivity
curl -I https://screeps.com/api/version

# Test with token
curl -H "X-Token: $SCREEPS_TOKEN" https://screeps.com/api/auth/me
```

#### 2. Check GitHub Actions Network

```yaml
# Add network diagnostics to workflow
- name: Network diagnostics
  run: |
    ping -c 3 screeps.com || true
    curl -I https://screeps.com/api/version || true
```

#### 3. Configure Timeout Limits

```typescript
// scripts/deploy.ts - API client configuration
const api = await screepsAPI({
  token: process.env.SCREEPS_TOKEN,
  protocol: "https",
  hostname: "screeps.com",
  port: 443,
  path: "/",
  timeout: 60000 // 60 seconds (increase if needed)
});
```

## Retry Logic Configuration

### Understanding Retry Behavior

The deployment script uses exponential backoff for resilience:

```typescript
// Retry configuration
const maxRetries = 3;
const baseDelay = 1000; // 1 second

// Retry delays:
// Attempt 1: immediate
// Attempt 2: 1 second delay
// Attempt 3: 2 second delay
// Attempt 4: 4 second delay
```

### Best Practices

#### 1. Transient Failures (Network Issues)

**Recommended configuration:**

```typescript
const maxRetries = 5;
const baseDelay = 2000;
const maxDelay = 30000; // Cap at 30 seconds
```

**When to use:**

- Intermittent network issues
- API rate limiting
- Temporary server issues

#### 2. Authentication Failures

**DO NOT retry:**

- 401 Unauthorized (invalid token)
- 403 Forbidden (insufficient permissions)

**Code pattern:**

```typescript
if (error.statusCode === 401 || error.statusCode === 403) {
  console.error("✗ Authentication failed - check SCREEPS_TOKEN");
  throw error; // Don't retry
}
```

#### 3. API Errors (4xx, 5xx)

**Conditional retry:**

```typescript
if (error.statusCode >= 500) {
  // Server error - retry
  return true;
} else if (error.statusCode >= 400) {
  // Client error - don't retry
  return false;
}
```

### Monitoring Retry Effectiveness

Add retry metrics to workflow:

```bash
# Check deployment logs for retry attempts
gh run view <run-id> --log | grep "Retry attempt"

# Count failures
gh run view <run-id> --log | grep "✗ Failed" | wc -l
```

## Environment Variable Validation

### Validation Checklist

Before deployment, verify all required variables:

```bash
# Required
echo "SCREEPS_TOKEN: ${SCREEPS_TOKEN:+SET}"

# Optional (with defaults)
echo "SCREEPS_BRANCH: ${SCREEPS_BRANCH:-main}"
echo "SCREEPS_HOST: ${SCREEPS_HOST:-screeps.com}"
echo "SCREEPS_PORT: ${SCREEPS_PORT:-443}"
echo "SCREEPS_PROTOCOL: ${SCREEPS_PROTOCOL:-https}"
echo "SCREEPS_PATH: ${SCREEPS_PATH:-/}"
```

### Common Validation Errors

#### 1. Empty String vs. Undefined

**Problem:**
GitHub Actions may pass empty strings for unset variables:

```bash
SCREEPS_HOST=""  # Empty string, not undefined!
```

**Fix:**
Use `||` operator for defaults:

```typescript
// ✓ Correct - handles empty strings
const hostname = process.env.SCREEPS_HOST || "screeps.com";

// ✗ Incorrect - empty string not caught
const hostname = process.env.SCREEPS_HOST ?? "screeps.com";
```

**Verification:**

```bash
# Test with empty string
SCREEPS_HOST="" bun run deploy
# Should default to screeps.com, not connect to empty host
```

#### 2. Token Format Validation

**Validate token format:**

```typescript
function validateToken(token: string | undefined): void {
  if (!token) {
    throw new Error("SCREEPS_TOKEN is required");
  }
  if (token.length < 20) {
    throw new Error("SCREEPS_TOKEN appears invalid (too short)");
  }
  if (!/^[a-f0-9]+$/.test(token)) {
    console.warn("⚠ SCREEPS_TOKEN has unexpected format");
  }
}

validateToken(process.env.SCREEPS_TOKEN);
```

#### 3. Branch Name Validation

**Prevent invalid branches:**

```typescript
const branch = process.env.SCREEPS_BRANCH || "main";

if (!/^[a-zA-Z0-9_-]+$/.test(branch)) {
  throw new Error(`Invalid branch name: ${branch}`);
}
```

### Validation Script

Create `scripts/validate-deploy-env.ts`:

```typescript
function validateDeploymentEnv(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required
  if (!process.env.SCREEPS_TOKEN) {
    errors.push("SCREEPS_TOKEN is required");
  }

  // Validate token format
  if (process.env.SCREEPS_TOKEN && process.env.SCREEPS_TOKEN.length < 20) {
    errors.push("SCREEPS_TOKEN appears invalid");
  }

  // Validate optional values
  const host = process.env.SCREEPS_HOST || "screeps.com";
  if (host.length === 0) {
    warnings.push("SCREEPS_HOST is empty, using default");
  }

  const port = parseInt(process.env.SCREEPS_PORT || "443", 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`Invalid SCREEPS_PORT: ${process.env.SCREEPS_PORT}`);
  }

  const protocol = process.env.SCREEPS_PROTOCOL || "https";
  if (!["http", "https"].includes(protocol)) {
    errors.push(`Invalid SCREEPS_PROTOCOL: ${protocol}`);
  }

  if (errors.length > 0) {
    console.error("❌ Environment validation failed:");
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn("⚠️  Environment validation warnings:");
    warnings.forEach(w => console.warn(`  - ${w}`));
  }

  console.log("✅ Environment validation passed");
}

validateDeploymentEnv();
```

Run before deployment:

```bash
bun run tsx scripts/validate-deploy-env.ts
bun run deploy
```

## API Error Code Interpretation

### Screeps API Response Codes

#### Success Codes (2xx)

| Code | Meaning | Action                        |
| ---- | ------- | ----------------------------- |
| 200  | OK      | Deployment successful         |
| 201  | Created | Resource created successfully |

#### Client Errors (4xx)

| Code | Error                | Root Cause                 | Resolution                                            |
| ---- | -------------------- | -------------------------- | ----------------------------------------------------- |
| 400  | Bad Request          | Invalid request format     | Check API call parameters, verify module format       |
| 401  | Unauthorized         | Invalid or expired token   | Regenerate SCREEPS_TOKEN, update secret               |
| 403  | Forbidden            | Insufficient permissions   | Verify token has code upload permission               |
| 404  | Not Found            | Invalid endpoint or branch | Check SCREEPS_PATH, verify branch exists              |
| 422  | Unprocessable Entity | Invalid code format        | Verify bundle format, check for syntax errors         |
| 429  | Too Many Requests    | Rate limit exceeded        | Implement exponential backoff, reduce retry frequency |

#### Server Errors (5xx)

| Code | Error                 | Root Cause           | Resolution                                   |
| ---- | --------------------- | -------------------- | -------------------------------------------- |
| 500  | Internal Server Error | Screeps API issue    | Retry with backoff, wait for API recovery    |
| 502  | Bad Gateway           | API gateway issue    | Retry with backoff                           |
| 503  | Service Unavailable   | API temporarily down | Retry with longer backoff, check status page |
| 504  | Gateway Timeout       | API timeout          | Increase timeout, retry                      |

### Error Response Handling

#### 1. Extract Error Details

```typescript
try {
  await api.code.set(branch, { main: source });
} catch (error: any) {
  const statusCode = error.statusCode || error.response?.status;
  const message = error.message || error.response?.data?.error;
  const details = error.response?.data;

  console.error(`✗ API Error ${statusCode}: ${message}`);
  if (details) {
    console.error("Details:", JSON.stringify(details, null, 2));
  }
}
```

#### 2. Automated Remediation

```typescript
async function deployWithRemediation(
  api: any,
  branch: string,
  modules: Record<string, string>,
  retries = 3
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await api.code.set(branch, modules);
      console.log("✓ Deployment successful");
      return;
    } catch (error: any) {
      const statusCode = error.statusCode || error.response?.status;

      // Don't retry client errors (except 429)
      if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
        console.error(`✗ Client error ${statusCode} - not retrying`);

        // Provide specific guidance
        if (statusCode === 401) {
          console.error("→ Check SCREEPS_TOKEN validity");
        } else if (statusCode === 403) {
          console.error("→ Verify token has upload permissions");
        } else if (statusCode === 422) {
          console.error("→ Check bundle format and syntax");
        }

        throw error;
      }

      // Retry server errors and rate limits
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        console.log(`⚠ Retry attempt ${attempt}/${retries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`✗ All ${retries} attempts failed`);
        throw error;
      }
    }
  }
}
```

#### 3. Error Reporting

**For GitHub Issues:**

```typescript
function formatErrorReport(error: any): string {
  return `
## Deployment Error Report

**Status Code**: ${error.statusCode || "unknown"}
**Error Message**: ${error.message}
**Timestamp**: ${new Date().toISOString()}

**Request Details**:
- Host: ${process.env.SCREEPS_HOST || "screeps.com"}
- Branch: ${process.env.SCREEPS_BRANCH || "main"}
- Bundle Size: ${bundleSize} bytes

**Response Details**:
\`\`\`json
${JSON.stringify(error.response?.data || {}, null, 2)}
\`\`\`

**Stack Trace**:
\`\`\`
${error.stack}
\`\`\`
`;
}
```

### API Error Decision Tree

```
API Error Received
│
├─ Status Code?
│  ├─ 2xx → Success
│  │  └─ Continue
│  │
│  ├─ 4xx → Client Error
│  │  ├─ 401 → Invalid token → Update secret
│  │  ├─ 403 → No permission → Check token scope
│  │  ├─ 422 → Invalid format → Check bundle
│  │  ├─ 429 → Rate limit → Retry with backoff
│  │  └─ Other → Check request format
│  │
│  └─ 5xx → Server Error
│     ├─ 503 → Service down → Retry with long backoff
│     └─ Other → Retry with standard backoff
│
└─ Retry?
   ├─ Client error (4xx except 429) → NO
   ├─ Server error (5xx) → YES
   └─ Network error → YES
```

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
