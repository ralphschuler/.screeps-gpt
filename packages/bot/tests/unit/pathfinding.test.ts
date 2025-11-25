import { describe, it, expect, beforeEach, vi } from "vitest";
import { PathfindingManager, NesCafePathfinder, PathCache } from "../../src/runtime/pathfinding";

// Mock screeps-pathfinding at the top level
// The library returns a PathingManager instance as default export
const mockPathingManager = {
  moveTo: vi.fn().mockReturnValue(OK),
  moveOffRoad: vi.fn().mockReturnValue(false),
  findPath: vi.fn().mockReturnValue({
    path: [],
    ops: 100,
    cost: 0.5,
    incomplete: false
  }),
  runMoves: vi.fn(),
  runMovesRoom: vi.fn(),
  reservePos: vi.fn().mockReturnValue(OK),
  clearMatrixCache: vi.fn(),
  clearMatrixCacheRoom: vi.fn(),
  getMoveDirection: vi.fn().mockReturnValue(undefined),
  getCreepPath: vi.fn().mockReturnValue(undefined)
};

vi.mock("screeps-pathfinding", () => mockPathingManager);

// Mock pathing.utils
vi.mock("screeps-pathfinding/pathing.utils", () => ({
  isPosExit: vi.fn().mockImplementation((pos: { x: number; y: number }) => {
    return pos.x <= 0 || pos.y <= 0 || pos.x >= 49 || pos.y >= 49;
  }),
  isPosEqual: vi.fn().mockReturnValue(false),
  getRange: vi.fn().mockReturnValue(0),
  lookInRange: vi.fn().mockReturnValue([])
}));

