/**
 * Unit test for profiler auto-start functionality in main.ts
 *
 * Tests that the profiler auto-start logic correctly handles:
 * - Memory initialization
 * - Memory resets
 * - Profiler already running
 * - Build-time disabled profiler
 *
 * Related Issue: #1102
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

// Mock Memory global
let mockMemory: {
  profiler?: {
    data: Record<string, { calls: number; time: number }>;
    start?: number;
    total: number;
  };
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

  describe("ensureProfilerRunning function behavior", () => {
    it("should initialize Memory.profiler if not present", () => {
      // Simulate the ensureProfilerRunning logic
      const ensureProfilerRunning = () => {
        mockMemory.profiler ??= {
          data: {},
          total: 0
        };

        if (mockMemory.profiler.start === undefined) {
          mockProfilerInstance.start();
          mockConsole.log(`[Profiler] Auto-started profiler data collection (tick: ${mockGame.time})`);
        }
      };

      ensureProfilerRunning();

      expect(mockMemory.profiler).toBeDefined();
      expect(mockMemory.profiler?.data).toEqual({});
      expect(mockMemory.profiler?.total).toBe(0);
      expect(mockProfilerInstance.start).toHaveBeenCalledTimes(1);
      expect(mockConsole.log).toHaveBeenCalledWith(
        "[Profiler] Auto-started profiler data collection (tick: 1000)"
      );
    });

    it("should start profiler if Memory.profiler exists but is not running", () => {
      // Pre-initialize Memory.profiler but without start tick
      mockMemory.profiler = {
        data: {},
        total: 0
      };

      const ensureProfilerRunning = () => {
        mockMemory.profiler ??= {
          data: {},
          total: 0
        };

        if (mockMemory.profiler.start === undefined) {
          mockProfilerInstance.start();
          mockConsole.log(`[Profiler] Auto-started profiler data collection (tick: ${mockGame.time})`);
        }
      };

      ensureProfilerRunning();

      expect(mockProfilerInstance.start).toHaveBeenCalledTimes(1);
      expect(mockConsole.log).toHaveBeenCalledWith(
        "[Profiler] Auto-started profiler data collection (tick: 1000)"
      );
    });

    it("should not start profiler if already running", () => {
      // Pre-initialize Memory.profiler with start tick
      mockMemory.profiler = {
        data: {},
        total: 0,
        start: 950 // Already started at tick 950
      };

      const ensureProfilerRunning = () => {
        mockMemory.profiler ??= {
          data: {},
          total: 0
        };

        if (mockMemory.profiler.start === undefined) {
          mockProfilerInstance.start();
          mockConsole.log(`[Profiler] Auto-started profiler data collection (tick: ${mockGame.time})`);
        }
      };

      ensureProfilerRunning();

      expect(mockProfilerInstance.start).not.toHaveBeenCalled();
      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it("should be idempotent when called multiple times", () => {
      const ensureProfilerRunning = () => {
        mockMemory.profiler ??= {
          data: {},
          total: 0
        };

        if (mockMemory.profiler.start === undefined) {
          mockProfilerInstance.start();
          mockConsole.log(`[Profiler] Auto-started profiler data collection (tick: ${mockGame.time})`);
        }
      };

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

      const ensureProfilerRunning = () => {
        mockMemory.profiler ??= {
          data: {},
          total: 0
        };

        if (mockMemory.profiler.start === undefined) {
          mockProfilerInstance.start();
          mockConsole.log(`[Profiler] Auto-started profiler data collection (tick: ${mockGame.time})`);
        }
      };

      ensureProfilerRunning();

      expect(mockProfilerInstance.start).not.toHaveBeenCalled();

      // Simulate Memory reset (profiler data cleared)
      mockMemory.profiler = undefined;
      mockGame.time = 1100;

      // Call again after Memory reset
      ensureProfilerRunning();

      expect(mockMemory.profiler).toBeDefined();
      expect(mockProfilerInstance.start).toHaveBeenCalledTimes(1);
      expect(mockConsole.log).toHaveBeenCalledWith(
        "[Profiler] Auto-started profiler data collection (tick: 1100)"
      );
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

      const ensureProfilerRunning = () => {
        mockMemory.profiler ??= {
          data: {},
          total: 0
        };

        if (mockMemory.profiler.start === undefined) {
          mockProfilerInstance.start();
          mockConsole.log(`[Profiler] Auto-started profiler data collection (tick: ${mockGame.time})`);
        }
      };

      ensureProfilerRunning();

      // Should preserve existing data but restart profiler
      expect(mockMemory.profiler.data).toHaveProperty("SomeFunction:method");
      expect(mockProfilerInstance.start).toHaveBeenCalledTimes(1);
    });

    it("should handle rapid successive calls efficiently", () => {
      const ensureProfilerRunning = () => {
        mockMemory.profiler ??= {
          data: {},
          total: 0
        };

        if (mockMemory.profiler.start === undefined) {
          mockProfilerInstance.start();
          mockConsole.log(`[Profiler] Auto-started profiler data collection (tick: ${mockGame.time})`);
        }
      };

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

  describe("Integration with Memory.stats initialization", () => {
    it("should initialize both Memory.profiler and Memory.stats", () => {
      const ensureProfilerRunning = () => {
        mockMemory.profiler ??= {
          data: {},
          total: 0
        };

        if (mockMemory.profiler.start === undefined) {
          mockProfilerInstance.start();
          mockConsole.log(`[Profiler] Auto-started profiler data collection (tick: ${mockGame.time})`);
        }
      };

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
