# Test Infrastructure Guide

This document describes the test infrastructure setup for the .screeps-gpt project, including common patterns, requirements, and troubleshooting.

## Overview

The project uses **Vitest** as the test runner with three main test categories:

- **Unit Tests** (`tests/unit/`) - Fast, isolated tests for individual components
- **E2E Tests** (`tests/e2e/`) - End-to-end tests using the full Kernel with all processes
- **Regression Tests** (`tests/regression/`) - Tests to prevent known bugs from reoccurring

## Test Infrastructure Architecture

### Kernel and Process Registration

The project uses a **decorator-based process registration system** via `@ralphschuler/screeps-kernel`. Processes are registered using the `@process` decorator, which runs when the module is imported.

**Critical Requirement:** Tests that use the Kernel **must import the processes module** to trigger registration:

```typescript
import { Kernel } from "@ralphschuler/screeps-kernel";
import "@runtime/processes"; // ⚠️ REQUIRED for process registration

describe("My Kernel Test", () => {
  it("should execute processes", () => {
    const kernel = new Kernel({ logger: console });
    const game = createMockGame();
    const memory = {} as Memory;

    kernel.run(game, memory);

    // Processes will now be registered and executed
  });
});
```

**Why?** The `@process` decorator is executed when the module is imported. Without importing `@runtime/processes`, no processes are registered with the Kernel, resulting in:

- No spawning behavior
- No stats collection
- No respawn detection
- Empty `memory.stats`, `memory.respawn`, etc.

### Memory Initialization

#### Production Behavior

In production (`packages/bot/src/main.ts`), Memory.stats is initialized defensively before the kernel runs:

```typescript
Memory.stats ??= {
  time: 0,
  cpu: { used: 0, limit: 0, bucket: 0 },
  creeps: { count: 0 },
  rooms: { count: 0 }
};
```

#### Test Behavior

Tests should initialize Memory.stats the same way if they expect stats to always be present:

```typescript
beforeEach(() => {
  memory = {} as Memory;

  // Defensive initialization (matches main.ts)
  memory.stats = {
    time: 0,
    cpu: { used: 0, limit: 0, bucket: 0 },
    creeps: { count: 0 },
    rooms: { count: 0 }
  };
});
```

**Why?** When CPU threshold is exceeded, MetricsProcess (priority 10 - lowest) may be skipped, so stats won't be updated. The defensive initialization ensures the structure always exists.

### Process Execution Order

Processes are executed in priority order (higher priority = earlier execution):

| Priority | Process               | Purpose                         |
| -------- | --------------------- | ------------------------------- |
| 95       | MemoryProcess         | Memory validation and migration |
| 85       | RespawnProcess        | Respawn detection               |
| 80       | BootstrapProcess      | Bootstrap phase management      |
| 70       | InfrastructureProcess | Structure management            |
| 60       | DefenseProcess        | Tower defense                   |
| 50       | BehaviorProcess       | Creep behavior and spawning     |
| 40       | ConstructionProcess   | Construction sites              |
| 30       | ScoutingProcess       | Room exploration                |
| 25       | EmpireProcess         | Multi-room coordination         |
| 20       | VisualsProcess        | Room visuals                    |
| 10       | MetricsProcess        | Stats collection and evaluation |

**Important:** If CPU threshold is exceeded, processes are skipped starting from the lowest priority. This means MetricsProcess may not run in high-CPU scenarios.

## Common Test Patterns

### Creating a Minimal Kernel Test

```typescript
import { describe, it, expect, vi } from "vitest";
import { Kernel } from "@ralphschuler/screeps-kernel";
import type { GameContext } from "@runtime/types/GameContext";

// REQUIRED: Import processes to register them
import "@runtime/processes";

describe("My Test Suite", () => {
  it("should test kernel behavior", () => {
    // Create game context
    const game: GameContext = {
      time: 1000,
      cpu: {
        getUsed: () => 5.0,
        limit: 100,
        bucket: 9500
      },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    // Initialize memory
    const memory = {} as Memory;

    // Create kernel with logger
    const kernel = new Kernel({
      logger: { log: vi.fn(), warn: vi.fn() }
    });

    // Run kernel
    kernel.run(game, memory);

    // Assert results
    expect(memory.stats).toBeDefined();
  });
});
```

