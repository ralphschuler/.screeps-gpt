import { describe, expect, it, vi } from "vitest";
import { BasePlanner } from "@runtime/planning/BasePlanner";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock constants for tests
const FIND_MY_SPAWNS = 104 as FindConstant;
const FIND_STRUCTURES = 107 as FindConstant;
const FIND_MY_CONSTRUCTION_SITES = 114 as FindConstant;
const TERRAIN_MASK_WALL = 1;

// Mock RoomTerrain
function createMockTerrain(walls: Array<{ x: number; y: number }> = []): RoomTerrain {
  const wallSet = new Set(walls.map(w => `${w.x},${w.y}`));

  return {
    get: vi.fn((x: number, y: number) => {
      if (wallSet.has(`${x},${y}`)) {
        return TERRAIN_MASK_WALL;
      }
      return 0;
    })
  } as unknown as RoomTerrain;
}

// Mock RoomLike
function createMockRoom(
  name: string,
  rcl: number,
  hasSpawn: boolean = false,
  spawnPos?: { x: number; y: number }
): any {
  const structures: any[] = [];

  if (hasSpawn && spawnPos) {
    structures.push({
      structureType: "spawn" as const,
      pos: { x: spawnPos.x, y: spawnPos.y }
    });
  }

  return {
    name,
    controller: {
      my: true,
      level: rcl
    },
    find: vi.fn((type: number) => {
      if (type === FIND_MY_SPAWNS) {
        return structures.filter(s => s.structureType === "spawn");
      }
      if (type === FIND_STRUCTURES) {
        return structures;
      }
      if (type === FIND_MY_CONSTRUCTION_SITES) {
        return [];
      }
      return [];
    })
  };
}

