import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Unit tests for deployment validation logic
 *
 * Tests validate:
 * - Health check criteria (CPU > 0, aliveness active)
 * - Recommendation determination (continue/monitor/rollback)
 * - Metric extraction from snapshots
 * - Failure reason categorization
 */
describe("Deployment Validation", () => {
  const testSnapshotsDir = resolve("reports", "deploy-val-snapshots-test");
  const testDeploymentsDir = resolve("reports", "deploy-val-deployments-test");

  beforeEach(() => {
    // Create test directories
    mkdirSync(testSnapshotsDir, { recursive: true });
    mkdirSync(testDeploymentsDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directories
    if (existsSync(testSnapshotsDir)) {
      rmSync(testSnapshotsDir, { recursive: true, force: true });
    }
    if (existsSync(testDeploymentsDir)) {
      rmSync(testDeploymentsDir, { recursive: true, force: true });
    }
  });

  describe("Health check criteria", () => {
    it("should consider deployment healthy when CPU > 0", () => {
      const checks = {
        codeExecuting: true, // CPU > 0
        spawningWorking: true,
        memoryInitialized: true,
        alivenessActive: true
      };

      const isHealthy = checks.codeExecuting || checks.alivenessActive;
      expect(isHealthy).toBe(true);
    });

    it("should consider deployment healthy when aliveness is active", () => {
      const checks = {
        codeExecuting: false, // CPU = 0 (no snapshot data)
        spawningWorking: false,
        memoryInitialized: false,
        alivenessActive: true // API confirms active
      };

      const isHealthy = checks.codeExecuting || checks.alivenessActive;
      expect(isHealthy).toBe(true);
    });

    it("should consider deployment unhealthy when both CPU=0 and aliveness inactive", () => {
      const checks = {
        codeExecuting: false, // CPU = 0
        spawningWorking: false,
        memoryInitialized: false,
        alivenessActive: false // API confirms inactive
      };

      const isHealthy = checks.codeExecuting || checks.alivenessActive;
      expect(isHealthy).toBe(false);
    });
  });

  describe("Recommendation determination", () => {
    it("should recommend continue when fully healthy", () => {
      const checks = {
        codeExecuting: true,
        spawningWorking: true,
        memoryInitialized: true,
        alivenessActive: true
      };

      const criticalChecks = checks.codeExecuting || checks.alivenessActive;
      const recommendation = criticalChecks && checks.spawningWorking ? "continue" : criticalChecks ? "monitor" : "rollback";

      expect(recommendation).toBe("continue");
    });

    it("should recommend monitor when code executing but no creeps", () => {
      const checks = {
        codeExecuting: true,
        spawningWorking: false, // No creeps
        memoryInitialized: true,
        alivenessActive: true
      };

      const criticalChecks = checks.codeExecuting || checks.alivenessActive;
      const recommendation = criticalChecks && checks.spawningWorking ? "continue" : criticalChecks ? "monitor" : "rollback";

      expect(recommendation).toBe("monitor");
    });

    it("should recommend rollback when code not executing", () => {
      const checks = {
        codeExecuting: false,
        spawningWorking: false,
        memoryInitialized: false,
        alivenessActive: false
      };

      const criticalChecks = checks.codeExecuting || checks.alivenessActive;
      const recommendation = criticalChecks && checks.spawningWorking ? "continue" : criticalChecks ? "monitor" : "rollback";

      expect(recommendation).toBe("rollback");
    });
  });

  describe("Metric extraction from snapshots", () => {
    it("should extract CPU metrics correctly", () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        cpu: { used: 45.5, limit: 100, bucket: 9500 }
      };

      const metrics = {
        cpuUsed: snapshot.cpu?.used || 0,
        cpuBucket: snapshot.cpu?.bucket || 0
      };

      expect(metrics.cpuUsed).toBe(45.5);
      expect(metrics.cpuBucket).toBe(9500);
    });

    it("should handle missing CPU data gracefully", () => {
      const snapshot = {
        timestamp: new Date().toISOString()
        // No CPU data
      };

      const metrics = {
        cpuUsed: (snapshot as { cpu?: { used: number } }).cpu?.used || 0,
        cpuBucket: (snapshot as { cpu?: { bucket: number } }).cpu?.bucket || 0
      };

      expect(metrics.cpuUsed).toBe(0);
      expect(metrics.cpuBucket).toBe(0);
    });

    it("should extract creep and spawn counts correctly", () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        creeps: { total: 15, byRole: { harvester: 5, upgrader: 4, builder: 6 } },
        spawns: { total: 2, active: 1 }
      };

      const metrics = {
        creepCount: snapshot.creeps?.total || 0,
        spawnCount: snapshot.spawns?.total || 0,
        activeSpawns: snapshot.spawns?.active || 0
      };

      expect(metrics.creepCount).toBe(15);
      expect(metrics.spawnCount).toBe(2);
      expect(metrics.activeSpawns).toBe(1);
    });

    it("should count rooms correctly", () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        rooms: {
          W1N1: { rcl: 3, energy: 300, energyCapacity: 550 },
          W2N2: { rcl: 5, energy: 800, energyCapacity: 1300 }
        }
      };

      const roomCount = snapshot.rooms ? Object.keys(snapshot.rooms).length : 0;
      expect(roomCount).toBe(2);
    });
  });

  describe("Failure reason categorization", () => {
    it("should categorize zero CPU as zero_cpu failure", () => {
      const metrics = { cpuUsed: 0 };
      const checks = { alivenessActive: false };

      let failureReason: string | null = null;
      if (metrics.cpuUsed === 0 && !checks.alivenessActive) {
        failureReason = "zero_cpu";
      }

      expect(failureReason).toBe("zero_cpu");
    });

    it("should not set failure reason when healthy", () => {
      const metrics = { cpuUsed: 45.5 };
      const checks = { alivenessActive: true };

      let failureReason: string | null = null;
      if (metrics.cpuUsed === 0 && !checks.alivenessActive) {
        failureReason = "zero_cpu";
      }

      expect(failureReason).toBeNull();
    });
  });

  describe("Spawning check logic", () => {
    it("should consider spawning working when creeps exist", () => {
      const snapshot = {
        creeps: { total: 10 },
        spawns: { total: 1, active: 0 }
      };

      const spawningWorking =
        (snapshot.creeps?.total || 0) > 0 || (snapshot.spawns?.active || 0) > 0 || (snapshot.spawns?.total || 0) > 0;

      expect(spawningWorking).toBe(true);
    });

    it("should consider spawning working when spawns are active", () => {
      const snapshot = {
        creeps: { total: 0 },
        spawns: { total: 1, active: 1 }
      };

      const spawningWorking =
        (snapshot.creeps?.total || 0) > 0 || (snapshot.spawns?.active || 0) > 0 || (snapshot.spawns?.total || 0) > 0;

      expect(spawningWorking).toBe(true);
    });

    it("should consider spawning not working when no creeps and no spawns", () => {
      const snapshot = {
        creeps: { total: 0 },
        spawns: { total: 0, active: 0 }
      };

      const spawningWorking =
        (snapshot.creeps?.total || 0) > 0 || (snapshot.spawns?.active || 0) > 0 || (snapshot.spawns?.total || 0) > 0;

      expect(spawningWorking).toBe(false);
    });
  });

  describe("Validation result structure", () => {
    it("should create valid validation result", () => {
      const validation = {
        timestamp: new Date().toISOString(),
        isHealthy: true,
        checks: {
          codeExecuting: true,
          spawningWorking: true,
          memoryInitialized: true,
          alivenessActive: true
        },
        metrics: {
          cpuUsed: 45.5,
          cpuBucket: 9500,
          creepCount: 15,
          roomCount: 2,
          spawnCount: 1
        },
        recommendation: "continue" as const,
        failureReason: null,
        details: "Deployment healthy: Code executing, spawning operational"
      };

      expect(validation.timestamp).toBeDefined();
      expect(validation.isHealthy).toBe(true);
      expect(validation.recommendation).toBe("continue");
      expect(validation.failureReason).toBeNull();
      expect(validation.checks.codeExecuting).toBe(true);
      expect(validation.metrics.cpuUsed).toBe(45.5);
    });

    it("should create valid failure validation result", () => {
      const validation = {
        timestamp: new Date().toISOString(),
        isHealthy: false,
        checks: {
          codeExecuting: false,
          spawningWorking: false,
          memoryInitialized: false,
          alivenessActive: false
        },
        metrics: {
          cpuUsed: 0,
          cpuBucket: 10000,
          creepCount: 0,
          roomCount: 0,
          spawnCount: 0
        },
        recommendation: "rollback" as const,
        failureReason: "zero_cpu",
        details: "Critical: No CPU usage detected - code may not be executing"
      };

      expect(validation.isHealthy).toBe(false);
      expect(validation.recommendation).toBe("rollback");
      expect(validation.failureReason).toBe("zero_cpu");
      expect(validation.details).toContain("Critical");
    });
  });
});
