/**
 * Regression test for extension placement in RCL 1-2
 *
 * This test validates that extension structures are placed correctly
 * according to the bunker layout pattern defined in BasePlanner.
 * Extensions should be placed adjacent to the spawn for optimal energy delivery.
 *
 * Related to Phase 1 Subtask 5: Early Building, Upgrading, and Static Harvesting
 * See: CHANGELOG.md and TASKS.md for Phase 1 completion tracking
 */

import { describe, it, expect } from "vitest";
import { BasePlanner } from "../../packages/bot/src/runtime/planning/BasePlanner";
import {
  createMockTerrain,
  createMockTerrainWithWalls,
  createMockRoom,
  TEST_CONSTANTS
} from "../helpers/mockFactories";

// Extract constants for convenience
const { FIND_MY_SPAWNS, FIND_STRUCTURES, FIND_MY_CONSTRUCTION_SITES, TERRAIN_MASK_WALL } = TEST_CONSTANTS;

// Define additional Screeps constants
const STRUCTURE_EXTENSION = "extension" as BuildableStructureConstant;
const STRUCTURE_CONTAINER = "container" as BuildableStructureConstant;

describe("Extension Placement Regression", () => {
  describe("RCL 1 Extension Placement", () => {
    it("should not place extensions at RCL 1", () => {
      const planner = new BasePlanner("W1N1");
      const mockTerrain = createMockTerrain();
      const mockRoom = createMockRoom(1);

      const anchor = planner.calculateAnchor(mockRoom, mockTerrain, FIND_MY_SPAWNS);
      expect(anchor).toBeDefined();

      const missing = planner.getMissingStructures(
        mockRoom,
        mockTerrain,
        1,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        TERRAIN_MASK_WALL
      );

      const extensions = missing.filter(s => s.type === STRUCTURE_EXTENSION);
      expect(extensions).toHaveLength(0);
    });
  });

  describe("RCL 2 Extension Placement", () => {
    it("should place 5 extensions at RCL 2", () => {
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

      const extensions = missing.filter(s => s.type === STRUCTURE_EXTENSION);
      expect(extensions).toHaveLength(5);
    });

    it("should place extensions adjacent to spawn", () => {
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

      const extensions = missing.filter(s => s.type === STRUCTURE_EXTENSION);

      // All extensions should be within distance 2 of anchor (spawn)
      for (const ext of extensions) {
        const distance = Math.max(Math.abs(ext.pos.x - anchor.x), Math.abs(ext.pos.y - anchor.y));
        expect(distance).toBeLessThanOrEqual(2);
      }
    });

    it("should not place extensions on walls", () => {
      const planner = new BasePlanner("W1N1");
      const mockTerrain = createMockTerrainWithWalls();
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

      const extensions = missing.filter(s => s.type === STRUCTURE_EXTENSION);

      // Verify no extensions are placed on wall terrain
      for (const ext of extensions) {
        const terrain = mockTerrain.get(ext.pos.x, ext.pos.y);
        expect(terrain).not.toBe(TERRAIN_MASK_WALL);
      }
    });

    it("should place container at RCL 2", () => {
      const planner = new BasePlanner("W1N1");
      const mockTerrain = createMockTerrain();
      const mockRoom = createMockRoom(2);

      planner.calculateAnchor(mockRoom, mockTerrain, FIND_MY_SPAWNS);

      const missing = planner.getMissingStructures(
        mockRoom,
        mockTerrain,
        2,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        TERRAIN_MASK_WALL
      );

      const containers = missing.filter(s => s.type === STRUCTURE_CONTAINER);
      expect(containers.length).toBeGreaterThan(0);
    });
  });

  describe("Extension Placement Determinism", () => {
    it("should produce consistent placement across multiple calls", () => {
      const planner = new BasePlanner("W1N1");
      const mockTerrain = createMockTerrain();
      const mockRoom = createMockRoom(2);

      planner.calculateAnchor(mockRoom, mockTerrain, FIND_MY_SPAWNS);

      const missing1 = planner.getMissingStructures(
        mockRoom,
        mockTerrain,
        2,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        TERRAIN_MASK_WALL
      );
      const extensions1 = missing1.filter(s => s.type === STRUCTURE_EXTENSION);

      const missing2 = planner.getMissingStructures(
        mockRoom,
        mockTerrain,
        2,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        TERRAIN_MASK_WALL
      );
      const extensions2 = missing2.filter(s => s.type === STRUCTURE_EXTENSION);

      expect(extensions1).toHaveLength(extensions2.length);
      expect(extensions1).toEqual(extensions2);
    });
  });
});
