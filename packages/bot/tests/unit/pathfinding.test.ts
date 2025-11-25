import { describe, it, expect, beforeEach, vi } from "vitest";
import { PathfindingManager, NesCafePathfinder, PathCache } from "../../src/runtime/pathfinding";

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

// Add missing Screeps global constants for tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).ERR_NOT_FOUND = -5;

/**
 * Tests for the NesCafe pathfinding integration
 *
 * Note: In the test environment, screeps-pathfinding is not available,
 * so the NesCafePathfinder falls back to native creep.moveTo and PathFinder.
 * These tests verify:
 * 1. The PathfindingManager correctly uses the NesCafePathfinder
 * 2. The fallback behavior works correctly when screeps-pathfinding is unavailable
 * 3. The interface contracts are maintained
 */
describe("Pathfinding with screeps-pathfinding (NesCafe)", () => {
  describe("PathfindingManager", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should initialize with nescafe provider", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });
      expect(manager.getProviderName()).toBe("nescafe");
    });

    it("should fallback to native moveTo when screeps-pathfinding is unavailable", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });
      const mockMoveTo = vi.fn().mockReturnValue(OK);
      const creep = {
        moveTo: mockMoveTo,
        memory: {}
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      const result = manager.moveTo(creep, target);

      // Should fallback to native moveTo and return OK
      expect(mockMoveTo).toHaveBeenCalled();
      expect(result).toBe(OK);
    });

    it("should apply default reusePath option when caching is enabled", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });
      const mockMoveTo = vi.fn().mockReturnValue(OK);
      const creep = {
        moveTo: mockMoveTo,
        memory: {}
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      manager.moveTo(creep, target);

      // Default reusePath should be applied (5 ticks) in fallback mode
      expect(mockMoveTo).toHaveBeenCalledWith(
        target,
        expect.objectContaining({
          reusePath: 5
        })
      );
    });

    it("should respect explicit reusePath option", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });
      const mockMoveTo = vi.fn().mockReturnValue(OK);
      const creep = {
        moveTo: mockMoveTo,
        memory: {}
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      manager.moveTo(creep, target, { reusePath: 30 });

      expect(mockMoveTo).toHaveBeenCalledWith(
        target,
        expect.objectContaining({
          reusePath: 30
        })
      );
    });

    it("should not apply reusePath when caching is disabled", () => {
      const manager = new PathfindingManager({ enableCaching: false, logger: { log: vi.fn(), warn: vi.fn() } });
      const mockMoveTo = vi.fn().mockReturnValue(OK);
      const creep = {
        moveTo: mockMoveTo,
        memory: {}
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      manager.moveTo(creep, target);

      expect(mockMoveTo).toHaveBeenCalledWith(
        target,
        expect.objectContaining({
          reusePath: undefined
        })
      );
    });

    it("should call runMoves without error", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });

      // Should not throw even when screeps-pathfinding is unavailable
      expect(() => manager.runMoves()).not.toThrow();
    });

    it("should call runMovesRoom without error", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });

      // Should not throw even when screeps-pathfinding is unavailable
      expect(() => manager.runMovesRoom("W1N1")).not.toThrow();
    });

    it("should return false from moveOffRoad when library is unavailable", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });
      const creep = {
        memory: {}
      } as unknown as Creep;

      // Should return false when screeps-pathfinding is unavailable
      const result = manager.moveOffRoad(creep);
      expect(result).toBe(false);
    });

    it("should return ERR_NOT_FOUND from reservePos when library is unavailable", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });
      const pos = new RoomPosition(25, 25, "W1N1");

      // Should return error when screeps-pathfinding is unavailable
      const result = manager.reservePos(pos, 10);
      expect(result).toBe(ERR_NOT_FOUND);
    });

    it("should provide isPosExit fallback implementation", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });

      // Test corner/edge positions
      expect(manager.isPosExit({ x: 0, y: 25 })).toBe(true);
      expect(manager.isPosExit({ x: 49, y: 25 })).toBe(true);
      expect(manager.isPosExit({ x: 25, y: 0 })).toBe(true);
      expect(manager.isPosExit({ x: 25, y: 49 })).toBe(true);

      // Test interior positions
      expect(manager.isPosExit({ x: 25, y: 25 })).toBe(false);
      expect(manager.isPosExit({ x: 1, y: 1 })).toBe(false);
      expect(manager.isPosExit({ x: 48, y: 48 })).toBe(false);
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

    it("should fallback to native moveTo when library is unavailable", () => {
      const mockMoveTo = vi.fn().mockReturnValue(OK);
      const creep = {
        moveTo: mockMoveTo,
        memory: {}
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      const result = pathfinder.moveTo(creep, target, { range: 2 });

      expect(mockMoveTo).toHaveBeenCalled();
      expect(result).toBe(OK);
    });

    it("should handle target with pos property", () => {
      const mockMoveTo = vi.fn().mockReturnValue(OK);
      const creep = {
        moveTo: mockMoveTo,
        memory: {}
      } as unknown as Creep;

      const target = { pos: new RoomPosition(25, 25, "W1N1") };
      const result = pathfinder.moveTo(creep, target);

      expect(mockMoveTo).toHaveBeenCalledWith(target.pos, expect.any(Object));
      expect(result).toBe(OK);
    });

    it("should use PathFinder.search for findPath fallback", () => {
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

      // Mock PathFinder.search for fallback
      const mockPath = [new RoomPosition(11, 10, "W1N1"), new RoomPosition(12, 10, "W1N1")];
      global.PathFinder = {
        search: vi.fn().mockReturnValue({
          path: mockPath,
          ops: 100,
          incomplete: false
        })
      } as unknown as typeof PathFinder;

      const result = pathfinder.findPath(origin, goal, { range: 1 });

      expect(result.path).toEqual(mockPath);
      expect(result.ops).toBe(100);
      expect(result.incomplete).toBe(false);
    });

    it("should report library as unavailable in test environment", () => {
      // In test environment, screeps-pathfinding is not available
      expect(pathfinder.isAvailable()).toBe(false);
    });
  });

  describe("Pathfinding Options", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should pass basic pathfinding options to native moveTo", () => {
      const manager = new PathfindingManager({ logger: { log: vi.fn(), warn: vi.fn() } });
      const mockMoveTo = vi.fn().mockReturnValue(OK);
      const creep = {
        moveTo: mockMoveTo,
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
        swampCost: 10
      });

      // In fallback mode, only basic options are passed
      expect(mockMoveTo).toHaveBeenCalledWith(
        target,
        expect.objectContaining({
          range: 3,
          reusePath: 20,
          ignoreCreeps: true,
          maxRooms: 8,
          maxOps: 4000,
          costCallback,
          plainCost: 2,
          swampCost: 10
        })
      );
    });
  });

  describe("Cache Integration", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should provide cache metrics when caching is enabled", () => {
      const manager = new PathfindingManager({ enableCaching: true, logger: { log: vi.fn(), warn: vi.fn() } });
      const metrics = manager.getCacheMetrics();
      expect(metrics).not.toBeNull();
    });

    it("should not provide cache metrics when caching is disabled", () => {
      const manager = new PathfindingManager({ enableCaching: false, logger: { log: vi.fn(), warn: vi.fn() } });
      const metrics = manager.getCacheMetrics();
      expect(metrics).toBeNull();
    });

    it("should invalidate room cache without error", () => {
      const manager = new PathfindingManager({ enableCaching: true, logger: { log: vi.fn(), warn: vi.fn() } });
      expect(() => manager.invalidateRoom("W1N1")).not.toThrow();
    });

    it("should invalidate structures cache without error", () => {
      const manager = new PathfindingManager({ enableCaching: true, logger: { log: vi.fn(), warn: vi.fn() } });
      expect(() => manager.invalidateStructures("W1N1")).not.toThrow();
    });

    it("should clear all caches without error", () => {
      const manager = new PathfindingManager({ enableCaching: true, logger: { log: vi.fn(), warn: vi.fn() } });
      expect(() => manager.clearCache()).not.toThrow();
    });
  });
});
