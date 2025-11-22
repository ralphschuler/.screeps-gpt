/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import { describe, it, expect, beforeEach } from "vitest";
import { protocol } from "../src/decorators";
import { ProtocolRegistry } from "../src/ProtocolRegistry";

describe("@protocol decorator", () => {
  let registry: ProtocolRegistry;

  beforeEach(() => {
    registry = ProtocolRegistry.getInstance();
    registry.clear();
  });

  it("should register a protocol with decorator", () => {
    @protocol({ name: "TestProtocol" })
    class TestProtocol {
      testMethod(): string {
        return "test";
      }
    }

    expect(registry.size()).toBe(1);
    const descriptor = registry.get("TestProtocol");
    expect(descriptor).toBeDefined();
    expect(descriptor?.name).toBe("TestProtocol");
    expect(descriptor?.constructor).toBe(TestProtocol);
  });

  it("should throw if name is missing", () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      @protocol({ name: "" } as any)
      class TestProtocol {
        testMethod(): string {
          return "test";
        }
      }
    }).toThrow("@protocol decorator requires a non-empty 'name' property");
  });

  it("should preserve class functionality", () => {
    @protocol({ name: "TestProtocol" })
    class TestProtocol {
      private value = 42;

      getValue(): number {
        return this.value;
      }
    }

    const instance = new TestProtocol();
    expect(instance.getValue()).toBe(42);
  });

  it("should auto-register multiple protocols", () => {
    @protocol({ name: "Protocol1" })
    class Protocol1 {
      method1(): string {
        return "protocol1";
      }
    }

    @protocol({ name: "Protocol2" })
    class Protocol2 {
      method2(): string {
        return "protocol2";
      }
    }

    @protocol({ name: "Protocol3" })
    class Protocol3 {
      method3(): string {
        return "protocol3";
      }
    }

    expect(registry.size()).toBe(3);

    const protocols = registry.getAll();
    expect(protocols.map(p => p.name)).toContain("Protocol1");
    expect(protocols.map(p => p.name)).toContain("Protocol2");
    expect(protocols.map(p => p.name)).toContain("Protocol3");
  });

  it("should throw when registering duplicate protocol name", () => {
    @protocol({ name: "DuplicateProtocol" })
    class Protocol1 {
      method1(): string {
        return "protocol1";
      }
    }

    expect(() => {
      @protocol({ name: "DuplicateProtocol" })
      class Protocol2 {
        method2(): string {
          return "protocol2";
        }
      }
    }).toThrow("Protocol 'DuplicateProtocol' is already registered");
  });

  it("should support protocols with state", () => {
    @protocol({ name: "StatefulProtocol" })
    class StatefulProtocol {
      private counter = 0;

      increment(): void {
        this.counter++;
      }

      getCount(): number {
        return this.counter;
      }
    }

    const instance = new StatefulProtocol();
    instance.increment();
    instance.increment();
    expect(instance.getCount()).toBe(2);
  });

  it("should support protocols with constructor parameters (instantiated without args)", () => {
    @protocol({ name: "ConfigurableProtocol" })
    class ConfigurableProtocol {
      private readonly config: string;

      constructor(config = "default") {
        this.config = config;
      }

      getConfig(): string {
        return this.config;
      }
    }

    // When the registry instantiates the protocol, it will use default value
    const combined = registry.combineProtocols();
    const getConfig = combined.getConfig as () => string;
    expect(getConfig()).toBe("default");
  });
});
