/**
 * Regression test for chess pattern walkability
 *
 * This test validates that the chess/checkerboard pattern layout ensures
 * all adjacent tiles to the spawn remain walkable at all RCL levels,
 * preventing the spawning blockage issue.
 *
 * Related Issue: Spawning blocked because structures built on every neighbor
 * Solution: Chess pattern with alternating walkable tiles
 */

import { describe, it, expect } from "vitest";
import { BasePlanner } from "../../src/runtime/planning/BasePlanner";

// Define Screeps constants for testing
const FIND_MY_SPAWNS = 104;
const FIND_STRUCTURES = 107;
const FIND_MY_CONSTRUCTION_SITES = 114;
const STRUCTURE_SPAWN = "spawn" as BuildableStructureConstant;
const TERRAIN_MASK_WALL = 1;

describe("Chess Pattern Walkability Regression", () => {
  describe("Adjacent Walkability", () => {
    it("should keep all 8 adjacent tiles walkable at RCL 2", () => {
      const planner = new BasePlanner("W1N1");
      const mockTerrain = createMockTerrain();
      const mockRoom = createMockRoom(2);

      const anchor = planner.calculateAnchor(mockRoom, mockTerrain, FIND_MY_SPAWNS);
      expect(anchor).toBeDefined();

      const missing = planner.getMissingStructures(
        mockRoom,
        mockTerrain,
        2,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        TERRAIN_MASK_WALL
      );

      // Check all 8 adjacent positions
      const adjacentPositions = [
        { dx: -1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 1 },
        { dx: 0, dy: 1 },
        { dx: 1, dy: 1 }
      ];

      let walkableCount = 0;
      for (const pos of adjacentPositions) {
        const x = anchor!.x + pos.dx;
        const y = anchor!.y + pos.dy;

        // Check if any structure is planned at this position
        const hasStructure = missing.some(s => s.pos.x === x && s.pos.y === y);

        if (!hasStructure) {
          walkableCount++;
        }
      }

      expect(walkableCount).toBe(8);
    });

    it("should keep all 8 adjacent tiles walkable at RCL 3", () => {
      const planner = new BasePlanner("W1N1");
      const mockTerrain = createMockTerrain();
      const mockRoom = createMockRoom(3);

      const anchor = planner.calculateAnchor(mockRoom, mockTerrain, FIND_MY_SPAWNS);
      expect(anchor).toBeDefined();

      const missing = planner.getMissingStructures(
        mockRoom,
        mockTerrain,
        3,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        TERRAIN_MASK_WALL
      );

      const adjacentPositions = [
        { dx: -1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 1 },
        { dx: 0, dy: 1 },
        { dx: 1, dy: 1 }
      ];

      let walkableCount = 0;
      for (const pos of adjacentPositions) {
        const x = anchor!.x + pos.dx;
        const y = anchor!.y + pos.dy;

        const hasStructure = missing.some(s => s.pos.x === x && s.pos.y === y);

        if (!hasStructure) {
          walkableCount++;
        }
      }

      expect(walkableCount).toBe(8);
    });

    it("should keep all 8 adjacent tiles walkable at RCL 4", () => {
      const planner = new BasePlanner("W1N1");
      const mockTerrain = createMockTerrain();
      const mockRoom = createMockRoom(4);

      const anchor = planner.calculateAnchor(mockRoom, mockTerrain, FIND_MY_SPAWNS);
      expect(anchor).toBeDefined();

      const missing = planner.getMissingStructures(
        mockRoom,
        mockTerrain,
        4,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        TERRAIN_MASK_WALL
      );

      const adjacentPositions = [
        { dx: -1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 1 },
        { dx: 0, dy: 1 },
        { dx: 1, dy: 1 }
      ];

      let walkableCount = 0;
      for (const pos of adjacentPositions) {
        const x = anchor!.x + pos.dx;
        const y = anchor!.y + pos.dy;

        const hasStructure = missing.some(s => s.pos.x === x && s.pos.y === y);

        if (!hasStructure) {
          walkableCount++;
        }
      }

      expect(walkableCount).toBe(8);
    });

    it("should keep all 8 adjacent tiles walkable at RCL 5", () => {
      const planner = new BasePlanner("W1N1");
      const mockTerrain = createMockTerrain();
      const mockRoom = createMockRoom(5);

      const anchor = planner.calculateAnchor(mockRoom, mockTerrain, FIND_MY_SPAWNS);
      expect(anchor).toBeDefined();

      const missing = planner.getMissingStructures(
        mockRoom,
        mockTerrain,
        5,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        TERRAIN_MASK_WALL
      );

      const adjacentPositions = [
        { dx: -1, dy: -1 },
        { dx: 0, dy: -1 },
        { dx: 1, dy: -1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 1 },
        { dx: 0, dy: 1 },
        { dx: 1, dy: 1 }
      ];

      let walkableCount = 0;
      for (const pos of adjacentPositions) {
        const x = anchor!.x + pos.dx;
        const y = anchor!.y + pos.dy;

        const hasStructure = missing.some(s => s.pos.x === x && s.pos.y === y);

        if (!hasStructure) {
          walkableCount++;
        }
      }

      expect(walkableCount).toBe(8);
    });
  });

  describe("Chess Pattern Verification", () => {
    it("should place structures on even-sum coordinates", () => {
      const planner = new BasePlanner("W1N1");
      const mockTerrain = createMockTerrain();
      const mockRoom = createMockRoom(5);

      const anchor = planner.calculateAnchor(mockRoom, mockTerrain, FIND_MY_SPAWNS);
      expect(anchor).toBeDefined();

      const missing = planner.getMissingStructures(
        mockRoom,
        mockTerrain,
        5,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        TERRAIN_MASK_WALL
      );

      // Verify all structures follow chess pattern (even-sum coordinates)
      for (const structure of missing) {
        const dx = structure.pos.x - anchor!.x;
        const dy = structure.pos.y - anchor!.y;
        const sum = dx + dy;

        // All structures should be on even-sum positions
        // Use Math.abs to handle -0 vs +0 issue
        expect(Math.abs(sum % 2)).toBe(0);
      }
    });

    it("should maintain correct extension count at each RCL", () => {
      const planner = new BasePlanner("W1N1");
      const mockTerrain = createMockTerrain();

      const rclExtensionCounts: Record<number, number> = {
        2: 5,
        3: 10,
        4: 20,
        5: 30
      };

      for (const [rcl, expectedCount] of Object.entries(rclExtensionCounts)) {
        const mockRoom = createMockRoom(Number(rcl));
        planner.calculateAnchor(mockRoom, mockTerrain, FIND_MY_SPAWNS);

        const missing = planner.getMissingStructures(
          mockRoom,
          mockTerrain,
          Number(rcl),
          FIND_MY_SPAWNS,
          FIND_STRUCTURES,
          FIND_MY_CONSTRUCTION_SITES,
          TERRAIN_MASK_WALL
        );

        const extensions = missing.filter(s => s.type === "extension");
        expect(extensions.length).toBe(expectedCount);
      }
    });
  });

  describe("Structure Distribution", () => {
    it("should distribute structures evenly around spawn", () => {
      const planner = new BasePlanner("W1N1");
      const mockTerrain = createMockTerrain();
      const mockRoom = createMockRoom(5);

      const anchor = planner.calculateAnchor(mockRoom, mockTerrain, FIND_MY_SPAWNS);
      expect(anchor).toBeDefined();

      const missing = planner.getMissingStructures(
        mockRoom,
        mockTerrain,
        5,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        TERRAIN_MASK_WALL
      );

      // Count structures in each quadrant
      const quadrants = { ne: 0, nw: 0, se: 0, sw: 0 };

      for (const structure of missing) {
        const dx = structure.pos.x - anchor!.x;
        const dy = structure.pos.y - anchor!.y;

        if (dx >= 0 && dy >= 0) quadrants.se++;
        else if (dx >= 0 && dy < 0) quadrants.ne++;
        else if (dx < 0 && dy >= 0) quadrants.sw++;
        else quadrants.nw++;
      }

      // Each quadrant should have roughly similar number of structures
      const total = Object.values(quadrants).reduce((a, b) => a + b, 0);
      const avg = total / 4;

      // Allow 50% variance from average
      for (const count of Object.values(quadrants)) {
        expect(count).toBeGreaterThan(avg * 0.5);
        expect(count).toBeLessThan(avg * 1.5);
      }
    });
  });
});

