import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  serializePath,
  serializePositions,
  deserializePath,
  isPathValid,
  getRemainingPath,
  calculateMemorySavings
} from "../../src/runtime/pathfinding/PathSerializer";
import type { PathStep } from "../../src/runtime/pathfinding/PathSerializer";

// Mock RoomPosition class for tests
class MockRoomPosition {
  public constructor(
    public x: number,
    public y: number,
    public roomName: string
  ) {}
}

describe("PathSerializer", () => {
  beforeEach(() => {
    // Setup global RoomPosition mock as a class
    (globalThis as unknown as { RoomPosition: typeof MockRoomPosition }).RoomPosition = MockRoomPosition;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("serializePath", () => {
    it("should serialize a simple path", () => {
      const path: PathStep[] = [
        { x: 25, y: 25, dx: 1, dy: 0, direction: 3 as DirectionConstant }, // RIGHT
        { x: 26, y: 25, dx: 1, dy: 0, direction: 3 as DirectionConstant } // RIGHT
      ];

      const serialized = serializePath("W1N1", path);

      expect(serialized).toBe("25,25,W1N1:33");
    });

    it("should serialize path with multiple directions", () => {
      const path: PathStep[] = [
        { x: 25, y: 25, dx: 1, dy: 0, direction: 3 as DirectionConstant }, // RIGHT
        { x: 26, y: 25, dx: 0, dy: 1, direction: 5 as DirectionConstant }, // BOTTOM
        { x: 26, y: 26, dx: -1, dy: 0, direction: 7 as DirectionConstant } // LEFT
      ];

      const serialized = serializePath("W1N1", path);

      expect(serialized).toBe("25,25,W1N1:357");
    });

    it("should return undefined for empty path", () => {
      const serialized = serializePath("W1N1", []);

      expect(serialized).toBeUndefined();
    });

    it("should return undefined for null/undefined path", () => {
      expect(serializePath("W1N1", null as unknown as PathStep[])).toBeUndefined();
      expect(serializePath("W1N1", undefined as unknown as PathStep[])).toBeUndefined();
    });
  });

  describe("serializePositions", () => {
    it("should convert RoomPosition array to serialized format", () => {
      const positions = [
        { x: 25, y: 25, roomName: "W1N1" } as RoomPosition,
        { x: 26, y: 25, roomName: "W1N1" } as RoomPosition,
        { x: 27, y: 25, roomName: "W1N1" } as RoomPosition
      ];

      const serialized = serializePositions(positions);

      expect(serialized).toBe("25,25,W1N1:33");
    });

    it("should return undefined for single position", () => {
      const positions = [{ x: 25, y: 25, roomName: "W1N1" } as RoomPosition];

      const serialized = serializePositions(positions);

      expect(serialized).toBeUndefined();
    });
  });

  describe("deserializePath", () => {
    it("should deserialize a simple path", () => {
      const serialized = "25,25,W1N1:33"; // Two RIGHT movements

      const positions = deserializePath(serialized);

      expect(positions).toHaveLength(3);
      expect(positions[0]).toEqual({ x: 25, y: 25, roomName: "W1N1" });
      expect(positions[1]).toEqual({ x: 26, y: 25, roomName: "W1N1" });
      expect(positions[2]).toEqual({ x: 27, y: 25, roomName: "W1N1" });
    });

    it("should deserialize path with multiple directions", () => {
      const serialized = "25,25,W1N1:357"; // RIGHT, BOTTOM, LEFT

      const positions = deserializePath(serialized);

      expect(positions).toHaveLength(4);
      expect(positions[0]).toEqual({ x: 25, y: 25, roomName: "W1N1" });
      expect(positions[1]).toEqual({ x: 26, y: 25, roomName: "W1N1" }); // RIGHT
      expect(positions[2]).toEqual({ x: 26, y: 26, roomName: "W1N1" }); // BOTTOM
      expect(positions[3]).toEqual({ x: 25, y: 26, roomName: "W1N1" }); // LEFT
    });

    it("should return empty array for invalid input", () => {
      expect(deserializePath("")).toEqual([]);
      expect(deserializePath("invalid")).toEqual([]);
      expect(deserializePath(null as unknown as string)).toEqual([]);
      expect(deserializePath(undefined as unknown as string)).toEqual([]);
    });

    it("should handle diagonal movements", () => {
      const serialized = "25,25,W1N1:2468"; // TOP_RIGHT, BOTTOM_RIGHT, BOTTOM_LEFT, TOP_LEFT

      const positions = deserializePath(serialized);

      expect(positions).toHaveLength(5);
      expect(positions[1]).toEqual({ x: 26, y: 24, roomName: "W1N1" }); // TOP_RIGHT
      expect(positions[2]).toEqual({ x: 27, y: 25, roomName: "W1N1" }); // BOTTOM_RIGHT
      expect(positions[3]).toEqual({ x: 26, y: 26, roomName: "W1N1" }); // BOTTOM_LEFT
      expect(positions[4]).toEqual({ x: 25, y: 25, roomName: "W1N1" }); // TOP_LEFT
    });

    it("should stop at room boundaries", () => {
      // Start at edge and try to go outside
      const serialized = "49,25,W1N1:33"; // Two RIGHT from edge

      const positions = deserializePath(serialized);

      // Should stop after first step that would go out of bounds
      expect(positions.length).toBeLessThanOrEqual(2);
      expect(positions[0]).toEqual({ x: 49, y: 25, roomName: "W1N1" });
    });
  });

  describe("isPathValid", () => {
    it("should return true if creep is on path", () => {
      const serialized = "25,25,W1N1:333";
      const currentPos = { x: 26, y: 25, roomName: "W1N1" } as RoomPosition;

      expect(isPathValid(serialized, currentPos)).toBe(true);
    });

    it("should return false if creep is not on path", () => {
      const serialized = "25,25,W1N1:333";
      const currentPos = { x: 10, y: 10, roomName: "W1N1" } as RoomPosition;

      expect(isPathValid(serialized, currentPos)).toBe(false);
    });

    it("should return false for empty serialized path", () => {
      const currentPos = { x: 25, y: 25, roomName: "W1N1" } as RoomPosition;

      expect(isPathValid("", currentPos)).toBe(false);
    });

    it("should check room name matching", () => {
      const serialized = "25,25,W1N1:333";
      const currentPos = { x: 25, y: 25, roomName: "W2N2" } as RoomPosition;

      expect(isPathValid(serialized, currentPos)).toBe(false);
    });
  });

  describe("getRemainingPath", () => {
    it("should return remaining positions from current location", () => {
      const serialized = "25,25,W1N1:333"; // 4 positions: 25,25 -> 26,25 -> 27,25 -> 28,25
      const currentPos = { x: 26, y: 25, roomName: "W1N1" } as RoomPosition;

      const remaining = getRemainingPath(serialized, currentPos);

      expect(remaining).toHaveLength(2);
      expect(remaining[0]).toEqual({ x: 27, y: 25, roomName: "W1N1" });
      expect(remaining[1]).toEqual({ x: 28, y: 25, roomName: "W1N1" });
    });

    it("should return empty array if not on path", () => {
      const serialized = "25,25,W1N1:333";
      const currentPos = { x: 10, y: 10, roomName: "W1N1" } as RoomPosition;

      const remaining = getRemainingPath(serialized, currentPos);

      expect(remaining).toEqual([]);
    });

    it("should return empty array if at end of path", () => {
      const serialized = "25,25,W1N1:333";
      const currentPos = { x: 28, y: 25, roomName: "W1N1" } as RoomPosition;

      const remaining = getRemainingPath(serialized, currentPos);

      expect(remaining).toEqual([]);
    });
  });

  describe("calculateMemorySavings", () => {
    it("should calculate memory savings for path", () => {
      const savings = calculateMemorySavings(10);

      expect(savings.raw).toBe(400); // 10 * 40 bytes
      expect(savings.serialized).toBe(29); // 20 + 9 direction chars
      expect(savings.savings).toBe(371);
    });

    it("should handle short paths", () => {
      const savings = calculateMemorySavings(2);

      expect(savings.raw).toBe(80);
      expect(savings.serialized).toBe(21); // 20 + 1 direction char
      expect(savings.savings).toBe(59);
    });

    it("should handle single position", () => {
      const savings = calculateMemorySavings(1);

      expect(savings.raw).toBe(40);
      expect(savings.serialized).toBe(20); // No direction chars needed
      expect(savings.savings).toBe(20);
    });
  });

  describe("Round-trip serialization", () => {
    it("should preserve path data through serialize/deserialize cycle", () => {
      const originalPositions = [
        { x: 25, y: 25, roomName: "W1N1" } as RoomPosition,
        { x: 26, y: 25, roomName: "W1N1" } as RoomPosition,
        { x: 27, y: 24, roomName: "W1N1" } as RoomPosition, // TOP_RIGHT
        { x: 27, y: 25, roomName: "W1N1" } as RoomPosition // BOTTOM
      ];

      const serialized = serializePositions(originalPositions);
      expect(serialized).toBeDefined();

      const deserialized = deserializePath(serialized!);

      expect(deserialized).toHaveLength(4);
      expect(deserialized[0]).toEqual({ x: 25, y: 25, roomName: "W1N1" });
      expect(deserialized[1]).toEqual({ x: 26, y: 25, roomName: "W1N1" });
      expect(deserialized[2]).toEqual({ x: 27, y: 24, roomName: "W1N1" });
      expect(deserialized[3]).toEqual({ x: 27, y: 25, roomName: "W1N1" });
    });
  });
});
