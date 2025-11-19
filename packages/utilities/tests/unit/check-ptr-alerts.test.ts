import { describe, it, expect } from "vitest";
import { analyzePTRStats } from "../../packages/utilities/scripts/check-ptr-alerts.js";
import type { PTRStatsSnapshot } from "../../packages/utilities/scripts/check-ptr-alerts.js";

describe("check-ptr-alerts", () => {
  describe("Network failure detection", () => {
    it("should detect network error as critical infrastructure failure", () => {
      const snapshot: PTRStatsSnapshot = {
        status: "api_unavailable",
        failureType: "network_error",
        timestamp: "2025-10-27T05:37:00.000Z",
        error: "fetch failed",
        attempted_endpoint: "https://screeps.com/api/user/stats?interval=180",
        httpStatus: null,
        httpStatusText: null
      };

      const alerts = analyzePTRStats(snapshot);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe("api_endpoint_unreachable");
      expect(alerts[0].severity).toBe("critical");
      expect(alerts[0].message).toContain("Critical infrastructure failure");
      expect(alerts[0].message).toContain("fetch failed");
    });

    it("should detect server error (5xx) as critical", () => {
      const snapshot: PTRStatsSnapshot = {
        status: "api_unavailable",
        failureType: "http_error_500",
        timestamp: "2025-10-27T05:37:00.000Z",
        error: "Internal Server Error",
        attempted_endpoint: "https://screeps.com/api/user/stats?interval=180",
        httpStatus: 500,
        httpStatusText: "Internal Server Error"
      };

      const alerts = analyzePTRStats(snapshot);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe("api_server_error");
      expect(alerts[0].severity).toBe("critical");
      expect(alerts[0].message).toContain("Screeps API server error (500)");
    });

    it("should detect 503 Service Unavailable as critical", () => {
      const snapshot: PTRStatsSnapshot = {
        status: "api_unavailable",
        failureType: "http_error_503",
        timestamp: "2025-10-27T05:37:00.000Z",
        error: "Service Unavailable",
        attempted_endpoint: "https://screeps.com/api/user/stats?interval=180",
        httpStatus: 503,
        httpStatusText: "Service Unavailable"
      };

      const alerts = analyzePTRStats(snapshot);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe("api_server_error");
      expect(alerts[0].severity).toBe("critical");
    });

    it("should detect authentication failure (401) as high priority", () => {
      const snapshot: PTRStatsSnapshot = {
        status: "api_unavailable",
        failureType: "http_error_401",
        timestamp: "2025-10-27T05:37:00.000Z",
        error: "Unauthorized",
        attempted_endpoint: "https://screeps.com/api/user/stats?interval=180",
        httpStatus: 401,
        httpStatusText: "Unauthorized"
      };

      const alerts = analyzePTRStats(snapshot);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe("api_authentication_failed");
      expect(alerts[0].severity).toBe("high");
      expect(alerts[0].message).toContain("authentication failure (401)");
    });

    it("should detect forbidden error (403) as high priority", () => {
      const snapshot: PTRStatsSnapshot = {
        status: "api_unavailable",
        failureType: "http_error_403",
        timestamp: "2025-10-27T05:37:00.000Z",
        error: "Forbidden",
        attempted_endpoint: "https://screeps.com/api/user/stats?interval=180",
        httpStatus: 403,
        httpStatusText: "Forbidden"
      };

      const alerts = analyzePTRStats(snapshot);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe("api_authentication_failed");
      expect(alerts[0].severity).toBe("high");
    });

    it("should handle generic API unavailability as critical", () => {
      const snapshot: PTRStatsSnapshot = {
        status: "api_unavailable",
        failureType: "unknown",
        timestamp: "2025-10-27T05:37:00.000Z",
        error: "Unknown error",
        attempted_endpoint: "https://screeps.com/api/user/stats?interval=180"
      };

      const alerts = analyzePTRStats(snapshot);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe("api_unavailable");
      expect(alerts[0].severity).toBe("critical");
    });

    it("should handle other HTTP errors (4xx) as high priority", () => {
      const snapshot: PTRStatsSnapshot = {
        status: "api_unavailable",
        failureType: "http_error_400",
        timestamp: "2025-10-27T05:37:00.000Z",
        error: "Bad Request",
        attempted_endpoint: "https://screeps.com/api/user/stats?interval=180",
        httpStatus: 400,
        httpStatusText: "Bad Request"
      };

      const alerts = analyzePTRStats(snapshot);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe("api_request_failed");
      expect(alerts[0].severity).toBe("high");
    });
  });

  describe("Empty response pattern detection", () => {
    it("should detect empty stats as medium priority (not critical)", () => {
      const snapshot: PTRStatsSnapshot = {
        fetchedAt: "2025-10-27T05:37:00.000Z",
        endpoint: "https://screeps.com/api/user/stats?interval=180",
        payload: {
          ok: 1,
          stats: {}
        }
      };

      const alerts = analyzePTRStats(snapshot);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe("no_data");
      expect(alerts[0].severity).toBe("medium");
      expect(alerts[0].message).toContain("No recent PTR stats available");
      expect(alerts[0].message).toContain("empty stats response");
    });

    it("should detect invalid payload as high priority", () => {
      const snapshot: PTRStatsSnapshot = {
        fetchedAt: "2025-10-27T05:37:00.000Z",
        endpoint: "https://screeps.com/api/user/stats?interval=180",
        payload: undefined
      };

      const alerts = analyzePTRStats(snapshot);

      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toEqual({
        type: "data_unavailable",
        severity: "high",
        message: "PTR stats data unavailable or invalid"
      });
    });
  });

  describe("Normal monitoring functionality", () => {
    it("should detect high CPU usage as high priority", () => {
      const snapshot: PTRStatsSnapshot = {
        fetchedAt: "2025-10-27T05:37:00.000Z",
        endpoint: "https://screeps.com/api/user/stats?interval=180",
        payload: {
          ok: 1,
          stats: {
            "1000": { cpu: { used: 85, limit: 100 } },
            "1001": { cpu: { used: 87, limit: 100 } },
            "1002": { cpu: { used: 86, limit: 100 } },
            "1003": { cpu: { used: 88, limit: 100 } },
            "1004": { cpu: { used: 84, limit: 100 } }
          }
        }
      };

      const alerts = analyzePTRStats(snapshot);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe("high_cpu");
      expect(alerts[0].severity).toBe("high");
      expect(alerts[0].message).toContain("86.0%");
    });

    it("should detect critical CPU usage (>95%) as critical priority", () => {
      const snapshot: PTRStatsSnapshot = {
        fetchedAt: "2025-10-27T05:37:00.000Z",
        endpoint: "https://screeps.com/api/user/stats?interval=180",
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

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe("high_cpu");
      expect(alerts[0].severity).toBe("critical");
      expect(alerts[0].message).toContain("96.8%");
    });

    it("should detect low energy as medium priority", () => {
      const snapshot: PTRStatsSnapshot = {
        fetchedAt: "2025-10-27T05:37:00.000Z",
        endpoint: "https://screeps.com/api/user/stats?interval=180",
        payload: {
          ok: 1,
          stats: {
            "1000": { resources: { energy: 500 } },
            "1001": { resources: { energy: 450 } },
            "1002": { resources: { energy: 600 } },
            "1003": { resources: { energy: 550 } },
            "1004": { resources: { energy: 500 } }
          }
        }
      };

      const alerts = analyzePTRStats(snapshot);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe("low_energy");
      expect(alerts[0].severity).toBe("medium");
    });

    it("should return no alerts for healthy bot performance", () => {
      const snapshot: PTRStatsSnapshot = {
        fetchedAt: "2025-10-27T05:37:00.000Z",
        endpoint: "https://screeps.com/api/user/stats?interval=180",
        payload: {
          ok: 1,
          stats: {
            "1000": { cpu: { used: 50, limit: 100 }, resources: { energy: 5000 } },
            "1001": { cpu: { used: 55, limit: 100 }, resources: { energy: 5200 } },
            "1002": { cpu: { used: 52, limit: 100 }, resources: { energy: 5100 } },
            "1003": { cpu: { used: 48, limit: 100 }, resources: { energy: 5300 } },
            "1004": { cpu: { used: 51, limit: 100 }, resources: { energy: 5150 } }
          }
        }
      };

      const alerts = analyzePTRStats(snapshot);

      expect(alerts).toHaveLength(0);
    });
  });

  describe("Severity distinction", () => {
    it("should prioritize network failures (critical) over empty responses (medium)", () => {
      const networkFailure: PTRStatsSnapshot = {
        status: "api_unavailable",
        failureType: "network_error",
        timestamp: "2025-10-27T05:37:00.000Z",
        error: "fetch failed",
        attempted_endpoint: "https://screeps.com/api/user/stats?interval=180",
        httpStatus: null,
        httpStatusText: null
      };

      const emptyResponse: PTRStatsSnapshot = {
        fetchedAt: "2025-10-27T05:37:00.000Z",
        endpoint: "https://screeps.com/api/user/stats?interval=180",
        payload: {
          ok: 1,
          stats: {}
        }
      };

      const networkAlerts = analyzePTRStats(networkFailure);
      const emptyAlerts = analyzePTRStats(emptyResponse);

      expect(networkAlerts[0].severity).toBe("critical");
      expect(emptyAlerts[0].severity).toBe("medium");
    });
  });
});
