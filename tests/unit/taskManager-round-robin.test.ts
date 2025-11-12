import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskManager } from "@runtime/tasks";

/**
 * Tests for round-robin scheduling and starvation prevention in TaskManager.
 * Validates that creeps get fair execution opportunity regardless of CPU constraints.
 */
describe("TaskManager - Round-Robin Scheduling", () => {
  let mockRoom: Room;
  let mockCreeps: Creep[];

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

    // Mock room
    mockRoom = {
      name: "W1N1",
      controller: {
        my: true,
        id: "controller1" as Id<StructureController>
      },
      find: vi.fn(() => [])
    } as unknown as Room;

    // Create multiple mock creeps for testing
    mockCreeps = [];
    for (let i = 0; i < 10; i++) {
      mockCreeps.push({
        id: `creep${i}` as Id<Creep>,
        name: `creep${i}`,
        memory: {},
        body: [{ type: WORK }, { type: CARRY }, { type: MOVE }],
        store: {
          getFreeCapacity: vi.fn().mockReturnValue(50),
          getUsedCapacity: vi.fn().mockReturnValue(0)
        },
        pos: { x: 5 + i, y: 5, roomName: "W1N1" },
        room: mockRoom
      } as unknown as Creep);
    }
  });

  describe("Round-Robin Processing", () => {
    it("should process creeps starting from different offsets each tick", () => {
      const manager = new TaskManager({ cpuThreshold: 0.8 });
      const processedNames: string[][] = [];

      // Mock low CPU so all creeps can be processed
      (global.Game.cpu.getUsed as ReturnType<typeof vi.fn>).mockReturnValue(10);

      // Execute multiple ticks and track order
      for (let tick = 0; tick < 5; tick++) {
        global.Game.time = 100 + tick;
        const names: string[] = [];

        // Track which creeps would be processed by intercepting array access
        const trackedCreeps = new Proxy(mockCreeps, {
          get(target, prop) {
            if (typeof prop === "string" && !isNaN(Number(prop))) {
              const index = Number(prop);
              if (index >= 0 && index < target.length) {
                names.push(target[index].name);
              }
            }
            return target[prop as keyof typeof target];
          }
        });

        manager.executeTasks(trackedCreeps as unknown as Creep[], 100);
        processedNames.push(names);
      }

      // Verify that different creeps are processed first in different ticks
      const firstCreepPerTick = processedNames.map(names => names[0]);
      const uniqueFirstCreeps = new Set(firstCreepPerTick);

      // Should have multiple different first creeps across ticks
      expect(uniqueFirstCreeps.size).toBeGreaterThan(1);
    });

    it("should update lastExecuted timestamp for all processed creeps", () => {
      const manager = new TaskManager({ cpuThreshold: 0.8 });

      // Mock low CPU
      (global.Game.cpu.getUsed as ReturnType<typeof vi.fn>).mockReturnValue(10);
      global.Game.time = 100;

      manager.executeTasks(mockCreeps, 100);

      // Check starvation stats - all creeps should have been executed
      const stats = manager.getStarvationStats(mockCreeps);
      expect(stats.maxTicksSinceExecution).toBe(0);
      expect(stats.starvedCreeps.length).toBe(0);
    });

    it("should distribute execution fairly over multiple ticks with CPU constraints", () => {
      const manager = new TaskManager({ cpuThreshold: 0.5 });
      const executionCounts = new Map<string, number>();

      // Initialize counts
      mockCreeps.forEach(creep => executionCounts.set(creep.name, 0));

      // Simulate 20 ticks with CPU constraints
      for (let tick = 0; tick < 20; tick++) {
        global.Game.time = 100 + tick;

        // Mock CPU that increases with each creep processed
        let cpuUsage = 10;
        (global.Game.cpu.getUsed as ReturnType<typeof vi.fn>).mockImplementation(() => {
          cpuUsage += 5;
          return cpuUsage;
        });

        manager.executeTasks(mockCreeps, 100);
      }

      // Get execution distribution
      const stats = manager.getStarvationStats(mockCreeps);

      // With round-robin, even if we can't process all creeps each tick,
      // over 20 ticks all creeps should eventually get executed
      // Max ticks since execution should be reasonable (less than 10)
      expect(stats.maxTicksSinceExecution).toBeLessThan(10);
    });
  });

  describe("Starvation Prevention", () => {
    it("should identify starved creeps", () => {
      const manager = new TaskManager({ cpuThreshold: 0.8 });

      // Process only first 5 creeps by setting high CPU after them
      let processedCount = 0;
      (global.Game.cpu.getUsed as ReturnType<typeof vi.fn>).mockImplementation(() => {
        processedCount++;
        return processedCount > 5 ? 90 : 10; // Exceed threshold after 5 creeps
      });

      // Execute for first tick
      global.Game.time = 100;
      manager.executeTasks(mockCreeps, 100);

      // Advance time by 6 ticks without executing the skipped creeps
      global.Game.time = 106;

      const stats = manager.getStarvationStats(mockCreeps);

      // Some creeps should be identified as starved (not executed for 5+ ticks)
      expect(stats.starvedCreeps.length).toBeGreaterThan(0);
      expect(stats.maxTicksSinceExecution).toBeGreaterThan(5);
    });

    it("should provide accurate average ticks since execution", () => {
      const manager = new TaskManager({ cpuThreshold: 0.8 });

      // Execute all creeps at tick 100
      (global.Game.cpu.getUsed as ReturnType<typeof vi.fn>).mockReturnValue(10);
      global.Game.time = 100;
      manager.executeTasks(mockCreeps, 100);

      // Advance time and check average
      global.Game.time = 103;
      const stats = manager.getStarvationStats(mockCreeps);

      // All creeps executed 3 ticks ago
      expect(stats.avgTicksSinceExecution).toBe(3);
      expect(stats.maxTicksSinceExecution).toBe(3);
    });

    it("should reset starvation tracking when creep is executed", () => {
      const manager = new TaskManager({ cpuThreshold: 0.8 });

      // First tick: execute all
      (global.Game.cpu.getUsed as ReturnType<typeof vi.fn>).mockReturnValue(10);
      global.Game.time = 100;
      manager.executeTasks(mockCreeps, 100);

      // Skip several ticks
      global.Game.time = 105;

      // Execute again
      global.Game.time = 106;
      manager.executeTasks(mockCreeps, 100);

      // Check that tracking was reset
      const stats = manager.getStarvationStats(mockCreeps);
      expect(stats.maxTicksSinceExecution).toBe(0);
      expect(stats.starvedCreeps.length).toBe(0);
    });
  });

  describe("CPU Threshold Integration", () => {
    it("should still respect CPU threshold with round-robin", () => {
      const mockLogger = {
        log: vi.fn(),
        warn: vi.fn()
      };
      const managerWithLogger = new TaskManager({
        cpuThreshold: 0.5,
        logger: mockLogger
      });

      // Mock high CPU usage that exceeds threshold
      (global.Game.cpu.getUsed as ReturnType<typeof vi.fn>).mockReturnValue(60);

      managerWithLogger.executeTasks(mockCreeps, 100);

      // Should have logged a warning about CPU threshold
      expect(mockLogger.warn).toHaveBeenCalled();
      const warnCall = mockLogger.warn.mock.calls[0][0] as string;
      expect(warnCall).toContain("CPU threshold reached");
    });

    it("should break execution loop when CPU threshold is exceeded", () => {
      const manager = new TaskManager({ cpuThreshold: 0.5 });

      // Mock CPU that starts low but increases
      let cpuCalls = 0;
      (global.Game.cpu.getUsed as ReturnType<typeof vi.fn>).mockImplementation(() => {
        cpuCalls++;
        return cpuCalls < 3 ? 10 : 60; // Exceed threshold on 3rd call
      });

      manager.executeTasks(mockCreeps, 100);

      // Should have stopped processing early
      // With 10 creeps and stopping at 3rd, we should process fewer than all
      expect(cpuCalls).toBeLessThan(mockCreeps.length + 1);
    });

    it("should maintain round-robin offset even when CPU threshold is hit", () => {
      const manager = new TaskManager({ cpuThreshold: 0.5 });

      // First tick: process some creeps before hitting threshold
      global.Game.time = 100;
      let cpuCalls = 0;
      (global.Game.cpu.getUsed as ReturnType<typeof vi.fn>).mockImplementation(() => {
        cpuCalls++;
        return cpuCalls < 4 ? 10 : 60;
      });

      manager.executeTasks(mockCreeps, 100);

      // Second tick: offset should have advanced
      global.Game.time = 101;
      cpuCalls = 0;
      (global.Game.cpu.getUsed as ReturnType<typeof vi.fn>).mockImplementation(() => {
        cpuCalls++;
        return cpuCalls < 4 ? 10 : 60;
      });

      manager.executeTasks(mockCreeps, 100);

      // The offset mechanism should ensure different creeps are processed first
      // We can't directly observe the offset, but over multiple ticks
      // different creeps should get chances to execute
      const stats = manager.getStarvationStats(mockCreeps);
      // With rotating offset, starvation should be limited
      expect(stats.maxTicksSinceExecution).toBeLessThanOrEqual(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty creep array", () => {
      const manager = new TaskManager({ cpuThreshold: 0.8 });

      expect(() => {
        manager.executeTasks([], 100);
      }).not.toThrow();
    });

    it("should handle single creep without errors", () => {
      const manager = new TaskManager({ cpuThreshold: 0.8 });
      (global.Game.cpu.getUsed as ReturnType<typeof vi.fn>).mockReturnValue(10);

      const result = manager.executeTasks([mockCreeps[0]], 100);
      expect(result).toBeDefined();
    });

    it("should handle creeps with no tasks assigned", () => {
      const manager = new TaskManager({ cpuThreshold: 0.8 });
      (global.Game.cpu.getUsed as ReturnType<typeof vi.fn>).mockReturnValue(10);

      // Ensure creeps have no taskId
      mockCreeps.forEach(c => delete c.memory.taskId);

      const result = manager.executeTasks(mockCreeps, 100);

      // Should process without errors
      expect(result).toBeDefined();

      // Starvation tracking should still work
      const stats = manager.getStarvationStats(mockCreeps);
      expect(stats.maxTicksSinceExecution).toBe(0);
    });

    it("should wrap tickOffset correctly when it exceeds array length", () => {
      const manager = new TaskManager({ cpuThreshold: 0.8 });
      (global.Game.cpu.getUsed as ReturnType<typeof vi.fn>).mockReturnValue(10);

      // Execute many times to ensure offset wraps
      for (let i = 0; i < 25; i++) {
        global.Game.time = 100 + i;
        manager.executeTasks(mockCreeps, 100);
      }

      // Should not throw and should continue working
      const stats = manager.getStarvationStats(mockCreeps);
      expect(stats.maxTicksSinceExecution).toBeLessThan(2); // Recently executed
    });
  });
});
