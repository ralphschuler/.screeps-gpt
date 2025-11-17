---
title: "Release 0.31.5"
date: 2025-11-08T00:00:00.000Z
categories:
  - Release Notes
  - Bug Fixes
tags:
  - release
  - automation
  - testing
  - security
---
We're pleased to announce version 0.31.5 of the Screeps GPT autonomous bot.

## What's New

### Bug Fixes

- **Security Audit Workflow jq Parsing Error**: Fixed shell parsing error in `.github/workflows/guard-security-audit.yml` that was causing workflow failures
  - Root cause: Multi-line jq command with backslash continuation was causing syntax errors in shell execution
  - Fixed by properly formatting multi-line jq command without trailing backslashes before pipe operators
  - Added defensive error handling for jq parsing failures to prevent workflow crashes
  - Added handling for "unknown" vulnerability counts when parsing fails
  - Created regression test (`tests/regression/guard-security-audit-workflow-syntax.test.ts`) to validate workflow syntax and error handling
  - Workflow now passes yamllint validation with 80-character line limit
  - Fixes consistently failing Security Audit workflow (run 19183827409 and subsequent runs)
  - Restores CI/CD pipeline health for security vulnerability scanning

---

**Full Changelog**: [0.31.5 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.31.5)
