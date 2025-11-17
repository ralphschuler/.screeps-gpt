/**
 * Regression test for complete container-based harvesting workflow.
 *
 * Issue: ralphschuler/.screeps-gpt#862 - Phase 1 container harvesting completion
 *
 * This test validates the complete container-based harvesting system:
 * 1. Stationary harvesters positioned at sources with containers
 * 2. Haulers transport energy from source containers to spawn/extensions
 * 3. Containers maintained at >50% health by repairers
 * 4. Dynamic role spawning based on container presence
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import { BodyComposer } from "@runtime/behavior/BodyComposer";
import type { GameContext } from "@runtime/types/GameContext";

describe("Container Harvesting Workflow", () => {
  let behaviorController: BehaviorController;
  let bodyComposer: BodyComposer;
  let memory: Memory;
  let game: GameContext;

  /**
   * Helper function to create a mock room.find implementation with filter support.
   * Reduces duplication across test cases.
   */
  const createMockRoomFind = (structures: Structure[], sources: Source[] = []) => {
    return vi.fn((findConstant: FindConstant, options?: unknown) => {
      if (findConstant === FIND_STRUCTURES) {
        if (options && typeof options === "object" && "filter" in options) {
          const filter = (options as { filter: (s: AnyStructure) => boolean }).filter;
          return structures.filter(filter);
        }
        return structures;
      }
      if (findConstant === FIND_SOURCES) {
        return sources;
      }
      return [];
    });
  };

  beforeEach(() => {
    behaviorController = new BehaviorController(
      {
        useTaskSystem: false, // Disable task system: this regression test targets legacy role-based behavior for Phase 1 container harvesting. Enabling the task system would alter test coverage and invalidate the regression scenario.
        cpuSafetyMargin: 0.85,
        maxCpuPerCreep: 1.5
      },
      { log: vi.fn(), warn: vi.fn() }
    );

    bodyComposer = new BodyComposer();
    memory = {} as Memory;
  });

  describe("Body Composition", () => {
    it("should generate stationary harvester with 5 WORK parts minimum", () => {
      const body = bodyComposer.generateBody("stationaryHarvester", 550);

      // Count WORK parts
      const workParts = body.filter(part => part === WORK).length;

      expect(workParts).toBeGreaterThanOrEqual(5);
      expect(body).toContain(WORK);
      expect(body).toContain(MOVE);
    });

    it("should generate hauler with CARRY-heavy body composition", () => {
      const body = bodyComposer.generateBody("hauler", 400);

      // Count CARRY parts
      const carryParts = body.filter(part => part === CARRY).length;
      const moveParts = body.filter(part => part === MOVE).length;

      expect(carryParts).toBeGreaterThanOrEqual(4);
      expect(moveParts).toBeGreaterThan(0);
      // Haulers should have more CARRY than MOVE for efficiency
      expect(carryParts).toBeGreaterThanOrEqual(moveParts);
    });

    it("should calculate correct body costs", () => {
      const harvesterBody = bodyComposer.generateBody("stationaryHarvester", 550);
      const haulerBody = bodyComposer.generateBody("hauler", 400);

      const harvesterCost = bodyComposer.calculateBodyCost(harvesterBody);
      const haulerCost = bodyComposer.calculateBodyCost(haulerBody);

      expect(harvesterCost).toBeLessThanOrEqual(550);
      expect(haulerCost).toBeLessThanOrEqual(400);
      expect(harvesterCost).toBeGreaterThan(0);
      expect(haulerCost).toBeGreaterThan(0);
    });
  });

  describe("Dynamic Role Spawning", () => {
    it("should spawn stationary harvesters when containers exist near sources", () => {
      // Setup room with 2 sources and 2 containers
      const mockSource1 = {
        id: "source-1" as Id<Source>,
        pos: {
          x: 10,
          y: 10,
          roomName: "W1N1",
          findInRange: vi.fn((findConstant: FindConstant, range: number, options?: unknown) => {
            if (findConstant === FIND_STRUCTURES && range === 2) {
              return [mockContainer1];
            }
            return [];
          })
        } as RoomPosition
      } as Source;

      const mockSource2 = {
        id: "source-2" as Id<Source>,
        pos: {
          x: 30,
          y: 30,
          roomName: "W1N1",
          findInRange: vi.fn((findConstant: FindConstant, range: number) => {
            if (findConstant === FIND_STRUCTURES && range === 2) {
              return [mockContainer2];
            }
            return [];
          })
        } as RoomPosition
      } as Source;

      const mockContainer1 = {
        id: "container-1" as Id<StructureContainer>,
        structureType: STRUCTURE_CONTAINER,
        pos: { x: 11, y: 11, roomName: "W1N1" } as RoomPosition
      } as StructureContainer;

      const mockContainer2 = {
        id: "container-2" as Id<StructureContainer>,
        structureType: STRUCTURE_CONTAINER,
        pos: { x: 31, y: 31, roomName: "W1N1" } as RoomPosition
      } as StructureContainer;

      const mockSpawn = {
        name: "Spawn1",
        spawning: null,
        spawnCreep: vi.fn().mockReturnValue(OK),
        pos: { x: 25, y: 25 } as RoomPosition,
        room: {
          energyAvailable: 550,
          energyCapacityAvailable: 550
        } as Room
      } as unknown as StructureSpawn;

      const mockRoom = {
        name: "W1N1",
        controller: {
          my: true,
          level: 3
        } as StructureController,
        find: vi.fn((findConstant: FindConstant) => {
          if (findConstant === FIND_SOURCES) {
            return [mockSource1, mockSource2];
          }
          if (findConstant === FIND_MY_STRUCTURES) {
            return [];
          }
          return [];
        })
      } as unknown as Room;

      game = {
        time: 1000,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 100,
          bucket: 10000
        },
        creeps: {},
        spawns: { Spawn1: mockSpawn },
        rooms: { W1N1: mockRoom }
      } as unknown as GameContext;

      // Execute behavior controller - should spawn stationary harvesters
      const result = behaviorController.execute(game, memory, {});

      // Should spawn stationary harvesters (one per source with container)
      expect(mockSpawn.spawnCreep).toHaveBeenCalled();

      // Should eventually spawn 2 stationary harvesters (one per container)
      expect(result.spawnedCreeps.length).toBeGreaterThan(0);
    });

    it("should spawn haulers when containers are present", () => {
      const mockSource = {
        id: "source-1" as Id<Source>,
        pos: {
          x: 10,
          y: 10,
          roomName: "W1N1",
          findInRange: vi.fn(() => [mockContainer])
        } as RoomPosition
      } as Source;

      const mockContainer = {
        id: "container-1" as Id<StructureContainer>,
        structureType: STRUCTURE_CONTAINER,
        pos: { x: 11, y: 11, roomName: "W1N1" } as RoomPosition,
        store: {
          getUsedCapacity: vi.fn().mockReturnValue(100),
          getFreeCapacity: vi.fn().mockReturnValue(1900)
        } as StoreDefinition
      } as StructureContainer;

      const mockSpawn = {
        name: "Spawn1",
        spawning: null,
        spawnCreep: vi.fn().mockReturnValue(OK),
        pos: { x: 25, y: 25 } as RoomPosition,
        room: {
          energyAvailable: 400,
          energyCapacityAvailable: 550
        } as Room
      } as unknown as StructureSpawn;

      const mockRoom = {
        name: "W1N1",
        controller: {
          my: true,
          level: 3
        } as StructureController,
        find: vi.fn((findConstant: FindConstant) => {
          if (findConstant === FIND_SOURCES) {
            return [mockSource];
          }
          if (findConstant === FIND_MY_STRUCTURES) {
            return [];
          }
          return [];
        })
      } as unknown as Room;

      game = {
        time: 1000,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 100,
          bucket: 10000
        },
        creeps: {},
        spawns: { Spawn1: mockSpawn },
        rooms: { W1N1: mockRoom }
      } as unknown as GameContext;

      // Execute behavior controller
      behaviorController.execute(game, memory, {});

      // Should spawn haulers when containers exist
      const spawnCalls = (mockSpawn.spawnCreep as ReturnType<typeof vi.fn>).mock.calls;
      const haulerSpawns = spawnCalls.filter(call => call[2]?.memory?.role === "hauler");

      // Haulers should be spawned when containers are present
      expect(haulerSpawns.length).toBeGreaterThan(0);
    });
  });

  describe("Stationary Harvester Behavior", () => {
    it("should position harvester at source and transfer to container", () => {
      const mockSource = {
        id: "source-1" as Id<Source>,
        pos: {
          x: 10,
          y: 10,
          roomName: "W1N1",
          findInRange: vi.fn(() => [mockContainer])
        } as RoomPosition,
        energy: 3000,
        energyCapacity: 3000
      } as Source;

      const mockContainer = {
        id: "container-1" as Id<StructureContainer>,
        structureType: STRUCTURE_CONTAINER,
        pos: {
          x: 11,
          y: 11,
          roomName: "W1N1",
          inRangeTo: vi.fn().mockReturnValue(true)
        } as RoomPosition,
        store: {
          getUsedCapacity: vi.fn().mockReturnValue(0),
          getFreeCapacity: vi.fn().mockReturnValue(2000)
        } as StoreDefinition
      } as StructureContainer;

      const mockHarvester = {
        name: "stationaryHarvester-1",
        pos: {
          x: 10,
          y: 10,
          roomName: "W1N1",
          inRangeTo: vi.fn().mockReturnValue(true),
          findClosestByPath: vi.fn((targets: unknown[]) => {
            return Array.isArray(targets) && targets.length > 0 ? targets[0] : null;
          }),
          getRangeTo: vi.fn().mockReturnValue(1)
        } as RoomPosition,
        memory: {
          role: "stationaryHarvester",
          task: "stationaryHarvest",
          version: 1,
          sourceId: "source-1" as Id<Source>,
          containerId: "container-1" as Id<StructureContainer>
        } as CreepMemory,
        store: {
          getFreeCapacity: vi.fn().mockReturnValue(0), // Full
          getUsedCapacity: vi.fn().mockReturnValue(10)
        } as StoreDefinition,
        harvest: vi.fn().mockReturnValue(OK),
        transfer: vi.fn().mockReturnValue(OK),
        moveTo: vi.fn().mockReturnValue(OK),
        room: {
          name: "W1N1",
          find: vi.fn((findConstant: FindConstant) => {
            if (findConstant === FIND_SOURCES) {
              return [mockSource];
            }
            if (findConstant === FIND_STRUCTURES) {
              return [mockContainer];
            }
            return [];
          })
        } as Room
      } as Creep;

      // Mock Game.getObjectById
      global.Game = {
        getObjectById: vi.fn((id: Id<unknown>) => {
          if (id === "source-1") return mockSource;
          if (id === "container-1") return mockContainer;
          return null;
        })
      } as unknown as Game;

      game = {
        time: 1000,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 100,
          bucket: 10000
        },
        creeps: { "stationaryHarvester-1": mockHarvester },
        spawns: {},
        rooms: { W1N1: mockHarvester.room }
      } as unknown as GameContext;

      // Execute behavior
      behaviorController.execute(game, memory, { stationaryHarvester: 1 });

      // Should harvest from source
      expect(mockHarvester.harvest).toHaveBeenCalledWith(mockSource);

      // Should transfer to container when full
      expect(mockHarvester.transfer).toHaveBeenCalledWith(mockContainer, RESOURCE_ENERGY);
    });
  });

  describe("Container Repair Logic", () => {
    it("should prioritize containers below 50% health", () => {
      const mockContainer = {
        id: "container-1" as Id<StructureContainer>,
        structureType: STRUCTURE_CONTAINER,
        pos: {
          x: 10,
          y: 10,
          roomName: "W1N1",
          inRangeTo: vi.fn().mockReturnValue(true),
          getRangeTo: vi.fn().mockReturnValue(1)
        } as RoomPosition,
        hits: 1000, // 20% health (below 50% threshold)
        hitsMax: 5000,
        store: {
          getUsedCapacity: vi.fn().mockReturnValue(0)
        } as StoreDefinition
      } as StructureContainer;

      const mockRepairer = {
        name: "repairer-1",
        pos: {
          x: 9,
          y: 9,
          roomName: "W1N1",
          findClosestByPath: vi.fn((targets: unknown[]) => {
            return Array.isArray(targets) && targets.length > 0 ? targets[0] : null;
          }),
          getRangeTo: vi.fn().mockReturnValue(1)
        } as RoomPosition,
        memory: {
          role: "repairer",
          task: "repair",
          version: 1
        } as CreepMemory,
        store: {
          getFreeCapacity: vi.fn().mockReturnValue(0),
          getUsedCapacity: vi.fn().mockReturnValue(50)
        } as StoreDefinition,
        repair: vi.fn().mockReturnValue(OK),
        moveTo: vi.fn().mockReturnValue(OK),
        withdraw: vi.fn().mockReturnValue(OK),
        room: {
          name: "W1N1",
          find: createMockRoomFind([mockContainer])
        } as Room
      } as Creep;

      game = {
        time: 1000,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 100,
          bucket: 10000
        },
        creeps: { "repairer-1": mockRepairer },
        spawns: {},
        rooms: { W1N1: mockRepairer.room }
      } as unknown as GameContext;

      // Execute behavior
      behaviorController.execute(game, memory, { repairer: 1 });

      // Should repair the container
      expect(mockRepairer.repair).toHaveBeenCalledWith(mockContainer);
    });

    it("should prioritize source containers over controller containers", () => {
      const mockSource = {
        id: "source-1" as Id<Source>,
        pos: {
          x: 10,
          y: 10,
          roomName: "W1N1",
          inRangeTo: vi.fn((pos: RoomPosition) => {
            // Source container is at (11, 11), within range 2
            return pos.x === 11 && pos.y === 11;
          })
        } as RoomPosition
      } as Source;

      const mockSourceContainer = {
        id: "container-source" as Id<StructureContainer>,
        structureType: STRUCTURE_CONTAINER,
        pos: {
          x: 11,
          y: 11,
          roomName: "W1N1",
          getRangeTo: vi.fn((pos: RoomPosition) => {
            // Distance to creep at (12, 12)
            return Math.abs(11 - pos.x) + Math.abs(11 - pos.y);
          })
        } as RoomPosition,
        hits: 2000, // 40% health
        hitsMax: 5000
      } as StructureContainer;

      const mockControllerContainer = {
        id: "container-controller" as Id<StructureContainer>,
        structureType: STRUCTURE_CONTAINER,
        pos: {
          x: 30,
          y: 30,
          roomName: "W1N1",
          getRangeTo: vi.fn((pos: RoomPosition) => {
            // Distance to creep at (12, 12)
            return Math.abs(30 - pos.x) + Math.abs(30 - pos.y);
          })
        } as RoomPosition,
        hits: 2000, // 40% health (same as source container)
        hitsMax: 5000
      } as StructureContainer;

      const mockRepairer = {
        name: "repairer-1",
        pos: {
          x: 12,
          y: 12,
          roomName: "W1N1",
          findClosestByPath: vi.fn((targets: Structure[]) => {
            // Return first in sorted list
            return targets.length > 0 ? targets[0] : null;
          }),
          getRangeTo: vi.fn((target: { pos: RoomPosition }) => {
            const dx = Math.abs(12 - target.pos.x);
            const dy = Math.abs(12 - target.pos.y);
            return dx + dy;
          })
        } as RoomPosition,
        memory: {
          role: "repairer",
          task: "repair",
          version: 1
        } as CreepMemory,
        store: {
          getFreeCapacity: vi.fn().mockReturnValue(0),
          getUsedCapacity: vi.fn().mockReturnValue(50)
        } as StoreDefinition,
        repair: vi.fn().mockReturnValue(OK),
        moveTo: vi.fn().mockReturnValue(OK),
        room: {
          name: "W1N1",
          find: createMockRoomFind([mockSourceContainer, mockControllerContainer], [mockSource])
        } as Room
      } as Creep;

      game = {
        time: 1000,
        cpu: {
          getUsed: vi.fn().mockReturnValue(5),
          limit: 100,
          bucket: 10000
        },
        creeps: { "repairer-1": mockRepairer },
        spawns: {},
        rooms: { W1N1: mockRepairer.room }
      } as unknown as GameContext;

      // Execute behavior
      behaviorController.execute(game, memory, { repairer: 1 });

      // Should repair the source container (prioritized over controller container)
      expect(mockRepairer.repair).toHaveBeenCalledWith(mockSourceContainer);
    });
  });
});
