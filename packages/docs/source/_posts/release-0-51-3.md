---
title: "Release 0.51.3: Deprecation Strategy and Code Lifecycle Management"
date: 2025-11-12T00:00:00.000Z
categories:
  - Release Notes
  - Features
tags:
  - release
  - automation
  - documentation
  - deployment
---
We're pleased to announce version 0.51.3 of the Screeps GPT autonomous bot.

## What's New

### New Features

- **Deprecation Strategy and Code Lifecycle Management**: Implemented comprehensive system for managing deprecated code and technical debt
  - Created deprecation policy document in `docs/development/deprecation-policy.md` with lifecycle phases and guidelines
  - Created deprecation registry in `docs/development/deprecation-registry.md` to track all active deprecations
  - Created migration guide template in `docs/development/migration-guide-template.md` for consistent documentation
  - Added ESLint rule `@typescript-eslint/no-deprecated` to warn when deprecated APIs are used
  - Added CI workflow `.github/workflows/guard-deprecation.yml` for automated deprecation checks
  - Documented current deprecations: role-based behavior system and legacy label system
  - Established 2-3 release cycle deprecation timeline for minor versions
  - Integrated deprecation tracking with CHANGELOG format
  - Provides clear upgrade paths and reduces technical debt accumulation
  - Resolves #556: Implement deprecation strategy and code lifecycle management system

---

**Full Changelog**: [0.51.3 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.51.3)
