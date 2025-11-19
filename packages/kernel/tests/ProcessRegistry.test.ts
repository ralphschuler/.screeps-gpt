/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import { describe, it, expect, beforeEach } from "vitest";
import { ProcessRegistry } from "../src/ProcessRegistry";
import type { ProcessDescriptor, Process, ProcessContext } from "../src/types";

describe("ProcessRegistry", () => {
  let registry: ProcessRegistry;

  beforeEach(() => {
    // Get fresh registry and clear it
    registry = ProcessRegistry.getInstance();
    registry.clear();
  });

  it("should be a singleton", () => {
    const instance1 = ProcessRegistry.getInstance();
    const instance2 = ProcessRegistry.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("should register a process", () => {
    class TestProcess implements Process {
      run(_ctx: ProcessContext): void {}
    }

    const descriptor: ProcessDescriptor = {
      name: "TestProcess",
      priority: 100,
      singleton: false,
      constructor: TestProcess
    };

    registry.register(descriptor);
    expect(registry.size()).toBe(1);
    expect(registry.get("TestProcess")).toBe(descriptor);
  });

  it("should throw when registering duplicate process name", () => {
    class TestProcess implements Process {
      run(_ctx: ProcessContext): void {}
    }

    const descriptor: ProcessDescriptor = {
      name: "TestProcess",
      priority: 100,
      singleton: false,
      constructor: TestProcess
    };

    registry.register(descriptor);
    expect(() => registry.register(descriptor)).toThrow("Process 'TestProcess' is already registered");
  });

  it("should unregister a process", () => {
    class TestProcess implements Process {
      run(_ctx: ProcessContext): void {}
    }

    const descriptor: ProcessDescriptor = {
      name: "TestProcess",
      priority: 100,
      singleton: false,
      constructor: TestProcess
    };

    registry.register(descriptor);
    expect(registry.size()).toBe(1);

    const removed = registry.unregister("TestProcess");
    expect(removed).toBe(true);
    expect(registry.size()).toBe(0);
  });

  it("should return false when unregistering non-existent process", () => {
    const removed = registry.unregister("NonExistent");
    expect(removed).toBe(false);
  });

  it("should return all processes sorted by priority (highest first)", () => {
    class Process1 implements Process {
      run(_ctx: ProcessContext): void {}
    }
    class Process2 implements Process {
      run(_ctx: ProcessContext): void {}
    }
    class Process3 implements Process {
      run(_ctx: ProcessContext): void {}
    }

    registry.register({
      name: "Process1",
      priority: 50,
      singleton: false,
      constructor: Process1
    });

    registry.register({
      name: "Process2",
      priority: 100,
      singleton: false,
      constructor: Process2
    });

    registry.register({
      name: "Process3",
      priority: 25,
      singleton: false,
      constructor: Process3
    });

    const processes = registry.getAll();
    expect(processes).toHaveLength(3);
    expect(processes[0].name).toBe("Process2"); // priority 100
    expect(processes[1].name).toBe("Process1"); // priority 50
    expect(processes[2].name).toBe("Process3"); // priority 25
  });

  it("should clear all processes", () => {
    class TestProcess implements Process {
      run(_ctx: ProcessContext): void {}
    }

    registry.register({
      name: "Process1",
      priority: 100,
      singleton: false,
      constructor: TestProcess
    });

    registry.register({
      name: "Process2",
      priority: 50,
      singleton: false,
      constructor: TestProcess
    });

    expect(registry.size()).toBe(2);

    registry.clear();
    expect(registry.size()).toBe(0);
  });

  it("should get process by name", () => {
    class TestProcess implements Process {
      run(_ctx: ProcessContext): void {}
    }

    const descriptor: ProcessDescriptor = {
      name: "TestProcess",
      priority: 100,
      singleton: false,
      constructor: TestProcess
    };

    registry.register(descriptor);

    const retrieved = registry.get("TestProcess");
    expect(retrieved).toBe(descriptor);
  });

  it("should return undefined for non-existent process", () => {
    const retrieved = registry.get("NonExistent");
    expect(retrieved).toBeUndefined();
  });
});
