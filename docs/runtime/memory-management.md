# Memory Management System

## Overview

The Screeps AI runtime includes a comprehensive memory management system to prevent memory overflow, handle version migrations, and maintain optimal memory utilization through automated garbage collection. This system ensures stable long-term operation and supports safe schema evolution across version updates.

## Architecture

The memory management system consists of three primary components:

### 1. MemoryGarbageCollector

**Location:** `src/runtime/memory/MemoryGarbageCollector.ts`

Handles automated cleanup of stale data to prevent memory overflow.

**Features:**

- Removes orphaned room data from inactive or abandoned rooms
- Rotates old system evaluation reports
- Implements configurable retention policies
- Uses incremental cleanup to avoid CPU spikes
- CPU throttling via `maxCleanupPerTick` parameter

**Configuration:**

```typescript
{
  roomDataRetentionTicks: 10000,    // Keep room data for 10k ticks
  statsRetentionTicks: 1000,        // Keep stats for 1k ticks
  reportRetentionTicks: 500,        // Keep reports for 500 ticks
  maxCleanupPerTick: 10            // Process max 10 items per tick
}
```

**Usage:**

```typescript
import { MemoryGarbageCollector } from "@runtime/memory";

const collector = new MemoryGarbageCollector();
const result = collector.collect(game, memory);

// result.roomDataCleaned: number of rooms cleaned
// result.reportsRotated: number of reports rotated
```

### 2. MemoryMigrationManager

**Location:** `src/runtime/memory/MemoryMigrationManager.ts`

Manages memory schema versioning and automated migrations across version updates.

**Features:**

- Schema versioning with `Memory.version` field
- Migration registry for version-specific handlers
- Automated migration execution on version changes
- Memory integrity validation after migrations
- Rollback prevention through error handling

**Usage:**

```typescript
import { MemoryMigrationManager } from "@runtime/memory";

const manager = new MemoryMigrationManager(currentVersion);

// Register a migration
manager.registerMigration({
  version: 2,
  description: "Add creep task tracking",
  handler: (memory: Memory) => {
    // Perform migration
    memory.creeps = memory.creeps ?? {};
  }
});

// Run migrations
const result = manager.migrate(memory);
if (result.success) {
  console.log(`Applied ${result.migrationsApplied} migrations`);
}

// Validate memory after migration
if (!manager.validateMemory(memory)) {
  console.log("Memory validation failed");
}
```

**Built-in Migrations:**

- **Version 1:** Initialize memory version tracking

### 3. MemoryUtilizationMonitor

**Location:** `src/runtime/memory/MemoryUtilizationMonitor.ts`

Tracks memory usage and provides threshold alerts to prevent overflow.

**Features:**

- Real-time memory usage measurement
- Configurable warning and critical thresholds
- Per-subsystem usage tracking
- Allocation capacity checks
- Memory budgeting for subsystems

**Configuration:**

```typescript
{
  warningThreshold: 0.7,      // Warn at 70% utilization
  criticalThreshold: 0.9,     // Critical at 90% utilization
  maxMemoryBytes: 2097152     // 2MB (Screeps limit)
}
```

**Usage:**

```typescript
import { MemoryUtilizationMonitor } from "@runtime/memory";

const monitor = new MemoryUtilizationMonitor();

// Measure current utilization
const utilization = monitor.measure(memory);

if (utilization.isCritical) {
  console.log("Memory usage critical!");
}

// Check if allocation is safe
if (monitor.canAllocate(memory, estimatedBytes)) {
  // Proceed with allocation
}

// Get recommended budget for subsystem
const budget = monitor.getBudget("creeps", memory);
```

**Utilization Data Structure:**

```typescript
interface MemoryUtilization {
  currentBytes: number;
  maxBytes: number;
  usagePercent: number;
  isWarning: boolean;
  isCritical: boolean;
  subsystems: Record<string, number>; // Per-subsystem usage
}
```

## Integration

### Kernel Integration

The memory management system is integrated into the runtime kernel (`src/runtime/bootstrap/kernel.ts`):

```typescript
export class Kernel {
  private readonly garbageCollector: MemoryGarbageCollector;
  private readonly migrationManager: MemoryMigrationManager;
  private readonly utilizationMonitor: MemoryUtilizationMonitor;

  public run(game: GameContext, memory: Memory): void {
    // Run migrations on version change
    const migrationResult = this.migrationManager.migrate(memory);

    // Run garbage collection every 10 ticks
    if (this.enableGarbageCollection && game.time % 10 === 0) {
      this.garbageCollector.collect(game, memory);
    }

    // Measure memory utilization
    const memoryUtilization = this.utilizationMonitor.measure(memory);

    // Pass to evaluator for health reporting
    this.evaluator.evaluateAndStore(memory, snapshot, repository, memoryUtilization);
  }
}
```

**Configuration:**

```typescript
const kernel = new Kernel({
  memorySchemaVersion: 1,
  enableGarbageCollection: true,
  garbageCollector: new MemoryGarbageCollector({
    roomDataRetentionTicks: 5000
  })
});
```

### SystemEvaluator Integration

Memory health is integrated into the system evaluation framework:

```typescript
// SystemEvaluator automatically checks memory utilization
const report = evaluator.evaluate(snapshot, repository, memory, memoryUtilization);

// Generates findings like:
{
  severity: "critical",
  title: "Memory usage at critical level",
  detail: "Memory usage at 92.3% (1.8MB/2.0MB)",
  recommendation: "Enable garbage collection or reduce retention periods"
}
```

