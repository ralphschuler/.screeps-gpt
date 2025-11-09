import { describe, expect, it, vi } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import { PerformanceTracker } from "@runtime/metrics/PerformanceTracker";
import { Kernel } from "@runtime/bootstrap/kernel";
import type { GameContext, CreepLike, RoomLike } from "@runtime/types/GameContext";

/**
 * Regression test for CPU optimization to maintain below 90% threshold
 *
 * This test verifies that the system implements conservative CPU management
 * defaults to prevent sustained high CPU usage that could lead to timeouts.
 *
 * Related issues:
 * - CPU optimization issue: perf: optimize CPU usage to maintain below 90% threshold ([#117](https://github.com/your-org/your-repo/issues/117))
 * - Account upgrade: chore: account upgraded to lifetime subscription with increased resources
 *
 * Key optimizations verified:
 * 1. BehaviorController uses 85% CPU safety margin by default (updated for 150 CPU limit)
 * 2. PerformanceTracker warns at 75% and critical at 90%
 * 3. Kernel emergency threshold at 90%
 * 4. Movement operations use higher reusePath values (30-50 ticks)
 *
 * Note: Thresholds were adjusted after account upgrade from 20 CPU to 150 CPU (lifetime subscription).
 * The new thresholds provide similar safety margins while accounting for the increased resource allocation.
 */
describe("CPU optimization regression - 90% threshold", () => {
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

  describe("BehaviorController default CPU safety margin", () => {
    it("should use 85% CPU safety margin by default", () => {
      const warn = vi.fn();
      const controller = new BehaviorController({ useTaskSystem: false }, { log: vi.fn(), warn });

      let cpuUsed = 0;
      const creeps: Record<string, CreepLike> = {
        creep1: createMockCreep("creep1", "harvester"),
        creep2: createMockCreep("creep2", "harvester"),
        creep3: createMockCreep("creep3", "harvester")
      };

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: () => cpuUsed,
          limit: 10,
          bucket: 5000
        },
        creeps,
        spawns: {},
        rooms: {}
      };

      const memory = { creepCounter: 0 } as Memory;
      const roleCounts = { harvester: 3 };

      // Simulate CPU reaching 90% (9.0 of 10 limit) - should trigger stopping
      let callCount = 0;
      game.cpu.getUsed = () => {
        callCount++;
        if (callCount > 2) {
          cpuUsed = 9.0; // 90% of limit, exceeds 85% safety margin
        }
        return cpuUsed;
      };

      const result = controller.execute(game, memory, roleCounts);

      // Should have stopped processing before all creeps
      expect(result.processedCreeps).toBeLessThan(3);
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/CPU budget exceeded.*skipping.*creeps/));
    });

    it("should use 1.5 CPU per creep threshold by default", () => {
      const warn = vi.fn();
      const controller = new BehaviorController({ useTaskSystem: false }, { log: vi.fn(), warn });

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
          getUsed: vi
            .fn()
            .mockReturnValueOnce(0) // CPU check before spawn
            .mockReturnValueOnce(0) // CPU check before creep
            .mockReturnValueOnce(0) // cpuBefore
            .mockReturnValueOnce(1.6), // cpuAfter - exceeds 1.5 threshold
          limit: 20,
          bucket: 5000
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
      const roleCounts = { harvester: 4, upgrader: 3, builder: 2 }; // Meet minimums

      controller.execute(game, memory, roleCounts);

      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/expensiveCreep.*consumed excessive CPU/));
    });
  });

  describe("PerformanceTracker default thresholds", () => {
    it("should warn at 75% CPU usage by default", () => {
      const warn = vi.fn();
      const log = vi.fn();
      const tracker = new PerformanceTracker({}, { log, warn });

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: vi
            .fn()
            .mockReturnValueOnce(0) // begin()
            .mockReturnValueOnce(8.0), // end() - 80% of 10 limit, exceeds 75% threshold
          limit: 10,
          bucket: 5000
        },
        creeps: {},
        rooms: {}
      };

      tracker.begin(game);
      const snapshot = tracker.end(game, {
        processedCreeps: 0,
        spawnedCreeps: [],
        tasksExecuted: {}
      });

      expect(snapshot.warnings.length).toBeGreaterThan(0);
      expect(snapshot.warnings.some(w => /High CPU usage/.test(w))).toBe(true);
    });

    it("should generate critical warning at 90% CPU usage by default", () => {
      const warn = vi.fn();
      const log = vi.fn();
      const tracker = new PerformanceTracker({}, { log, warn });

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: vi
            .fn()
            .mockReturnValueOnce(0) // begin()
            .mockReturnValueOnce(9.5), // end() - 95% of 10 limit
          limit: 10,
          bucket: 5000
        },
        creeps: {},
        rooms: {}
      };

      tracker.begin(game);
      const snapshot = tracker.end(game, {
        processedCreeps: 0,
        spawnedCreeps: [],
        tasksExecuted: {}
      });

      expect(snapshot.warnings.length).toBeGreaterThan(0);
      expect(snapshot.warnings.some(w => /CRITICAL.*CPU usage.*exceeds 90%/.test(w))).toBe(true);
    });

    it("should not warn when CPU is below 75% threshold", () => {
      const warn = vi.fn();
      const log = vi.fn();
      const tracker = new PerformanceTracker({}, { log, warn });

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: vi
            .fn()
            .mockReturnValueOnce(0) // begin()
            .mockReturnValueOnce(7.0), // end() - 70% of 10 limit, below 75% threshold
          limit: 10,
          bucket: 5000
        },
        creeps: {},
        rooms: {}
      };

      tracker.begin(game);
      const snapshot = tracker.end(game, {
        processedCreeps: 0,
        spawnedCreeps: [],
        tasksExecuted: {}
      });

      expect(snapshot.warnings).toHaveLength(0);
    });
  });

  describe("Kernel emergency CPU threshold", () => {
    it("should use 90% emergency threshold by default", () => {
      const warn = vi.fn();
      const kernel = new Kernel({
        behavior: new BehaviorController({ useTaskSystem: false }),
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
          getUsed: () => 9.5, // 95% of 10 CPU limit - exceeds 90% emergency threshold
          limit: 10,
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

      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Emergency CPU threshold exceeded.*aborting tick/));
    });

    it("should process normally at 85% CPU (below 90% emergency threshold)", () => {
      const warn = vi.fn();
      const log = vi.fn();
      const kernel = new Kernel({ behavior: new BehaviorController({ useTaskSystem: false }), logger: { log, warn } });

      const mockRoom: RoomLike = {
        name: "W0N0",
        controller: null,
        find: vi.fn(() => [])
      };

      const game: GameContext = {
        time: 100,
        cpu: {
          getUsed: () => 8.5, // 85% - below emergency threshold
          limit: 10,
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

      // Should not trigger emergency CPU warning
      expect(warn).not.toHaveBeenCalledWith(expect.stringMatching(/Emergency CPU threshold exceeded/));

      // Should complete processing
      expect(memory.systemReport).toBeDefined();
    });
  });
});
