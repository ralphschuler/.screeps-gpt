import { describe, expect, it } from "vitest";
import { isCreepDying, isCreepSpawning, handleDyingCreepEnergyDrop } from "@runtime/behavior/creepHelpers";

describe("creepHelpers", () => {
  describe("isCreepSpawning", () => {
    it("should return true when creep is spawning", () => {
      const creep = {
        spawning: true
      } as Creep;

      expect(isCreepSpawning(creep)).toBe(true);
    });

    it("should return false when creep is not spawning", () => {
      const creep = {
        spawning: false
      } as Creep;

      expect(isCreepSpawning(creep)).toBe(false);
    });

    it("should return false when spawning property is undefined", () => {
      const creep = {} as Creep;

      expect(isCreepSpawning(creep)).toBe(false);
    });
  });

  describe("isCreepDying", () => {
    it("should return true when TTL is below default threshold (50)", () => {
      const creep = {
        ticksToLive: 49
      } as Creep;

      expect(isCreepDying(creep)).toBe(true);
    });

    it("should return false when TTL is at default threshold (50)", () => {
      const creep = {
        ticksToLive: 50
      } as Creep;

      expect(isCreepDying(creep)).toBe(false);
    });

    it("should return false when TTL is above default threshold", () => {
      const creep = {
        ticksToLive: 100
      } as Creep;

      expect(isCreepDying(creep)).toBe(false);
    });

    it("should return false when TTL is undefined", () => {
      const creep = {
        ticksToLive: undefined
      } as Creep;

      expect(isCreepDying(creep)).toBe(false);
    });

    it("should use custom threshold when provided", () => {
      const creep = {
        ticksToLive: 75
      } as Creep;

      expect(isCreepDying(creep, 100)).toBe(true);
      expect(isCreepDying(creep, 50)).toBe(false);
    });

    it("should handle edge case of TTL = 0", () => {
      const creep = {
        ticksToLive: 0
      } as Creep;

      expect(isCreepDying(creep)).toBe(true);
    });

    it("should handle edge case of TTL = 1", () => {
      const creep = {
        ticksToLive: 1
      } as Creep;

      expect(isCreepDying(creep)).toBe(true);
    });
  });

  describe("handleDyingCreepEnergyDrop", () => {
    it("should drop energy and return true when creep has energy", () => {
      let droppedResource: ResourceConstant | null = null;

      const creep = {
        store: {
          getUsedCapacity: (resource: ResourceConstant) => {
            if (resource === RESOURCE_ENERGY) return 100;
            return 0;
          }
        },
        drop: (resource: ResourceConstant) => {
          droppedResource = resource;
          return OK;
        }
      } as unknown as Creep;

      const result = handleDyingCreepEnergyDrop(creep);

      expect(result).toBe(true);
      expect(droppedResource).toBe(RESOURCE_ENERGY);
    });

    it("should return false when creep has no energy", () => {
      const creep = {
        store: {
          getUsedCapacity: () => 0
        },
        drop: () => OK
      } as unknown as Creep;

      const result = handleDyingCreepEnergyDrop(creep);

      expect(result).toBe(false);
    });

    it("should return false when drop action fails", () => {
      const creep = {
        store: {
          getUsedCapacity: (resource: ResourceConstant) => {
            if (resource === RESOURCE_ENERGY) return 50;
            return 0;
          }
        },
        drop: () => -1 // Generic error code (not OK)
      } as unknown as Creep;

      const result = handleDyingCreepEnergyDrop(creep);

      expect(result).toBe(false);
    });

    it("should only drop when energy amount is greater than 0", () => {
      let dropCalled = false;

      const creep = {
        store: {
          getUsedCapacity: () => 0
        },
        drop: () => {
          dropCalled = true;
          return OK;
        }
      } as unknown as Creep;

      handleDyingCreepEnergyDrop(creep);

      expect(dropCalled).toBe(false);
    });
  });
});
