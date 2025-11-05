import { describe, expect, it, vi } from "vitest";
import { Kernel } from "@runtime/bootstrap/kernel";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import { MemoryManager } from "@runtime/memory/MemoryManager";
import { PerformanceTracker } from "@runtime/metrics/PerformanceTracker";
import type { GameContext, CreepLike, RoomLike } from "@runtime/types/GameContext";

/**
 * Regression test for issue #417: CPU timeout errors on shard3
 *
 * This test validates systematic CPU timeout prevention at all identified
 * failure locations from the shard3 incidents:
 * - main:637 (PerformanceTracker.end)
 * - main:826 (Kernel.run - behavior execution)
 * - main:872 (loop/main entry point)
 * - runtime:20941 (Memory access in loop)
 *
 * Related issues:
 * - #417: CPU timeout errors on shard3 requiring systematic analysis
 * - #396: Systematic CPU timeout pattern resolution
 * - #364: Incremental CPU guards implementation
 * - #392: Proactive CPU monitoring system
 */
describe("CPU timeout prevention for shard3 systematic analysis (issue #417)", () => {
  function createMockCreep(name: string, role: string): CreepLike {
    const mockRoom: RoomLike = {
      name: "W0N0",
      controller: {
        id: "controller-1" as Id<StructureController>,
        level: 1,
        progress: 0,
        progressTotal: 200,
        pos: { x: 25, y: 25 } as RoomPosition
      } as StructureController,
      find: vi.fn(() => [])
    };

    return {
      name,
      memory: { role, task: "harvest", version: 1 },
      store: {
        getFreeCapacity: vi.fn(() => 50),
        getUsedCapacity: vi.fn(() => 0)
      },
      pos: {
        findClosestByPath: vi.fn(() => null)
      },
      room: mockRoom,
      harvest: vi.fn(() => OK),
      transfer: vi.fn(() => OK),
      moveTo: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK)
    };
  }

  describe("Incremental CPU guards at critical execution phases", () => {
    it("should abort after respawn check when CPU threshold exceeded", () => {
      const warn = vi.fn();
      const log = vi.fn();
      const kernel = new Kernel({
        cpuEmergencyThreshold: 0.9,
        logger: { log, warn }
      });

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: null,
        find: vi.fn(() => [])
      };

      let cpuReading = 5;
      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: () => cpuReading,
          limit: 20,
          bucket: 1000
        },
        creeps: {
          creep1: createMockCreep("creep1", "harvester")
        },
        spawns: {
          spawn1: {
            name: "spawn1",
            spawning: null,
            spawnCreep: vi.fn().mockReturnValue(OK),
            store: { getFreeCapacity: () => 300, getUsedCapacity: () => 0 },
            room: mockRoom
          }
        },
        rooms: { W0N0: mockRoom }
      };

      const memory = { creepCounter: 0 } as Memory;

      // Simulate CPU spike after respawn check
      let callCount = 0;
      game.cpu.getUsed = () => {
        callCount++;
        // First call: initial check (passes) - tracker.begin
        // Second call: emergency check (passes)
        // Third call: after respawn check (trigger abort)
        if (callCount >= 3) {
          cpuReading = 19; // 95% - exceeds 90% threshold
        }
        return cpuReading;
      };

      kernel.run(game, memory);

      // Should have warned about CPU threshold after respawn check
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/CPU threshold exceeded after respawn check/));

      // Should still have stored system report
      expect(memory.systemReport).toBeDefined();
    });

    it("should abort after memory operations when CPU threshold exceeded", () => {
      const warn = vi.fn();
      const log = vi.fn();

      // Create a MemoryManager that consumes significant CPU
      const expensiveMemoryManager = new MemoryManager({ log, warn });

      const kernel = new Kernel({
        cpuEmergencyThreshold: 0.9,
        memoryManager: expensiveMemoryManager,
        logger: { log, warn }
      });

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: null,
        find: vi.fn(() => [])
      };

      let cpuReading = 5;
      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: () => cpuReading,
          limit: 20,
          bucket: 1000
        },
        creeps: {
          creep1: createMockCreep("creep1", "harvester")
        },
        spawns: {
          spawn1: {
            name: "spawn1",
            spawning: null,
            spawnCreep: vi.fn().mockReturnValue(OK),
            store: { getFreeCapacity: () => 300, getUsedCapacity: () => 0 },
            room: mockRoom
          }
        },
        rooms: { W0N0: mockRoom }
      };

      const memory = { creepCounter: 0 } as Memory;

      // Simulate CPU spike after memory operations
      let callCount = 0;
      game.cpu.getUsed = () => {
        callCount++;
        // Spike after memory operations (call 4+)
        // Call 1: tracker.begin
        // Call 2: initial emergency check
        // Call 3: after respawn check
        // Call 4+: after memory operations (trigger abort)
        if (callCount >= 4) {
          cpuReading = 19; // 95% - exceeds 90% threshold
        }
        return cpuReading;
      };

      kernel.run(game, memory);

      // Should have warned about CPU threshold after memory operations
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/CPU threshold exceeded after memory operations/));

      expect(memory.systemReport).toBeDefined();
    });

    it("should abort after construction planning when CPU threshold exceeded", () => {
      const warn = vi.fn();
      const log = vi.fn();
      const kernel = new Kernel({
        cpuEmergencyThreshold: 0.9,
        logger: { log, warn }
      });

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: null,
        find: vi.fn(() => [])
      };

      let cpuReading = 5;
      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: () => cpuReading,
          limit: 20,
          bucket: 1000
        },
        creeps: {
          creep1: createMockCreep("creep1", "harvester")
        },
        spawns: {
          spawn1: {
            name: "spawn1",
            spawning: null,
            spawnCreep: vi.fn().mockReturnValue(OK),
            store: { getFreeCapacity: () => 300, getUsedCapacity: () => 0 },
            room: mockRoom
          }
        },
        rooms: { W0N0: mockRoom }
      };

      const memory = { creepCounter: 0 } as Memory;

      // Simulate CPU spike after construction planning
      let callCount = 0;
      game.cpu.getUsed = () => {
        callCount++;
        // Spike after construction planning (call 5+)
        // Call 1: tracker.begin
        // Call 2: initial emergency check
        // Call 3: after respawn check
        // Call 4: after memory operations
        // Call 5+: after construction planning (trigger abort)
        if (callCount >= 5) {
          cpuReading = 19; // 95% - exceeds 90% threshold
        }
        return cpuReading;
      };

      kernel.run(game, memory);

      // Should have warned about CPU threshold after construction planning
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/CPU threshold exceeded after construction planning/));

      expect(memory.systemReport).toBeDefined();
    });
  });

  describe("BehaviorController spawn operation CPU protection", () => {
    it("should skip spawn operations when CPU budget exceeded", () => {
      const warn = vi.fn();
      const log = vi.fn();
      const controller = new BehaviorController({ cpuSafetyMargin: 0.8 }, { log, warn });

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: null,
        find: vi.fn(() => [])
      };

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: () => 17, // 85% of 20 - exceeds 80% safety margin
          limit: 20,
          bucket: 1000
        },
        creeps: {},
        spawns: {
          spawn1: {
            name: "spawn1",
            spawning: null,
            spawnCreep: vi.fn().mockReturnValue(OK),
            store: { getFreeCapacity: () => 300, getUsedCapacity: () => 0 },
            room: mockRoom
          }
        },
        rooms: { W0N0: mockRoom }
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = {}; // No creeps, should try to spawn

      const result = controller.execute(game, memory, roleCounts);

      // Should have warned about skipping spawn operations
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/CPU budget exceeded before spawn operations.*skipping spawn checks/)
      );

      // Should have processed no creeps
      expect(result.processedCreeps).toBe(0);
      expect(result.spawnedCreeps).toHaveLength(0);
    });

    it("should complete spawn operations when CPU budget available", () => {
      const warn = vi.fn();
      const log = vi.fn();
      const controller = new BehaviorController({ cpuSafetyMargin: 0.8 }, { log, warn });

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: null,
        find: vi.fn(() => [])
      };

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: () => 5, // Well below threshold
          limit: 20,
          bucket: 5000
        },
        creeps: {},
        spawns: {
          spawn1: {
            name: "spawn1",
            spawning: null,
            spawnCreep: vi.fn().mockReturnValue(OK),
            store: { getFreeCapacity: () => 300, getUsedCapacity: () => 0 },
            room: mockRoom
          }
        },
        rooms: { W0N0: mockRoom }
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = {}; // No creeps, should try to spawn

      const result = controller.execute(game, memory, roleCounts);

      // Should NOT have warned about CPU budget
      expect(warn).not.toHaveBeenCalledWith(expect.stringMatching(/CPU budget exceeded before spawn operations/));

      // Should have spawned minimum creeps
      expect(result.spawnedCreeps.length).toBeGreaterThan(0);
    });
  });

  describe("Memory access CPU protection (runtime:20941 location)", () => {
    it("should handle memory operations within CPU budget", () => {
      const warn = vi.fn();
      const log = vi.fn();
      const memoryManager = new MemoryManager({ log, warn });

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: () => 3,
          limit: 20,
          bucket: 5000
        },
        creeps: {
          creep1: createMockCreep("creep1", "harvester"),
          creep2: createMockCreep("creep2", "upgrader")
        },
        spawns: {},
        rooms: {}
      };

      const memory = {
        creeps: {
          creep1: { role: "harvester", task: "harvest", version: 1 },
          creep2: { role: "upgrader", task: "upgrade", version: 1 },
          oldCreep: { role: "harvester", task: "harvest", version: 1 } // Should be pruned
        }
      } as Memory;

      // This should complete successfully without warnings
      memoryManager.pruneMissingCreeps(memory, game.creeps);
      const roleCounts = memoryManager.updateRoleBookkeeping(memory, game.creeps);

      expect(roleCounts).toBeDefined();
      expect(roleCounts.harvester).toBe(1);
      expect(roleCounts.upgrader).toBe(1);
      expect(memory.creeps?.oldCreep).toBeUndefined();
    });
  });

  describe("PerformanceTracker.end CPU monitoring (main:637 location)", () => {
    it("should generate warnings at critical CPU thresholds", () => {
      const warn = vi.fn();
      const log = vi.fn();
      const tracker = new PerformanceTracker(
        {
          highCpuThreshold: 0.7,
          criticalCpuThreshold: 0.9
        },
        { log, warn }
      );

      let cpuValue = 1; // Start at 1 CPU
      const game = {
        time: 100,
        cpu: {
          getUsed: () => cpuValue,
          limit: 20,
          bucket: 1000
        },
        creeps: {},
        rooms: {}
      };

      tracker.begin(game);

      // Simulate heavy CPU usage during the tick
      cpuValue = 19.5; // End at 19.5 CPU (consumed 18.5 CPU, 92.5% of limit - exceeds 90%)

      const snapshot = tracker.end(game, {
        processedCreeps: 0,
        spawnedCreeps: [],
        tasksExecuted: {}
      });

      // Should have generated critical warning
      expect(snapshot.warnings.length).toBeGreaterThan(0);
      expect(snapshot.warnings[0]).toMatch(/CRITICAL: CPU usage.*exceeds 90%.*timeout risk/);

      // Warning should have been logged
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/CRITICAL: CPU usage.*timeout risk/));
    });
  });

  describe("Full integration test for systematic timeout prevention", () => {
    it("should handle complete tick cycle with multiple CPU guards", () => {
      const warn = vi.fn();
      const log = vi.fn();
      const kernel = new Kernel({
        cpuEmergencyThreshold: 0.95,
        logger: { log, warn }
      });

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: {
          id: "controller-1" as Id<StructureController>,
          level: 1,
          progress: 0,
          progressTotal: 200,
          pos: { x: 25, y: 25 } as RoomPosition
        } as StructureController,
        find: vi.fn(() => [])
      };

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: () => 5, // Normal CPU usage
          limit: 20,
          bucket: 5000
        },
        creeps: {
          creep1: createMockCreep("creep1", "harvester"),
          creep2: createMockCreep("creep2", "upgrader")
        },
        spawns: {
          spawn1: {
            name: "spawn1",
            spawning: null,
            spawnCreep: vi.fn().mockReturnValue(OK),
            store: { getFreeCapacity: () => 300, getUsedCapacity: () => 0 },
            room: mockRoom
          }
        },
        rooms: { W0N0: mockRoom }
      };

      const memory = { creepCounter: 0 } as Memory;

      // Should complete successfully
      kernel.run(game, memory);

      // Should NOT have triggered emergency CPU warnings
      expect(warn).not.toHaveBeenCalledWith(expect.stringMatching(/Emergency CPU threshold exceeded/));
      expect(warn).not.toHaveBeenCalledWith(expect.stringMatching(/CPU threshold exceeded after/));

      // Should have completed evaluation
      expect(memory.systemReport).toBeDefined();
      expect(memory.systemReport?.report).toBeDefined();
    });
  });
});
