# Memory.stats Defensive Initialization Fix

**Issue Date**: November 2025  
**Resolution**: Added defensive Memory.stats initialization in loop() function  
**Related Issue**: #863 - Memory.stats collection failure causing complete telemetry blackout

## Problem Description

The Screeps Stats API returned a successful response (`{"ok": 1}`) but contained an empty stats payload (`stats: {}`), indicating the bot runtime was not populating `Memory.stats` with performance telemetry. This created complete operational blindness for monitoring and strategic analysis.

Multiple monitoring reports showed:

- Bot execution status: ✅ ACTIVE (confirmed via world-status API)
- PTR telemetry status: ❌ CRITICAL - Empty stats despite active bot
- Stats API: Returned empty payload despite active bot
- Historical pattern: 7th occurrence in 2 weeks

## Root Cause

The `Kernel` constructor initializes `Memory.stats` only once at module load time:

```typescript
// In kernel constructor (packages/bot/src/runtime/bootstrap/kernel.ts lines 113-122)
if (typeof Memory !== "undefined" && !Memory.stats) {
  this.logger.log?.("[Kernel] Initializing Memory.stats structure");
  Memory.stats = {
    time: 0,
    cpu: { used: 0, limit: 0, bucket: 0 },
    creeps: { count: 0 },
    rooms: { count: 0 }
  };
}
```

However, the kernel is created in `main.ts` at module scope (line 19):

```typescript
const kernel = createKernel({...}); // Created at module load time
```

**The Problem**: In the Screeps environment:

1. The kernel instance is created once at module load time
2. The constructor-level initialization runs once when the kernel is instantiated
3. Memory may be reset or cleared by the Screeps server between script loads
4. The kernel instance persists across Memory resets (module scope)
5. The constructor won't run again after Memory resets
6. Result: `Memory.stats` remains undefined, causing telemetry blackout

This is a timing issue where:

- **Module load time**: Kernel constructor runs → initializes Memory.stats
- **Between loads**: Screeps server resets Memory → Memory.stats becomes undefined
- **Next tick**: loop() runs → kernel.run() tries to write to undefined Memory.stats
- **Result**: StatsCollector writes to undefined object → no stats persisted

## Solution

Add defensive initialization in the `loop()` function before calling `kernel.run()` to ensure `Memory.stats` exists on every tick, even if Memory is reset between script loads:

```typescript
// In packages/bot/src/main.ts (added after Memory.profiler initialization)
export const loop = (): void => {
  try {
    // ... Memory.profiler initialization ...

    // Defensive initialization of Memory.stats to prevent telemetry blackout
    // This ensures stats structure exists on every tick, even if Memory is reset
    // between script loads. Critical for /api/user/stats endpoint to receive data.
    Memory.stats ??= {
      time: 0,
      cpu: { used: 0, limit: 0, bucket: 0 },
      creeps: { count: 0 },
      rooms: { count: 0 }
    };

    const gameContext = validateGameContext(Game);
    kernel.run(gameContext, Memory);
  } catch (error) {
    // ... error handling ...
  }
};
```

### Key Design Decisions

1. **Nullish Coalescing Assignment (`??=`)**: Only assigns if `Memory.stats` is `null` or `undefined`, preserving existing stats data if present

2. **Placement in loop()**: Ensures initialization happens on EVERY tick before kernel.run(), regardless of Memory state

3. **Matches Memory.profiler Pattern**: Uses the same defensive initialization pattern already proven effective for Memory.profiler

4. **Minimal Performance Impact**: The `??=` operator is extremely fast and only performs assignment when needed

## Prevention

Added comprehensive regression test `tests/regression/memory-stats-defensive-init.test.ts` that verifies:

1. Memory.stats is initialized in loop() function when missing
2. Existing Memory.stats is preserved (not overwritten)
3. Memory.stats is re-initialized if it becomes undefined between ticks
4. Defensive pattern matches Memory.profiler implementation

## Verification

1. **Build Test**: `yarn build` - Successful compilation (822.5kb)
2. **Unit Tests**: All 904 tests pass
3. **Regression Tests**: All 456 tests pass (including new defensive init test)
4. **Bundle Check**: Confirmed defensive initialization present in `dist/main.js` line 22485-22490
5. **Lint Check**: 0 errors, only pre-existing warnings

## Impact

This fix restores:

- ✅ Memory.stats population in the game runtime on every tick
- ✅ PTR telemetry collection via Stats API
- ✅ Strategic monitoring capabilities
- ✅ Performance analysis and baseline establishment
- ✅ Anomaly detection system
- ✅ Bot health assessment and tracking

## Lessons Learned

1. **Constructor Initialization is Insufficient**: Objects created at module scope persist across Memory resets, so constructor-level initialization only runs once

2. **Defensive Patterns Required**: In Screeps, Memory can be reset at any time by the server, requiring defensive initialization on every tick

3. **Follow Proven Patterns**: Memory.profiler already used this defensive pattern successfully - should have been applied to Memory.stats from the start

4. **Test Coverage Gaps**: Previous tests didn't validate initialization timing, only that stats were written during kernel.run()

5. **Monitoring Blind Spots**: The bot continued executing normally while monitoring silently failed, making the issue hard to detect without proactive monitoring

## Related Documentation

- [StatsCollector Implementation](../../packages/bot/src/runtime/metrics/StatsCollector.ts)
- [Kernel Constructor](../../packages/bot/src/runtime/bootstrap/kernel.ts)
- [Main Loop Function](../../packages/bot/src/main.ts)
- [Troubleshooting Telemetry](./troubleshooting-telemetry.md)
- [Monitoring Baselines](./monitoring-baselines.md)
- [Previous Stats Interface Fix](./memory-stats-interface-fix.md)

## Historical Context

This is the 7th occurrence of stats collection failures in 2 weeks:

- **#863**: Current issue - Memory.stats defensive initialization (FIXED)
- **#800**: Defensive Memory.stats initialization needed
- **#722**: Stats infrastructure hardening (50% reliability)
- **#711**: Systematic stats collection regression
- **#684**: Memory.stats collection failure despite active bot
- **#791**: Multi-source telemetry collection
- **#810**: Bot snapshot enhancement with console fallback

This fix addresses the root cause of the recurring pattern by ensuring Memory.stats is initialized defensively on every tick, preventing future telemetry blackouts caused by Memory resets.

## Future Recommendations

1. **Proactive Defensive Initialization**: Apply defensive initialization pattern to ALL critical Memory properties, not just stats and profiler

2. **Memory Reset Detection**: Add logging to detect when Memory is reset between ticks to help diagnose similar issues

3. **Health Check Integration**: Implement automated health checks that verify Memory.stats is being populated on every tick

4. **Documentation**: Document the Screeps Memory lifecycle and defensive initialization patterns in developer guides

5. **Automated Monitoring**: Ensure monitoring workflows can detect telemetry blackouts within 15 minutes and alert immediately
