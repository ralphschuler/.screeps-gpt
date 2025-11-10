import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { checkProfilerHealth } from "../../packages/utilities/scripts/check-profiler-health";
import type { ProfilerSnapshot } from "../../packages/bot/src/shared/profiler-types";

const testDir = resolve("test-reports", "profiler");
const testFile = resolve(testDir, "latest.json");

describe("check-profiler-health", () => {
  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testFile);
    } catch {
      // File may not exist
    }
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  });

  describe("File existence checks", () => {
    it("should return error when profiler report does not exist", async () => {
      const result = await checkProfilerHealth(testFile);
      expect(result.status).toBe("error");
      expect(result.message).toContain("not found");
    });

    it("should return error for invalid JSON", async () => {
      await writeFile(testFile, "invalid json", "utf-8");
      const result = await checkProfilerHealth(testFile);
      expect(result.status).toBe("error");
      expect(result.message).toContain("Failed to parse");
    });
  });

  describe("Profiler status checks", () => {
    it("should return error when fetch failed", async () => {
      const snapshot: ProfilerSnapshot = {
        fetchedAt: new Date().toISOString(),
        source: "console",
        isEnabled: false,
        hasData: false,
        error: "Connection timeout"
      };
      await writeFile(testFile, JSON.stringify(snapshot), "utf-8");

      const result = await checkProfilerHealth(testFile);
      expect(result.status).toBe("error");
      expect(result.message).toContain("fetch failed");
      expect(result.details).toContain("Connection timeout");
    });

    it("should return warning when profiler is not running", async () => {
      const snapshot: ProfilerSnapshot = {
        fetchedAt: new Date().toISOString(),
        source: "console",
        isEnabled: false,
        hasData: false
      };
      await writeFile(testFile, JSON.stringify(snapshot), "utf-8");

      const result = await checkProfilerHealth(testFile);
      expect(result.status).toBe("warning");
      expect(result.message).toContain("not running");
    });

    it("should return warning when profiler has no data", async () => {
      const snapshot: ProfilerSnapshot = {
        fetchedAt: new Date().toISOString(),
        source: "console",
        isEnabled: true,
        hasData: false
      };
      await writeFile(testFile, JSON.stringify(snapshot), "utf-8");

      const result = await checkProfilerHealth(testFile);
      expect(result.status).toBe("warning");
      expect(result.message).toContain("no data");
    });

    it("should return warning when data is stale", async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const snapshot: ProfilerSnapshot = {
        fetchedAt: twoHoursAgo.toISOString(),
        source: "console",
        isEnabled: true,
        hasData: true,
        profilerMemory: {
          data: {
            "test:function": { calls: 100, time: 50 }
          },
          total: 100
        },
        summary: {
          totalTicks: 100,
          totalFunctions: 1,
          averageCpuPerTick: 0.5,
          topCpuConsumers: [
            {
              name: "test:function",
              calls: 100,
              cpuPerCall: 0.5,
              callsPerTick: 1.0,
              cpuPerTick: 0.5,
              percentOfTotal: 100
            }
          ]
        }
      };
      await writeFile(testFile, JSON.stringify(snapshot), "utf-8");

      const result = await checkProfilerHealth(testFile);
      expect(result.status).toBe("warning");
      expect(result.message).toContain("stale");
    });
  });

  describe("Healthy profiler", () => {
    it("should return healthy status with valid profiler data", async () => {
      const snapshot: ProfilerSnapshot = {
        fetchedAt: new Date().toISOString(),
        source: "console",
        isEnabled: true,
        hasData: true,
        profilerMemory: {
          data: {
            "BehaviorController:execute": { calls: 1000, time: 5000 },
            "Kernel:run": { calls: 1000, time: 3000 }
          },
          start: 1000,
          total: 1000
        },
        summary: {
          totalTicks: 1000,
          totalFunctions: 2,
          averageCpuPerTick: 8.0,
          topCpuConsumers: [
            {
              name: "BehaviorController:execute",
              calls: 1000,
              cpuPerCall: 5.0,
              callsPerTick: 1.0,
              cpuPerTick: 5.0,
              percentOfTotal: 62.5
            },
            {
              name: "Kernel:run",
              calls: 1000,
              cpuPerCall: 3.0,
              callsPerTick: 1.0,
              cpuPerTick: 3.0,
              percentOfTotal: 37.5
            }
          ]
        }
      };
      await writeFile(testFile, JSON.stringify(snapshot), "utf-8");

      const result = await checkProfilerHealth(testFile);
      expect(result.status).toBe("healthy");
      expect(result.message).toContain("operational");
      expect(result.details).toBeDefined();
      expect(result.details?.some(d => d.includes("Total ticks: 1000"))).toBe(true);
      expect(result.details?.some(d => d.includes("BehaviorController:execute"))).toBe(true);
    });

    it("should include summary statistics in details", async () => {
      const snapshot: ProfilerSnapshot = {
        fetchedAt: new Date().toISOString(),
        source: "console",
        isEnabled: true,
        hasData: true,
        profilerMemory: {
          data: {
            "test:function": { calls: 500, time: 2500 }
          },
          total: 500
        },
        summary: {
          totalTicks: 500,
          totalFunctions: 1,
          averageCpuPerTick: 5.0,
          topCpuConsumers: [
            {
              name: "test:function",
              calls: 500,
              cpuPerCall: 5.0,
              callsPerTick: 1.0,
              cpuPerTick: 5.0,
              percentOfTotal: 100
            }
          ]
        }
      };
      await writeFile(testFile, JSON.stringify(snapshot), "utf-8");

      const result = await checkProfilerHealth(testFile);
      expect(result.details).toContain("Total ticks: 500");
      expect(result.details).toContain("Functions profiled: 1");
      expect(result.details).toContain("Avg CPU/tick: 5.00ms");
    });
  });
});
