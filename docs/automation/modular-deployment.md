# Modular Deployment Architecture

This document describes the modular deployment system that allows deploying Screeps AI code as multiple separate modules instead of a single bundle.

## Overview

The modular deployment architecture provides flexibility in how the Screeps AI is built and deployed:

- **Single Bundle Mode (Default)**: Traditional approach where all code is bundled into `dist/main.js`
- **Modular Mode**: Separate modules for each runtime component (behavior, memory, metrics, etc.)

Both modes maintain full compatibility with the Screeps platform and produce identical runtime behavior.

## Benefits

### Development Workflow

- **Selective Testing**: Test individual modules in isolation
- **Faster Iteration**: Rebuild only changed modules during development
- **Better Debugging**: Identify which module contains problematic code
- **Clearer Architecture**: Module boundaries are preserved in deployment

### Performance Analysis

- **Module-level Profiling**: Analyze CPU usage per module
- **Memory Optimization**: Understand memory consumption by module
- **Incremental Loading**: Potential for selective module loading (future enhancement)

### Troubleshooting

- **Isolated Issues**: Pin down problems to specific modules
- **Targeted Fixes**: Update only the affected module
- **Better Error Messages**: Stack traces reference specific module files

## Usage

### Single Bundle Mode (Default)

No configuration needed. Works exactly as before:

```bash
bun run build    # Produces dist/main.js
bun run deploy   # Deploys single main module
```

### Modular Mode

Set the `MODULAR_BUILD` environment variable:

```bash
MODULAR_BUILD=true bun run build    # Produces multiple module files
MODULAR_BUILD=true bun run deploy   # Deploys all modules
```

Or set it in your environment:

```bash
export MODULAR_BUILD=true
bun run build
bun run deploy
```

## Module Structure

When building in modular mode, the following modules are generated:

| Module          | Source                    | Description                        |
| --------------- | ------------------------- | ---------------------------------- |
| `main.js`       | `src/main.ts`             | Entry point with loop() function   |
| `behavior.js`   | `src/runtime/behavior/`   | Creep roles and spawn logic        |
| `bootstrap.js`  | `src/runtime/bootstrap/`  | Kernel orchestration               |
| `evaluation.js` | `src/runtime/evaluation/` | Health reports and recommendations |
| `memory.js`     | `src/runtime/memory/`     | Memory consistency helpers         |
| `metrics.js`    | `src/runtime/metrics/`    | CPU tracking and performance       |
| `respawn.js`    | `src/runtime/respawn/`    | Automatic respawn detection        |
| `types.js`      | `src/runtime/types/`      | Type definitions                   |

Each module is self-contained and includes all its dependencies bundled.

## Build System Implementation

### File Discovery

The build system automatically discovers modules in `src/runtime/`:

1. Checks for `index.ts` in each subdirectory
2. Falls back to single `.ts` file if no index exists
3. Creates one output module per runtime subdirectory

### Bundle Configuration

Both modes use esbuild with these settings:

- **Platform**: Browser (Screeps environment)
- **Target**: ES2021
- **Format**: CommonJS (required by Screeps)
- **Sourcemaps**: Generated for all modules

Single bundle mode bundles everything into one file, while modular mode creates separate bundles for each module.

## Deployment Implementation

### Module Upload

The deployment script (`scripts/deploy.ts`):

1. Scans `dist/` directory for all `.js` files
2. Reads each module's content
3. Validates that `main.js` exists
4. Uploads all modules to Screeps API

Example output:

```
Reading compiled bot code from /path/to/dist...
  ✓ Loaded behavior (7396 bytes)
  ✓ Loaded bootstrap (19715 bytes)
  ✓ Loaded evaluation (6179 bytes)
  ✓ Loaded main (20026 bytes)
  ✓ Loaded memory (2114 bytes)
  ✓ Loaded metrics (2710 bytes)
  ✓ Loaded respawn (3549 bytes)
  ✓ Loaded types (824 bytes)
✓ Build output loaded: 8 module(s), 62513 bytes total
Uploading code to screeps.com:443/ on branch "main"...
✓ Successfully deployed to branch main
  • behavior: 7396 bytes
  • bootstrap: 19715 bytes
  • evaluation: 6179 bytes
  • main: 20026 bytes
  • memory: 2114 bytes
  • metrics: 2710 bytes
  • respawn: 3549 bytes
  • types: 824 bytes
```

