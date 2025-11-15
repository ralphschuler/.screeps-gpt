import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync } from "node:fs";

// Mock file system operations
vi.mock("node:fs", () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn()
}));

// Mock fetch with proper typing
const mockFetch = vi.fn();
global.fetch = mockFetch;

const originalEnv = process.env;

describe("fetch-screeps-stats", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.exit = vi.fn() as never;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Parameter validation", () => {
    it("should use default interval of 180 when not specified", async () => {
      process.env.SCREEPS_TOKEN = "test-token";

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ stats: {} })
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Dynamic import to get fresh module with env vars
      await import("../../packages/utilities/scripts/fetch-screeps-stats.mjs");

      // Wait for async operations
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(fetchCall[0]).toContain("interval=180");
    });

    it("should accept valid interval values", async () => {
      const validIntervals = ["8", "180", "1440"];

      for (const interval of validIntervals) {
        vi.resetModules();
        vi.clearAllMocks();
        process.env.SCREEPS_TOKEN = "test-token";
        process.env.SCREEPS_STATS_INTERVAL = interval;

        const mockResponse = {
          ok: true,
          json: vi.fn().mockResolvedValue({ stats: {} })
        };
        mockFetch.mockResolvedValue(mockResponse);

        await import("../../packages/utilities/scripts/fetch-screeps-stats.mjs");

        await vi.waitFor(() => {
          expect(mockFetch).toHaveBeenCalled();
        });

        const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(fetchCall[0]).toContain(`interval=${interval}`);
      }
    });
  });

  describe("Authentication", () => {
    it("should use X-Token header for authentication", async () => {
      process.env.SCREEPS_TOKEN = "my-auth-token";

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ stats: {} })
      };
      mockFetch.mockResolvedValue(mockResponse);

      await import("../../packages/utilities/scripts/fetch-screeps-stats.mjs");

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = fetchCall[1]?.headers as Record<string, string>;
      expect(headers?.["X-Token"]).toBe("my-auth-token");
    });

    it("should prefer SCREEPS_STATS_TOKEN over SCREEPS_TOKEN", async () => {
      process.env.SCREEPS_TOKEN = "generic-token";
      process.env.SCREEPS_STATS_TOKEN = "stats-specific-token";

      const fetchResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ stats: {} })
      };
      mockFetch.mockResolvedValue(fetchResponse);

      await import("../../packages/utilities/scripts/fetch-screeps-stats.mjs");

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = fetchCall[1]?.headers as Record<string, string>;
      expect(headers?.["X-Token"]).toBe("stats-specific-token");
    });
  });

  describe("Endpoint construction", () => {
    it("should construct correct endpoint with default host", async () => {
      process.env.SCREEPS_TOKEN = "test-token";

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ stats: {} })
      };
      mockFetch.mockResolvedValue(mockResponse);

      await import("../../packages/utilities/scripts/fetch-screeps-stats.mjs");

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(fetchCall[0]).toBe("https://screeps.com/api/user/stats?interval=180");
    });

    it("should use custom host when specified", async () => {
      process.env.SCREEPS_TOKEN = "test-token";
      process.env.SCREEPS_STATS_HOST = "https://custom.screeps.com";

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ stats: {} })
      };
      mockFetch.mockResolvedValue(mockResponse);

      await import("../../packages/utilities/scripts/fetch-screeps-stats.mjs");

      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const fetchCall = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(fetchCall[0]).toContain("https://custom.screeps.com/api/user/stats");
    });
  });

  describe("Error handling", () => {
    it("should handle API errors with status codes", async () => {
      process.env.SCREEPS_TOKEN = "test-token";

      const mockResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: vi.fn().mockResolvedValue("Invalid token")
      };
      mockFetch.mockResolvedValue(mockResponse);

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await import("../../packages/utilities/scripts/fetch-screeps-stats.mjs");

      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("HTTP Status: 401"));
    });
  });

  describe("Output", () => {
    it("should save snapshot to correct location", async () => {
      process.env.SCREEPS_TOKEN = "test-token";

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ stats: { "12345": { cpu: { used: 10, limit: 100 } } } })
      };
      mockFetch.mockResolvedValue(mockResponse);

      await import("../../packages/utilities/scripts/fetch-screeps-stats.mjs");

      await vi.waitFor(() => {
        expect(writeFileSync).toHaveBeenCalled();
      });

      const mockWriteFileSync = writeFileSync as ReturnType<typeof vi.fn>;
      const writeCall = mockWriteFileSync.mock.calls[0] as [string, string];
      expect(writeCall[0]).toContain("reports/screeps-stats/latest.json");
    });
  });
});