### Mocking Spawns

```typescript
const spawnCreep = vi.fn(() => OK);
const spawn = {
  name: "Spawn1",
  spawning: null,
  spawnCreep,
  store: {
    getFreeCapacity: () => 300,
    getUsedCapacity: () => 0
  },
  room: mockRoom
} as unknown as StructureSpawn;

const game: GameContext = {
  // ... other fields
  spawns: { Spawn1: spawn }
};

// After kernel.run()
expect(spawnCreep).toHaveBeenCalled();
```

### Mocking Creeps

```typescript
function createCreep(role: string, room: RoomLike): CreepLike {
  return {
    name: `${role}-${Math.random().toString(16).slice(2)}`,
    memory: { role },
    room,
    store: {
      getFreeCapacity: vi.fn(() => 0),
      getUsedCapacity: vi.fn(() => 50)
    },
    pos: {
      findClosestByPath: vi.fn(objects => objects[0] ?? null)
    },
    harvest: vi.fn(() => OK),
    transfer: vi.fn(() => OK),
    moveTo: vi.fn(() => OK),
    upgradeController: vi.fn(() => OK),
    withdraw: vi.fn(() => OK),
    build: vi.fn(() => OK),
    repair: vi.fn(() => OK)
  };
}
```

## Troubleshooting

### Problem: Spawning not working in tests

**Symptoms:**

- `expect(spawnCreep).toHaveBeenCalled()` fails
- No creeps being spawned despite proper mocks

**Solution:**
Add `import "@runtime/processes"` to your test file. BehaviorProcess handles spawning and must be registered.

### Problem: Memory.stats is undefined

**Symptoms:**

- `expect(memory.stats).toBeDefined()` fails
- Stats not being collected

**Solutions:**

1. Add `import "@runtime/processes"` to register MetricsProcess
2. Initialize Memory.stats defensively in beforeEach (see Memory Initialization section)
3. Check CPU threshold - if exceeded, MetricsProcess may be skipped

### Problem: Memory.respawn is undefined

**Symptoms:**

- `expect(memory.respawn).toBeDefined()` fails
- Respawn detection not working

**Solution:**
Add `import "@runtime/processes"` to register RespawnProcess.

### Problem: Tests expect log messages that aren't being captured

**Symptoms:**

- `expect(logger.warn).toHaveBeenCalledWith(...)` fails
- Log messages appear in stderr but not captured by mock

**Solution:**
Processes use `console` as their logger (hardcoded), not the kernel's logger. Tests should:

1. Check Memory state instead of log messages, OR
2. Mock `console.log` and `console.warn` globally in test setup

### Problem: Test passes locally but fails in CI

**Possible Causes:**

1. Missing process import
2. Race conditions in async operations
3. Different Node.js versions
4. Memory initialization differences

**Solution:**
Ensure all tests follow the patterns in this document, especially process imports and Memory initialization.

## Best Practices

1. **Always import processes** when using the Kernel in tests
2. **Initialize Memory structures** defensively (match main.ts behavior)
3. **Test Memory state** rather than log messages when possible
4. **Use createCreep/createSpawn helpers** for consistency
5. **Mock only what's necessary** - over-mocking makes tests brittle
6. **Follow existing test patterns** in the codebase
7. **Document test intent** with clear comments

## Running Tests

```bash
# Run all tests
yarn test

# Run only unit tests
yarn test:unit

# Run only e2e tests
yarn test:e2e

# Run only regression tests (Note: some may be failing due to unrelated issues)
yarn vitest run tests/regression/

# Run specific test file
yarn vitest run tests/e2e/behaviorRoles.test.ts

# Run tests in watch mode
yarn vitest watch

# Run tests with coverage
yarn test:coverage
```

## Related Documentation

- [AGENTS.md](../AGENTS.md) - Agent guidelines and automation
- [DOCS.md](../DOCS.md) - Developer guide
- [README.md](../README.md) - Project overview
- [vitest.config.ts](../vitest.config.ts) - Test configuration
- [tests/setup.ts](./setup.ts) - Global test setup

## Further Reading

- [Vitest Documentation](https://vitest.dev/)
- [screeps-kernel Documentation](../packages/screeps-kernel/README.md)
- [Screeps API Documentation](https://docs.screeps.com/api/)
