/**
 * Regression test for Phase 1 road network automation.
 * Validates automated road planning triggers at RCL 2 when containers are present.
 *
 * Issue #XXX: Phase 1 completion blocked by lack of automated road planning
 * Root cause: Road planning not integrated into bootstrap phase progression
 * Solution: BootstrapPhaseManager now triggers road planning at RCL 2 with containers
 *
 * Test validates:
 * 1. Roads are planned when RCL 2 reached with containers
 * 2. Path length filtering (>5 tiles) prevents unnecessary roads
 * 3. Roads marked as planned to prevent redundant planning
 * 4. Repairer maintains roads at 50% health threshold
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BootstrapPhaseManager } from "@runtime/bootstrap/BootstrapPhaseManager";
import { RoadPlanner } from "@runtime/infrastructure/RoadPlanner";
import type { GameContext, RoomLike, SourceLike, StructureLike } from "@runtime/types/GameContext";

describe("Phase 1 Road Automation", () => {
  let bootstrapManager: BootstrapPhaseManager;
  let roadPlanner: RoadPlanner;
  let mockGame: GameContext;
  let mockMemory: Memory;
  let mockRoom: RoomLike;

  beforeEach(() => {
    bootstrapManager = new BootstrapPhaseManager();
    roadPlanner = new RoadPlanner({ log: vi.fn(), warn: vi.fn() });

    mockGame = {
      time: 1000,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    mockMemory = {
      creeps: {},
      spawns: {},
      rooms: {}
    } as Memory;
  });

  describe("Road planning trigger at RCL 2", () => {
    it("should trigger road planning when RCL 2 reached with containers", () => {
      // Setup: RCL 2 room with containers near sources
      const mockSource: SourceLike = {
        id: "source1" as Id<Source>,
        pos: {
          x: 10,
          y: 10,
          roomName: "W1N1",
          findInRange: (type: FindConstant, range: number, _opts?: Record<string, unknown>) => {
            if (type === FIND_STRUCTURES && range === 2) {
              return [
                {
                  structureType: STRUCTURE_CONTAINER,
                  id: "container1" as Id<StructureContainer>
                } as StructureLike
              ];
            }
            return [];
          }
        } as RoomPosition
      } as SourceLike;

      mockRoom = {
        name: "W1N1",
        controller: {
          my: true,
          level: 2 // RCL 2 - road planning should trigger
        },
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [mockSource];
          }
          return [];
        }
      } as RoomLike;

      mockGame.rooms["W1N1"] = mockRoom;

      // Check if road planning is needed
      const status = bootstrapManager.checkRoadPlanningNeeded(mockGame, mockMemory);

      expect(status.shouldPlan).toBe(true);
      expect(status.roomName).toBe("W1N1");
      expect(status.reason).toContain("RCL 2");
    });

    it("should not trigger road planning at RCL 1", () => {
      // Setup: RCL 1 room (too early for roads)
      mockRoom = {
        name: "W1N1",
        controller: {
          my: true,
          level: 1 // RCL 1 - too early for roads
        },
        find: () => []
      } as RoomLike;

      mockGame.rooms["W1N1"] = mockRoom;

      const status = bootstrapManager.checkRoadPlanningNeeded(mockGame, mockMemory);

      expect(status.shouldPlan).toBe(false);
    });

    it("should not trigger road planning without containers", () => {
      // Setup: RCL 2 room but no containers yet
      const mockSource: SourceLike = {
        id: "source1" as Id<Source>,
        pos: {
          x: 10,
          y: 10,
          roomName: "W1N1",
          findInRange: () => [] // No containers near source
        } as RoomPosition
      } as SourceLike;

      mockRoom = {
        name: "W1N1",
        controller: {
          my: true,
          level: 2
        },
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [mockSource];
          }
          return [];
        }
      } as RoomLike;

      mockGame.rooms["W1N1"] = mockRoom;

      const status = bootstrapManager.checkRoadPlanningNeeded(mockGame, mockMemory);

      expect(status.shouldPlan).toBe(false);
    });

    it("should not trigger road planning if already planned", () => {
      // Setup: Roads already planned for this room
      const mockSource: SourceLike = {
        id: "source1" as Id<Source>,
        pos: {
          x: 10,
          y: 10,
          roomName: "W1N1",
          findInRange: (type: FindConstant, range: number, _opts?: Record<string, unknown>) => {
            if (type === FIND_STRUCTURES && range === 2) {
              return [
                {
                  structureType: STRUCTURE_CONTAINER,
                  id: "container1" as Id<StructureContainer>
                } as StructureLike
              ];
            }
            return [];
          }
        } as RoomPosition
      } as SourceLike;

      mockRoom = {
        name: "W1N1",
        controller: {
          my: true,
          level: 2
        },
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [mockSource];
          }
          return [];
        }
      } as RoomLike;

      mockGame.rooms["W1N1"] = mockRoom;
      mockMemory.rooms = { W1N1: { roadsPlanned: true } };

      const status = bootstrapManager.checkRoadPlanningNeeded(mockGame, mockMemory);

      expect(status.shouldPlan).toBe(false);
    });
  });

  describe("Path length filtering", () => {
    it("should not plan roads for paths shorter than 5 tiles", () => {
      // Setup room with short path
      const spawn = {
        id: "spawn1" as Id<StructureSpawn>,
        structureType: STRUCTURE_SPAWN,
        pos: { x: 10, y: 10 } as RoomPosition
      } as StructureSpawn;

      const source = {
        id: "source1" as Id<Source>,
        pos: { x: 12, y: 12 } as RoomPosition
      } as Source;

      mockRoom = {
        name: "W1N1",
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) return [spawn];
          if (type === FIND_SOURCES) return [source];
          return [];
        },
        findPath: vi.fn(() => [
          { x: 10, y: 10, dx: 1, dy: 0, direction: 2 },
          { x: 11, y: 11, dx: 1, dy: 1, direction: 3 },
          { x: 12, y: 12, dx: 0, dy: 0, direction: 0 }
        ]) // Only 3 tiles - too short
      } as RoomLike;

      const plans = roadPlanner.planSourceRoads(mockRoom, mockGame, 5);

      expect(plans).toHaveLength(0);
    });

    it("should plan roads for paths 5 tiles or longer", () => {
      // Setup room with long path
      const spawn = {
        id: "spawn1" as Id<StructureSpawn>,
        structureType: STRUCTURE_SPAWN,
        pos: { x: 10, y: 10 } as RoomPosition
      } as StructureSpawn;

      const source = {
        id: "source1" as Id<Source>,
        pos: { x: 20, y: 20 } as RoomPosition
      } as Source;

      mockRoom = {
        name: "W1N1",
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) return [spawn];
          if (type === FIND_SOURCES) return [source];
          return [];
        },
        findPath: vi.fn(() => [
          { x: 10, y: 10, dx: 1, dy: 0, direction: 2 },
          { x: 11, y: 11, dx: 1, dy: 1, direction: 3 },
          { x: 12, y: 12, dx: 1, dy: 1, direction: 3 },
          { x: 13, y: 13, dx: 1, dy: 1, direction: 3 },
          { x: 14, y: 14, dx: 1, dy: 1, direction: 3 },
          { x: 15, y: 15, dx: 1, dy: 1, direction: 3 }
        ]) // 6 tiles - long enough
      } as RoomLike;

      const plans = roadPlanner.planSourceRoads(mockRoom, mockGame, 5);

      expect(plans.length).toBeGreaterThan(0);
    });
  });

  describe("Road planning state tracking", () => {
    it("should mark roads as planned after planning", () => {
      mockMemory.rooms = { W1N1: {} };

      bootstrapManager.markRoadsPlanned(mockMemory, "W1N1");

      expect(mockMemory.rooms.W1N1.roadsPlanned).toBe(true);
    });

    it("should initialize room memory if not present", () => {
      mockMemory.rooms = {};

      bootstrapManager.markRoadsPlanned(mockMemory, "W1N1");

      expect(mockMemory.rooms.W1N1).toBeDefined();
      expect(mockMemory.rooms.W1N1.roadsPlanned).toBe(true);
    });
  });

  describe("Road maintenance threshold", () => {
    it("should identify roads needing repair at 50% health", () => {
      const healthyRoad: StructureRoad = {
        id: "road1" as Id<StructureRoad>,
        structureType: STRUCTURE_ROAD,
        pos: { x: 10, y: 10 } as RoomPosition,
        hits: 3000,
        hitsMax: 5000 // 60% health - should not repair
      } as StructureRoad;

      const damagedRoad: StructureRoad = {
        id: "road2" as Id<StructureRoad>,
        structureType: STRUCTURE_ROAD,
        pos: { x: 11, y: 11 } as RoomPosition,
        hits: 2000,
        hitsMax: 5000 // 40% health - should repair
      } as StructureRoad;

      mockRoom = {
        name: "W1N1",
        find: (type: FindConstant) => {
          if (type === FIND_STRUCTURES) {
            return [healthyRoad, damagedRoad];
          }
          return [];
        }
      } as RoomLike;

      // Use 50% threshold (0.5)
      const damagedRoads = roadPlanner.identifyRepairNeeds(mockRoom, 0.5);

      expect(damagedRoads).toHaveLength(1);
      expect(damagedRoads[0].id).toBe("road2");
    });
  });
});
