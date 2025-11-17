---
title: Security Documentation
date: 2025-11-17T12:00:00.000Z
layout: page
---

# Security Documentation

Security practices, dependency management, and vulnerability handling for the Screeps GPT project.

## Overview

Security is a critical concern for the autonomous development workflow. This section documents security practices, dependency management, vulnerability scanning, and incident response procedures.

## Available Documentation

### Dependency Security

- [**Dependency Vulnerabilities**](dependency-vulnerabilities.html) - Managing security vulnerabilities in project dependencies

## Security Practices

### Automated Security Scanning

The project employs multiple automated security measures:

**GitHub Advisory Database Integration:**

- Pre-installation vulnerability checks using `gh-advisory-database` tool
- Automated scanning before adding new dependencies
- Supported ecosystems: npm, pip, maven, go, rubygems, rust, and more

**CodeQL Analysis:**

- Automated code scanning with CodeQL
- Security vulnerability detection in source code
- Required checks before merging pull requests
- Automated security alerts for detected issues

**Dependabot:**

- Automated dependency updates for security patches
- Weekly scans for vulnerable dependencies
- Automatic pull requests for security updates
- Integration with GitHub Security Advisories

### Secrets Management

**Best Practices:**

- Never commit secrets or credentials to source code
- Use GitHub Actions secrets for sensitive configuration
- Rotate credentials regularly
- Use least-privilege access principles

**Protected Secrets:**

- `SCREEPS_TOKEN` - Screeps API authentication token
- `SCREEPS_PTR_TOKEN` - PTR authentication token
- `PUSH_TOKEN` - Push notification service token
- `NPM_TOKEN` - npm registry authentication (if applicable)

### Workflow Security

**GitHub Actions Security:**

- Minimal permissions for workflow runs
- Separate read/write permission scopes
- Environment-based secret access
- Third-party action pinning by SHA

**Deployment Security:**

- Separate deployment credentials for production vs. PTR
- Automatic deployment only on tagged releases
- Manual approval for production deployments
- Audit logging for all deployments

### Vulnerability Response

**Handling Security Issues:**

1. **Detection** - Automated scanning identifies vulnerability
2. **Triage** - Assess severity and impact
3. **Remediation** - Apply patches or workarounds
4. **Verification** - Re-scan to confirm fix
5. **Documentation** - Record in security documentation

**Severity Levels:**

- **Critical** - Immediate action required, blocks all deployments
- **High** - Address within 7 days
- **Medium** - Address within 30 days
- **Low** - Address in next regular maintenance cycle

## Security Tools

### Integrated Security Tools

- **CodeQL** - Static application security testing (SAST)
- **gh-advisory-database** - Dependency vulnerability checks
- **Dependabot** - Automated dependency updates
- **ESLint** - Code quality and security linting
- **npm audit** - npm dependency vulnerability scanning

### Security Workflows

- **CodeQL Analysis** - Runs on every PR and push to main
- **Dependency Review** - Blocks PRs with vulnerable dependencies
- **Security Updates** - Automated Dependabot PRs for security patches

## Related Documentation

- [Automation Overview](../automation/overview.html) - CI/CD pipeline and security gates
- [Workflow Troubleshooting](../operations/workflow-troubleshooting.html) - Debugging security check failures
- [Agent Guidelines](../../AGENTS.md) - Security requirements for autonomous agents

## Quick Links

- [Security Advisories](https://github.com/ralphschuler/.screeps-gpt/security/advisories)
- [Dependabot Alerts](https://github.com/ralphschuler/.screeps-gpt/security/dependabot)
- [CodeQL Alerts](https://github.com/ralphschuler/.screeps-gpt/security/code-scanning)
- [Main Documentation Index](../index.html)
