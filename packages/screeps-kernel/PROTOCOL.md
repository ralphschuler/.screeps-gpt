# Protocol System

The protocol system provides type-safe inter-process communication (IPC) for the screeps-kernel. Protocols enable processes to share data and coordinate actions without using Memory, reducing serialization overhead and improving code organization.

## Overview

The protocol system uses a **mixin pattern** where multiple protocol classes are combined into a single unified interface that's attached to the `ProcessContext`. Each process can access all registered protocols through `ctx.protocol`.

### Key Features

- **Type Safety**: Define TypeScript interfaces for protocols to catch errors at compile time
- **Zero Memory Cost**: Protocols use regular JavaScript objects instead of Memory
- **State Persistence**: Protocol instances persist across ticks as singletons
- **Mixin Composition**: Combine multiple protocols into one interface
- **Decorator-Based**: Simple `@protocol` decorator for registration
- **Separation of Concerns**: Keep IPC logic separate from business logic

## Basic Usage

### 1. Define a Protocol Interface

Start by defining a TypeScript interface for your protocol. This provides compile-time type checking:

```typescript
interface IMessageProtocol {
  sendMessage(target: string, message: string): void;
  getMessages(target: string): string[];
}
```

### 2. Implement the Protocol

Create a class that implements the interface and decorate it with `@protocol`:

```typescript
import { protocol } from "screeps-kernel";

@protocol({ name: "MessageProtocol" })
export class MessageProtocol implements IMessageProtocol {
  private inbox: Map<string, string[]> = new Map();

  sendMessage(target: string, message: string): void {
    if (!this.inbox.has(target)) {
      this.inbox.set(target, []);
    }
    this.inbox.get(target)!.push(message);
  }

  getMessages(target: string): string[] {
    return this.inbox.get(target) ?? [];
  }
}
```

### 3. Use the Protocol in Processes

Access the protocol through `ctx.protocol` in your process's `run` method:

```typescript
import { process, ProcessContext } from "screeps-kernel";

@process({ name: "SenderProcess", priority: 100, singleton: true })
export class SenderProcess {
  run(ctx: ProcessContext<Memory, IMessageProtocol>): void {
    // TypeScript knows about sendMessage
    ctx.protocol.sendMessage("defense", "Enemy spotted!");
  }
}

@process({ name: "ReceiverProcess", priority: 50, singleton: true })
export class ReceiverProcess {
  run(ctx: ProcessContext<Memory, IMessageProtocol>): void {
    // TypeScript knows about getMessages
    const messages = ctx.protocol.getMessages("defense");
    messages.forEach(msg => console.log(msg));
  }
}
```

### 4. Bootstrap

Import protocols before the kernel initialization:

```typescript
import { Kernel } from "screeps-kernel";
import "./MessageProtocol"; // Triggers @protocol decorator
import "./SenderProcess"; // Triggers @process decorator
import "./ReceiverProcess"; // Triggers @process decorator

const kernel = new Kernel({ logger: console });
export const loop = () => kernel.run(Game, Memory);
```

## Advanced Usage

### Multiple Protocols

You can register multiple protocols and access them all through `ctx.protocol`:

```typescript
// Define protocol interfaces
interface ILoggingProtocol {
  log(message: string): void;
  getLogs(): string[];
}

interface IStatsProtocol {
  recordStat(name: string, value: number): void;
  getStat(name: string): number | undefined;
}

// Combine interfaces
interface ICombinedProtocol extends ILoggingProtocol, IStatsProtocol {}

// Implement protocols
@protocol({ name: "LoggingProtocol" })
export class LoggingProtocol implements ILoggingProtocol {
  private logs: string[] = [];

  log(message: string): void {
    this.logs.push(message);
  }

  getLogs(): string[] {
    return this.logs;
  }
}

@protocol({ name: "StatsProtocol" })
export class StatsProtocol implements IStatsProtocol {
  private stats = new Map<string, number>();

  recordStat(name: string, value: number): void {
    this.stats.set(name, value);
  }

  getStat(name: string): number | undefined {
    return this.stats.get(name);
  }
}

// Use both protocols
@process({ name: "MultiProtocolProcess", priority: 100 })
export class MultiProtocolProcess {
  run(ctx: ProcessContext<Memory, ICombinedProtocol>): void {
    ctx.protocol.log("Starting process");
    ctx.protocol.recordStat("cpu_start", ctx.game.cpu.getUsed());
    // ... do work ...
    ctx.protocol.recordStat("cpu_end", ctx.game.cpu.getUsed());
  }
}
```

### State Management

Protocol instances are singletons that persist across ticks. Use this to maintain state:

