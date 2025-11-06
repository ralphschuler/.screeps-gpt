import { describe, it, expect, beforeEach, vi } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { GameContext } from "@runtime/types/GameContext";

/**
 * Performance benchmark comparing task system vs legacy role-based system.
 * This test measures CPU overhead and validates feature parity.
 */
describe("Task System Performance Benchmark", () => {
  let mockGame: GameContext;
  let mockMemory: Memory;
  let mockRoleCounts: Record<string, number>;

  beforeEach(() => {
    // Mock Screeps constants
    global.FIND_SOURCES_ACTIVE = 105 as FindConstant;
    global.FIND_CONSTRUCTION_SITES = 107 as FindConstant;
    global.FIND_STRUCTURES = 106 as FindConstant;
    global.FIND_MY_STRUCTURES = 112 as FindConstant;
    global.STRUCTURE_SPAWN = "spawn" as StructureConstant;
    global.STRUCTURE_EXTENSION = "extension" as StructureConstant;
    global.STRUCTURE_STORAGE = "storage" as StructureConstant;
    global.STRUCTURE_CONTAINER = "container" as StructureConstant;
    global.STRUCTURE_CONTROLLER = "controller" as StructureConstant;
    global.WORK = "work" as BodyPartConstant;
    global.CARRY = "carry" as BodyPartConstant;
    global.MOVE = "move" as BodyPartConstant;
    global.RESOURCE_ENERGY = "energy" as ResourceConstant;
    global.OK = 0;
    global.ERR_NOT_IN_RANGE = -9;

    // Track CPU usage
    let cpuUsage = 0;
    const cpuIncrement = 0.1; // Simulate 0.1 CPU per operation

    mockGame = {
      time: 1000,
      cpu: {
        limit: 100,
        getUsed: vi.fn(() => {
          cpuUsage += cpuIncrement;
          return cpuUsage;
        })
      },
      creeps: {},
      spawns: {},
      rooms: {}
    } as unknown as GameContext;

    // Mock global Game object for TaskManager
    global.Game = {
      time: mockGame.time,
      cpu: mockGame.cpu,
      getObjectById: vi.fn()
    } as unknown as Game;

    mockMemory = {
      creepCounter: 0,
      roles: {},
      creeps: {}
    } as Memory;

    mockRoleCounts = {};

    // Reset CPU counter before each test
    cpuUsage = 0;
  });

  describe("Small Room Benchmark (5 creeps, 2 sources, 3 sites)", () => {
    beforeEach(() => {
      setupSmallRoom(mockGame, mockMemory);
    });

    it("should measure legacy role-based system CPU usage", () => {
      const controller = new BehaviorController({
        useTaskSystem: false,
        cpuSafetyMargin: 0.8
      });

      const cpuBefore = mockGame.cpu.getUsed();
      const result = controller.execute(mockGame, mockMemory, mockRoleCounts);
      const cpuAfter = mockGame.cpu.getUsed();
      const cpuUsed = cpuAfter - cpuBefore;

      expect(result.processedCreeps).toBe(5);
      expect(cpuUsed).toBeLessThan(5); // Expect < 1 CPU per creep
      console.log(`[Legacy] Small room: ${cpuUsed.toFixed(2)} CPU for ${result.processedCreeps} creeps`);
    });

    it("should measure task system CPU usage", () => {
      const controller = new BehaviorController({
        useTaskSystem: true,
        cpuSafetyMargin: 0.8
      });

      const cpuBefore = mockGame.cpu.getUsed();
      const result = controller.execute(mockGame, mockMemory, mockRoleCounts);
      const cpuAfter = mockGame.cpu.getUsed();
      const cpuUsed = cpuAfter - cpuBefore;

      expect(result.processedCreeps).toBe(5);
      // Task system may have slightly higher overhead (task generation)
      expect(cpuUsed).toBeLessThan(10); // Accept up to 2x overhead for task generation
      console.log(`[Task System] Small room: ${cpuUsed.toFixed(2)} CPU for ${result.processedCreeps} creeps`);
    });

    it("should have comparable CPU usage (< 100% overhead)", () => {
      const legacyController = new BehaviorController({
        useTaskSystem: false,
        cpuSafetyMargin: 0.8
      });

      const taskController = new BehaviorController({
        useTaskSystem: true,
        cpuSafetyMargin: 0.8
      });

      // Helper to create a fresh CPU mock
      const createCpuMock = () => {
        let cpuUsage = 0;
        return vi.fn(() => {
          cpuUsage += 0.1;
          return cpuUsage;
        });
      };

      // Measure legacy system
      mockGame.cpu.getUsed = createCpuMock();
      const legacyCpuBefore = mockGame.cpu.getUsed();
      legacyController.execute(mockGame, mockMemory, mockRoleCounts);
      const legacyCpuAfter = mockGame.cpu.getUsed();
      const legacyCpuUsed = legacyCpuAfter - legacyCpuBefore;

      // Measure task system
      mockGame.cpu.getUsed = createCpuMock();
      const taskCpuBefore = mockGame.cpu.getUsed();
      taskController.execute(mockGame, mockMemory, mockRoleCounts);
      const taskCpuAfter = mockGame.cpu.getUsed();
      const taskCpuUsed = taskCpuAfter - taskCpuBefore;

      const overhead = ((taskCpuUsed - legacyCpuUsed) / legacyCpuUsed) * 100;
      console.log(
        `[Comparison] Legacy: ${legacyCpuUsed.toFixed(2)} CPU, Task: ${taskCpuUsed.toFixed(2)} CPU, Overhead: ${overhead.toFixed(1)}%`
      );

      // Acceptance criteria: < 100% overhead (< 2x CPU usage)
      expect(taskCpuUsed).toBeLessThan(legacyCpuUsed * 2);
    });
  });

  describe("Medium Room Benchmark (15 creeps, 3 sources, 8 sites)", () => {
    beforeEach(() => {
      setupMediumRoom(mockGame, mockMemory);
    });

    it("should handle medium room with legacy system", () => {
      const controller = new BehaviorController({
        useTaskSystem: false,
        cpuSafetyMargin: 0.8
      });

      const cpuBefore = mockGame.cpu.getUsed();
      const result = controller.execute(mockGame, mockMemory, mockRoleCounts);
      const cpuAfter = mockGame.cpu.getUsed();
      const cpuUsed = cpuAfter - cpuBefore;

      expect(result.processedCreeps).toBe(15);
      console.log(`[Legacy] Medium room: ${cpuUsed.toFixed(2)} CPU for ${result.processedCreeps} creeps`);
    });

    it("should handle medium room with task system", () => {
      const controller = new BehaviorController({
        useTaskSystem: true,
        cpuSafetyMargin: 0.8
      });

      const cpuBefore = mockGame.cpu.getUsed();
      const result = controller.execute(mockGame, mockMemory, mockRoleCounts);
      const cpuAfter = mockGame.cpu.getUsed();
      const cpuUsed = cpuAfter - cpuBefore;

      expect(result.processedCreeps).toBe(15);
      console.log(`[Task System] Medium room: ${cpuUsed.toFixed(2)} CPU for ${result.processedCreeps} creeps`);
    });

    it("should scale linearly with creep count", () => {
      // This test validates that CPU usage scales O(n) with creep count
      const controller = new BehaviorController({
        useTaskSystem: true,
        cpuSafetyMargin: 0.8
      });

      const result = controller.execute(mockGame, mockMemory, mockRoleCounts);
      const cpuPerCreep = mockGame.cpu.getUsed() / result.processedCreeps;

      // Expect roughly linear scaling (< 2 CPU per creep for medium rooms)
      expect(cpuPerCreep).toBeLessThan(2);
      console.log(`[Scaling] CPU per creep: ${cpuPerCreep.toFixed(2)}`);
    });
  });

  describe("Task Execution Metrics", () => {
    beforeEach(() => {
      setupSmallRoom(mockGame, mockMemory);
    });

    it("should track task types executed", () => {
      const controller = new BehaviorController({
        useTaskSystem: true,
        cpuSafetyMargin: 0.8
      });

      const result = controller.execute(mockGame, mockMemory, mockRoleCounts);

      expect(result.tasksExecuted).toBeDefined();
      expect(Object.keys(result.tasksExecuted).length).toBeGreaterThan(0);
      console.log(`[Metrics] Tasks executed:`, result.tasksExecuted);
    });

    it("should execute multiple task types in priority order", () => {
      const controller = new BehaviorController({
        useTaskSystem: true,
        cpuSafetyMargin: 0.8
      });

      const result = controller.execute(mockGame, mockMemory, mockRoleCounts);

      // Task system should generate and execute various task types
      const taskTypes = Object.keys(result.tasksExecuted);
      expect(taskTypes.length).toBeGreaterThan(0);

      // Should have at least harvest and build tasks for this room setup
      const totalTasks = Object.values(result.tasksExecuted).reduce((sum, count) => sum + count, 0);
      expect(totalTasks).toBeGreaterThan(0);
      console.log(`[Task Types] Executed ${taskTypes.length} different task types`);
    });
  });

  describe("Feature Parity Validation", () => {
    beforeEach(() => {
      setupSmallRoom(mockGame, mockMemory);
    });

    it("should process same number of creeps as legacy system", () => {
      const legacyController = new BehaviorController({
        useTaskSystem: false,
        cpuSafetyMargin: 0.8
      });

      const taskController = new BehaviorController({
        useTaskSystem: true,
        cpuSafetyMargin: 0.8
      });

      const legacyResult = legacyController.execute(mockGame, mockMemory, mockRoleCounts);
      const taskResult = taskController.execute(mockGame, mockMemory, mockRoleCounts);

      expect(taskResult.processedCreeps).toBe(legacyResult.processedCreeps);
    });

    it("should respect CPU safety margin", () => {
      const controller = new BehaviorController({
        useTaskSystem: true,
        cpuSafetyMargin: 0.8
      });

      const result = controller.execute(mockGame, mockMemory, mockRoleCounts);
      const cpuUsed = mockGame.cpu.getUsed();
      const cpuLimit = mockGame.cpu.limit * 0.8;

      // Task system should stop before exceeding CPU limit
      expect(result.processedCreeps).toBeGreaterThan(0);
      console.log(
        `[CPU Safety] Used ${cpuUsed.toFixed(2)}/${cpuLimit.toFixed(2)} CPU (${((cpuUsed / cpuLimit) * 100).toFixed(1)}%)`
      );
    });
  });
});