### API Format

Modules are uploaded using the Screeps API format:

```javascript
api.code.set(branch, {
  main: "...",
  behavior: "...",
  memory: "..."
  // ... other modules
});
```

This is the same format used in single bundle mode, just with multiple keys instead of one.

## CI/CD Integration

### GitHub Actions Workflows

To use modular deployment in workflows, set the environment variable:

```yaml
- name: Deploy with modular build
  run: bun run deploy
  env:
    MODULAR_BUILD: "true"
    SCREEPS_TOKEN: ${{ secrets.SCREEPS_TOKEN }}
```

### Quality Gate

The quality gate workflows work with both modes:

- Linting: Works on source files (no difference)
- Testing: Tests work with both build modes
- Coverage: Measures source coverage (no difference)

### Caching Strategy

Build output caching is based on source file hashes:

```yaml
- name: Cache build output
  uses: actions/cache@v4
  with:
    path: dist/
    key: build-${{ hashFiles('src/**/*') }}-${{ env.MODULAR_BUILD }}
```

The cache key includes `MODULAR_BUILD` to avoid mixing single and modular outputs.

## Testing

### Unit Tests

Tests work with both build modes since they test the source code directly.

### Regression Tests

Two regression test suites validate the modular system:

1. **`modular-build.test.ts`**: Validates build output structure
   - Default mode produces single `main.js`
   - Modular mode produces multiple module files
   - Sourcemaps are generated for all modules

2. **`modular-deploy.test.ts`**: Validates deployment format
   - Modules are formatted as object (not array)
   - Main module is always present
   - All module code is non-empty

Run regression tests:

```bash
bun run test:regression
```

## Backward Compatibility

The modular system is fully backward compatible:

- **Default behavior unchanged**: Without `MODULAR_BUILD`, works exactly as before
- **Same npm commands**: `bun run build` and `bun run deploy` work unchanged
- **Same runtime behavior**: Both modes produce identical AI behavior in Screeps
- **Existing workflows**: No changes needed to deployment workflows
- **Secrets and configuration**: All existing settings work as-is

## Performance Considerations

### Build Time

- Single bundle: ~4-5ms
- Modular build: ~10-15ms (builds multiple bundles)

The modular build is slightly slower but still very fast for typical development workflows.

### Deployment Size

Modular deployment sends more data but offers better debugging:

- Single bundle: ~20KB total
- Modular deployment: ~62KB total (includes redundant dependencies)

The Screeps platform handles both efficiently.

### Runtime Performance

**No difference in CPU usage**. Both modes produce semantically identical code that runs at the same speed in Screeps.

## Troubleshooting

### Build Fails in Modular Mode

**Problem**: `MODULAR_BUILD=true bun run build` fails

**Solutions**:

- Check that `src/runtime/` subdirectories have valid TypeScript files
- Ensure all modules have proper exports
- Verify no circular dependencies exist

### Deployment Shows Only main.js

**Problem**: Deployment only uploads one module despite building multiple files

**Solutions**:

- Ensure `MODULAR_BUILD` is set when running `bun run deploy`
- Check that `dist/` contains multiple `.js` files after build
- Verify build completed successfully before deployment

### Missing Modules in Screeps

**Problem**: Some modules don't appear in Screeps console

**Solutions**:

- Check deployment logs for all uploaded modules
- Verify API response indicates success
- Refresh the Screeps console/editor

## Future Enhancements

Potential improvements to the modular system:

1. **Selective Loading**: Load only needed modules based on game state
2. **Hot Reloading**: Update individual modules without full restart
3. **Module Versioning**: Track versions per module for partial updates
4. **Dependency Optimization**: Share common dependencies between modules
5. **Module Registry**: Catalog available modules and their capabilities

## Related Documentation

- [Automation Overview](./overview.md) - Overall workflow architecture
- [Deployment Troubleshooting](../operations/deployment-troubleshooting.md) - Common deployment issues
- [Build System](../../README.md#build-system) - Build command reference

## Related Issues

- [#158](https://github.com/ralphschuler/.screeps-gpt/issues/158) - Implementation of modular deployment architecture
- [#105](https://github.com/ralphschuler/.screeps-gpt/issues/105) - Build system improvements
- [#124](https://github.com/ralphschuler/.screeps-gpt/issues/124) - Critical build system failures
