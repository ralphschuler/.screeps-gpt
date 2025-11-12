# Migration Guide Template

Use this template when creating migration guides for deprecated features.

---

# Migration Guide: [Feature Name]

**Deprecation Version**: vX.Y.Z  
**Removal Version**: vX.Y.Z  
**Migration Difficulty**: ⭐ Easy / ⭐⭐ Moderate / ⭐⭐⭐ Complex

## Overview

Brief description of what's being deprecated and why.

**What's Deprecated**:

- List of deprecated features, functions, or patterns

**What's New**:

- List of replacement features or recommended patterns

**Why the Change**:

- Technical reasons (performance, maintainability, etc.)
- Strategic reasons (better architecture, clearer patterns, etc.)

## Quick Start

For users who want the fastest migration path:

```typescript
// Before (deprecated)
const result = deprecatedFunction(arg1, arg2);

// After (recommended)
const result = newFunction(arg1, arg2);
```

## Detailed Migration Steps

### Step 1: [First Change]

**What to change**:

- Specific code or configuration to modify

**Example**:

```typescript
// Before
// ... old code

// After
// ... new code
```

**Impact**: Low / Medium / High

### Step 2: [Second Change]

**What to change**:

- Next modification needed

**Example**:

```typescript
// Before
// ... old code

// After
// ... new code
```

**Impact**: Low / Medium / High

### Step 3: [Continue as needed]

...

## Complete Example

### Before (Full Example)

```typescript
// Complete working example using deprecated features
export class OldImplementation {
  public execute(): void {
    // ... full old implementation
  }
}
```

### After (Full Example)

```typescript
// Complete working example using new features
export class NewImplementation {
  public execute(): void {
    // ... full new implementation
  }
}
```

## Breaking Changes

List any breaking changes between old and new implementations:

1. **Change 1**: Description of what changed and impact
2. **Change 2**: Description of what changed and impact
3. **Change 3**: Description of what changed and impact

## Compatibility

### During Migration

During the deprecation period, both old and new patterns are supported:

```typescript
// You can use either pattern
const result1 = deprecatedFunction(arg); // Still works, with warning
const result2 = newFunction(arg); // Recommended
```

### After Removal

After vX.Y.Z, only the new pattern will work:

```typescript
const result = newFunction(arg); // Only this works
```

## Testing Your Migration

### Unit Tests

Example test to validate migration:

```typescript
import { describe, it, expect } from "vitest";

describe("Migration to new feature", () => {
  it("should work with new implementation", () => {
    const result = newFunction("test");
    expect(result).toBeDefined();
    // ... more assertions
  });
});
```

### Integration Testing

Steps to verify the migration works in your environment:

1. Run build: `npm run build`
2. Run tests: `npm run test`
3. Check for warnings: `npm run lint`
4. Deploy to PTR: `npm run deploy`
5. Verify functionality in-game

## Common Issues

### Issue 1: [Problem Description]

**Symptom**: What you might see or encounter

**Solution**:

```typescript
// Fix code example
```

**Reference**: Link to related documentation or GitHub issue

### Issue 2: [Problem Description]

**Symptom**: What you might see or encounter

**Solution**:

```typescript
// Fix code example
```

**Reference**: Link to related documentation or GitHub issue

## Performance Comparison

| Metric          | Old Implementation | New Implementation | Improvement |
| --------------- | ------------------ | ------------------ | ----------- |
| CPU Usage       | X ms/tick          | Y ms/tick          | Z% faster   |
| Memory Usage    | X KB               | Y KB               | Z% less     |
| Code Complexity | X lines            | Y lines            | Z% simpler  |

## FAQ

### Q: Do I need to migrate immediately?

A: No, the deprecated feature will remain functional until vX.Y.Z. However, migrating earlier will help you benefit from improvements and avoid rushing when removal approaches.

### Q: What if I encounter issues during migration?

A: [Instructions for getting help - GitHub issues, Discord, etc.]

### Q: Can I continue using the old implementation?

A: Yes, until vX.Y.Z. After that, you must migrate to the new implementation.

### Q: Will my saved games/memory be affected?

A: [Specific answer about data compatibility]

## Additional Resources

- [Related Documentation](../link-to-docs.md)
- [API Reference](../link-to-api.md)
- [GitHub Issue](https://github.com/owner/repo/issues/123)
- [Example Implementation](../link-to-example.md)

## Rollback Procedure

If you need to temporarily revert to the old implementation:

```typescript
// Rollback code example
```

**Note**: This is only a temporary solution. Plan your migration to the new implementation.

## Need Help?

- **Documentation**: [Link to docs]
- **GitHub Issues**: [Link to issues]
- **Community**: [Link to Discord/forum]
- **Direct Support**: [Contact method]

---

**Last Updated**: YYYY-MM-DD  
**Maintainer**: [Name or team]  
**Related Deprecation**: See [Deprecation Registry](./deprecation-registry.md)
