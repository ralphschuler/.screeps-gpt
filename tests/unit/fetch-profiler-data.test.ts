import { describe, it, expect } from "vitest";
import {
  createProfilerSnapshot,
  calculateProfilerSummary,
  type ProfilerMemory
} from "../../scripts/fetch-profiler-data";

describe("fetch-profiler-data", () => {
  describe("createProfilerSnapshot", () => {
    it("should create snapshot with error when profiler data is null", () => {
      const snapshot = createProfilerSnapshot(null);

      expect(snapshot.isEnabled).toBe(false);
      expect(snapshot.hasData).toBe(false);
      expect(snapshot.error).toBeDefined();
      expect(snapshot.error).toContain("not available");
    });

    it("should create snapshot with profiler data", () => {
      const profilerMemory: ProfilerMemory = {
        data: {
          "Kernel:run": { calls: 100, time: 230 },
          "BehaviorController:execute": { calls: 200, time: 450 }
        },
        total: 100
      };

      const snapshot = createProfilerSnapshot(profilerMemory);

      expect(snapshot.isEnabled).toBe(false);
      expect(snapshot.hasData).toBe(true);
      expect(snapshot.profilerMemory).toEqual(profilerMemory);
      expect(snapshot.summary).toBeDefined();
    });

    it("should detect enabled profiler when start is set", () => {
      const profilerMemory: ProfilerMemory = {
        data: {
          "Kernel:run": { calls: 50, time: 115 }
        },
        start: 12345,
        total: 50
      };

      const snapshot = createProfilerSnapshot(profilerMemory);

      expect(snapshot.isEnabled).toBe(true);
      expect(snapshot.hasData).toBe(true);
    });

    it("should handle empty profiler data", () => {
      const profilerMemory: ProfilerMemory = {
        data: {},
        total: 0
      };

      const snapshot = createProfilerSnapshot(profilerMemory);

      expect(snapshot.isEnabled).toBe(false);
      expect(snapshot.hasData).toBe(false);
      expect(snapshot.summary).toBeUndefined();
    });
  });

  describe("calculateProfilerSummary", () => {
    it("should calculate correct metrics for profiler data", () => {
      const profilerMemory: ProfilerMemory = {
        data: {
          "Kernel:run": { calls: 100, time: 230 },
          "BehaviorController:execute": { calls: 200, time: 450 },
          "MemoryManager:pruneMissingCreeps": { calls: 100, time: 15 }
        },
        total: 100
      };

      const summary = calculateProfilerSummary(profilerMemory);

      expect(summary.totalTicks).toBe(100);
      expect(summary.totalFunctions).toBe(3);
      expect(summary.averageCpuPerTick).toBeCloseTo(6.95, 2); // (230 + 450 + 15) / 100
      expect(summary.topCpuConsumers).toHaveLength(3);
    });

    it("should sort CPU consumers by CPU per tick descending", () => {
      const profilerMemory: ProfilerMemory = {
        data: {
          "LowCpu:method": { calls: 100, time: 10 },
          "HighCpu:method": { calls: 100, time: 500 },
          "MediumCpu:method": { calls: 100, time: 200 }
        },
        total: 100
      };

      const summary = calculateProfilerSummary(profilerMemory);

      expect(summary.topCpuConsumers[0].name).toBe("HighCpu:method");
      expect(summary.topCpuConsumers[1].name).toBe("MediumCpu:method");
      expect(summary.topCpuConsumers[2].name).toBe("LowCpu:method");
    });

    it("should calculate correct percentages of total CPU", () => {
      const profilerMemory: ProfilerMemory = {
        data: {
          Method1: { calls: 100, time: 500 }, // 50% of total (500/1000)
          Method2: { calls: 100, time: 300 }, // 30% of total (300/1000)
          Method3: { calls: 100, time: 200 } // 20% of total (200/1000)
        },
        total: 100
      };

      const summary = calculateProfilerSummary(profilerMemory);

      expect(summary.topCpuConsumers[0].percentOfTotal).toBeCloseTo(50, 0);
      expect(summary.topCpuConsumers[1].percentOfTotal).toBeCloseTo(30, 0);
      expect(summary.topCpuConsumers[2].percentOfTotal).toBeCloseTo(20, 0);
    });

    it("should limit top consumers to 20 functions", () => {
      const profilerMemory: ProfilerMemory = {
        data: {},
        total: 100
      };

      // Add 30 functions
      for (let i = 0; i < 30; i++) {
        profilerMemory.data[`Function${i}`] = { calls: 100, time: 100 - i };
      }

      const summary = calculateProfilerSummary(profilerMemory);

      expect(summary.totalFunctions).toBe(30);
      expect(summary.topCpuConsumers).toHaveLength(20);
    });

    it("should calculate CPU per call correctly", () => {
      const profilerMemory: ProfilerMemory = {
        data: {
          TestMethod: { calls: 50, time: 150 }
        },
        total: 100
      };

      const summary = calculateProfilerSummary(profilerMemory);

      expect(summary.topCpuConsumers[0].cpuPerCall).toBeCloseTo(3.0, 2); // 150 / 50
      expect(summary.topCpuConsumers[0].callsPerTick).toBeCloseTo(0.5, 2); // 50 / 100
      expect(summary.topCpuConsumers[0].cpuPerTick).toBeCloseTo(1.5, 2); // 150 / 100
    });

    it("should account for currently running profiler in total ticks", () => {
      const profilerMemory: ProfilerMemory = {
        data: {
          TestMethod: { calls: 100, time: 200 }
        },
        start: 12345, // Profiler is running
        total: 100
      };

      const summary = calculateProfilerSummary(profilerMemory);

      // Total ticks should be 100 + estimated 100 (from running profiler)
      expect(summary.totalTicks).toBe(200);
    });
  });
});
