# Documentation Testing Guide

This guide explains the automated testing infrastructure for the Screeps GPT documentation site.

## Overview

The documentation testing suite ensures that:

1. **Documentation builds successfully** without errors
2. **Generated HTML content is valid** and not blank
3. **All required pages exist** and contain proper content
4. **Workflow configuration is correct** for GitHub Pages deployment
5. **Regression prevention** catches issues before deployment
6. **Deployed site is accessible** and functioning correctly (E2E tests)

## Quick Start

### Run All Documentation Tests

```bash
bun run test:docs
```

This command runs:

- Unit tests for build script validation
- Regression tests for build process verification
- Workflow configuration tests

**Note**: This does not include the E2E documentation site tests. To run those, use `bun run test:e2e tests/e2e/docs-site.test.ts` with `RUN_DOCS_SITE_TESTS=true`.

### Run Individual Test Suites

```bash
# Unit tests only (fast, no build required)
bun run test:unit tests/unit/build-hexo-site.test.ts

# Regression tests (includes full build)
bun run test:regression tests/regression/hexo-documentation-build.test.ts

# Workflow validation
bun run test:regression tests/regression/documentation-workflow.test.ts

# End-to-end documentation site tests
bun run test:e2e tests/e2e/docs-site.test.ts
```

## Test Coverage

### 1. Build Script Validation (`tests/unit/build-hexo-site.test.ts`)

Tests the `scripts/build-hexo-site.ts` build script:

- ✅ Hexo initialization and configuration
- ✅ Plugin loading (renderers, generators)
- ✅ Error handling and cleanup
- ✅ Output directory structure
- ✅ Package.json script integration

**Purpose**: Ensure the build script is properly configured without running a full build.

### 2. Documentation Build Process (`tests/regression/hexo-documentation-build.test.ts`)

Tests the complete documentation build:

- ✅ Hexo configuration file validity
- ✅ Source files existence
- ✅ Public directory generation
- ✅ HTML content validation (not blank)
- ✅ CSS and asset generation
- ✅ Required documentation pages
- ✅ Markdown to HTML rendering
- ✅ Meta tags and SEO elements
- ✅ Search and RSS feed generation
- ✅ Navigation structure

**Purpose**: Catch build failures and blank page regressions before deployment.

**Note**: This test performs a full documentation build and takes ~2 seconds.

### 3. Workflow Configuration (`tests/regression/documentation-workflow.test.ts`)

Tests GitHub Actions workflow for documentation deployment:

- ✅ Workflow file structure and syntax
- ✅ Trigger configuration (push, release, manual)
- ✅ Build job setup and steps
- ✅ Deploy job dependencies
- ✅ GitHub Pages environment
- ✅ Permissions configuration
- ✅ Concurrency settings
- ✅ Version update integration

**Purpose**: Ensure the CI/CD pipeline is correctly configured.

### 4. Documentation Site E2E Tests (`tests/e2e/docs-site.test.ts`)

Tests the deployed documentation site at https://nyphon.de/.screeps-gpt/:

- ✅ Homepage accessibility (HTTP 200 status)
- ✅ Valid HTML content rendering
- ✅ Meta tags and SEO elements
- ✅ Key documentation pages accessibility
- ✅ CSS stylesheet loading
- ✅ Favicon and asset loading
- ✅ Internal link validation
- ✅ Navigation menu presence
- ✅ Footer elements
- ✅ Content quality checks
- ✅ Response headers validation
- ✅ Performance validation

**Purpose**: Validate that the deployed site is accessible and functioning correctly after deployment. These tests run automatically after GitHub Pages deployment to catch any deployment issues.

