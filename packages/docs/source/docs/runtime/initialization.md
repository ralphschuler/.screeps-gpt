# Initialization System

**Purpose**: Phased initialization after deployment/restart to prevent CPU bucket drain.  
**Status**: Active (v0.188.0+)  
**Manager**: `InitializationManager`  
**Last Updated**: 2025-11-29

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Initialization Phases](#initialization-phases)
4. [Memory State Tracking](#memory-state-tracking)
5. [Configuration](#configuration)
6. [CPU Protection](#cpu-protection)
7. [Troubleshooting](#troubleshooting)
8. [Monitoring](#monitoring)

## Overview

The initialization system spreads startup workload across multiple ticks to prevent CPU bucket drain after deployment or server restart. This protects the bot from immediate timeout cascades during the critical post-restart period.

### Why Phased Initialization Exists

When the Screeps server restarts or new code is deployed, all global variables are cleared, requiring full re-initialization. Without protection, this can cause:

- **Immediate CPU bucket drain**: All initialization executes in one tick
- **Timeout cascades**: Low bucket leads to more timeouts, creating a death spiral
- **Emergency mode activation**: System becomes unstable during recovery
- **Lost operational time**: Bot non-functional during restart recovery

### Key Features

- **Phased execution**: Initialization spread across 1-5 ticks
- **CPU budget protection**: Each phase respects CPU limits
- **Bucket monitoring**: Defers initialization when bucket is critically low
- **Graceful degradation**: Force-completes after maximum tick limit
- **State persistence**: Progress tracked in Memory.init

## How It Works

```
Tick 1: Memory validation, basic structures
  ↓ (CPU budget check)
Tick 2: Profiler setup, event subscriptions
  ↓ (CPU budget check)
Tick 3: Console diagnostics, global utilities
  ↓
Initialization Complete → Normal kernel execution
```

The `InitializationManager` maintains a queue of phases, each with:
- **Priority**: Execution order (lower = earlier)
- **CPU estimate**: Expected CPU cost
- **Execute function**: The initialization logic

Each tick, phases execute within the available CPU budget. When budget exhausted, remaining phases defer to next tick.

## Initialization Phases

| Phase | Priority | CPU Est | Description |
|-------|----------|---------|-------------|
| `memory-validation` | 0 | 1 | Ensure Memory structures exist |
| `profiler-setup` | 10 | 2 | Initialize profiler if enabled |
| `event-subscriptions` | 20 | 1 | Confirm event bus ready |
| `console-diagnostics` | 30 | 1 | Expose global utilities |

### Phase 0: Memory Validation (Priority 0)

Ensures critical Memory structures exist:
- `Memory.stats` - Telemetry data structure
- `Memory.profiler` - Profiler data collection

This runs first because all other systems depend on Memory availability.

### Phase 1: Profiler Setup (Priority 10)

Initializes the profiler if enabled at build time (`__PROFILER_ENABLED__`):
- Creates `Memory.profiler` structure
- Auto-starts data collection
- Sets profilerInitialized flag

### Phase 2: Event Subscriptions (Priority 20)

Confirms event bus is ready for runtime events:
- Hostile detection events
- Energy depletion events
- Energy restoration events

Note: Event subscriptions are registered at module load, this phase confirms readiness.

### Phase 3: Console Diagnostics (Priority 30)

Exposes global utilities for console access:
- `global.Profiler` - Profiler CLI
- `global.Diagnostics` - Runtime diagnostics
- `global.EventBus` - Event bus instance

## Memory State Tracking

Initialization state is persisted in `Memory.init`:

```typescript
Memory.init = {
  phase: number;           // Current phase index
  startTick: number;       // Tick when init began
  complete: boolean;       // Whether init finished
  completedPhases?: string[]; // Names of completed phases
};
```

### State Transitions

1. **Init Not Started**: `Memory.init` undefined
2. **Init In Progress**: `Memory.init.complete === false`
3. **Init Complete**: `Memory.init.complete === true`

Once complete, the initialization system is bypassed until the next code reload or server restart.

## Configuration

The `InitializationManager` accepts configuration options:

```typescript
const initManager = new InitializationManager({
  minBucketLevel: 500,    // Minimum bucket to proceed
  cpuSafetyMargin: 0.8,   // Use 80% of CPU limit
  maxInitTicks: 10        // Force complete after 10 ticks
});
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `minBucketLevel` | 500 | Minimum CPU bucket to proceed with initialization |
| `cpuSafetyMargin` | 0.8 | Fraction of CPU limit to use for init phases |
| `maxInitTicks` | 10 | Maximum ticks before force-completing init |

## CPU Protection

The initialization system includes multiple CPU protection mechanisms:

### 1. Budget-Based Execution

Each phase has a CPU estimate. Before executing, the system checks:

```typescript
cpuRemaining = (limit * safetyMargin) - getUsed()
if (cpuRemaining < phase.cpuEstimate) {
  // Skip to next tick
}
```

### 2. Bucket Deferral

If CPU bucket falls below `minBucketLevel` (default 500), initialization is deferred entirely:

```
[InitializationManager] CPU bucket (100) below threshold (500), deferring initialization
```

This allows bucket to recover before attempting CPU-intensive initialization.

### 3. Force Completion

If initialization hasn't completed within `maxInitTicks`, it force-completes:

```
[InitializationManager] Max init ticks (10) exceeded, force-completing initialization
```

This prevents indefinite initialization loops if phases continuously fail to fit in budget.

## Troubleshooting

### Initialization Not Completing

**Symptoms**: `Memory.init.complete` stays `false` for many ticks

**Causes**:
1. CPU bucket critically low (< 500)
2. Phase CPU estimates too high for limit
3. High background CPU usage

**Solutions**:
1. Wait for bucket to recover (check `Game.cpu.bucket`)
2. Review phase CPU estimates
3. Check for CPU-heavy external processes

### Phases Skipping Repeatedly

**Symptoms**: Same phases skip every tick

**Causes**:
1. CPU usage consistently high
2. Phase estimates higher than available budget

**Solutions**:
1. Reduce phase CPU estimates
2. Increase `cpuSafetyMargin`
3. Split large phases into smaller ones

### Force Completion Warning

**Log**: `Max init ticks exceeded, force-completing initialization`

**Impact**: Some phases may not have executed

**Recovery**:
1. Monitor for missing functionality
2. Phases will work on subsequent normal ticks
3. Consider increasing `maxInitTicks` if needed

## Monitoring

### Console Commands

```javascript
// Check initialization status
Memory.init

// Example output:
{
  phase: 4,
  startTick: 12345,
  complete: true,
  completedPhases: ["memory-validation", "profiler-setup", "event-subscriptions", "console-diagnostics"]
}

// Force re-initialization (for testing)
delete Memory.init;
```

### Log Messages

Normal initialization:
```
[InitializationManager] Starting phased initialization (tick 12345)
[Init Phase] Memory structures validated
[Init Phase] Profiler auto-started
[Init Phase] Event bus ready
[Init Phase] Console diagnostics exposed
[InitializationManager] ✅ Initialization complete in 1 tick(s)
```

CPU-constrained initialization:
```
[InitializationManager] CPU budget exhausted (15.00/16.00), skipping 2 phases until next tick
[InitializationManager] ✅ Initialization complete in 3 tick(s)
```

### Metrics

Track initialization performance in `Memory.stats`:
- `init.ticksRequired` - Ticks to complete initialization
- `init.phasesExecuted` - Total phases executed
- `init.lastStartTick` - When initialization last started

## Related Documentation

- [Bootstrap Phase System](./bootstrap-phases.md) - Room bootstrap phases
- [CPU Management](../operations/cpu-management.md) - CPU optimization strategies
- [Memory Management](./memory-management.md) - Memory structure overview
- [Deployment Procedure](../operations/deployment-procedure.md) - Post-deployment checks

## API Reference

### InitializationManager

```typescript
class InitializationManager {
  // Register a new initialization phase
  registerPhase(phase: InitPhase): void;
  
  // Check if initialization is complete
  isComplete(memory: Memory): boolean;
  
  // Check if initialization is needed
  needsInitialization(memory: Memory): boolean;
  
  // Execute one tick of initialization
  tick(game: GameContext, memory: Memory): InitTickResult;
  
  // Reset initialization state
  reset(memory: Memory): void;
  
  // Get current status
  getStatus(memory: Memory): InitStatus;
}

interface InitPhase {
  name: string;
  priority: number;
  cpuEstimate: number;
  execute: () => void;
}
```