describe("BasePlanner", () => {
  describe("calculateAnchor", () => {
    it("should use existing spawn position as anchor", () => {
      const planner = new BasePlanner("W0N0");
      const terrain = createMockTerrain();
      const room = createMockRoom("W0N0", 1, true, { x: 25, y: 25 });

      const anchor = planner.calculateAnchor(room, terrain, FIND_MY_SPAWNS);

      expect(anchor).toEqual({ x: 25, y: 25 });
    });

    it("should find open space when no spawn exists", () => {
      const planner = new BasePlanner("W0N0");
      const terrain = createMockTerrain([
        { x: 0, y: 0 },
        { x: 49, y: 49 }
      ]);
      const room = createMockRoom("W0N0", 1, false);

      const anchor = planner.calculateAnchor(room, terrain, FIND_MY_SPAWNS);

      expect(anchor).toBeDefined();
      expect(anchor!.x).toBeGreaterThanOrEqual(10);
      expect(anchor!.x).toBeLessThanOrEqual(40);
      expect(anchor!.y).toBeGreaterThanOrEqual(10);
      expect(anchor!.y).toBeLessThanOrEqual(40);
    });

    it("should cache anchor after first calculation", () => {
      const planner = new BasePlanner("W0N0");
      const terrain = createMockTerrain();
      const room = createMockRoom("W0N0", 1, true, { x: 25, y: 25 });

      const anchor1 = planner.calculateAnchor(room, terrain, FIND_MY_SPAWNS);
      const anchor2 = planner.calculateAnchor(room, terrain, FIND_MY_SPAWNS);

      expect(anchor1).toBe(anchor2);
      expect(room.find).toHaveBeenCalledTimes(1);
    });
  });

  describe("getPlanForRCL", () => {
    it("should return spawn for RCL 1 (for newly claimed rooms)", () => {
      const planner = new BasePlanner("W0N0");
      const plans = planner.getPlanForRCL(1, { x: 25, y: 25 });

      // RCL 1 should include a spawn for newly claimed rooms
      expect(plans.length).toBe(1);
      expect(plans[0].structureType).toBe("spawn");
      expect(plans[0].pos).toEqual({ x: 25, y: 25 });
    });

    it("should include extensions for RCL 2", () => {
      const planner = new BasePlanner("W0N0");
      const plans = planner.getPlanForRCL(2, { x: 25, y: 25 });

      const extensions = plans.filter(p => p.structureType === "extension");
      expect(extensions.length).toBeGreaterThan(0);
      expect(extensions.length).toBeLessThanOrEqual(5); // RCL 2 max
    });

    it("should include tower at RCL 3", () => {
      const planner = new BasePlanner("W0N0");
      const plans = planner.getPlanForRCL(3, { x: 25, y: 25 });

      const towers = plans.filter(p => p.structureType === "tower");
      expect(towers.length).toBeGreaterThan(0);
    });

    it("should include storage at RCL 4", () => {
      const planner = new BasePlanner("W0N0");
      const plans = planner.getPlanForRCL(4, { x: 25, y: 25 });

      const storage = plans.filter(p => p.structureType === "storage");
      expect(storage.length).toBeGreaterThan(0);
    });

    it("should position structures relative to anchor", () => {
      const planner = new BasePlanner("W0N0");
      const anchor = { x: 20, y: 20 };
      const plans = planner.getPlanForRCL(2, anchor);

      // All positions should be near the anchor
      for (const plan of plans) {
        expect(Math.abs(plan.pos.x - anchor.x)).toBeLessThanOrEqual(5);
        expect(Math.abs(plan.pos.y - anchor.y)).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("getMissingStructures", () => {
    it("should return all planned structures when none exist", () => {
      const planner = new BasePlanner("W0N0");
      const terrain = createMockTerrain();
      const room = createMockRoom("W0N0", 2, true, { x: 25, y: 25 });

      const missing = planner.getMissingStructures(
        room,
        terrain,
        2,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES
      );

      expect(missing.length).toBeGreaterThan(0);
    });

    it("should exclude existing structures", () => {
      const planner = new BasePlanner("W0N0");
      const terrain = createMockTerrain();
      const room = createMockRoom("W0N0", 2, true, { x: 25, y: 25 });

      // Add an extension at position that would be planned
      const existingExtension = {
        structureType: "extension" as const,
        pos: { x: 26, y: 25 }
      };
      room.find = vi.fn((type: number) => {
        if (type === FIND_MY_SPAWNS) {
          return [{ structureType: "spawn" as const, pos: { x: 25, y: 25 } }];
        }
        if (type === FIND_STRUCTURES) {
          return [existingExtension];
        }
        if (type === FIND_MY_CONSTRUCTION_SITES) {
          return [];
        }
        return [];
      });

      const missing = planner.getMissingStructures(
        room,
        terrain,
        2,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES
      );

      // Should not include the existing extension
      const hasExtensionAt26_25 = missing.some(m => m.type === "extension" && m.pos.x === 26 && m.pos.y === 25);
      expect(hasExtensionAt26_25).toBe(false);
    });

    it("should exclude positions with construction sites", () => {
      const planner = new BasePlanner("W0N0");
      const terrain = createMockTerrain();
      const room = createMockRoom("W0N0", 2, true, { x: 25, y: 25 });

      const constructionSite = {
        structureType: "extension" as const,
        pos: { x: 26, y: 25 }
      };

      room.find = vi.fn((type: number) => {
        if (type === FIND_MY_SPAWNS) {
          return [{ structureType: "spawn" as const, pos: { x: 25, y: 25 } }];
        }
        if (type === FIND_STRUCTURES) {
          return [];
        }
        if (type === FIND_MY_CONSTRUCTION_SITES) {
          return [constructionSite];
        }
        return [];
      });

      const missing = planner.getMissingStructures(
        room,
        terrain,
        2,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES
      );

      const hasExtensionAt26_25 = missing.some(m => m.type === "extension" && m.pos.x === 26 && m.pos.y === 25);
      expect(hasExtensionAt26_25).toBe(false);
    });

    it("should skip positions on walls", () => {
      const planner = new BasePlanner("W0N0");
      // Create terrain with walls at extension positions
      const terrain = createMockTerrain([
        { x: 26, y: 25 },
        { x: 24, y: 25 }
      ]);
      const room = createMockRoom("W0N0", 2, true, { x: 25, y: 25 });

      const missing = planner.getMissingStructures(
        room,
        terrain,
        2,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES
      );

      // Should not include positions on walls
      const hasStructureOnWall = missing.some(
        m => (m.pos.x === 26 && m.pos.y === 25) || (m.pos.x === 24 && m.pos.y === 25)
      );
      expect(hasStructureOnWall).toBe(false);
    });

    it("should return empty array when all structures exist", () => {
      const planner = new BasePlanner("W0N0");
      const terrain = createMockTerrain();
      const room = createMockRoom("W0N0", 2, true, { x: 25, y: 25 });

      // Get all planned structures
      const plans = planner.getPlanForRCL(2, { x: 25, y: 25 });

      // Mock all structures as existing
      room.find = vi.fn((type: number) => {
        if (type === FIND_MY_SPAWNS) {
          return [{ structureType: "spawn" as const, pos: { x: 25, y: 25 } }];
        }
        if (type === FIND_STRUCTURES) {
          return plans.map(p => ({
            structureType: p.structureType,
            pos: p.pos
          }));
        }
        if (type === FIND_MY_CONSTRUCTION_SITES) {
          return [];
        }
        return [];
      });

      const missing = planner.getMissingStructures(
        room,
        terrain,
        2,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES
      );

      expect(missing.length).toBe(0);
    });
  });
});
