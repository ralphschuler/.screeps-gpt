---
title: "Release 0.89.5: Context-Aware Build Validation Thresholds"
date: 2025-11-16T00:00:00.000Z
categories:
  - Release Notes
  - Features
tags:
  - release
  - testing
  - deployment
---

We're pleased to announce version 0.89.5 of the Screeps GPT autonomous bot.

## What's New

### New Features

- **Context-Aware Build Validation Thresholds**: Implemented context-aware MIN_SIZE validation to strengthen build safety
  - Monolithic `main.js` now requires 50KB minimum (ensures kernel + runtime components present)
  - Modular components maintain 500B minimum (preserves flexibility for type-only exports)
  - Validation leverages existing `checkLoopExport` parameter to distinguish file types
  - Added regression tests validating both threshold scenarios
  - Prevents broken bundler output from deploying to production
  - Resolves issue ralphschuler/.screeps-gpt#731 (context-aware MIN_SIZE validation)

---

**Full Changelog**: [0.89.5 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.89.5)
