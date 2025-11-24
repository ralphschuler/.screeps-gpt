import { describe, it, expect, beforeEach } from "vitest";
import { BodyComposer } from "@runtime/behavior";

describe("BodyComposer", () => {
  let composer: BodyComposer;

  beforeEach(() => {
    composer = new BodyComposer();
  });

  describe("generateBody", () => {
    describe("harvester role", () => {
      it("should generate minimal body at RCL 1 (300 energy)", () => {
        const body = composer.generateBody("harvester", 300);
        expect(body).toEqual([WORK, CARRY, MOVE]);
        expect(composer.calculateBodyCost(body)).toBe(200);
      });

      it("should scale up body at RCL 2 (550 energy)", () => {
        const body = composer.generateBody("harvester", 550);
        expect(body.length).toBeGreaterThan(3);
        expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(550);
        expect(composer.calculateBodyCost(body)).toBeGreaterThanOrEqual(350); // Base + pattern
      });

      it("should scale up body at RCL 3 (800 energy)", () => {
        const body = composer.generateBody("harvester", 800);
        expect(body.length).toBeGreaterThan(6);
        expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(800);
        expect(composer.calculateBodyCost(body)).toBeGreaterThanOrEqual(600); // Base + patterns
      });

      it("should scale up body at RCL 4 (1300 energy)", () => {
        const body = composer.generateBody("harvester", 1300);
        expect(body.length).toBeGreaterThan(9);
        expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(1300);
        expect(composer.calculateBodyCost(body)).toBeGreaterThanOrEqual(1000); // Base + patterns
      });

      it("should return empty array with insufficient energy (150 < 200 minimum)", () => {
        // With new 200 energy minimum requirement, 150 is insufficient
        const body = composer.generateBody("harvester", 150);
        expect(body).toEqual([]); // Insufficient energy for minimal viable body
      });
    });

    describe("upgrader role", () => {
      it("should generate minimal body at RCL 1 (300 energy)", () => {
        const body = composer.generateBody("upgrader", 300);
        expect(body).toEqual([WORK, CARRY, MOVE]);
        expect(composer.calculateBodyCost(body)).toBe(200);
      });

      it("should scale up body at RCL 2 (550 energy)", () => {
        const body = composer.generateBody("upgrader", 550);
        expect(body.length).toBeGreaterThan(3);
        expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(550);
      });
    });

    describe("builder role", () => {
      it("should generate minimal body with extra move at RCL 1 (300 energy)", () => {
        const body = composer.generateBody("builder", 300);
        expect(body).toEqual([WORK, CARRY, MOVE, MOVE]);
        expect(composer.calculateBodyCost(body)).toBe(250);
      });

      it("should scale up body at RCL 2 (550 energy)", () => {
        const body = composer.generateBody("builder", 550);
        expect(body.length).toBeGreaterThan(4);
        expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(550);
      });
    });

    describe("remoteMiner role", () => {
      it("should generate work-heavy body for remote mining", () => {
        const body = composer.generateBody("remoteMiner", 550);
        const workParts = body.filter(p => p === WORK).length;
        const moveParts = body.filter(p => p === MOVE).length;

        expect(workParts).toBeGreaterThanOrEqual(2);
        expect(moveParts).toBeGreaterThanOrEqual(2);
        expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(550);
      });

      it("should return empty array if insufficient energy for base body", () => {
        const body = composer.generateBody("remoteMiner", 300);
        expect(body).toEqual([]);
      });
    });

    describe("stationaryHarvester role", () => {
      it("should generate work-heavy body for container harvesting", () => {
        const body = composer.generateBody("stationaryHarvester", 800);
        const workParts = body.filter(p => p === WORK).length;

        expect(workParts).toBeGreaterThanOrEqual(5);
        expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(800);
      });

      it("should return empty array if insufficient energy for base body", () => {
        const body = composer.generateBody("stationaryHarvester", 500);
        expect(body).toEqual([]);
      });

      it("should scale with high energy capacity", () => {
        const body = composer.generateBody("stationaryHarvester", 1800);
        const workParts = body.filter(p => p === WORK).length;

        expect(workParts).toBeGreaterThanOrEqual(10);
        expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(1800);
      });
    });

    describe("hauler role", () => {
      it("should generate carry-heavy body for energy transport", () => {
        const body = composer.generateBody("hauler", 800);
        const carryParts = body.filter(p => p === CARRY).length;
        const moveParts = body.filter(p => p === MOVE).length;

        expect(carryParts).toBeGreaterThanOrEqual(4);
        expect(moveParts).toBeGreaterThanOrEqual(4);
        expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(800);
      });

      it("should scale carry capacity at high energy", () => {
        const body = composer.generateBody("hauler", 1300);
        const carryParts = body.filter(p => p === CARRY).length;

        expect(carryParts).toBeGreaterThanOrEqual(8);
        expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(1300);
      });
    });

    describe("repairer role", () => {
      it("should generate work-heavy body for repairs", () => {
        const body = composer.generateBody("repairer", 550);
        const workParts = body.filter(p => p === WORK).length;

        expect(workParts).toBeGreaterThanOrEqual(2);
        expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(550);
      });

      it("should return empty array if insufficient energy for base body", () => {
        const body = composer.generateBody("repairer", 300);
        expect(body).toEqual([]);
      });
    });

    describe("claimer role", () => {
      it("should generate body with CLAIM part at minimum energy", () => {
        const body = composer.generateBody("claimer", 650);
        expect(body).toContain(CLAIM);
        expect(body).toContain(MOVE);
        expect(composer.calculateBodyCost(body)).toBe(650);
      });

      it("should scale with additional MOVE parts at higher energy", () => {
        const body = composer.generateBody("claimer", 850);
        const moveParts = body.filter(p => p === MOVE).length;
        const claimParts = body.filter(p => p === CLAIM).length;

        expect(claimParts).toBe(1); // Only one CLAIM in base
        expect(moveParts).toBeGreaterThan(1); // Additional move parts added
        expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(850);
      });

      it("should return empty array if insufficient energy for base body", () => {
        const body = composer.generateBody("claimer", 600);
        expect(body).toEqual([]);
      });
    });

    describe("scout role", () => {
      it("should generate minimal body with just MOVE parts", () => {
        const body = composer.generateBody("scout", 50);
        expect(body).toEqual([MOVE]);
        expect(composer.calculateBodyCost(body)).toBe(50);
      });

      it("should scale with additional MOVE parts at higher energy", () => {
        const body = composer.generateBody("scout", 200);
        const moveParts = body.filter(p => p === MOVE).length;

        expect(moveParts).toBeGreaterThan(1);
        expect(body.every(p => p === MOVE)).toBe(true); // All parts should be MOVE
        expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(200);
      });

      it("should return empty array if insufficient energy for base body", () => {
        const body = composer.generateBody("scout", 40);
        expect(body).toEqual([]);
      });
    });

    describe("unknown role", () => {
      it("should return minimal body for unknown role with sufficient energy", () => {
        const body = composer.generateBody("unknown", 300);
        expect(body).toEqual([WORK, CARRY, MOVE]);
        expect(composer.calculateBodyCost(body)).toBe(200);
      });

      it("should return empty array for unknown role with insufficient energy", () => {
        // Unknown roles fallback to emergency body generation, but 150 < 200 minimum
        const body = composer.generateBody("unknown", 150);
        expect(body).toEqual([]); // Insufficient energy for minimal viable body
      });
    });
  });

  describe("body size limits", () => {
    it("should not exceed 50 body parts (MAX_CREEP_SIZE)", () => {
      const body = composer.generateBody("harvester", 10000);
      expect(body.length).toBeLessThanOrEqual(50);
    });

    it("should respect MAX_CREEP_SIZE for work-heavy roles", () => {
      const body = composer.generateBody("stationaryHarvester", 10000);
      expect(body.length).toBeLessThanOrEqual(50);
    });

    it("should respect MAX_CREEP_SIZE for carry-heavy roles", () => {
      const body = composer.generateBody("hauler", 10000);
      expect(body.length).toBeLessThanOrEqual(50);
    });
  });

  describe("calculateBodyCost", () => {
    it("should calculate correct cost for basic body", () => {
      const cost = composer.calculateBodyCost([WORK, CARRY, MOVE]);
      expect(cost).toBe(200); // 100 + 50 + 50
    });

    it("should calculate correct cost for complex body", () => {
      const cost = composer.calculateBodyCost([WORK, WORK, CARRY, MOVE, MOVE]);
      expect(cost).toBe(350); // 100 + 100 + 50 + 50 + 50
    });

    it("should return 0 for empty body", () => {
      const cost = composer.calculateBodyCost([]);
      expect(cost).toBe(0);
    });

    it("should calculate cost for expensive parts", () => {
      const cost = composer.calculateBodyCost([HEAL, RANGED_ATTACK, ATTACK, CLAIM]);
      expect(cost).toBe(1080); // 250 + 150 + 80 + 600
    });
  });

  describe("getPattern", () => {
    it("should return pattern for valid role", () => {
      const pattern = composer.getPattern("harvester");
      expect(pattern).toBeDefined();
      expect(pattern?.base).toBeDefined();
      expect(pattern?.pattern).toBeDefined();
    });

    it("should return undefined for invalid role", () => {
      const pattern = composer.getPattern("invalid");
      expect(pattern).toBeUndefined();
    });

    it("should return patterns for all standard roles", () => {
      const roles = ["harvester", "upgrader", "builder", "remoteMiner", "stationaryHarvester", "hauler", "repairer", "claimer", "scout"];

      for (const role of roles) {
        const pattern = composer.getPattern(role);
        expect(pattern).toBeDefined();
        expect(pattern?.base.length).toBeGreaterThan(0);
        expect(pattern?.pattern.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getAvailableRoles", () => {
    it("should return array of available roles", () => {
      const roles = composer.getAvailableRoles();
      expect(roles).toBeInstanceOf(Array);
      expect(roles.length).toBeGreaterThan(0);
    });

    it("should include all standard roles", () => {
      const roles = composer.getAvailableRoles();
      expect(roles).toContain("harvester");
      expect(roles).toContain("upgrader");
      expect(roles).toContain("builder");
      expect(roles).toContain("remoteMiner");
      expect(roles).toContain("stationaryHarvester");
      expect(roles).toContain("hauler");
      expect(roles).toContain("repairer");
      expect(roles).toContain("claimer");
      expect(roles).toContain("scout");
    });
  });

  describe("energy efficiency", () => {
    it("should utilize most of available energy capacity", () => {
      const energyCapacities = [300, 550, 800, 1300, 1800];

      for (const capacity of energyCapacities) {
        const body = composer.generateBody("harvester", capacity);
        const cost = composer.calculateBodyCost(body);

        // Should use at least 60% of available capacity (accounts for base body and pattern rounding)
        expect(cost).toBeGreaterThanOrEqual(capacity * 0.6);
        // But not exceed capacity
        expect(cost).toBeLessThanOrEqual(capacity);
      }
    });

    it("should maximize energy usage for high capacity rooms", () => {
      const body = composer.generateBody("harvester", 2000);
      const cost = composer.calculateBodyCost(body);

      // Should be using most of the energy or hitting MAX_CREEP_SIZE
      expect(cost).toBeGreaterThanOrEqual(1500);
      expect(body.length).toBeLessThanOrEqual(50);
    });
  });

  describe("body composition quality", () => {
    it("should maintain balanced ratios for harvesters", () => {
      const body = composer.generateBody("harvester", 800);
      const workParts = body.filter(p => p === WORK).length;
      const carryParts = body.filter(p => p === CARRY).length;
      const moveParts = body.filter(p => p === MOVE).length;

      // Should have balanced distribution
      expect(workParts).toBeGreaterThan(0);
      expect(carryParts).toBeGreaterThan(0);
      expect(moveParts).toBeGreaterThan(0);

      // Ratios should be reasonable (work:carry:move should be roughly 1:1:1)
      expect(Math.abs(workParts - carryParts)).toBeLessThanOrEqual(2);
      expect(Math.abs(workParts - moveParts)).toBeLessThanOrEqual(2);
    });

    it("should prioritize work parts for stationary harvesters", () => {
      const body = composer.generateBody("stationaryHarvester", 1000);
      const workParts = body.filter(p => p === WORK).length;
      const moveParts = body.filter(p => p === MOVE).length;

      // Should have many more work parts than move parts
      expect(workParts).toBeGreaterThan(moveParts * 2);
    });

    it("should prioritize carry parts for haulers", () => {
      const body = composer.generateBody("hauler", 1000);
      const carryParts = body.filter(p => p === CARRY).length;
      const moveParts = body.filter(p => p === MOVE).length;

      // Should have more carry than move for efficiency
      expect(carryParts).toBeGreaterThan(moveParts);
    });
  });
});
