/**
 * Type Guards Unit Tests
 *
 * Tests for the type guard utilities that replace unsafe type assertions.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  isCreep,
  isSource,
  isStructure,
  isSpawn,
  isContainer,
  isTower,
  hasStore,
  asCreep
} from "@runtime/types/typeGuards";
import type { CreepLike } from "@runtime/types/GameContext";

describe("Type Guards", () => {
  describe("isCreep", () => {
    it("should return true for objects with name, memory, and room", () => {
      const creep = {
        name: "creep1",
        memory: { role: "harvester" },
        room: { name: "W1N1" }
      };

      expect(isCreep(creep)).toBe(true);
    });

    it("should return false for null", () => {
      expect(isCreep(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isCreep(undefined)).toBe(false);
    });

    it("should return false for objects missing name", () => {
      const obj = {
        memory: { role: "harvester" },
        room: { name: "W1N1" }
      };

      expect(isCreep(obj)).toBe(false);
    });

    it("should return false for objects missing memory", () => {
      const obj = {
        name: "creep1",
        room: { name: "W1N1" }
      };

      expect(isCreep(obj)).toBe(false);
    });

    it("should return false for objects missing room", () => {
      const obj = {
        name: "creep1",
        memory: { role: "harvester" }
      };

      expect(isCreep(obj)).toBe(false);
    });
  });

  describe("asCreep", () => {
    it("should return the creep when valid", () => {
      const creep = {
        name: "creep1",
        memory: { role: "harvester" },
        room: { name: "W1N1" },
        store: {},
        pos: {}
      } as unknown as CreepLike;

      const result = asCreep(creep);
      expect(result).toBe(creep);
    });

    it("should throw TypeError for invalid objects", () => {
      const invalidObj = { name: "test" } as unknown as CreepLike;

      expect(() => asCreep(invalidObj)).toThrow(TypeError);
    });

    it("should include context in error message when provided", () => {
      const invalidObj = { name: "test" } as unknown as CreepLike;

      expect(() => asCreep(invalidObj, "TestController")).toThrow(
        "[TestController] Invalid Creep object: missing required properties (name, memory, room)"
      );
    });

    it("should not include context prefix when not provided", () => {
      const invalidObj = { name: "test" } as unknown as CreepLike;

      expect(() => asCreep(invalidObj)).toThrow(
        "Invalid Creep object: missing required properties (name, memory, room)"
      );
    });
  });

  describe("isSource", () => {
    it("should return true for objects with source properties", () => {
      const source = {
        id: "src1",
        energy: 3000,
        energyCapacity: 3000,
        ticksToRegeneration: 300,
        pos: { x: 10, y: 10 }
      };

      expect(isSource(source)).toBe(true);
    });

    it("should return false for objects missing energy", () => {
      const obj = {
        id: "src1",
        energyCapacity: 3000,
        ticksToRegeneration: 300,
        pos: { x: 10, y: 10 }
      };

      expect(isSource(obj)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isSource(null)).toBe(false);
    });
  });

  describe("isStructure", () => {
    beforeEach(() => {
      (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_SPAWN = "spawn" as StructureConstant;
    });

    it("should return true for objects with structure properties", () => {
      const structure = {
        id: "struct1",
        structureType: "spawn",
        pos: { x: 25, y: 25 }
      };

      expect(isStructure(structure)).toBe(true);
    });

    it("should return false for objects missing structureType", () => {
      const obj = {
        id: "struct1",
        pos: { x: 25, y: 25 }
      };

      expect(isStructure(obj)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isStructure(null)).toBe(false);
    });
  });

  describe("Structure type guards", () => {
    beforeEach(() => {
      (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_SPAWN = "spawn" as StructureConstant;
      (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_CONTAINER =
        "container" as StructureConstant;
      (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_TOWER = "tower" as StructureConstant;
    });

    describe("isSpawn", () => {
      it("should return true for spawn structures", () => {
        const spawn = { structureType: "spawn" } as unknown as Structure;
        expect(isSpawn(spawn)).toBe(true);
      });

      it("should return false for non-spawn structures", () => {
        const container = { structureType: "container" } as unknown as Structure;
        expect(isSpawn(container)).toBe(false);
      });
    });

    describe("isContainer", () => {
      it("should return true for container structures", () => {
        const container = { structureType: "container" } as unknown as Structure;
        expect(isContainer(container)).toBe(true);
      });

      it("should return false for non-container structures", () => {
        const spawn = { structureType: "spawn" } as unknown as Structure;
        expect(isContainer(spawn)).toBe(false);
      });
    });

    describe("isTower", () => {
      it("should return true for tower structures", () => {
        const tower = { structureType: "tower" } as unknown as Structure;
        expect(isTower(tower)).toBe(true);
      });

      it("should return false for non-tower structures", () => {
        const spawn = { structureType: "spawn" } as unknown as Structure;
        expect(isTower(spawn)).toBe(false);
      });
    });
  });

  describe("hasStore", () => {
    it("should return true for structures with store property", () => {
      const container = {
        structureType: "container",
        store: {
          getUsedCapacity: vi.fn(),
          getFreeCapacity: vi.fn()
        }
      } as unknown as Structure;

      expect(hasStore(container)).toBe(true);
    });

    it("should return false for structures without store property", () => {
      const wall = {
        structureType: "constructedWall",
        hits: 1000
      } as unknown as Structure;

      expect(hasStore(wall)).toBe(false);
    });
  });
});
