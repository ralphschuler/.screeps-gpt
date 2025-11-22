# screeps-kernel

Custom TypeScript kernel with decorator-based API for Screeps AI automation. Inspired by [screeps-microkernel](https://github.com/riggs/screeps-microkernel) patterns, designed for type safety and modularity.

## Features

- **Decorator-Based Registration**: Use `@process` and `@protocol` decorators for automatic registration
- **Type-Safe Contexts**: Generic `ProcessContext<TMemory, TProtocol>` ensures compile-time type checking
- **Inter-Process Communication**: Protocol system enables type-safe communication between processes
- **Protocol Mixins**: Combine multiple protocols into a unified interface
- **Priority-Based Scheduling**: Processes execute in priority order (highest first)
- **CPU Budget Protection**: Automatic CPU threshold enforcement prevents script timeouts
- **Singleton Support**: Choose between singleton or per-tick instance creation
- **Error Handling**: Graceful error recovery without stopping other processes
- **Zero Dependencies**: Standalone package with minimal footprint

## Installation

```bash
bun add screeps-kernel
```

## Basic Usage

```typescript
import { Kernel, process, ProcessContext } from "screeps-kernel";

// Define a process with decorator
@process({ name: "BehaviorController", priority: 50, singleton: true })
export class BehaviorController {
  run(ctx: ProcessContext): void {
    ctx.logger.log("Executing behavior logic");
    // Creep behavior logic
  }
}

// Define another process
@process({ name: "MemoryManager", priority: 100, singleton: true })
export class MemoryManager {
  run(ctx: ProcessContext): void {
    ctx.logger.log("Managing memory");
    // Memory management logic
  }
}

// Bootstrap kernel
import "./BehaviorController"; // Import triggers decorator registration
import "./MemoryManager";

const kernel = new Kernel({ logger: console });
export const loop = () => kernel.run(Game, Memory);
```

## Type-Safe Memory

Use generic types for compile-time memory safety:

```typescript
interface MyMemory {
  creeps: Record<string, CreepMemory>;
  stats: {
    cpu: number;
    tick: number;
  };
}

@process({ name: "StatsCollector", priority: 10 })
export class StatsCollector {
  run(ctx: ProcessContext<MyMemory>): void {
    // TypeScript knows about ctx.memory.stats
    ctx.memory.stats = {
      cpu: ctx.game.cpu.getUsed(),
      tick: ctx.game.time
    };
  }
}
```

## Inter-Process Communication with Protocols

The protocol system enables type-safe inter-process communication using the `@protocol` decorator:

```typescript
import { protocol, process, ProcessContext } from "screeps-kernel";

// Define a protocol interface for type safety
interface IMessageProtocol {
  sendMessage(target: string, message: string): void;
  getMessages(target: string): string[];
}

// Implement the protocol
@protocol({ name: "MessageProtocol" })
export class MessageProtocol implements IMessageProtocol {
  private messages: Map<string, string[]> = new Map();

  sendMessage(target: string, message: string): void {
    if (!this.messages.has(target)) {
      this.messages.set(target, []);
    }
    this.messages.get(target)!.push(message);
  }

  getMessages(target: string): string[] {
    return this.messages.get(target) ?? [];
  }
}

// Process 1: Send messages
@process({ name: "SenderProcess", priority: 100, singleton: true })
export class SenderProcess {
  run(ctx: ProcessContext<Memory, IMessageProtocol>): void {
    ctx.protocol.sendMessage("room1", "Attack incoming!");
  }
}

// Process 2: Receive messages
@process({ name: "ReceiverProcess", priority: 50, singleton: true })
export class ReceiverProcess {
  run(ctx: ProcessContext<Memory, IMessageProtocol>): void {
    const messages = ctx.protocol.getMessages("room1");
    messages.forEach(msg => ctx.logger.log(msg));
  }
}

// Bootstrap - import protocols before kernel
import "./MessageProtocol";
import "./SenderProcess";
import "./ReceiverProcess";

const kernel = new Kernel({ logger: console });
export const loop = () => kernel.run(Game, Memory);
```

### Protocol Benefits

- **Type Safety**: Define interfaces for your protocols to catch errors at compile time
- **Clear Separation**: Isolate communication logic from business logic
- **Mixin Pattern**: Combine multiple protocols into a unified interface
- **State Persistence**: Protocol instances maintain state across ticks
- **No Memory Overhead**: Protocols don't use Memory, reducing serialization costs

### Multiple Protocols

You can register multiple protocols that will be combined into one interface:

```typescript
@protocol({ name: "LoggingProtocol" })
export class LoggingProtocol {
  private logs: string[] = [];

  log(message: string): void {
    this.logs.push(message);
  }

  getLogs(): string[] {
    return this.logs;
  }
}

@protocol({ name: "CounterProtocol" })
export class CounterProtocol {
  private count = 0;

  increment(): void {
    this.count++;
  }

  getCount(): number {
    return this.count;
  }
}

// Define combined interface for type safety
interface ICombinedProtocol {
  log(message: string): void;
  getLogs(): string[];
  increment(): void;
  getCount(): number;
}

// Process can access all protocol methods with type safety
@process({ name: "MultiProtocolProcess", priority: 100 })
export class MultiProtocolProcess {
  run(ctx: ProcessContext<Memory, ICombinedProtocol>): void {
    ctx.protocol.log("Processing...");
    ctx.protocol.increment();
  }
}
```

## Configuration

### Process Configuration

- **name** (required): Unique identifier for the process
- **priority** (required): Execution priority (higher runs first)
- **singleton** (optional): If `true`, reuse same instance across ticks (default: `false`)

```typescript
@process({
  name: 'MyProcess',
  priority: 75,
  singleton: true
})
```

### Protocol Configuration

- **name** (required): Unique identifier for the protocol

```typescript
@protocol({
  name: 'MyProtocol'
})
```

Protocols are always singleton - they maintain state across all ticks and are shared by all processes.

### Kernel Configuration

```typescript
const kernel = new Kernel({
  logger: console, // Custom logger (optional)
  metrics: myMetricsCollector, // Custom metrics collector (optional)
  cpuEmergencyThreshold: 0.85 // CPU threshold 0-1 (default: 0.9)
});
```

## Process Lifecycle

1. **Registration**: Decorators register processes on import
2. **Instantiation**: Kernel creates instances (singleton or per-tick)
3. **Execution**: Processes run in priority order
4. **Error Handling**: Failed processes don't block others
5. **CPU Protection**: Execution stops if CPU threshold exceeded

## Priority Guidelines

- **100+**: Critical systems (memory management, respawn detection)
- **50-99**: Core gameplay (behavior controllers, spawning)
- **25-49**: Infrastructure (construction planning, roads)
- **1-24**: Optional systems (visuals, statistics)

## Migration from Existing Kernel

### Before (Manual Registration)

```typescript
// kernel.ts
export class Kernel {
  private readonly behavior: BehaviorController;
  private readonly memory: MemoryManager;

  constructor() {
    this.behavior = new BehaviorController();
    this.memory = new MemoryManager();
  }

  run(game: GameContext, memory: Memory): void {
    this.memory.prune(memory, game.creeps);
    this.behavior.execute(game, memory);
  }
}
```

### After (Decorator-Based)

```typescript
// BehaviorController.ts
@process({ name: "BehaviorController", priority: 50, singleton: true })
export class BehaviorController {
  run(ctx: ProcessContext): void {
    // Use ctx.game, ctx.memory, ctx.logger
  }
}

// MemoryManager.ts
@process({ name: "MemoryManager", priority: 100, singleton: true })
export class MemoryManager {
  run(ctx: ProcessContext): void {
    // Memory management logic
  }
}

// main.ts
import { Kernel } from "screeps-kernel";
import "./BehaviorController";
import "./MemoryManager";

const kernel = new Kernel({ logger: console });
export const loop = () => kernel.run(Game, Memory);
```

## Testing

The kernel package includes comprehensive unit tests:

```bash
cd packages/kernel
bun test
```

## Architecture

- **Kernel**: Core scheduler and process manager
- **ProcessRegistry**: Singleton registry for process descriptors
- **@process**: Class decorator for auto-registration
- **ProcessContext**: Type-safe execution context
- **Process Interface**: Contract for all processes

## License

MIT

## Contributing

See the main repository [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.
