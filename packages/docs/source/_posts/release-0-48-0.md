---
title: "Release 0.48.0"
date: 2025-11-12T00:00:00.000Z
categories:
  - Release Notes
  - Improvements
tags:
  - release
  - automation
  - testing
---
We're pleased to announce version 0.48.0 of the Screeps GPT autonomous bot.

## What's New

### Improvements

- **Issue Triage Enhancement**: Enhanced issue triage automation with comprehensive context gathering
  - Added code context gathering using GitHub MCP `search_code` to find related files in `.github/`, `src/`, `tests/`
  - Added issue cross-referencing to identify related open and closed issues
  - Added PR cross-referencing to find related pull requests
  - Enhanced reformulated issue body with new sections: "Related Code", "Related PRs"
  - Updated triage comment to include discovered context
  - Extended JSON output to include `related_prs` and `related_code_files` fields
  - Resolves #639: Make issue triage automation check current code, issues, and pull requests

---

**Full Changelog**: [0.48.0 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.48.0)
