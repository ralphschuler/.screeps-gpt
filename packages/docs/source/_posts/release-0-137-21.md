---
title: "Release 0.137.21: Fixing Workflow Dependency Resolution"
date: 2025-11-23T15:19:58.132Z
categories:
  - Release Notes
tags:
  - release
  - bugfix
  - workflow
  - dependencies
---

## Introduction

Release 0.137.21 addresses a critical workflow configuration issue that was breaking workspace dependency resolution in the screeps-agent.yml workflow. This maintenance release ensures consistent package manager usage across all workflows and aligns Node.js version handling with repository standards.

## The Problem

The `screeps-agent.yml` workflow was using npm commands (`npm ci` + `npm install`) instead of yarn, which broke the repository's workspace dependency resolution. This inconsistency created deployment issues and violated the repository's standardized build practices established in other workflows like `guard-build.yml` and `deploy.yml`.

## What Changed

This release implements three targeted fixes to restore workflow consistency:

### 1. Package Manager Alignment

**File**: `.github/workflows/screeps-agent.yml`

The workflow now uses the correct package manager for this monorepo:

```yaml
# Before:
- run: npm ci
- run: npm install

# After:
- run: yarn install --frozen-lockfile
```

This change ensures that:
- Workspace dependencies resolve correctly across the `packages/` directory structure
- The yarn.lock file is respected for reproducible builds
- No unnecessary reinstallation occurs (single install command instead of two)

### 2. Dynamic Node.js Versioning

**File**: `.github/workflows/screeps-agent.yml`

The workflow now reads the Node.js version from `.nvmrc` instead of using a hardcoded value:

```yaml
# Before:
node-version: '18'

# After:
node-version-file: '.nvmrc'
```

**Why this matters**: The repository uses Node.js 18.x-22.x according to its package.json engines field and Copilot instructions. By reading from `.nvmrc`, the workflow automatically stays synchronized with the repository's Node.js version requirements without manual updates to workflow files.

### 3. Workflow Consistency

This change brings `screeps-agent.yml` into alignment with the repository's existing workflow patterns. Both `guard-build.yml` and `deploy.yml` already use:
- `yarn install --frozen-lockfile` for dependency installation
- `.nvmrc` for Node.js version specification

## Technical Details

### Design Rationale

**Why yarn over npm?**

The repository migrated to Yarn 4 (Berry) in release 0.125.1 for several reasons:
1. **Workspace support**: Better monorepo dependency management across `packages/bot`, `packages/docs`, `packages/utilities`
2. **Lockfile stability**: `yarn.lock` provides more reliable reproducible builds than `package-lock.json`
3. **Performance**: Faster installation times with Yarn's improved caching
4. **GitHub Package Registry**: Better integration for the `@ralphschuler` scoped packages

**Why .nvmrc?**

The `.nvmrc` file serves as the single source of truth for Node.js version requirements. This pattern:
- Reduces maintenance burden (one file to update instead of multiple workflows)
- Prevents version drift between development and CI environments
- Follows industry best practices for Node.js version management
- Integrates seamlessly with nvm, fnm, and GitHub Actions' setup-node action

### Implementation Details

The fix required modifying a single workflow file (`.github/workflows/screeps-agent.yml`) with no changes to runtime code or build configuration. This surgical approach minimizes risk while addressing the root cause.

**Impact on existing workflows**: None. The `screeps-agent.yml` workflow now follows the same patterns as other workflows that were already working correctly.

**Backward compatibility**: Full backward compatibility maintained. The change only affects how dependencies are installed in CI, not how the bot runtime functions.

## Issue Resolution

This release resolves issue [ralphschuler/.screeps-gpt#1270](https://github.com/ralphschuler/.screeps-gpt/issues/1270), which reported that the screeps-agent workflow was failing due to package manager inconsistencies.

## Impact

### For Developers

- **Improved workflow reliability**: The screeps-agent workflow will now complete successfully
- **Consistent developer experience**: All workflows use the same package manager and Node.js version strategy
- **Easier debugging**: When issues occur, developers don't need to account for workflow-specific dependency resolution quirks

### For CI/CD Pipeline

- **Reduced failure rate**: Eliminates a class of workflow failures caused by package manager mismatches
- **Faster builds**: Single `yarn install` command is more efficient than `npm ci + npm install`
- **Better caching**: Yarn's lockfile enables more effective GitHub Actions caching

### For the Bot

No direct impact on bot runtime behavior. This is purely an infrastructure fix that enables the automation workflows to run correctly.

## What's Next

With workflow consistency restored, the repository can focus on:
- Continued development of the autonomous Screeps bot
- Enhanced monitoring and strategic planning workflows
- Further improvements to the GitHub Copilot agent swarm automation

## Related Context

This fix is part of the repository's ongoing commitment to:
- **Automation quality**: Ensuring all workflows follow consistent patterns (see `docs/automation/overview.md`)
- **Dependency management**: Maintaining a clean, reproducible build environment
- **Developer experience**: Reducing friction in the development and deployment pipeline

For more information on the repository's workflow architecture and standards, see:
- `docs/automation/overview.md` - Comprehensive workflow documentation
- `AGENTS.md` - Agent guidelines and repository knowledge base
- `.github/copilot-instructions.md` - Repository-specific Copilot guidelines
