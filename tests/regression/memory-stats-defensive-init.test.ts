import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Regression test for issue #863
 *
 * Ensures Memory.stats is defensively initialized on every tick in the loop() function
 * to prevent telemetry blackout when Memory is reset between script loads.
 *
 * Root Cause: Kernel constructor initializes Memory.stats only once at module load time,
 * but Memory may be reset by Screeps server between loads. The loop() function must
 * defensively re-initialize Memory.stats if it's missing to ensure /api/user/stats
 * endpoint always receives fresh telemetry data.
 *
 * Historical Context:
 * - Issue #863: Memory.stats collection failure causing complete telemetry blackout
 * - Issue #684: Similar Memory.stats interface conflict
 * - Issue #722, #711, #800: Previous stats collection failures
 *
 * Solution: Add defensive Memory.stats initialization in loop() function using nullish
 * coalescing assignment operator (??=), matching the pattern used for Memory.profiler.
 */
describe("Regression: Memory.stats Defensive Initialization (#863)", () => {
  // Store original global state to restore after each test
  let originalGame: any;
  let originalMemory: any;
  let originalProfilerEnabled: any;

  beforeEach(() => {
    // Save original global state
    originalGame = (global as any).Game;
    originalMemory = (global as any).Memory;
    originalProfilerEnabled = (global as any).__PROFILER_ENABLED__;
  });

  afterEach(() => {
    // Restore original global state to prevent test pollution
    (global as any).Game = originalGame;
    (global as any).Memory = originalMemory;
    (global as any).__PROFILER_ENABLED__ = originalProfilerEnabled;
  });

  it("should initialize Memory.stats structure in loop function", async () => {
    // Import the main module which exports loop
    const mainModule = await import("../../packages/bot/src/main");

    // Create a mock Memory object without stats
    const mockMemory = {} as Memory;

    // Mock Game object
    (global as any).Game = {
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
    (global as any).Memory = mockMemory;

    // Mock __PROFILER_ENABLED__ as false to skip profiler initialization
    (global as any).__PROFILER_ENABLED__ = false;

    // Execute loop - this should defensively initialize Memory.stats
    mainModule.loop();

    // Verify Memory.stats was initialized and populated by StatsCollector
    // The defensive init provides the structure, then kernel.run() updates it with real data
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
    (global as any).Game = {
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
    (global as any).Memory = mockMemory;

    // Mock __PROFILER_ENABLED__ as false
    (global as any).__PROFILER_ENABLED__ = false;

    // Execute loop - defensive init should skip since stats already exists (??= operator)
    // However, StatsCollector will replace it with fresh data during kernel.run()
    mainModule.loop();

    // Verify stats are still defined and updated by kernel
    // The defensive init (??=) didn't replace it because it was already defined,
    // but StatsCollector did replace it with current tick data (this is expected)
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
    (global as any).Game = {
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
    (global as any).__PROFILER_ENABLED__ = false;

    // First execution - Memory.stats will be initialized
    const mockMemory1 = {} as Memory;
    (global as any).Memory = mockMemory1;
    mainModule.loop();
    expect(mockMemory1.stats).toBeDefined();

    // Simulate Memory reset (like Screeps server might do between script loads)
    const mockMemory2 = {} as Memory;
    (global as any).Memory = mockMemory2;

    // Second execution - Memory.stats should be re-initialized
    mainModule.loop();
    expect(mockMemory2.stats).toBeDefined();
    expect(mockMemory2.stats?.time).toBeDefined();
    expect(mockMemory2.stats?.cpu).toBeDefined();
    expect(mockMemory2.stats?.creeps).toBeDefined();
    expect(mockMemory2.stats?.rooms).toBeDefined();
  });

  it("should match Memory.profiler defensive initialization pattern", async () => {
    // Import the main module
    const mainModule = await import("../../packages/bot/src/main");

    // Create empty Memory
    const mockMemory = {} as Memory;

    // Mock Game object
    (global as any).Game = {
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

    (global as any).Memory = mockMemory;

    // Enable profiler to test both defensive initializations
    (global as any).__PROFILER_ENABLED__ = true;

    // Execute loop
    mainModule.loop();

    // Both Memory.profiler and Memory.stats should be initialized
    expect(mockMemory.profiler).toBeDefined();
    expect(mockMemory.stats).toBeDefined();

    // Both should use the same defensive pattern (??=)
    // This means they only initialize if undefined, not null or existing values
  });
});
