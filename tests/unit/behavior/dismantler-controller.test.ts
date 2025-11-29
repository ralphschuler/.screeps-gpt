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
        my: false,
        pos: { x: 25, y: 25 } // Interior position
      };

      const room = {
        name: "W1N1",
        controller: { my: true },
        find: vi.fn((type: number, opts?: { filter?: (s: AnyStructure) => boolean }) => {
          if (type === FIND_HOSTILE_STRUCTURES) {
            return [];
          }
          if (type === FIND_STRUCTURES) {
            const structures = [hostileStructure];
            if (opts?.filter) {
              return structures.filter(s => opts.filter!(s as unknown as AnyStructure));
            }
            return structures;
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
        my: false,
        pos: { x: 25, y: 25 } // Interior position
      };

      const room = {
        name: "W1N1",
        controller: { my: false }, // Enemy room
        find: vi.fn((type: number, opts?: { filter?: (s: AnyStructure) => boolean }) => {
          if (type === FIND_HOSTILE_STRUCTURES) {
            const structures = [hostileStructure];
            if (opts?.filter) {
              return structures.filter(s => opts.filter!(s as unknown as AnyStructure));
            }
            return structures;
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
        my: false, // Not ours
        pos: { x: 25, y: 25 } // Interior position
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
        my: true, // Ours - should not target
        pos: { x: 25, y: 25 } // Interior position
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
        structureType: STRUCTURE_ROAD,
        pos: { x: 25, y: 25 } // Interior position
        // Roads don't have 'my' property
      };

      const container = {
        id: "old-container" as Id<Structure>,
        structureType: STRUCTURE_CONTAINER,
        pos: { x: 26, y: 25 } // Interior position
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
        structureType: STRUCTURE_WALL,
        // Constructed walls have hits property (unlike novice/respawn zone walls)
        hits: 1000,
        hitsMax: 300000000,
        pos: { x: 25, y: 25 } // Interior position
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

    it("should NOT target novice/respawn zone walls (walls without hits property)", () => {
      const controller = new DismantlerController();

      // Novice/respawn zone walls are special indestructible walls that:
      // - Cannot be dismantled or attacked
      // - Do not have a 'hits' property
      // - Decay automatically when the zone timer expires
      const noviceZoneWall = {
        id: "zone-wall" as Id<Structure>,
        structureType: STRUCTURE_WALL,
        pos: { x: 25, y: 25 } // Interior position but no hits
        // No hits property - this is a novice/respawn zone wall
      };

      const room = {
        name: "W1N1",
        controller: { my: true },
        find: vi.fn((type: number, opts?: { filter?: (s: AnyStructure) => boolean }) => {
          if (type === FIND_STRUCTURES && opts?.filter) {
            const structures = [noviceZoneWall];
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

      // Should NOT have called dismantle since novice/respawn zone walls cannot be dismantled
      expect(creep.dismantle).not.toHaveBeenCalled();
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

    it("should NOT target structures near room edges (novice zone walls)", () => {
      const controller = new DismantlerController();

      // Wall at room edge x=0 (novice zone wall location)
      const edgeWallLeft = {
        id: "edge-wall-left" as Id<Structure>,
        structureType: STRUCTURE_WALL,
        hits: 1000, // Has hits, but at edge
        hitsMax: 300000000,
        pos: { x: 0, y: 25 }
      };

      // Wall at room edge x=1 (within 1 tile of edge)
      const nearEdgeWallLeft = {
        id: "near-edge-wall-left" as Id<Structure>,
        structureType: STRUCTURE_WALL,
        hits: 1000,
        hitsMax: 300000000,
        pos: { x: 1, y: 25 }
      };

      // Wall at room edge y=49 (novice zone wall location)
      const edgeWallBottom = {
        id: "edge-wall-bottom" as Id<Structure>,
        structureType: STRUCTURE_WALL,
        hits: 1000,
        hitsMax: 300000000,
        pos: { x: 25, y: 49 }
      };

      // Wall at room edge y=48 (within 1 tile of edge)
      const nearEdgeWallBottom = {
        id: "near-edge-wall-bottom" as Id<Structure>,
        structureType: STRUCTURE_WALL,
        hits: 1000,
        hitsMax: 300000000,
        pos: { x: 25, y: 48 }
      };

      const room = {
        name: "W1N1",
        controller: { my: true },
        find: vi.fn((type: number, opts?: { filter?: (s: AnyStructure) => boolean }) => {
          if (type === FIND_STRUCTURES && opts?.filter) {
            const structures = [edgeWallLeft, nearEdgeWallLeft, edgeWallBottom, nearEdgeWallBottom];
            return structures.filter(s => opts.filter!(s as unknown as AnyStructure));
          }
          return [];
        })
      };

      const creep = {
        name: "dismantler-edge-test",
        memory: {
          role: "dismantler",
          task: "travel",
          version: 2,
          mode: "clearing" as DismantlerMode
        } as CreepMemory & { mode?: DismantlerMode },
        room,
        pos: {
          findClosestByPath: vi.fn(() => null),
          x: 25,
          y: 25
        },
        dismantle: vi.fn(() => OK_CODE),
        moveTo: vi.fn(() => OK_CODE)
      } as unknown as CreepLike;

      controller.execute(creep);

      // Should NOT have called dismantle since all walls are near edges
      expect(creep.dismantle).not.toHaveBeenCalled();
    });

    it("should target walls in room interior but not near edges", () => {
      const controller = new DismantlerController();

      // Wall in room interior (should be targeted)
      const interiorWall = {
        id: "interior-wall" as Id<Structure>,
        structureType: STRUCTURE_WALL,
        hits: 1000,
        hitsMax: 300000000,
        pos: { x: 25, y: 25 } // Center of room
      };

      // Wall near edge (should be ignored)
      const edgeWall = {
        id: "edge-wall" as Id<Structure>,
        structureType: STRUCTURE_WALL,
        hits: 1000,
        hitsMax: 300000000,
        pos: { x: 0, y: 25 } // At left edge
      };

      const room = {
        name: "W1N1",
        controller: { my: true },
        find: vi.fn((type: number, opts?: { filter?: (s: AnyStructure) => boolean }) => {
          if (type === FIND_STRUCTURES && opts?.filter) {
            const structures = [interiorWall, edgeWall];
            return structures.filter(s => opts.filter!(s as unknown as AnyStructure));
          }
          return [];
        })
      };

      const creep = {
        name: "dismantler-interior-test",
        memory: {
          role: "dismantler",
          task: "travel",
          version: 2,
          mode: "clearing" as DismantlerMode
        } as CreepMemory & { mode?: DismantlerMode },
        room,
        pos: {
          findClosestByPath: vi.fn(() => interiorWall),
          x: 25,
          y: 25
        },
        dismantle: vi.fn(() => ERR_NOT_IN_RANGE),
        moveTo: vi.fn(() => OK_CODE)
      } as unknown as CreepLike;

      controller.execute(creep);

      // Should have called dismantle for the interior wall
      expect(creep.dismantle).toHaveBeenCalled();
    });

    it("should ignore hostile structures near room edges in combat mode", () => {
      const controller = new DismantlerController();

      // Hostile structure at room edge (should be ignored)
      const edgeHostileStructure = {
        id: "edge-hostile" as Id<Structure>,
        structureType: STRUCTURE_SPAWN,
        my: false,
        pos: { x: 49, y: 25 } // At right edge
      };

      const room = {
        name: "W1N1",
        controller: { my: false }, // Enemy room
        find: vi.fn((type: number, opts?: { filter?: (s: AnyStructure) => boolean }) => {
          if (type === FIND_HOSTILE_STRUCTURES && opts?.filter) {
            const structures = [edgeHostileStructure];
            return structures.filter(s => opts.filter!(s as unknown as AnyStructure));
          }
          return [];
        })
      };

      const creep = {
        name: "dismantler-combat-edge",
        memory: {
          role: "dismantler",
          task: "travel",
          version: 2,
          mode: "combat" as DismantlerMode
        } as CreepMemory & { mode?: DismantlerMode },
        room,
        pos: {
          findClosestByPath: vi.fn(() => null),
          x: 25,
          y: 25
        },
        dismantle: vi.fn(() => OK_CODE),
        moveTo: vi.fn(() => OK_CODE)
      } as unknown as CreepLike;

      controller.execute(creep);

      // Should NOT have called dismantle since hostile structure is at edge
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
