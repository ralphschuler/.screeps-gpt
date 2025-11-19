# Screeps-Kernel Integration Summary

## Overview

This document describes the integration of the `@ralphschuler/screeps-kernel` package into the `packages/bot` codebase. The screeps-kernel provides a decorator-based process management system for organizing and scheduling bot logic.

## Changes Made

### 1. Main Entry Point (`packages/bot/src/main.ts`)

**Before:**

- Used custom `createKernel()` factory from `@runtime/bootstrap`
- Directly instantiated `BehaviorController` and configured task system
- Manually wired all dependencies

**After:**

- Imports `Kernel` class from `@ralphschuler/screeps-kernel`
- Imports process modules to trigger `@process` decorator registration
- Creates kernel instance with minimal configuration (logger and CPU threshold)
- All process orchestration is handled by screeps-kernel

```typescript
import { Kernel } from "@ralphschuler/screeps-kernel";
import "@runtime/processes"; // Triggers @process decorator registration

const kernel = new Kernel({
  logger: console,
  cpuEmergencyThreshold: 0.9
});
```

### 2. MainProcess Wrapper (`packages/bot/src/runtime/processes/MainProcess.ts`)

**New file** that bridges the screeps-kernel process system with the existing bot architecture:

```typescript
@process({ name: "MainProcess", priority: 50, singleton: true })
export class MainProcess {
  private readonly kernel: LegacyKernel;

  public run(ctx: ProcessContext<Memory>): void {
    const gameContext = ctx.game as GameContext;
    this.kernel.run(gameContext, ctx.memory);
  }
}
```

**Key features:**

- Uses `@process` decorator for automatic registration with screeps-kernel
- Wraps the existing `Kernel` (renamed to `LegacyKernel` in imports)
- Maintains all existing functionality without breaking changes
- Singleton pattern ensures one instance across all ticks
- Priority: 50 (standard execution priority)

### 3. Process Module Index (`packages/bot/src/runtime/processes/index.ts`)

**New file** that exports all processes for registration:

```typescript
export { MainProcess } from "./MainProcess";
```

This file is imported by `main.ts` to trigger the `@process` decorator execution, which registers processes with the screeps-kernel `ProcessRegistry`.

### 4. Screeps-Profiler Fixes (`packages/screeps-profiler/src/Profiler.ts`)

Fixed TypeScript compilation errors related to `Memory.profiler` possibly being undefined:

- Added null checks for `Memory.profiler` in `start()` and `stop()` methods
- Added filter to remove null entries from profiler data array
- Improved type safety throughout the profiler implementation

## Architecture

### Process Execution Flow

1. **Module Load Time:**
   - `main.ts` imports `@runtime/processes`
   - `@process` decorators execute, registering `MainProcess` with `ProcessRegistry`
   - `Kernel` instance is created with configuration

2. **Each Tick:**
   - `loop()` function is called by Screeps engine
   - `kernel.run(Game, Memory)` is invoked
   - Kernel retrieves all registered processes from `ProcessRegistry`
   - Processes are sorted by priority (highest first)
   - Each process's `run()` method is called with `ProcessContext`
   - `MainProcess.run()` executes, which runs the legacy Kernel
   - CPU budget protection prevents timeout

### Component Hierarchy

```
Screeps Engine
  └─ loop() in main.ts
      └─ screeps-kernel.Kernel
          └─ MainProcess (@process decorator)
              └─ LegacyKernel (existing bot logic)
                  ├─ MemoryManager
                  ├─ BehaviorController
                  ├─ InfrastructureManager
                  ├─ DefenseCoordinator
                  └─ ... (all existing components)
```

## Benefits

### 1. **Modular Process System**

- Future components can be added as separate `@process` decorated classes
- Clear priority-based execution order
- Easy to understand which processes run and when

### 2. **Maintainability**

- Separation of concerns between process scheduling (screeps-kernel) and bot logic (existing code)
- Minimal changes to existing codebase
- All 783 unit tests continue to pass

### 3. **CPU Budget Protection**

- screeps-kernel provides built-in CPU threshold monitoring
- Processes are skipped if CPU limit is approaching
- Prevents script timeout errors

### 4. **Consistency**

- Uses the same screeps-kernel package as other parts of the codebase
- Standardizes process management across the repository

## Future Enhancements

The current implementation maintains backward compatibility by wrapping the entire existing bot logic in `MainProcess`. Future improvements could include:

### 1. **Break Down MainProcess**

Convert individual managers to separate processes:

```typescript
@process({ name: "MemoryManager", priority: 100, singleton: true })
export class MemoryManagerProcess { ... }

@process({ name: "BehaviorController", priority: 50, singleton: true })
export class BehaviorProcess { ... }

@process({ name: "DefenseCoordinator", priority: 75, singleton: true })
export class DefenseProcess { ... }
```

### 2. **Inter-Process Communication**

Use Memory or a shared context object to pass data between processes:

```typescript
// In MemoryManagerProcess
ctx.memory.roleCounts = this.updateRoleBookkeeping();

// In BehaviorProcess
const roleCounts = ctx.memory.roleCounts;
```

### 3. **Conditional Process Execution**

Add logic to skip processes based on game state:

```typescript
@process({ name: "ExpansionManager", priority: 25, singleton: true })
export class ExpansionProcess {
  public run(ctx: ProcessContext<Memory>): void {
    // Only run if we have multiple rooms
    if (Object.keys(ctx.game.rooms).length < 2) return;
    // ... expansion logic
  }
}
```

## Testing

All existing tests continue to pass:

- **783 unit tests pass** without modification
- Build succeeds with proper bundle size (938.1kb)
- ESLint checks pass for all changed files

## Migration Notes

No migration needed for existing code. The integration is backward compatible:

- All existing functionality is preserved
- No changes to Memory structure
- No changes to creep behavior
- No changes to infrastructure management

## Related Packages

This integration uses the following screeps packages:

- **@ralphschuler/screeps-kernel** - Process management and scheduling
- **@ralphschuler/screeps-profiler** - Performance profiling (existing)
- **@ralphschuler/screeps-logger** - Structured logging (existing)
- **@ralphschuler/screeps-cache** - Available but not yet used
- **@ralphschuler/screeps-perf** - Available but not yet used

## References

- Screeps-kernel README: `packages/screeps-kernel/README.md`
- Process decorator API: `packages/screeps-kernel/src/decorators.ts`
- Kernel implementation: `packages/screeps-kernel/src/Kernel.ts`