**Configuration**: Use environment variable `DOCS_SITE_URL` to specify the site URL (defaults to https://nyphon.de/.screeps-gpt/). Set `RUN_DOCS_SITE_TESTS=true` to enable these tests (they are skipped by default to avoid failures when the site isn't accessible).

## CI/CD Integration

### Automated Testing in Pull Requests

The `guard-test-docs.yml` workflow runs automatically on PRs that modify:

- Documentation source files (`docs-build/`, `source/`)
- Hexo configuration (`_config.yml`)
- Build scripts (`scripts/build-hexo-site.ts`)
- Test files
- Documentation workflow (`docs-pages.yml`)

### Post-Deployment Validation

The `docs-pages.yml` workflow includes a `validate` job that runs after deployment:

1. **Build**: Generates documentation site from source
2. **Deploy**: Deploys to GitHub Pages
3. **Validate**: Runs E2E tests against deployed site to verify accessibility and functionality

If validation fails, the workflow reports the failure, allowing maintainers to investigate deployment issues.

### Quality Gate Integration

Documentation tests are also included in:

- **Regression tests** (`bun run test:regression`)
- **Quality gate** workflow (deprecated but still active)

## Test Development

### Adding New Tests

Follow the existing test patterns:

```typescript
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

describe("New documentation test", () => {
  it("should validate something", () => {
    const configPath = join(process.cwd(), "_config.yml");
    expect(existsSync(configPath)).toBe(true);
  });
});
```

### Best Practices

1. **Use descriptive test names** that explain what's being validated
2. **Reference issue numbers** in test file headers (e.g., `#252`)
3. **Group related tests** with `describe` blocks
4. **Validate structure before content** (existence checks before content checks)
5. **Use meaningful error messages** with `expect(..., "message")`

### Test Organization

```
tests/
├── unit/
│   └── build-hexo-site.test.ts      # Build script validation
└── regression/
    ├── hexo-documentation-build.test.ts    # Full build validation
    └── documentation-workflow.test.ts       # Workflow configuration
```

## Troubleshooting

### Test Failures

**"Documentation build failed - index.html not generated"**

- Check Hexo configuration in `_config.yml`
- Verify `docs-build/package.json` has correct dependencies
- Run `npm ci` in `docs-build/` directory

**"Generated blank or minimal index.html"**

- Check source files in `source/` directory
- Verify theme configuration
- Check for Hexo renderer errors in build output

**"Expected page X to exist"**

- Verify source markdown file exists
- Check Hexo generators are loaded
- Review `_config.yml` plugin configuration

**"E2E tests failing with timeout or connection errors"**

- Check if documentation site is accessible
- Verify DNS resolution for nyphon.de
- Tests are skipped by default; set `RUN_DOCS_SITE_TESTS=true` to enable them
- Check GitHub Pages deployment status

**"E2E tests failing with HTTP errors"**

- Verify the site URL is correct in `DOCS_SITE_URL` environment variable
- Check GitHub Pages deployment logs
- Test pages manually by visiting URLs in browser

### Manual Testing

Build documentation locally:

```bash
cd docs-build
npm run clean
npm run build

# Verify output
ls -la public/
cat public/index.html | head -50
```

Serve documentation locally:

```bash
cd docs-build
npm run server
# Visit http://localhost:4000/.screeps-gpt/
```

Test E2E against deployed site:

```bash
# Test against production site (tests are skipped by default)
RUN_DOCS_SITE_TESTS=true DOCS_SITE_URL=https://nyphon.de/.screeps-gpt/ bun run test:e2e tests/e2e/docs-site.test.ts

# Run without enabling (tests will be skipped)
bun run test:e2e tests/e2e/docs-site.test.ts
```

## Related Documentation

- [GitHub Actions Workflow](../.github/workflows/docs-pages.yml)
- [Hexo Configuration](_config.yml)
- [Build Script](scripts/build-hexo-site.ts)
- [Documentation Source](source/)

## Related Issues

- [ralphschuler/.screeps-gpt#475](https://github.com/ralphschuler/.screeps-gpt/issues/475) - Add end-to-end tests for documentation site
- [ralphschuler/.screeps-gpt#252](https://github.com/ralphschuler/.screeps-gpt/issues/252) - Implement automated testing for documentation site functionality
- [ralphschuler/.screeps-gpt#251](https://github.com/ralphschuler/.screeps-gpt/issues/251) - Fix Hexo documentation site rendering
- [ralphschuler/.screeps-gpt#228](https://github.com/ralphschuler/.screeps-gpt/issues/228) - Resolve documentation workflow issues
