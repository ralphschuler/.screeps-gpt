---
title: "Release 0.39.1"
date: 2025-11-10T00:00:00.000Z
categories:
  - Release Notes
  - Bug Fixes
tags:
  - release
  - testing
  - performance
---

We're pleased to announce version 0.39.1 of the Screeps GPT autonomous bot.

## What's New

### Bug Fixes

- **Console Output TypeError**: Fixed "Cannot convert object to primitive value" error in MemoryValidator
  - Changed from `result.error.message` to `JSON.stringify(result.error.issues)` for proper Zod error serialization
  - Zod error objects lack a simple `message` property, causing primitive conversion errors in Screeps console
  - Added comprehensive regression test suite (`tests/regression/console-output-type-error.test.ts`) with 6 test cases
  - Ensures all console logging properly handles complex objects without type conversion errors
  - Resolves console errors reported via email from noreply@screeps.com (2025-11-07)

---

**Full Changelog**: [0.39.1 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.39.1)
