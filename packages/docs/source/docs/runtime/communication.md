# Creep Communication System

## Overview

The `CreepCommunicationManager` provides a severity-based communication system for creeps, allowing selective display of messages based on their importance. This reduces visual clutter in the game client while maintaining visibility for warnings and errors.

## Features

- **Severity-Based Filtering**: Messages classified by importance (ERROR, WARNING, INFO, VERBOSE)
- **CPU Budget Management**: Configurable CPU limits for communication per tick
- **Room Visuals Support**: Optional visual indicators for task goals
- **Backward Compatible**: Maintains existing API while adding new functionality

## Severity Levels

The system uses the `CommunicationLevel` enum to classify messages:

```typescript
enum CommunicationLevel {
  SILENT = 0, // No messages
  ERROR = 1, // Critical failures only
  WARNING = 2, // Errors + warnings
  INFO = 3, // Errors + warnings + important status
  VERBOSE = 4 // All messages (includes routine operations)
}
```

### Default Configuration

**For backward compatibility**, the system defaults to **VERBOSE** level when using string verbosity modes ("normal", "verbose"), showing all messages as before.

To enable the new filtered behavior, explicitly set `level: CommunicationLevel.WARNING` in the configuration to show only errors and warnings while suppressing routine operational messages.

## Message Classification

### ERROR Level (Always Visible)

Critical failures that require immediate attention:

- Stuck/blocked creeps (`stuck`)
- Pathfinding failures (`error`)
- Invalid target references
- CPU emergency aborts
- Memory corruption detection

### WARNING Level (Visible at WARNING+)

Caution conditions indicating potential issues:

- Energy depletion (`empty`)
- Resource capacity full (`full`)
- Low TTL (< 50 ticks)
- Suboptimal pathing or behavior
- Resource container full/empty

### INFO Level (Visible at INFO+)

Important status changes:

- Task completion notifications
- Target selection changes (`gather`)
- Energy state transitions

### VERBOSE Level (Debug Mode Only)

Routine operational messages:

- Normal actions: `harvest`, `deliver`, `upgrade`, `build`, `repair`
- Movement commands (`travel`)
- Resource operations (`pickup`)
- Role identification

## API Usage

### Basic Usage with Auto-Severity

The `say()` method automatically uses the default severity for each action type:

```typescript
const comm = serviceRegistry.getCommunicationManager();

// Routine action (VERBOSE) - suppressed at WARNING level
comm?.say(creep, "harvest");

// Warning (WARNING) - visible at WARNING level
comm?.say(creep, "empty");

// Error (ERROR) - always visible
comm?.say(creep, "error");
```

### Explicit Severity Methods

For explicit control over message severity:

```typescript
// ERROR: Critical failures (always visible)
comm?.error(creep, "error", "critical failure");

// WARNING: Caution conditions (visible at WARNING+)
comm?.warn(creep, "empty", "low energy");

// INFO: Important status (visible at INFO+)
comm?.info(creep, "gather", "task complete");

// VERBOSE: Routine operations (visible at VERBOSE only)
comm?.verbose(creep, "harvest", "mining");
```

### Backward Compatibility Methods

Legacy methods are maintained for compatibility:

```typescript
// Display error or stuck state
comm?.sayError(creep, "additional text");

// Display resource status (full/empty)
comm?.sayResourceStatus(creep, isFull, percentage);
```

### Custom Severity Override

Use `sayWithSeverity()` for fine-grained control:

```typescript
comm?.sayWithSeverity(
  creep,
  "harvest",
  CommunicationLevel.INFO, // Override default VERBOSE severity
  "important",
  () => Game.cpu.getUsed()
);
```

## Configuration

### Initial Configuration

Configure the manager at creation:

```typescript
// Backward compatible mode (shows all messages)
const comm = new CreepCommunicationManager({
  verbosity: "normal", // String verbosity (shows all messages)
  enableRoomVisuals: false, // Room visual indicators
  cpuBudget: 0.1 // CPU limit per tick
});

// New filtered mode (suppress routine operations)
const filteredComm = new CreepCommunicationManager({
  level: CommunicationLevel.WARNING, // Explicit severity level (errors + warnings only)
  enableRoomVisuals: false,
  cpuBudget: 0.1
});
```

### Runtime Configuration Updates

Update configuration dynamically:

