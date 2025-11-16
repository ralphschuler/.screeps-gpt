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

describe("check-bot-aliveness defensive parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.SCREEPS_TOKEN = "test-token";
    process.env.SCREEPS_SHARD = "shard3";
  });

  afterEach(() => {
    process.env = originalEnv;
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
});
