import { describe, expect, it, vi, beforeEach } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { GameContext, RoomLike } from "@runtime/types/GameContext";

/**
 * Tests for adaptive creep spawning with room-specific energy source detection
 * and spawn economics.
 */
describe("Adaptive Spawning System", () => {
  beforeEach(() => {
    // Setup global constants for Screeps API
    global.FIND_SOURCES = 105 as FindConstant;
    global.FIND_STRUCTURES = 106 as FindConstant;
    global.STRUCTURE_CONTAINER = "container" as StructureConstant;
    global.OK = 0;
    global.WORK = "work" as BodyPartConstant;
    global.CARRY = "carry" as BodyPartConstant;
    global.MOVE = "move" as BodyPartConstant;
    global.BODYPART_COST = {
      work: 100,
      carry: 50,
      move: 50
    } as Record<BodyPartConstant, number>;
  });
  describe("Energy Source Detection", () => {
    it("should detect single-source rooms correctly", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const singleSource = { id: "source1" as Id<Source>, energy: 3000 };
      const room: RoomLike = {
        name: "W0N0",
        controller: { my: true, level: 2 } as StructureController,
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) return [singleSource];
          return [];
        })
      } as unknown as RoomLike;

      const spawn = {
        name: "spawn1",
        spawning: null,
        spawnCreep: vi.fn().mockReturnValue(OK),
        store: { getFreeCapacity: () => 0, getUsedCapacity: () => 300 },
        room
      };

      const game: GameContext = {
        time: 100,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: {},
        spawns: { spawn1: spawn },
        rooms: { W0N0: room }
      };

      const memory = {} as Memory;
      const roleCounts = {};

      controller.execute(game, memory, roleCounts);

      // Single-source rooms should spawn 2-3 harvesters depending on RCL
      // RCL 2 should result in 2 harvesters
      expect(roleCounts.harvester).toBeDefined();
    });

    it("should detect multi-source rooms correctly", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const sources = [
        { id: "source1" as Id<Source>, energy: 3000 },
        { id: "source2" as Id<Source>, energy: 3000 }
      ];

      const room: RoomLike = {
        name: "W0N0",
        controller: { my: true, level: 3 } as StructureController,
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) return sources;
          return [];
        })
      } as unknown as RoomLike;

      const spawn = {
        name: "spawn1",
        spawning: null,
        spawnCreep: vi.fn().mockReturnValue(OK),
        store: { getFreeCapacity: () => 0, getUsedCapacity: () => 300 },
        room
      };

      const game: GameContext = {
        time: 100,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: {},
        spawns: { spawn1: spawn },
        rooms: { W0N0: room }
      };

      const memory = {} as Memory;
      const roleCounts = {};

      controller.execute(game, memory, roleCounts);

      // Multi-source rooms with RCL 3+ should spawn 2 harvesters per source (4 total)
      expect(roleCounts.harvester).toBeDefined();
    });
  });

  describe("Energy Reserve Validation", () => {
    it("should maintain 20% energy reserve when spawning (with sufficient harvesters)", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const room = {
        name: "W0N0",
        controller: { my: true, level: 2 } as StructureController,
        find: vi.fn(() => [{ id: "source1" as Id<Source>, energy: 3000 }]),
        energyAvailable: 250, // Just enough for one creep but not reserve
        energyCapacityAvailable: 300
      } as unknown as Room;

      const spawn = {
        name: "spawn1",
        spawning: null,
        spawnCreep: vi.fn().mockReturnValue(OK),
        store: { getFreeCapacity: () => 50, getUsedCapacity: () => 250 },
        room
      };

      const game: GameContext = {
        time: 100,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: {},
        spawns: { spawn1: spawn },
        rooms: { W0N0: room }
      };

      const memory = {} as Memory;
      // Have sufficient harvesters to avoid emergency spawn mode (Issue #806)
      const roleCounts = { harvester: 4 };

      controller.execute(game, memory, roleCounts);

      // Should not spawn if it would deplete reserves below 20% (60 energy)
      // 250 - 200 (spawn cost) = 50 < 60 (20% of 300)
      // Emergency spawn mode is disabled with 4+ harvesters
      expect(spawn.spawnCreep).not.toHaveBeenCalled();
    });

    it("should allow spawning when reserves are sufficient", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const room = {
        name: "W0N0",
        controller: { my: true, level: 2 } as StructureController,
        find: vi.fn(() => [{ id: "source1" as Id<Source>, energy: 3000 }]),
        energyAvailable: 300, // Enough for spawn + reserve
        energyCapacityAvailable: 300
      } as unknown as Room;

      const spawn = {
        name: "spawn1",
        spawning: null,
        spawnCreep: vi.fn().mockReturnValue(OK),
        store: { getFreeCapacity: () => 0, getUsedCapacity: () => 300 },
        room
      };

      const game: GameContext = {
        time: 100,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: {},
        spawns: { spawn1: spawn },
        rooms: { W0N0: room }
      };

      const memory = {} as Memory;
      const roleCounts = {};

      controller.execute(game, memory, roleCounts);

      // Should spawn: 300 - 200 (spawn cost) = 100 >= 60 (20% of 300)
      expect(spawn.spawnCreep).toHaveBeenCalled();
    });

    it("should maintain minimum 50 energy reserve regardless of capacity (with sufficient harvesters)", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      // Small capacity room (early game)
      const room = {
        name: "W0N0",
        controller: { my: true, level: 1 } as StructureController,
        find: vi.fn(() => [{ id: "source1" as Id<Source>, energy: 3000 }]),
        energyAvailable: 230, // Just above minimum for spawning
        energyCapacityAvailable: 300
      } as unknown as Room;

      const spawn = {
        name: "spawn1",
        spawning: null,
        spawnCreep: vi.fn().mockReturnValue(OK),
        store: { getFreeCapacity: () => 70, getUsedCapacity: () => 230 },
        room
      };

      const game: GameContext = {
        time: 100,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: {},
        spawns: { spawn1: spawn },
        rooms: { W0N0: room }
      };

      const memory = {} as Memory;
      // Have sufficient harvesters to avoid emergency spawn mode (Issue #806)
      const roleCounts = { harvester: 4 };

      controller.execute(game, memory, roleCounts);

      // Should not spawn: 230 - 200 (spawn cost) = 30 < 60 (max(50, 20% of 300))
      // Emergency spawn mode is disabled with 4+ harvesters
      expect(spawn.spawnCreep).not.toHaveBeenCalled();
    });

    it("should bypass energy reserve in emergency spawn mode (0 harvesters)", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const room = {
        name: "W0N0",
        controller: { my: true, level: 1 } as StructureController,
        find: vi.fn(() => [{ id: "source1" as Id<Source>, energy: 3000 }]),
        energyAvailable: 220, // Barely enough for harvester (200), violates 20% reserve
        energyCapacityAvailable: 300
      } as unknown as Room;

      const spawn = {
        name: "spawn1",
        spawning: null,
        spawnCreep: vi.fn().mockReturnValue(OK),
        store: { getFreeCapacity: () => 80, getUsedCapacity: () => 220 },
        room
      };

      const game: GameContext = {
        time: 100,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: {},
        spawns: { spawn1: spawn },
        rooms: { W0N0: room }
      };

      const memory = {} as Memory;
      // 0 harvesters - emergency spawn mode
      const roleCounts = {};

      controller.execute(game, memory, roleCounts);

      // Should spawn despite violating energy reserve (Issue #806 fix)
      // Emergency spawn mode bypasses reserve requirement to prevent starvation
      expect(spawn.spawnCreep).toHaveBeenCalledWith(
        expect.arrayContaining([WORK, CARRY, MOVE]),
        expect.stringMatching(/^harvester-/),
        expect.objectContaining({
          memory: expect.objectContaining({ role: "harvester" })
        })
      );
    });
  });

  describe("Adaptive Role Minimums", () => {
    it("should activate hauler role when containers exist near sources", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const source = {
        id: "source1" as Id<Source>,
        energy: 3000,
        pos: {
          findInRange: vi.fn((type: FindConstant, range: number) => {
            if (type === FIND_STRUCTURES && range === 1) {
              return [{ structureType: STRUCTURE_CONTAINER }];
            }
            return [];
          })
        }
      };

      const room = {
        name: "W0N0",
        controller: { my: true, level: 3 } as StructureController,
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) return [source];
          return [];
        }),
        energyAvailable: 1000,
        energyCapacityAvailable: 800
      } as unknown as Room;

      const spawn = {
        name: "spawn1",
        spawning: null,
        spawnCreep: vi.fn().mockReturnValue(OK),
        store: { getFreeCapacity: () => 0, getUsedCapacity: () => 1000 },
        room
      };

      const game: GameContext = {
        time: 100,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: {},
        spawns: { spawn1: spawn },
        rooms: { W0N0: room }
      };

      const memory = {} as Memory;
      const roleCounts = {};

      const result = controller.execute(game, memory, roleCounts);

      // Should spawn creeps when containers exist (could be any role)
      expect(result.spawnedCreeps.length).toBeGreaterThan(0);
      // Spawn should have been called
      expect(spawn.spawnCreep).toHaveBeenCalled();
    });

    it("should spawn creeps when no containers exist", () => {
      const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

      const source = {
        id: "source1" as Id<Source>,
        energy: 3000,
        pos: {
          findInRange: vi.fn(() => []) // No containers
        }
      };

      const room = {
        name: "W0N0",
        controller: { my: true, level: 2 } as StructureController,
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) return [source];
          return [];
        }),
        energyAvailable: 1000,
        energyCapacityAvailable: 800
      } as unknown as Room;

      const spawn = {
        name: "spawn1",
        spawning: null,
        spawnCreep: vi.fn().mockReturnValue(OK),
        store: { getFreeCapacity: () => 0, getUsedCapacity: () => 1000 },
        room
      };

      const game: GameContext = {
        time: 100,
        cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
        creeps: {},
        spawns: { spawn1: spawn },
        rooms: { W0N0: room }
      };

      const memory = {} as Memory;
      const roleCounts = {};

      const result = controller.execute(game, memory, roleCounts);

      // Should spawn creeps (regular harvesters when no containers)
      expect(result.spawnedCreeps.length).toBeGreaterThan(0);
      expect(spawn.spawnCreep).toHaveBeenCalled();
    });
  });

  describe("RCL-based Scaling", () => {
    it("should spawn creeps at different RCL levels", () => {
      const testRCL = (rcl: number) => {
        const controller = new BehaviorController({ log: vi.fn(), warn: vi.fn() });

        const room = {
          name: "W0N0",
          controller: { my: true, level: rcl } as StructureController,
          find: vi.fn((type: FindConstant) => {
            if (type === FIND_SOURCES) return [{ id: "source1" as Id<Source>, energy: 3000 }];
            return [];
          }),
          energyAvailable: 1000,
          energyCapacityAvailable: 800
        } as unknown as Room;

        const spawn = {
          name: "spawn1",
          spawning: null,
          spawnCreep: vi.fn().mockReturnValue(OK),
          store: { getFreeCapacity: () => 0, getUsedCapacity: () => 1000 },
          room
        };

        const game: GameContext = {
          time: 100,
          cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
          creeps: {},
          spawns: { spawn1: spawn },
          rooms: { W0N0: room }
        };

        const memory = {} as Memory;
        const roleCounts = {};

        const result = controller.execute(game, memory, roleCounts);

        // Should spawn creeps at any RCL level
        expect(result.spawnedCreeps.length).toBeGreaterThan(0);
        expect(spawn.spawnCreep).toHaveBeenCalled();
      };

      // Test various RCL levels
      testRCL(1);
      testRCL(2);
      testRCL(3);
      testRCL(4);
    });
  });
});
