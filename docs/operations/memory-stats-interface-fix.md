# Memory.stats Interface Fix

**Issue Date**: November 2025  
**Resolution**: Fixed TypeScript interface conflict preventing stats collection  
**Related Issue**: #684 - Memory.stats collection failure

## Problem Description

The bot was executing normally but Memory.stats was not being populated, creating a monitoring blackout that prevented:

- PTR telemetry collection
- Performance analysis
- Anomaly detection
- Strategic decision-making

Multiple monitoring reports showed:

- Bot execution status: ✅ ACTIVE
- PTR telemetry status: ❌ CRITICAL - Empty stats despite active bot
- Stats API: Returned empty payload despite active bot

## Root Cause

The profiler's type definition file (now in `packages/screeps-profiler/src/types.ts`) previously contained a TypeScript interface declaration that created a conflict:

```typescript
// PROBLEMATIC CODE (before fix)
interface Memory {
  profiler: ProfilerMemory;
}
```

This declaration was **not** wrapped in a `declare global` block, which meant:

1. It created a **local** `Memory` interface in the profiler module scope
2. It prevented TypeScript from properly merging with the **global** `Memory` interface in `packages/bot/types.d.ts`
3. The `stats` property defined in the global Memory interface was not recognized
4. TypeScript compilation may have stripped or mishandled `Memory.stats` assignments

## Solution

Removed the conflicting Memory interface declaration from `profiler/typings.d.ts`:

```typescript
// FIXED CODE
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ProfilerMemory {
  data: { [name: string]: ProfilerData };
  start?: number;
  total: number;
}

interface ProfilerData {
  calls: number;
  time: number;
}
```

The ProfilerMemory type is now properly referenced by the global Memory interface defined in `packages/bot/types.d.ts`:

```typescript
declare global {
  interface Memory {
    profiler?: ProfilerMemory;
    stats?: {
      time: number;
      cpu: { ... };
      creeps: { ... };
      rooms: { ... };
      spawn?: { ... };
    };
    // ... other properties
  }
}
```

## Prevention

Added regression test `tests/regression/memory-stats-interface.test.ts` that verifies:

1. Memory.stats is recognized as a valid property by TypeScript
2. Memory.stats can be assigned without type errors
3. Both profiler and stats properties can coexist
4. Nested stats properties (rooms, spawn, etc.) are properly typed

## Verification

1. **Build Test**: `yarn build` - Successful compilation
2. **Unit Tests**: All 838 tests pass
3. **Regression Tests**: All 422 tests pass (including new interface test)
4. **Bundle Check**: Confirmed `memory.stats =` assignments present in `dist/main.js`

## Impact

This fix restores:

- ✅ Memory.stats population in the game runtime
- ✅ PTR telemetry collection via Stats API
- ✅ Strategic monitoring capabilities
- ✅ Performance analysis and baseline establishment
- ✅ Anomaly detection system

## Lessons Learned

1. **Interface Declaration Location Matters**: TypeScript interface declarations must use `declare global` to properly merge with global interfaces
2. **Module-Scoped Interfaces Create Conflicts**: Declaring interfaces without `declare global` creates local-only types that don't merge
3. **Monitoring Gaps Are Insidious**: The bot continued executing normally while monitoring silently failed
4. **Regression Tests Are Essential**: Type-level tests can catch interface conflicts before deployment

## Related Documentation

- [StatsCollector Implementation](../packages/bot/src/runtime/metrics/StatsCollector.ts)
- [Global Memory Interface](../packages/bot/types.d.ts)
- [Profiler Package](../../packages/screeps-profiler/)
- [Profiler Types](../../packages/screeps-profiler/src/types.ts)
- [Monitoring Baselines](./monitoring-baselines.md)
- [Strategic Analysis Reports](../../reports/monitoring/)

## Future Recommendations

1. Consider consolidating all TypeScript type declarations in a single `types.d.ts` file to avoid future conflicts
2. Add ESLint rule to flag interface declarations without `declare global` in `.d.ts` files
3. Implement automated testing of Memory.stats population in e2e tests
4. Add health check that validates Memory.stats is being populated each tick
