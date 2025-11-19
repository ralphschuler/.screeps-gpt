/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Kernel } from "../src/Kernel";
import { process } from "../src/decorators";
import { ProcessRegistry } from "../src/ProcessRegistry";
import type { Process, ProcessContext, GameContext, Logger } from "../src/types";

describe("Kernel", () => {
  let registry: ProcessRegistry;
  let mockLogger: Logger;
  let mockGame: GameContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockMemory: any;

  beforeEach(() => {
    registry = ProcessRegistry.getInstance();
    registry.clear();

    mockLogger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    mockGame = {
      time: 100,
      cpu: {
        getUsed: vi.fn(() => 5),
        limit: 100,
        bucket: 1000
      },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    mockMemory = { test: "data" };
  });

  it("should execute registered processes in priority order", () => {
    const executionOrder: string[] = [];

    @process({ name: "LowPriority", priority: 10 })
    class LowPriorityProcess implements Process {
      run(_ctx: ProcessContext): void {
        executionOrder.push("LowPriority");
      }
    }

    @process({ name: "HighPriority", priority: 100 })
    class HighPriorityProcess implements Process {
      run(_ctx: ProcessContext): void {
        executionOrder.push("HighPriority");
      }
    }

    @process({ name: "MediumPriority", priority: 50 })
    class MediumPriorityProcess implements Process {
      run(_ctx: ProcessContext): void {
        executionOrder.push("MediumPriority");
      }
    }

    const kernel = new Kernel({ logger: mockLogger });
    kernel.run(mockGame, mockMemory);

    expect(executionOrder).toEqual(["HighPriority", "MediumPriority", "LowPriority"]);
  });

  it("should warn if no processes are registered", () => {
    const kernel = new Kernel({ logger: mockLogger });
    kernel.run(mockGame, mockMemory);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[Kernel] No processes registered. Use @process decorator to register processes."
    );
  });

  it("should pass context to processes", () => {
    let receivedContext: ProcessContext | null = null;

    @process({ name: "TestProcess", priority: 100 })
    class TestProcess implements Process {
      run(ctx: ProcessContext): void {
        receivedContext = ctx;
      }
    }

    const kernel = new Kernel({ logger: mockLogger });
    kernel.run(mockGame, mockMemory);

    expect(receivedContext).not.toBeNull();
    expect(receivedContext?.game).toBe(mockGame);
    expect(receivedContext?.memory).toBe(mockMemory);
    expect(receivedContext?.logger).toBeDefined();
    expect(receivedContext?.metrics).toBeDefined();
  });

  it("should reuse singleton process instances", () => {
    let instanceCount = 0;

    @process({ name: "SingletonProcess", priority: 100, singleton: true })
    class SingletonProcess implements Process {
      constructor() {
        instanceCount++;
      }

      run(_ctx: ProcessContext): void {}
    }

    const kernel = new Kernel({ logger: mockLogger });
    kernel.run(mockGame, mockMemory);
    kernel.run(mockGame, mockMemory);
    kernel.run(mockGame, mockMemory);

    expect(instanceCount).toBe(1); // Only one instance created
  });

  it("should create fresh instances for non-singleton processes", () => {
    let instanceCount = 0;

    @process({ name: "NonSingletonProcess", priority: 100, singleton: false })
    class NonSingletonProcess implements Process {
      constructor() {
        instanceCount++;
      }

      run(_ctx: ProcessContext): void {}
    }

    const kernel = new Kernel({ logger: mockLogger });
    kernel.run(mockGame, mockMemory);
    kernel.run(mockGame, mockMemory);
    kernel.run(mockGame, mockMemory);

    expect(instanceCount).toBe(3); // New instance each tick
  });

  it("should handle process errors gracefully", () => {
    @process({ name: "FailingProcess", priority: 100 })
    class FailingProcess implements Process {
      run(_ctx: ProcessContext): void {
        throw new Error("Process failure");
      }
    }

    @process({ name: "SuccessfulProcess", priority: 50 })
    class SuccessfulProcess implements Process {
      run(_ctx: ProcessContext): void {
        // Success
      }
    }

    const kernel = new Kernel({ logger: mockLogger });
    kernel.run(mockGame, mockMemory);

    expect(mockLogger.error).toHaveBeenCalledWith("[Kernel] Process 'FailingProcess' failed: Process failure");

    // Should still execute other processes
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("1 run, 1 failed, 0 skipped"));
  });

  it("should skip processes when CPU threshold is exceeded", () => {
    let cpuUsed = 5;
    mockGame.cpu.getUsed = vi.fn(() => cpuUsed);
    mockGame.cpu.limit = 100;

    const executedProcesses: string[] = [];

    @process({ name: "Process1", priority: 100 })
    class Process1 implements Process {
      run(_ctx: ProcessContext): void {
        executedProcesses.push("Process1");
        cpuUsed = 95; // Exceed threshold
      }
    }

    @process({ name: "Process2", priority: 50 })
    class Process2 implements Process {
      run(_ctx: ProcessContext): void {
        executedProcesses.push("Process2");
      }
    }

    const kernel = new Kernel({
      logger: mockLogger,
      cpuEmergencyThreshold: 0.9
    });
    kernel.run(mockGame, mockMemory);

    expect(executedProcesses).toEqual(["Process1"]);
    expect(executedProcesses).not.toContain("Process2");
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("CPU threshold exceeded"));
  });

  it("should report process count", () => {
    @process({ name: "Process1", priority: 100 })
    class Process1 implements Process {
      run(_ctx: ProcessContext): void {}
    }

    @process({ name: "Process2", priority: 50 })
    class Process2 implements Process {
      run(_ctx: ProcessContext): void {}
    }

    const kernel = new Kernel();
    expect(kernel.getProcessCount()).toBe(2);
  });

  it("should report process names in priority order", () => {
    @process({ name: "LowPriority", priority: 10 })
    class LowPriorityProcess implements Process {
      run(_ctx: ProcessContext): void {}
    }

    @process({ name: "HighPriority", priority: 100 })
    class HighPriorityProcess implements Process {
      run(_ctx: ProcessContext): void {}
    }

    const kernel = new Kernel();
    const names = kernel.getProcessNames();
    expect(names).toEqual(["HighPriority", "LowPriority"]);
  });
});