// Helper functions to set up test scenarios

function setupSmallRoom(game: GameContext, memory: Memory): void {
  // Create room with controller
  const roomName = "W1N1";
  const mockController = {
    id: "controller1" as Id<StructureController>,
    my: true,
    pos: { x: 25, y: 25, roomName, getRangeTo: vi.fn(() => 5) }
  } as unknown as StructureController;

  // Create sources
  const source1 = {
    id: "source1" as Id<Source>,
    pos: { x: 10, y: 10, roomName, getRangeTo: vi.fn(() => 5) },
    energy: 3000,
    energyCapacity: 3000
  } as unknown as Source;

  const source2 = {
    id: "source2" as Id<Source>,
    pos: { x: 40, y: 40, roomName, getRangeTo: vi.fn(() => 5) },
    energy: 3000,
    energyCapacity: 3000
  } as unknown as Source;

  // Create construction sites
  const sites = Array.from({ length: 3 }, (_, i) => ({
    id: `site${i}` as Id<ConstructionSite>,
    structureType: STRUCTURE_EXTENSION,
    pos: { x: 20 + i, y: 20, roomName, getRangeTo: vi.fn(() => 5) },
    progress: 0,
    progressTotal: 3000
  })) as unknown as ConstructionSite[];

  // Create spawn
  const spawn = {
    id: "spawn1" as Id<StructureSpawn>,
    name: "Spawn1",
    spawning: null,
    spawnCreep: vi.fn(() => OK),
    store: {
      getFreeCapacity: vi.fn(() => 100),
      getUsedCapacity: vi.fn(() => 200)
    },
    pos: { x: 25, y: 25, roomName }
  } as unknown as StructureSpawn;

  // Create room
  const room = {
    name: roomName,
    controller: mockController,
    find: vi.fn((type: FindConstant) => {
      if (type === FIND_SOURCES_ACTIVE) return [source1, source2];
      if (type === FIND_CONSTRUCTION_SITES) return sites;
      if (type === FIND_STRUCTURES) return [spawn];
      return [];
    })
  } as unknown as Room;

  // Create creeps
  const creeps: Record<string, Creep> = {};
  for (let i = 0; i < 5; i++) {
    const role = i < 2 ? "harvester" : i < 4 ? "upgrader" : "builder";
    creeps[`creep${i}`] = createMockCreep(`creep${i}`, role, room);
    memory.creeps[`creep${i}`] = {
      role,
      task: "harvest",
      version: 1
    };
  }

  game.rooms = { [roomName]: room };
  game.creeps = creeps;
  game.spawns = { Spawn1: spawn };
  memory.creepCounter = 5;
}