```typescript
@protocol({ name: "CounterProtocol" })
export class CounterProtocol {
  private tickCount = 0;

  incrementTick(): void {
    this.tickCount++;
  }

  getTickCount(): number {
    return this.tickCount;
  }

  reset(): void {
    this.tickCount = 0;
  }
}
```

### Request-Response Pattern

Implement request-response patterns between processes:

```typescript
interface ITaskProtocol {
  requestTask(processName: string, taskType: string): void;
  assignTask(processName: string, task: Task): void;
  getAssignedTask(processName: string): Task | undefined;
}

@protocol({ name: "TaskProtocol" })
export class TaskProtocol implements ITaskProtocol {
  private requests = new Map<string, string>();
  private assignments = new Map<string, Task>();

  requestTask(processName: string, taskType: string): void {
    this.requests.set(processName, taskType);
  }

  assignTask(processName: string, task: Task): void {
    this.assignments.set(processName, task);
    this.requests.delete(processName);
  }

  getAssignedTask(processName: string): Task | undefined {
    return this.assignments.get(processName);
  }
}
```

## Design Patterns

### Publisher-Subscriber

```typescript
interface IEventProtocol {
  subscribe(event: string, subscriber: string): void;
  publish(event: string, data: any): void;
  getEvents(subscriber: string): Array<{ event: string; data: any }>;
}

@protocol({ name: "EventProtocol" })
export class EventProtocol implements IEventProtocol {
  private subscriptions = new Map<string, Set<string>>();
  private events = new Map<string, Array<{ event: string; data: any }>>();

  subscribe(event: string, subscriber: string): void {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }
    this.subscriptions.get(event)!.add(subscriber);
  }

  publish(event: string, data: any): void {
    const subscribers = this.subscriptions.get(event) ?? new Set();
    for (const subscriber of subscribers) {
      if (!this.events.has(subscriber)) {
        this.events.set(subscriber, []);
      }
      this.events.get(subscriber)!.push({ event, data });
    }
  }

  getEvents(subscriber: string): Array<{ event: string; data: any }> {
    const events = this.events.get(subscriber) ?? [];
    this.events.delete(subscriber); // Clear after reading
    return events;
  }
}
```

### Service Locator

```typescript
interface IServiceProtocol {
  registerService<T>(name: string, service: T): void;
  getService<T>(name: string): T | undefined;
  hasService(name: string): boolean;
}

@protocol({ name: "ServiceProtocol" })
export class ServiceProtocol implements IServiceProtocol {
  private services = new Map<string, any>();

  registerService<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  getService<T>(name: string): T | undefined {
    return this.services.get(name);
  }

  hasService(name: string): boolean {
    return this.services.has(name);
  }
}
```

## Best Practices

### 1. Define Interfaces First

Always define TypeScript interfaces for your protocols:

```typescript
// ✅ Good: Type-safe
interface IMyProtocol {
  doSomething(param: string): void;
}

@protocol({ name: "MyProtocol" })
export class MyProtocol implements IMyProtocol {
  doSomething(param: string): void {}
}

// ❌ Bad: No type safety
@protocol({ name: "MyProtocol" })
export class MyProtocol {
  doSomething(param: string): void {}
}
```

### 2. Keep Protocols Focused

Each protocol should have a single responsibility:

```typescript
// ✅ Good: Focused protocols
interface IMessageProtocol { ... }
interface IStatsProtocol { ... }

// ❌ Bad: Kitchen sink protocol
interface IGodProtocol {
  sendMessage(...): void;
  recordStat(...): void;
  manageCreeps(...): void;
  // ... too many responsibilities
}
```

### 3. Use Descriptive Names

Protocol and method names should clearly indicate their purpose:

```typescript
// ✅ Good: Clear intent
@protocol({ name: "CreepTaskCoordinationProtocol" })
export class CreepTaskCoordinationProtocol {
  assignTaskToCreep(creepName: string, task: Task): void {}
}

// ❌ Bad: Unclear
@protocol({ name: "Protocol1" })
export class Protocol1 {
  do(x: string, y: any): void {}
}
```

### 4. Handle Edge Cases

Always handle missing data and edge cases:

```typescript
@protocol({ name: "DataProtocol" })
export class DataProtocol {
  private data = new Map<string, string>();

  getData(key: string): string | undefined {
    // ✅ Return undefined for missing keys
    return this.data.get(key);
  }

  getDataOrDefault(key: string, defaultValue: string): string {
    // ✅ Provide default values
    return this.data.get(key) ?? defaultValue;
  }
}
```

### 5. Consider Memory Usage

While protocols don't use Memory, they still use heap memory:

