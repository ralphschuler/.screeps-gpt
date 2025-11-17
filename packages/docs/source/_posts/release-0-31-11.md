---
title: "Release 0.31.11"
date: 2025-11-09T00:00:00.000Z
categories:
  - Release Notes
  - Security
tags:
  - release
  - automation
  - monitoring
  - deployment
  - security
---

We're pleased to announce version 0.31.11 of the Screeps GPT autonomous bot.

## What's New

### Security

- **Removed Unnecessary Credential Exposure in Monitoring Workflow**: Eliminated `SCREEPS_EMAIL` and `SCREEPS_PASSWORD` from `screeps-monitoring.yml` workflow
  - Credentials were unnecessarily exposed to GitHub Copilot CLI during monitoring operations
  - Scripts (`fetch-profiler-console.ts`, `check-ptr-alerts.ts`) use only `SCREEPS_TOKEN` for API authentication
  - Follows least-privilege principle by providing only token-based read-only access
  - Reduces attack surface by removing write-capable credentials from third-party AI service environment
  - Aligns with `deploy.yml` workflow pattern which demonstrates token-only authentication is sufficient
  - Impact: High priority security improvement - eliminated credential exposure in workflow running every 30 minutes
  - No functionality changes - all monitoring features (PTR stats, profiler fetch, alert checking) continue to work with token-only authentication

---

**Full Changelog**: [0.31.11 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.31.11)
