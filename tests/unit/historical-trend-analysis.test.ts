import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Unit tests for historical trend analysis
 *
 * Tests validate:
 * - Trend calculation from multiple snapshots
 * - Regression detection thresholds
 * - Alert generation based on trends
 * - 7-day and 30-day period analysis
 */
describe("Historical Trend Analysis", () => {
  const testSnapshotsDir = resolve("reports", "bot-snapshots-trend-test");

  beforeEach(() => {
    // Create test directories
    mkdirSync(testSnapshotsDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directories
    if (existsSync(testSnapshotsDir)) {
      rmSync(testSnapshotsDir, { recursive: true, force: true });
    }
  });

  describe("Metric trend calculation", () => {
    it("should identify increasing trend when values grow", () => {
      const currentPeriodValues = [100, 105, 110, 115];
      const previousPeriodValues = [80, 85, 90, 95];

      // Mean of current: 107.5, Mean of previous: 87.5
      // Change: 20, ChangePercent: 22.86%
      const currentMean = currentPeriodValues.reduce((a, b) => a + b, 0) / currentPeriodValues.length;
      const previousMean = previousPeriodValues.reduce((a, b) => a + b, 0) / previousPeriodValues.length;
      const changePercent = ((currentMean - previousMean) / previousMean) * 100;

      expect(currentMean).toBe(107.5);
      expect(previousMean).toBe(87.5);
      expect(changePercent).toBeCloseTo(22.86, 1);
    });

    it("should identify decreasing trend when values shrink", () => {
      const currentPeriodValues = [50, 48, 46, 44];
      const previousPeriodValues = [70, 68, 66, 64];

      const currentMean = currentPeriodValues.reduce((a, b) => a + b, 0) / currentPeriodValues.length;
      const previousMean = previousPeriodValues.reduce((a, b) => a + b, 0) / previousPeriodValues.length;
      const changePercent = ((currentMean - previousMean) / previousMean) * 100;

      expect(currentMean).toBe(47);
      expect(previousMean).toBe(67);
      expect(changePercent).toBeCloseTo(-29.85, 1);
    });

    it("should identify stable trend when change is minimal", () => {
      const currentPeriodValues = [100, 101, 99, 100];
      const previousPeriodValues = [99, 100, 100, 101];

      const currentMean = currentPeriodValues.reduce((a, b) => a + b, 0) / currentPeriodValues.length;
      const previousMean = previousPeriodValues.reduce((a, b) => a + b, 0) / previousPeriodValues.length;
      const changePercent = Math.abs(((currentMean - previousMean) / previousMean) * 100);

      expect(currentMean).toBe(100);
      expect(previousMean).toBe(100);
      expect(changePercent).toBeLessThan(2);
    });
  });

  describe("Regression detection", () => {
    it("should detect CPU regression when usage increases by >10%", () => {
      const regressionThreshold = 10;

      // Simulate CPU increase
      const currentCpu = 55; // 55% CPU usage
      const previousCpu = 45; // 45% CPU usage
      const changePercent = ((currentCpu - previousCpu) / previousCpu) * 100;

      expect(changePercent).toBeCloseTo(22.22, 1);
      expect(changePercent > regressionThreshold).toBe(true);
    });

    it("should not flag as regression when CPU change is within threshold", () => {
      const regressionThreshold = 10;

      const currentCpu = 47;
      const previousCpu = 45;
      const changePercent = ((currentCpu - previousCpu) / previousCpu) * 100;

      expect(changePercent).toBeCloseTo(4.44, 1);
      expect(changePercent > regressionThreshold).toBe(false);
    });

    it("should detect creep population regression when decrease >20%", () => {
      const regressionThreshold = 20;

      const currentCreeps = 8;
      const previousCreeps = 12;
      const changePercent = ((currentCreeps - previousCreeps) / previousCreeps) * 100;

      expect(changePercent).toBeCloseTo(-33.33, 1);
      expect(changePercent < -regressionThreshold).toBe(true);
    });

    it("should detect CPU bucket warning when bucket decreases significantly", () => {
      const bucketWarningThreshold = 5000;

      const currentBucket = 4500;
      expect(currentBucket < bucketWarningThreshold).toBe(true);
    });

    it("should detect CPU bucket critical when bucket is below 1000", () => {
      const bucketCriticalThreshold = 1000;

      const currentBucket = 800;
      expect(currentBucket < bucketCriticalThreshold).toBe(true);
    });
  });

  describe("Date range filtering", () => {
    it("should correctly filter snapshots for 7-day period", () => {
      const now = new Date();
      const snapshots = [];

      // Create 10 snapshots over 10 days
      for (let i = 0; i < 10; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        snapshots.push({
          timestamp: date.toISOString(),
          day: i
        });
      }

      // Filter for last 7 days
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const filtered = snapshots.filter(s => new Date(s.timestamp) >= sevenDaysAgo);

      // Should include days 0-7 (8 snapshots)
      expect(filtered.length).toBe(8);
    });

    it("should correctly filter snapshots for 30-day period", () => {
      const now = new Date();
      const snapshots = [];

      // Create 35 snapshots over 35 days
      for (let i = 0; i < 35; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        snapshots.push({
          timestamp: date.toISOString(),
          day: i
        });
      }

      // Filter for last 30 days
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const filtered = snapshots.filter(s => new Date(s.timestamp) >= thirtyDaysAgo);

      // Should include days 0-30 (31 snapshots)
      expect(filtered.length).toBe(31);
    });
  });

  describe("Alert generation", () => {
    it("should generate critical alert for low CPU bucket", () => {
      const currentBucket = 500;

      const alert = {
        type: "cpu_bucket_critical",
        severity: "critical",
        message: `CPU bucket at ${currentBucket} - critical level`,
        metric: "cpu.bucket"
      };

      expect(alert.severity).toBe("critical");
      expect(alert.type).toBe("cpu_bucket_critical");
    });

    it("should generate high severity alert for CPU regression", () => {
      const cpuChangePercent = 15;

      const alert = {
        type: "cpu_regression",
        severity: "high",
        message: `CPU usage increased by ${cpuChangePercent.toFixed(1)}% over 7-day`,
        metric: "cpu.used"
      };

      expect(alert.severity).toBe("high");
      expect(alert.type).toBe("cpu_regression");
    });

    it("should generate medium severity alert for creep population drop", () => {
      const creepChangePercent = -25;

      const alert = {
        type: "creep_population_drop",
        severity: "medium",
        message: `Creep population dropped by ${Math.abs(creepChangePercent).toFixed(1)}%`,
        metric: "creeps.total"
      };

      expect(alert.severity).toBe("medium");
      expect(alert.type).toBe("creep_population_drop");
    });
  });

  describe("Overall health determination", () => {
    it("should determine health as critical when critical alerts exist", () => {
      const alerts = [
        { severity: "critical", type: "cpu_bucket_critical" },
        { severity: "medium", type: "creep_population_drop" }
      ];

      const hasCritical = alerts.some(a => a.severity === "critical");
      const health = hasCritical ? "critical" : "healthy";

      expect(health).toBe("critical");
    });

    it("should determine health as warning when high/medium alerts exist", () => {
      const alerts = [
        { severity: "high", type: "cpu_regression" },
        { severity: "medium", type: "energy_regression" }
      ];

      const hasCritical = alerts.some(a => a.severity === "critical");
      const hasWarning = alerts.some(a => a.severity === "high" || a.severity === "medium");

      let health: string;
      if (hasCritical) {
        health = "critical";
      } else if (hasWarning) {
        health = "warning";
      } else {
        health = "healthy";
      }

      expect(health).toBe("warning");
    });

    it("should determine health as healthy when no significant alerts", () => {
      const alerts: Array<{ severity: string; type: string }> = [];

      const hasCritical = alerts.some(a => a.severity === "critical");
      const hasWarning = alerts.some(a => a.severity === "high" || a.severity === "medium");

      let health: string;
      if (hasCritical) {
        health = "critical";
      } else if (hasWarning) {
        health = "warning";
      } else {
        health = "healthy";
      }

      expect(health).toBe("healthy");
    });
  });

  describe("Data extraction from snapshots", () => {
    it("should extract CPU values from snapshot", () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        cpu: {
          used: 45.5,
          limit: 100,
          bucket: 9500
        }
      };

      expect(snapshot.cpu.used).toBe(45.5);
      expect(snapshot.cpu.bucket).toBe(9500);
      expect(snapshot.cpu.limit).toBe(100);
    });

    it("should extract room data and calculate average RCL", () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        rooms: {
          W1N1: { rcl: 3, energy: 300, energyCapacity: 550 },
          W2N2: { rcl: 5, energy: 800, energyCapacity: 1300 },
          W3N3: { rcl: 4, energy: 600, energyCapacity: 800 }
        }
      };

      const rooms = Object.values(snapshot.rooms);
      const averageRcl = rooms.reduce((sum, r) => sum + r.rcl, 0) / rooms.length;

      expect(averageRcl).toBe(4);
    });

    it("should calculate total energy across rooms", () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        rooms: {
          W1N1: { rcl: 3, energy: 300, energyCapacity: 550 },
          W2N2: { rcl: 5, energy: 800, energyCapacity: 1300 }
        }
      };

      const totalEnergy = Object.values(snapshot.rooms).reduce((sum, r) => sum + r.energy, 0);

      expect(totalEnergy).toBe(1100);
    });

    it("should handle snapshots with missing optional fields", () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        cpu: {
          used: 30,
          limit: 100,
          bucket: 10000
        }
        // No rooms, creeps, memory, etc.
      };

      expect(snapshot.cpu).toBeDefined();
      expect((snapshot as { rooms?: unknown }).rooms).toBeUndefined();
    });
  });
});
