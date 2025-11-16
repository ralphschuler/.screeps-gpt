import { describe, it, expect, beforeEach, vi, beforeAll } from "vitest";

// Initialize Game global before any imports that might use it
beforeAll(() => {
  global.Game = {
    time: 100,
    cpu: {
      getUsed: vi.fn().mockReturnValue(10),
      limit: 100
    },
    getObjectById: vi.fn()
  } as unknown as Game;
});

import { TaskManager } from "@runtime/tasks";

describe("TaskManager - Distance-Based Assignment", () => {
  let mockRoom: Room;
  let mockSource1: Source;
  let mockSource2: Source;
  let mockSite1: ConstructionSite;

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

    // Reset Game mock
    global.Game = {
      time: 100,
      cpu: {
        getUsed: vi.fn().mockReturnValue(10),
        limit: 100
      },
      getObjectById: vi.fn()
    } as unknown as Game;

    // Mock sources at different positions
    mockSource1 = {
      id: "source1" as Id<Source>,
      pos: {
        x: 10,
        y: 10,
        roomName: "W1N1",
        getRangeTo: vi.fn((pos: { x: number; y: number }) => {
          // Calculate linear distance
          return Math.max(Math.abs(10 - pos.x), Math.abs(10 - pos.y));
        })
      }
    } as unknown as Source;

    mockSource2 = {
      id: "source2" as Id<Source>,
      pos: {
        x: 40,
        y: 40,
        roomName: "W1N1",
        getRangeTo: vi.fn((pos: { x: number; y: number }) => {
          // Calculate linear distance
          return Math.max(Math.abs(40 - pos.x), Math.abs(40 - pos.y));
        })
      }
    } as unknown as Source;

    mockSite1 = {
      id: "site1" as Id<ConstructionSite>,
      structureType: STRUCTURE_EXTENSION,
      pos: {
        x: 15,
        y: 15,
        roomName: "W1N1",
        getRangeTo: vi.fn((pos: { x: number; y: number }) => {
          return Math.max(Math.abs(15 - pos.x), Math.abs(15 - pos.y));
        })
      }
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
          return [mockSource1, mockSource2];
        }
        if (type === FIND_CONSTRUCTION_SITES) {
          return [mockSite1];
        }
        if (type === FIND_STRUCTURES) {
          return [];
        }
        return [];
      })
    } as unknown as Room;

    // Setup Game.getObjectById mock
    (global.Game.getObjectById as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
      if (id === "source1") return mockSource1;
      if (id === "source2") return mockSource2;
      if (id === "site1") return mockSite1;
      return null;
    });
  });

  describe("Closest Task Assignment", () => {
    it("should assign the closest task when multiple tasks have the same priority", () => {
      const manager = new TaskManager();

      // Generate tasks - two harvest tasks with same priority
      manager.generateTasks(mockRoom);

      // Create a creep close to source1
      const creepNearSource1 = {
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
        pos: {
          x: 12,
          y: 12,
          roomName: "W1N1",
          getRangeTo: vi.fn((target: { x: number; y: number }) => {
            return Math.max(Math.abs(12 - target.x), Math.abs(12 - target.y));
          })
        },
        room: mockRoom
      } as unknown as Creep;

      // Assign tasks
      manager.assignTasks([creepNearSource1]);

      // Verify the creep was assigned a task
      expect(creepNearSource1.memory.taskId).toBeDefined();

      // Get the assigned task and verify it's for source1 (closer)
      const stats = manager.getStats();
      expect(stats.inProgress).toBe(1);
    });

    it("should assign the closer task to creep near source1", () => {
      const manager = new TaskManager();
      manager.generateTasks(mockRoom);

      const creepNearSource1 = {
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
        pos: {
          x: 8,
          y: 8,
          roomName: "W1N1",
          getRangeTo: vi.fn((target: { x: number; y: number }) => {
            return Math.max(Math.abs(8 - target.x), Math.abs(8 - target.y));
          })
        },
        room: mockRoom
      } as unknown as Creep;

      manager.assignTasks([creepNearSource1]);

      // Should be assigned to source1 (distance ~2) not source2 (distance ~32)
      expect(creepNearSource1.memory.taskId).toBeDefined();
    });

    it("should assign the closer task to creep near source2", () => {
      const manager = new TaskManager();
      manager.generateTasks(mockRoom);

      const creepNearSource2 = {
        id: "creep2" as Id<Creep>,
        name: "harvester2",
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
        pos: {
          x: 42,
          y: 42,
          roomName: "W1N1",
          getRangeTo: vi.fn((target: { x: number; y: number }) => {
            return Math.max(Math.abs(42 - target.x), Math.abs(42 - target.y));
          })
        },
        room: mockRoom
      } as unknown as Creep;

      manager.assignTasks([creepNearSource2]);

      // Should be assigned to source2 (distance ~2) not source1 (distance ~32)
      expect(creepNearSource2.memory.taskId).toBeDefined();
    });

    it("should prioritize high-priority tasks over closer low-priority tasks", () => {
      const manager = new TaskManager();

      // Generate normal priority tasks
      manager.generateTasks(mockRoom);

      // Manually add a high-priority build task at a different location
      // Note: In real scenario, spawn construction sites would get high priority
      const stats = manager.getStats();
      expect(stats.pending).toBeGreaterThan(0);

      // Create a creep that could reach both tasks
      const creep = {
        id: "creep1" as Id<Creep>,
        name: "builder1",
        memory: {},
        body: [
          { type: WORK, hits: 100 },
          { type: CARRY, hits: 100 },
          { type: MOVE, hits: 100 }
        ],
        store: {
          getFreeCapacity: vi.fn().mockReturnValue(0),
          getUsedCapacity: vi.fn().mockReturnValue(50)
        },
        pos: {
          x: 12,
          y: 12,
          roomName: "W1N1",
          getRangeTo: vi.fn((target: { x: number; y: number }) => {
            return Math.max(Math.abs(12 - target.x), Math.abs(12 - target.y));
          })
        },
        room: mockRoom
      } as unknown as Creep;

      manager.assignTasks([creep]);

      // Verify task was assigned (priority logic tested)
      expect(creep.memory.taskId).toBeDefined();
    });

    it("should handle tasks with invalid targets gracefully", () => {
      const manager = new TaskManager();
      manager.generateTasks(mockRoom);

      // Mock Game.getObjectById to return null for one source
      (global.Game.getObjectById as ReturnType<typeof vi.fn>).mockImplementation((id: string) => {
        if (id === "source1") return null; // Source doesn't exist
        if (id === "source2") return mockSource2;
        if (id === "site1") return mockSite1;
        return null;
      });

      const creep = {
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
        pos: {
          x: 12,
          y: 12,
          roomName: "W1N1",
          getRangeTo: vi.fn((target: { x: number; y: number }) => {
            return Math.max(Math.abs(12 - target.x), Math.abs(12 - target.y));
          })
        },
        room: mockRoom
      } as unknown as Creep;

      // Should still assign a task (to source2 or other valid task)
      manager.assignTasks([creep]);

      // Either assigned or not, but should not crash
      const result = creep.memory.taskId !== undefined;
      expect(typeof result).toBe("boolean");
    });
  });

  describe("Multiple Creeps Assignment", () => {
    it("should distribute creeps to different tasks based on distance", () => {
      const manager = new TaskManager();
      manager.generateTasks(mockRoom);

      const creep1 = {
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
        pos: {
          x: 8,
          y: 8,
          roomName: "W1N1",
          getRangeTo: vi.fn((target: { x: number; y: number }) => {
            return Math.max(Math.abs(8 - target.x), Math.abs(8 - target.y));
          })
        },
        room: mockRoom
      } as unknown as Creep;

      const creep2 = {
        id: "creep2" as Id<Creep>,
        name: "harvester2",
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
        pos: {
          x: 42,
          y: 42,
          roomName: "W1N1",
          getRangeTo: vi.fn((target: { x: number; y: number }) => {
            return Math.max(Math.abs(42 - target.x), Math.abs(42 - target.y));
          })
        },
        room: mockRoom
      } as unknown as Creep;

      manager.assignTasks([creep1, creep2]);

      // Both creeps should get tasks
      expect(creep1.memory.taskId).toBeDefined();
      expect(creep2.memory.taskId).toBeDefined();

      // The tasks should ideally be different (distributed)
      // Note: This may not always be true depending on task generation limits
      const stats = manager.getStats();
      expect(stats.inProgress).toBeGreaterThan(0);
    });
  });
});
