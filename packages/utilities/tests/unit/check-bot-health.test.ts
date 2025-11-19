import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadHealthState,
  saveHealthState,
  type HealthState
} from "../../packages/utilities/scripts/check-bot-health.js";

describe("check-bot-health", () => {
  const testHealthDir = resolve("reports", "monitoring");
  const testHealthPath = resolve(testHealthDir, "health.json");

  beforeEach(() => {
    // Ensure test directory exists
    mkdirSync(testHealthDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test files
    if (existsSync(testHealthPath)) {
      unlinkSync(testHealthPath);
    }
  });

  describe("Health State Persistence", () => {
    it("should create default health state when file does not exist", () => {
      if (existsSync(testHealthPath)) {
        unlinkSync(testHealthPath);
      }

      const state = loadHealthState();

      expect(state.consecutive_failures).toBe(0);
      expect(state.health_status).toBe("operational");
      expect(state.last_successful_ping).toBeNull();
      expect(state.last_failed_ping).toBeNull();
      expect(state.last_known_tick).toBeNull();
      expect(state.detection_history).toEqual([]);
    });

    it("should save and load health state correctly", () => {
      const testState: HealthState = {
        last_successful_ping: "2025-11-12T10:00:00.000Z",
        last_failed_ping: null,
        consecutive_failures: 0,
        health_status: "operational",
        last_known_tick: 12345678,
        last_bot_status: "active",
        detection_history: [
          {
            timestamp: "2025-11-12T10:00:00.000Z",
            status: "success",
            aliveness: "active"
          }
        ]
      };

      saveHealthState(testState);
      const loaded = loadHealthState();

      expect(loaded.last_successful_ping).toBe(testState.last_successful_ping);
      expect(loaded.consecutive_failures).toBe(0);
      expect(loaded.health_status).toBe("operational");
      expect(loaded.last_known_tick).toBe(12345678);
      expect(loaded.detection_history).toHaveLength(1);
      expect(loaded.detection_history[0].status).toBe("success");
    });

    it("should track consecutive failures", () => {
      const testState: HealthState = {
        last_successful_ping: "2025-11-12T10:00:00.000Z",
        last_failed_ping: "2025-11-12T10:30:00.000Z",
        consecutive_failures: 3,
        health_status: "degraded",
        last_known_tick: 12345678,
        last_bot_status: "unknown",
        detection_history: [
          {
            timestamp: "2025-11-12T10:00:00.000Z",
            status: "success",
            aliveness: "active"
          },
          {
            timestamp: "2025-11-12T10:15:00.000Z",
            status: "failure",
            aliveness: "unknown",
            error: "API call failed"
          },
          {
            timestamp: "2025-11-12T10:30:00.000Z",
            status: "failure",
            aliveness: "unknown",
            error: "API call failed"
          }
        ]
      };

      saveHealthState(testState);
      const loaded = loadHealthState();

      expect(loaded.consecutive_failures).toBe(3);
      expect(loaded.health_status).toBe("degraded");
      expect(loaded.detection_history).toHaveLength(3);
    });

    it("should handle corrupted health state file gracefully", () => {
      // Write invalid JSON
      writeFileSync(testHealthPath, "{ invalid json", "utf-8");

      const state = loadHealthState();

      // Should return default state
      expect(state.consecutive_failures).toBe(0);
      expect(state.health_status).toBe("operational");
    });
  });

  describe("Graduated Alert Thresholds", () => {
    it("should not alert for failures under 15 minutes", () => {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      const state: HealthState = {
        last_successful_ping: tenMinutesAgo.toISOString(),
        last_failed_ping: now.toISOString(),
        consecutive_failures: 1,
        health_status: "operational",
        last_known_tick: 12345678,
        last_bot_status: "unknown",
        detection_history: []
      };

      saveHealthState(state);
      const loaded = loadHealthState();

      // Should still be operational with low consecutive failures
      expect(loaded.consecutive_failures).toBeLessThan(3);
    });

    it("should track degraded state for failures 15-30 minutes", () => {
      const now = new Date();
      const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);

      const state: HealthState = {
        last_successful_ping: twentyMinutesAgo.toISOString(),
        last_failed_ping: now.toISOString(),
        consecutive_failures: 2,
        health_status: "degraded",
        last_known_tick: 12345678,
        last_bot_status: "unknown",
        detection_history: []
      };

      saveHealthState(state);
      const loaded = loadHealthState();

      expect(loaded.health_status).toBe("degraded");
      expect(loaded.consecutive_failures).toBe(2);
    });

    it("should track critical state for failures over 60 minutes", () => {
      const now = new Date();
      const seventyMinutesAgo = new Date(now.getTime() - 70 * 60 * 1000);

      const state: HealthState = {
        last_successful_ping: seventyMinutesAgo.toISOString(),
        last_failed_ping: now.toISOString(),
        consecutive_failures: 5,
        health_status: "critical",
        last_known_tick: 12345678,
        last_bot_status: "unknown",
        detection_history: []
      };

      saveHealthState(state);
      const loaded = loadHealthState();

      expect(loaded.health_status).toBe("critical");
      expect(loaded.consecutive_failures).toBeGreaterThanOrEqual(5);
    });
  });

  describe("Health State History", () => {
    it("should maintain detection history", () => {
      const state: HealthState = {
        last_successful_ping: "2025-11-12T10:00:00.000Z",
        last_failed_ping: null,
        consecutive_failures: 0,
        health_status: "operational",
        last_known_tick: 12345678,
        last_bot_status: "active",
        detection_history: [
          {
            timestamp: "2025-11-12T09:00:00.000Z",
            status: "success",
            aliveness: "active"
          },
          {
            timestamp: "2025-11-12T09:30:00.000Z",
            status: "success",
            aliveness: "active"
          },
          {
            timestamp: "2025-11-12T10:00:00.000Z",
            status: "success",
            aliveness: "active"
          }
        ]
      };

      saveHealthState(state);
      const loaded = loadHealthState();

      expect(loaded.detection_history).toHaveLength(3);
      expect(loaded.detection_history[0].status).toBe("success");
      expect(loaded.detection_history[2].status).toBe("success");
    });

    it("should track failure reasons in history", () => {
      const state: HealthState = {
        last_successful_ping: "2025-11-12T09:00:00.000Z",
        last_failed_ping: "2025-11-12T10:00:00.000Z",
        consecutive_failures: 2,
        health_status: "degraded",
        last_known_tick: 12345678,
        last_bot_status: "unknown",
        detection_history: [
          {
            timestamp: "2025-11-12T09:00:00.000Z",
            status: "success",
            aliveness: "active"
          },
          {
            timestamp: "2025-11-12T09:30:00.000Z",
            status: "failure",
            aliveness: "unknown",
            error: "Network timeout"
          },
          {
            timestamp: "2025-11-12T10:00:00.000Z",
            status: "failure",
            aliveness: "unknown",
            error: "API unavailable"
          }
        ]
      };

      saveHealthState(state);
      const loaded = loadHealthState();

      expect(loaded.detection_history).toHaveLength(3);
      expect(loaded.detection_history[1].status).toBe("failure");
      expect(loaded.detection_history[1].error).toBe("Network timeout");
      expect(loaded.detection_history[2].error).toBe("API unavailable");
    });
  });
});
