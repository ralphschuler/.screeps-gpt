# Memory Management System

## Overview

The Screeps AI runtime includes a comprehensive memory management system to prevent memory overflow, handle version migrations, maintain optimal memory utilization through automated garbage collection, and automatically repair corrupted memory structures. This system ensures stable long-term operation, supports safe schema evolution across version updates, and provides self-healing capabilities to recover from memory corruption.

## Architecture

The memory management system consists of four primary components:

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

### 3. MemorySelfHealer

**Location:** `src/runtime/memory/MemorySelfHealer.ts`

Automatically detects and repairs corrupted or missing memory structures to prevent crashes and maintain system stability.

**Features:**

- Validates core memory structures (creeps, rooms, roles, respawn, stats, systemReport)
- Repairs missing or invalid memory fields
- Detects circular references and unserializable data
- Removes invalid entries (malformed creep memories, negative role counts)
- Emergency reset capability for complete corruption
- Configurable auto-repair behavior

**Configuration:**

```typescript
{
  autoRepair: true,     // Automatically repair corrupted structures
  logRepairs: true      // Log repair operations
}
```

**Usage:**

```typescript
import { MemorySelfHealer } from "@runtime/memory";

const healer = new MemorySelfHealer();

// Check and repair memory
const result = healer.checkAndRepair(memory);

if (!result.isHealthy) {
  console.log(`Found ${result.issuesFound.length} issues`);
  console.log(`Repaired ${result.issuesRepaired.length} issues`);
}

if (result.requiresReset) {
  // Complete corruption detected - manual intervention needed
  healer.emergencyReset(memory);
}
```

**Health Check Result:**

```typescript
interface HealthCheckResult {
  isHealthy: boolean; // True if no issues found
  issuesFound: string[]; // List of detected issues
  issuesRepaired: string[]; // List of repairs made
  requiresReset: boolean; // True if memory needs emergency reset
}
```

**What Gets Validated:**

- **Memory.creeps**: Must be an object, entries must be valid CreepMemory
- **Memory.roles**: Must be an object, values must be non-negative numbers
- **Memory.rooms**: Must be an object
- **Memory.respawn**: Must be an object with valid boolean flags and optional tick number
- **Memory.stats**: Optional, but if present must be a valid object
- **Memory.systemReport**: Optional, but if present must be a valid object
- **Memory.version**: Optional, but if present must be a number

**Repair Actions:**

- Missing structures → Initialize with safe defaults
- Invalid types → Reset to safe defaults
- Invalid entries → Remove corrupted entries
- Circular references → Flag for emergency reset
- Invalid field values → Reset to safe values

### 4. MemoryUtilizationMonitor

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
  private readonly selfHealer: MemorySelfHealer;
  private readonly garbageCollector: MemoryGarbageCollector;
  private readonly migrationManager: MemoryMigrationManager;
  private readonly utilizationMonitor: MemoryUtilizationMonitor;

  public run(game: GameContext, memory: Memory): void {
    // Self-heal memory before any other operations (enabled by default)
    if (this.enableSelfHealing) {
      const healthCheck = this.selfHealer.checkAndRepair(memory);
      if (healthCheck.requiresReset) {
        this.logger.warn?.("[Kernel] Memory corruption detected. Emergency reset required.");
      }
    }

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
  enableSelfHealing: true, // Auto-repair memory (enabled by default)
  enableGarbageCollection: true,
  garbageCollector: new MemoryGarbageCollector({
    roomDataRetentionTicks: 5000
  }),
  selfHealer: new MemorySelfHealer({
    autoRepair: true,
    logRepairs: true
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

### 1. Self-Healing

- **Enable by default:** Self-healing is enabled by default (`enableSelfHealing: true`)
- **Automatic recovery:** The system automatically repairs common corruption patterns
- **Monitor logs:** Check logs for repair notifications to identify recurring issues
- **Emergency reset:** Use `emergencyReset()` only when circular references are detected
- **Test resilience:** Self-healing prevents crashes from malformed memory structures

**When Self-Healing Activates:**

- Missing core structures (creeps, rooms, roles, respawn)
- Invalid types (arrays instead of objects, strings instead of numbers)
- Invalid field values (negative counts, non-finite numbers)
- Corrupted entries (null or malformed data)

**Limitations:**

- Cannot recover from circular references (requires manual reset)
- Cannot restore lost data (only repairs structure)
- Does not prevent future corruption (only fixes existing issues)

### 2. Garbage Collection

- **Enable by default:** Set `enableGarbageCollection: true` in kernel config
- **Tune retention periods:** Adjust based on your use case
  - Short retention (1000 ticks): For frequently changing data
  - Long retention (10000 ticks): For strategic planning data
- **Monitor CPU usage:** Adjust `maxCleanupPerTick` if GC causes spikes

### 3. Migrations

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

### 4. Memory Monitoring

- **Set appropriate thresholds:** Default 70% warning, 90% critical
- **Monitor subsystems:** Track which subsystems consume the most memory
- **Plan for growth:** Use `getBudget()` before expanding data structures
- **React to alerts:** System evaluator will flag memory issues

### 5. Memory Optimization

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

- **Self-Healing:** ~0.1-1 CPU per tick
  - Runs before any other operations
  - Validates and repairs core structures
  - Only processes invalid entries
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

### Memory Corruption

**Symptoms:** Unexpected behavior, missing data, crashes

**Solutions:**

1. Check self-healing logs: Look for repair notifications
2. Identify corruption source: Review recent code changes
3. Enable repair logging: Set `logRepairs: true`
4. Emergency reset: Use `healer.emergencyReset(memory)` for circular references

**Common Causes:**

- External code modifying memory incorrectly
- Race conditions in multi-threaded scenarios
- Deserialization errors from Screeps API
- Manual memory edits in console with errors

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

- **MemorySelfHealer:** 28 tests (validation, repair, emergency reset)
- **MemoryGarbageCollector:** 6 tests
- **MemoryMigrationManager:** 7 tests
- **MemoryUtilizationMonitor:** 9 tests

**Run tests:**

```bash
# All memory management tests
bun run test:unit -- memoryManagement.test.ts memoryBootstrap.test.ts memorySelfHealer.test.ts

# Self-healing tests only
bun run test:unit -- memorySelfHealer.test.ts
```

## Future Enhancements

Potential improvements for future versions:

1. **Advanced Self-Healing:**
   - Automatic backup and restore of corrupted subsystems
   - Machine learning to detect corruption patterns
   - Gradual rollback to last known good state
2. **Compression:** Implement memory compression for large structures
3. **Archival:** Save historical data to external storage
4. **Predictive GC:** Schedule cleanup based on usage patterns
5. **Memory Profiling:** Detailed subsystem breakdown and leak detection
6. **Auto-tuning:** Dynamically adjust retention periods based on usage

## Related Documentation

- [Task System](./task-system.md) - Memory management for task queues
- [Logging and Visuals](./logging-and-visuals.md) - Memory-efficient logging
- [PTR Testing](./ptr-task-system-testing.md) - Testing memory management on PTR

## API Reference

See TypeScript definitions in:

- `src/runtime/memory/MemorySelfHealer.ts`
- `src/runtime/memory/MemoryGarbageCollector.ts`
- `src/runtime/memory/MemoryMigrationManager.ts`
- `src/runtime/memory/MemoryUtilizationMonitor.ts`
- `src/runtime/memory/index.ts` (exports)
