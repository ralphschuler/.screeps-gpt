import { describe, it, expect } from "vitest";
import {
  analyzeControllerHealth,
  ticksToHours,
  determineAlertLevel,
  ALERT_THRESHOLDS,
  MAX_DOWNGRADE_TIMER
} from "../../packages/utilities/scripts/check-controller-health";
import type { BotSnapshot } from "../../packages/utilities/scripts/types/bot-snapshot";

describe("Controller Health Check", () => {
  describe("ticksToHours", () => {
    it("should convert ticks to hours correctly", () => {
      expect(ticksToHours(2700)).toBeCloseTo(1, 1);
      expect(ticksToHours(5400)).toBeCloseTo(2, 1);
      expect(ticksToHours(13500)).toBeCloseTo(5, 1);
      expect(ticksToHours(27000)).toBeCloseTo(10, 1);
    });

    it("should handle zero ticks", () => {
      expect(ticksToHours(0)).toBe(0);
    });
  });

  describe("determineAlertLevel", () => {
    it("should return critical for < 12 hours", () => {
      expect(determineAlertLevel(11)).toBe("critical");
      expect(determineAlertLevel(6)).toBe("critical");
      expect(determineAlertLevel(1)).toBe("critical");
    });

    it("should return warning for 12-24 hours", () => {
      expect(determineAlertLevel(12)).toBe("warning");
      expect(determineAlertLevel(18)).toBe("warning");
      expect(determineAlertLevel(23.9)).toBe("warning");
    });

    it("should return info for 24-48 hours", () => {
      expect(determineAlertLevel(24)).toBe("info");
      expect(determineAlertLevel(36)).toBe("info");
      expect(determineAlertLevel(47.9)).toBe("info");
    });

    it("should return none for > 48 hours", () => {
      expect(determineAlertLevel(48)).toBe("none");
      expect(determineAlertLevel(72)).toBe("none");
      expect(determineAlertLevel(100)).toBe("none");
    });

    it("should use correct threshold values", () => {
      expect(ALERT_THRESHOLDS.critical).toBe(12);
      expect(ALERT_THRESHOLDS.warning).toBe(24);
      expect(ALERT_THRESHOLDS.info).toBe(48);
    });
  });

  describe("MAX_DOWNGRADE_TIMER", () => {
    it("should have correct values for each RCL", () => {
      expect(MAX_DOWNGRADE_TIMER[1]).toBe(20000);
      expect(MAX_DOWNGRADE_TIMER[2]).toBe(10000);
      expect(MAX_DOWNGRADE_TIMER[3]).toBe(20000);
      expect(MAX_DOWNGRADE_TIMER[4]).toBe(40000);
      expect(MAX_DOWNGRADE_TIMER[5]).toBe(80000);
      expect(MAX_DOWNGRADE_TIMER[6]).toBe(120000);
      expect(MAX_DOWNGRADE_TIMER[7]).toBe(150000);
      expect(MAX_DOWNGRADE_TIMER[8]).toBe(200000);
    });
  });

  describe("analyzeControllerHealth", () => {
    it("should analyze snapshot with no rooms", () => {
      const snapshot: BotSnapshot = {
        timestamp: "2025-11-25T12:00:00.000Z",
        rooms: {}
      };

      const report = analyzeControllerHealth(snapshot);
      expect(report.totalRooms).toBe(0);
      expect(report.rooms).toHaveLength(0);
      expect(report.alertCounts.critical).toBe(0);
      expect(report.alertCounts.warning).toBe(0);
      expect(report.alertCounts.info).toBe(0);
    });

    it("should skip RCL 1 rooms", () => {
      const snapshot: BotSnapshot = {
        timestamp: "2025-11-25T12:00:00.000Z",
        rooms: {
          W1N1: {
            rcl: 1,
            energy: 300,
            energyCapacity: 300
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);
      expect(report.totalRooms).toBe(0);
      expect(report.rooms).toHaveLength(0);
    });

    it("should detect critical alert with actual ticksToDowngrade", () => {
      const snapshot: BotSnapshot = {
        timestamp: "2025-11-25T12:00:00.000Z",
        rooms: {
          W1N2: {
            rcl: 2,
            energy: 300,
            energyCapacity: 300,
            ticksToDowngrade: 10000, // ~3.7 hours - critical
            controllerProgress: 1000,
            controllerProgressTotal: 45000
          }
        },
        creeps: {
          total: 5,
          byRole: {
            upgrader: 1,
            harvester: 4
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);
      expect(report.totalRooms).toBe(1);
      expect(report.rooms).toHaveLength(1);
      expect(report.rooms[0].alertLevel).toBe("critical");
      expect(report.rooms[0].ticksToDowngrade).toBe(10000);
      expect(report.rooms[0].hoursToDowngrade).toBeCloseTo(3.7, 1);
      expect(report.rooms[0].upgraderCount).toBe(1);
      expect(report.alertCounts.critical).toBe(1);
      expect(report.rooms[0].alertMessage).toContain("W1N2");
      expect(report.rooms[0].alertMessage).toContain("downgrade");
    });

    it("should detect warning alert", () => {
      const snapshot: BotSnapshot = {
        timestamp: "2025-11-25T12:00:00.000Z",
        rooms: {
          W1N3: {
            rcl: 3,
            energy: 800,
            energyCapacity: 800,
            ticksToDowngrade: 50000, // ~18.5 hours - warning
            controllerProgress: 5000,
            controllerProgressTotal: 135000
          }
        },
        creeps: {
          total: 8,
          byRole: {
            upgrader: 2,
            harvester: 4,
            builder: 2
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);
      expect(report.rooms[0].alertLevel).toBe("warning");
      expect(report.rooms[0].ticksToDowngrade).toBe(50000);
      expect(report.rooms[0].hoursToDowngrade).toBeCloseTo(18.5, 1);
      expect(report.alertCounts.warning).toBe(1);
    });

    it("should detect info alert", () => {
      const snapshot: BotSnapshot = {
        timestamp: "2025-11-25T12:00:00.000Z",
        rooms: {
          W1N4: {
            rcl: 4,
            energy: 1300,
            energyCapacity: 1300,
            ticksToDowngrade: 100000, // ~37 hours - info
            controllerProgress: 10000,
            controllerProgressTotal: 540000
          }
        },
        creeps: {
          total: 12,
          byRole: {
            upgrader: 3,
            harvester: 6,
            builder: 3
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);
      expect(report.rooms[0].alertLevel).toBe("info");
      expect(report.rooms[0].ticksToDowngrade).toBe(100000);
      expect(report.alertCounts.info).toBe(1);
    });

    it("should detect no alert for healthy controller", () => {
      const snapshot: BotSnapshot = {
        timestamp: "2025-11-25T12:00:00.000Z",
        rooms: {
          W1N5: {
            rcl: 5,
            energy: 1800,
            energyCapacity: 1800,
            ticksToDowngrade: 200000, // ~74 hours - healthy
            controllerProgress: 50000,
            controllerProgressTotal: 1000000
          }
        },
        creeps: {
          total: 15,
          byRole: {
            upgrader: 4,
            harvester: 8,
            builder: 3
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);
      expect(report.rooms[0].alertLevel).toBe("none");
      expect(report.rooms[0].alertMessage).toBeNull();
      expect(report.alertCounts.critical).toBe(0);
      expect(report.alertCounts.warning).toBe(0);
      expect(report.alertCounts.info).toBe(0);
    });

    it("should analyze multiple rooms with different alert levels", () => {
      const snapshot: BotSnapshot = {
        timestamp: "2025-11-25T12:00:00.000Z",
        rooms: {
          W1N1: {
            rcl: 2,
            energy: 300,
            energyCapacity: 300,
            ticksToDowngrade: 8000 // critical
          },
          W1N2: {
            rcl: 3,
            energy: 800,
            energyCapacity: 800,
            ticksToDowngrade: 45000 // warning
          },
          W1N3: {
            rcl: 4,
            energy: 1300,
            energyCapacity: 1300,
            ticksToDowngrade: 95000 // info
          },
          W1N4: {
            rcl: 5,
            energy: 1800,
            energyCapacity: 1800,
            ticksToDowngrade: 250000 // none
          }
        },
        creeps: {
          total: 20,
          byRole: {
            upgrader: 8
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);
      expect(report.totalRooms).toBe(4);
      expect(report.alertCounts.critical).toBe(1);
      expect(report.alertCounts.warning).toBe(1);
      expect(report.alertCounts.info).toBe(1);
    });

    it("should include upgrader count from creeps data", () => {
      const snapshot: BotSnapshot = {
        timestamp: "2025-11-25T12:00:00.000Z",
        rooms: {
          W1N2: {
            rcl: 2,
            energy: 300,
            energyCapacity: 300,
            ticksToDowngrade: 9000
          }
        },
        creeps: {
          total: 10,
          byRole: {
            upgrader: 3,
            harvester: 5,
            builder: 2
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);
      expect(report.rooms[0].upgraderCount).toBe(3);
    });

    it("should handle missing upgrader role in creeps", () => {
      const snapshot: BotSnapshot = {
        timestamp: "2025-11-25T12:00:00.000Z",
        rooms: {
          W1N2: {
            rcl: 2,
            energy: 300,
            energyCapacity: 300,
            ticksToDowngrade: 9000
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

    it("should calculate progress percentage correctly", () => {
      const snapshot: BotSnapshot = {
        timestamp: "2025-11-25T12:00:00.000Z",
        rooms: {
          W1N2: {
            rcl: 2,
            energy: 300,
            energyCapacity: 300,
            ticksToDowngrade: 9000,
            controllerProgress: 11250,
            controllerProgressTotal: 45000
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);
      expect(report.rooms[0].progressPercent).toBeCloseTo(25, 1);
      expect(report.rooms[0].controllerProgress).toBe(11250);
      expect(report.rooms[0].controllerProgressTotal).toBe(45000);
    });

    it("should handle missing ticksToDowngrade by estimating", () => {
      const snapshot: BotSnapshot = {
        timestamp: "2025-11-25T12:00:00.000Z",
        rooms: {
          W1N2: {
            rcl: 2,
            energy: 300,
            energyCapacity: 300,
            controllerProgress: 11250,
            controllerProgressTotal: 45000
          }
        }
      };

      const report = analyzeControllerHealth(snapshot);
      expect(report.rooms[0].ticksToDowngrade).toBeGreaterThan(0);
      expect(report.rooms[0].ticksToDowngrade).toBeLessThanOrEqual(MAX_DOWNGRADE_TIMER[2]);
    });
  });
});
