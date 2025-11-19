# @ralphschuler/screeps-bot

A reference implementation of a modular Screeps bot demonstrating best practices for composing standalone `screeps-*` packages with the kernel-based process system.

## Features

- ✅ **Kernel-Based Architecture**: Uses `@ralphschuler/screeps-kernel` for process orchestration
- ✅ **Decorator Registration**: Processes automatically registered with `@process` decorator
- ✅ **State Machines**: Demonstrates `screeps-xstate` for creep behavior
- ✅ **Decision Trees**: Demonstrates `screeps-xtree` for strategic decisions
- ✅ **Modular Design**: Each process is independent and loosely coupled
- ✅ **Enhanced DX**: Clean, maintainable code with excellent developer experience
- ✅ **Logging**: Structured logging with `screeps-logger`
- ✅ **Profiling**: CPU profiling with `screeps-profiler`

## Architecture

```
@ralphschuler/screeps-bot
├── main.ts                    # Entry point, kernel initialization
└── processes/                 # Process implementations
    ├── HarvesterProcess.ts   # Energy harvesting (screeps-xstate)
    └── BuilderProcess.ts     # Construction (screeps-xtree)
```

### How It Works

1. **Kernel Orchestration**: The kernel manages process lifecycle and execution
2. **Decorator Registration**: Processes use `@process` decorator for automatic registration
3. **Priority-Based Execution**: Processes run in priority order (higher first)
4. **Package Integration**: Each process demonstrates one or more screeps-* packages

## Installation

```bash
# In the monorepo
bun install
```

## Usage

### Basic Usage

```typescript
import { loop } from "@ralphschuler/screeps-bot";

// Export for Screeps runtime
export { loop };
```

### Creating a Process

Use the `@process` decorator to create a new process:

```typescript
import { process } from "@ralphschuler/screeps-kernel";
import type { ProcessContext } from "@ralphschuler/screeps-kernel";

@process({ name: "MyProcess", priority: 30, singleton: true })
export class MyProcess {
  public run(ctx: ProcessContext): void {
    ctx.logger.log("[MyProcess] Running");
    
    // Your process logic here
    // Access to ctx.game, ctx.memory, ctx.logger
  }
}
```

Then import it in `main.ts` to trigger registration:

```typescript
import "./processes/MyProcess";
```

## Implemented Processes

### 1. RoomProcess (Decision Trees) - Priority 70

Strategic room management using `screeps-xtree`:

```typescript
@process({ name: "Room", priority: 70, singleton: true })
export class RoomProcess {
  // Uses decision trees to determine:
  // - When to spawn harvesters, builders, upgraders
  // - When to enter defense mode
  // - When to expand or consolidate
}
```

**Decision Flow:**
1. Emergency: Hostiles present → Defend
2. No harvesters → Spawn harvester (critical)
3. < 2 harvesters → Spawn harvester
4. < 2 builders → Spawn builder
5. < 1 upgrader → Spawn upgrader
6. Level 6+ → Expand
7. Level 3+ → Consolidate
8. Otherwise → Idle

### 2. TowerProcess (State Machines) - Priority 60

Tower defense using `screeps-xstate`:

```typescript
@process({ name: "Tower", priority: 60, singleton: true })
export class TowerProcess {
  // Uses state machines for:
  // - Detecting and engaging hostiles
  // - Repairing damaged structures
  // - Priority-based action selection
}
```

**States:**
- `idle` → Check for threats
- `finding_hostile` → Locate enemy creeps
- `attacking` → Engage hostiles (highest priority)
- `finding_damaged` → Locate damaged structures
- `repairing` → Repair structures (lower priority)

### 3. HarvesterProcess (State Machines) - Priority 50

Energy harvesting using `screeps-xstate` for state-based creep behavior:

```typescript
@process({ name: "Harvester", priority: 50, singleton: true })
export class HarvesterProcess {
  private machines: Map<string, StateMachine> = new Map();

  public run(ctx: ProcessContext): void {
    // Uses state machines for:
    // idle -> finding_source -> harvesting -> returning -> delivering -> idle
  }
}
```

**Features:**
- State-based behavior (idle, finding, harvesting, returning, delivering)
- Automatic state transitions with guards
- Visual feedback with creep.say()

### 4. BuilderProcess (Decision Trees) - Priority 40

Demonstrates `screeps-xtree` for prioritized decision-making:

```typescript
@process({ name: "Builder", priority: 40, singleton: true })
export class BuilderProcess {
  private decisionTree: DecisionTree;

  public run(ctx: ProcessContext): void {
    // Uses decision tree to prioritize:
    // 1. Has energy? No -> harvest
    // 2. Construction sites? Yes -> build
    // 3. Damaged structures? Yes -> repair
    // 4. Controller needs upgrade? Yes -> upgrade
    // 5. Otherwise -> idle
  }
}
```

**Features:**
- Priority-based decision making
- Dynamic context evaluation
- Efficient action selection

### 5. ScoutProcess (Async Tasks) - Priority 20

Room exploration using `screeps-async`:

```typescript
@process({ name: "Scout", priority: 20, singleton: true })
export class ScoutProcess {
  // Uses async/await patterns for:
  // - Multi-tick room exploration
  // - CPU-intensive pathfinding
  // - Distributed task execution
}
```

**Async Task Flow:**
1. **Phase 1:** Find unexplored room (CPU intensive)
2. **Phase 2:** Navigate to target (multi-tick movement)
3. **Phase 3:** Explore room (scan sources, controller, hostiles)

Each phase yields control between ticks, distributing CPU load.

## Package Integration

This bot demonstrates integration of:

| Package | Usage | Where Used |
|---------|-------|------------|
| `screeps-kernel` | Process orchestration | All processes via `@process` decorator |
| `screeps-xstate` | State machines | HarvesterProcess, TowerProcess |
| `screeps-xtree` | Decision trees | RoomProcess, BuilderProcess |
| `screeps-async` | Multi-tick ops | ScoutProcess (exploration tasks) |
| `screeps-logger` | Structured logging | All processes via ctx.logger |
| `screeps-cache` | Caching | *(Available for optimization)* |
| `screeps-perf` | Performance | *(Available for optimization)* |
| `screeps-metrics` | Telemetry | *(Available for monitoring)* |
| `screeps-profiler` | CPU profiling | *(Available for analysis)* |

## Configuration

### Process Priority

Processes execute in priority order (higher numbers run first):

- **100+**: Critical systems (memory management, respawn detection)
- **50-99**: Core gameplay (harvesting, spawning)
- **25-49**: Infrastructure (building, upgrading)
- **1-24**: Optional systems (visuals, statistics)

### Singleton vs Per-Tick

- **Singleton (`singleton: true`)**: Instance reused across ticks (better performance)
- **Per-Tick (`singleton: false`)**: New instance every tick (fresh state)

```typescript
@process({ 
  name: "MyProcess", 
  priority: 50, 
  singleton: true  // <-- Reuse instance
})
```

## Development

### Building

```bash
cd packages/screeps-bot
bun run build
```

### Testing

```bash
bun run test
bun run test:watch
bun run test:coverage
```

### Adding a New Process

1. Create a new file in `src/processes/`
2. Implement the process with `@process` decorator
3. Import in `main.ts` to register
4. Build and test

Example:

```typescript
// src/processes/UpgraderProcess.ts
import { process } from "@ralphschuler/screeps-kernel";
import type { ProcessContext } from "@ralphschuler/screeps-kernel";

@process({ name: "Upgrader", priority: 35, singleton: true })
export class UpgraderProcess {
  public run(ctx: ProcessContext): void {
    // Implementation
  }
}
```

```typescript
// src/main.ts
import "./processes/UpgraderProcess";  // <-- Add this line
```

## Best Practices

1. **Use Decorators**: Always use `@process` decorator for registration
2. **Singleton for Stateful**: Use `singleton: true` for processes with persistent state
3. **Log Appropriately**: Use `ctx.logger` for structured logging
4. **Priority Matters**: Set appropriate priority based on criticality
5. **Package Integration**: Leverage screeps-* packages instead of custom logic
6. **Error Handling**: Kernel provides error boundaries, but handle expected errors
7. **Memory Management**: Kernel handles Memory, processes read/write as needed

## Deployment

The bot can be deployed using standard Screeps deployment:

```bash
# From repository root
bun run deploy
```

Or configure deployment in your Screeps client to use `dist/main.js`.

## Performance

- **CPU Efficient**: Kernel provides CPU management
- **Lazy Initialization**: Processes only instantiate when needed
- **Singleton Support**: Reduce instantiation overhead
- **Profiling**: Built-in profiler tracks CPU usage

## Future Enhancements

Planned process additions:

- [ ] **UpgraderProcess**: Dedicated controller upgrading
- [ ] **DefenseProcess**: Tower and combat management (screeps-async)
- [ ] **LogisticsProcess**: Resource distribution (screeps-cache)
- [ ] **ScoutProcess**: Room exploration and mapping
- [ ] **SpawnProcess**: Creep spawning management
- [ ] **StatsProcess**: Metrics and telemetry (screeps-metrics)

## Contributing

This is a reference implementation. Contributions welcome following monorepo guidelines.

## License

MIT © OpenAI Automations

## Related Packages

- [@ralphschuler/screeps-kernel](../screeps-kernel) - Process orchestration core
- [@ralphschuler/screeps-xstate](../screeps-xstate) - State machines
- [@ralphschuler/screeps-xtree](../screeps-xtree) - Decision trees
- [@ralphschuler/screeps-async](../screeps-async) - Multi-tick operations
- [@ralphschuler/screeps-logger](../screeps-logger) - Structured logging
- [@ralphschuler/screeps-profiler](../screeps-profiler) - CPU profiling
- [@ralphschuler/screeps-cache](../screeps-cache) - Heap/memory caching
- [@ralphschuler/screeps-perf](../screeps-perf) - Performance optimization
- [@ralphschuler/screeps-metrics](../screeps-metrics) - Telemetry
