/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import { describe, it, expect, beforeEach } from "vitest";
import { Kernel } from "../src/Kernel";
import { process, protocol } from "../src/decorators";
import { ProcessRegistry } from "../src/ProcessRegistry";
import { ProtocolRegistry } from "../src/ProtocolRegistry";
import type { ProcessContext, GameContext } from "../src/types";

// Mock game context for testing
const createMockGame = (): GameContext => ({
  time: 1000,
  cpu: {
    getUsed: () => 10,
    limit: 500,
    bucket: 10000
  },
  creeps: {},
  spawns: {},
  rooms: {}
});

interface TestMemory {
  messages: string[];
  counter: number;
}

describe("Protocol Integration", () => {
  beforeEach(() => {
    ProcessRegistry.getInstance().clear();
    ProtocolRegistry.getInstance().clear();
  });

  it("should provide protocol to processes via context", () => {
    // Define a protocol
    @protocol({ name: "MessageProtocol" })
    class MessageProtocol {
      private messages: string[] = [];

      sendMessage(message: string): void {
        this.messages.push(message);
      }

      getMessages(): string[] {
        return this.messages;
      }
    }

    // Define a process that uses the protocol
    @process({ name: "TestProcess", priority: 100, singleton: true })
    class TestProcess {
      run(ctx: ProcessContext<TestMemory>): void {
        const protocol = ctx.protocol as {
          sendMessage: (message: string) => void;
          getMessages: () => string[];
        };
        protocol.sendMessage("Hello from TestProcess");
      }
    }

    const kernel = new Kernel();
    const memory: TestMemory = { messages: [], counter: 0 };
    const game = createMockGame();

    kernel.run(game, memory);

    // Verify the protocol was used
    const protocolRegistry = ProtocolRegistry.getInstance();
    const combined = protocolRegistry.combineProtocols();
    const getMessages = combined.getMessages as () => string[];
    expect(getMessages()).toEqual(["Hello from TestProcess"]);
  });

  it("should support multiple processes communicating via protocol", () => {
    // Define a shared protocol
    @protocol({ name: "SharedStateProtocol" })
    class SharedStateProtocol {
      private state: Record<string, unknown> = {};

      set(key: string, value: unknown): void {
        this.state[key] = value;
      }

      get(key: string): unknown {
        return this.state[key];
      }
    }

    // Process 1: Writer
    @process({ name: "WriterProcess", priority: 100, singleton: true })
    class WriterProcess {
      run(ctx: ProcessContext<TestMemory>): void {
        const protocol = ctx.protocol as {
          set: (key: string, value: unknown) => void;
        };
        protocol.set("data", { value: 42, timestamp: ctx.game.time });
      }
    }

    // Process 2: Reader
    @process({ name: "ReaderProcess", priority: 50, singleton: true })
    class ReaderProcess {
      run(ctx: ProcessContext<TestMemory>): void {
        const protocol = ctx.protocol as {
          get: (key: string) => unknown;
        };
        const data = protocol.get("data");
        ctx.memory.counter = (data as { value: number })?.value ?? 0;
      }
    }

    const kernel = new Kernel();
    const memory: TestMemory = { messages: [], counter: 0 };
    const game = createMockGame();

    kernel.run(game, memory);

    // Verify the communication worked
    expect(memory.counter).toBe(42);
  });

  it("should combine multiple protocols into one context", () => {
    // Define multiple protocols
    @protocol({ name: "LoggingProtocol" })
    class LoggingProtocol {
      private logs: string[] = [];

      log(message: string): void {
        this.logs.push(message);
      }

      getLogs(): string[] {
        return this.logs;
      }
    }

    @protocol({ name: "CounterProtocol" })
    class CounterProtocol {
      private count = 0;

      increment(): void {
        this.count++;
      }

      getCount(): number {
        return this.count;
      }
    }

    // Process that uses both protocols
    @process({ name: "MultiProtocolProcess", priority: 100, singleton: true })
    class MultiProtocolProcess {
      run(ctx: ProcessContext<TestMemory>): void {
        const protocol = ctx.protocol as {
          log: (message: string) => void;
          increment: () => void;
        };
        protocol.log("Starting process");
        protocol.increment();
        protocol.log("Process complete");
      }
    }

    const kernel = new Kernel();
    const memory: TestMemory = { messages: [], counter: 0 };
    const game = createMockGame();

    kernel.run(game, memory);

    // Verify both protocols were used
    const protocolRegistry = ProtocolRegistry.getInstance();
    const combined = protocolRegistry.combineProtocols();
    const getLogs = combined.getLogs as () => string[];
    const getCount = combined.getCount as () => number;

    expect(getLogs()).toEqual(["Starting process", "Process complete"]);
    expect(getCount()).toBe(1);
  });

  it("should maintain protocol state across multiple ticks", () => {
    @protocol({ name: "PersistentProtocol" })
    class PersistentProtocol {
      private tickCount = 0;

      incrementTick(): void {
        this.tickCount++;
      }

      getTickCount(): number {
        return this.tickCount;
      }
    }

    @process({ name: "TickCounterProcess", priority: 100, singleton: true })
    class TickCounterProcess {
      run(ctx: ProcessContext<TestMemory>): void {
        const protocol = ctx.protocol as {
          incrementTick: () => void;
          getTickCount: () => number;
        };
        protocol.incrementTick();
        ctx.memory.counter = protocol.getTickCount();
      }
    }

    const kernel = new Kernel();
    const memory: TestMemory = { messages: [], counter: 0 };
    const game = createMockGame();

    // Run multiple ticks
    kernel.run(game, memory);
    expect(memory.counter).toBe(1);

    kernel.run(game, memory);
    expect(memory.counter).toBe(2);

    kernel.run(game, memory);
    expect(memory.counter).toBe(3);
  });

  it("should provide empty protocol object when no protocols are registered", () => {
    @process({ name: "NoProtocolProcess", priority: 100, singleton: true })
    class NoProtocolProcess {
      run(ctx: ProcessContext<TestMemory>): void {
        expect(ctx.protocol).toBeDefined();
        expect(ctx.protocol).toEqual({});
        ctx.memory.counter = 1;
      }
    }

    const kernel = new Kernel();
    const memory: TestMemory = { messages: [], counter: 0 };
    const game = createMockGame();

    kernel.run(game, memory);
    expect(memory.counter).toBe(1);
  });

  it("should support type-safe protocol interfaces", () => {
    // Define a typed protocol interface
    interface IMessageProtocol {
      send(to: string, message: string): void;
      receive(from: string): string[];
    }

    @protocol({ name: "TypedMessageProtocol" })
    class TypedMessageProtocol implements IMessageProtocol {
      private inbox: Map<string, string[]> = new Map();

      send(to: string, message: string): void {
        if (!this.inbox.has(to)) {
          this.inbox.set(to, []);
        }
        this.inbox.get(to)!.push(message);
      }

      receive(from: string): string[] {
        return this.inbox.get(from) ?? [];
      }
    }

    @process({ name: "TypedProcess", priority: 100, singleton: true })
    class TypedProcess {
      run(ctx: ProcessContext<TestMemory, IMessageProtocol>): void {
        // TypeScript knows about the protocol methods
        ctx.protocol.send("room1", "Hello");
        ctx.protocol.send("room1", "World");
        const messages = ctx.protocol.receive("room1");
        ctx.memory.counter = messages.length;
      }
    }

    const kernel = new Kernel();
    const memory: TestMemory = { messages: [], counter: 0 };
    const game = createMockGame();

    kernel.run(game, memory);
    expect(memory.counter).toBe(2);
  });
});
