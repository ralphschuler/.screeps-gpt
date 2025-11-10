---
title: "Release 0.11.3: Critical Runtime Fix - Eliminating Node.js Global Dependencies"
date: 2025-11-06T00:00:00.000Z
categories:
  - Release Notes
  - Bug Fixes
tags:
  - release
  - bug-fix
  - runtime
  - build-system
  - regression-prevention
---

Version 0.11.3 addresses a critical runtime issue that was blocking all bot execution in the Screeps sandbox environment. This release demonstrates the importance of build-time configuration and environment isolation for cross-platform JavaScript deployment.

## The Problem

After a recent code change, the bot bundle began referencing Node.js-specific globals that don't exist in the Screeps runtime environment:

```javascript
ReferenceError: process is not defined
  at main.js:872:22
```

This error occurred because feature flag checks like `process.env.TASK_SYSTEM_ENABLED` were being emitted directly into the bundle. While this works perfectly in Node.js environments (tests, local development), it causes immediate failures in the Screeps sandbox, which doesn't provide the `process` global.

## The Root Cause

The issue stemmed from how environment variables were being checked in the source code:

```typescript
// This pattern works in Node.js but fails in Screeps
if (process.env.TASK_SYSTEM_ENABLED === "true") {
  // Enable experimental task system
}
```

Previously, our esbuild configuration wasn't configured to handle these environment checks at build time, so they leaked into the final bundle as runtime checks. Any deployed code that referenced `process`, `__dirname`, `__filename`, or `require()` would immediately crash in the Screeps environment.

## The Solution

We updated the esbuild configuration in `scripts/buildProject.ts` to replace environment variable references with literal values at build time:

```typescript
// Build configuration now includes:
define: {
  "process.env.TASK_SYSTEM_ENABLED": JSON.stringify(
    process.env.TASK_SYSTEM_ENABLED || "false"
  ),
  "process.env.ROOM_VISUALS_ENABLED": JSON.stringify(
    process.env.ROOM_VISUALS_ENABLED || "false"
  ),
}
```

This approach ensures that:

1. **Build-time Replacement**: Environment checks are resolved during bundling, not at runtime
2. **No Runtime Dependencies**: The final bundle contains no Node.js-specific globals
3. **Safe Defaults**: Variables default to `"false"` if not set during build
4. **Explicit Opt-in**: Features can be enabled by setting environment variables during build: `TASK_SYSTEM_ENABLED=true bun run build`

### Example Transformation

**Before bundling** (source code):

```typescript
if (process.env.TASK_SYSTEM_ENABLED === "true") {
  enableTaskSystem();
}
```

**After bundling** (with `TASK_SYSTEM_ENABLED` not set):

```typescript
if ("false" === "true") {
  enableTaskSystem();
}
```

esbuild's dead code elimination then removes this entire block during minification, resulting in zero runtime overhead for disabled features.

## Technical Deep Dive

### Why Build-Time Over Runtime?

We considered several approaches to solve this problem:

1. **Runtime Environment Detection**: Check for `process` existence before use
   - ❌ Still adds unnecessary code to bundle
   - ❌ Runtime overhead for every check
   - ❌ Doesn't handle build-time optimization opportunities

2. **Conditional Bundling**: Separate bundles for different environments
   - ❌ Complex build matrix
   - ❌ Maintenance burden
   - ❌ Deployment complexity

3. **Build-Time Variable Replacement** (chosen solution)
   - ✅ Zero runtime overhead
   - ✅ Dead code elimination removes disabled features
   - ✅ Single bundle works everywhere
   - ✅ Explicit build-time configuration

The build-time replacement approach provides the best balance of simplicity, performance, and correctness.

### Memory-Based Feature Flags Still Work

Importantly, runtime feature flags stored in memory continue to work perfectly:

```typescript
// This pattern is safe and supported
if (Memory.experimentalFeatures?.taskSystem) {
  enableTaskSystem();
}
```

Memory-based flags are ideal for features that need to be toggled during runtime without redeployment. Build-time flags (via environment variables) are better for features that fundamentally change the bundle structure or should be permanently enabled/disabled for a deployment.

## Regression Prevention

To ensure this type of issue never happens again, we added a comprehensive regression test in `tests/regression/nodejs-globals-bundle.test.ts`:

```typescript
describe("Bundle Node.js Globals Validation", () => {
  it("should not contain Node.js globals", async () => {
    const bundle = await fs.readFile("dist/main.js", "utf-8");

    // Validate no process.env references
    expect(bundle).not.toContain("process.env");
    expect(bundle).not.toMatch(/process\s*\.\s*env/);

    // Validate no other Node.js globals
    expect(bundle).not.toContain("__dirname");
    expect(bundle).not.toContain("__filename");
    expect(bundle).not.toContain("require(");

    // Validate no direct process object access
    expect(bundle).not.toMatch(/process\s*\[/);
  });
});
```

This test runs on every commit and will catch any code that accidentally introduces Node.js dependencies into the bundle.

## Impact

This fix unblocks all bot deployment and restores normal operation. Key improvements:

- ✅ **Immediate Runtime Stability**: Bot executes successfully in Screeps sandbox
- ✅ **Build-Time Optimization**: Dead code elimination removes disabled features entirely
- ✅ **Future-Proof**: Regression test prevents reintroduction of Node.js globals
- ✅ **Zero Performance Impact**: No runtime overhead for environment checks

## Configuration

To enable optional features at build time:

```bash
# Enable task system
TASK_SYSTEM_ENABLED=true bun run build

# Enable room visuals
ROOM_VISUALS_ENABLED=true bun run build

# Enable both
TASK_SYSTEM_ENABLED=true ROOM_VISUALS_ENABLED=true bun run build
```

Features default to disabled (`"false"`) if environment variables aren't set.

## Related Files

- `scripts/buildProject.ts` - Build configuration with environment variable definitions
- `tests/regression/nodejs-globals-bundle.test.ts` - Regression test for bundle purity
- `src/runtime/bootstrap/Kernel.ts` - Uses feature flags for conditional logic

## Lessons Learned

This incident reinforces several important principles:

1. **Cross-Platform JavaScript is Hard**: Code that works in Node.js may not work elsewhere
2. **Build-Time Configuration Matters**: Proper build tooling prevents entire classes of runtime errors
3. **Regression Tests are Essential**: Automated validation catches issues before deployment
4. **Environment Isolation**: Clear separation between build-time and runtime concerns prevents leakage

## What's Next

Future improvements to the build system:

- **Static Analysis**: Additional linting rules to catch Node.js global usage in source code
- **Build Validation**: Pre-deployment checks to validate bundle compatibility
- **Documentation**: Guidelines for safe feature flag patterns in cross-platform code

---

**Full Changelog**: [0.11.3 on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v0.11.3)
