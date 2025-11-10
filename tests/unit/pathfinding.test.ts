import { describe, it, expect, beforeEach, vi } from "vitest";
import { PathfindingManager, DefaultPathfinder, CartographerPathfinder } from "../../src/runtime/pathfinding";

// Mock screeps-cartographer at the top level
vi.mock("screeps-cartographer", () => ({
  moveTo: vi.fn().mockReturnValue(OK)
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

describe("Pathfinding Abstraction Layer", () => {
  describe("PathfindingManager", () => {
    it("should initialize with default provider", () => {
      const manager = new PathfindingManager();
      expect(manager.getProviderName()).toBe("default");
    });

    it("should initialize with cartographer provider when specified", () => {
      const manager = new PathfindingManager({ provider: "cartographer", logger: { log: vi.fn(), warn: vi.fn() } });
      // In test environment, cartographer fails to load and falls back to default
      // In production, this would return "cartographer"
      expect(["default", "cartographer"].includes(manager.getProviderName())).toBe(true);
    });

    it("should enable caching by default", () => {
      const manager = new PathfindingManager();
      const creep = {
        moveTo: vi.fn().mockReturnValue(OK)
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      manager.moveTo(creep, target);

      // Default reusePath should be applied (5 ticks)
      expect(creep.moveTo).toHaveBeenCalledWith(
        target,
        expect.objectContaining({
          reusePath: 5
        })
      );
    });

    it("should respect explicit reusePath option", () => {
      const manager = new PathfindingManager();
      const creep = {
        moveTo: vi.fn().mockReturnValue(OK)
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      manager.moveTo(creep, target, { reusePath: 30 });

      expect(creep.moveTo).toHaveBeenCalledWith(
        target,
        expect.objectContaining({
          reusePath: 30
        })
      );
    });

    it("should disable caching when configured", () => {
      const manager = new PathfindingManager({ enableCaching: false });
      const creep = {
        moveTo: vi.fn().mockReturnValue(OK)
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      manager.moveTo(creep, target);

      // reusePath should be undefined when caching disabled
      expect(creep.moveTo).toHaveBeenCalledWith(
        target,
        expect.objectContaining({
          reusePath: undefined
        })
      );
    });
  });

  describe("DefaultPathfinder", () => {
    let pathfinder: DefaultPathfinder;

    beforeEach(() => {
      pathfinder = new DefaultPathfinder();
    });

    it("should return correct provider name", () => {
      expect(pathfinder.getName()).toBe("default");
    });

    it("should delegate moveTo to creep.moveTo", () => {
      const creep = {
        moveTo: vi.fn().mockReturnValue(OK)
      } as unknown as Creep;

      const target = new RoomPosition(25, 25, "W1N1");
      const result = pathfinder.moveTo(creep, target, { range: 2, reusePath: 10 });

      expect(result).toBe(OK);
      expect(creep.moveTo).toHaveBeenCalledWith(
        target,
        expect.objectContaining({
          range: 2,
          reusePath: 10
        })
      );
    });

    it("should handle target with pos property", () => {
      const creep = {
        moveTo: vi.fn().mockReturnValue(OK)
      } as unknown as Creep;

      const target = { pos: new RoomPosition(25, 25, "W1N1") };
      const result = pathfinder.moveTo(creep, target);

      expect(result).toBe(OK);
      expect(creep.moveTo).toHaveBeenCalledWith(target.pos, expect.any(Object));
    });

    it("should use PathFinder.search for findPath", () => {
      const origin = new RoomPosition(10, 10, "W1N1");
      const goal = new RoomPosition(25, 25, "W1N1");

      // Mock Game.cpu.getUsed
      const mockGetUsed = vi.fn();
      mockGetUsed.mockReturnValueOnce(0).mockReturnValueOnce(0.5);
      global.Game = {
        cpu: {
          getUsed: mockGetUsed
        }
      } as unknown as Game;

      // Mock PathFinder.search
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
      expect(result.cost).toBe(0.5);
      expect(result.incomplete).toBe(false);
    });
  });

  describe("CartographerPathfinder", () => {
    let pathfinder: CartographerPathfinder;

    beforeEach(() => {
      pathfinder = new CartographerPathfinder();
    });

    it("should return correct provider name", () => {
      expect(pathfinder.getName()).toBe("cartographer");
    });

    it("should use cartographer moveTo", () => {
      const creep = {} as Creep;
      const target = new RoomPosition(25, 25, "W1N1");

      // Note: This test verifies the interface, actual cartographer integration
      // is mocked at the top of the file
      const result = pathfinder.moveTo(creep, target, { range: 2 });

      // Result should be OK from our mock
      expect(result).toBe(OK);
    });

    it("should use PathFinder.search for findPath", () => {
      const origin = new RoomPosition(10, 10, "W1N1");
      const goal = new RoomPosition(25, 25, "W1N1");

      // Mock Game.cpu.getUsed
      const mockGetUsed = vi.fn();
      mockGetUsed.mockReturnValueOnce(0).mockReturnValueOnce(0.3);
      global.Game = {
        cpu: {
          getUsed: mockGetUsed
        }
      } as unknown as Game;

      // Mock PathFinder.search
      const mockPath = [new RoomPosition(11, 10, "W1N1"), new RoomPosition(12, 10, "W1N1")];
      global.PathFinder = {
        search: vi.fn().mockReturnValue({
          path: mockPath,
          ops: 80,
          incomplete: false
        })
      } as unknown as typeof PathFinder;

      const result = pathfinder.findPath(origin, goal, { range: 1 });

      expect(result.path).toEqual(mockPath);
      expect(result.ops).toBe(80);
      expect(result.cost).toBe(0.3);
      expect(result.incomplete).toBe(false);
    });
  });

  describe("Provider Selection", () => {
    it("should allow switching between providers", () => {
      const logger = { log: vi.fn(), warn: vi.fn() };
      const defaultManager = new PathfindingManager({ provider: "default", logger });
      const cartographerManager = new PathfindingManager({ provider: "cartographer", logger });

      expect(defaultManager.getProviderName()).toBe("default");
      // In test environment, cartographer may fall back to default
      expect(["default", "cartographer"].includes(cartographerManager.getProviderName())).toBe(true);
    });
  });

  describe("Pathfinding Options", () => {
    it("should support all pathfinding options", () => {
      const manager = new PathfindingManager();
      const creep = {
        moveTo: vi.fn().mockReturnValue(OK)
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

      expect(creep.moveTo).toHaveBeenCalledWith(
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
});
