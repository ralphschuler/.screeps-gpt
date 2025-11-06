import { describe, expect, it, vi, beforeEach } from "vitest";
import { RoadPlanner } from "@runtime/infrastructure/RoadPlanner";
import type { GameContext, RoomLike } from "@runtime/types/GameContext";

describe("RoadPlanner", () => {
  let roadPlanner: RoadPlanner;
  let mockGame: GameContext;

  beforeEach(() => {
    roadPlanner = new RoadPlanner({ log: vi.fn(), warn: vi.fn() });
    mockGame = {
      time: 1000,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: {},
      spawns: {},
      rooms: {}
    };
  });

  describe("Road planning between positions", () => {
    it("should plan roads along a path", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        findPath: vi.fn(() => [
          { x: 10, y: 10, dx: 1, dy: 0, direction: 2 },
          { x: 11, y: 10, dx: 1, dy: 0, direction: 2 },
          { x: 12, y: 10, dx: 0, dy: 1, direction: 4 },
          { x: 12, y: 11, dx: 0, dy: 0, direction: 0 }
        ])
      };

      const from = { x: 10, y: 10 } as RoomPosition;
      const to = { x: 12, y: 11 } as RoomPosition;

      const plans = roadPlanner.planRoadsBetween(mockRoom, from, to, mockGame);

      expect(plans).toHaveLength(4);
      expect(plans[0]).toEqual({ pos: { x: 10, y: 10 }, roomName: "W0N0" });
      expect(plans[3]).toEqual({ pos: { x: 12, y: 11 }, roomName: "W0N0" });
    });
  });

  describe("Source road planning", () => {
    it("should plan roads from sources to spawn", () => {
      const spawn: StructureSpawn = {
        id: "spawn1" as Id<StructureSpawn>,
        structureType: STRUCTURE_SPAWN,
        pos: { x: 25, y: 25 } as RoomPosition
      } as StructureSpawn;

      const source: Source = {
        id: "source1" as Id<Source>,
        pos: { x: 10, y: 10 } as RoomPosition
      } as Source;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) {
            return [spawn];
          }
          if (type === FIND_SOURCES) {
            return [source];
          }
          return [];
        },
        findPath: vi.fn(() => [
          { x: 10, y: 10, dx: 1, dy: 0, direction: 2 },
          { x: 11, y: 11, dx: 1, dy: 1, direction: 3 }
        ])
      };

      const plans = roadPlanner.planSourceRoads(mockRoom, mockGame);

      expect(plans.length).toBeGreaterThan(0);
      expect(mockRoom.findPath).toHaveBeenCalled();
    });

    it("should return empty array when no spawns exist", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        find: () => []
      };

      const plans = roadPlanner.planSourceRoads(mockRoom, mockGame);

      expect(plans).toEqual([]);
    });
  });

  describe("Controller road planning", () => {
    it("should plan roads from sources to controller", () => {
      const controller: StructureController = {
        id: "controller1" as Id<StructureController>,
        pos: { x: 30, y: 30 } as RoomPosition,
        level: 2,
        progress: 100,
        progressTotal: 1000
      } as StructureController;

      const source: Source = {
        id: "source1" as Id<Source>,
        pos: { x: 10, y: 10 } as RoomPosition
      } as Source;

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller,
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [source];
          }
          return [];
        },
        findPath: vi.fn(() => [
          { x: 10, y: 10, dx: 1, dy: 1, direction: 3 },
          { x: 11, y: 11, dx: 1, dy: 1, direction: 3 }
        ])
      };

      const plans = roadPlanner.planControllerRoads(mockRoom, mockGame);

      expect(plans.length).toBeGreaterThan(0);
      expect(mockRoom.findPath).toHaveBeenCalled();
    });

    it("should return empty array when no controller exists", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: null,
        find: () => []
      };

      const plans = roadPlanner.planControllerRoads(mockRoom, mockGame);

      expect(plans).toEqual([]);
    });
  });

  describe("Construction site creation", () => {
    it("should create road construction sites", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        find: () => [],
        createConstructionSite: vi.fn(() => OK),
        getTerrain: vi.fn(() => ({
          get: () => 0 // Not a wall
        })) as () => RoomTerrain
      };

      const terrain = mockRoom.getTerrain();

      const plans = [
        { pos: { x: 10, y: 10 }, roomName: "W0N0" },
        { pos: { x: 11, y: 11 }, roomName: "W0N0" }
      ];

      const result = roadPlanner.createRoadSites(mockRoom, plans, terrain);

      expect(result.created).toBe(1); // Limited to 1 per tick by default
      expect(result.failed).toBe(0);
      expect(mockRoom.createConstructionSite).toHaveBeenCalledWith(10, 10, STRUCTURE_ROAD);
    });

    it("should skip walls when creating road sites", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        find: () => [],
        createConstructionSite: vi.fn(() => OK),
        getTerrain: vi.fn(() => ({
          get: (x: number) => (x === 10 ? TERRAIN_MASK_WALL : 0)
        })) as () => RoomTerrain
      };

      const terrain = mockRoom.getTerrain();

      const plans = [
        { pos: { x: 10, y: 10 }, roomName: "W0N0" }, // Wall
        { pos: { x: 11, y: 11 }, roomName: "W0N0" } // Not a wall
      ];

      const result = roadPlanner.createRoadSites(mockRoom, plans, terrain);

      expect(result.created).toBe(1);
      expect(mockRoom.createConstructionSite).toHaveBeenCalledWith(11, 11, STRUCTURE_ROAD);
      expect(mockRoom.createConstructionSite).not.toHaveBeenCalledWith(10, 10, STRUCTURE_ROAD);
    });

    it("should skip positions with existing roads", () => {
      const existingRoad: Structure = {
        id: "road1" as Id<Structure>,
        structureType: STRUCTURE_ROAD,
        pos: { x: 10, y: 10 } as RoomPosition
      } as Structure;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant) => {
          if (type === FIND_STRUCTURES) {
            return [existingRoad];
          }
          if (type === FIND_CONSTRUCTION_SITES) {
            return [];
          }
          return [];
        },
        createConstructionSite: vi.fn(() => OK),
        getTerrain: vi.fn(() => ({
          get: () => 0
        })) as () => RoomTerrain
      };

      const terrain = mockRoom.getTerrain();

      const plans = [
        { pos: { x: 10, y: 10 }, roomName: "W0N0" },
        { pos: { x: 11, y: 11 }, roomName: "W0N0" }
      ];

      const result = roadPlanner.createRoadSites(mockRoom, plans, terrain);

      expect(result.created).toBe(1);
      expect(mockRoom.createConstructionSite).toHaveBeenCalledWith(11, 11, STRUCTURE_ROAD);
      expect(mockRoom.createConstructionSite).not.toHaveBeenCalledWith(10, 10, STRUCTURE_ROAD);
    });
  });

  describe("Auto road placement", () => {
    it("should automatically plan and place roads", () => {
      const spawn: StructureSpawn = {
        id: "spawn1" as Id<StructureSpawn>,
        structureType: STRUCTURE_SPAWN,
        pos: { x: 25, y: 25 } as RoomPosition
      } as StructureSpawn;

      const source: Source = {
        id: "source1" as Id<Source>,
        pos: { x: 10, y: 10 } as RoomPosition
      } as Source;

      const controller: StructureController = {
        id: "controller1" as Id<StructureController>,
        pos: { x: 30, y: 30 } as RoomPosition,
        level: 2,
        progress: 100,
        progressTotal: 1000
      } as StructureController;

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller,
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) {
            return [spawn];
          }
          if (type === FIND_SOURCES) {
            return [source];
          }
          if (type === FIND_STRUCTURES) {
            return [];
          }
          if (type === FIND_CONSTRUCTION_SITES) {
            return [];
          }
          return [];
        },
        findPath: vi.fn(() => [
          { x: 10, y: 10, dx: 1, dy: 0, direction: 2 },
          { x: 11, y: 10, dx: 1, dy: 0, direction: 2 }
        ]),
        createConstructionSite: vi.fn(() => OK),
        getTerrain: vi.fn(() => ({
          get: () => 0
        })) as () => RoomTerrain
      };

      const result = roadPlanner.autoPlaceRoads(mockRoom, mockGame);

      expect(result.created).toBeGreaterThan(0);
      expect(mockRoom.createConstructionSite).toHaveBeenCalled();
    });

    it("should deduplicate overlapping road plans", () => {
      const spawn: StructureSpawn = {
        id: "spawn1" as Id<StructureSpawn>,
        structureType: STRUCTURE_SPAWN,
        pos: { x: 15, y: 15 } as RoomPosition
      } as StructureSpawn;

      const source: Source = {
        id: "source1" as Id<Source>,
        pos: { x: 10, y: 10 } as RoomPosition
      } as Source;

      const controller: StructureController = {
        id: "controller1" as Id<StructureController>,
        pos: { x: 20, y: 20 } as RoomPosition,
        level: 2,
        progress: 100,
        progressTotal: 1000
      } as StructureController;

      // Path from source to spawn and source to controller will overlap
      const sharedPath = [
        { x: 10, y: 10, dx: 1, dy: 1, direction: 3 },
        { x: 11, y: 11, dx: 1, dy: 1, direction: 3 },
        { x: 12, y: 12, dx: 1, dy: 1, direction: 3 }
      ];

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller,
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) {
            return [spawn];
          }
          if (type === FIND_SOURCES) {
            return [source];
          }
          if (type === FIND_STRUCTURES) {
            return [];
          }
          if (type === FIND_CONSTRUCTION_SITES) {
            return [];
          }
          return [];
        },
        findPath: vi.fn(() => sharedPath),
        createConstructionSite: vi.fn(() => OK),
        getTerrain: vi.fn(() => ({
          get: () => 0
        })) as () => RoomTerrain
      };

      roadPlanner.autoPlaceRoads(mockRoom, mockGame);

      // Should only create each position once despite being in both paths
      const calls = (mockRoom.createConstructionSite as ReturnType<typeof vi.fn>).mock.calls;
      const uniquePositions = new Set(calls.map(call => `${call[0]},${call[1]}`));

      expect(uniquePositions.size).toBe(calls.length);
    });
  });
});