```typescript
// Update severity level
comm.updateConfig({ level: CommunicationLevel.VERBOSE });

// Update verbosity (automatically maps to level)
comm.updateConfig({ verbosity: "verbose" });

// Enable room visuals
comm.updateConfig({ enableRoomVisuals: true });
```

### Verbosity to Level Mapping

String verbosity values automatically map to severity levels (backward compatible):

| Verbosity  | Level   | Behavior                                    |
| ---------- | ------- | ------------------------------------------- |
| `disabled` | SILENT  | No messages                                 |
| `minimal`  | ERROR   | Critical errors only (backward compatible)  |
| `normal`   | VERBOSE | All messages (backward compatible, default) |
| `verbose`  | VERBOSE | All messages with additional text           |

**Note:** For the new filtered behavior, explicitly set `level: CommunicationLevel.WARNING` to suppress routine operations while showing errors and warnings.

### Environment-Based Configuration

Configure via Memory for runtime control:

```typescript
// In bootstrap/configuration
if (Memory.creepCommunication?.verbosity) {
  comm.updateConfig({
    verbosity: Memory.creepCommunication.verbosity as CommunicationVerbosity
  });
}

// Or via explicit level
if (Memory.creepCommunication?.level !== undefined) {
  comm.updateConfig({
    level: Memory.creepCommunication.level as CommunicationLevel
  });
}
```

## Action Severity Mapping

Default severity for each `CreepAction`:

| Action    | Severity | Visibility at WARNING Level |
| --------- | -------- | --------------------------- |
| `stuck`   | ERROR    | ✅ Visible                  |
| `error`   | ERROR    | ✅ Visible                  |
| `empty`   | WARNING  | ✅ Visible                  |
| `full`    | WARNING  | ✅ Visible                  |
| `gather`  | INFO     | ❌ Hidden                   |
| `harvest` | VERBOSE  | ❌ Hidden                   |
| `deliver` | VERBOSE  | ❌ Hidden                   |
| `upgrade` | VERBOSE  | ❌ Hidden                   |
| `build`   | VERBOSE  | ❌ Hidden                   |
| `repair`  | VERBOSE  | ❌ Hidden                   |
| `travel`  | VERBOSE  | ❌ Hidden                   |
| `pickup`  | VERBOSE  | ❌ Hidden                   |

## CPU Budget Management

The system tracks CPU usage per tick and enforces a configurable budget:

```typescript
const comm = new CreepCommunicationManager({
  cpuBudget: 0.1 // Maximum 0.1 CPU per tick for communication
});

// Reset at start of each tick
comm.resetTick(Game.time);

// CPU tracking with getter function
comm?.say(creep, "harvest", undefined, () => Game.cpu.getUsed());

// Check CPU usage
const stats = comm.getCpuUsage();
console.log(`CPU used: ${stats.used}/${stats.budget} (${stats.percentage.toFixed(1)}%)`);
```

## Room Visuals

Optional visual indicators for task goals:

```typescript
const comm = new CreepCommunicationManager({
  enableRoomVisuals: true
});

// Draw line from creep to target with optional color
comm?.drawTaskGoal(
  creep,
  targetPosition,
  "#00ff00", // Color (optional, defaults to green)
  () => Game.cpu.getUsed()
);
```

## Best Practices

### 1. Use Default Severity Mapping

Let the system handle severity automatically for standard actions:

```typescript
// Good: Auto-severity from ACTION_SEVERITY mapping
comm?.say(creep, "harvest");

// Unnecessary: Explicit severity for standard actions
comm?.verbose(creep, "harvest"); // Same behavior, more verbose
```

### 2. Explicit Severity for Custom Messages

Use severity methods for non-standard or custom messages:

```typescript
// Error conditions
if (creep.memory.stuck) {
  comm?.error(creep, "error", "path blocked");
}

// Warning conditions
if (creep.ticksToLive! < 50) {
  comm?.warn(creep, "empty", "low TTL");
}
```

### 3. Default to WARNING Level

Use WARNING level in production for optimal visibility:

```typescript
// Production configuration (show warnings and errors only)
const comm = new CreepCommunicationManager({
  level: CommunicationLevel.WARNING
});
```

### 4. Enable VERBOSE for Debugging

Temporarily increase verbosity during development:

```typescript
// Debugging configuration (show all messages)
const comm = new CreepCommunicationManager({
  level: CommunicationLevel.VERBOSE,
  verbosity: "verbose" // Enables additional text in messages
});
```

### 5. Monitor CPU Usage