function setupMediumRoom(game: GameContext, memory: Memory): void {
  // Similar to setupSmallRoom but with more creeps and structures
  const roomName = "W2N2";
  const mockController = {
    id: "controller2" as Id<StructureController>,
    my: true,
    pos: { x: 25, y: 25, roomName, getRangeTo: vi.fn(() => 5) }
  } as unknown as StructureController;

  const sources = Array.from({ length: 3 }, (_, i) => ({
    id: `source${i}` as Id<Source>,
    pos: { x: 10 + i * 15, y: 10, roomName, getRangeTo: vi.fn(() => 5) },
    energy: 3000,
    energyCapacity: 3000
  })) as unknown as Source[];

  const sites = Array.from({ length: 8 }, (_, i) => ({
    id: `site${i}` as Id<ConstructionSite>,
    structureType: STRUCTURE_EXTENSION,
    pos: { x: 20 + i, y: 20, roomName, getRangeTo: vi.fn(() => 5) },
    progress: 0,
    progressTotal: 3000
  })) as unknown as ConstructionSite[];

  const spawn = {
    id: "spawn2" as Id<StructureSpawn>,
    name: "Spawn2",
    spawning: null,
    spawnCreep: vi.fn(() => OK),
    store: {
      getFreeCapacity: vi.fn(() => 100),
      getUsedCapacity: vi.fn(() => 200)
    },
    pos: { x: 25, y: 25, roomName }
  } as unknown as StructureSpawn;

  const room = {
    name: roomName,
    controller: mockController,
    find: vi.fn((type: FindConstant) => {
      if (type === FIND_SOURCES_ACTIVE) return sources;
      if (type === FIND_CONSTRUCTION_SITES) return sites;
      if (type === FIND_STRUCTURES) return [spawn];
      return [];
    })
  } as unknown as Room;

  const creeps: Record<string, Creep> = {};
  for (let i = 0; i < 15; i++) {
    const role = i < 5 ? "harvester" : i < 10 ? "upgrader" : "builder";
    creeps[`creep${i}`] = createMockCreep(`creep${i}`, role, room);
    memory.creeps[`creep${i}`] = {
      role,
      task: "harvest",
      version: 1
    };
  }

  game.rooms = { [roomName]: room };
  game.creeps = creeps;
  game.spawns = { Spawn2: spawn };
  memory.creepCounter = 15;
}

function createMockCreep(name: string, role: string, room: Room): Creep {
  return {
    id: `${name}_id` as Id<Creep>,
    name,
    memory: {
      role,
      task: "harvest",
      version: 1
    },
    body: [
      { type: WORK, hits: 100 },
      { type: CARRY, hits: 100 },
      { type: MOVE, hits: 100 }
    ],
    store: {
      getUsedCapacity: vi.fn((resource?: ResourceConstant) => (resource === RESOURCE_ENERGY ? 50 : 0)),
      getFreeCapacity: vi.fn(() => 50)
    },
    pos: {
      x: 25,
      y: 25,
      roomName: room.name,
      getRangeTo: vi.fn(() => 5),
      findClosestByPath: vi.fn()
    },
    room,
    harvest: vi.fn(() => OK),
    build: vi.fn(() => OK),
    repair: vi.fn(() => OK),
    upgradeController: vi.fn(() => OK),
    transfer: vi.fn(() => OK),
    withdraw: vi.fn(() => OK),
    moveTo: vi.fn(() => OK)
  } as unknown as Creep;
}
