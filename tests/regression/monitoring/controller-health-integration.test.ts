import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyzeControllerHealth } from "../../../packages/utilities/scripts/check-controller-health";
import type { BotSnapshot } from "../../../packages/utilities/scripts/types/bot-snapshot";

/**
 * Integration tests for controller health monitoring in screeps-monitoring.yml workflow
 *
 * These tests ensure that the controller health monitoring:
 * 1. Correctly analyzes bot snapshots with controller data
 * 2. Generates appropriate alerts at correct thresholds (48h info, 24h warning, 12h critical)
 * 3. Integrates with PTR alert system
 * 4. Provides accurate metrics for email notifications
 */
describe("Controller Health Monitoring Integration", () => {
  const testReportsDir = resolve("/tmp/test-reports-controller-health");
  const snapshotsDir = resolve(testReportsDir, "bot-snapshots");
  const originalCwd = process.cwd();

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testReportsDir)) {
      rmSync(testReportsDir, { recursive: true, force: true });
    }
    mkdirSync(snapshotsDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up
    if (existsSync(testReportsDir)) {
      rmSync(testReportsDir, { recursive: true, force: true });
    }
    process.chdir(originalCwd);
  });

  describe("Bot Snapshot with Controller Data", () => {
    it("should include ticksToDowngrade field in snapshots", () => {
      // Create a snapshot with controller downgrade data
      const snapshot: BotSnapshot = {
        timestamp: new Date().toISOString(),
        tick: 12345,
        cpu: {
          used: 50,
          limit: 100,
          bucket: 8000
        },
        rooms: {
          W1N1: {
            rcl: 4,
            energy: 1300,
            energyCapacity: 1300,
            controllerProgress: 50000,
            controllerProgressTotal: 540000,
            ticksToDowngrade: 35000 // ~13 hours - warning threshold
          },
          W1N2: {
            rcl: 5,
            energy: 1800,
            energyCapacity: 1800,
            controllerProgress: 100000,
            controllerProgressTotal: 1000000,
            ticksToDowngrade: 150000 // ~55 hours - healthy
          }
        },
        creeps: {
          total: 20,
          byRole: {
            harvester: 8,
            upgrader: 6,
            builder: 6
          }
        }
      };

      const snapshotPath = resolve(snapshotsDir, `snapshot-${new Date().toISOString().split("T")[0]}.json`);
      writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

      // Verify structure
      const content = readFileSync(snapshotPath, "utf-8");
      const parsed = JSON.parse(content) as BotSnapshot;

      expect(parsed.rooms).toBeDefined();
      expect(parsed.rooms!["W1N1"]).toHaveProperty("ticksToDowngrade");
      expect(parsed.rooms!["W1N1"]).toHaveProperty("controllerProgress");
      expect(parsed.rooms!["W1N1"]).toHaveProperty("controllerProgressTotal");
      expect(parsed.rooms!["W1N2"].ticksToDowngrade).toBe(150000);
    });
  });

  describe("Alert Threshold Detection", () => {
    it("should detect critical alert for < 12 hours", () => {
      const snapshot: BotSnapshot = {
        timestamp: new Date().toISOString(),
        rooms: {
          W1N1: {
            rcl: 3,
            energy: 800,
            energyCapacity: 800,
            ticksToDowngrade: 25000 // ~9.3 hours - CRITICAL
          }
        },
        creeps: {
          total: 8,
          byRole: {
            upgrader: 2
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);

      expect(report.totalRooms).toBe(1);
      expect(report.alertCounts.critical).toBe(1);
      expect(report.alertCounts.warning).toBe(0);
      expect(report.alertCounts.info).toBe(0);
      expect(report.rooms[0].alertLevel).toBe("critical");
      expect(report.rooms[0].hoursToDowngrade).toBeLessThan(12);
    });

    it("should detect warning alert for < 24 hours", () => {
      const snapshot: BotSnapshot = {
        timestamp: new Date().toISOString(),
        rooms: {
          W1N2: {
            rcl: 4,
            energy: 1300,
            energyCapacity: 1300,
            ticksToDowngrade: 50000 // ~18.5 hours - WARNING
          }
        },
        creeps: {
          total: 12,
          byRole: {
            upgrader: 3
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);

      expect(report.totalRooms).toBe(1);
      expect(report.alertCounts.critical).toBe(0);
      expect(report.alertCounts.warning).toBe(1);
      expect(report.alertCounts.info).toBe(0);
      expect(report.rooms[0].alertLevel).toBe("warning");
      expect(report.rooms[0].hoursToDowngrade).toBeLessThan(24);
      expect(report.rooms[0].hoursToDowngrade).toBeGreaterThanOrEqual(12);
    });

    it("should detect info alert for < 48 hours", () => {
      const snapshot: BotSnapshot = {
        timestamp: new Date().toISOString(),
        rooms: {
          W1N3: {
            rcl: 5,
            energy: 1800,
            energyCapacity: 1800,
            ticksToDowngrade: 100000 // ~37 hours - INFO
          }
        },
        creeps: {
          total: 15,
          byRole: {
            upgrader: 4
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);

      expect(report.totalRooms).toBe(1);
      expect(report.alertCounts.critical).toBe(0);
      expect(report.alertCounts.warning).toBe(0);
      expect(report.alertCounts.info).toBe(1);
      expect(report.rooms[0].alertLevel).toBe("info");
      expect(report.rooms[0].hoursToDowngrade).toBeLessThan(48);
      expect(report.rooms[0].hoursToDowngrade).toBeGreaterThanOrEqual(24);
    });

    it("should report healthy for > 48 hours", () => {
      const snapshot: BotSnapshot = {
        timestamp: new Date().toISOString(),
        rooms: {
          W1N4: {
            rcl: 6,
            energy: 2300,
            energyCapacity: 2300,
            ticksToDowngrade: 180000 // ~66 hours - HEALTHY
          }
        },
        creeps: {
          total: 20,
          byRole: {
            upgrader: 5
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);

      expect(report.totalRooms).toBe(1);
      expect(report.alertCounts.critical).toBe(0);
      expect(report.alertCounts.warning).toBe(0);
      expect(report.alertCounts.info).toBe(0);
      expect(report.rooms[0].alertLevel).toBe("none");
      expect(report.rooms[0].hoursToDowngrade).toBeGreaterThanOrEqual(48);
    });
  });

  describe("Multi-Room Scenarios", () => {
    it("should handle mixed alert levels across multiple rooms", () => {
      const snapshot: BotSnapshot = {
        timestamp: new Date().toISOString(),
        rooms: {
          W1N1: {
            rcl: 2,
            energy: 300,
            energyCapacity: 300,
            ticksToDowngrade: 8000 // ~3 hours - CRITICAL
          },
          W1N2: {
            rcl: 3,
            energy: 800,
            energyCapacity: 800,
            ticksToDowngrade: 45000 // ~16.7 hours - WARNING
          },
          W1N3: {
            rcl: 4,
            energy: 1300,
            energyCapacity: 1300,
            ticksToDowngrade: 95000 // ~35 hours - INFO
          },
          W1N4: {
            rcl: 5,
            energy: 1800,
            energyCapacity: 1800,
            ticksToDowngrade: 250000 // ~92 hours - HEALTHY
          }
        },
        creeps: {
          total: 30,
          byRole: {
            upgrader: 10
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);

      expect(report.totalRooms).toBe(4);
      expect(report.alertCounts.critical).toBe(1);
      expect(report.alertCounts.warning).toBe(1);
      expect(report.alertCounts.info).toBe(1);

      // Find each room's alert level
      const w1n1 = report.rooms.find(r => r.roomName === "W1N1");
      const w1n2 = report.rooms.find(r => r.roomName === "W1N2");
      const w1n3 = report.rooms.find(r => r.roomName === "W1N3");
      const w1n4 = report.rooms.find(r => r.roomName === "W1N4");

      expect(w1n1?.alertLevel).toBe("critical");
      expect(w1n2?.alertLevel).toBe("warning");
      expect(w1n3?.alertLevel).toBe("info");
      expect(w1n4?.alertLevel).toBe("none");
    });
  });

  describe("Alert Message Generation", () => {
    it("should include all necessary details in alert messages", () => {
      const snapshot: BotSnapshot = {
        timestamp: new Date().toISOString(),
        rooms: {
          W1N1: {
            rcl: 4,
            energy: 1300,
            energyCapacity: 1300,
            controllerProgress: 100000,
            controllerProgressTotal: 540000,
            ticksToDowngrade: 30000 // ~11 hours - CRITICAL
          }
        },
        creeps: {
          total: 10,
          byRole: {
            upgrader: 2
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);
      const room = report.rooms[0];

      expect(room.alertMessage).toBeTruthy();
      expect(room.alertMessage).toContain("W1N1");
      expect(room.alertMessage).toContain("RCL4");
      expect(room.alertMessage).toContain("downgrade");
      expect(room.alertMessage).toContain("Upgraders: 2");
      expect(room.alertMessage).toContain("Energy: 1300/1300");
      expect(room.alertMessage).toMatch(/\d+\.\d+h/); // Hours format
      expect(room.alertMessage).toMatch(/\d+ ticks/); // Ticks format
      expect(room.alertMessage).toMatch(/\d+\.\d+% to next level/); // Progress percentage
    });
  });

  describe("Upgrader Count Tracking", () => {
    it("should accurately track upgrader count per room", () => {
      const snapshot: BotSnapshot = {
        timestamp: new Date().toISOString(),
        rooms: {
          W1N1: {
            rcl: 3,
            energy: 800,
            energyCapacity: 800,
            ticksToDowngrade: 40000
          }
        },
        creeps: {
          total: 15,
          byRole: {
            harvester: 5,
            upgrader: 3,
            builder: 4,
            hauler: 3
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);

      expect(report.rooms[0].upgraderCount).toBe(3);
    });

    it("should handle zero upgraders correctly", () => {
      const snapshot: BotSnapshot = {
        timestamp: new Date().toISOString(),
        rooms: {
          W1N1: {
            rcl: 2,
            energy: 300,
            energyCapacity: 300,
            ticksToDowngrade: 8000 // CRITICAL with no upgraders
          }
        },
        creeps: {
          total: 5,
          byRole: {
            harvester: 5
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);

      expect(report.rooms[0].upgraderCount).toBe(0);
      expect(report.rooms[0].alertMessage).toContain("Upgraders: 0");
    });
  });

  describe("Fallback to Estimation", () => {
    it("should estimate downgrade time when actual data unavailable", () => {
      const snapshot: BotSnapshot = {
        timestamp: new Date().toISOString(),
        rooms: {
          W1N1: {
            rcl: 3,
            energy: 800,
            energyCapacity: 800,
            controllerProgress: 5000,
            controllerProgressTotal: 135000
            // No ticksToDowngrade - should estimate
          }
        },
        creeps: {
          total: 8,
          byRole: {
            upgrader: 2
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);

      expect(report.totalRooms).toBe(1);
      expect(report.rooms[0].ticksToDowngrade).toBeGreaterThan(0);
      expect(report.rooms[0].hoursToDowngrade).toBeGreaterThan(0);
      // With low progress (5000/135000 = 3.7%), should estimate at-risk multiplier
      expect(report.rooms[0].ticksToDowngrade).toBeLessThanOrEqual(20000); // Max for RCL 3
    });
  });

  describe("Integration with PTR Alert System", () => {
    it("should provide data structure compatible with check-ptr-alerts.ts", () => {
      const snapshot: BotSnapshot = {
        timestamp: new Date().toISOString(),
        rooms: {
          W1N1: {
            rcl: 3,
            energy: 800,
            energyCapacity: 800,
            ticksToDowngrade: 25000
          }
        },
        creeps: {
          total: 8,
          byRole: {
            upgrader: 2
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);

      // Verify structure matches what check-ptr-alerts.ts expects
      expect(report).toHaveProperty("timestamp");
      expect(report).toHaveProperty("totalRooms");
      expect(report).toHaveProperty("alertCounts");
      expect(report).toHaveProperty("rooms");

      expect(report.alertCounts).toHaveProperty("info");
      expect(report.alertCounts).toHaveProperty("warning");
      expect(report.alertCounts).toHaveProperty("critical");

      const room = report.rooms[0];
      expect(room).toHaveProperty("roomName");
      expect(room).toHaveProperty("rcl");
      expect(room).toHaveProperty("ticksToDowngrade");
      expect(room).toHaveProperty("hoursToDowngrade");
      expect(room).toHaveProperty("alertLevel");
      expect(room).toHaveProperty("alertMessage");
      expect(room).toHaveProperty("upgraderCount");
      expect(room).toHaveProperty("energyAvailable");
      expect(room).toHaveProperty("energyCapacity");
    });
  });

  describe("Progress Percentage Calculation", () => {
    it("should accurately calculate controller progress percentage", () => {
      const snapshot: BotSnapshot = {
        timestamp: new Date().toISOString(),
        rooms: {
          W1N1: {
            rcl: 4,
            energy: 1300,
            energyCapacity: 1300,
            controllerProgress: 270000, // 50% of 540000
            controllerProgressTotal: 540000,
            ticksToDowngrade: 35000
          }
        },
        creeps: {
          total: 10,
          byRole: {
            upgrader: 3
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);
      const room = report.rooms[0];

      expect(room.progressPercent).toBeDefined();
      expect(room.progressPercent).toBeCloseTo(50, 1);
      expect(room.controllerProgress).toBe(270000);
      expect(room.controllerProgressTotal).toBe(540000);
    });
  });
});
