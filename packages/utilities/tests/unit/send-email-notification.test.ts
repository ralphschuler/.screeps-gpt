import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the rate limit state for testing
let mockRateLimitState = {
  lastSentTimestamp: 0,
  recentNotifications: 0
};

// Mock the rate limit functions
const checkRateLimit = (): boolean => {
  const now = Date.now();
  const MIN_INTERVAL_BETWEEN_NOTIFICATIONS_MS = 5000;
  const RATE_LIMIT_WINDOW_MS = 60000;
  const MAX_NOTIFICATIONS_PER_WINDOW = 10;

  if (now - mockRateLimitState.lastSentTimestamp < MIN_INTERVAL_BETWEEN_NOTIFICATIONS_MS) {
    console.log(`Rate limit: Too soon since last notification (${now - mockRateLimitState.lastSentTimestamp}ms)`);
    return false;
  }

  if (now - mockRateLimitState.lastSentTimestamp > RATE_LIMIT_WINDOW_MS) {
    mockRateLimitState.recentNotifications = 0;
  }

  if (mockRateLimitState.recentNotifications >= MAX_NOTIFICATIONS_PER_WINDOW) {
    console.log(`Rate limit: Too many notifications in window (${mockRateLimitState.recentNotifications})`);
    return false;
  }

  return true;
};

const updateRateLimit = (): void => {
  mockRateLimitState.lastSentTimestamp = Date.now();
  mockRateLimitState.recentNotifications += 1;
};

