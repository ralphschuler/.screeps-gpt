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

describe("fetch-room-analysis defensive parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.SCREEPS_TOKEN = "test-token";
    process.env.SCREEPS_SHARD = "shard3";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should handle "undefined" string response when bot has no rooms', async () => {
    // Mock: presence check shows 0 rooms (early exit path)
    mockConsoleMethod.mockResolvedValueOnce({ ok: 1, data: "0" }); // presence check

    const { performRoomAnalysis } = await import("../../packages/utilities/scripts/fetch-room-analysis");

    const result = await performRoomAnalysis();

    expect(result.occupiedRooms).toEqual([]);
    expect(result.summary.totalOccupied).toBe(0);
    expect(result.shard).toBe("shard3");
  });

  it('should handle "undefined" string from rooms command', async () => {
    // Mock: presence check shows rooms, username fetched, then rooms command returns "undefined"
    mockConsoleMethod
      .mockResolvedValueOnce({ ok: 1, data: "1" }) // presence check
      .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ username: "TestUser" }) }) // username
      .mockResolvedValueOnce({ ok: 1, data: "undefined" }); // rooms command returns undefined

    const { performRoomAnalysis } = await import("../../packages/utilities/scripts/fetch-room-analysis");

    const result = await performRoomAnalysis();

    expect(result.occupiedRooms).toEqual([]);
    expect(result.summary.totalOccupied).toBe(0);
  });

  it("should handle empty string response from rooms command", async () => {
    // Mock: presence check shows rooms, username fetched, then rooms command returns empty
    mockConsoleMethod
      .mockResolvedValueOnce({ ok: 1, data: "1" }) // presence check
      .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ username: "TestUser" }) }) // username
      .mockResolvedValueOnce({ ok: 1, data: "" }); // rooms command returns empty

    const { performRoomAnalysis } = await import("../../packages/utilities/scripts/fetch-room-analysis");

    const result = await performRoomAnalysis();

    expect(result.occupiedRooms).toEqual([]);
    expect(result.summary.totalOccupied).toBe(0);
  });

  it('should handle "null" string response from rooms command', async () => {
    // Mock: presence check shows rooms, username fetched, then rooms command returns "null"
    mockConsoleMethod
      .mockResolvedValueOnce({ ok: 1, data: "1" }) // presence check
      .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ username: "TestUser" }) }) // username
      .mockResolvedValueOnce({ ok: 1, data: "null" }); // rooms command returns null

    const { performRoomAnalysis } = await import("../../packages/utilities/scripts/fetch-room-analysis");

    const result = await performRoomAnalysis();

    expect(result.occupiedRooms).toEqual([]);
    expect(result.summary.totalOccupied).toBe(0);
  });

  it("should handle non-array JSON response from rooms command", async () => {
    // Mock: presence check shows rooms, username fetched, then rooms command returns object
    mockConsoleMethod
      .mockResolvedValueOnce({ ok: 1, data: "1" }) // presence check
      .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ username: "TestUser" }) }) // username
      .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ error: "not an array" }) }); // rooms command

    const { performRoomAnalysis } = await import("../../packages/utilities/scripts/fetch-room-analysis");

    const result = await performRoomAnalysis();

    expect(result.occupiedRooms).toEqual([]);
    expect(result.summary.totalOccupied).toBe(0);
  });

  it("should handle malformed JSON from rooms command", async () => {
    // Mock: presence check shows rooms, username fetched, then rooms command returns malformed JSON
    mockConsoleMethod
      .mockResolvedValueOnce({ ok: 1, data: "1" }) // presence check
      .mockResolvedValueOnce({ ok: 1, data: JSON.stringify({ username: "TestUser" }) }) // username
      .mockResolvedValueOnce({ ok: 1, data: "{invalid json}" }); // rooms command

    const { performRoomAnalysis } = await import("../../packages/utilities/scripts/fetch-room-analysis");

    const result = await performRoomAnalysis();

    expect(result.occupiedRooms).toEqual([]);
    expect(result.summary.totalOccupied).toBe(0);
  });

  it("should skip analysis when presence check returns NaN", async () => {
    // Mock: presence check returns invalid number
    mockConsoleMethod.mockResolvedValueOnce({ ok: 1, data: "not-a-number" });

    const { performRoomAnalysis } = await import("../../packages/utilities/scripts/fetch-room-analysis");

    const result = await performRoomAnalysis();

    expect(result.occupiedRooms).toEqual([]);
    expect(result.adjacentRooms).toEqual([]);
    expect(result.summary.totalOccupied).toBe(0);
  });

  it("should return valid empty analysis structure", async () => {
    // Mock: presence check shows 0 rooms
    mockConsoleMethod.mockResolvedValueOnce({ ok: 1, data: "0" });

    const { performRoomAnalysis } = await import("../../packages/utilities/scripts/fetch-room-analysis");

    const result = await performRoomAnalysis();

    // Verify complete empty analysis structure
    expect(result).toMatchObject({
      shard: "shard3",
      occupiedRooms: [],
      adjacentRooms: [],
      summary: {
        totalOccupied: 0,
        totalAdjacent: 0,
        hostileAdjacent: 0,
        neutralAdjacent: 0,
        friendlyAdjacent: 0,
        noviceZones: 0
      }
    });
    expect(result.fetchedAt).toBeDefined();
  });

  it("should require SCREEPS_TOKEN", async () => {
    delete process.env.SCREEPS_TOKEN;

    const { performRoomAnalysis } = await import("../../packages/utilities/scripts/fetch-room-analysis");

    await expect(performRoomAnalysis()).rejects.toThrow("Missing SCREEPS_TOKEN environment variable");
  });

  it("should use default shard when not specified", async () => {
    delete process.env.SCREEPS_SHARD;
    mockConsoleMethod.mockResolvedValueOnce({ ok: 1, data: "0" });

    const { performRoomAnalysis } = await import("../../packages/utilities/scripts/fetch-room-analysis");

    const result = await performRoomAnalysis();

    expect(result.shard).toBe("shard3");
  });

  it("should use custom shard from environment", async () => {
    process.env.SCREEPS_SHARD = "shard1";
    mockConsoleMethod.mockResolvedValueOnce({ ok: 1, data: "0" });

    const { performRoomAnalysis } = await import("../../packages/utilities/scripts/fetch-room-analysis");

    const result = await performRoomAnalysis();

    expect(result.shard).toBe("shard1");
  });
});
