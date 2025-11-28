---
title: Custom Copilot Agent Environment
category: Automation
tags:
  - copilot
  - environment
  - configuration
  - github-packages
---

# Custom Copilot Agent Environment

This document describes the custom GitHub Copilot agent environment configuration for the .screeps-gpt project, which provides optimized support for project-specific tooling and @ralphschuler GitHub packages.

## Overview

The `.github/copilot-environment.json` configuration file defines a custom environment that Copilot agents use when working with this repository. This ensures:

- **Consistent tooling** - All agents use the same Node.js version, package manager, and tools
- **GitHub package authentication** - Automatic setup for @ralphschuler scoped packages
- **Project awareness** - Pre-configured with TypeScript, ESLint, Prettier, and Vitest
- **Workspace understanding** - Knowledge of monorepo structure and available packages

## Configuration Structure

### Base Environment

```json
{
  "name": "screeps-gpt-environment",
  "description": "Custom Copilot agent environment for .screeps-gpt project",
  "version": "1.0.0",
  "extends": "node"
}
```

The environment extends the standard Node.js base and is versioned for tracking changes.

### Container Setup

```json
{
  "environment": {
    "image": "node:22-alpine",
    "setup": [
      "apk add --no-cache git",
      "npm install -g yarn@4.11.0",
      "yarn set version 4.11.0"
    ]
  }
}
```