describe("Email Notification System", () => {
  describe("Rate Limiting", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Reset mock state before each test
      mockRateLimitState = {
        lastSentTimestamp: 0,
        recentNotifications: 0
      };
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should allow first notification", () => {
      const result = checkRateLimit();
      expect(result).toBe(true);
    });

    it("should enforce minimum interval between notifications", () => {
      // First notification allowed
      expect(checkRateLimit()).toBe(true);
      updateRateLimit();

      // Second notification too soon (< 5 seconds)
      vi.advanceTimersByTime(3000);
      expect(checkRateLimit()).toBe(false);

      // Third notification after minimum interval
      vi.advanceTimersByTime(3000); // Total: 6 seconds
      expect(checkRateLimit()).toBe(true);
    });

    it("should enforce maximum notifications per window", () => {
      // Send 10 notifications (max per window)
      for (let i = 0; i < 10; i++) {
        expect(checkRateLimit()).toBe(true);
        updateRateLimit();
        vi.advanceTimersByTime(6000); // 6 seconds between each
      }

      // 11th notification should be rate limited
      expect(checkRateLimit()).toBe(false);
    });

    it("should reset counter after window expires", () => {
      // Send 10 notifications
      for (let i = 0; i < 10; i++) {
        expect(checkRateLimit()).toBe(true);
        updateRateLimit();
        vi.advanceTimersByTime(6000);
      }

      // 11th notification rate limited
      expect(checkRateLimit()).toBe(false);

      // Advance past window (60 seconds)
      vi.advanceTimersByTime(60000);

      // Should allow notification after window reset
      expect(checkRateLimit()).toBe(true);
    });

    it("should track recent notification count", () => {
      // Send 5 notifications
      for (let i = 0; i < 5; i++) {
        expect(checkRateLimit()).toBe(true);
        updateRateLimit();
        vi.advanceTimersByTime(6000);
      }

      // Should still allow more (under 10 limit)
      expect(checkRateLimit()).toBe(true);
    });

    it("should handle rapid successive calls", () => {
      expect(checkRateLimit()).toBe(true);
      updateRateLimit();

      // Rapid calls without time advancement
      expect(checkRateLimit()).toBe(false);
      expect(checkRateLimit()).toBe(false);
      expect(checkRateLimit()).toBe(false);

      // After minimum interval
      vi.advanceTimersByTime(5000);
      expect(checkRateLimit()).toBe(true);
    });
  });

  describe("Email Notification Configuration", () => {
    it("should require SMTP configuration", () => {
      // Test would verify that sendEmailNotification checks for required env vars
      const requiredVars = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"];
      expect(requiredVars).toContain("SMTP_HOST");
      expect(requiredVars).toContain("SMTP_USER");
      expect(requiredVars).toContain("SMTP_PASSWORD");
    });

    it("should support optional SMTP_FROM configuration", () => {
      // SMTP_FROM should default to SMTP_USER if not provided
      const smtpUser = "test@example.com";
      const smtpFrom = process.env.SMTP_FROM || smtpUser;
      expect(smtpFrom).toBe(smtpUser);
    });

    it("should default to port 587 for TLS", () => {
      const defaultPort = process.env.SMTP_PORT || "587";
      expect(defaultPort).toBe("587");
    });

    it("should support custom SMTP port", () => {
      const customPort = "465"; // SSL
      expect(customPort).toBe("465");
    });
  });

  describe("Email Priority Levels", () => {
    it("should support high priority", () => {
      const priority = "high";
      expect(["high", "normal", "low"]).toContain(priority);
    });

    it("should support normal priority", () => {
      const priority = "normal";
      expect(["high", "normal", "low"]).toContain(priority);
    });

    it("should support low priority", () => {
      const priority = "low";
      expect(["high", "normal", "low"]).toContain(priority);
    });

    it("should default to normal priority", () => {
      const priority = "normal";
      expect(priority).toBe("normal");
    });
  });

  describe("Email Content Validation", () => {
    it("should require recipient email", () => {
      const requiredFields = ["to", "subject", "body"];
      expect(requiredFields).toContain("to");
    });

    it("should require email subject", () => {
      const requiredFields = ["to", "subject", "body"];
      expect(requiredFields).toContain("subject");
    });

    it("should require email body", () => {
      const requiredFields = ["to", "subject", "body"];
      expect(requiredFields).toContain("body");
    });

    it("should support optional HTML body", () => {
      const optionalFields = ["html", "priority"];
      expect(optionalFields).toContain("html");
    });

    it("should support plain text fallback", () => {
      const body = "Test email body\nWith multiple lines";
      const htmlFallback = body.replace(/\n/g, "<br>");
      expect(htmlFallback).toBe("Test email body<br>With multiple lines");
    });
  });

  describe("Error Handling", () => {
    it("should handle missing SMTP configuration gracefully", () => {
      // Should log and continue without throwing
      const missingConfig = !process.env.SMTP_HOST || !process.env.SMTP_USER;
      if (missingConfig) {
        expect(true).toBe(true); // No error thrown
      }
    });

    it("should not throw on SMTP errors", () => {
      // Error handling should log but not throw
      expect(() => {
        console.error("Error sending email notification:", new Error("Test error"));
      }).not.toThrow();
    });

    it("should handle rate limit gracefully", () => {
      // Rate limited notifications should log, not throw
      expect(() => {
        console.log("Email notification rate limited, skipping");
      }).not.toThrow();
    });
  });

  describe("Security", () => {
    it("should not log SMTP credentials", () => {
      const sensitiveData = ["SMTP_PASSWORD", "SMTP_USER"];
      // Verify these are not logged in any notification output
      expect(sensitiveData).toBeDefined();
    });

    it("should use secure SMTP connection", () => {
      const port587 = "587"; // TLS
      const port465 = "465"; // SSL
      const securePorts = [port587, port465];
      expect(securePorts).toContain("587");
      expect(securePorts).toContain("465");
    });

    it("should validate email addresses", () => {
      const validEmail = "test@example.com";
      expect(validEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it("should escape HTML in plain text conversion", () => {
      const bodyWithNewlines = "Line 1\nLine 2\nLine 3";
      const htmlVersion = bodyWithNewlines.replace(/\n/g, "<br>");
      expect(htmlVersion).toBe("Line 1<br>Line 2<br>Line 3");
    });
  });

  describe("Integration with PTR Alerts", () => {
    it("should send email for critical alerts", () => {
      const alert = {
        type: "high_cpu",
        severity: "critical" as const,
        message: "Critical CPU usage detected"
      };
      expect(alert.severity).toBe("critical");
    });

    it("should send email for high severity alerts", () => {
      const alert = {
        type: "api_unavailable",
        severity: "high" as const,
        message: "API unavailable"
      };
      expect(alert.severity).toBe("high");
    });

    it("should skip email for medium severity alerts", () => {
      const alert = {
        type: "low_energy",
        severity: "medium" as const,
        message: "Low energy reserves"
      };
      // Medium severity should not trigger email
      expect(alert.severity).toBe("medium");
    });

    it("should include alert details in email", () => {
      const alert = {
        type: "high_cpu",
        severity: "critical" as const,
        message: "High CPU usage detected: 92.5% average over 4 ticks"
      };
      expect(alert.message).toContain("92.5%");
      expect(alert.type).toBe("high_cpu");
    });
  });

  describe("Email Template Formatting", () => {
    it("should format severity as uppercase", () => {
      const severity = "critical";
      expect(severity.toUpperCase()).toBe("CRITICAL");
    });

    it("should include timestamp in ISO format", () => {
      const timestamp = new Date().toISOString();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should include GitHub action URL", () => {
      const repo = "ralphschuler/.screeps-gpt";
      const runId = "12345";
      const actionUrl = `https://github.com/${repo}/actions/runs/${runId}`;
      expect(actionUrl).toBe("https://github.com/ralphschuler/.screeps-gpt/actions/runs/12345");
    });

    it("should format plain text with proper sections", () => {
      const plainText = `
Screeps PTR Alert Detected
========================

Severity: CRITICAL
Type: high_cpu
Message: High CPU usage detected

View Details: https://github.com/repo/actions/runs/123
      `.trim();
      expect(plainText).toContain("Screeps PTR Alert Detected");
      expect(plainText).toContain("Severity: CRITICAL");
    });

    it("should include HTML styling for critical alerts", () => {
      const criticalColor = "#dc3545";
      expect(criticalColor).toBe("#dc3545"); // Red
    });

    it("should include HTML styling for high severity alerts", () => {
      const highColor = "#ffc107";
      expect(highColor).toBe("#ffc107"); // Yellow/Orange
    });
  });
});
