import { describe, it, expect } from "vitest";
import { analyzePTRStats } from "../../packages/utilities/scripts/check-ptr-alerts.js";
import type { PTRStatsSnapshot } from "../../packages/utilities/scripts/check-ptr-alerts.js";

describe("Resilient Telemetry Infrastructure", () => {
  describe("Complete infrastructure failure detection", () => {
    it("should detect when all telemetry sources fail as critical", () => {
      const snapshot: PTRStatsSnapshot = {
        status: "all_sources_unavailable",
        failureType: "infrastructure_failure",
        timestamp: "2025-11-05T14:00:00.000Z",
        error: "Both Stats API and Console telemetry sources failed",
        attempted_sources: ["stats_api", "console"],
        resilience_status: "critical"
      };

      const alerts = analyzePTRStats(snapshot);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe("infrastructure_failure");
      expect(alerts[0].severity).toBe("critical");
      expect(alerts[0].message).toContain("All telemetry sources failed");
      expect(alerts[0].message).toContain("Stats API + Console");
    });
  });

  describe("Fallback activation detection", () => {
    it("should detect fallback activation as medium priority informational alert", () => {
      const snapshot: PTRStatsSnapshot = {
        fetchedAt: "2025-11-05T14:00:00.000Z",
        endpoint: "console://(direct bot telemetry)",
        source: "console",
        fallback_activated: true,
        primary_source_failed: true,
        payload: {
          ok: 1,
          stats: {
            "1730815200000": {
              cpu: { used: 50, limit: 100 },
              resources: { energy: 5000 }
            }
          }
        }
      };

      const alerts = analyzePTRStats(snapshot);

      // Should have fallback alert (no other anomalies in this data)
      expect(alerts.length).toBeGreaterThan(0);
      const fallbackAlert = alerts.find(a => a.type === "fallback_activated");
      expect(fallbackAlert).toBeDefined();
      expect(fallbackAlert?.severity).toBe("medium");
      expect(fallbackAlert?.message).toContain("fallback activated");
      expect(fallbackAlert?.message).toContain("Primary Stats API failed");
      expect(fallbackAlert?.message).toContain("using Console telemetry");
    });

    it("should still detect performance anomalies when using fallback", () => {
      const snapshot: PTRStatsSnapshot = {
        fetchedAt: "2025-11-05T14:00:00.000Z",
        endpoint: "console://(direct bot telemetry)",
        source: "console",
        fallback_activated: true,
        primary_source_failed: true,
        payload: {
          ok: 1,
          stats: {
            "1000": { cpu: { used: 96, limit: 100 } },
            "1001": { cpu: { used: 97, limit: 100 } },
            "1002": { cpu: { used: 98, limit: 100 } },
            "1003": { cpu: { used: 96, limit: 100 } },
            "1004": { cpu: { used: 97, limit: 100 } }
          }
        }
      };

      const alerts = analyzePTRStats(snapshot);

      // Should have both fallback alert AND critical CPU alert
      expect(alerts.length).toBeGreaterThanOrEqual(2);

      const fallbackAlert = alerts.find(a => a.type === "fallback_activated");
      expect(fallbackAlert).toBeDefined();
      expect(fallbackAlert?.severity).toBe("medium");

      const cpuAlert = alerts.find(a => a.type === "high_cpu");
      expect(cpuAlert).toBeDefined();
      expect(cpuAlert?.severity).toBe("critical");
    });
  });

  describe("Normal Stats API operation", () => {
    it("should not create fallback alerts when Stats API works normally", () => {
      const snapshot: PTRStatsSnapshot = {
        fetchedAt: "2025-11-05T14:00:00.000Z",
        endpoint: "https://screeps.com/api/user/stats?interval=180",
        source: "stats_api",
        payload: {
          ok: 1,
          stats: {
            "1000": { cpu: { used: 50, limit: 100 }, resources: { energy: 5000 } },
            "1001": { cpu: { used: 52, limit: 100 }, resources: { energy: 5100 } }
          }
        }
      };

      const alerts = analyzePTRStats(snapshot);

      // Should have no alerts for healthy operation
      expect(alerts).toHaveLength(0);
    });
  });

  describe("Backward compatibility", () => {
    it("should handle old snapshot format without resilience metadata", () => {
      const snapshot: PTRStatsSnapshot = {
        fetchedAt: "2025-11-05T14:00:00.000Z",
        endpoint: "https://screeps.com/api/user/stats?interval=180",
        payload: {
          ok: 1,
          stats: {
            "1000": { cpu: { used: 50, limit: 100 }, resources: { energy: 5000 } }
          }
        }
      };

      const alerts = analyzePTRStats(snapshot);

      // Should work normally without errors
      expect(alerts).toHaveLength(0);
    });

    it("should handle old failure format for Stats API unavailability", () => {
      const snapshot: PTRStatsSnapshot = {
        status: "api_unavailable",
        failureType: "network_error",
        timestamp: "2025-11-05T14:00:00.000Z",
        error: "fetch failed",
        attempted_endpoint: "https://screeps.com/api/user/stats?interval=180",
        httpStatus: null,
        httpStatusText: null
      };

      const alerts = analyzePTRStats(snapshot);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe("api_endpoint_unreachable");
      expect(alerts[0].severity).toBe("critical");
    });
  });

  describe("Resilience status tracking", () => {
    it("should differentiate between single-source failure and complete failure", () => {
      const singleSourceFailure: PTRStatsSnapshot = {
        status: "api_unavailable",
        failureType: "network_error",
        timestamp: "2025-11-05T14:00:00.000Z",
        error: "fetch failed",
        attempted_endpoint: "https://screeps.com/api/user/stats?interval=180",
        httpStatus: null,
        httpStatusText: null
      };

      const completeFailure: PTRStatsSnapshot = {
        status: "all_sources_unavailable",
        failureType: "infrastructure_failure",
        timestamp: "2025-11-05T14:00:00.000Z",
        error: "Both Stats API and Console telemetry sources failed",
        attempted_sources: ["stats_api", "console"],
        resilience_status: "critical"
      };

      const singleAlerts = analyzePTRStats(singleSourceFailure);
      const completeAlerts = analyzePTRStats(completeFailure);

      // Both are critical, but complete failure is more severe contextually
      expect(singleAlerts[0].severity).toBe("critical");
      expect(completeAlerts[0].severity).toBe("critical");

      // Complete failure should mention all sources
      expect(completeAlerts[0].message).toContain("All telemetry sources");
      expect(singleAlerts[0].message).not.toContain("All telemetry sources");
    });
  });
});
