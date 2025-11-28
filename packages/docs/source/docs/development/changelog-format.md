# CHANGELOG Format Guide

This document defines the format and conventions for maintaining `CHANGELOG.md` in the repository. Following these guidelines ensures consistent, clear, and useful release documentation.

## Overview

The CHANGELOG follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) conventions with additional sections for deprecations and security notices.

**Location**: `CHANGELOG.md` in repository root

**Update Frequency**:

- Continuous updates to `[Unreleased]` section during development
- Formal release sections created during version bumps

## Version Header Format

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security
```

### Section Descriptions

#### Added

New features, capabilities, or functionality added to the codebase.

**Examples**:

- New API endpoints
- New configuration options
- New automation workflows
- New documentation

#### Changed

Changes to existing functionality that don't break compatibility.

**Examples**:

- Behavior modifications
- Performance improvements
- Documentation updates
- Refactoring

#### Deprecated

Features marked for future removal, still functional but discouraged.

**Format**:

```markdown
### Deprecated

- **[Feature Name]**: [Brief description of what's deprecated and why]
  - Alternative: [What to use instead]
  - Removal: [Target version for removal]
  - Migration: [Link to migration guide]
```

**Example**:

```markdown
### Deprecated

- **Role-based Behavior System**: Legacy role system is deprecated in favor of task management
  - Alternative: Use `TaskManager` with task-based behavior patterns
  - Removal: v1.0.0
  - Migration: docs/runtime/strategy/enabling-task-system.md
```

#### Removed

Features that have been completely removed from the codebase.

**Format**:

```markdown
### Removed

- **[Feature Name]**: [What was removed and why]
  - Previously deprecated: [When it was deprecated]
  - Migration: [Link to migration guide for users on older versions]
```

**Example**:

```markdown
### Removed

- **Legacy Spawn System**: Old spawn management API removed after deprecation period
  - Previously deprecated: v0.45.0
  - Migration: docs/runtime/operations/spawn-system-migration.md
```

#### Fixed

Bug fixes and corrections to existing functionality.

**Examples**:

- Bug fixes with issue references
- Regression fixes
- Documentation corrections

#### Security

Security-related changes, vulnerabilities fixed, or security improvements.

**Examples**:

- Vulnerability patches
- Security enhancements
- Dependency security updates

## Unreleased Section

The `[Unreleased]` section tracks changes that are committed but not yet released.

```markdown
## [Unreleased]

### Added

- New features added since last release

### Changed

- Changes to existing features

### Deprecated

- Features marked for deprecation

### Fixed

- Bug fixes

### Security

- Security updates
```

**Guidelines**:

- Always update `[Unreleased]` when making changes
- Use bullet points with clear descriptions
- Include issue/PR references where applicable
- Group related changes together
- Keep entries concise but informative

## Entry Format

### Basic Entry

```markdown
- **[Feature/Component Name]**: Brief description of the change
  - Additional detail 1
  - Additional detail 2
  - Resolves #123: Reference to GitHub issue
```

### Deprecation Entry (Full Format)

```markdown
- **[Feature Name]**: [Why it's deprecated]
  - Alternative: [What to use instead]
  - Removal: [Target version]
  - Timeline: [Deprecation lifecycle phase]
  - Migration: [Link to migration guide]
  - Impact: [Low/Medium/High - assessment of change impact]
  - Resolves #123: Reference to deprecation tracking issue
```

### Removal Entry (Full Format)

```markdown
- **[Feature Name]**: [What was removed]
  - Previously deprecated: [Version when deprecated]
  - Deprecation period: [Duration of deprecation]
  - Migration: [Link to migration guide]
  - Breaking change: [Yes/No and explanation]
  - Resolves #123: Reference to removal issue
```

### Security Entry

```markdown
- **[Security Issue]**: [Description of vulnerability fixed]
  - Severity: [Critical/High/Medium/Low]
  - CVE: [CVE identifier if applicable]
  - Credit: [Security researcher name if external report]
  - Impact: [What was affected]
```

## Issue and PR References

Always include references to related issues and PRs:

```markdown
- **Feature Name**: Description
  - Resolves #123: Main issue resolved
  - Related to #456: Related context
  - Implements #789: Implementation of proposal
```

**Reference Keywords**:

- `Resolves #123` - Fixes/closes the issue
- `Fixes #123` - Alternative to Resolves
- `Closes #123` - Alternative to Resolves
- `Related to #123` - Provides context
- `Implements #123` - Implements proposal/spec
- `Part of #123` - Part of larger effort

## Versioning Guidelines

### Semantic Versioning

Follow [Semantic Versioning 2.0.0](https://semver.org/):

- **Major (X.0.0)**: Breaking changes, removed deprecated features
- **Minor (0.X.0)**: New features, deprecations (backward compatible)
- **Patch (0.0.X)**: Bug fixes, security patches (backward compatible)

### When to Bump Versions

**Major Version**:

- Removing deprecated features
- Breaking API changes
- Major architectural changes
- Public API incompatibilities

**Minor Version**:

- New features added
- Deprecating existing features
- New APIs or configuration options
- Significant enhancements

**Patch Version**:

- Bug fixes
- Security patches
- Documentation updates
- Performance improvements (non-breaking)

## Deprecation Timeline in CHANGELOG

Track deprecation lifecycle across multiple versions:

### Version N (Deprecation Announcement)

```markdown
## [0.50.0] - 2025-11-12

### Deprecated

- **Feature X**: Marked as deprecated, will be removed in v0.53.0
  - Alternative: Use Feature Y instead
  - Removal: v0.53.0
  - Migration: docs/development/feature-x-migration.md
```

### Version N+1 (Deprecation Warning Period)

```markdown
## [0.51.0] - 2025-11-20

### Changed

- **Feature X**: Added runtime warnings for deprecated usage
  - Reminder: Will be removed in v0.53.0
  - Migration: docs/development/feature-x-migration.md
```

### Version N+2 (Pre-Removal Notice)

```markdown
## [0.52.0] - 2025-12-01

### Changed

- **Feature X**: Final version supporting deprecated feature
  - Removal scheduled for next release (v0.53.0)
  - Last chance to migrate: docs/development/feature-x-migration.md
```

### Version N+3 (Removal)

```markdown
## [0.53.0] - 2025-12-15

### Removed

- **Feature X**: Removed after deprecation period
  - Previously deprecated: v0.50.0
  - Deprecation period: 3 releases (2 months)
  - Migration: docs/development/feature-x-migration.md
  - Breaking change: Yes - users must migrate to Feature Y
```

## Examples

### Complete Version Example

```markdown
## [0.51.0] - 2025-11-12

### Added

- **Deprecation Management System**: Comprehensive deprecation tracking and lifecycle management
  - Created deprecation policy document with lifecycle phases
  - Added deprecation registry for centralized tracking
  - Implemented ESLint rules for deprecated API detection
  - Added CI workflow for automated deprecation checks
  - Resolves #XXX: Implement deprecation strategy

### Changed

- **Build System**: Improved build performance with incremental compilation
  - 40% faster builds in watch mode
  - Reduced memory usage by 25%
  - Related to #YYY: Build performance optimization

### Deprecated

- **Legacy Label System**: Old labels (bug, enhancement, severity/\*) deprecated
  - Alternative: Use type/_, priority/_, state/\* labels instead
  - Removal: v0.54.0
  - Migration: See .github/labels.yml for mappings
  - Impact: Low - both systems supported during deprecation period

### Fixed

- **Memory Corruption**: Fixed edge case in memory migration causing data loss
  - Added validation checks in MemoryMigrationManager
  - Added regression test suite
  - Fixes #ZZZ: Memory data loss in certain scenarios

### Security

- **Dependency Update**: Updated axios to v1.13.2 to fix CVE-2024-XXXXX
  - Severity: High
  - Impact: All HTTP requests in deployment scripts
```

## Maintenance

### Regular Updates

1. **During Development**: Update `[Unreleased]` section as changes are made
2. **Before Release**: Review and organize `[Unreleased]` entries
3. **At Release**: Move `[Unreleased]` to version section with date
4. **After Release**: Run `bun run versions:update` to update version index

### Version Index Updates

After updating CHANGELOG:

```bash
bun run versions:update
```

This updates:

- `docs/changelog/versions.md` - Human-readable version history
- `docs/changelog/versions.json` - Machine-readable version data

## Best Practices

### DO

✅ Update CHANGELOG with every significant change  
✅ Use clear, descriptive language  
✅ Include issue/PR references  
✅ Group related changes together  
✅ Maintain consistent formatting  
✅ Document deprecations with migration paths  
✅ Highlight breaking changes clearly  
✅ Keep entries concise but complete

### DON'T

❌ Skip CHANGELOG updates for changes  
❌ Use vague descriptions ("fixed stuff")  
❌ Forget issue references  
❌ Mix unrelated changes in one entry  
❌ Use inconsistent formatting  
❌ Deprecate without alternatives  
❌ Remove features without warning  
❌ Write overly technical entries

## Templates

### Quick Templates

**Feature Addition**:

```markdown
- **[Feature Name]**: Brief description of new capability
  - Detail 1
  - Detail 2
  - Resolves #123
```

**Bug Fix**:

```markdown
- **[Component/Area]**: Fixed [description of bug]
  - Additional context
  - Fixes #123
```

**Deprecation**:

```markdown
- **[Feature Name]**: [Reason for deprecation]
  - Alternative: [Replacement feature]
  - Removal: [Version]
  - Migration: [Link]
```

## Related Documentation

- [Deprecation Policy](./deprecation-policy.md)
- [Deprecation Registry](./deprecation-registry.md)
- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)

---

**Last Updated**: 2025-11-12 (v0.51.0)  
**Maintained by**: Repository automation and contributors
