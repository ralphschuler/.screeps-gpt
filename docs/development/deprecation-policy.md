# Deprecation Policy and Code Lifecycle Management

This document defines the deprecation strategy and code lifecycle management system for the `.screeps-gpt` repository. It provides guidelines for marking code as deprecated, tracking deprecations, and safely removing obsolete features.

## Table of Contents

- [Overview](#overview)
- [Deprecation Lifecycle](#deprecation-lifecycle)
- [Deprecation Criteria](#deprecation-criteria)
- [Annotation Standards](#annotation-standards)
- [Tracking and Registry](#tracking-and-registry)
- [Communication Guidelines](#communication-guidelines)
- [Removal Process](#removal-process)
- [Backward Compatibility](#backward-compatibility)
- [Examples](#examples)

## Overview

**Purpose**: Provide a systematic approach to managing deprecated code, technical debt, and feature lifecycle to maintain code quality and clear upgrade paths.

**Benefits**:

- Reduced technical debt accumulation
- Clear migration paths for developers
- Improved code maintainability
- Better developer experience
- Systematic feature evolution

**Scope**: This policy applies to:

- Public and internal TypeScript/JavaScript APIs
- Configuration formats and schemas
- CLI commands and automation workflows
- Documentation structure and conventions
- Label systems and repository metadata

## Deprecation Lifecycle

### Phase 1: Announcement (Version N)

**Actions**:

- Mark code with `@deprecated` JSDoc tag
- Add deprecation notice to CHANGELOG under `### Deprecated` section
- Document replacement or migration path
- Set target removal version (typically N+3 for minor versions, N+1 for major versions)
- Add ESLint warnings for deprecated API usage

**Duration**: Minimum 2 release cycles for minor versions, 1 major version bump

**Example Timeline**:

- Deprecated in v0.50.0 → Earliest removal in v0.53.0 (3 minor versions)
- Deprecated in v0.x.x → Earliest removal in v1.0.0 (major version)

### Phase 2: Warning Period (Versions N+1 to N+2)

**Actions**:

- Maintain full backward compatibility
- Add runtime console warnings when deprecated features are used
- Promote migration guides in documentation
- Update examples to use new patterns
- Monitor usage via CI checks

**Requirements**:

- All deprecated features must remain fully functional
- No breaking changes to deprecated APIs
- Migration guides must be available and tested
- Automated tests must continue to pass

### Phase 3: Removal (Version N+3 or major version)

**Actions**:

- Remove deprecated code after warning period
- Add removal notice to CHANGELOG under `### Removed` section
- Update documentation to remove deprecated references
- Add migration notes for users still on old versions
- Run full regression test suite

**Safety Checks**:

- Verify no internal usage of deprecated features
- Ensure replacement features are fully functional
- Validate migration guides are accurate
- Check for any downstream dependencies

## Deprecation Criteria

Code should be marked for deprecation when:

1. **Better Alternative Exists**: A superior implementation or pattern is available
2. **Technical Debt**: Code is difficult to maintain or understand
3. **Security Concerns**: Feature has security implications
4. **Performance Issues**: Significant performance penalties
5. **Standards Violation**: Doesn't follow current coding standards
6. **Feature Evolution**: Natural progression of feature capabilities
7. **Unused or Rarely Used**: Low usage metrics justify removal

## Annotation Standards

### JSDoc @deprecated Tag

All deprecated TypeScript/JavaScript code must use the `@deprecated` JSDoc tag with:

1. **Reason**: Why the code is deprecated
2. **Alternative**: What to use instead
3. **Removal Version**: When it will be removed
4. **Migration Link**: Reference to detailed migration guide (if applicable)

**Template**:

```typescript
/**
 * @deprecated Since vX.Y.Z - [Reason for deprecation]
 * Use [Alternative] instead.
 * Will be removed in vX.Y.Z.
 * @see [Migration Guide Link]
 */
```

**Example**:

```typescript
/**
 * @deprecated Since v0.50.0 - Role-based system is being replaced by task management system.
 * Use TaskManager with task-based behavior instead.
 * Will be removed in v1.0.0.
 * @see docs/runtime/strategy/enabling-task-system.md
 */
export function executeRoleBasedBehavior(creep: Creep): void {
  console.warn("[DEPRECATED] executeRoleBasedBehavior is deprecated. Migrate to TaskManager.");
  // ... existing implementation
}
```

### Configuration and Labels

For non-code deprecations (labels, configs, etc.):

```yaml
# Example: Deprecated GitHub label
- name: bug
  color: D73A4A
  description: "[DEPRECATED] Use type/bug instead. Will be removed in v1.0.0."
```

### Environment Variables and Constants

```typescript
/**
 * @deprecated Since v0.45.0 - Use USE_TASK_SYSTEM environment variable instead.
 * Will be removed in v1.0.0.
 */
export const ENABLE_ROLE_SYSTEM = process.env.ENABLE_ROLE_SYSTEM === "true";
```

## Tracking and Registry

### Deprecation Registry

All deprecations are tracked in `docs/development/deprecation-registry.md` with:

- Feature/API name
- Deprecation version
- Target removal version
- Replacement/alternative
- Migration guide link
- Current usage status

### CHANGELOG Integration

**Format**:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Deprecated

- **[Feature Name]**: [Brief description of what's deprecated and why]
  - Alternative: [What to use instead]
  - Removal: [Target version]
  - Migration: [Link to migration guide]

### Removed

- **[Feature Name]**: [What was removed and why]
  - Migration: [Link to migration guide for users on older versions]
```

**Example**:

```markdown
## [0.50.0] - 2025-11-12

### Deprecated

- **Role-based Behavior System**: The legacy role-based system is deprecated in favor of the task management system
  - Alternative: Use `TaskManager` with task-based behavior patterns
  - Removal: v1.0.0
  - Migration: See docs/runtime/strategy/enabling-task-system.md
```

## Communication Guidelines

### User Communication

**Deprecation Notice (in CHANGELOG)**:

- Clear explanation of what's deprecated
- Reason for deprecation
- Migration path with examples
- Timeline for removal

**Runtime Warnings**:

```typescript
console.warn(
  `[DEPRECATED] ${featureName} is deprecated since v${version}. Use ${alternative} instead. Will be removed in v${removalVersion}.`
);
```

**Documentation Updates**:

- Add deprecation warnings to affected documentation pages
- Create or update migration guides
- Update examples to show new patterns
- Add notices to README if widely used

### Developer Communication

**Pull Request Template**:

- Include deprecation checklist for code changes
- Require ESLint deprecation checks to pass
- Link to deprecation policy

**Code Review Guidelines**:

- Verify deprecation annotations are correct
- Ensure alternatives are documented
- Check migration guides are complete
- Validate timeline is reasonable

## Removal Process

### Pre-Removal Checklist

Before removing deprecated code:

- [ ] Minimum deprecation period has passed (2+ release cycles)
- [ ] No internal usage of deprecated features (run `npm run lint` with deprecation rules)
- [ ] Migration guides are complete and tested
- [ ] Replacement features are fully functional and tested
- [ ] CHANGELOG removal notice is prepared
- [ ] Regression tests are updated or added
- [ ] Documentation is updated to remove references
- [ ] Rollback plan is documented

### Removal Steps

1. **Verify Usage**:

   ```bash
   # Search for deprecated API usage
   npm run lint
   grep -r "deprecatedFunction" packages/ src/
   ```

2. **Update Tests**:
   - Remove tests for deprecated features
   - Add tests for migration paths
   - Run full regression suite

3. **Remove Code**:
   - Delete deprecated implementations
   - Remove related documentation
   - Update imports and references

4. **Update CHANGELOG**:
   - Add removal notice under `### Removed`
   - Reference migration guide for users on older versions

5. **Validate**:
   ```bash
   npm run lint
   npm run build
   npm run test
   ```

### Rollback Procedures

If removal causes unexpected issues:

1. **Immediate**: Revert the removal commit
2. **Short-term**: Re-add deprecation warnings and extend timeline
3. **Long-term**: Investigate root cause and improve migration guide
4. **Communication**: Notify users via CHANGELOG and GitHub issue

## Backward Compatibility

### During Deprecation Period

**Requirements**:

- All deprecated features must remain fully functional
- No breaking changes to deprecated APIs
- Maintain test coverage for deprecated code
- Support both old and new patterns simultaneously

**Example - Dual Support**:

```typescript
export class BehaviorController {
  public execute(game: GameContext, memory: Memory, options: BehaviorOptions = {}): BehaviorSummary {
    // Support both role-based (deprecated) and task-based systems
    if (options.useRoleSystem === true) {
      console.warn("[DEPRECATED] Role system is deprecated. Use task system instead.");
      return this.executeRoleBasedBehavior(game, memory);
    }
    return this.executeTaskBasedBehavior(game, memory);
  }
}
```

### Version Compatibility Matrix

| Feature                          | v0.50.0      | v0.51.0   | v0.52.0   | v1.0.0    |
| -------------------------------- | ------------ | --------- | --------- | --------- |
| Role System (deprecated v0.50.0) | ✓ Deprecated | ✓ Warning | ✓ Warning | ✗ Removed |
| Task System                      | ✓ Supported  | ✓ Default | ✓ Default | ✓ Only    |

## Examples

### Example 1: Deprecated Function

```typescript
/**
 * @deprecated Since v0.48.0 - Use spawn() from SpawnManager instead.
 * This function will be removed in v0.51.0.
 * @see docs/runtime/operations/spawn-management.md
 */
export function legacySpawnCreep(spawn: StructureSpawn, body: BodyPartConstant[], name: string): number {
  console.warn("[DEPRECATED] legacySpawnCreep is deprecated. Use SpawnManager.spawn() instead.");
  return spawn.spawnCreep(body, name);
}
```

### Example 2: Deprecated Configuration

```typescript
interface ConfigOptions {
  /**
   * @deprecated Since v0.47.0 - Use `taskSystemEnabled` instead.
   * Will be removed in v0.50.0.
   */
  useRoles?: boolean;

  /**
   * Enable task-based behavior system (replaces role-based system)
   * @default true
   */
  taskSystemEnabled?: boolean;
}
```

### Example 3: Deprecated Label Migration

**Current State** (`.github/labels.yml`):

```yaml
# Legacy Labels - Kept for backward compatibility, will be migrated
- name: bug
  color: D73A4A
  description: "[DEPRECATED] Use type/bug instead. Confirmed defects that require fixes."
```

**Migration Timeline**:

- v0.47.0: Mark labels as deprecated in descriptions
- v0.48.0-v0.50.0: Automated workflows update old labels to new labels
- v0.51.0: Remove old labels from `.github/labels.yml`

### Example 4: Deprecated Workflow Parameter

```yaml
# .github/workflows/deploy.yml
name: Deploy to Screeps

on:
  workflow_dispatch:
    inputs:
      use_profiler:
        description: "[DEPRECATED] Use profiler_enabled instead. Will be removed in v1.0.0."
        type: boolean
        required: false
        default: false
      profiler_enabled:
        description: "Enable performance profiling"
        type: boolean
        required: false
        default: true
```

## Related Documentation

- [Deprecation Registry](./deprecation-registry.md) - Track all active deprecations
- [Migration Guides](../runtime/strategy/) - Detailed migration documentation
- [CHANGELOG.md](../../CHANGELOG.md) - Release notes with deprecation notices
- [Contributing Guide](../../CONTRIBUTING.md) - How to properly deprecate code

## Policy Updates

This deprecation policy is a living document. Updates require:

- PR review and approval
- Discussion in GitHub issues
- Documentation of rationale
- Update to CHANGELOG

**Last Updated**: 2025-11-12 (v0.51.0)