**Features:**
- Node.js 22 LTS (Alpine Linux for minimal size)
- Git for repository operations
- Yarn 4.11.0 (matches project's package manager version)

### Package Manager Configuration

```json
{
  "packages": {
    "manager": "yarn",
    "scopes": {
      "@ralphschuler": {
        "registry": "https://npm.pkg.github.com",
        "alwaysAuth": true
      }
    },
    "install": [
      "yarn install --immutable"
    ]
  }
}
```

**Features:**
- Yarn workspace support
- @ralphschuler scope configured for GitHub Package Registry
- Immutable installs for reproducibility

### Environment Variables

```json
{
  "environment": {
    "variables": {
      "NODE_ENV": "development",
      "NPM_CONFIG_REGISTRY": "https://registry.npmjs.org/",
      "NPM_CONFIG_@RALPHSCHULER:REGISTRY": "https://npm.pkg.github.com",
      "NPM_CONFIG_ALWAYS_AUTH": "true"
    },
    "secrets": [
      "GITHUB_TOKEN",
      "NPM_TOKEN"
    ]
  }
}
```

**Features:**
- Default npm registry for public packages
- GitHub Package Registry for @ralphschuler scope
- Authentication enabled for private packages
- Secure secret handling

### Available Tools

```json
{
  "tools": {
    "available": [
      "node",
      "npm",
      "yarn",
      "git",
      "gh",
      "tsx",
      "vitest",
      "eslint",
      "prettier"
    ],
    "paths": [
      "/usr/local/bin",
      "/node_modules/.bin",
      ".yarn/releases"
    ]
  }
}
```

**Available Tools:**
- **node, npm, yarn** - JavaScript runtime and package managers
- **git, gh** - Version control and GitHub CLI
- **tsx** - TypeScript execution (used for build scripts)
- **vitest** - Testing framework
- **eslint** - Code linting
- **prettier** - Code formatting

### Project Features

```json
{
  "features": {
    "typescript": {
      "enabled": true,
      "version": "5.4.3",
      "strict": true,
      "tsconfig": "tsconfig.json"
    },
    "linting": {
      "enabled": true,
      "config": "eslint.config.mjs"
    },
    "formatting": {
      "enabled": true,
      "config": ".prettierrc"
    },
    "testing": {
      "enabled": true,
      "framework": "vitest",
      "config": "vitest.config.ts"
    }
  }
}
```

**Features:**
- TypeScript 5.4.3 with strict mode
- ESLint with project-specific configuration
- Prettier formatting
- Vitest testing framework

### Workspace Configuration

```json
{
  "workspace": {
    "type": "yarn-workspaces",
    "packages": [
      "packages/*"
    ],
    "root": true
  }
}
```

**Features:**
- Yarn workspaces monorepo structure
- Root-level package coordination
- Package discovery in `packages/` directory

### Documentation References

```json
{
  "documentation": {
    "readme": "README.md",
    "contributing": "DOCS.md",
    "agents": "AGENTS.md",
    "tasks": "TASKS.md",
    "changelog": "CHANGELOG.md"
  }
}
```

Guides Copilot agents to relevant documentation files for context.

## DevContainer Integration

The `.devcontainer/devcontainer.json` configuration is aligned with the Copilot environment for consistency:

### VSCode Settings

```json
{
  "settings": {
    "terminal.integrated.defaultProfile.linux": "bash",
    "typescript.tsdk": "node_modules/typescript/lib",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": "explicit"
    },
    "npm.packageManager": "yarn"
  }
}
```

### Extensions

```json
{
  "extensions": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "github.copilot",
    "github.copilot-chat",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### Environment Setup

```json
{
  "postCreateCommand": "yarn install",
  "remoteEnv": {
    "NPM_CONFIG_@RALPHSCHULER:REGISTRY": "https://npm.pkg.github.com",
    "NPM_CONFIG_ALWAYS_AUTH": "true"
  }
}
```

## Authentication

### GitHub Packages

To authenticate with GitHub Package Registry for @ralphschuler packages:

1. **Workflow Automation**: The `GITHUB_TOKEN` is automatically provided in GitHub Actions
2. **Local Development**: Create a personal access token with `read:packages` scope
3. **DevContainer**: Token is injected via environment variables

### NPM Registry

The configuration supports both:
- Public packages from npmjs.org (no auth required)
- @ralphschuler scoped packages from GitHub Package Registry (auth required)

## Usage in Workflows

Copilot automation workflows automatically use this environment when executing agent tasks:

```yaml
- name: Execute Copilot Agent
  uses: ./.github/actions/copilot-exec
  with:
    prompt: |
      Resolve issue #1234
```

> **Note:** The Copilot agent environment is configured automatically via the `.github/workflows/copilot-setup-steps.yml` workflow. You do **not** need to pass an `environment` input to the `copilot-exec` action; it will use the environment set up by the workflow.

The environment ensures:
- Package manager is configured correctly
- GitHub packages are accessible
- All project tools are available
- TypeScript, linting, and testing work out of the box

## Benefits

### For Copilot Agents

1. **Faster Setup** - Pre-configured environment reduces initialization time
2. **Correct Context** - Agents understand project structure and tooling
3. **Package Access** - Can install and use @ralphschuler packages
4. **Tool Availability** - All build, test, and lint tools are ready

### For Developers

1. **Consistency** - Same environment in Copilot and DevContainer
2. **Reproducibility** - Versioned configuration tracks changes
3. **Documentation** - Self-documenting project setup
4. **Onboarding** - New contributors get a working environment automatically

## Maintenance

### Updating the Environment

When making changes to project tooling:

1. Update `.github/copilot-environment.json`
2. Update `.devcontainer/devcontainer.json` for consistency
3. Test with a sample Copilot workflow
4. Document changes in `CHANGELOG.md`

### Version Bumps

The environment configuration is versioned:

```json
{
  "version": "1.0.0"
}
```

Increment the version when making breaking changes to the environment setup.

## Troubleshooting

### Package Authentication Failures

If Copilot agents cannot access @ralphschuler packages:

1. Verify `GITHUB_TOKEN` has `read:packages` permission
2. Check workflow permissions in `.github/workflows/*.yml`
3. Ensure npm scope is configured correctly in `.yarnrc.yml`

### Tool Not Found

If an agent reports missing tools:

1. Verify tool is listed in `tools.available` array
2. Check tool paths in `tools.paths` array
3. Ensure setup commands install the tool

### Workspace Issues

If packages are not recognized:

1. Verify `workspace.packages` matches actual directory structure
2. Check `package.json` workspaces configuration
3. Ensure `yarn install` ran successfully

## Related Documentation

- [GitHub Copilot Custom Environments](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment)
- [Automation Overview](overview.md)
- [Development Container Configuration](https://code.visualstudio.com/docs/devcontainers/containers)
- [Yarn Workspaces](https://yarnpkg.com/features/workspaces)

## See Also

- `.github/copilot-environment.json` - Configuration file
- `.devcontainer/devcontainer.json` - DevContainer configuration
- `.yarnrc.yml` - Yarn package manager settings
- `.npmrc` - npm configuration for @ralphschuler scope
