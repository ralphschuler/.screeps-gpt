---
title: "Release 0.50.0: Builder Wall Maintenance"
date: 2025-11-12T00:00:00.000Z
categories:
  - Release Notes
  - Features
tags:
  - release
---
We're pleased to announce version 0.50.0 of the Screeps GPT autonomous bot.

## What's New

### New Features

- **Builder Wall Maintenance**: Builder role now repairs walls and ramparts to configurable target HP thresholds
  - Added `WALL_TARGET_HP` constant (100,000 HP) for wall repair threshold
  - Added `RAMPART_TARGET_HP` constant (50,000 HP) for rampart repair threshold
  - Modified builder repair filter to include walls/ramparts below target HP
  - Fixes #644: Builder role now maintains defensive structures

---

**Full Changelog**: [0.50.0 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.50.0)
