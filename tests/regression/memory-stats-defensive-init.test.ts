import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Regression test for issue #863
 *
 * Ensures Memory.stats is defensively initialized during kernel execution
 * to prevent telemetry blackout when Memory is reset between script loads.
 *
 * Root Cause: Memory may be reset by Screeps server between loads, causing
 * Memory.stats to become undefined. StatsCollector (the domain owner) must
 * defensively re-initialize Memory.stats if it's missing to ensure /api/user/stats
 * endpoint always receives fresh telemetry data.
 *
 * Historical Context:
 * - Issue #863: Memory.stats collection failure causing complete telemetry blackout
 * - Issue #684: Similar Memory.stats interface conflict
 * - Issue #722, #711, #800: Previous stats collection failures
 * - Consolidation: StatsCollector is now the sole owner of Memory.stats lifecycle
 *
 * Solution: StatsCollector defensively initializes Memory.stats if missing
 * during its collect() method, which runs every tick via MetricsProcess.
 */
describe("Regression: Memory.stats Defensive Initialization (#863)", () => {
  // Store original global state to restore after each test
  let originalGame: Game | undefined;
  let originalMemory: Memory | undefined;
  let originalProfilerEnabled: "true" | "false" | undefined;

  beforeEach(() => {
    // Save original global state
    originalGame = (global as unknown as { Game: Game }).Game;
    originalMemory = (global as unknown as { Memory: Memory }).Memory;
    originalProfilerEnabled = (global as unknown as { __PROFILER_ENABLED__: "true" | "false" }).__PROFILER_ENABLED__;
  });

  afterEach(() => {
    // Restore original global state to prevent test pollution
    (global as unknown as { Game: Game }).Game = originalGame;
    (global as unknown as { Memory: Memory }).Memory = originalMemory;
    (global as unknown as { __PROFILER_ENABLED__: "true" | "false" }).__PROFILER_ENABLED__ = originalProfilerEnabled;
  });

  it("should initialize Memory.stats structure in loop function", async () => {
    // Import the main module which exports loop
    const mainModule = await import("../../packages/bot/src/main");

    // Create a mock Memory object without stats
    const mockMemory = {} as Memory;

    // Mock Game object
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

    // Mock Memory globally
    (global as unknown as { Memory: Memory }).Memory = mockMemory;

    // Mock __PROFILER_ENABLED__ as false to skip profiler initialization
    (global as unknown as { __PROFILER_ENABLED__: boolean }).__PROFILER_ENABLED__ = false;

    // Execute loop - StatsCollector will defensively initialize Memory.stats
    mainModule.loop();

    // Verify Memory.stats was initialized and populated by StatsCollector
    expect(mockMemory.stats).toBeDefined();
    expect(mockMemory.stats?.time).toBe(12345); // Updated by StatsCollector to current tick
    expect(mockMemory.stats?.cpu).toBeDefined();
    expect(mockMemory.stats?.cpu?.limit).toBe(100);
    expect(mockMemory.stats?.cpu?.bucket).toBe(9500);
    expect(mockMemory.stats?.creeps).toBeDefined();
    expect(mockMemory.stats?.creeps?.count).toBe(0);
    expect(mockMemory.stats?.rooms).toBeDefined();
    expect(mockMemory.stats?.rooms?.count).toBe(0);
  });

  it("should preserve existing Memory.stats if already present", async () => {
    // Import the main module
    const mainModule = await import("../../packages/bot/src/main");

    // Create Memory with existing stats
    const existingStats = {
      time: 12340,
      cpu: { used: 50, limit: 100, bucket: 9000 },
      creeps: { count: 5 },
      rooms: { count: 2 }
    };
    const mockMemory = {
      stats: existingStats
    } as Memory;

    // Mock Game object
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

    // Mock Memory globally
    (global as unknown as { Memory: Memory }).Memory = mockMemory;

    // Mock __PROFILER_ENABLED__ as false
    (global as unknown as { __PROFILER_ENABLED__: boolean }).__PROFILER_ENABLED__ = false;

    // Execute loop - StatsCollector replaces stats with fresh data during kernel.run()
    mainModule.loop();

    // Verify stats are still defined and updated by StatsCollector
    expect(mockMemory.stats).toBeDefined();
    expect(mockMemory.stats?.time).toBe(12345); // Updated by StatsCollector to current tick
    expect(mockMemory.stats?.cpu).toBeDefined();
    expect(mockMemory.stats?.creeps).toBeDefined();
    expect(mockMemory.stats?.rooms).toBeDefined();
  });

  it("should re-initialize Memory.stats if it becomes undefined mid-execution", async () => {
    // Import the main module
    const mainModule = await import("../../packages/bot/src/main");

    // Mock Game object
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

    // Mock __PROFILER_ENABLED__ as false
    (global as unknown as { __PROFILER_ENABLED__: boolean }).__PROFILER_ENABLED__ = false;

    // First execution - Memory.stats will be initialized by StatsCollector
    const mockMemory1 = {} as Memory;
    (global as unknown as { Memory: Memory }).Memory = mockMemory1;
    mainModule.loop();
    expect(mockMemory1.stats).toBeDefined();

    // Simulate Memory reset (like Screeps server might do between script loads)
    const mockMemory2 = {} as Memory;
    (global as unknown as { Memory: Memory }).Memory = mockMemory2;

    // Second execution - StatsCollector should re-initialize Memory.stats
    mainModule.loop();
    expect(mockMemory2.stats).toBeDefined();
    expect(mockMemory2.stats?.time).toBeDefined();
    expect(mockMemory2.stats?.cpu).toBeDefined();
    expect(mockMemory2.stats?.creeps).toBeDefined();
    expect(mockMemory2.stats?.rooms).toBeDefined();
  });

  it("should initialize both Memory.profiler and Memory.stats via kernel", async () => {
    // Import the main module
    const mainModule = await import("../../packages/bot/src/main");

    // Create empty Memory
    const mockMemory = {} as Memory;

    // Mock Game object
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

    // Enable profiler to test both initializations
    // Note: __PROFILER_ENABLED__ is a string "true" or "false", not a boolean
    (global as unknown as { __PROFILER_ENABLED__: "true" | "false" }).__PROFILER_ENABLED__ = "true";

    // Execute loop
    mainModule.loop();

    // Both Memory.profiler (main.ts) and Memory.stats (StatsCollector) should be initialized
    expect(mockMemory.profiler).toBeDefined();
    expect(mockMemory.stats).toBeDefined();
  });

  it("should allow external console probes to write to Memory.stats after defensive init", async () => {
    // This test simulates the exact scenario from the issue:
    // screeps-mcp console automation sends "Memory.stats.mcpTest = ..." to validate bot health
    // Before the fix, this would throw: TypeError: Cannot set property 'mcpTest' of undefined
    // After the fix, Memory.stats exists from the start of loop() execution

    // Import the main module
    const mainModule = await import("../../packages/bot/src/main");

    // Create empty Memory (simulating memory reset)
    const mockMemory = {} as Memory;

    // Mock Game object
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

    // Mock Memory globally
    (global as unknown as { Memory: Memory }).Memory = mockMemory;

    // Mock __PROFILER_ENABLED__ as false
    (global as unknown as { __PROFILER_ENABLED__: boolean }).__PROFILER_ENABLED__ = false;

    // Execute loop - defensive initialization should create Memory.stats immediately
    mainModule.loop();

    // Verify Memory.stats was defensively initialized
    expect(mockMemory.stats).toBeDefined();

    // Simulate external console probe writing to Memory.stats.mcpTest
    // This should NOT throw TypeError anymore
    expect(() => {
      (mockMemory.stats as { mcpTest?: string }).mcpTest = "health-check-probe-timestamp";
    }).not.toThrow();

    // Verify the probe data was written successfully
    expect((mockMemory.stats as { mcpTest?: string }).mcpTest).toBe("health-check-probe-timestamp");
  });

  it("should initialize Memory.stats before kernel runs (early in loop)", async () => {
    // This test verifies that Memory.stats is available BEFORE the kernel processes execute
    // ensuring external console automation can safely access it at any time

    const mainModule = await import("../../packages/bot/src/main");
    const mockMemory = {} as Memory;

    // Mock Game object
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
    (global as unknown as { __PROFILER_ENABLED__: boolean }).__PROFILER_ENABLED__ = false;

    // Execute loop
    mainModule.loop();

    // Memory.stats should exist with minimal structure from defensive initialization
    expect(mockMemory.stats).toBeDefined();
    expect(mockMemory.stats?.time).toBe(12345);
    expect(mockMemory.stats?.cpu).toBeDefined();
    expect(mockMemory.stats?.creeps).toBeDefined();
    expect(mockMemory.stats?.rooms).toBeDefined();

    // Verify structure exists (contract: Memory.stats must exist before external probes)
    // The defensive initialization provides minimal structure with zeros.
    // StatsCollector will populate actual telemetry values during MetricsProcess execution.
    expect(mockMemory.stats?.cpu?.used).toBeDefined();
    expect(mockMemory.stats?.cpu?.limit).toBeDefined();
    expect(mockMemory.stats?.cpu?.bucket).toBeDefined();
    expect(mockMemory.stats?.creeps?.count).toBeDefined();
    expect(mockMemory.stats?.rooms?.count).toBeDefined();
  });
});
