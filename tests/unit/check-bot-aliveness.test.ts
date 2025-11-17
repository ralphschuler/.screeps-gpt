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

// Mock file system operations
vi.mock("node:fs", () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn()
}));

const originalEnv = process.env;
const originalFetch = global.fetch;

describe("check-bot-aliveness defensive parsing", () => {
  beforeEach(() => {
    mockConsoleMethod.mockReset(); // Reset mock completely
    process.env = { ...originalEnv };
    process.env.SCREEPS_TOKEN = "test-token";
    process.env.SCREEPS_SHARD = "shard3";
    // Mock fetch to return 401 by default (Memory.stats unavailable, will use console fallback)
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('should handle "undefined" string response from console', async () => {
    // Mock: console returns "undefined" string (common when bot has no game presence)
    mockConsoleMethod.mockResolvedValueOnce({ ok: 1, data: "undefined" });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    expect(result.aliveness).toBe("spawn_placement_needed");
    expect(result.status).toBe("empty");
    expect(result.error).toContain("Console returned empty response");
  });

  it("should handle empty string response from console", async () => {
    // Mock: console returns empty string
    mockConsoleMethod.mockResolvedValueOnce({ ok: 1, data: "" });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    expect(result.aliveness).toBe("spawn_placement_needed");
    expect(result.status).toBe("empty");
    expect(result.error).toContain("Console returned empty response");
  });

  it('should handle "null" string response from console', async () => {
    // Mock: console returns "null" string
    mockConsoleMethod.mockResolvedValueOnce({ ok: 1, data: "null" });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    expect(result.aliveness).toBe("spawn_placement_needed");
    expect(result.status).toBe("empty");
    expect(result.error).toContain("Console returned empty response");
  });

  it("should handle undefined response.data (regression test for issue)", async () => {
    // Mock: console returns undefined response.data (the bug scenario)
    mockConsoleMethod.mockResolvedValueOnce({ ok: 1, data: undefined });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    expect(result.aliveness).toBe("spawn_placement_needed");
    expect(result.status).toBe("empty");
    expect(result.error).toContain("Console returned empty response");
  });

  it("should handle null response.data", async () => {
    // Mock: console returns null response.data
    mockConsoleMethod.mockResolvedValueOnce({ ok: 1, data: null });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    expect(result.aliveness).toBe("spawn_placement_needed");
    expect(result.status).toBe("empty");
    expect(result.error).toContain("Console returned empty response");
  });

  it("should handle malformed JSON from console", async () => {
    // Mock: console returns malformed JSON
    mockConsoleMethod.mockResolvedValueOnce({ ok: 1, data: "{invalid json}" });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    expect(result.aliveness).toBe("unknown");
    expect(result.error).toContain("JSON parse error");
  });

  it("should handle non-object JSON response from console", async () => {
    // Mock: console returns a valid JSON but not an object (e.g., array or primitive)
    mockConsoleMethod.mockResolvedValueOnce({ ok: 1, data: "123" });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    expect(result.aliveness).toBe("spawn_placement_needed");
    expect(result.status).toBe("invalid");
    expect(result.error).toContain("Console returned invalid response structure");
  });

  it("should handle bot with active spawns (normal operation)", async () => {
    // Mock: console returns valid data with spawns
    mockConsoleMethod.mockResolvedValueOnce({
      ok: 1,
      data: JSON.stringify({ hasSpawns: true, spawnCount: 2, rooms: 1 })
    });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    expect(result.aliveness).toBe("active");
    expect(result.status).toBe("normal");
    expect(result.error).toBeUndefined();
  });

  it("should handle bot with rooms but no spawns (respawn needed)", async () => {
    // Mock: console returns data with rooms but no spawns
    mockConsoleMethod.mockResolvedValueOnce({
      ok: 1,
      data: JSON.stringify({ hasSpawns: false, spawnCount: 0, rooms: 1 })
    });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    expect(result.aliveness).toBe("respawn_needed");
    expect(result.status).toBe("lost");
    expect(result.error).toBeUndefined();
  });

  it("should handle bot with no rooms and no spawns (spawn placement needed)", async () => {
    // Mock: console returns data with no rooms and no spawns
    mockConsoleMethod.mockResolvedValueOnce({
      ok: 1,
      data: JSON.stringify({ hasSpawns: false, spawnCount: 0, rooms: 0 })
    });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    expect(result.aliveness).toBe("spawn_placement_needed");
    expect(result.status).toBe("empty");
    expect(result.error).toBeUndefined();
  });

  it("should handle API error response (ok: 0)", async () => {
    // Mock: console API returns error
    mockConsoleMethod.mockResolvedValueOnce({
      ok: 0,
      data: "",
      error: "Authentication failed"
    });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    expect(result.aliveness).toBe("unknown");
    expect(result.error).toBe("Authentication failed");
  });

  it("should handle network/exception errors", async () => {
    // Mock: console throws exception
    mockConsoleMethod.mockRejectedValueOnce(new Error("Network timeout"));

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    expect(result.aliveness).toBe("unknown");
    expect(result.error).toContain("Network timeout");
  });

  it("should require SCREEPS_TOKEN environment variable", async () => {
    delete process.env.SCREEPS_TOKEN;

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    expect(result.aliveness).toBe("unknown");
    expect(result.error).toContain("SCREEPS_TOKEN environment variable not set");
  });

  it("should use default shard when not specified", async () => {
    delete process.env.SCREEPS_SHARD;
    mockConsoleMethod.mockResolvedValueOnce({
      ok: 1,
      data: JSON.stringify({ hasSpawns: true, spawnCount: 1, rooms: 1 })
    });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    await checkBotAliveness();

    // Verify the console was called with default shard "shard3"
    expect(mockConsoleMethod).toHaveBeenCalledWith(expect.any(String), "shard3");
  });

  it("should use custom shard from environment", async () => {
    process.env.SCREEPS_SHARD = "shard1";
    mockConsoleMethod.mockResolvedValueOnce({
      ok: 1,
      data: JSON.stringify({ hasSpawns: true, spawnCount: 1, rooms: 1 })
    });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    await checkBotAliveness();

    // Verify the console was called with custom shard "shard1"
    expect(mockConsoleMethod).toHaveBeenCalledWith(expect.any(String), "shard1");
  });

  it("should detect bot is active via Memory.stats when console returns empty (regression for false positive)", async () => {
    // Mock: Memory.stats API returns valid data showing bot is active
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          creeps: {
            creep1: { role: "harvester" },
            creep2: { role: "harvester" },
            creep3: { role: "harvester" },
            creep4: { role: "harvester" },
            creep5: { role: "builder" },
            creep6: { role: "builder" },
            creep7: { role: "upgrader" },
            creep8: { role: "upgrader" },
            creep9: { role: "upgrader" },
            creep10: { role: "upgrader" },
            creep11: { role: "upgrader" }
          },
          rooms: {
            E54N39: { rcl: 4 }
          }
        }
      })
    });

    // Console would return empty (the false positive scenario)
    // But we should never get to console because Memory.stats shows bot is active
    mockConsoleMethod.mockResolvedValueOnce({ ok: 1, data: "undefined" });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    // Should correctly identify bot as active based on Memory.stats
    expect(result.aliveness).toBe("active");
    expect(result.source).toBe("memory_stats");
    expect(result.error).toBeUndefined();

    // Console should NOT have been called because Memory.stats was authoritative
    expect(mockConsoleMethod).not.toHaveBeenCalled();
  });

  it("should fall back to console when Memory.stats API fails", async () => {
    // Mock: Memory.stats API fails (404 or network error)
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404
    });

    // Console returns valid data - use mockResolvedValue instead of Once
    // because the mock needs to persist through the async call
    mockConsoleMethod.mockResolvedValue({
      ok: 1,
      data: JSON.stringify({ hasSpawns: true, spawnCount: 2, rooms: 1 })
    });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    // Should use console fallback
    expect(result.aliveness).toBe("active");
    expect(result.source).toBe("console");

    // Console should have been called as fallback
    expect(mockConsoleMethod).toHaveBeenCalled();
  });

  it("should handle Memory.stats showing no creeps but rooms exist", async () => {
    // Mock: Memory.stats shows rooms but no creeps (respawn scenario)
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          creeps: {},
          rooms: {
            E54N39: { rcl: 4 }
          }
        }
      })
    });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    expect(result.aliveness).toBe("respawn_needed");
    expect(result.source).toBe("memory_stats");
    expect(result.status).toBe("rooms_no_creeps");
  });

  it("should handle Memory.stats showing no presence", async () => {
    // Mock: Memory.stats shows no creeps and no rooms
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          creeps: {},
          rooms: {}
        }
      })
    });

    const { checkBotAliveness } = await import("../../packages/utilities/scripts/check-bot-aliveness");

    const result = await checkBotAliveness();

    expect(result.aliveness).toBe("spawn_placement_needed");
    expect(result.source).toBe("memory_stats");
    expect(result.status).toBe("no_presence");
  });
});
