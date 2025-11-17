---
title: "Release 0.47.1"
date: 2025-11-11T00:00:00.000Z
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

We're pleased to announce version 0.47.1 of the Screeps GPT autonomous bot.

## What's New

### Improvements

- **Monorepo Restructuring**: Reorganized repository into packages-based monorepo structure
  - Created `/packages` directory with bot, docs, utilities, actions, and console packages
  - Migrated `src/` to `packages/bot/src/` for core Screeps AI implementation
  - Migrated `scripts/` to `packages/utilities/scripts/` for build tooling and utilities
  - Migrated `docs/`, `source/`, `themes/`, `_config.yml` to `packages/docs/` for documentation site
  - Configured Bun workspaces in root `package.json` for monorepo dependency management
  - Updated TypeScript path aliases to reference new package locations
  - Updated ESLint configuration to lint new package structure
  - Updated vitest configuration for new source paths
  - Updated all GitHub workflows to reference new package paths
  - Updated all import paths in tests and utilities
  - All 580 tests passing, lint passing, build working
  - Improved code organization with clear package boundaries
  - Enables independent package versioning and deployment
  - Better separation of concerns across codebase
  - Resolves #[issue-number]: Restructure repository into monorepo with packages organization

---

**Full Changelog**: [0.47.1 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.47.1)
