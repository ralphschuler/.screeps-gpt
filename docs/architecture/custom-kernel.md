# Custom TypeScript Kernel Architecture

## Overview

The `screeps-kernel` package implements a custom TypeScript kernel inspired by [screeps-microkernel](https://github.com/riggs/screeps-microkernel) patterns. It provides a decorator-based process management system with type-safe execution contexts and priority-based scheduling.

## Design Goals

### 1. Type Safety

- Generic `ProcessContext<TMemory>` ensures compile-time memory type checking
- Explicit process contracts enforced at type level
- TypeScript strict mode compliance

### 2. Developer Experience

- Decorators reduce boilerplate for registering processes
- Auto-registration via import side-effects simplifies bootstrap
- Clear separation between kernel infrastructure and business logic

### 3. Modularity

- Standalone `screeps-kernel` package enables reuse
- Processes are self-contained modules with explicit dependencies
- Easy to test processes in isolation with mock contexts

### 4. Extensibility

- Priority-based execution ordering
- Singleton vs. multi-instance process support
- CPU budget protection with configurable thresholds

## Architecture Components

### 1. Process Interface

The core contract that all processes must implement:

```typescript
interface Process<TMemory = any> {
  run(ctx: ProcessContext<TMemory>): void;
}
```

### 2. Process Decorator

The `@process` decorator enables automatic registration:

```typescript
@process({ name: "MyProcess", priority: 100, singleton: true })
export class MyProcess implements Process {
  run(ctx: ProcessContext): void {
    // Process logic
  }
}
```

**Decorator Parameters:**

- `name` (required): Unique identifier for the process
- `priority` (required): Execution priority (higher runs first)
- `singleton` (optional): If true, reuse same instance across ticks (default: false)

### 3. ProcessRegistry

Singleton registry that maintains process descriptors:

```typescript
class ProcessRegistry {
  register(descriptor: ProcessDescriptor): void;
  unregister(name: string): boolean;
  get(name: string): ProcessDescriptor | undefined;
  getAll(): ProcessDescriptor[]; // Returns sorted by priority
}
```

**Registration Flow:**

1. `@process` decorator executes at module load time
2. Decorator calls `ProcessRegistry.getInstance().register()`
3. Kernel retrieves processes via `registry.getAll()` on each tick

### 4. ProcessContext

Type-safe execution context passed to processes:

```typescript
interface ProcessContext<TMemory = any> {
  game: GameContext; // Game state interface
  memory: TMemory; // Type-safe memory reference
  logger: Logger; // Diagnostic output
  metrics: MetricsCollector; // Performance tracking
}
```

**Memory Type Safety:**

```typescript
interface MyMemory {
  creeps: Record<string, CreepMemory>;
  stats: { cpu: number; tick: number };
}

@process({ name: "StatsCollector", priority: 10 })
class StatsCollector implements Process<MyMemory> {
  run(ctx: ProcessContext<MyMemory>): void {
    // TypeScript knows about ctx.memory.stats
    ctx.memory.stats = {
      cpu: ctx.game.cpu.getUsed(),
      tick: ctx.game.time
    };
  }
}
```

### 5. Kernel Scheduler

Core scheduler that executes processes in priority order:

```typescript
class Kernel {
  run<TMemory>(game: GameContext, memory: TMemory): void {
    // 1. Get all registered processes sorted by priority
    // 2. For each process:
    //    - Check CPU budget
    //    - Get or create instance (singleton vs per-tick)
    //    - Execute process.run(context)
    //    - Handle errors gracefully
    // 3. Log execution summary
  }
}
```

**Execution Flow:**

1. Retrieve processes from registry (sorted by priority)
2. Create shared ProcessContext
3. Execute each process:
   - Check CPU threshold before execution
   - Instantiate process (cached for singletons)
   - Call `process.run(context)`
   - Track metrics and errors
4. Skip remaining processes if CPU threshold exceeded
5. Log execution summary

## CPU Budget Protection

The kernel implements automatic CPU threshold enforcement:

```typescript
const kernel = new Kernel({
  cpuEmergencyThreshold: 0.9 // Default: stop at 90% CPU usage
});
```

**Protection Strategy:**

1. Check CPU usage before each process execution
2. If `getUsed() > limit * threshold`, skip remaining processes
3. Log warning with execution statistics
4. Gracefully exit without timeout

## Process Lifecycle

### Singleton Processes

```typescript
@process({ name: 'MyProcess', priority: 100, singleton: true })
```

- Instance created once on first execution
- Cached in ProcessDescriptor
- Reused across ticks
- Suitable for stateful managers

### Per-Tick Processes

```typescript
@process({ name: 'MyProcess', priority: 100, singleton: false })
```

- New instance created every tick
- No state preservation between ticks
- Suitable for stateless operations

## Error Handling

The kernel provides graceful error recovery:

```typescript
try {
  process.run(context);
} catch (error) {
  logger.error(`Process '${name}' failed: ${error.message}`);
  // Continue executing other processes
}
```

**Error Isolation:**

- Failed processes don't block other processes
- Errors are logged with stack traces
- Execution summary includes failure count

## Priority Guidelines

Recommended priority ranges for different process types:

- **100+**: Critical systems (memory management, respawn detection)
- **50-99**: Core gameplay (role controllers, spawning)
- **25-49**: Infrastructure (construction planning, roads)
- **1-24**: Optional systems (visuals, statistics)

**Example Priority Assignment:**

```typescript
@process({ name: 'MemoryManager', priority: 100 })       // Critical
@process({ name: 'RespawnManager', priority: 95 })       // Critical
@process({ name: 'RoleControllerManager', priority: 50 }) // Core
@process({ name: 'ConstructionManager', priority: 30 })  // Infrastructure
@process({ name: 'RoomVisuals', priority: 10 })          // Optional
```

## Integration Patterns

### Bootstrap Pattern

```typescript
// main.ts
import { Kernel } from "screeps-kernel";
import "./processes/MemoryManager"; // Import triggers registration
import "./processes/RoleControllerManager";
import "./processes/SpawnManager";

const kernel = new Kernel({ logger: console });

export const loop = () => {
  kernel.run(Game, Memory);
};
```

### Custom Logger Integration

```typescript
import { Kernel, Logger } from "screeps-kernel";
import { MyCustomLogger } from "./logger";

const logger: Logger = new MyCustomLogger();
const kernel = new Kernel({ logger });
```

### Custom Metrics Integration

```typescript
import { Kernel, MetricsCollector } from "screeps-kernel";
import { MyMetricsCollector } from "./metrics";

const metrics: MetricsCollector = new MyMetricsCollector();
const kernel = new Kernel({ metrics });
```

## Migration from Existing Kernel

### Before (Manual Registration)

```typescript
// kernel.ts
export class Kernel {
  private readonly roleManager: RoleControllerManager;
  private readonly memory: MemoryManager;

  constructor() {
    this.roleManager = new RoleControllerManager();
    this.memory = new MemoryManager();
  }

  run(game: GameContext, memory: Memory): void {
    this.memory.prune(memory, game.creeps);
    this.roleManager.execute(game, memory, roleCounts);
  }
}

// main.ts
const kernel = new Kernel();
export const loop = () => kernel.run(Game, Memory);
```

### After (Decorator-Based)

```typescript
// MemoryManager.ts
import { process, ProcessContext } from "screeps-kernel";

@process({ name: "MemoryManager", priority: 100, singleton: true })
export class MemoryManager {
  run(ctx: ProcessContext): void {
    this.prune(ctx.memory, ctx.game.creeps);
  }

  private prune(memory: Memory, creeps: Record<string, Creep>): void {
    // Pruning logic
  }
}

// RoleControllerManager.ts
import { process, ProcessContext } from "screeps-kernel";
import { profile } from "@ralphschuler/screeps-profiler";

@process({ name: "RoleControllerManager", priority: 50, singleton: true })
@profile
export class RoleControllerManager {
  private readonly roleControllers: Map<string, RoleController>;

  constructor() {
    this.roleControllers = new Map();
    // Register all role controllers
    this.registerRoleController(new HarvesterController());
    this.registerRoleController(new UpgraderController());
    // ... more role controllers
  }

  run(ctx: ProcessContext): void {
    const roleCounts = this.countRoles(ctx.game.creeps);
    this.execute(ctx.game, ctx.memory, roleCounts);
  }

  private execute(game: GameContext, memory: Memory, roleCounts: Record<string, number>): BehaviorSummary {
    // Spawn creeps to meet role minimums
    this.ensureRoleMinimums(game, memory, roleCounts);

    // Execute each creep via its role controller
    for (const creep of Object.values(game.creeps)) {
      const controller = this.roleControllers.get(creep.memory.role);
      if (controller) {
        controller.execute(creep);
      }
    }

    return summary;
  }
}

// main.ts
import { Kernel } from "screeps-kernel";
import "./processes/MemoryManager";
import "./processes/RoleControllerManager";

const kernel = new Kernel({ logger: console });
export const loop = () => kernel.run(Game, Memory);
```

### Migration Benefits

1. **Reduced Boilerplate**: No manual dependency injection in constructor
2. **Auto-Discovery**: Processes self-register via decorators
3. **Priority Control**: Explicit priority ordering instead of manual sequencing
4. **Error Isolation**: Failed processes don't crash the entire kernel
5. **Testing**: Easy to test individual processes with mock contexts

## Testing Strategy

### Unit Testing Processes

```typescript
import { describe, it, expect } from "vitest";
import { MyProcess } from "./MyProcess";
import { createProcessContext } from "screeps-kernel";

describe("MyProcess", () => {
  it("should execute logic", () => {
    const process = new MyProcess();
    const ctx = createProcessContext(mockGame, mockMemory);

    process.run(ctx);

    expect(ctx.memory.someValue).toBe(42);
  });
});
```

### Integration Testing Kernel

```typescript
import { describe, it, expect } from "vitest";
import { Kernel, process, ProcessContext } from "screeps-kernel";

describe("Kernel Integration", () => {
  it("should execute processes in priority order", () => {
    const executionOrder: string[] = [];

    @process({ name: "Low", priority: 10 })
    class LowPriority {
      run(_ctx: ProcessContext): void {
        executionOrder.push("Low");
      }
    }

    @process({ name: "High", priority: 100 })
    class HighPriority {
      run(_ctx: ProcessContext): void {
        executionOrder.push("High");
      }
    }

    const kernel = new Kernel();
    kernel.run(mockGame, mockMemory);

    expect(executionOrder).toEqual(["High", "Low"]);
  });
});
```

## Performance Considerations

### Memory Overhead

- ProcessRegistry: ~100 bytes per registered process
- Singleton instances: Cached in memory between ticks
- Per-tick instances: Created and garbage collected each tick

### CPU Overhead

- Decorator registration: One-time cost at module load
- Process lookup: O(n log n) for initial sort, O(1) for cached list
- Instance creation: ~0.01 CPU for singletons (first tick only), ~0.05 CPU for per-tick

### Optimization Strategies

1. Use singletons for stateful managers to avoid recreation overhead
2. Set appropriate CPU thresholds based on bucket size
3. Profile individual processes to identify bottlenecks
4. Consider process priority to ensure critical operations complete first

## Design Decisions

### Why Decorators?

- **Declarative**: Process configuration is co-located with implementation
- **Auto-Registration**: No manual kernel configuration required
- **Type Safety**: Decorator parameters are type-checked at compile time
- **Precedent**: Existing profiler already uses `@profile` decorator

### Why Singleton Registry?

- **Global State**: Process registration must persist across imports
- **Import Order Independence**: Processes register when imported, order doesn't matter
- **Testing**: Can clear registry between tests for isolation

### Why Generic ProcessContext?

- **Type Safety**: Compile-time memory type checking prevents errors
- **Flexibility**: Different processes can use different memory structures
- **Inference**: TypeScript infers memory type from context usage

### Why Priority-Based Scheduling?

- **Explicit Control**: Priority numbers are clearer than manual ordering
- **Flexibility**: Easy to insert new processes at specific priority levels
- **CPU Protection**: High-priority processes run first, ensuring critical operations complete

## Limitations and Trade-offs

### Limitations

1. **Decorator Overhead**: Small runtime cost for decorator execution
2. **Global Registry**: All processes share single registry (mitigated by process names)
3. **No Dynamic Priority**: Process priority is fixed at registration time
4. **No Process Communication**: Processes must use shared memory for coordination

### Trade-offs

1. **Auto-Registration vs Explicit**: Trades manual configuration for import side-effects
2. **Generics vs Concrete Types**: Trades type safety for flexibility
3. **CPU Protection vs Completion**: Trades guaranteed completion for timeout prevention
4. **Singletons vs Fresh Instances**: Trades memory for CPU and state preservation

## Future Enhancements

### Potential Improvements

1. **Process Dependencies**: Declare explicit dependencies between processes
2. **Dynamic Priority**: Adjust process priority based on game state
3. **Process Groups**: Execute groups of related processes together
4. **Conditional Execution**: Skip processes based on game state predicates
5. **Process Metrics**: Built-in CPU and execution time tracking per process
6. **Process Events**: Pub/sub system for inter-process communication

### Not Planned

- **Async/Promises**: Screeps is synchronous, async adds complexity without benefit
- **Process Pools**: Single kernel per game loop is sufficient
- **Dynamic Loading**: All processes must be bundled for Screeps deployment

## References

- **Inspiration**: [screeps-microkernel](https://github.com/riggs/screeps-microkernel) - JavaScript-based kernel patterns
- **TypeScript Decorators**: [TC39 Proposal](https://github.com/tc39/proposal-decorators) - Decorator specification
- **Screeps API**: [Official Docs](https://docs.screeps.com/) - Game API reference

## Related Issues

- #627 - Decorator-based kernel architecture (CLOSED - similar proposal with state machines)
- #454 - Screeps ecosystem package research (evaluation of community patterns)
- #634 - Kernel integration tests (testing infrastructure for new kernel)
- #801 - Critical runtime components lack test coverage (kernel testing needs)
- #1267 - State machine migration (complete removal of BehaviorController)
- #1261 - Document creep behavior modularity

## State Machine Integration

The kernel integrates with the state machine-based behavior architecture via `RoleControllerManager`. Each creep role is implemented as:

- **State Machine**: Defines behavior states and transitions (in `stateMachines/`)
- **Role Controller**: Implements `RoleController` interface (in `controllers/`)
- **Manager**: `RoleControllerManager` orchestrates all roles as a kernel process

For details, see:
- [ADR-004: State Machine Architecture](../../docs/strategy/decisions/adr-004-state-machine-behavior-architecture.md)
- [Behavior State Machines Documentation](../../packages/docs/source/docs/runtime/architecture/behavior-state-machines.md)
- [Behavior Migration Guide](../../packages/docs/source/docs/operations/behavior-migration-guide.md)

**Note**: The `BehaviorController` pattern shown in earlier migration examples is **deprecated and removed** (Issue #1267). All new development should use the state machine architecture with `RoleControllerManager`.

## Conclusion

The `screeps-kernel` package provides a modern, type-safe approach to process management in Screeps. By leveraging TypeScript decorators, generic types, and priority-based scheduling, it enables modular, testable, and maintainable AI architectures. The kernel seamlessly integrates with the state machine-based behavior system for clear separation of concerns and independent role development.
