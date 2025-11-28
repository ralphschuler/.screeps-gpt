import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ScreepsAPI
const mockRawUserRooms = vi.fn();
const MockScreepsAPI = vi.fn(function (this: unknown) {
  return {
    raw: {
      user: {
        rooms: mockRawUserRooms
      }
    }
  };
});

vi.mock("screeps-api", () => ({
  ScreepsAPI: MockScreepsAPI
}));

const originalEnv = process.env;

describe("shard-discovery", () => {
  beforeEach(() => {
    vi.resetModules();
    mockRawUserRooms.mockReset();
    process.env = { ...originalEnv };
    process.env.SCREEPS_TOKEN = "test-token";
    process.env.SCREEPS_SHARD = "shard3";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("discoverBotShards", () => {
    it("should discover shards from user/rooms endpoint", async () => {
      mockRawUserRooms.mockResolvedValueOnce({
        ok: 1,
        shards: {
          shard3: ["E54N39", "E55N39"],
          shard2: ["W10N20"]
        }
      });

      const { discoverBotShards, clearShardDiscoveryCache } = await import(
        "../../scripts/lib/shard-discovery"
      );
      clearShardDiscoveryCache();

      const result = await discoverBotShards(undefined, false);

      expect(result.shards).toHaveLength(2);
      expect(result.totalRooms).toBe(3);
      expect(result.shards[0].name).toBe("shard2"); // sorted alphabetically
      expect(result.shards[0].rooms).toEqual(["W10N20"]);
      expect(result.shards[1].name).toBe("shard3");
      expect(result.shards[1].rooms).toEqual(["E54N39", "E55N39"]);
    });

    it("should return single shard when bot is on one shard", async () => {
      mockRawUserRooms.mockResolvedValueOnce({
        ok: 1,
        shards: {
          shard3: ["E54N39"]
        }
      });

      const { discoverBotShards, clearShardDiscoveryCache } = await import(
        "../../scripts/lib/shard-discovery"
      );
      clearShardDiscoveryCache();

      const result = await discoverBotShards(undefined, false);

      expect(result.shards).toHaveLength(1);
      expect(result.totalRooms).toBe(1);
      expect(result.shards[0].name).toBe("shard3");
      expect(result.shards[0].rooms).toEqual(["E54N39"]);
    });

    it("should fall back to default shard when no rooms found", async () => {
      mockRawUserRooms.mockResolvedValueOnce({
        ok: 1,
        shards: {}
      });

      const { discoverBotShards, clearShardDiscoveryCache } = await import(
        "../../scripts/lib/shard-discovery"
      );
      clearShardDiscoveryCache();

      const result = await discoverBotShards(undefined, false);

      expect(result.shards).toHaveLength(1);
      expect(result.shards[0].name).toBe("shard3"); // default shard
      expect(result.shards[0].rooms).toEqual([]);
    });

    it("should fall back to default shard on API error", async () => {
      mockRawUserRooms.mockRejectedValueOnce(new Error("API Error"));

      const { discoverBotShards, clearShardDiscoveryCache } = await import(
        "../../scripts/lib/shard-discovery"
      );
      clearShardDiscoveryCache();

      const result = await discoverBotShards(undefined, false);

      expect(result.shards).toHaveLength(1);
      expect(result.shards[0].name).toBe("shard3"); // default shard
      expect(result.totalRooms).toBe(0);
    });

    it("should handle API response with ok: 0", async () => {
      mockRawUserRooms.mockResolvedValueOnce({
        ok: 0,
        error: "Unauthorized"
      });

      const { discoverBotShards, clearShardDiscoveryCache } = await import(
        "../../scripts/lib/shard-discovery"
      );
      clearShardDiscoveryCache();

      const result = await discoverBotShards(undefined, false);

      expect(result.shards).toHaveLength(1);
      expect(result.shards[0].name).toBe("shard3"); // default shard
    });

    it("should use custom default shard from environment", async () => {
      process.env.SCREEPS_SHARD = "shard1";
      mockRawUserRooms.mockResolvedValueOnce({
        ok: 1,
        shards: {}
      });

      const { discoverBotShards, clearShardDiscoveryCache } = await import(
        "../../scripts/lib/shard-discovery"
      );
      clearShardDiscoveryCache();

      const result = await discoverBotShards(undefined, false);

      expect(result.shards[0].name).toBe("shard1"); // custom default shard
    });

    it("should skip empty room arrays", async () => {
      mockRawUserRooms.mockResolvedValueOnce({
        ok: 1,
        shards: {
          shard3: ["E54N39"],
          shard2: [] // empty array
        }
      });

      const { discoverBotShards, clearShardDiscoveryCache } = await import(
        "../../scripts/lib/shard-discovery"
      );
      clearShardDiscoveryCache();

      const result = await discoverBotShards(undefined, false);

      expect(result.shards).toHaveLength(1);
      expect(result.shards[0].name).toBe("shard3");
    });

    it("should include discoveredAt timestamp", async () => {
      mockRawUserRooms.mockResolvedValueOnce({
        ok: 1,
        shards: {
          shard3: ["E54N39"]
        }
      });

      const { discoverBotShards, clearShardDiscoveryCache } = await import(
        "../../scripts/lib/shard-discovery"
      );
      clearShardDiscoveryCache();

      const before = new Date().toISOString();
      const result = await discoverBotShards(undefined, false);
      const after = new Date().toISOString();

      expect(result.discoveredAt).toBeDefined();
      expect(result.discoveredAt >= before).toBe(true);
      expect(result.discoveredAt <= after).toBe(true);
    });
  });

  describe("caching", () => {
    it("should cache discovery results", async () => {
      mockRawUserRooms.mockResolvedValue({
        ok: 1,
        shards: {
          shard3: ["E54N39"]
        }
      });

      const { discoverBotShards, clearShardDiscoveryCache } = await import(
        "../../scripts/lib/shard-discovery"
      );
      clearShardDiscoveryCache();

      // First call
      await discoverBotShards(undefined, true);
      // Second call should use cache
      await discoverBotShards(undefined, true);

      // API should only be called once
      expect(mockRawUserRooms).toHaveBeenCalledTimes(1);
    });

    it("should bypass cache when useCache is false", async () => {
      mockRawUserRooms.mockResolvedValue({
        ok: 1,
        shards: {
          shard3: ["E54N39"]
        }
      });

      const { discoverBotShards, clearShardDiscoveryCache } = await import(
        "../../scripts/lib/shard-discovery"
      );
      clearShardDiscoveryCache();

      // First call with cache
      await discoverBotShards(undefined, true);
      // Second call without cache
      await discoverBotShards(undefined, false);

      // API should be called twice
      expect(mockRawUserRooms).toHaveBeenCalledTimes(2);
    });

    it("should clear cache when clearShardDiscoveryCache is called", async () => {
      mockRawUserRooms.mockResolvedValue({
        ok: 1,
        shards: {
          shard3: ["E54N39"]
        }
      });

      const {
        discoverBotShards,
        clearShardDiscoveryCache,
        getShardDiscoveryCacheStatus
      } = await import("../../scripts/lib/shard-discovery");
      clearShardDiscoveryCache();

      // First call
      await discoverBotShards(undefined, true);
      expect(getShardDiscoveryCacheStatus().isCached).toBe(true);

      // Clear cache
      clearShardDiscoveryCache();
      expect(getShardDiscoveryCacheStatus().isCached).toBe(false);
    });
  });

  describe("getShardDiscoveryCacheStatus", () => {
    it("should return isCached: false when no cache exists", async () => {
      const { getShardDiscoveryCacheStatus, clearShardDiscoveryCache } =
        await import("../../scripts/lib/shard-discovery");
      clearShardDiscoveryCache();

      const status = getShardDiscoveryCacheStatus();

      expect(status.isCached).toBe(false);
      expect(status.expiresIn).toBeNull();
    });

    it("should return isCached: true with expiresIn when cached", async () => {
      mockRawUserRooms.mockResolvedValueOnce({
        ok: 1,
        shards: {
          shard3: ["E54N39"]
        }
      });

      const {
        discoverBotShards,
        getShardDiscoveryCacheStatus,
        clearShardDiscoveryCache
      } = await import("../../scripts/lib/shard-discovery");
      clearShardDiscoveryCache();

      await discoverBotShards(undefined, true);

      const status = getShardDiscoveryCacheStatus();

      expect(status.isCached).toBe(true);
      expect(status.expiresIn).toBeGreaterThan(0);
      // Cache duration is 5 minutes (300000ms)
      expect(status.expiresIn).toBeLessThanOrEqual(5 * 60 * 1000);
    });
  });

  describe("error handling", () => {
    it("should require SCREEPS_TOKEN environment variable", async () => {
      delete process.env.SCREEPS_TOKEN;

      const { discoverBotShards, clearShardDiscoveryCache } = await import(
        "../../scripts/lib/shard-discovery"
      );
      clearShardDiscoveryCache();

      // When no API instance is provided and no token is set, it should throw
      await expect(discoverBotShards(undefined, false)).rejects.toThrow(
        "SCREEPS_TOKEN environment variable is required"
      );
    });

    it("should handle malformed shards response", async () => {
      mockRawUserRooms.mockResolvedValueOnce({
        ok: 1,
        shards: null // malformed response
      });

      const { discoverBotShards, clearShardDiscoveryCache } = await import(
        "../../scripts/lib/shard-discovery"
      );
      clearShardDiscoveryCache();

      const result = await discoverBotShards(undefined, false);

      // Should fall back to default shard
      expect(result.shards).toHaveLength(1);
      expect(result.shards[0].name).toBe("shard3");
    });

    it("should handle non-array room values", async () => {
      mockRawUserRooms.mockResolvedValueOnce({
        ok: 1,
        shards: {
          shard3: "E54N39" // string instead of array
        }
      });

      const { discoverBotShards, clearShardDiscoveryCache } = await import(
        "../../scripts/lib/shard-discovery"
      );
      clearShardDiscoveryCache();

      const result = await discoverBotShards(undefined, false);

      // Should fall back to default shard since no valid shards
      expect(result.shards).toHaveLength(1);
      expect(result.shards[0].name).toBe("shard3");
    });
  });
});
