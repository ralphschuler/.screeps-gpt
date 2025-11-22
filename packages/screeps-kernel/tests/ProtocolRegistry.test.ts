/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import { describe, it, expect, beforeEach } from "vitest";
import { ProtocolRegistry } from "../src/ProtocolRegistry";

describe("ProtocolRegistry", () => {
  let registry: ProtocolRegistry;

  beforeEach(() => {
    registry = ProtocolRegistry.getInstance();
    registry.clear();
  });

  it("should return singleton instance", () => {
    const instance1 = ProtocolRegistry.getInstance();
    const instance2 = ProtocolRegistry.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("should register a protocol", () => {
    class TestProtocol {
      testMethod(): string {
        return "test";
      }
    }

    registry.register({
      name: "TestProtocol",
      constructor: TestProtocol
    });

    expect(registry.size()).toBe(1);
    const descriptor = registry.get("TestProtocol");
    expect(descriptor).toBeDefined();
    expect(descriptor?.name).toBe("TestProtocol");
    expect(descriptor?.constructor).toBe(TestProtocol);
  });

  it("should throw when registering duplicate protocol name", () => {
    class Protocol1 {
      method1(): string {
        return "protocol1";
      }
    }

    class Protocol2 {
      method2(): string {
        return "protocol2";
      }
    }

    registry.register({
      name: "DuplicateProtocol",
      constructor: Protocol1
    });

    expect(() => {
      registry.register({
        name: "DuplicateProtocol",
        constructor: Protocol2
      });
    }).toThrow("Protocol 'DuplicateProtocol' is already registered");
  });

  it("should unregister a protocol", () => {
    class TestProtocol {
      testMethod(): string {
        return "test";
      }
    }

    registry.register({
      name: "TestProtocol",
      constructor: TestProtocol
    });

    expect(registry.size()).toBe(1);
    const result = registry.unregister("TestProtocol");
    expect(result).toBe(true);
    expect(registry.size()).toBe(0);
  });

  it("should return false when unregistering non-existent protocol", () => {
    const result = registry.unregister("NonExistent");
    expect(result).toBe(false);
  });

  it("should get all protocols", () => {
    class Protocol1 {
      method1(): string {
        return "protocol1";
      }
    }

    class Protocol2 {
      method2(): string {
        return "protocol2";
      }
    }

    registry.register({
      name: "Protocol1",
      constructor: Protocol1
    });

    registry.register({
      name: "Protocol2",
      constructor: Protocol2
    });

    const protocols = registry.getAll();
    expect(protocols).toHaveLength(2);
    expect(protocols.map(p => p.name)).toContain("Protocol1");
    expect(protocols.map(p => p.name)).toContain("Protocol2");
  });

  it("should clear all protocols", () => {
    class Protocol1 {
      method1(): string {
        return "protocol1";
      }
    }

    class Protocol2 {
      method2(): string {
        return "protocol2";
      }
    }

    registry.register({
      name: "Protocol1",
      constructor: Protocol1
    });

    registry.register({
      name: "Protocol2",
      constructor: Protocol2
    });

    expect(registry.size()).toBe(2);
    registry.clear();
    expect(registry.size()).toBe(0);
  });

  describe("combineProtocols", () => {
    it("should combine multiple protocols into one object", () => {
      class Protocol1 {
        method1(): string {
          return "protocol1";
        }
      }

      class Protocol2 {
        method2(): string {
          return "protocol2";
        }
      }

      registry.register({
        name: "Protocol1",
        constructor: Protocol1
      });

      registry.register({
        name: "Protocol2",
        constructor: Protocol2
      });

      const combined = registry.combineProtocols();
      expect(combined).toHaveProperty("method1");
      expect(combined).toHaveProperty("method2");
      expect(typeof combined.method1).toBe("function");
      expect(typeof combined.method2).toBe("function");
    });

    it("should preserve method functionality in combined protocol", () => {
      class MessageProtocol {
        private messages: string[] = [];

        sendMessage(message: string): void {
          this.messages.push(message);
        }

        getMessages(): string[] {
          return this.messages;
        }
      }

      registry.register({
        name: "MessageProtocol",
        constructor: MessageProtocol
      });

      const combined = registry.combineProtocols();
      const sendMessage = combined.sendMessage as (message: string) => void;
      const getMessages = combined.getMessages as () => string[];

      sendMessage("Hello");
      sendMessage("World");

      const messages = getMessages();
      expect(messages).toEqual(["Hello", "World"]);
    });

    it("should preserve 'this' context in combined methods", () => {
      class CounterProtocol {
        private count = 0;

        increment(): void {
          this.count++;
        }

        getCount(): number {
          return this.count;
        }
      }

      registry.register({
        name: "CounterProtocol",
        constructor: CounterProtocol
      });

      const combined = registry.combineProtocols();
      const increment = combined.increment as () => void;
      const getCount = combined.getCount as () => number;

      increment();
      increment();
      increment();

      expect(getCount()).toBe(3);
    });

    it("should combine protocols with multiple methods", () => {
      class MathProtocol {
        add(a: number, b: number): number {
          return a + b;
        }

        subtract(a: number, b: number): number {
          return a - b;
        }

        multiply(a: number, b: number): number {
          return a * b;
        }
      }

      registry.register({
        name: "MathProtocol",
        constructor: MathProtocol
      });

      const combined = registry.combineProtocols();
      const add = combined.add as (a: number, b: number) => number;
      const subtract = combined.subtract as (a: number, b: number) => number;
      const multiply = combined.multiply as (a: number, b: number) => number;

      expect(add(5, 3)).toBe(8);
      expect(subtract(5, 3)).toBe(2);
      expect(multiply(5, 3)).toBe(15);
    });

    it("should return empty object when no protocols are registered", () => {
      const combined = registry.combineProtocols();
      expect(combined).toEqual({});
    });

    it("should reuse protocol instances on subsequent calls", () => {
      class StatefulProtocol {
        private state = 0;

        increment(): void {
          this.state++;
        }

        getState(): number {
          return this.state;
        }
      }

      registry.register({
        name: "StatefulProtocol",
        constructor: StatefulProtocol
      });

      const combined1 = registry.combineProtocols();
      const increment1 = combined1.increment as () => void;
      const getState1 = combined1.getState as () => number;

      increment1();
      expect(getState1()).toBe(1);

      // Second call should reuse the same instance
      const combined2 = registry.combineProtocols();
      const getState2 = combined2.getState as () => number;
      expect(getState2()).toBe(1); // State persists
    });
  });
});
