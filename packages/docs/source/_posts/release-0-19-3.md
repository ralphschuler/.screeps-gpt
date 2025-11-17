---
title: "Release 0.19.3"
date: 2025-11-07T00:00:00.000Z
categories:
  - Release Notes
  - Security
tags:
  - release
  - testing
  - security
---
We're pleased to announce version 0.19.3 of the Screeps GPT autonomous bot.

## What's New

### Security

- **Resolved 3 high-severity vulnerabilities in axios dependency (#282)**
  - Fixed GHSA-jr5f-v2jv-69x6: axios SSRF and credential leakage vulnerability (CVE affecting axios < 0.30.0)
  - Fixed GHSA-4hjh-wcwx-xvwj: axios DoS attack through lack of data size check (CVE affecting axios < 0.30.2)
  - Applied npm package overrides to force axios@1.13.2 across all transitive dependencies
  - Transitive dependency path: screeps-api@1.16.1 → axios@0.28.1 (vulnerable) → axios@1.13.2 (patched)
  - All tests, builds, and linting pass with no regressions

---

**Full Changelog**: [0.19.3 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.19.3)