// Mock RoomPosition for tests
class MockRoomPosition {
  public constructor(
    public x: number,
    public y: number,
    public roomName: string
  ) {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).RoomPosition = MockRoomPosition;

describe("Pathfinding with screeps-pathfinding (NesCafe)", () => {
  describe("PathfindingManager", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should initialize with nescafe provider", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });
      expect(manager.getProviderName()).toBe("nescafe");
    });

    it("should enable caching by default", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });
      const creep = {
        moveTo: vi.fn().mockReturnValue(OK),
        memory: {}
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      manager.moveTo(creep, target);

      // Default reusePath should be applied (5 ticks)
      expect(mockPathingManager.moveTo).toHaveBeenCalled();
    });

    it("should respect explicit reusePath option", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });
      const creep = {
        moveTo: vi.fn().mockReturnValue(OK),
        memory: {}
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      manager.moveTo(creep, target, { reusePath: 30 });

      expect(mockPathingManager.moveTo).toHaveBeenCalled();
    });

    it("should support priority option for traffic management", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });
      const creep = {
        moveTo: vi.fn().mockReturnValue(OK),
        memory: {}
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      manager.moveTo(creep, target, { priority: 5 });

      expect(mockPathingManager.moveTo).toHaveBeenCalledWith(
        creep,
        target,
        expect.objectContaining({
          priority: 5
        })
      );
    });

    it("should call runMoves to execute traffic management", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });

      manager.runMoves();

      expect(mockPathingManager.runMoves).toHaveBeenCalled();
    });

    it("should call runMovesRoom for room-specific traffic management", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });

      manager.runMovesRoom("W1N1");

      expect(mockPathingManager.runMovesRoom).toHaveBeenCalledWith("W1N1");
    });

    it("should support moveOffRoad behavior", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });
      const creep = {
        memory: {}
      } as unknown as Creep;

      manager.moveOffRoad(creep);

      expect(mockPathingManager.moveOffRoad).toHaveBeenCalled();
    });

    it("should support reservePos for position reservations", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });
      const pos = new RoomPosition(25, 25, "W1N1");

      manager.reservePos(pos, 10);

      expect(mockPathingManager.reservePos).toHaveBeenCalledWith(pos, 10);
    });

    it("should disable caching when configured", () => {
      const manager = new PathfindingManager({ enableCaching: false, logger: { log: vi.fn(), warn: vi.fn() } });
      const creep = {
        moveTo: vi.fn().mockReturnValue(OK),
        memory: {}
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      manager.moveTo(creep, target);

      expect(mockPathingManager.moveTo).toHaveBeenCalledWith(
        creep,
        target,
        expect.objectContaining({
          reusePath: undefined
        })
      );
    });

    it("should clear matrix cache", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });

      manager.clearMatrixCache();

      expect(mockPathingManager.clearMatrixCache).toHaveBeenCalled();
    });

    it("should clear matrix cache for specific room", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });

      manager.clearMatrixCacheRoom("W1N1");

      expect(mockPathingManager.clearMatrixCacheRoom).toHaveBeenCalledWith("W1N1");
    });
  });

  describe("NesCafePathfinder", () => {
    let pathfinder: NesCafePathfinder;

    beforeEach(() => {
      vi.clearAllMocks();
      pathfinder = new NesCafePathfinder(new PathCache());
    });

    it("should return correct provider name", () => {
      expect(pathfinder.getName()).toBe("nescafe");
    });

    it("should delegate moveTo to screeps-pathfinding", () => {
      const creep = {
        moveTo: vi.fn().mockReturnValue(OK),
        memory: {}
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      pathfinder.moveTo(creep, target, { range: 2 });

      expect(mockPathingManager.moveTo).toHaveBeenCalled();
    });

    it("should handle target with pos property", () => {
      const creep = {
        moveTo: vi.fn().mockReturnValue(OK),
        memory: {}
      } as unknown as Creep;

      const target = { pos: new RoomPosition(25, 25, "W1N1") };
      pathfinder.moveTo(creep, target);

      expect(mockPathingManager.moveTo).toHaveBeenCalled();
    });

    it("should use screeps-pathfinding for findPath", () => {
      const origin = new RoomPosition(10, 10, "W1N1");
      const goal = new RoomPosition(25, 25, "W1N1");

      // Mock Game.cpu.getUsed and Game.time
      const mockGetUsed = vi.fn();
      mockGetUsed.mockReturnValueOnce(0).mockReturnValueOnce(0.5);
      global.Game = {
        time: 1000,
        cpu: {
          getUsed: mockGetUsed
        }
      } as unknown as Game;

      const result = pathfinder.findPath(origin, goal, { range: 1 });

      expect(mockPathingManager.findPath).toHaveBeenCalled();
      expect(result.ops).toBe(100);
      expect(result.incomplete).toBe(false);
    });

    it("should support priority option", () => {
      const creep = {
        memory: {}
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      pathfinder.moveTo(creep, target, { priority: 10, range: 1 });

      expect(mockPathingManager.moveTo).toHaveBeenCalledWith(
        creep,
        target,
        expect.objectContaining({
          priority: 10,
          range: 1
        })
      );
    });

    it("should support moveOffExit option", () => {
      const creep = {
        memory: {}
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      pathfinder.moveTo(creep, target, { moveOffExit: true, range: 1 });

      expect(mockPathingManager.moveTo).toHaveBeenCalledWith(
        creep,
        target,
        expect.objectContaining({
          moveOffExit: true
        })
      );
    });

    it("should support avoidRooms option", () => {
      const creep = {
        memory: {}
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      pathfinder.moveTo(creep, target, { avoidRooms: ["W2N2"], range: 1 });

      expect(mockPathingManager.moveTo).toHaveBeenCalledWith(
        creep,
        target,
        expect.objectContaining({
          avoidRooms: ["W2N2"]
        })
      );
    });
  });

  describe("Pathfinding Options", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should support all pathfinding options", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });
      const creep = {
        moveTo: vi.fn().mockReturnValue(OK),
        memory: {}
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      const costCallback = vi.fn();

      manager.moveTo(creep, target, {
        range: 3,
        reusePath: 20,
        ignoreCreeps: true,
        maxRooms: 8,
        maxOps: 4000,
        costCallback,
        plainCost: 2,
        swampCost: 10,
        priority: 5,
        moveOffExit: true
      });

      expect(mockPathingManager.moveTo).toHaveBeenCalledWith(
        creep,
        target,
        expect.objectContaining({
          range: 3,
          reusePath: 20,
          maxRooms: 8,
          maxOps: 4000,
          costCallback,
          plainCost: 2,
          swampCost: 10,
          priority: 5,
          moveOffExit: true
        })
      );
    });

    it("should support screeps-pathfinding specific options", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });
      const creep = {
        moveTo: vi.fn().mockReturnValue(OK),
        memory: {}
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");

      manager.moveTo(creep, target, {
        range: 1,
        priority: 5,
        moveOffExit: true,
        moveOffRoad: false,
        findRoute: true,
        ignoreRoads: false,
        offRoads: false,
        containerCost: 5,
        heuristicWeight: 1.2,
        fixPath: true,
        allowIncomplete: true,
        avoidRooms: ["W2N2", "W3N3"]
      });

      expect(mockPathingManager.moveTo).toHaveBeenCalledWith(
        creep,
        target,
        expect.objectContaining({
          priority: 5,
          moveOffExit: true,
          findRoute: true,
          containerCost: 5,
          heuristicWeight: 1.2,
          fixPath: true,
          allowIncomplete: true,
          avoidRooms: ["W2N2", "W3N3"]
        })
      );
    });
  });

  describe("Traffic Management", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should schedule moves with priority", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });

      const highPriorityCreep = { memory: {} } as unknown as Creep;
      const lowPriorityCreep = { memory: {} } as unknown as Creep;
      const target = new RoomPosition(25, 25, "W1N1");

      // Schedule moves with different priorities
      manager.moveTo(highPriorityCreep, target, { priority: 10, range: 1 });
      manager.moveTo(lowPriorityCreep, target, { priority: 1, range: 1 });

      // Execute moves (higher priority should move first)
      manager.runMoves();

      expect(mockPathingManager.moveTo).toHaveBeenCalledTimes(2);
      expect(mockPathingManager.runMoves).toHaveBeenCalled();
    });
  });
});
