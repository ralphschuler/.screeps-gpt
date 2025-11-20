import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock process.env
const originalEnv = process.env;

// Mock the https module
const mockRequest = vi.fn();
vi.mock("node:https", () => ({
  default: { request: mockRequest },
  request: mockRequest
}));

describe("send-push-notification", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
      const { checkRateLimit, updateRateLimit } = await import(
        "../../scripts/send-push-notification.js"
      );

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

      // Mock successful response
      mockRequest.mockImplementation((options: unknown, callback: (res: unknown) => void) => {
        const mockRes = {
          statusCode: 200,
          on: vi.fn().mockImplementation((event: string, handler: (data?: string) => void) => {
            if (event === "data") {
              handler('{"success": true}');
            } else if (event === "end") {
              handler();
            }
          })
        };
        callback(mockRes);
        return {
          on: vi.fn(),
          write: vi.fn(),
          end: vi.fn()
        };
      });

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { sendPushNotification } = await import("../../scripts/send-push-notification.js");

      await sendPushNotification({
        title: "Test Title",
        body: "Test Body",
        link: "https://example.com",
        priority: 5
      });

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: "push.techulus.com",
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "x-api-key": "test-token"
          }) as Record<string, string>
        }),
        expect.any(Function)
      );
      expect(consoleSpy).toHaveBeenCalledWith("Push notification sent successfully:", { success: true });
    });

    it("should handle API errors gracefully", async () => {
      process.env.PUSH_TOKEN = "test-token";

      // Mock API error response
      mockRequest.mockImplementation((options: unknown, callback: (res: unknown) => void) => {
        const mockRes = {
          statusCode: 401,
          on: vi.fn().mockImplementation((event: string, handler: (data?: string) => void) => {
            if (event === "data") {
              handler('{"success":false,"message":"Invalid API key, authentication failed"}');
            } else if (event === "end") {
              handler();
            }
          })
        };
        callback(mockRes);
        return {
          on: vi.fn(),
          write: vi.fn(),
          end: vi.fn()
        };
      });

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { sendPushNotification } = await import("../../scripts/send-push-notification.js");

      // Should not throw
      await sendPushNotification({
        title: "Test",
        body: "Test body"
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Push notification failed (401)"));
    });

    it("should handle network errors gracefully", async () => {
      process.env.PUSH_TOKEN = "test-token";

      // Mock network error
      mockRequest.mockImplementation(() => {
        return {
          on: vi.fn().mockImplementation((event: string, handler: (error: Error) => void) => {
            if (event === "error") {
              handler(new Error("Network error"));
            }
          }),
          write: vi.fn(),
          end: vi.fn()
        };
      });

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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
