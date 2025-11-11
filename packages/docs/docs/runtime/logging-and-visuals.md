---
title: Logging and Room Visuals
date: 2025-11-06
updated: 2025-11-06
categories:
  - Runtime
  - Operations
tags:
  - logging
  - visualization
  - debugging
  - monitoring
---

# Logging and Room Visuals

This guide covers the logging and room visualization features available in the Screeps AI runtime, providing operational visibility for debugging and monitoring.

## Overview

The runtime includes two complementary systems for observability:

1. **Structured Logging** - Console output with configurable log levels and context
2. **Room Visuals** - In-game visual feedback for bot activities and status

Both systems are designed with minimal CPU overhead and can be enabled/disabled independently.

## Structured Logging

### Logger API

The `Logger` class provides structured logging with timestamp support and contextual information.

```typescript
import { Logger } from "@runtime/utils/Logger";

// Create a logger instance
const logger = new Logger({
  minLevel: "info", // Filter logs by level: debug, info, warn, error
  includeTimestamp: true, // Include game tick in output
  includeLevel: true // Include log level prefix
});

// Log at different levels
logger.debug("Debug message", { detail: "value" });
logger.info("Info message");
logger.warn("Warning message", { context: "additional info" });
logger.error("Error message");
```

### Log Levels

The logger supports four severity levels:

- **debug**: Detailed diagnostic information for development
- **info**: General informational messages about runtime operations
- **warn**: Warning messages for potential issues
- **error**: Error messages for failures requiring attention

### Child Loggers with Context

Create child loggers that automatically include context in all log entries:

```typescript
const parentLogger = new Logger({ minLevel: "info" });
const childLogger = parentLogger.child({ component: "SpawnManager" });

childLogger.info("Spawning creep", { role: "harvester" });
// Output: [1234] [INFO] Spawning creep {"component":"SpawnManager","role":"harvester"}
```

### Configuration

The logger is already integrated into the kernel and available throughout the runtime. Configure via the `LoggerOptions` interface:

```typescript
interface LoggerOptions {
  minLevel?: "debug" | "info" | "warn" | "error";
  includeTimestamp?: boolean;
  includeLevel?: boolean;
}
```

## Room Visuals

### Overview

The `RoomVisualManager` renders in-game visual feedback for operational visibility. It provides visual indicators for:

- **Creep paths** - Role-based color coding and position markers
- **Energy flow** - Lines from harvesters to sources
- **Construction targets** - Progress indicators for build sites
- **Spawn queue** - Active spawning status and progress
- **CPU usage** - Per-room CPU and tick counter

### Enabling Visuals

Visuals are **disabled by default** to minimize CPU usage. Enable them via:

**Environment Variable:**

```bash
export ROOM_VISUALS_ENABLED=true
```

**In-Game Memory Flag:**

```javascript
Memory.experimentalFeatures = {
  roomVisuals: true
};
```

### Configuration Options

Configure visual behavior via `RoomVisualConfig`:

```typescript
interface RoomVisualConfig {
  enabled?: boolean; // Master toggle (default: false)
  showCreepPaths?: boolean; // Show creep positions (default: true)
  showEnergyFlow?: boolean; // Show harvester lines (default: true)
  showConstructionTargets?: boolean; // Show build sites (default: true)
  showSpawnQueue?: boolean; // Show spawn status (default: true)
  showCpuUsage?: boolean; // Show CPU/tick (default: true)
  cpuBudget?: number; // Max CPU per tick (default: 2.0)
}
```

### Visual Elements

#### Creep Paths

Each creep is marked with:

- Colored circle at position (role-based color)
- Creep name label above position

**Role Colors:**

- Harvester: `#ffaa00` (orange)
- Upgrader: `#0088ff` (blue)
- Builder: `#00ff00` (green)
- Repairer: `#ff8800` (dark orange)
- Courier: `#ff00ff` (magenta)
- Default: `#ffffff` (white)

#### Energy Flow

Dashed lines from harvester creeps to their nearest source, visualizing energy harvesting operations.

#### Construction Targets

Green circles around construction sites with progress percentage labels.

#### Spawn Queue

Status text above spawns showing:

- Spawning creep name
- Progress percentage
- 🏭 emoji indicator

#### CPU Usage

Top-right corner display showing:

- Current CPU usage (formatted to 2 decimals)
- Current game tick

### CPU Budget Management

The visual manager implements CPU budget protection:

1. CPU usage tracked before and during rendering
2. Room processing stops when budget exceeded
3. Default budget: 2.0 CPU per tick
4. Configurable via `cpuBudget` option

