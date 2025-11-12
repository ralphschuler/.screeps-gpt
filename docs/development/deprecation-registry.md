# Deprecation Registry

This registry tracks all active deprecations in the repository. It provides a centralized view of deprecated features, their removal timelines, and migration paths.

## Active Deprecations

### Code Features

#### 1. Role-based Behavior System

**Status**: 🟡 Active Deprecation  
**Deprecated In**: v0.32.0  
**Target Removal**: v1.0.0  
**Estimated Removal Date**: TBD (when v1.0.0 is released)

**Description**: The legacy role-based behavior system where creeps are assigned fixed roles (harvester, upgrader, builder, etc.) is being replaced by a more flexible task-based system.

**Alternative**: Use `TaskManager` with task-based behavior patterns via `BehaviorController` with `useTaskSystem: true` (now default).

**Migration Guide**: [docs/runtime/strategy/enabling-task-system.md](../runtime/strategy/enabling-task-system.md)

**Impact**:

- Low: Task system is already the default since v0.32.0
- Users can still opt-in to role system with `useRoleSystem: true` option
- No breaking changes during deprecation period

**Current Usage**:

- `packages/bot/src/runtime/behavior/BehaviorController.ts` - Contains deprecated role system code
- Option `useRoleSystem: true` can still enable legacy behavior

**Related Issues**:

- [#478](https://github.com/ralphschuler/.screeps-gpt/issues/478) - Task system evaluation and enablement

---

### Labels and Metadata

#### 2. Legacy GitHub Labels

**Status**: 🟡 Active Deprecation  
**Deprecated In**: v0.47.0  
**Target Removal**: v0.51.0  
**Estimated Removal Date**: Q1 2026

**Description**: Old label system using `bug`, `enhancement`, and `severity/*` labels is being replaced by a standardized three-tier system with `type/*`, `priority/*`, and `state/*` labels.

**Deprecated Labels**:

- `bug` → Use `type/bug` instead
- `enhancement` → Use `type/enhancement` instead
- `severity/high` → Use `priority/critical` instead
- `severity/medium` → Use `priority/high` instead
- `severity/low` → Use `priority/low` instead

**Migration Guide**: See `.github/labels.yml` descriptions for mappings

**Impact**:

- Medium: Affects issue triage and automation workflows
- Labels marked with `[DEPRECATED]` prefix in descriptions
- Both old and new labels currently supported

**Current Usage**:

- `.github/labels.yml` - Contains deprecated label definitions
- Existing issues may still have old labels
- Automation workflows should use new labels

**Migration Actions**:

1. Update existing issues to use new labels (can be automated)
2. Update workflow filters to use new label names
3. Remove deprecated label definitions from `.github/labels.yml`

---

## Completed Removals

This section documents features that have been successfully removed after deprecation period.

_(None yet - this is the first version of the deprecation registry)_

---

## Deprecation Schedule

### Q4 2025

- ✅ v0.47.0: Deprecate legacy label system
- ✅ v0.50.0: Implement deprecation tracking system

### Q1 2026

- 🎯 v0.51.0: Remove legacy labels from `.github/labels.yml`
- 🎯 v0.52.0: Review and update deprecation policies

### Future (TBD)

- 🎯 v1.0.0: Remove role-based behavior system entirely
- 🎯 v1.0.0: Major version cleanup of all deprecated features

---

## Deprecation Guidelines

When adding a new deprecation to this registry:

1. **Create Entry**: Add to appropriate section (Code Features, Labels, Configuration, etc.)
2. **Set Status**: Use status emoji:
   - 🟢 Planned (not yet deprecated)
   - 🟡 Active Deprecation (currently deprecated)
   - 🔴 Removal Pending (next version)
   - ✅ Removed (completed)
3. **Document Timeline**: Include deprecation version and target removal version
4. **Provide Migration Path**: Link to detailed migration guide
5. **Assess Impact**: Rate impact level (Low/Medium/High) and explain
6. **Update CHANGELOG**: Add deprecation notice to CHANGELOG.md

---

## Monitoring Deprecated Usage

### CI/CD Integration

The following checks run automatically to detect deprecated API usage:

- **ESLint**: Warns when deprecated APIs are used (see `eslint.config.mjs`)
- **Unit Tests**: Verify deprecated features still work during deprecation period
- **Build Process**: No breaking changes allowed for deprecated features

### Manual Checks

To search for deprecated API usage:

```bash
# Search for deprecated function calls
npm run lint

# Search codebase for specific deprecated features
grep -r "useRoleSystem" packages/bot/src/
grep -r "@deprecated" packages/bot/src/ --include="*.ts"

# Check for old label usage in workflows
grep -r "labels: bug" .github/workflows/
grep -r "labels: enhancement" .github/workflows/
```

### Usage Metrics

Track deprecation impact:

- Number of internal uses of deprecated APIs
- Number of issues with old labels
- Runtime console warnings frequency

---

## Policy Reference

For full deprecation policy details, see:

- [Deprecation Policy](./deprecation-policy.md)
- [CHANGELOG.md](../../CHANGELOG.md)

---

**Last Updated**: 2025-11-12 (v0.51.0)  
**Maintainer**: Repository Copilot Automation  
**Review Frequency**: Quarterly or per release
