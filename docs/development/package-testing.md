# Package-Specific Testing

## Overview

The repository now supports package-specific testing in this monorepo. Tests have been moved from the root `tests/` directory into their respective package directories, and the pre-commit hook intelligently runs only tests for packages with changes.

## Test Organization

### Package Test Locations

- **Bot tests**: `packages/bot/tests/unit/` - 60 tests for runtime, behavior, AI, and profiler
- **Utilities tests**: `packages/utilities/tests/unit/` - 22 tests for build scripts and utilities
- **Docs tests**: `packages/docs/tests/unit/` - 1 test for documentation site build
- **Logger tests**: `packages/screeps-logger/tests/unit/` - 1 test for logger functionality
- **Root tests**: `tests/unit/` - 1 integration test (bot-snapshots.test.ts)

## Running Tests

**Run all package tests:**

```bash
npm run test:all-packages
```

**Run tests for individual packages:**

```bash
npm run test:bot        # Bot package tests
npm run test:utilities  # Utilities package tests
npm run test:docs       # Docs package tests
npm run test:logger     # Logger package tests
```

## Pre-commit Hook Behavior

The pre-commit hook intelligently detects which packages have changed and runs only their tests:

1. **Package-specific changes**: Runs tests only for the changed packages
2. **Root-level changes**: Runs root-level tests
3. **No relevant changes**: Skips tests

### Example Workflows

**Modify bot code:**

```bash
# Edit packages/bot/src/runtime/behavior/BehaviorController.ts
git commit -m "fix: improve harvester logic"
# → Runs only packages/bot tests
```

**Modify multiple packages:**

```bash
# Edit files in both bot and utilities
git commit -m "refactor: shared utilities"
# → Runs tests for both packages/bot and packages/utilities
```

## Benefits

1. **Faster commits**: Only runs tests for changed code
2. **Better organization**: Tests are colocated with their code
3. **Package independence**: Each package can have its own test configuration
4. **Clearer test failures**: Easier to identify which package has issues

## Implementation

The script `packages/utilities/scripts/detect-changed-packages.ts` detects changed packages by:

- Checking git diff for staged and unstaged files
- Mapping file paths to package directories
- Identifying root-level changes that affect the entire project
