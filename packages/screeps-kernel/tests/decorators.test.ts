/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import { describe, it, expect, beforeEach } from "vitest";
import { process } from "../src/decorators";
import { ProcessRegistry } from "../src/ProcessRegistry";
import type { Process, ProcessContext } from "../src/types";

describe("@process decorator", () => {
  let registry: ProcessRegistry;

  beforeEach(() => {
    registry = ProcessRegistry.getInstance();
    registry.clear();
  });

  it("should register a process with decorator", () => {
    @process({ name: "TestProcess", priority: 100 })
    class TestProcess implements Process {
      run(_ctx: ProcessContext): void {}
    }

    expect(registry.size()).toBe(1);
    const descriptor = registry.get("TestProcess");
    expect(descriptor).toBeDefined();
    expect(descriptor?.name).toBe("TestProcess");
    expect(descriptor?.priority).toBe(100);
    expect(descriptor?.singleton).toBe(false);
    expect(descriptor?.constructor).toBe(TestProcess);
  });

  it("should register singleton process", () => {
    @process({ name: "SingletonProcess", priority: 100, singleton: true })
    class SingletonProcess implements Process {
      run(_ctx: ProcessContext): void {}
    }

    const descriptor = registry.get("SingletonProcess");
    expect(descriptor?.singleton).toBe(true);
  });

  it("should throw if name is missing", () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      @process({ name: "", priority: 100 } as any)
      class TestProcess implements Process {
        run(_ctx: ProcessContext): void {}
      }
    }).toThrow("@process decorator requires a non-empty 'name' property");
  });

  it("should throw if priority is not a number", () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      @process({ name: "TestProcess", priority: "high" } as any)
      class TestProcess implements Process {
        run(_ctx: ProcessContext): void {}
      }
    }).toThrow("@process decorator requires a numeric 'priority' property");
  });

  it("should preserve class functionality", () => {
    @process({ name: "TestProcess", priority: 100 })
    class TestProcess implements Process {
      private value = 42;

      run(_ctx: ProcessContext): void {}

      getValue(): number {
        return this.value;
      }
    }

    const instance = new TestProcess();
    expect(instance.getValue()).toBe(42);
  });

  it("should auto-register multiple processes", () => {
    @process({ name: "Process1", priority: 100 })
    class Process1 implements Process {
      run(_ctx: ProcessContext): void {}
    }

    @process({ name: "Process2", priority: 50 })
    class Process2 implements Process {
      run(_ctx: ProcessContext): void {}
    }

    @process({ name: "Process3", priority: 75 })
    class Process3 implements Process {
      run(_ctx: ProcessContext): void {}
    }

    expect(registry.size()).toBe(3);

    const processes = registry.getAll();
    expect(processes[0].name).toBe("Process1"); // priority 100
    expect(processes[1].name).toBe("Process3"); // priority 75
    expect(processes[2].name).toBe("Process2"); // priority 50
  });

  it("should throw when registering duplicate process name", () => {
    @process({ name: "DuplicateProcess", priority: 100 })
    class Process1 implements Process {
      run(_ctx: ProcessContext): void {}
    }

    expect(() => {
      @process({ name: "DuplicateProcess", priority: 50 })
      class Process2 implements Process {
        run(_ctx: ProcessContext): void {}
      }
    }).toThrow("Process 'DuplicateProcess' is already registered");
  });
});
