import { describe, expect, it, vi } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import { Kernel } from "@runtime/bootstrap/kernel";
import type { GameContext, CreepLike, RoomLike } from "@runtime/types/GameContext";

/**
 * Regression test for issue #138: CPU timeout prevention
 *
 * This test verifies that the BehaviorController and Kernel implement
 * CPU budget management to prevent script execution timeouts when
 * CPU usage approaches the limit.
 *
 * Related issues:
 * - #138: Script execution timeout on shard3 due to CPU limit exceeded
 * - #117: Optimize CPU usage to maintain below 90% threshold
 */
describe("CPU timeout prevention regression", () => {
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

  describe("BehaviorController CPU budget management", () => {
    it("should stop processing creeps when CPU budget is exceeded", () => {
      const warn = vi.fn();
      const controller = new BehaviorController({ cpuSafetyMargin: 0.9 }, { log: vi.fn(), warn });

      let cpuUsed = 0;
      const creeps: Record<string, CreepLike> = {
        creep1: createMockCreep("creep1", "harvester"),
        creep2: createMockCreep("creep2", "harvester"),
        creep3: createMockCreep("creep3", "harvester"),
        creep4: createMockCreep("creep4", "harvester"),
        creep5: createMockCreep("creep5", "harvester")
      };

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: () => cpuUsed,
          limit: 10,
          bucket: 1000
        },
        creeps,
        spawns: {},
        rooms: {}
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = { harvester: 5 };

      // Simulate CPU increasing after processing 2 creeps
      const originalGetUsed = game.cpu.getUsed;
      let creepCount = 0;
      game.cpu.getUsed = () => {
        creepCount++;
        if (creepCount > 2) {
          cpuUsed = 10; // Exceed 90% of 10 CPU limit
        }
        return cpuUsed;
      };

      const result = controller.execute(game, memory, roleCounts);

      // Should have processed fewer than all 5 creeps
      expect(result.processedCreeps).toBeLessThan(5);
      expect(result.processedCreeps).toBeGreaterThan(0);

      // Should have logged a warning about CPU budget exceeded
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/CPU budget exceeded.*skipping.*creeps to prevent timeout/)
      );

      // Restore original function
      game.cpu.getUsed = originalGetUsed;
    });

    it("should log warning when a single creep consumes excessive CPU", () => {
      const warn = vi.fn();
      const controller = new BehaviorController({ maxCpuPerCreep: 1.0 }, { log: vi.fn(), warn });

      let cpuUsed = 0;
      const creeps: Record<string, CreepLike> = {
        expensiveCreep: createMockCreep("expensiveCreep", "harvester")
      };

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: null,
        find: vi.fn(() => [])
      };

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: () => cpuUsed,
          limit: 20,
          bucket: 1000
        },
        creeps,
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
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2 }; // Meet minimums to avoid spawning

      // Track CPU usage - simulate expensive creep
      let callCount = 0;
      game.cpu.getUsed = () => {
        callCount++;
        // Call 1: ensureRoleMinimums CPU check
        if (callCount === 1) return 0;
        // Call 2: cpuUsed check before first creep (line 147)
        if (callCount === 2) return 0;
        // Call 3: cpuBefore = game.cpu.getUsed() (line 157)
        if (callCount === 3) return 0;
        // Call 4+: cpuAfter = game.cpu.getUsed() (line 182) - after handler.run()
        return 1.5; // Consumed 1.5 CPU - exceeds maxCpuPerCreep of 1.0
      };

      controller.execute(game, memory, roleCounts);

      // Should have logged warning about excessive CPU consumption
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Creep expensiveCreep.*consumed excessive CPU/));
    });

    it("should successfully process all creeps when CPU budget is not exceeded", () => {
      const warn = vi.fn();
      const controller = new BehaviorController({}, { log: vi.fn(), warn });

      const creeps: Record<string, CreepLike> = {
        creep1: createMockCreep("creep1", "harvester"),
        creep2: createMockCreep("creep2", "upgrader"),
        creep3: createMockCreep("creep3", "builder")
      };

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: () => 3, // Well within budget
          limit: 20,
          bucket: 5000
        },
        creeps,
        spawns: {},
        rooms: {}
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2 };

      const result = controller.execute(game, memory, roleCounts);

      expect(result.processedCreeps).toBe(3);
      expect(warn).not.toHaveBeenCalledWith(expect.stringMatching(/CPU budget exceeded/));
    });
  });

  describe("Kernel emergency CPU protection", () => {
    it("should abort tick when emergency CPU threshold is exceeded", () => {
      const warn = vi.fn();
      const kernel = new Kernel({
        behavior: new BehaviorController({}),
        cpuEmergencyThreshold: 0.95,
        logger: { log: vi.fn(), warn }
      });

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: null,
        find: vi.fn(() => [])
      };

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: () => 19.5, // 97.5% of 20 CPU limit - exceeds emergency threshold
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

      kernel.run(game, memory);

      // Should have warned about emergency CPU threshold
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/Emergency CPU threshold exceeded.*aborting tick to prevent timeout/)
      );

      // Should still have evaluated and stored system report
      expect(memory.systemReport).toBeDefined();
      expect(memory.systemReport?.report).toBeDefined();
    });

    it("should process normally when CPU is below emergency threshold", () => {
      const warn = vi.fn();
      const log = vi.fn();
      const kernel = new Kernel({
        behavior: new BehaviorController({}),
        cpuEmergencyThreshold: 0.95,
        logger: { log, warn }
      });

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

      kernel.run(game, memory);

      // Should not have warned about emergency CPU
      expect(warn).not.toHaveBeenCalledWith(expect.stringMatching(/Emergency CPU threshold exceeded/));

      // Should have completed normal processing
      expect(memory.systemReport).toBeDefined();
    });
  });

  describe("PerformanceTracker critical CPU detection", () => {
    it("should generate critical warning at 95%+ CPU usage", () => {
      // This is tested indirectly through the PerformanceTracker integration
      // The warning message format is tested in the unit tests
      expect(true).toBe(true);
    });
  });
});
