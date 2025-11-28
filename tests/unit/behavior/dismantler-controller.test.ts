/**
 * Dismantler Controller Unit Tests
 *
 * Tests for the dismantler creep controller, including:
 * - Combat mode (hostile structure targeting)
 * - Clearing mode (room integration structure clearing)
 * - Mode detection and migration
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { DismantlerController, type DismantlerMode } from "@runtime/behavior/controllers/DismantlerController";
import type { CreepLike } from "@runtime/types/GameContext";

// Minimal Screeps constants for test environment
const OK_CODE = 0;
const ERR_NOT_IN_RANGE = -9;

beforeEach(() => {
  // Structure type constants
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_CONTROLLER = "controller" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_SPAWN = "spawn" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_EXTENSION = "extension" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_TOWER = "tower" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_ROAD = "road" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_CONTAINER = "container" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_WALL = "constructedWall" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_RAMPART = "rampart" as StructureConstant;

  // Body part constants
  (globalThis as typeof globalThis & Record<string, unknown>).WORK = "work" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).CARRY = "carry" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).MOVE = "move" as BodyPartConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).TOUGH = "tough" as BodyPartConstant;

  // Find constants
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_HOSTILE_STRUCTURES = 114;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_STRUCTURES = 107;

  // Error codes
  (globalThis as typeof globalThis & Record<string, unknown>).OK = OK_CODE;
  (globalThis as typeof globalThis & Record<string, unknown>).ERR_NOT_IN_RANGE = ERR_NOT_IN_RANGE;
  (globalThis as typeof globalThis & Record<string, unknown>).ERR_INVALID_TARGET = -7;

  // Mock Game object
  (globalThis as typeof globalThis & Record<string, unknown>).Game = {
    time: 100,
    creeps: {}
  };
});

describe("DismantlerController", () => {
  describe("Configuration", () => {
    it("should have correct role name", () => {
      const controller = new DismantlerController();
      expect(controller.getRoleName()).toBe("dismantler");
    });

    it("should have minimum of 0 (spawned on demand)", () => {
      const controller = new DismantlerController();
      const config = controller.getConfig();
      expect(config.minimum).toBe(0);
    });

    it("should create memory with clearing mode by default", () => {
      const controller = new DismantlerController();
      const memory = controller.createMemory();
      expect(memory.role).toBe("dismantler");
      expect(memory.mode).toBe("clearing");
      expect(memory.task).toBe("travel");
    });
  });

  describe("Mode selection", () => {
    it("should default to clearing mode for new creeps", () => {
      const controller = new DismantlerController();
      const memory = controller.createMemory();
      expect(memory.mode).toBe("clearing");
    });

    it("should support combat mode for hostile structures", () => {
      const controller = new DismantlerController();
      const memory = controller.createMemory();
      memory.mode = "combat";
      expect(memory.mode).toBe("combat");
    });

    it("should migrate old creeps without mode to clearing", () => {
      const controller = new DismantlerController();

      const hostileStructure = {
        id: "hostile1" as Id<Structure>,
        structureType: STRUCTURE_SPAWN,
        my: false
      };

      const room = {
        name: "W1N1",
        controller: { my: true },
        find: vi.fn((type: number, _opts?: { filter?: (s: AnyStructure) => boolean }) => {
          if (type === FIND_HOSTILE_STRUCTURES) {
            return [];
          }
          if (type === FIND_STRUCTURES) {
            return [hostileStructure];
          }
          return [];
        })
      };

      // Create a creep without mode set (simulating old version)
      const creep = {
        name: "dismantler-1",
        memory: {
          role: "dismantler",
          task: "travel",
          version: 1
          // mode is intentionally not set
        } as CreepMemory & { mode?: DismantlerMode },
        room,
        pos: {
          findClosestByPath: vi.fn(() => hostileStructure),
          x: 10,
          y: 10
        },
        dismantle: vi.fn(() => ERR_NOT_IN_RANGE),
        moveTo: vi.fn(() => OK_CODE)
      } as unknown as CreepLike;

      controller.execute(creep);

      // Mode should be set to clearing after execute
      expect(creep.memory.mode).toBe("clearing");
    });
  });

  describe("Combat mode targeting", () => {
    it("should target hostile structures in combat mode", () => {
      const controller = new DismantlerController();

      const hostileStructure = {
        id: "hostile1" as Id<Structure>,
        structureType: STRUCTURE_SPAWN,
        my: false
      };

      const room = {
        name: "W1N1",
        controller: { my: false }, // Enemy room
        find: vi.fn((type: number) => {
          if (type === FIND_HOSTILE_STRUCTURES) {
            return [hostileStructure];
          }
          return [];
        })
      };

      const creep = {
        name: "dismantler-combat",
        memory: {
          role: "dismantler",
          task: "travel",
          version: 2,
          mode: "combat" as DismantlerMode
        } as CreepMemory & { mode?: DismantlerMode },
        room,
        pos: {
          findClosestByPath: vi.fn(() => hostileStructure),
          x: 10,
          y: 10
        },
        dismantle: vi.fn(() => ERR_NOT_IN_RANGE),
        moveTo: vi.fn(() => OK_CODE)
      } as unknown as CreepLike;

      controller.execute(creep);

      // Should have searched for hostile structures
      expect(room.find).toHaveBeenCalledWith(
        FIND_HOSTILE_STRUCTURES,
        expect.objectContaining({
          filter: expect.any(Function)
        })
      );
    });
  });

  describe("Clearing mode targeting", () => {
    it("should target non-owned structures in owned rooms", () => {
      const controller = new DismantlerController();

      const enemySpawn = {
        id: "enemy-spawn" as Id<Structure>,
        structureType: STRUCTURE_SPAWN,
        my: false // Not ours
      };

      const room = {
        name: "W1N1",
        controller: { my: true }, // Our room
        find: vi.fn((type: number, opts?: { filter?: (s: AnyStructure) => boolean }) => {
          if (type === FIND_STRUCTURES && opts?.filter) {
            const structures = [enemySpawn];
            return structures.filter(s => opts.filter!(s as unknown as AnyStructure));
          }
          return [];
        })
      };

      const creep = {
        name: "dismantler-clear",
        memory: {
          role: "dismantler",
          task: "travel",
          version: 2,
          mode: "clearing" as DismantlerMode
        } as CreepMemory & { mode?: DismantlerMode },
        room,
        pos: {
          findClosestByPath: vi.fn(() => enemySpawn),
          x: 10,
          y: 10
        },
        dismantle: vi.fn(() => ERR_NOT_IN_RANGE),
        moveTo: vi.fn(() => OK_CODE)
      } as unknown as CreepLike;

      controller.execute(creep);

      // Should have searched for all structures (for filtering)
      expect(room.find).toHaveBeenCalledWith(
        FIND_STRUCTURES,
        expect.objectContaining({
          filter: expect.any(Function)
        })
      );

      // Should have attempted to dismantle or move to target
      expect(creep.dismantle).toHaveBeenCalled();
    });

    it("should not target our own structures", () => {
      const controller = new DismantlerController();

      const ourSpawn = {
        id: "our-spawn" as Id<Structure>,
        structureType: STRUCTURE_SPAWN,
        my: true // Ours - should not target
      };

      const room = {
        name: "W1N1",
        controller: { my: true },
        find: vi.fn((type: number, opts?: { filter?: (s: AnyStructure) => boolean }) => {
          if (type === FIND_STRUCTURES && opts?.filter) {
            const structures = [ourSpawn];
            return structures.filter(s => opts.filter!(s as unknown as AnyStructure));
          }
          return [];
        })
      };

      const creep = {
        name: "dismantler-clear",
        memory: {
          role: "dismantler",
          task: "travel",
          version: 2,
          mode: "clearing" as DismantlerMode
        } as CreepMemory & { mode?: DismantlerMode },
        room,
        pos: {
          findClosestByPath: vi.fn(() => null),
          x: 10,
          y: 10
        },
        dismantle: vi.fn(() => OK_CODE),
        moveTo: vi.fn(() => OK_CODE)
      } as unknown as CreepLike;

      controller.execute(creep);

      // Should NOT have called dismantle since our structures are filtered out
      expect(creep.dismantle).not.toHaveBeenCalled();
    });

    it("should not target roads and containers (keep useful infrastructure)", () => {
      const controller = new DismantlerController();

      const road = {
        id: "old-road" as Id<Structure>,
        structureType: STRUCTURE_ROAD
        // Roads don't have 'my' property
      };

      const container = {
        id: "old-container" as Id<Structure>,
        structureType: STRUCTURE_CONTAINER
        // Containers don't have 'my' property
      };

      const room = {
        name: "W1N1",
        controller: { my: true },
        find: vi.fn((type: number, opts?: { filter?: (s: AnyStructure) => boolean }) => {
          if (type === FIND_STRUCTURES && opts?.filter) {
            const structures = [road, container];
            return structures.filter(s => opts.filter!(s as unknown as AnyStructure));
          }
          return [];
        })
      };

      const creep = {
        name: "dismantler-clear",
        memory: {
          role: "dismantler",
          task: "travel",
          version: 2,
          mode: "clearing" as DismantlerMode
        } as CreepMemory & { mode?: DismantlerMode },
        room,
        pos: {
          findClosestByPath: vi.fn(() => null),
          x: 10,
          y: 10
        },
        dismantle: vi.fn(() => OK_CODE),
        moveTo: vi.fn(() => OK_CODE)
      } as unknown as CreepLike;

      controller.execute(creep);

      // Should NOT have called dismantle since roads/containers are kept
      expect(creep.dismantle).not.toHaveBeenCalled();
    });

    it("should target constructed walls in clearing mode", () => {
      const controller = new DismantlerController();

      const wall = {
        id: "old-wall" as Id<Structure>,
        structureType: STRUCTURE_WALL
        // Constructed walls don't have 'my' property
      };

      const room = {
        name: "W1N1",
        controller: { my: true },
        find: vi.fn((type: number, opts?: { filter?: (s: AnyStructure) => boolean }) => {
          if (type === FIND_STRUCTURES && opts?.filter) {
            const structures = [wall];
            return structures.filter(s => opts.filter!(s as unknown as AnyStructure));
          }
          return [];
        })
      };

      const creep = {
        name: "dismantler-clear",
        memory: {
          role: "dismantler",
          task: "travel",
          version: 2,
          mode: "clearing" as DismantlerMode
        } as CreepMemory & { mode?: DismantlerMode },
        room,
        pos: {
          findClosestByPath: vi.fn(() => wall),
          x: 10,
          y: 10
        },
        dismantle: vi.fn(() => ERR_NOT_IN_RANGE),
        moveTo: vi.fn(() => OK_CODE)
      } as unknown as CreepLike;

      controller.execute(creep);

      // Should have called dismantle (or move to target) for the wall
      expect(creep.dismantle).toHaveBeenCalled();
    });

    it("should not clear structures in unowned rooms", () => {
      const controller = new DismantlerController();

      const someStructure = {
        id: "some-struct" as Id<Structure>,
        structureType: STRUCTURE_SPAWN,
        my: false
      };

      const room = {
        name: "W1N1",
        controller: { my: false }, // Not our room
        find: vi.fn((type: number, opts?: { filter?: (s: AnyStructure) => boolean }) => {
          if (type === FIND_STRUCTURES && opts?.filter) {
            const structures = [someStructure];
            return structures.filter(s => opts.filter!(s as unknown as AnyStructure));
          }
          return [];
        })
      };

      const creep = {
        name: "dismantler-clear",
        memory: {
          role: "dismantler",
          task: "travel",
          version: 2,
          mode: "clearing" as DismantlerMode
        } as CreepMemory & { mode?: DismantlerMode },
        room,
        pos: {
          findClosestByPath: vi.fn(() => null),
          x: 10,
          y: 10
        },
        dismantle: vi.fn(() => OK_CODE),
        moveTo: vi.fn(() => OK_CODE)
      } as unknown as CreepLike;

      controller.execute(creep);

      // Should NOT have called dismantle since room is not ours
      expect(creep.dismantle).not.toHaveBeenCalled();
    });
  });

  describe("Idle behavior", () => {
    it("should idle when no structures to dismantle", () => {
      const controller = new DismantlerController();

      const room = {
        name: "W1N1",
        controller: { my: true },
        find: vi.fn(() => []) // No structures to clear
      };

      const creep = {
        name: "dismantler-idle",
        memory: {
          role: "dismantler",
          task: "travel",
          version: 2,
          mode: "clearing" as DismantlerMode
        } as CreepMemory & { mode?: DismantlerMode },
        room,
        pos: {
          findClosestByPath: vi.fn(() => null),
          x: 10,
          y: 10
        },
        dismantle: vi.fn(() => OK_CODE),
        moveTo: vi.fn(() => OK_CODE)
      } as unknown as CreepLike;

      const result = controller.execute(creep);

      // Should NOT have called dismantle
      expect(creep.dismantle).not.toHaveBeenCalled();

      // Should return a task state (dismantle or idle)
      expect(typeof result).toBe("string");
    });
  });
});
