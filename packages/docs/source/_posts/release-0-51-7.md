---
title: "Release 0.51.7"
date: 2025-11-12T00:00:00.000Z
categories:
  - Release Notes
tags:
  - release
  - automation
  - documentation
  - testing
---
We're pleased to announce version 0.51.7 of the Screeps GPT autonomous bot.

## What's New

### Removed

- **Spec-Kit Workflow System**: Removed unused specification-driven development workflow infrastructure
  - Deleted workflow file `.github/workflows/copilot-speckit.yml`
  - Deleted prompt templates `.github/copilot/prompts/speckit-plan` and `speckit-refine`
  - Deleted documentation `docs/automation/spec-kit-workflow.md` from all documentation locations
  - Removed `speckit` label definition from `.github/labels.yml`
  - Removed all spec-kit references from automation documentation
  - Deleted regression test `tests/regression/speckit-workflow-structure.test.js`
  - Repository has standardized on Todo automation workflow for implementations
  - Reduces maintenance burden and simplifies automation surface area
  - Resolves #557: Remove unused spec-kit workflow and documentation

---

**Full Changelog**: [0.51.7 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.51.7)
