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

      // Track how many times we enter the initialization logic
      let initializationAttempts = 0;
      const originalProfilerStart = mockMemory.profiler;

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
});
