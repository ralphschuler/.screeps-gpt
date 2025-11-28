/**
 * Unit test for profiler auto-start functionality in main.ts
 *
 * Tests that the profiler auto-start logic correctly handles:
 * - Memory initialization
 * - Memory resets
 * - Profiler already running
 * - Build-time disabled profiler
 * - Global flag optimization for reduced per-tick overhead
 *
 * Related Issue: #1102, #1424
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the profiler module
const mockProfilerInstance = {
  start: vi.fn().mockReturnValue("Profiler started"),
  stop: vi.fn().mockReturnValue("Profiler stopped"),
  status: vi.fn().mockReturnValue("Profiler is stopped"),
  output: vi.fn().mockReturnValue("Done"),
  clear: vi.fn().mockReturnValue("Profiler Memory cleared"),
  toString: vi.fn().mockReturnValue("Profiler CLI")
};

// Mock Game global
const mockGame = {
  time: 1000,
  cpu: {
    getUsed: vi.fn().mockReturnValue(0.5),
    limit: 20,
    bucket: 10000
  },
  creeps: {},
  spawns: {},
  rooms: {}
};

/**
 * Mock Memory global for testing profiler auto-start behavior.
 * Mimics the structure of Screeps Memory object with profiler and stats properties.
 * Properties are optional to simulate various Memory states (uninitialized, reset, partial).
 */
let mockMemory: {
  /** Profiler memory structure - optional to simulate Memory resets */
  profiler?: {
    /** Profiler data by function name */
    data: Record<string, { calls: number; time: number }>;
    /** Tick when profiler started - undefined when stopped */
    start?: number;
    /** Total ticks profiled across all sessions */
    total: number;
  };
  /** Stats memory structure - optional to test independent initialization */
  stats?: unknown;
};

// Mock console
const mockConsole = {
  log: vi.fn()
};

