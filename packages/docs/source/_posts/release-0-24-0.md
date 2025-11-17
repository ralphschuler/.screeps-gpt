---
title: "Release 0.24.0: Self-Healing Memory System"
date: 2025-11-08T00:00:00.000Z
categories:
  - Release Notes
  - Features
tags:
  - release
  - documentation
  - testing
  - performance
---

We're pleased to announce version 0.24.0 of the Screeps GPT autonomous bot.

## What's New

### New Features

- **Self-Healing Memory System**: Automatic detection and repair of corrupted memory structures
  - New `MemorySelfHealer` class validates and repairs core memory structures (creeps, rooms, roles, respawn, stats, systemReport)
  - Detects circular references, invalid types, malformed data, and missing structures
  - Automatic repair of corrupted entries with configurable auto-repair behavior
  - Emergency reset capability for complete memory corruption
  - Integrated into Kernel bootstrap (runs before migrations and other operations)
  - Enabled by default (`enableSelfHealing: true` in Kernel config)
  - 28 comprehensive unit tests covering validation, repair, and emergency reset scenarios
  - Updated documentation with self-healing usage, best practices, and troubleshooting guide

---

**Full Changelog**: [0.24.0 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.24.0)