This ensures visuals don't cause timeout issues even in large multi-room scenarios.

### Integration Example

The `RoomVisualManager` is automatically integrated into the kernel:

```typescript
// In kernel.ts
this.visualManager = new RoomVisualManager({
  enabled: process.env.ROOM_VISUALS_ENABLED === "true" || Memory.experimentalFeatures?.roomVisuals === true
});

// Called after behavior execution
this.visualManager.render(game);
```

## Usage Examples

### Debugging Creep Behavior

Enable visuals to see creep positions and roles:

```javascript
// In console
Memory.experimentalFeatures = { roomVisuals: true };
```

Observe colored circles and labels showing active creeps and their current positions.

### Monitoring Energy Harvesting

Watch the dashed lines from harvesters to sources to verify:

- Harvesters are targeting correct sources
- No idle harvesters without assigned sources
- Efficient source coverage

### Tracking Construction Progress

Green circles with percentage labels show:

- Active construction sites
- Build progress in real-time
- Completed vs. remaining work

### Observing Spawn Activity

Factory emoji and status text above spawns show:

- Which creeps are being spawned
- Time remaining until spawn completes
- Spawn queue activity

## Performance Considerations

### CPU Impact

Visual rendering has minimal CPU impact:

- Default budget: 2.0 CPU per tick
- Early exit if budget exceeded
- Disabled by default for production

### Best Practices

1. **Enable selectively**: Only enable visuals when debugging
2. **Use budget limits**: Keep CPU budget reasonable (1-3 CPU)
3. **Disable in production**: Turn off for deployed bots to maximize performance
4. **Filter features**: Disable unused visual features to save CPU

### Monitoring CPU Usage

The visual manager itself is profiled and tracked. Check CPU impact:

```javascript
// Visual CPU usage appears in profiler data
Game.profiler.output();
```

## Troubleshooting

### Visuals Not Appearing

Check:

1. Visuals enabled via environment or Memory flag?
2. CPU budget sufficient for room count?
3. Game client rendering visuals? (some clients have visual toggles)

### High CPU Usage

Solutions:

1. Reduce CPU budget: `cpuBudget: 1.0`
2. Disable unused features: `showEnergyFlow: false`
3. Disable visuals entirely: `enabled: false`

### Missing Visual Elements

Verify:

1. Correct feature flag enabled (e.g., `showCreepPaths`)
2. Room has relevant entities (creeps, construction sites, etc.)
3. No CPU budget exhaustion mid-render

## Integration with Monitoring

### Combining with Metrics

Visuals complement existing metrics systems:

```typescript
// Metrics provide quantitative data
const snapshot = tracker.end(game, behaviorSummary);

// Visuals provide qualitative feedback
visualManager.render(game);
```

### PTR Telemetry Integration

Visuals work alongside PTR monitoring:

- Metrics track performance trends over time
- Visuals show real-time operational state
- Both help identify and debug issues

### Evaluation System

The evaluation system provides text reports; visuals provide spatial context:

- Evaluation: "High CPU usage detected"
- Visuals: Show which rooms/creeps consuming CPU

## Future Enhancements

Potential improvements for the visual system:

- **Resource flow visualization**: Track energy transfer between structures
- **Threat visualization**: Hostile creep tracking and attack patterns
- **Pathfinding visualization**: Show creep movement paths and obstacles
- **Memory usage heatmap**: Visual representation of per-room memory usage
- **Custom annotations**: User-defined visual markers and labels

## Related Documentation

- [Performance Monitoring](./operations/performance-monitoring.md) - CPU tracking and metrics
- [System Evaluation](../operations/evaluation.md) - Health reports and recommendations
- [Task System](./task-system.md) - Task-based behavior architecture
- [PTR Monitoring](../automation/monitoring.md) - Automated telemetry collection

## API Reference

### Logger

```typescript
class Logger {
  constructor(options?: LoggerOptions);
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
}
```

### RoomVisualManager

```typescript
class RoomVisualManager {
  constructor(config?: RoomVisualConfig);
  render(game: GameContext): void;
}
```

## Summary

The logging and room visuals systems provide comprehensive operational visibility:

- **Structured logging** for console output and debugging
- **Room visuals** for spatial awareness and real-time feedback
- **CPU-conscious design** with configurable budgets
- **Flexible configuration** via environment or Memory flags
- **Seamless integration** with existing runtime systems

Enable these features during development and debugging, then disable for production deployments to maximize bot performance.