// Mock helper functions
function createMockTerrain(): RoomTerrain {
  return {
    get: (x: number, y: number) => {
      if (x === 0 || y === 0 || x === 49 || y === 49) {
        return TERRAIN_MASK_WALL;
      }
      return 0;
    },
    getRawBuffer: () => new Uint8Array(2500)
  } as RoomTerrain;
}

function createMockRoom(rcl: number) {
  return {
    name: "W1N1",
    controller: {
      my: true,
      level: rcl,
      pos: { x: 25, y: 25 }
    },
    find: (findConstant: FindConstant) => {
      if (findConstant === FIND_MY_SPAWNS) {
        return [
          {
            pos: { x: 25, y: 25 },
            name: "Spawn1",
            structureType: STRUCTURE_SPAWN
          }
        ];
      }
      if (findConstant === FIND_STRUCTURES) {
        return [
          {
            pos: { x: 25, y: 25 },
            structureType: STRUCTURE_SPAWN
          }
        ];
      }
      if (findConstant === FIND_MY_CONSTRUCTION_SITES) {
        return [];
      }
      return [];
    },
    getTerrain: () => createMockTerrain()
  } as unknown as RoomLike;
}

// Import RoomLike type
type RoomLike = import("../../src/runtime/types/GameContext").RoomLike;
