import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock process.env
const originalEnv = process.env;

describe("send-push-notification", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Rate limiting", () => {
    it("should allow notifications within rate limits", async () => {
      const { checkRateLimit } = await import("../../scripts/send-push-notification.js");

      // First notification should be allowed
      expect(checkRateLimit()).toBe(true);
    });

    it("should prevent notifications that are too frequent", async () => {
      const { checkRateLimit, updateRateLimit } = await import("../../scripts/send-push-notification.js");

      // Send first notification
      expect(checkRateLimit()).toBe(true);
      updateRateLimit();

      // Immediate second notification should be blocked
      expect(checkRateLimit()).toBe(false);
    });
  });

  describe("sendPushNotification", () => {
    it("should skip notification when PUSH_TOKEN is not set", async () => {
      delete process.env.PUSH_TOKEN;
      const consoleSpy = vi.spyOn(console, "log");

      const { sendPushNotification } = await import("../../scripts/send-push-notification.js");

      await sendPushNotification({
        title: "Test",
        body: "Test body"
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("PUSH_TOKEN not configured"));
    });

    it("should validate required fields", async () => {
      process.env.PUSH_TOKEN = "test-token";

      const { sendPushNotification } = await import("../../scripts/send-push-notification.js");

      await expect(sendPushNotification({ title: "", body: "" })).rejects.toThrow("Title and body are required");
    });

    it("should construct correct API request", async () => {
      process.env.PUSH_TOKEN = "test-token";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      global.fetch = mockFetch as typeof fetch;

      const { sendPushNotification } = await import("../../scripts/send-push-notification.js");

      await sendPushNotification({
        title: "Test Title",
        body: "Test Body",
        link: "https://example.com",
        priority: 5
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://push.techulus.com/api/v1/notify",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "x-api-key": "test-token"
          }) as HeadersInit,
          body: expect.stringContaining("Test Title") as BodyInit
        }) as RequestInit
      );
    });

    it("should handle API errors gracefully", async () => {
      process.env.PUSH_TOKEN = "test-token";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request")
      });
      global.fetch = mockFetch as typeof fetch;

      const consoleErrorSpy = vi.spyOn(console, "error");

      const { sendPushNotification } = await import("../../scripts/send-push-notification.js");

      // Should not throw
      await sendPushNotification({
        title: "Test",
        body: "Test body"
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Push notification failed (400)"));
    });

    it("should handle network errors gracefully", async () => {
      process.env.PUSH_TOKEN = "test-token";

      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
      global.fetch = mockFetch as typeof fetch;

      const consoleErrorSpy = vi.spyOn(console, "error");

      const { sendPushNotification } = await import("../../scripts/send-push-notification.js");

      // Should not throw
      await sendPushNotification({
        title: "Test",
        body: "Test body"
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error sending push notification:", expect.any(Error));
    });
  });
});
