import { describe, it, expect, beforeEach, vi } from "vitest";
import { BasePlanner } from "@runtime/planning/BasePlanner";

/**
 * Unit tests for BasePlanner with RCL 6-8 support and dynamic layout.
 */
describe("BasePlanner", () => {
  // Mock terrain that returns plain terrain for all positions except edges
  const createMockTerrain = () => ({
    get: (x: number, y: number) => {
      if (x < 3 || x > 46 || y < 3 || y > 46) {
        return 1; // TERRAIN_MASK_WALL
      }
      return 0; // Plain terrain
    }
  });

  describe("Room Name", () => {
    it("should return configured room name", () => {
      const planner = new BasePlanner("W1N1");
      expect(planner.getRoomName()).toBe("W1N1");
    });
  });

  describe("Anchor Management", () => {
    it("should return null anchor initially", () => {
      const planner = new BasePlanner("W1N1");
      expect(planner.getAnchor()).toBeNull();
    });

    it("should reset anchor", () => {
      const planner = new BasePlanner("W1N1");
      const terrain = createMockTerrain();
      const mockRoom = {
        name: "W1N1",
        find: vi.fn().mockReturnValue([{ pos: { x: 25, y: 25 } }]),
        controller: { my: true, level: 1 }
      };

      // Calculate anchor
      planner.calculateAnchor(mockRoom as any, terrain as any, 104);
      expect(planner.getAnchor()).not.toBeNull();

      // Reset
      planner.resetAnchor();
      expect(planner.getAnchor()).toBeNull();
    });
  });

  describe("Dynamic Layout - RCL 6-8", () => {
    let planner: BasePlanner;

    beforeEach(() => {
      planner = new BasePlanner("W1N1");
    });

    it("should include terminal at RCL 6", () => {
      const anchor = { x: 25, y: 25 };
      const plans = planner.getPlanForRCL(6, anchor);

      const terminalPlans = plans.filter(p => p.structureType === "terminal");
      expect(terminalPlans.length).toBe(1);
    });

    it("should include 3 labs at RCL 6", () => {
      const anchor = { x: 25, y: 25 };
      const plans = planner.getPlanForRCL(6, anchor);

      const labPlans = plans.filter(p => p.structureType === "lab");
      expect(labPlans.length).toBe(3);
    });

    it("should include 40 extensions at RCL 6", () => {
      const anchor = { x: 25, y: 25 };
      const plans = planner.getPlanForRCL(6, anchor);

      const extensionPlans = plans.filter(p => p.structureType === "extension");
      expect(extensionPlans.length).toBe(40);
    });

    it("should include second spawn at RCL 7", () => {
      const anchor = { x: 25, y: 25 };
      const plans = planner.getPlanForRCL(7, anchor);

      const spawnPlans = plans.filter(p => p.structureType === "spawn");
      expect(spawnPlans.length).toBe(2);
    });

    it("should include factory at RCL 7", () => {
      const anchor = { x: 25, y: 25 };
      const plans = planner.getPlanForRCL(7, anchor);

      const factoryPlans = plans.filter(p => p.structureType === "factory");
      expect(factoryPlans.length).toBe(1);
    });

    it("should include 6 labs at RCL 7", () => {
      const anchor = { x: 25, y: 25 };
      const plans = planner.getPlanForRCL(7, anchor);

      const labPlans = plans.filter(p => p.structureType === "lab");
      expect(labPlans.length).toBe(6);
    });

    it("should include third spawn at RCL 8", () => {
      const anchor = { x: 25, y: 25 };
      const plans = planner.getPlanForRCL(8, anchor);

      const spawnPlans = plans.filter(p => p.structureType === "spawn");
      expect(spawnPlans.length).toBe(3);
    });

    it("should include 6 towers at RCL 8", () => {
      const anchor = { x: 25, y: 25 };
      const plans = planner.getPlanForRCL(8, anchor);

      const towerPlans = plans.filter(p => p.structureType === "tower");
      expect(towerPlans.length).toBe(6);
    });

    it("should include observer at RCL 8", () => {
      const anchor = { x: 25, y: 25 };
      const plans = planner.getPlanForRCL(8, anchor);

      const observerPlans = plans.filter(p => p.structureType === "observer");
      expect(observerPlans.length).toBe(1);
    });

    it("should include power spawn at RCL 8", () => {
      const anchor = { x: 25, y: 25 };
      const plans = planner.getPlanForRCL(8, anchor);

      const powerSpawnPlans = plans.filter(p => p.structureType === "powerSpawn");
      expect(powerSpawnPlans.length).toBe(1);
    });

    it("should include nuker at RCL 8", () => {
      const anchor = { x: 25, y: 25 };
      const plans = planner.getPlanForRCL(8, anchor);

      const nukerPlans = plans.filter(p => p.structureType === "nuker");
      expect(nukerPlans.length).toBe(1);
    });

    it("should include 10 labs at RCL 8", () => {
      const anchor = { x: 25, y: 25 };
      const plans = planner.getPlanForRCL(8, anchor);

      const labPlans = plans.filter(p => p.structureType === "lab");
      expect(labPlans.length).toBe(10);
    });

    it("should include 6 links at RCL 8", () => {
      const anchor = { x: 25, y: 25 };
      const plans = planner.getPlanForRCL(8, anchor);

      const linkPlans = plans.filter(p => p.structureType === "link");
      expect(linkPlans.length).toBe(6);
    });

    it("should include 60 extensions at RCL 8", () => {
      const anchor = { x: 25, y: 25 };
      const plans = planner.getPlanForRCL(8, anchor);

      const extensionPlans = plans.filter(p => p.structureType === "extension");
      expect(extensionPlans.length).toBe(60);
    });
  });

  describe("Layout Statistics", () => {
    it("should return correct stats at RCL 8", () => {
      const planner = new BasePlanner("W1N1");
      const stats = planner.getLayoutStats(8);

      expect(stats.totalStructures).toBeGreaterThan(80);
      expect(stats.byType["spawn"]).toBe(3);
      expect(stats.byType["extension"]).toBe(60);
      expect(stats.byType["tower"]).toBe(6);
      expect(stats.boundingBox).not.toBeNull();
    });

    it("should filter structures by RCL", () => {
      const planner = new BasePlanner("W1N1");

      const stats5 = planner.getLayoutStats(5);
      const stats8 = planner.getLayoutStats(8);

      expect(stats5.totalStructures).toBeLessThan(stats8.totalStructures);
      expect(stats5.byType["spawn"]).toBe(1);
      expect(stats8.byType["spawn"]).toBe(3);
    });

    it("should calculate bounding box correctly", () => {
      const planner = new BasePlanner("W1N1");
      const stats = planner.getLayoutStats(8);

      expect(stats.boundingBox).not.toBeNull();
      if (stats.boundingBox) {
        expect(stats.boundingBox.minX).toBeLessThanOrEqual(0);
        expect(stats.boundingBox.maxX).toBeGreaterThanOrEqual(0);
        expect(stats.boundingBox.minY).toBeLessThanOrEqual(0);
        expect(stats.boundingBox.maxY).toBeGreaterThanOrEqual(0);
      }
    });

    it("should count structures by RCL", () => {
      const planner = new BasePlanner("W1N1");
      const stats = planner.getLayoutStats(8);

      expect(stats.byRCL[1]).toBeGreaterThan(0);
      expect(stats.byRCL[2]).toBeGreaterThan(0);
      expect(stats.byRCL[8]).toBeGreaterThan(0);
    });
  });

  describe("Visualization", () => {
    it("should return 0 when visualization is disabled", () => {
      const planner = new BasePlanner("W1N1", { enableVisualization: false });
      const mockRoom = {
        visual: {
          circle: vi.fn(),
          text: vi.fn()
        },
        getTerrain: createMockTerrain
      };

      const count = planner.visualize(mockRoom as any, 8);
      expect(count).toBe(0);
    });

    it("should visualize when enabled and anchor is set", () => {
      const planner = new BasePlanner("W1N1", { enableVisualization: true });

      // Set anchor manually by calling calculateAnchor first
      const terrain = createMockTerrain();
      const mockCalcRoom = {
        name: "W1N1",
        find: vi.fn().mockReturnValue([{ pos: { x: 25, y: 25 } }]),
        controller: { my: true, level: 1 }
      };
      planner.calculateAnchor(mockCalcRoom as any, terrain as any, 104);

      const mockRoom = {
        visual: {
          circle: vi.fn(),
          text: vi.fn()
        },
        getTerrain: createMockTerrain
      };

      const count = planner.visualize(mockRoom as any, 8);
      expect(count).toBeGreaterThan(0);
      expect(mockRoom.visual.circle).toHaveBeenCalled();
      expect(mockRoom.visual.text).toHaveBeenCalled();
    });
  });

  describe("Misplaced Structures Detection", () => {
    it("should identify structures not in planned positions", () => {
      const planner = new BasePlanner("W1N1");
      const terrain = createMockTerrain();

      const mockRoom = {
        name: "W1N1",
        find: vi.fn().mockImplementation((type: number) => {
          if (type === 104) {
            return [{ pos: { x: 25, y: 25 }, structureType: "spawn" }];
          }
          if (type === 107) {
            return [
              { pos: { x: 25, y: 25 }, structureType: "spawn" },
              { pos: { x: 10, y: 10 }, structureType: "extension" }
            ];
          }
          return [];
        }),
        controller: { my: true, level: 3 }
      };

      const misplaced = planner.getMisplacedStructures(mockRoom as any, terrain as any, 3, 104, 107);

      expect(misplaced.length).toBe(1);
      expect(misplaced[0].structure.structureType).toBe("extension");
      expect(misplaced[0].structure.pos.x).toBe(10);
      expect(misplaced[0].structure.pos.y).toBe(10);
    });

    it("should not flag correctly placed structures", () => {
      const planner = new BasePlanner("W1N1");
      const terrain = createMockTerrain();

      const mockRoom = {
        name: "W1N1",
        find: vi.fn().mockImplementation((type: number) => {
          if (type === 104) {
            return [{ pos: { x: 25, y: 25 }, structureType: "spawn" }];
          }
          if (type === 107) {
            return [{ pos: { x: 25, y: 25 }, structureType: "spawn" }];
          }
          return [];
        }),
        controller: { my: true, level: 1 }
      };

      const misplaced = planner.getMisplacedStructures(mockRoom as any, terrain as any, 1, 104, 107);
      expect(misplaced.length).toBe(0);
    });

    it("should ignore non-managed structure types", () => {
      const planner = new BasePlanner("W1N1");
      const terrain = createMockTerrain();

      const mockRoom = {
        name: "W1N1",
        find: vi.fn().mockImplementation((type: number) => {
          if (type === 104) {
            return [{ pos: { x: 25, y: 25 }, structureType: "spawn" }];
          }
          if (type === 107) {
            return [
              { pos: { x: 25, y: 25 }, structureType: "spawn" },
              { pos: { x: 5, y: 5 }, structureType: "road" }
            ];
          }
          return [];
        }),
        controller: { my: true, level: 1 }
      };

      const misplaced = planner.getMisplacedStructures(mockRoom as any, terrain as any, 1, 104, 107);
      expect(misplaced.length).toBe(0);
    });
  });

  describe("Structure Compliance with Game Limits", () => {
    const CONTROLLER_STRUCTURES: Record<string, Record<number, number>> = {
      spawn: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 3 },
      extension: { 1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60 },
      tower: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 8: 6 },
      storage: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 },
      link: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2, 6: 3, 7: 4, 8: 6 },
      terminal: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1 },
      lab: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 3, 7: 6, 8: 10 },
      factory: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 1, 8: 1 },
      observer: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
      powerSpawn: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
      nuker: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 }
    };

    const testCompliance = (structureType: string) => {
      const planner = new BasePlanner("W1N1");

      for (let rcl = 1; rcl <= 8; rcl++) {
        const limit = CONTROLLER_STRUCTURES[structureType]?.[rcl] ?? 0;
        const anchor = { x: 25, y: 25 };
        const plans = planner.getPlanForRCL(rcl, anchor);
        const count = plans.filter(p => p.structureType === structureType).length;
        expect(count).toBeLessThanOrEqual(limit);
      }
    };

    describe("Layout Compliance", () => {
      it("should not exceed spawn limits", () => testCompliance("spawn"));
      it("should not exceed extension limits", () => testCompliance("extension"));
      it("should not exceed tower limits", () => testCompliance("tower"));
      it("should not exceed storage limits", () => testCompliance("storage"));
      it("should not exceed link limits", () => testCompliance("link"));
      it("should not exceed terminal limits", () => testCompliance("terminal"));
      it("should not exceed lab limits", () => testCompliance("lab"));
      it("should not exceed factory limits", () => testCompliance("factory"));
      it("should not exceed observer limits", () => testCompliance("observer"));
      it("should not exceed power spawn limits", () => testCompliance("powerSpawn"));
      it("should not exceed nuker limits", () => testCompliance("nuker"));
    });
  });
});
