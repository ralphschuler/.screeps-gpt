# Documentation Testing Guide

This guide explains the automated testing infrastructure for the Screeps GPT documentation site.

## Overview

The documentation testing suite ensures that:

1. **Documentation builds successfully** without errors
2. **Generated HTML content is valid** and not blank
3. **All required pages exist** and contain proper content
4. **Workflow configuration is correct** for GitHub Pages deployment
5. **Regression prevention** catches issues before deployment

## Quick Start

### Run All Documentation Tests

```bash
npm run test:docs
```

This command runs:

- Unit tests for build script validation
- Regression tests for build process verification
- Workflow configuration tests

### Run Individual Test Suites

```bash
# Unit tests only (fast, no build required)
npm run test:unit tests/unit/build-hexo-site.test.ts

# Regression tests (includes full build)
npm run test:regression tests/regression/hexo-documentation-build.test.ts

# Workflow validation
npm run test:regression tests/regression/documentation-workflow.test.ts
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

## CI/CD Integration

### Automated Testing in Pull Requests

The `guard-test-docs.yml` workflow runs automatically on PRs that modify:

- Documentation source files (`docs-build/`, `source/`)
- Hexo configuration (`_config.yml`)
- Build scripts (`scripts/build-hexo-site.ts`)
- Test files
- Documentation workflow (`docs-pages.yml`)

### Quality Gate Integration

Documentation tests are also included in:

- **Regression tests** (`npm run test:regression`)
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

## Related Documentation

- [GitHub Actions Workflow](../.github/workflows/docs-pages.yml)
- [Hexo Configuration](_config.yml)
- [Build Script](scripts/build-hexo-site.ts)
- [Documentation Source](source/)

## Related Issues

- [#252](https://github.com/ralphschuler/.screeps-gpt/issues/252) - Implement automated testing for documentation site functionality
- [#251](https://github.com/ralphschuler/.screeps-gpt/issues/251) - Fix Hexo documentation site rendering
- [#228](https://github.com/ralphschuler/.screeps-gpt/issues/228) - Resolve documentation workflow issues
