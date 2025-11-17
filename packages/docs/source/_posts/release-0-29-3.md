---
title: "Release 0.29.3"
date: 2025-11-08T00:00:00.000Z
categories:
  - Release Notes
  - Improvements
tags:
  - release
  - automation
  - documentation
  - testing
  - deployment
---

We're pleased to announce version 0.29.3 of the Screeps GPT autonomous bot.

## What's New

### Improvements

- **Repository Cleanup and Standardization**: Comprehensive cleanup to improve maintainability and consistency
  - Removed unnecessary documentation files: `DEPLOY_WORKFLOW_FIX.md`, `HEXO_IMPLEMENTATION_NOTES.md`, `IMPLEMENTATION.md`, `IMPLEMENTATION_LOG.md`
  - Removed validation script: `validate-deploy-fix.sh`
  - Removed backup file: `package.json.backup`
  - Removed deprecated ESLint configuration files: `.eslintrc.cjs`, `.eslintrc-polyfill.cjs`
  - Removed structuredClone polyfill (no longer needed with Node.js 18+ requirement)
  - Reorganized build system: moved `scripts/buildProject.ts` to `scripts/lib/buildProject.ts`
  - Updated `.gitignore` to prevent future similar issues (backup files, temporary docs, implementation notes)
  - Updated ESLint flat config to remove polyfill dependency (Node.js 18+ has native structuredClone)
  - Updated regression tests to reflect Node.js 18+ requirement and removal of polyfill
  - All existing functionality preserved (builds, tests, deployments work unchanged)

---

**Full Changelog**: [0.29.3 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.29.3)
