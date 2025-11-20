import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ScreepsAPI
const mockConsoleMethod = vi.fn();
const MockScreepsAPI = vi.fn(function (this: unknown) {
  return {
    console: mockConsoleMethod
  };
});

vi.mock("screeps-api", () => ({
  ScreepsAPI: MockScreepsAPI
}));

const originalEnv = process.env;

describe("Console Telemetry with Chunked Queries", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.SCREEPS_TOKEN = "test-token";
    process.env.SCREEPS_SHARD = "shard3";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Chunked query strategy", () => {
    it("should split telemetry collection into 5 separate queries", async () => {
      // Mock responses for each query
      mockConsoleMethod
        .mockResolvedValueOnce({
          ok: 1,
          data: JSON.stringify({ tick: 12345, cpu: { used: 50, limit: 100, bucket: 8000 } })
        })
        .mockResolvedValueOnce({
          ok: 1,
          data: JSON.stringify({ level: 3, progress: 15000, progressTotal: 100000 })
        })
        .mockResolvedValueOnce({
          ok: 1,
          data: JSON.stringify([{ name: "W1N1", rcl: 5, energy: 300, energyCapacity: 550, storage: 50000 }])
        })
        .mockResolvedValueOnce({
          ok: 1,
          data: JSON.stringify({ total: 10, byRole: { harvester: 3, upgrader: 4, builder: 3 } })
        })
        .mockResolvedValueOnce({
          ok: 1,
          data: JSON.stringify({ energy: 50000 })
        });

      // Import after mocks are set up
      const { fetchConsoleTelemetry } = await import("../../scripts/fetch-console-telemetry");

      const result = await fetchConsoleTelemetry();

      // Verify 5 separate queries were made
      expect(mockConsoleMethod).toHaveBeenCalledTimes(5);

      // Verify the queries are small (each under 1000 chars by default, 1200 for rooms/creeps)
      for (let i = 0; i < 5; i++) {
        const command = mockConsoleMethod.mock.calls[i][0] as string;
        // Most queries should be under 1000 chars, rooms and creeps can be up to 1200
        if (i === 2 || i === 3) {
          // Rooms and creeps queries
          expect(command.length).toBeLessThan(1200);
        } else {
          expect(command.length).toBeLessThan(1000);
        }
      }

      // Verify the result structure
      expect(result).toEqual({
        tick: 12345,
        cpu: { used: 50, limit: 100, bucket: 8000 },
        gcl: { level: 3, progress: 15000, progressTotal: 100000 },
        rooms: [{ name: "W1N1", rcl: 5, energy: 300, energyCapacity: 550, storage: 50000 }],
        creeps: { total: 10, byRole: { harvester: 3, upgrader: 4, builder: 3 } },
        resources: { energy: 50000 }
      });
    });

    it("should successfully collect telemetry with minimal data", async () => {
      // Mock minimal responses
      mockConsoleMethod
        .mockResolvedValueOnce({
          ok: 1,
          data: JSON.stringify({ tick: 1000, cpu: { used: 10, limit: 20, bucket: 5000 } })
        })
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ level: 1, progress: 0, progressTotal: 1000 }) })
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify([]) })
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ total: 0, byRole: {} }) })
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ energy: 0 }) });

      const { fetchConsoleTelemetry } = await import("../../scripts/fetch-console-telemetry");
      const result = await fetchConsoleTelemetry();

      expect(result.tick).toBe(1000);
      expect(result.cpu).toEqual({ used: 10, limit: 20, bucket: 5000 });
      expect(result.rooms).toEqual([]);
      expect(result.creeps.total).toBe(0);
    });

    it("should handle large room data without exceeding size limit", async () => {
      // Mock responses with multiple rooms
      const manyRooms = Array.from({ length: 10 }, (_, i) => ({
        name: `W${i}N${i}`,
        rcl: 8,
        energy: 300,
        energyCapacity: 550,
        storage: 100000
      }));

      mockConsoleMethod
        .mockResolvedValueOnce({
          ok: 1,
          data: JSON.stringify({ tick: 5000, cpu: { used: 50, limit: 100, bucket: 8000 } })
        })
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ level: 3, progress: 15000, progressTotal: 100000 }) })
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify(manyRooms) })
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ total: 50, byRole: { harvester: 10 } }) })
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ energy: 1000000 }) });

      const { fetchConsoleTelemetry } = await import("../../scripts/fetch-console-telemetry");
      const result = await fetchConsoleTelemetry();

      expect(result.tick).toBe(5000);
      expect(result.rooms).toHaveLength(10);
      expect(result.creeps.total).toBe(50);
    });
  });

  describe("Retry logic with exponential backoff", () => {
    it("should retry failed queries up to 3 times", async () => {
      // First query succeeds, second fails twice then succeeds
      mockConsoleMethod
        .mockResolvedValueOnce({
          ok: 1,
          data: JSON.stringify({ tick: 2000, cpu: { used: 50, limit: 100, bucket: 8000 } })
        })
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ level: 3, progress: 15000, progressTotal: 100000 }) })
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify([]) })
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ total: 0, byRole: {} }) })
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ energy: 0 }) });

      const { fetchConsoleTelemetry } = await import("../../scripts/fetch-console-telemetry");
      const result = await fetchConsoleTelemetry();

      // Should have succeeded after retries
      expect(result.cpu).toEqual({ used: 50, limit: 100, bucket: 8000 });
      expect(result.gcl).toEqual({ level: 3, progress: 15000, progressTotal: 100000 });
    });

    it("should fail after 3 retry attempts", async () => {
      // First query fails all attempts
      mockConsoleMethod
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"));

      const { fetchConsoleTelemetry } = await import("../../scripts/fetch-console-telemetry");

      await expect(fetchConsoleTelemetry()).rejects.toThrow("Failed to fetch console telemetry");
      expect(mockConsoleMethod).toHaveBeenCalledTimes(3);
    });

    it("should handle API errors with ok: 0", async () => {
      mockConsoleMethod.mockResolvedValueOnce({ ok: 0, error: "Invalid command" });

      const { fetchConsoleTelemetry } = await import("../../scripts/fetch-console-telemetry");

      await expect(fetchConsoleTelemetry()).rejects.toThrow("Failed to fetch console telemetry");
    });
  });

  describe("Expression size validation", () => {
    it("should validate expression size before sending", async () => {
      // All queries should pass validation
      mockConsoleMethod
        .mockResolvedValueOnce({
          ok: 1,
          data: JSON.stringify({ tick: 3000, cpu: { used: 50, limit: 100, bucket: 8000 } })
        })
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ level: 3, progress: 15000, progressTotal: 100000 }) })
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify([]) })
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ total: 0, byRole: {} }) })
        .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ energy: 0 }) });

      const { fetchConsoleTelemetry } = await import("../../scripts/fetch-console-telemetry");
      const result = await fetchConsoleTelemetry();

      // Should succeed without validation errors
      expect(result).toBeDefined();
      expect(result.tick).toBe(3000);
      expect(mockConsoleMethod).toHaveBeenCalledTimes(5);
    });
  });

  describe("Error handling", () => {
    it("should throw descriptive error messages", async () => {
      mockConsoleMethod.mockRejectedValue(new Error("Network timeout"));

      const { fetchConsoleTelemetry } = await import("../../scripts/fetch-console-telemetry");

      await expect(fetchConsoleTelemetry()).rejects.toThrow("Failed to fetch console telemetry");
    });

    it("should require SCREEPS_TOKEN", async () => {
      delete process.env.SCREEPS_TOKEN;

      const { fetchConsoleTelemetry } = await import("../../scripts/fetch-console-telemetry");

      await expect(fetchConsoleTelemetry()).rejects.toThrow("Missing SCREEPS_TOKEN environment variable");
    });
  });
});