```typescript
@protocol({ name: "HistoryProtocol" })
export class HistoryProtocol {
  private history: string[] = [];

  addHistory(entry: string): void {
    this.history.push(entry);

    // ✅ Limit history size to prevent unbounded growth
    if (this.history.length > 1000) {
      this.history.shift();
    }
  }
}
```

## Migration Guide

### From Memory-Based Communication

**Before:**

```typescript
@process({ name: "ProducerProcess", priority: 100 })
export class ProducerProcess {
  run(ctx: ProcessContext): void {
    if (!ctx.memory.messages) {
      ctx.memory.messages = {};
    }
    ctx.memory.messages.defense = ["Enemy spotted!"];
  }
}

@process({ name: "ConsumerProcess", priority: 50 })
export class ConsumerProcess {
  run(ctx: ProcessContext): void {
    const messages = ctx.memory.messages?.defense ?? [];
    messages.forEach(msg => console.log(msg));
  }
}
```

**After:**

```typescript
@protocol({ name: "MessageProtocol" })
export class MessageProtocol {
  private messages = new Map<string, string[]>();

  sendMessages(channel: string, messages: string[]): void {
    this.messages.set(channel, messages);
  }

  getMessages(channel: string): string[] {
    return this.messages.get(channel) ?? [];
  }
}

@process({ name: "ProducerProcess", priority: 100 })
export class ProducerProcess {
  run(ctx: ProcessContext<Memory, IMessageProtocol>): void {
    ctx.protocol.sendMessages("defense", ["Enemy spotted!"]);
  }
}

@process({ name: "ConsumerProcess", priority: 50 })
export class ConsumerProcess {
  run(ctx: ProcessContext<Memory, IMessageProtocol>): void {
    const messages = ctx.protocol.getMessages("defense");
    messages.forEach(msg => console.log(msg));
  }
}
```

**Benefits:**

- No Memory serialization overhead
- Type-safe at compile time
- Clear separation of concerns
- Easier to test

## Testing Protocols

Protocols can be tested independently:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MessageProtocol } from "./MessageProtocol";

describe("MessageProtocol", () => {
  let protocol: MessageProtocol;

  beforeEach(() => {
    protocol = new MessageProtocol();
  });

  it("should send and receive messages", () => {
    protocol.sendMessage("defense", "Enemy spotted!");
    const messages = protocol.getMessages("defense");
    expect(messages).toEqual(["Enemy spotted!"]);
  });

  it("should support multiple channels", () => {
    protocol.sendMessage("defense", "Message 1");
    protocol.sendMessage("economy", "Message 2");

    expect(protocol.getMessages("defense")).toEqual(["Message 1"]);
    expect(protocol.getMessages("economy")).toEqual(["Message 2"]);
  });
});
```

## Troubleshooting

### Protocol Methods Not Found

**Problem:** `ctx.protocol.myMethod is not a function`

**Solution:** Ensure the protocol is imported before kernel initialization:

```typescript
import "./MyProtocol"; // Must be before kernel.run()
```

### Type Errors

**Problem:** TypeScript complains about protocol methods

**Solution:** Specify the protocol interface in ProcessContext:

```typescript
// Before (no type safety)
run(ctx: ProcessContext): void {
  ctx.protocol.sendMessage(...);  // TypeScript doesn't know about this
}

// After (type-safe)
run(ctx: ProcessContext<Memory, IMessageProtocol>): void {
  ctx.protocol.sendMessage(...);  // TypeScript knows the interface
}
```

### State Not Persisting

**Problem:** Protocol state resets each tick

**Cause:** Protocol instances are singleton by design. If state is resetting, check for:

1. Accidental re-registration with different name
2. Clearing the ProtocolRegistry in production code

## API Reference

### @protocol Decorator

```typescript
@protocol(config: ProtocolConfig)
```

**Config:**

- `name` (string, required): Unique identifier for the protocol

### ProtocolRegistry

```typescript
class ProtocolRegistry {
  static getInstance(): ProtocolRegistry;
  register(descriptor: ProtocolDescriptor): void;
  unregister(name: string): boolean;
  get(name: string): ProtocolDescriptor | undefined;
  getAll(): ProtocolDescriptor[];
  clear(): void;
  size(): number;
  combineProtocols(): Record<string, unknown>;
}
```

### ProcessContext

```typescript
interface ProcessContext<TMemory = any, TProtocol = any> {
  game: GameContext;
  memory: TMemory;
  logger: Logger;
  metrics: MetricsCollector;
  protocol: TProtocol; // Combined protocol interface
}
```

## See Also

- [README.md](./README.md) - Main kernel documentation
- [examples/protocol-example.ts](./examples/protocol-example.ts) - Complete working example
- [tests/protocol-integration.test.ts](./tests/protocol-integration.test.ts) - Integration tests
