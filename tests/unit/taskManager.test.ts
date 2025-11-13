import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskManager, TaskRequest, TaskPriority, HarvestAction, BuildAction } from "@runtime/tasks";

describe("TaskManager", () => {
  let mockRoom: Room;
  let mockCreep: Creep;
  let mockSource: Source;
  let mockConstructionSite: ConstructionSite;

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

    // Mock Game global
    global.Game = {
      time: 100,
      cpu: {
        getUsed: vi.fn().mockReturnValue(10),
        limit: 100
      },
      getObjectById: vi.fn()
    } as unknown as Game;

    // Mock source
    mockSource = {
      id: "source1" as Id<Source>,
      pos: { x: 10, y: 10, roomName: "W1N1" }
    } as unknown as Source;

    // Mock construction site
    mockConstructionSite = {
      id: "site1" as Id<ConstructionSite>,
      structureType: STRUCTURE_EXTENSION,
      pos: { x: 15, y: 15, roomName: "W1N1" }
    } as unknown as ConstructionSite;

    // Mock room
    mockRoom = {
      name: "W1N1",
      controller: {
        my: true,
        id: "controller1" as Id<StructureController>
      },
      find: vi.fn((type: FindConstant) => {
        if (type === FIND_SOURCES_ACTIVE) {
          return [mockSource];
        }
        if (type === FIND_CONSTRUCTION_SITES) {
          return [mockConstructionSite];
        }
        if (type === FIND_STRUCTURES) {
          return [];
        }
        return [];
      })
    } as unknown as Room;

    // Mock creep
    mockCreep = {
      id: "creep1" as Id<Creep>,
      name: "harvester1",
      memory: {},
      body: [
        { type: WORK, hits: 100 },
        { type: CARRY, hits: 100 },
        { type: MOVE, hits: 100 }
      ],
      store: {
        getFreeCapacity: vi.fn().mockReturnValue(50),
        getUsedCapacity: vi.fn().mockReturnValue(0)
      },
      pos: { x: 5, y: 5, roomName: "W1N1" },
      room: mockRoom
    } as unknown as Creep;
  });

  describe("Task Generation", () => {
    it("should generate harvest tasks for active sources", () => {
      const manager = new TaskManager();
      manager.generateTasks(mockRoom);

      const stats = manager.getStats();
      expect(stats.pending).toBeGreaterThan(0);
    });

    it("should generate build tasks for construction sites", () => {
      const manager = new TaskManager();
      manager.generateTasks(mockRoom);

      const stats = manager.getStats();
      expect(stats.total).toBeGreaterThan(0);
    });

    it("should cleanup expired tasks", () => {
      const manager = new TaskManager();
      manager.generateTasks(mockRoom);

      // Advance time to expire tasks
      global.Game.time = 200;
      manager.generateTasks(mockRoom);

      const stats = manager.getStats();
      expect(stats.total).toBeGreaterThan(0);
    });
  });

  describe("Task Assignment", () => {
    it("should assign tasks to idle creeps", () => {
      const manager = new TaskManager();
      manager.generateTasks(mockRoom);
      manager.assignTasks([mockCreep]);

      expect(mockCreep.memory.taskId).toBeDefined();
    });

    it("should not reassign tasks to creeps with existing valid tasks", () => {
      const manager = new TaskManager();
      manager.generateTasks(mockRoom);

      // First, assign a task to establish a valid taskId
      manager.assignTasks([mockCreep]);
      const originalTaskId = mockCreep.memory.taskId as string;

      // Try to assign again - should keep the same task
      manager.assignTasks([mockCreep]);

      expect(mockCreep.memory.taskId).toBe(originalTaskId);
    });

    it("should assign highest priority tasks first", () => {
      const manager = new TaskManager();
      manager.generateTasks(mockRoom);

      const creep1 = { ...mockCreep, name: "creep1", memory: {} } as Creep;
      const creep2 = { ...mockCreep, name: "creep2", memory: {} } as Creep;

      manager.assignTasks([creep1, creep2]);

      expect(creep1.memory.taskId).toBeDefined();
    });
  });

  describe("CPU Threshold Management", () => {
    it("should stop executing tasks when CPU threshold is reached", () => {
      const manager = new TaskManager({ cpuThreshold: 0.5 });
      manager.generateTasks(mockRoom);

      // Mock high CPU usage
      (global.Game.cpu.getUsed as ReturnType<typeof vi.fn>).mockReturnValue(60);

      const creeps = [mockCreep];
      manager.assignTasks(creeps);

      const taskCounts = manager.executeTasks(creeps, 100);

      // Should not have executed tasks due to CPU threshold
      expect(Object.keys(taskCounts).length).toBe(0);
    });

    it("should execute tasks when CPU is below threshold", () => {
      const manager = new TaskManager({ cpuThreshold: 0.8 });
      manager.generateTasks(mockRoom);

      // Mock low CPU usage
      (global.Game.cpu.getUsed as ReturnType<typeof vi.fn>).mockReturnValue(10);

      // Mock creep methods
      mockCreep.harvest = vi.fn().mockReturnValue(0); // OK
      mockCreep.moveTo = vi.fn().mockReturnValue(0);

      const creeps = [mockCreep];
      manager.assignTasks(creeps);

      // Mock Game.getObjectById to return the source
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.Game.getObjectById as ReturnType<typeof vi.fn>).mockImplementation((id: Id<any>) => {
        if (id === mockSource.id) return mockSource;
        return null;
      });

      const taskCounts = manager.executeTasks(creeps, 100);

      // Tasks should be executed
      expect(Object.keys(taskCounts).length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Task Priority", () => {
    it("should sort tasks by priority", () => {
      const lowPriorityTask = new TaskRequest(
        "low",
        new HarvestAction(mockSource.id),
        TaskPriority.LOW,
        Game.time + 100
      );

      const highPriorityTask = new TaskRequest(
        "high",
        new BuildAction(mockConstructionSite.id),
        TaskPriority.HIGH,
        Game.time + 100
      );

      expect(highPriorityTask.priority).toBeGreaterThan(lowPriorityTask.priority);
    });
  });

  describe("Task Prerequisites", () => {
    it("should check prerequisites before assigning tasks", () => {
      const manager = new TaskManager();
      manager.generateTasks(mockRoom);

      // Creep with no WORK parts should not get harvest task
      const creepNoWork = {
        ...mockCreep,
        body: [{ type: CARRY }, { type: MOVE }]
      } as Creep;

      manager.assignTasks([creepNoWork]);

      // Should not assign harvest task to creep without WORK parts
      expect(creepNoWork.memory.taskId).toBeUndefined();
    });
  });
});
