import { describe, expect, it, vi, beforeEach } from "vitest";
import { RoadPlanner } from "@runtime/infrastructure/RoadPlanner";
import { TrafficManager } from "@runtime/infrastructure/TrafficManager";
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

    // Mock RoomPosition constructor for tests that use TrafficManager
    (
      global as unknown as { RoomPosition?: new (x: number, y: number, roomName: string) => RoomPosition }
    ).RoomPosition = class RoomPosition {
      public x: number;
      public y: number;
      public roomName: string;

      public constructor(x: number, y: number, roomName: string) {
        this.x = x;
        this.y = y;
        this.roomName = roomName;
      }
    } as unknown as new (x: number, y: number, roomName: string) => RoomPosition;
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

  describe("Road maintenance", () => {
    it("should identify roads needing repair", () => {
      const road1: StructureRoad = {
        id: "road1" as Id<StructureRoad>,
        structureType: STRUCTURE_ROAD,
        pos: { x: 10, y: 10 } as RoomPosition,
        hits: 2000,
        hitsMax: 5000
      } as StructureRoad;

      const road2: StructureRoad = {
        id: "road2" as Id<StructureRoad>,
        structureType: STRUCTURE_ROAD,
        pos: { x: 11, y: 11 } as RoomPosition,
        hits: 4500,
        hitsMax: 5000
      } as StructureRoad;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant) => {
          if (type === FIND_STRUCTURES) {
            return [road1, road2];
          }
          return [];
        }
      };

      const damagedRoads = roadPlanner.identifyRepairNeeds(mockRoom, 0.8);

      expect(damagedRoads).toHaveLength(1);
      expect(damagedRoads[0].id).toBe("road1");
    });

    it("should use custom health threshold", () => {
      const road: StructureRoad = {
        id: "road1" as Id<StructureRoad>,
        structureType: STRUCTURE_ROAD,
        pos: { x: 10, y: 10 } as RoomPosition,
        hits: 3000,
        hitsMax: 5000
      } as StructureRoad;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: () => [road]
      };

      const damagedRoads = roadPlanner.identifyRepairNeeds(mockRoom, 0.5);

      expect(damagedRoads).toHaveLength(0); // 60% health is above 50% threshold
    });
  });

  describe("Traffic-based road prioritization", () => {
    it("should prioritize repairs by damage when no traffic manager", () => {
      const road1: StructureRoad = {
        id: "road1" as Id<StructureRoad>,
        structureType: STRUCTURE_ROAD,
        pos: { x: 10, y: 10 } as RoomPosition,
        hits: 2000,
        hitsMax: 5000
      } as StructureRoad;

      const road2: StructureRoad = {
        id: "road2" as Id<StructureRoad>,
        structureType: STRUCTURE_ROAD,
        pos: { x: 11, y: 11 } as RoomPosition,
        hits: 1000,
        hitsMax: 5000
      } as StructureRoad;

      const prioritized = roadPlanner.prioritizeRepairs([road1, road2]);

      expect(prioritized[0].id).toBe("road2"); // More damaged first
      expect(prioritized[1].id).toBe("road1");
    });

    it("should prioritize repairs by traffic when traffic manager available", () => {
      const trafficManager = new TrafficManager({ enableTrafficAnalysis: true });

      // Record more traffic at road1
      const pos1 = { roomName: "W0N0", x: 10, y: 10 } as RoomPosition;
      const pos2 = { roomName: "W0N0", x: 11, y: 11 } as RoomPosition;

      for (let i = 0; i < 50; i++) trafficManager.recordMovement(pos1);
      for (let i = 0; i < 10; i++) trafficManager.recordMovement(pos2);

      roadPlanner.setTrafficManager(trafficManager);

      const road1: StructureRoad = {
        id: "road1" as Id<StructureRoad>,
        structureType: STRUCTURE_ROAD,
        pos: pos1,
        hits: 2000,
        hitsMax: 5000
      } as StructureRoad;

      const road2: StructureRoad = {
        id: "road2" as Id<StructureRoad>,
        structureType: STRUCTURE_ROAD,
        pos: pos2,
        hits: 1000,
        hitsMax: 5000
      } as StructureRoad;

      const prioritized = roadPlanner.prioritizeRepairs([road1, road2]);

      expect(prioritized[0].id).toBe("road1"); // Higher traffic first despite less damage
      expect(prioritized[1].id).toBe("road2");
    });

    it("should plan roads from high-traffic areas", () => {
      const trafficManager = new TrafficManager({ enableTrafficAnalysis: true });

      const pos = { roomName: "W0N0", x: 25, y: 25 } as RoomPosition;
      for (let i = 0; i < 15; i++) trafficManager.recordMovement(pos);

      roadPlanner.setTrafficManager(trafficManager);

      const mockRoom: RoomLike = {
        name: "W0N0"
      };

      const plans = roadPlanner.planRoadsFromTraffic(mockRoom, 10);

      expect(plans).toHaveLength(1);
      expect(plans[0].pos.x).toBe(25);
      expect(plans[0].pos.y).toBe(25);
      expect(plans[0].priority).toBe(15);
    });

    it("should filter traffic plans by room", () => {
      const trafficManager = new TrafficManager({ enableTrafficAnalysis: true });

      const pos1 = { roomName: "W0N0", x: 25, y: 25 } as RoomPosition;
      const pos2 = { roomName: "W1N1", x: 25, y: 25 } as RoomPosition;

      for (let i = 0; i < 15; i++) trafficManager.recordMovement(pos1);
      for (let i = 0; i < 20; i++) trafficManager.recordMovement(pos2);

      roadPlanner.setTrafficManager(trafficManager);

      const mockRoom: RoomLike = {
        name: "W0N0"
      };

      const plans = roadPlanner.planRoadsFromTraffic(mockRoom, 10);

      expect(plans).toHaveLength(1);
      expect(plans[0].roomName).toBe("W0N0");
    });
  });

  describe("Priority-based construction", () => {
    it("should create road sites in priority order", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        find: () => [],
        createConstructionSite: vi.fn(() => OK),
        getTerrain: vi.fn(() => ({
          get: () => 0
        })) as () => RoomTerrain
      };

      const terrain = mockRoom.getTerrain();

      const plans = [
        { pos: { x: 10, y: 10 }, roomName: "W0N0", priority: 5 },
        { pos: { x: 11, y: 11 }, roomName: "W0N0", priority: 20 },
        { pos: { x: 12, y: 12 }, roomName: "W0N0", priority: 10 }
      ];

      roadPlanner.createRoadSites(mockRoom, plans, terrain);

      // Should create highest priority first
      expect(mockRoom.createConstructionSite).toHaveBeenCalledWith(11, 11, STRUCTURE_ROAD);
    });
  });

  describe("Cost-benefit analysis", () => {
    it("should calculate road value based on traffic and terrain", () => {
      const mockTerrain = {
        get: (x: number) => {
          // Position 10 is swamp, position 11 is plain
          return x === 10 ? TERRAIN_MASK_SWAMP : 0;
        }
      } as RoomTerrain;

      const swampPos = { roomName: "W0N0", x: 10, y: 10 } as RoomPosition;
      const plainPos = { roomName: "W0N0", x: 11, y: 11 } as RoomPosition;

      const trafficCount = 10;

      // Swamp: savings = 5 - 1 = 4, value = 10 * 4 = 40
      const swampValue = roadPlanner.calculateRoadValue(swampPos, trafficCount, mockTerrain);
      expect(swampValue).toBe(40);

      // Plain: savings = 1 - 1 = 0, value = 10 * 0 = 0
      const plainValue = roadPlanner.calculateRoadValue(plainPos, trafficCount, mockTerrain);
      expect(plainValue).toBe(0);
    });

    it("should return zero value for walls", () => {
      const mockTerrain = {
        get: () => TERRAIN_MASK_WALL
      } as RoomTerrain;

      const wallPos = { roomName: "W0N0", x: 10, y: 10 } as RoomPosition;
      const value = roadPlanner.calculateRoadValue(wallPos, 100, mockTerrain);

      expect(value).toBe(0);
    });

    it("should prioritize road construction by value", () => {
      const trafficManager = new TrafficManager({ enableTrafficAnalysis: true });

      // Record traffic: high on swamp, medium on plain
      const swampPos = { roomName: "W0N0", x: 10, y: 10 } as RoomPosition;
      const plainPos = { roomName: "W0N0", x: 11, y: 11 } as RoomPosition;

      for (let i = 0; i < 20; i++) trafficManager.recordMovement(swampPos);
      for (let i = 0; i < 50; i++) trafficManager.recordMovement(plainPos);

      roadPlanner.setTrafficManager(trafficManager);

      const mockRoom: RoomLike = {
        name: "W0N0",
        getTerrain: vi.fn(() => ({
          get: (x: number) => (x === 10 ? TERRAIN_MASK_SWAMP : 0)
        })) as () => RoomTerrain
      };

      const plans = roadPlanner.prioritizeRoadConstruction(mockRoom, 10);

      // Swamp with less traffic should be prioritized over plain with more traffic
      // Swamp: 20 * 4 = 80 value
      // Plain: 50 * 0 = 0 value
      expect(plans).toHaveLength(1);
      expect(plans[0].pos.x).toBe(10);
      expect(plans[0].priority).toBe(80);
    });

    it("should filter by minimum value threshold", () => {
      const trafficManager = new TrafficManager({ enableTrafficAnalysis: true });

      const pos = { roomName: "W0N0", x: 10, y: 10 } as RoomPosition;
      for (let i = 0; i < 5; i++) trafficManager.recordMovement(pos);

      roadPlanner.setTrafficManager(trafficManager);

      const mockRoom: RoomLike = {
        name: "W0N0",
        getTerrain: vi.fn(() => ({
          get: () => TERRAIN_MASK_SWAMP
        })) as () => RoomTerrain
      };

      // Value = 5 * 4 = 20
      const plansWithLowThreshold = roadPlanner.prioritizeRoadConstruction(mockRoom, 10);
      expect(plansWithLowThreshold).toHaveLength(1);

      const plansWithHighThreshold = roadPlanner.prioritizeRoadConstruction(mockRoom, 30);
      expect(plansWithHighThreshold).toHaveLength(0);
    });

    it("should sort plans by value descending", () => {
      const trafficManager = new TrafficManager({ enableTrafficAnalysis: true });

      const pos1 = { roomName: "W0N0", x: 10, y: 10 } as RoomPosition;
      const pos2 = { roomName: "W0N0", x: 11, y: 11 } as RoomPosition;
      const pos3 = { roomName: "W0N0", x: 12, y: 12 } as RoomPosition;

      for (let i = 0; i < 10; i++) trafficManager.recordMovement(pos1);
      for (let i = 0; i < 20; i++) trafficManager.recordMovement(pos2);
      for (let i = 0; i < 5; i++) trafficManager.recordMovement(pos3);

      roadPlanner.setTrafficManager(trafficManager);

      const mockRoom: RoomLike = {
        name: "W0N0",
        getTerrain: vi.fn(() => ({
          get: () => TERRAIN_MASK_SWAMP
        })) as () => RoomTerrain
      };

      const plans = roadPlanner.prioritizeRoadConstruction(mockRoom, 10);

      // Values: pos1=40, pos2=80, pos3=20
      expect(plans).toHaveLength(3);
      expect(plans[0].pos.x).toBe(11); // Highest value
      expect(plans[0].priority).toBe(80);
      expect(plans[1].pos.x).toBe(10);
      expect(plans[1].priority).toBe(40);
      expect(plans[2].pos.x).toBe(12); // Lowest value
      expect(plans[2].priority).toBe(20);
    });
  });
});
