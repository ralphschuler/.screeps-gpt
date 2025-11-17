---
title: "Release 0.31.9: Enhanced TypeScript Type Safety with Runtime Validation"
date: 2025-11-09T00:00:00.000Z
categories:
  - Release Notes
  - Features
tags:
  - release
  - automation
  - testing
  - performance
  - monitoring
---
We're pleased to announce version 0.31.9 of the Screeps GPT autonomous bot.

## What's New

### New Features

- **Enhanced TypeScript Type Safety with Runtime Validation**: Improved type safety throughout the codebase to prevent runtime errors
  - Added `lastTimeoutTick` field to `Memory.stats` interface in `types.d.ts` for CPU timeout detection tracking
  - Created `MemoryValidator` class (`src/runtime/memory/MemoryValidator.ts`) using zod schemas for runtime validation of Memory structures (infrastructure code only, not yet integrated into runtime)
  - Implemented `validateStats()` method to validate Memory.stats against TypeScript interface definitions (available for future use)
  - Implemented `validateAndRepairStats()` method to automatically repair corrupted memory with sensible defaults (available for future use)
  - Added `validateGameContext()` function in `src/main.ts` to replace unsafe `Game as unknown as GameContext` type casting with explicit runtime checks
  - Enhanced error handling with specific error classification (TypeError vs Error vs unknown errors)
  - Added 26 unit tests for memory validation infrastructure and error classification (note: validateGameContext tests validate error types but not the validation function itself due to it being private)
  - Strengthened ESLint configuration with stricter TypeScript rules for runtime files (`src/runtime/**/*.ts`):
    - `@typescript-eslint/no-explicit-any`: error (prevents unsafe any types)
    - `@typescript-eslint/prefer-nullish-coalescing`: error (safer null/undefined handling)
    - `@typescript-eslint/prefer-optional-chain`: error (cleaner optional property access)
    - `@typescript-eslint/no-unsafe-assignment`: error (prevents unsafe type assignments in runtime code)
    - `@typescript-eslint/no-unsafe-call`: error (prevents calls without proper type checking in runtime code)
    - `@typescript-eslint/no-unsafe-member-access`: error (prevents unsafe property access in runtime code)
  - Exception added for `src/main.ts` to allow profiler initialization with unsafe operations required for global exposure
  - All tests pass (477 unit tests), build succeeds
  - Improves autonomous monitoring compatibility with parseable error messages
  - Benefits CPU timeout detection, evaluation system, and autonomous improvement workflows

---

**Full Changelog**: [0.31.9 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.31.9)
