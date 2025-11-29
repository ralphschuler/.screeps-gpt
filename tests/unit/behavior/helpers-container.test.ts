import { describe, expect, it, beforeEach } from "vitest";
import {
  hasSourceContainer,
  getSourceContainer,
  findSourceAdjacentContainers
} from "@runtime/behavior/controllers/helpers";

// Minimal Screeps constants for test environment
beforeEach(() => {
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_STRUCTURES = 109 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_SOURCES = 105 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).STRUCTURE_CONTAINER = "container" as StructureConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).RESOURCE_ENERGY = "energy" as ResourceConstant;
});

describe("Source container helpers", () => {
  describe("hasSourceContainer", () => {
    it("should return true when source has adjacent container", () => {
      const container = {
        id: "container1" as Id<StructureContainer>,
        structureType: "container" as StructureConstant
      };

      const source = {
        id: "source1" as Id<Source>,
        pos: {
          findInRange: (_type: FindConstant, _range: number, opts?: { filter?: (s: Structure) => boolean }) => {
            const structures = [container];
            if (opts?.filter) {
              return structures.filter(s => opts.filter!(s as unknown as Structure));
            }
            return structures;
          }
        }
      } as unknown as Source;

      expect(hasSourceContainer(source)).toBe(true);
    });

    it("should return false when source has no adjacent container", () => {
      const source = {
        id: "source1" as Id<Source>,
        pos: {
          findInRange: () => []
        }
      } as unknown as Source;

      expect(hasSourceContainer(source)).toBe(false);
    });
  });

  describe("getSourceContainer", () => {
    it("should return the first adjacent container", () => {
      const container = {
        id: "container1" as Id<StructureContainer>,
        structureType: "container" as StructureConstant,
        store: {
          getFreeCapacity: () => 1000,
          getUsedCapacity: () => 500
        }
      } as unknown as StructureContainer;

      const source = {
        id: "source1" as Id<Source>,
        pos: {
          findInRange: (_type: FindConstant, _range: number, opts?: { filter?: (s: Structure) => boolean }) => {
            const structures = [container];
            if (opts?.filter) {
              return structures.filter(s => opts.filter!(s as unknown as Structure));
            }
            return structures;
          }
        }
      } as unknown as Source;

      const result = getSourceContainer(source);
      expect(result).toBe(container);
    });

    it("should return null when no adjacent container exists", () => {
      const source = {
        id: "source1" as Id<Source>,
        pos: {
          findInRange: () => []
        }
      } as unknown as Source;

      const result = getSourceContainer(source);
      expect(result).toBeNull();
    });
  });

  describe("findSourceAdjacentContainers", () => {
    it("should return containers adjacent to sources with free capacity", () => {
      const container1 = {
        id: "container1" as Id<StructureContainer>,
        structureType: "container" as StructureConstant,
        store: {
          getFreeCapacity: () => 500, // Has free capacity
          getUsedCapacity: () => 1500
        },
        pos: { x: 10, y: 10 }
      };

      const source1 = {
        id: "source1" as Id<Source>,
        pos: {
          findInRange: (_type: FindConstant, _range: number, opts?: { filter?: (s: Structure) => boolean }) => {
            const structures = [container1];
            if (opts?.filter) {
              return structures.filter(s => opts.filter!(s as unknown as Structure));
            }
            return structures;
          }
        }
      };

      const room = {
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [source1];
          }
          return [];
        }
      };

      const result = findSourceAdjacentContainers(room);
      expect(result.length).toBe(1);
      expect(result[0]).toBe(container1);
    });

    it("should not return containers that are full", () => {
      const fullContainer = {
        id: "fullContainer" as Id<StructureContainer>,
        structureType: "container" as StructureConstant,
        store: {
          getFreeCapacity: () => 0, // No free capacity
          getUsedCapacity: () => 2000
        }
      };

      const source1 = {
        id: "source1" as Id<Source>,
        pos: {
          findInRange: (_type: FindConstant, _range: number, opts?: { filter?: (s: Structure) => boolean }) => {
            const structures = [fullContainer];
            if (opts?.filter) {
              return structures.filter(s => opts.filter!(s as unknown as Structure));
            }
            return structures;
          }
        }
      };

      const room = {
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [source1];
          }
          return [];
        }
      };

      const result = findSourceAdjacentContainers(room);
      expect(result.length).toBe(0);
    });

    it("should not return duplicate containers adjacent to multiple sources", () => {
      const sharedContainer = {
        id: "sharedContainer" as Id<StructureContainer>,
        structureType: "container" as StructureConstant,
        store: {
          getFreeCapacity: () => 500,
          getUsedCapacity: () => 1500
        }
      };

      // Both sources are adjacent to the same container
      const source1 = {
        id: "source1" as Id<Source>,
        pos: {
          findInRange: (_type: FindConstant, _range: number, opts?: { filter?: (s: Structure) => boolean }) => {
            const structures = [sharedContainer];
            if (opts?.filter) {
              return structures.filter(s => opts.filter!(s as unknown as Structure));
            }
            return structures;
          }
        }
      };

      const source2 = {
        id: "source2" as Id<Source>,
        pos: {
          findInRange: (_type: FindConstant, _range: number, opts?: { filter?: (s: Structure) => boolean }) => {
            const structures = [sharedContainer];
            if (opts?.filter) {
              return structures.filter(s => opts.filter!(s as unknown as Structure));
            }
            return structures;
          }
        }
      };

      const room = {
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [source1, source2];
          }
          return [];
        }
      };

      const result = findSourceAdjacentContainers(room);
      // Should only return the container once, not twice
      expect(result.length).toBe(1);
      expect(result[0]).toBe(sharedContainer);
    });

    it("should return empty array when no sources exist", () => {
      const room = {
        find: () => []
      };

      const result = findSourceAdjacentContainers(room);
      expect(result.length).toBe(0);
    });
  });
});
