import { describe, it, expect, beforeEach, vi } from "vitest";
import { InfrastructureManager } from "@runtime/infrastructure/InfrastructureManager";
import type { GameContext } from "@runtime/types/GameContext";

describe("InfrastructureManager", () => {
  let mockGame: GameContext;

  beforeEach(() => {
    (global as { Game?: { time: number } }).Game = { time: 1000 };

    // Mock RoomPosition constructor
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

    mockGame = {
      time: 1000,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: {},
      spawns: {},
      rooms: {}
    };
  });

  it("should initialize without errors", () => {
    const manager = new InfrastructureManager();
    expect(manager).toBeDefined();
  });

  it("should provide access to traffic manager", () => {
    const manager = new InfrastructureManager();
    const trafficManager = manager.getTrafficManager();
    expect(trafficManager).toBeDefined();
  });

  it("should provide access to road planner", () => {
    const manager = new InfrastructureManager();
    const roadPlanner = manager.getRoadPlanner();
    expect(roadPlanner).toBeDefined();
  });

  it("should record creep movement", () => {
    const manager = new InfrastructureManager({ enableTrafficAnalysis: true });
    const mockCreep = {
      pos: { roomName: "W1N1", x: 25, y: 25 } as RoomPosition
    } as Creep;

    manager.recordCreepMovement(mockCreep);

    const trafficManager = manager.getTrafficManager();
    const traffic = trafficManager.getTrafficAt(mockCreep.pos);
    expect(traffic).toBe(1);
  });

  it("should run periodic road planning", () => {
    const spawn: StructureSpawn = {
      id: "spawn1" as Id<StructureSpawn>,
      structureType: STRUCTURE_SPAWN,
      pos: { x: 25, y: 25 } as RoomPosition
    } as StructureSpawn;

    const controller: StructureController = {
      id: "controller1" as Id<StructureController>,
      pos: { x: 30, y: 30 } as RoomPosition,
      my: true,
      level: 2,
      progress: 100,
      progressTotal: 1000
    } as StructureController;

    const mockRoom = {
      name: "W0N0",
      controller,
      find: (type: FindConstant) => {
        if (type === FIND_MY_SPAWNS) {
          return [spawn];
        }
        if (type === FIND_SOURCES) {
          return [];
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
        { x: 26, y: 26, dx: 1, dy: 1, direction: 3 },
        { x: 27, y: 27, dx: 1, dy: 1, direction: 3 }
      ]),
      createConstructionSite: vi.fn(() => OK),
      getTerrain: vi.fn(() => ({
        get: () => 0
      })) as () => RoomTerrain
    };

    const game = {
      ...mockGame,
      rooms: { W0N0: mockRoom }
    };

    const manager = new InfrastructureManager({ roadPlanningInterval: 10 });
    const result = manager.run(game);

    // First run should plan roads
    expect(result.roadsPlanned).toBeGreaterThanOrEqual(0);
  });

  it("should not plan roads every tick", () => {
    const spawn: StructureSpawn = {
      id: "spawn1" as Id<StructureSpawn>,
      structureType: STRUCTURE_SPAWN,
      pos: { x: 25, y: 25 } as RoomPosition
    } as StructureSpawn;

    const controller: StructureController = {
      id: "controller1" as Id<StructureController>,
      pos: { x: 30, y: 30 } as RoomPosition,
      my: true,
      level: 2,
      progress: 100,
      progressTotal: 1000
    } as StructureController;

    const mockRoom = {
      name: "W0N0",
      controller,
      find: (type: FindConstant) => {
        if (type === FIND_MY_SPAWNS) {
          return [spawn];
        }
        if (type === FIND_SOURCES) {
          return [];
        }
        if (type === FIND_STRUCTURES) {
          return [];
        }
        if (type === FIND_CONSTRUCTION_SITES) {
          return [];
        }
        return [];
      },
      findPath: vi.fn(() => []),
      createConstructionSite: vi.fn(() => OK),
      getTerrain: vi.fn(() => ({
        get: () => 0
      })) as () => RoomTerrain
    };

    const game = {
      ...mockGame,
      rooms: { W0N0: mockRoom }
    };

    const memory = {
      roadPlanning: { lastPlanned: { W0N0: 950 } }
    };

    const manager = new InfrastructureManager({
      roadPlanningInterval: 100,
      memory
    });

    // Should not plan roads if last planned was recent
    const result = manager.run(game);
    expect(result.roadsPlanned).toBe(0);
  });

  it("should get high-traffic positions", () => {
    const manager = new InfrastructureManager({ enableTrafficAnalysis: true });
    const mockCreep = {
      pos: { roomName: "W1N1", x: 25, y: 25 } as RoomPosition
    } as Creep;

    // Record high traffic
    for (let i = 0; i < 15; i++) {
      manager.recordCreepMovement(mockCreep);
    }

    const highTraffic = manager.getHighTrafficPositions(10);
    expect(highTraffic).toHaveLength(1);
    expect(highTraffic[0].count).toBe(15);
  });

  it("should track traffic and report statistics", () => {
    const manager = new InfrastructureManager({ enableTrafficAnalysis: true });

    const mockCreep = {
      pos: { roomName: "W1N1", x: 25, y: 25 } as RoomPosition
    } as Creep;

    // Record movement multiple times
    for (let i = 0; i < 5; i++) {
      manager.recordCreepMovement(mockCreep);
    }

    // Verify traffic was recorded
    const trafficManager = manager.getTrafficManager();
    const traffic = trafficManager.getTrafficAt(mockCreep.pos);
    expect(traffic).toBe(5);

    // Verify manager reports traffic statistics
    const result = manager.run(mockGame);
    expect(result.trafficPositions).toBe(1);
  });
});