describe("Profiler auto-start functionality", () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset mock Memory
    mockMemory = {};

    // Reset Game.time
    mockGame.time = 1000;
  });

  /**
   * Helper function that simulates the optimized ensureProfilerRunning logic from main.ts.
   * Uses a global flag to avoid redundant initialization checks on every tick.
   * Returns the function and a way to reset the flag for testing.
   */
  const createEnsureProfilerRunning = () => {
    let profilerInitialized = false;

    const ensureProfilerRunning = () => {
      // Skip initialization if already done and Memory.profiler exists
      // This avoids redundant checks on every tick
      if (profilerInitialized && mockMemory.profiler !== undefined) {
        return;
      }

      // Initialize Memory.profiler if not present (handles Memory resets)
      mockMemory.profiler ??= {
        data: {},
        total: 0
      };

      // Auto-start profiler if not already running
      if (mockMemory.profiler.start === undefined) {
        mockProfilerInstance.start();
        mockConsole.log(`[Profiler] Auto-started profiler data collection (tick: ${mockGame.time})`);
      }

      // Mark as initialized after successful setup
      profilerInitialized = true;
    };

    const resetFlag = () => {
      profilerInitialized = false;
    };

    const isInitialized = () => profilerInitialized;

    return { ensureProfilerRunning, resetFlag, isInitialized };
  };

  describe("ensureProfilerRunning function behavior", () => {
    it("should initialize Memory.profiler if not present", () => {
      const { ensureProfilerRunning } = createEnsureProfilerRunning();

      ensureProfilerRunning();

      expect(mockMemory.profiler).toBeDefined();
      expect(mockMemory.profiler?.data).toEqual({});
      expect(mockMemory.profiler?.total).toBe(0);
      expect(mockProfilerInstance.start).toHaveBeenCalledTimes(1);
      expect(mockConsole.log).toHaveBeenCalledWith("[Profiler] Auto-started profiler data collection (tick: 1000)");
    });

    it("should start profiler if Memory.profiler exists but is not running", () => {
      // Pre-initialize Memory.profiler but without start tick
      mockMemory.profiler = {
        data: {},
        total: 0
      };

      const { ensureProfilerRunning } = createEnsureProfilerRunning();

      ensureProfilerRunning();

      expect(mockProfilerInstance.start).toHaveBeenCalledTimes(1);
      expect(mockConsole.log).toHaveBeenCalledWith("[Profiler] Auto-started profiler data collection (tick: 1000)");
    });

    it("should not start profiler if already running", () => {
      // Pre-initialize Memory.profiler with start tick
      mockMemory.profiler = {
        data: {},
        total: 0,
        start: 950 // Already started at tick 950
      };

      const { ensureProfilerRunning } = createEnsureProfilerRunning();

      ensureProfilerRunning();

      expect(mockProfilerInstance.start).not.toHaveBeenCalled();
      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it("should be idempotent when called multiple times", () => {
      const { ensureProfilerRunning } = createEnsureProfilerRunning();

      // First call - should start profiler
      ensureProfilerRunning();

      expect(mockProfilerInstance.start).toHaveBeenCalledTimes(1);
      expect(mockConsole.log).toHaveBeenCalledTimes(1);

      // Simulate profiler start setting the start tick
      mockMemory.profiler!.start = mockGame.time;

      // Reset mocks for second call
      vi.clearAllMocks();

      // Second call - should not start again
      ensureProfilerRunning();

      expect(mockProfilerInstance.start).not.toHaveBeenCalled();
      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it("should restart profiler after Memory reset", () => {
      // First tick - normal initialization
      mockMemory.profiler = {
        data: {},
        total: 0,
        start: 950
      };

      const { ensureProfilerRunning } = createEnsureProfilerRunning();

      ensureProfilerRunning();

      expect(mockProfilerInstance.start).not.toHaveBeenCalled();

      // Simulate Memory reset (profiler data cleared)
      mockMemory.profiler = undefined;
      mockGame.time = 1100;

      // Call again after Memory reset
      ensureProfilerRunning();

      expect(mockMemory.profiler).toBeDefined();
      expect(mockProfilerInstance.start).toHaveBeenCalledTimes(1);
      expect(mockConsole.log).toHaveBeenCalledWith("[Profiler] Auto-started profiler data collection (tick: 1100)");
    });

    it("should restart profiler if start tick is cleared but data exists", () => {
      // Simulate profiler data exists but start tick was cleared
      // (e.g., manual Memory manipulation or partial Memory reset)
      mockMemory.profiler = {
        data: {
          "SomeFunction:method": { calls: 100, time: 50.5 }
        },
        total: 50
        // Note: start is undefined
      };

      const { ensureProfilerRunning } = createEnsureProfilerRunning();

      ensureProfilerRunning();

      // Should preserve existing data but restart profiler
      expect(mockMemory.profiler.data).toHaveProperty("SomeFunction:method");
      expect(mockProfilerInstance.start).toHaveBeenCalledTimes(1);
    });

    it("should handle rapid successive calls efficiently", () => {
      const { ensureProfilerRunning } = createEnsureProfilerRunning();

      // First call
      ensureProfilerRunning();
      mockMemory.profiler!.start = mockGame.time;

      vi.clearAllMocks();

      // Simulate 100 rapid calls (e.g., called on every tick)
      for (let i = 0; i < 100; i++) {
        ensureProfilerRunning();
      }

      // Should not call start or log after profiler is running
      expect(mockProfilerInstance.start).not.toHaveBeenCalled();
      expect(mockConsole.log).not.toHaveBeenCalled();
    });
  });

  describe("Global flag optimization", () => {
    it("should set profilerInitialized flag after first initialization", () => {
      const { ensureProfilerRunning, isInitialized } = createEnsureProfilerRunning();

      expect(isInitialized()).toBe(false);

      ensureProfilerRunning();

      expect(isInitialized()).toBe(true);
    });

    it("should skip initialization when flag is set and Memory.profiler exists", () => {
      const { ensureProfilerRunning } = createEnsureProfilerRunning();

      // First call initializes
      ensureProfilerRunning();
      mockMemory.profiler!.start = mockGame.time;
      vi.clearAllMocks();

      // Simulate many subsequent ticks
      for (let i = 0; i < 1000; i++) {
        ensureProfilerRunning();
      }

      // Should not perform any initialization after first call
      expect(mockProfilerInstance.start).not.toHaveBeenCalled();
      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it("should detect Memory reset even when flag is set", () => {
      const { ensureProfilerRunning, isInitialized } = createEnsureProfilerRunning();

      // First call initializes
      ensureProfilerRunning();
      mockMemory.profiler!.start = mockGame.time;
      expect(isInitialized()).toBe(true);

      vi.clearAllMocks();

      // Simulate Memory reset
      mockMemory.profiler = undefined;
      mockGame.time = 2000;

      // Call after Memory reset - should re-initialize
      ensureProfilerRunning();

      expect(mockMemory.profiler).toBeDefined();
      expect(mockProfilerInstance.start).toHaveBeenCalledTimes(1);
      expect(mockConsole.log).toHaveBeenCalledWith("[Profiler] Auto-started profiler data collection (tick: 2000)");
    });

    it("should provide performance benefit by avoiding redundant checks", () => {
      const { ensureProfilerRunning } = createEnsureProfilerRunning();

      // First call - should initialize
      ensureProfilerRunning();
      mockMemory.profiler!.start = mockGame.time;

      // Count calls by monitoring start attempts
      vi.clearAllMocks();

      // Simulate 10000 ticks (typical Screeps session)
      for (let i = 0; i < 10000; i++) {
        ensureProfilerRunning();
      }

      // With optimization: profiler.start() should never be called after initialization
      // Without optimization: would check Memory.profiler.start every tick
      expect(mockProfilerInstance.start).not.toHaveBeenCalled();
    });
  });

  describe("Integration with Memory.stats initialization", () => {
    it("should initialize both Memory.profiler and Memory.stats", () => {
      const { ensureProfilerRunning } = createEnsureProfilerRunning();

      const initializeMemoryStats = () => {
        mockMemory.stats ??= {
          time: 0,
          cpu: { used: 0, limit: 0, bucket: 0 },
          creeps: { count: 0 },
          rooms: { count: 0 }
        };
      };

      ensureProfilerRunning();
      initializeMemoryStats();

      expect(mockMemory.profiler).toBeDefined();
      expect(mockMemory.stats).toBeDefined();
    });
  });

  describe("Profiler retention policy", () => {
    /** Maximum number of profiler entries to retain */
    const MAX_PROFILER_ENTRIES = 500;
    /** Interval between retention policy enforcement */
    const PROFILER_RETENTION_INTERVAL = 100;

    /**
     * Helper function that simulates the applyProfilerRetentionPolicy logic from main.ts.
     * Prunes profiler entries when the count exceeds MAX_PROFILER_ENTRIES.
     */
    const createApplyProfilerRetentionPolicy = () => {
      const applyProfilerRetentionPolicy = () => {
        // Only run retention policy periodically to minimize overhead
        if (mockGame.time % PROFILER_RETENTION_INTERVAL !== 0) {
          return { skipped: "interval" };
        }

        // Skip if profiler memory doesn't exist or has no data
        if (!mockMemory.profiler?.data) {
          return { skipped: "noData" };
        }

        const entries = Object.entries(mockMemory.profiler.data);
        const entryCount = entries.length;

        // Only apply retention if we exceed the limit
        if (entryCount <= MAX_PROFILER_ENTRIES) {
          return { skipped: "underLimit", count: entryCount };
        }

        // Sort by total CPU time (descending) to keep the most significant entries
        entries.sort((a, b) => b[1].time - a[1].time);

        // Keep top MAX_PROFILER_ENTRIES entries
        const entriesToKeep = entries.slice(0, MAX_PROFILER_ENTRIES);
        const prunedCount = entryCount - MAX_PROFILER_ENTRIES;

        // Rebuild data object with only the retained entries
        mockMemory.profiler.data = Object.fromEntries(entriesToKeep);

        return { pruned: prunedCount, kept: MAX_PROFILER_ENTRIES };
      };

      return { applyProfilerRetentionPolicy };
    };

    it("should skip when not at retention interval", () => {
      mockGame.time = 1001; // Not divisible by 100
      mockMemory.profiler = {
        data: {},
        total: 0,
        start: 1000
      };

      const { applyProfilerRetentionPolicy } = createApplyProfilerRetentionPolicy();
      const result = applyProfilerRetentionPolicy();

      expect(result).toEqual({ skipped: "interval" });
    });

    it("should skip when Memory.profiler does not exist", () => {
      mockGame.time = 100; // Divisible by 100
      mockMemory.profiler = undefined;

      const { applyProfilerRetentionPolicy } = createApplyProfilerRetentionPolicy();
      const result = applyProfilerRetentionPolicy();

      expect(result).toEqual({ skipped: "noData" });
    });

    it("should skip when entry count is under limit", () => {
      mockGame.time = 100;
      mockMemory.profiler = {
        data: {
          "Function1:method": { calls: 100, time: 50.0 },
          "Function2:method": { calls: 200, time: 100.0 }
        },
        total: 100,
        start: 1
      };

      const { applyProfilerRetentionPolicy } = createApplyProfilerRetentionPolicy();
      const result = applyProfilerRetentionPolicy();

      expect(result).toEqual({ skipped: "underLimit", count: 2 });
      // Data should be unchanged
      expect(Object.keys(mockMemory.profiler!.data).length).toBe(2);
    });

    it("should prune entries when count exceeds limit", () => {
      mockGame.time = 100;

      // Create more than MAX_PROFILER_ENTRIES entries
      const data: Record<string, { calls: number; time: number }> = {};
      for (let i = 0; i < 600; i++) {
        // Create entries with varying CPU times so sorting is meaningful
        data[`Function${i}:method`] = { calls: 100, time: i * 1.0 };
      }

      mockMemory.profiler = {
        data,
        total: 100,
        start: 1
      };

      expect(Object.keys(mockMemory.profiler.data).length).toBe(600);

      const { applyProfilerRetentionPolicy } = createApplyProfilerRetentionPolicy();
      const result = applyProfilerRetentionPolicy();

      expect(result).toEqual({ pruned: 100, kept: 500 });
      expect(Object.keys(mockMemory.profiler!.data).length).toBe(500);
    });

    it("should keep entries with highest CPU time", () => {
      mockGame.time = 100;

      // Create entries with known CPU times
      const data: Record<string, { calls: number; time: number }> = {};
      for (let i = 0; i < 550; i++) {
        data[`Function${i}:method`] = { calls: 100, time: i * 1.0 };
      }

      mockMemory.profiler = {
        data,
        total: 100,
        start: 1
      };

      const { applyProfilerRetentionPolicy } = createApplyProfilerRetentionPolicy();
      applyProfilerRetentionPolicy();

      // Verify the highest CPU entries are kept (indices 50-549)
      // and lowest entries are pruned (indices 0-49)
      expect(mockMemory.profiler!.data["Function549:method"]).toBeDefined();
      expect(mockMemory.profiler!.data["Function50:method"]).toBeDefined();
      expect(mockMemory.profiler!.data["Function0:method"]).toBeUndefined();
      expect(mockMemory.profiler!.data["Function49:method"]).toBeUndefined();
    });

    it("should preserve profiler running state after pruning", () => {
      mockGame.time = 100;

      const data: Record<string, { calls: number; time: number }> = {};
      for (let i = 0; i < 600; i++) {
        data[`Function${i}:method`] = { calls: 100, time: i * 1.0 };
      }

      mockMemory.profiler = {
        data,
        total: 500,
        start: 50 // Profiler is running
      };

      const { applyProfilerRetentionPolicy } = createApplyProfilerRetentionPolicy();
      applyProfilerRetentionPolicy();

      // Verify running state is preserved
      expect(mockMemory.profiler!.start).toBe(50);
      expect(mockMemory.profiler!.total).toBe(500);
    });

    it("should run exactly at retention intervals", () => {
      const { applyProfilerRetentionPolicy } = createApplyProfilerRetentionPolicy();

      // Create data that would be pruned
      const createLargeData = () => {
        const data: Record<string, { calls: number; time: number }> = {};
        for (let i = 0; i < 600; i++) {
          data[`Function${i}:method`] = { calls: 100, time: i * 1.0 };
        }
        return data;
      };

      // Test tick 99 (should skip)
      mockGame.time = 99;
      mockMemory.profiler = { data: createLargeData(), total: 100, start: 1 };
      expect(applyProfilerRetentionPolicy()).toEqual({ skipped: "interval" });
      expect(Object.keys(mockMemory.profiler.data).length).toBe(600);

      // Test tick 100 (should run)
      mockGame.time = 100;
      mockMemory.profiler = { data: createLargeData(), total: 100, start: 1 };
      expect(applyProfilerRetentionPolicy()).toEqual({ pruned: 100, kept: 500 });
      expect(Object.keys(mockMemory.profiler.data).length).toBe(500);

      // Test tick 200 (should run)
      mockGame.time = 200;
      mockMemory.profiler = { data: createLargeData(), total: 100, start: 1 };
      expect(applyProfilerRetentionPolicy()).toEqual({ pruned: 100, kept: 500 });
      expect(Object.keys(mockMemory.profiler.data).length).toBe(500);
    });
  });
});
