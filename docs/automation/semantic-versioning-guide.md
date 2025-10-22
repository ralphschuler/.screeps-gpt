# Semantic Versioning Guide

This document explains the automated semantic versioning system implemented in the CI/CD workflow.

## Overview

The repository uses **conventional commits** to automatically determine version bumps. When changes are merged to `main`, the `post-merge-release.yml` workflow analyzes commit messages since the last version tag and determines the appropriate version bump type.

## Conventional Commit Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types and Version Bumps

| Commit Type        | Example                             | Version Bump              | Description               |
| ------------------ | ----------------------------------- | ------------------------- | ------------------------- |
| `feat:`            | `feat: add new harvester AI`        | **Minor** (0.1.0 → 0.2.0) | New feature or capability |
| `fix:`             | `fix: correct spawn priority logic` | **Patch** (0.1.0 → 0.1.1) | Bug fix                   |
| `chore:`           | `chore: update dependencies`        | **Patch** (0.1.0 → 0.1.1) | Maintenance tasks         |
| `docs:`            | `docs: update API documentation`    | **Patch** (0.1.0 → 0.1.1) | Documentation changes     |
| `BREAKING CHANGE:` | See below                           | **Major** (1.0.0 → 2.0.0) | Breaking API changes      |

### Breaking Changes

Indicate breaking changes in two ways:

1. **In commit footer:**

```
feat: redesign spawning system

BREAKING CHANGE: The spawning API has been completely redesigned.
All existing spawn configurations will need to be updated.
```

2. **With `!` after type/scope:**

```
feat!: redesign spawning system

The spawning API has been completely redesigned.
```

## Pre-1.0 Development (Current State)

During pre-1.0 development (versions 0.x.y), major bumps are converted to minor bumps per the [semver specification](https://semver.org/#spec-item-4):

- **Breaking Change** → Minor bump (0.1.0 → 0.2.0)
- **New Feature** → Minor bump (0.1.0 → 0.2.0)
- **Bug Fix** → Patch bump (0.1.0 → 0.1.1)

Once the project reaches version 1.0.0, breaking changes will trigger major version bumps.

## Workflow Behavior

### Post-Merge Release Workflow

When a commit is pushed to `main`:

1. **Analyzes commits** since the last version tag
2. **Determines bump type** based on commit messages
3. **Updates version** in `package.json`
4. **Commits changes** directly to `main` with `[skip ci]` flag
5. **Creates version tag** (e.g., `v0.2.0`)
6. **Creates GitHub Release** with auto-generated release notes

### Deploy Workflow

When a release is published:

1. **Triggered automatically** by the release event
2. **Builds the bundle** from the tagged commit
3. **Deploys to Screeps** using the `production` environment
4. **Logs deployment** in GitHub's deployment tracking

## Best Practices

### Writing Commit Messages

✅ **Good Examples:**

- `feat: implement automatic tower targeting`
- `fix: prevent creeps from getting stuck at exits`
- `chore: upgrade TypeScript to 5.4.3`
- `docs: add deployment environment setup guide`

❌ **Avoid:**

- `update code` (too vague, no conventional type)
- `feat add feature` (missing colon)
- `WIP` or `tmp` (should be squashed before merge)

### Scopes (Optional but Recommended)

Use scopes to indicate the affected area:

```
feat(kernel): add CPU usage tracking
fix(spawning): correct priority calculation
docs(readme): update deployment instructions
```

Common scopes in this repository:

- `kernel` - Core runtime system
- `spawning` - Spawn management
- `behavior` - Creep AI behavior
- `evaluation` - System evaluation
- `workflow` - GitHub Actions workflows
- `docs` - Documentation

### Multiple Changes in One PR

When a PR contains multiple logical changes:

1. **Use separate commits** with appropriate types:

```
feat: add new tower logic
fix: correct energy calculation
docs: update tower documentation
```

2. The workflow will use the **highest precedence** change:
   - Breaking change > Feature > Fix/Chore

### Release Notes

GitHub's auto-generated release notes will include:

- All commits since the last release
- Grouped by type (if using conventional commits)
- Links to pull requests
- Contributor attribution

You can edit release notes in GitHub after they're created to add:

- Migration guides for breaking changes
- Known issues or limitations
- Special acknowledgments

## Troubleshooting

### Version Not Bumping

If the version doesn't bump after a merge:

1. Check if commit message contains `[skip ci]` or `chore(release):`
2. Verify commit follows conventional commit format
3. Check workflow logs for errors

### Wrong Version Bump Type

If the wrong bump type is used:

1. Review commit messages - ensure types are correct
2. Check for `BREAKING CHANGE:` in commit body
3. The script logs the bump type in workflow output

### Manual Version Override

If you need to manually set a version:

1. Update `package.json` version
2. Commit with `chore(release): bump version to X.Y.Z [skip ci]`
3. Manually create and push tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
4. Create release through GitHub UI

## Implementation Details

### Script Location

- Main script: `scripts/bump-version-semantic.ts`
- npm script: `npm run version:bump-semantic`
- Test file: `tests/unit/bump-version-semantic.test.ts`

### Algorithm

1. Find last version tag using `git describe`
2. Get all commits since last tag (or all commits if no tag)
3. Parse each commit for conventional commit format
4. Determine highest precedence bump type
5. Calculate new version using semver
6. Update `package.json` and output new version

### Concurrency Protection

Both release and deploy workflows use concurrency groups to prevent race conditions:

```yaml
concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false
```

This ensures only one release or deployment runs at a time for each branch/tag.

## Migration from Previous System

The previous system created release PRs with manual approval. The new system:

- ✅ Eliminates release PR overhead
- ✅ Provides automatic versioning
- ✅ Uses GitHub's native release features
- ✅ Maintains deployment safety with environments

All existing deployment configuration (Screeps tokens, hosts, etc.) remains unchanged.
