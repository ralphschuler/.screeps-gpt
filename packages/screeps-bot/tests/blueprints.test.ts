/**
 * Blueprint Tests
 */
import { describe, it, expect } from "vitest";
import {
  getBlueprintForStage,
  getBlueprintForRCL,
  getStructuresForRCL,
  EARLY_COLONY_BLUEPRINT,
  CORE_COLONY_BLUEPRINT,
  ECONOMIC_MATURITY_BLUEPRINT,
  WAR_READY_BLUEPRINT
} from "../src/layouts/blueprints";

describe("Blueprints", () => {
  describe("Blueprint structure", () => {
    it("should have valid early colony blueprint", () => {
      expect(EARLY_COLONY_BLUEPRINT.name).toBe("earlyColony");
      expect(EARLY_COLONY_BLUEPRINT.rcl).toBe(1);
      expect(EARLY_COLONY_BLUEPRINT.anchor).toBeDefined();
      expect(EARLY_COLONY_BLUEPRINT.structures.length).toBeGreaterThan(0);
    });

    it("should have spawn in early colony blueprint", () => {
      const spawn = EARLY_COLONY_BLUEPRINT.structures.find(s => s.structureType === STRUCTURE_SPAWN);
      expect(spawn).toBeDefined();
      expect(spawn?.x).toBe(0);
      expect(spawn?.y).toBe(0);
    });

    it("should have tower in core colony blueprint", () => {
      const tower = CORE_COLONY_BLUEPRINT.structures.find(s => s.structureType === STRUCTURE_TOWER);
      expect(tower).toBeDefined();
    });

    it("should have storage in economic maturity blueprint", () => {
      const storage = ECONOMIC_MATURITY_BLUEPRINT.structures.find(s => s.structureType === STRUCTURE_STORAGE);
      expect(storage).toBeDefined();
    });

    it("should have nuker in war ready blueprint", () => {
      const nuker = WAR_READY_BLUEPRINT.structures.find(s => s.structureType === STRUCTURE_NUKER);
      expect(nuker).toBeDefined();
    });
  });

  describe("getBlueprintForStage", () => {
    it("should return early colony for seed stage", () => {
      const blueprint = getBlueprintForStage("seedColony");
      expect(blueprint.name).toBe("earlyColony");
    });

    it("should return core colony for early expansion", () => {
      const blueprint = getBlueprintForStage("earlyExpansion");
      expect(blueprint.name).toBe("coreColony");
    });

    it("should return economic maturity for that stage", () => {
      const blueprint = getBlueprintForStage("economicMaturity");
      expect(blueprint.name).toBe("economicMaturity");
    });

    it("should return war ready for fortification", () => {
      const blueprint = getBlueprintForStage("fortification");
      expect(blueprint.name).toBe("warReady");
    });

    it("should return war ready for end game", () => {
      const blueprint = getBlueprintForStage("endGame");
      expect(blueprint.name).toBe("warReady");
    });
  });

  describe("getBlueprintForRCL", () => {
    it("should return early colony for RCL 1-2", () => {
      expect(getBlueprintForRCL(1).name).toBe("earlyColony");
      expect(getBlueprintForRCL(2).name).toBe("earlyColony");
    });

    it("should return core colony for RCL 3-4", () => {
      expect(getBlueprintForRCL(3).name).toBe("coreColony");
      expect(getBlueprintForRCL(4).name).toBe("coreColony");
    });

    it("should return economic maturity for RCL 5-6", () => {
      expect(getBlueprintForRCL(5).name).toBe("economicMaturity");
      expect(getBlueprintForRCL(6).name).toBe("economicMaturity");
    });

    it("should return war ready for RCL 7-8", () => {
      expect(getBlueprintForRCL(7).name).toBe("warReady");
      expect(getBlueprintForRCL(8).name).toBe("warReady");
    });
  });

  describe("getStructuresForRCL", () => {
    it("should limit structures to RCL constraints", () => {
      const structures = getStructuresForRCL(CORE_COLONY_BLUEPRINT, 2);
      const extensions = structures.filter(s => s.structureType === STRUCTURE_EXTENSION);
      expect(extensions.length).toBeLessThanOrEqual(5); // RCL2 limit
    });

    it("should allow more structures at higher RCL", () => {
      const rcl3 = getStructuresForRCL(CORE_COLONY_BLUEPRINT, 3);
      const rcl4 = getStructuresForRCL(CORE_COLONY_BLUEPRINT, 4);

      const extensions3 = rcl3.filter(s => s.structureType === STRUCTURE_EXTENSION);
      const extensions4 = rcl4.filter(s => s.structureType === STRUCTURE_EXTENSION);

      expect(extensions4.length).toBeGreaterThanOrEqual(extensions3.length);
    });

    it("should include spawn at all levels", () => {
      const structures = getStructuresForRCL(ECONOMIC_MATURITY_BLUEPRINT, 1);
      const spawns = structures.filter(s => s.structureType === STRUCTURE_SPAWN);
      expect(spawns.length).toBe(1);
    });
  });
});
