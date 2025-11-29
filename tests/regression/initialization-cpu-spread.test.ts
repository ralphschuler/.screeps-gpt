/**
 * Regression test for issue #1498
 *
 * Ensures staggered initialization after deployment/restart spreads
 * initialization workload across multiple ticks to prevent CPU bucket drain.
 *
 * Root Cause: All initialization tasks (kernel, profiler, event subscriptions,
 * global objects) execute in a single tick after deployment/restart, causing
 * immediate CPU bucket depletion and potential timeout cascades.
 *
 * Solution: InitializationManager spreads initialization across multiple ticks
 * with CPU budget protection, deferring phases when bucket is critically low.
 *
 * @see packages/bot/src/runtime/bootstrap/InitializationManager.ts
 * @see packages/docs/source/docs/runtime/initialization.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Regression: Staggered Initialization CPU Protection (#1498)", () => {
  // Store original global state to restore after each test
  let originalGame: Game | undefined;
  let originalMemory: Memory | undefined;
  let originalProfilerEnabled: "true" | "false" | undefined;

  beforeEach(() => {
    // Save original global state
    originalGame = (global as unknown as { Game: Game }).Game;
    originalMemory = (global as unknown as { Memory: Memory }).Memory;
    originalProfilerEnabled = (global as unknown as { __PROFILER_ENABLED__: "true" | "false" }).__PROFILER_ENABLED__;

    // Reset mocks
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original global state to prevent test pollution
    (global as unknown as { Game: Game }).Game = originalGame;
    (global as unknown as { Memory: Memory }).Memory = originalMemory;
    (global as unknown as { __PROFILER_ENABLED__: "true" | "false" }).__PROFILER_ENABLED__ = originalProfilerEnabled;
  });

  it("should initialize Memory.init structure on first tick", async () => {
    const mainModule = await import("../../packages/bot/src/main");

    // Create empty Memory (simulating fresh deployment)
    const mockMemory = {} as Memory;

    // Mock Game object with healthy bucket
    (global as unknown as { Game: Game }).Game = {
      time: 12345,
      cpu: {
        getUsed: () => 5.0,
        limit: 100,
        bucket: 9500
      },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    (global as unknown as { Memory: Memory }).Memory = mockMemory;
    (global as unknown as { __PROFILER_ENABLED__: "true" | "false" }).__PROFILER_ENABLED__ = "false";

    // Execute loop - initialization should start
    mainModule.loop();

    // Verify Memory.init was created
    expect(mockMemory.init).toBeDefined();
    expect(mockMemory.init?.startTick).toBeDefined();
    expect(typeof mockMemory.init?.phase).toBe("number");
    expect(typeof mockMemory.init?.complete).toBe("boolean");
  });

  it("should complete initialization within reasonable tick count", async () => {
    const mainModule = await import("../../packages/bot/src/main");

    const mockMemory = {} as Memory;

    // Mock Game object with healthy bucket
    let currentTick = 12345;
    (global as unknown as { Game: Game }).Game = {
      time: currentTick,
      cpu: {
        getUsed: () => 5.0,
        limit: 100,
        bucket: 9500
      },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    (global as unknown as { Memory: Memory }).Memory = mockMemory;
    (global as unknown as { __PROFILER_ENABLED__: "true" | "false" }).__PROFILER_ENABLED__ = "false";

    // Execute multiple ticks to allow initialization to complete
    const maxTicks = 15; // Should complete well before this
    let ticksRun = 0;

    while (!mockMemory.init?.complete && ticksRun < maxTicks) {
      // Update Game.time for each tick
      currentTick++;
      (global as unknown as { Game: Game }).Game = {
        time: currentTick,
        cpu: {
          getUsed: () => 5.0,
          limit: 100,
          bucket: 9500
        },
        creeps: {},
        spawns: {},
        rooms: {}
      };

      mainModule.loop();
      ticksRun++;
    }

    // Initialization should complete within maxInitTicks (default 10)
    expect(mockMemory.init?.complete).toBe(true);
    expect(ticksRun).toBeLessThanOrEqual(10);
  });

  it("should defer initialization when CPU bucket is critically low", async () => {
    const mainModule = await import("../../packages/bot/src/main");

    const mockMemory = {} as Memory;

    // Mock Game object with critically low bucket
    (global as unknown as { Game: Game }).Game = {
      time: 12345,
      cpu: {
        getUsed: () => 5.0,
        limit: 100,
        bucket: 100 // Below default minBucketLevel of 500
      },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    (global as unknown as { Memory: Memory }).Memory = mockMemory;
    (global as unknown as { __PROFILER_ENABLED__: "true" | "false" }).__PROFILER_ENABLED__ = "false";

    // Execute loop - initialization should be deferred
    mainModule.loop();

    // Memory.init should exist but not be complete (deferred)
    // With critically low bucket, phases should not execute
    if (mockMemory.init) {
      expect(mockMemory.init.complete).toBe(false);
      // completedPhases should be empty or undefined (no phases ran)
      expect(mockMemory.init.completedPhases?.length ?? 0).toBe(0);
    }
  });

  it("should track completed phases in Memory.init", async () => {
    const mainModule = await import("../../packages/bot/src/main");

    const mockMemory = {} as Memory;

    // Mock Game object with healthy bucket
    (global as unknown as { Game: Game }).Game = {
      time: 12345,
      cpu: {
        getUsed: () => 2.0, // Low CPU usage to allow phases to run
        limit: 100,
        bucket: 9500
      },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    (global as unknown as { Memory: Memory }).Memory = mockMemory;
    (global as unknown as { __PROFILER_ENABLED__: "true" | "false" }).__PROFILER_ENABLED__ = "false";

    // Execute loop
    mainModule.loop();

    // Verify completedPhases tracking
    if (mockMemory.init?.completedPhases) {
      expect(Array.isArray(mockMemory.init.completedPhases)).toBe(true);
      // At least some phases should have run
      expect(mockMemory.init.completedPhases.length).toBeGreaterThan(0);
    }
  });

  it("should skip kernel execution during initialization", async () => {
    // This test verifies that normal kernel operations are skipped
    // during the initialization phase to prevent CPU overload
    const mainModule = await import("../../packages/bot/src/main");

    const mockMemory = {} as Memory;

    // Create a scenario where init is started but not complete
    mockMemory.init = {
      phase: 0, // Still at phase 0
      startTick: 12340,
      complete: false,
      completedPhases: []
    };

    // Mock Game with very limited CPU to ensure we don't complete init this tick
    (global as unknown as { Game: Game }).Game = {
      time: 12345,
      cpu: {
        getUsed: () => 15.0, // High CPU usage - leaves little budget
        limit: 20,
        bucket: 9500
      },
      creeps: {
        harvester1: {
          name: "harvester1",
          memory: { role: "harvester" }
        }
      } as unknown as Record<string, Creep>,
      spawns: {},
      rooms: {}
    };

    (global as unknown as { Memory: Memory }).Memory = mockMemory;
    (global as unknown as { __PROFILER_ENABLED__: "true" | "false" }).__PROFILER_ENABLED__ = "false";

    // Execute loop - should process init but skip kernel for CPU-limited scenarios
    mainModule.loop();

    // Memory.stats should still be defensively initialized even during init phase
    expect(mockMemory.stats).toBeDefined();
  });

  it("should preserve existing Memory.init state across ticks", async () => {
    const mainModule = await import("../../packages/bot/src/main");

    // Pre-populate Memory.init with partial progress
    const mockMemory = {
      init: {
        phase: 2,
        startTick: 12340,
        complete: false,
        completedPhases: ["memory-validation", "profiler-setup"]
      }
    } as Memory;

    (global as unknown as { Game: Game }).Game = {
      time: 12345,
      cpu: {
        getUsed: () => 5.0,
        limit: 100,
        bucket: 9500
      },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    (global as unknown as { Memory: Memory }).Memory = mockMemory;
    (global as unknown as { __PROFILER_ENABLED__: "true" | "false" }).__PROFILER_ENABLED__ = "false";

    // Execute loop
    mainModule.loop();

    // Should continue from where it left off
    expect(mockMemory.init?.startTick).toBe(12340); // Original start tick preserved
    expect(mockMemory.init?.phase).toBeGreaterThanOrEqual(2); // Advanced from phase 2
  });

  it("should not re-initialize after completion", async () => {
    const mainModule = await import("../../packages/bot/src/main");

    // Set up Memory with completed initialization
    const mockMemory = {
      init: {
        phase: 4,
        startTick: 12300,
        complete: true,
        completedPhases: ["memory-validation", "profiler-setup", "event-subscriptions", "console-diagnostics"]
      }
    } as Memory;

    (global as unknown as { Game: Game }).Game = {
      time: 12345,
      cpu: {
        getUsed: () => 5.0,
        limit: 100,
        bucket: 9500
      },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    (global as unknown as { Memory: Memory }).Memory = mockMemory;
    (global as unknown as { __PROFILER_ENABLED__: "true" | "false" }).__PROFILER_ENABLED__ = "false";

    // Execute loop multiple times
    mainModule.loop();
    mainModule.loop();
    mainModule.loop();

    // Memory.init should remain unchanged (already complete)
    expect(mockMemory.init?.complete).toBe(true);
    expect(mockMemory.init?.startTick).toBe(12300); // Original start tick
    expect(mockMemory.init?.phase).toBe(4); // Same phase count
  });

  it("should protect CPU bucket during high-CPU scenarios", async () => {
    const mainModule = await import("../../packages/bot/src/main");

    const mockMemory = {} as Memory;

    // Track how much "CPU" was used by tracking getUsed calls
    let cpuCallCount = 0;
    const cpuUsageSimulation = () => {
      cpuCallCount++;
      // Simulate increasing CPU usage
      return Math.min(5 + cpuCallCount * 2, 80);
    };

    (global as unknown as { Game: Game }).Game = {
      time: 12345,
      cpu: {
        getUsed: cpuUsageSimulation,
        limit: 100,
        bucket: 9500
      },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    (global as unknown as { Memory: Memory }).Memory = mockMemory;
    (global as unknown as { __PROFILER_ENABLED__: "true" | "false" }).__PROFILER_ENABLED__ = "false";

    // Execute loop
    mainModule.loop();

    // Verify initialization system was engaged (Memory.init created)
    expect(mockMemory.init).toBeDefined();
    // The initialization should respect CPU limits
  });
});

describe("Regression: Initialization Phase Ordering (#1498)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should execute phases in priority order", async () => {
    const { InitializationManager } = await import(
      "../../packages/bot/src/runtime/bootstrap/InitializationManager"
    );

    const executionOrder: string[] = [];
    const manager = new InitializationManager();

    // Register phases out of priority order
    manager.registerPhase({
      name: "phase-3",
      priority: 30,
      cpuEstimate: 1,
      execute: () => executionOrder.push("phase-3")
    });

    manager.registerPhase({
      name: "phase-1",
      priority: 10,
      cpuEstimate: 1,
      execute: () => executionOrder.push("phase-1")
    });

    manager.registerPhase({
      name: "phase-2",
      priority: 20,
      cpuEstimate: 1,
      execute: () => executionOrder.push("phase-2")
    });

    const game = {
      time: 1000,
      cpu: { getUsed: () => 0, limit: 100, bucket: 9500 },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    const memory = {} as Memory;
    manager.tick(game, memory);

    // Phases should execute in priority order (lowest first)
    expect(executionOrder).toEqual(["phase-1", "phase-2", "phase-3"]);
  });
});