Track communication CPU costs in performance-critical situations:

```typescript
comm.resetTick(Game.time);

// ... communication calls ...

const usage = comm.getCpuUsage();
if (usage.percentage > 80) {
  console.log(`Warning: Communication using ${usage.percentage.toFixed(1)}% of budget`);
}
```

## Integration with Role Controllers

Controllers obtain the manager from the service registry:

```typescript
import { serviceRegistry } from "./ServiceLocator";

export class HarvesterController extends BaseRoleController<HarvesterMemory> {
  public execute(creep: CreepLike): string {
    const comm = serviceRegistry.getCommunicationManager();

    // Use auto-severity
    comm?.say(creep, "harvest"); // VERBOSE - hidden at WARNING level

    // Handle errors
    if (creep.memory.stuck) {
      comm?.error(creep, "stuck"); // ERROR - always visible
    }

    // Handle warnings
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      comm?.warn(creep, "empty"); // WARNING - visible at WARNING level
    }

    return currentState;
  }
}
```

## Testing

Test severity filtering with different levels:

```typescript
import { CreepCommunicationManager, CommunicationLevel } from "@runtime/behavior";

// Test ERROR level (only critical messages)
const errorComm = new CreepCommunicationManager({
  level: CommunicationLevel.ERROR
});
errorComm.say(creep, "harvest"); // Not shown
errorComm.error(creep, "error"); // Shown

// Test WARNING level (errors + warnings)
const warningComm = new CreepCommunicationManager({
  level: CommunicationLevel.WARNING
});
warningComm.say(creep, "harvest"); // Not shown
warningComm.warn(creep, "empty"); // Shown
warningComm.error(creep, "error"); // Shown

// Test VERBOSE level (all messages)
const verboseComm = new CreepCommunicationManager({
  level: CommunicationLevel.VERBOSE,
  verbosity: "verbose"
});
verboseComm.say(creep, "harvest", "mining"); // Shown with text
```

## Migration Guide

### From Direct creep.say() Calls

Replace direct calls with managed communication:

```typescript
// Before
creep.say("⛏️");

// After
const comm = serviceRegistry.getCommunicationManager();
comm?.say(creep, "harvest");
```

### From String Verbosity to Severity Levels

Transition from string verbosity to explicit severity:

```typescript
// Old approach (string verbosity)
const comm = new CreepCommunicationManager({
  verbosity: "normal"
});

// New approach (explicit severity)
const comm = new CreepCommunicationManager({
  level: CommunicationLevel.WARNING
});
```

### Adding Custom Actions

Extend the system with custom actions:

```typescript
// Define custom action severity
const CUSTOM_ACTION_SEVERITY = {
  ...ACTION_SEVERITY,
  customAction: CommunicationLevel.INFO
};

// Use with custom severity
comm?.sayWithSeverity(creep, "gather", CommunicationLevel.INFO, "custom");
```

## Troubleshooting

### Messages Not Appearing

1. Check severity level configuration:

   ```typescript
   console.log(comm.getConfig().level); // Should be >= message severity
   ```

2. Verify communication is enabled:

   ```typescript
   const config = comm.getConfig();
   console.log(config.verbosity !== "disabled");
   ```

3. Check CPU budget:
   ```typescript
   const usage = comm.getCpuUsage();
   console.log(`CPU: ${usage.used}/${usage.budget}`);
   ```

### Too Many Messages

Reduce verbosity level:

```typescript
// Show only errors
comm.updateConfig({ level: CommunicationLevel.ERROR });

// Show errors and warnings (default)
comm.updateConfig({ level: CommunicationLevel.WARNING });
```

### Performance Issues

Adjust CPU budget and disable room visuals:

```typescript
comm.updateConfig({
  cpuBudget: 0.05, // Reduce CPU budget
  enableRoomVisuals: false // Disable visual indicators
});
```

## Related Documentation

- [Runtime Bootstrap Phases](./bootstrap-phases.md) - System initialization
- [Role Balancing](./role-balancing.md) - Role controller architecture
- [Testing Strategy](./testing-strategy.md) - Testing guidelines

## See Also

- `CreepCommunicationManager` implementation: `packages/bot/src/runtime/behavior/CreepCommunicationManager.ts`
- Test suite: `tests/unit/creep-communication-severity.test.ts`
- Service registry: `packages/bot/src/runtime/behavior/controllers/ServiceLocator.ts`
