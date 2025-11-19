import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupPathOptimization, getOriginalFindPath } from "../src/PathCache";

// Mock Screeps globals
const mockGame = {
  time: 0
};

const mockMemory = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pathOptimizer: undefined as any,
  screepsPerf: undefined as { lastMemoryCleanUp: number } | undefined,
  creeps: {} as Record<string, unknown>
};

const mockPathSteps: PathStep[] = [{ x: 1, y: 1, dx: 0, dy: 1, direction: 5 }];

const mockRoom = {
  _cleanedUp: false,
  findPath: vi.fn().mockReturnValue(mockPathSteps)
} as unknown as Room;

// Setup global mocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Game = mockGame;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Memory = mockMemory;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Room = {
  prototype: {
    findPath: mockRoom.findPath
  },
  serializePath: vi.fn((_path: PathStep[]) => "serialized"),
  deserializePath: vi.fn((_str: string) => mockPathSteps)
};

describe("PathCache", () => {
  beforeEach(() => {
    // Reset mocks
    mockGame.time = 0;
    mockMemory.pathOptimizer = undefined;
    mockMemory.screepsPerf = undefined;
    mockMemory.creeps = {};
    mockRoom._cleanedUp = false;
    vi.clearAllMocks();

    // Reset Room.prototype.findPath
    Room.prototype.findPath = mockRoom.findPath;
  });

  describe("setupPathOptimization", () => {
    it("should return the original findPath function", () => {
      const originalFindPath = Room.prototype.findPath;
      const returned = setupPathOptimization();

      expect(returned).toBe(originalFindPath);
    });

    it("should replace Room.prototype.findPath", () => {
      const beforeFindPath = Room.prototype.findPath;
      setupPathOptimization();
      const afterFindPath = Room.prototype.findPath;

      expect(afterFindPath).not.toBe(beforeFindPath);
    });
  });

  describe("getOriginalFindPath", () => {
    it("should return the stored original findPath", () => {
      const originalFindPath = Room.prototype.findPath;
      setupPathOptimization();

      const retrieved = getOriginalFindPath();
      expect(retrieved).toBe(originalFindPath);
    });
  });

  describe("optimized findPath", () => {
    beforeEach(() => {
      setupPathOptimization();
    });

    it("should initialize pathOptimizer memory on first use", () => {
      const room = Object.create(Room.prototype) as Room;
      const fromPos = { roomName: "W1N1", x: 10, y: 10 } as RoomPosition;
      const toPos = { roomName: "W1N1", x: 20, y: 20 } as RoomPosition;

      room.findPath.call(room, fromPos, toPos);

      expect(Memory.pathOptimizer).toBeDefined();
      expect(Memory.pathOptimizer?.lastCleaned).toBe(0);
    });

    it("should cache path on first call", () => {
      const room = Object.create(Room.prototype) as Room;
      const fromPos = { roomName: "W1N1", x: 10, y: 10 } as RoomPosition;
      const toPos = { roomName: "W1N1", x: 20, y: 20 } as RoomPosition;

      room.findPath.call(room, fromPos, toPos);

      const pathKey = "W1N1x10y10W1N1x20y20";
      expect(Memory.pathOptimizer?.[pathKey]).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((Memory.pathOptimizer?.[pathKey] as any).tick).toBe(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((Memory.pathOptimizer?.[pathKey] as any).used).toBe(1);
    });

    it("should reuse cached path on subsequent calls", () => {
      const room = Object.create(Room.prototype) as Room;
      const fromPos = { roomName: "W1N1", x: 10, y: 10 } as RoomPosition;
      const toPos = { roomName: "W1N1", x: 20, y: 20 } as RoomPosition;

      // First call
      room.findPath.call(room, fromPos, toPos);
      const firstCallCount = mockRoom.findPath.mock.calls.length;

      // Second call
      room.findPath.call(room, fromPos, toPos);
      const secondCallCount = mockRoom.findPath.mock.calls.length;

      // Original findPath should only be called once
      expect(secondCallCount).toBe(firstCallCount);

      // Usage counter should increment
      const pathKey = "W1N1x10y10W1N1x20y20";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((Memory.pathOptimizer?.[pathKey] as any).used).toBe(2);
    });

    it("should create different cache entries for different paths", () => {
      const room = Object.create(Room.prototype) as Room;
      const fromPos1 = { roomName: "W1N1", x: 10, y: 10 } as RoomPosition;
      const toPos1 = { roomName: "W1N1", x: 20, y: 20 } as RoomPosition;
      const fromPos2 = { roomName: "W1N1", x: 15, y: 15 } as RoomPosition;
      const toPos2 = { roomName: "W1N1", x: 25, y: 25 } as RoomPosition;

      room.findPath.call(room, fromPos1, toPos1);
      room.findPath.call(room, fromPos2, toPos2);

      const pathKey1 = "W1N1x10y10W1N1x20y20";
      const pathKey2 = "W1N1x15y15W1N1x25y25";

      expect(Memory.pathOptimizer?.[pathKey1]).toBeDefined();
      expect(Memory.pathOptimizer?.[pathKey2]).toBeDefined();
    });

    it("should clean up old paths after 40 ticks", () => {
      const room = Object.create(Room.prototype) as Room;
      const fromPos = { roomName: "W1N1", x: 10, y: 10 } as RoomPosition;
      const toPos = { roomName: "W1N1", x: 20, y: 20 } as RoomPosition;

      // Create a path
      Memory.pathOptimizer = {
        lastCleaned: 0,
        oldPath: { tick: 0, path: "old", used: 1 }
      };

      // Move time forward
      mockGame.time = 2100; // More than 2000 ticks old

      room.findPath.call(room, fromPos, toPos);

      // Old path should be cleaned up
      expect(Memory.pathOptimizer?.oldPath).toBeUndefined();
    });

    it("should clean up rarely used paths", () => {
      const room = Object.create(Room.prototype) as Room;
      const fromPos = { roomName: "W1N1", x: 10, y: 10 } as RoomPosition;
      const toPos = { roomName: "W1N1", x: 20, y: 20 } as RoomPosition;

      // Create a rarely used path
      Memory.pathOptimizer = {
        lastCleaned: 0,
        rarePath: { tick: 0, path: "rare", used: 1 }
      };

      // Move time forward (used only once in 500 ticks = 1/500 < 1/300)
      mockGame.time = 500;

      room.findPath.call(room, fromPos, toPos);

      // Rarely used path should be cleaned up
      expect(Memory.pathOptimizer?.rarePath).toBeUndefined();
    });
  });
});