## Memory Structure

The global `Memory` interface includes:

```typescript
interface Memory {
  version?: number; // Schema version for migrations
  creeps?: Record<string, CreepMemory>;
  rooms?: Record<string, RoomMemory>;
  stats?: StatsData;
  systemReport?: {
    lastGenerated: number;
    report: SystemReport;
  };
  roles?: Record<string, number>;
  respawn?: RespawnState;
}
```

## Best Practices

### 1. Garbage Collection

- **Enable by default:** Set `enableGarbageCollection: true` in kernel config
- **Tune retention periods:** Adjust based on your use case
  - Short retention (1000 ticks): For frequently changing data
  - Long retention (10000 ticks): For strategic planning data
- **Monitor CPU usage:** Adjust `maxCleanupPerTick` if GC causes spikes

### 2. Migrations

- **Version incrementally:** Increase version by 1 for each schema change
- **Test migrations:** Write unit tests for migration handlers
- **Document changes:** Use descriptive migration descriptions
- **Validate thoroughly:** Always call `validateMemory()` after migrations
- **Handle errors:** Migration failures should not crash the bot

**Example Migration:**

```typescript
manager.registerMigration({
  version: 2,
  description: "Add remote mining support to creep memory",
  handler: (memory: Memory) => {
    for (const name in memory.creeps) {
      const creepMem = memory.creeps[name];
      if (!creepMem.sourceId && creepMem.role === "harvester") {
        // Assign default source or migrate data
        creepMem.sourceId = undefined;
      }
    }
  }
});
```

### 3. Memory Monitoring

- **Set appropriate thresholds:** Default 70% warning, 90% critical
- **Monitor subsystems:** Track which subsystems consume the most memory
- **Plan for growth:** Use `getBudget()` before expanding data structures
- **React to alerts:** System evaluator will flag memory issues

### 4. Memory Optimization

**Reduce Memory Footprint:**

```typescript
// ❌ Bad: Store unnecessary data
memory.creeps[name].path = [
  /* 50 positions */
];

// ✅ Good: Store compact representation
memory.creeps[name].pathSerial = "5x5n7w3s";

// ❌ Bad: Duplicate data
memory.rooms[roomName].sources = game.rooms[roomName].find(FIND_SOURCES);

// ✅ Good: Derive from game state when needed
// (Don't store what can be queried)
```

**Use Retention Policies:**

```typescript
// Clean old stats periodically
if (memory.stats && game.time - memory.stats.time > 1000) {
  delete memory.stats;
}
```

## Performance Considerations

### CPU Impact

The memory management system is designed for minimal CPU overhead:

- **Garbage Collection:** ~0.5-2 CPU per tick (runs every 10 ticks)
  - Incremental cleanup via `maxCleanupPerTick`
  - Skipped when CPU threshold is exceeded
- **Migrations:** One-time cost on version change (~1-5 CPU)
  - Runs only when `memory.version < currentVersion`
- **Utilization Monitoring:** ~0.1-0.5 CPU per tick
  - JSON serialization for size estimation
  - Cached in evaluation cycle

### Memory Overhead

- **Metadata:** ~100-200 bytes for version field and GC state
- **Negligible impact:** <0.01% of 2MB limit

## Troubleshooting

### Memory Still Growing

**Symptoms:** Memory usage increases despite GC enabled

**Solutions:**

1. Check retention periods: May be too long
2. Identify culprit subsystem: Use `utilization.subsystems`
3. Review creep/room data: Look for accumulating state
4. Add custom cleanup: Extend `MemoryGarbageCollector`

### Migration Failures

**Symptoms:** `migration.success === false`

**Solutions:**

1. Check error messages: `migration.errors`
2. Validate memory structure: Ensure handlers don't corrupt data
3. Test migrations: Add unit tests before deploying
4. Rollback version: Manually set `memory.version` to previous

### High CPU Usage from GC

**Symptoms:** CPU spikes every 10 ticks

**Solutions:**

1. Reduce `maxCleanupPerTick`: Lower from 10 to 5
2. Increase GC interval: Change from every 10 ticks to every 20
3. Optimize retention checks: Use simpler comparisons
4. Disable GC temporarily: Set `enableGarbageCollection: false`

## Testing

Comprehensive unit tests cover all components:

- **MemoryGarbageCollector:** 6 tests
- **MemoryMigrationManager:** 7 tests
- **MemoryUtilizationMonitor:** 9 tests

**Run tests:**

```bash
bun run test:unit -- memoryManagement.test.ts
```

## Future Enhancements

Potential improvements for future versions:

1. **Compression:** Implement memory compression for large structures
2. **Archival:** Save historical data to external storage
3. **Predictive GC:** Schedule cleanup based on usage patterns
4. **Memory Profiling:** Detailed subsystem breakdown and leak detection
5. **Auto-tuning:** Dynamically adjust retention periods based on usage

## Related Documentation

- [Task System](./task-system.md) - Memory management for task queues
- [Logging and Visuals](./logging-and-visuals.md) - Memory-efficient logging
- [PTR Testing](./ptr-task-system-testing.md) - Testing memory management on PTR

## API Reference

See TypeScript definitions in:

- `src/runtime/memory/MemoryGarbageCollector.ts`
- `src/runtime/memory/MemoryMigrationManager.ts`
- `src/runtime/memory/MemoryUtilizationMonitor.ts`
- `src/runtime/memory/index.ts` (exports)
