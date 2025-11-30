/**
 * Evolution and Posture System Tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { PostureManager, calculateDangerLevel } from "../src/logic/evolution";
import { createDefaultSwarmState } from "../src/memory/schemas";

describe("Evolution System", () => {
  describe("calculateDangerLevel", () => {
    it("should return 0 for peaceful conditions", () => {
      expect(calculateDangerLevel(0, 0, false)).toBe(0);
    });

    it("should return 1 for low threat", () => {
      expect(calculateDangerLevel(2, 100, false)).toBe(1);
    });

    it("should return 1 for enemy structures present", () => {
      expect(calculateDangerLevel(0, 0, true)).toBe(1);
    });

    it("should return 2 for medium threat (5+ hostiles)", () => {
      expect(calculateDangerLevel(5, 0, false)).toBe(2);
    });

    it("should return 2 for high damage (1000+)", () => {
      expect(calculateDangerLevel(0, 1000, false)).toBe(2);
    });

    it("should return 3 for critical threat (10+ hostiles)", () => {
      expect(calculateDangerLevel(10, 0, false)).toBe(3);
    });

    it("should return 3 for critical damage (2000+)", () => {
      expect(calculateDangerLevel(0, 2000, false)).toBe(3);
    });
  });

  describe("PostureManager", () => {
    let manager: PostureManager;

    beforeEach(() => {
      manager = new PostureManager();
    });

    describe("determinePosture", () => {
      it("should return eco for peaceful state", () => {
        const swarm = createDefaultSwarmState("W1N1");
        expect(manager.determinePosture(swarm)).toBe("eco");
      });

      it("should return siege for danger level 3", () => {
        const swarm = createDefaultSwarmState("W1N1");
        swarm.danger = 3;
        expect(manager.determinePosture(swarm)).toBe("siege");
      });

      it("should return war for danger level 2", () => {
        const swarm = createDefaultSwarmState("W1N1");
        swarm.danger = 2;
        expect(manager.determinePosture(swarm)).toBe("war");
      });

      it("should return defensive for danger level 1", () => {
        const swarm = createDefaultSwarmState("W1N1");
        swarm.danger = 1;
        expect(manager.determinePosture(swarm)).toBe("defensive");
      });

      it("should return expand when expand pheromone is high", () => {
        const swarm = createDefaultSwarmState("W1N1");
        swarm.pheromones.expand = 35;
        expect(manager.determinePosture(swarm)).toBe("expand");
      });

      it("should respect strategic override", () => {
        const swarm = createDefaultSwarmState("W1N1");
        expect(manager.determinePosture(swarm, "nukePrep")).toBe("nukePrep");
      });

      it("should not expand during danger", () => {
        const swarm = createDefaultSwarmState("W1N1");
        swarm.pheromones.expand = 50;
        swarm.danger = 1;
        expect(manager.determinePosture(swarm)).toBe("defensive");
      });
    });

    describe("getSpawnProfile", () => {
      it("should return high economy weight for eco posture", () => {
        const profile = manager.getSpawnProfile("eco");
        expect(profile.economy).toBe(0.75);
        expect(profile.military).toBe(0.05);
      });

      it("should return high military weight for war posture", () => {
        const profile = manager.getSpawnProfile("war");
        expect(profile.military).toBe(0.5);
        expect(profile.economy).toBe(0.3);
      });

      it("should return high utility weight for evacuate posture", () => {
        const profile = manager.getSpawnProfile("evacuate");
        expect(profile.utility).toBe(0.8);
        expect(profile.economy).toBe(0.1);
      });
    });

    describe("getResourcePriorities", () => {
      it("should prioritize upgrade in eco posture", () => {
        const priorities = manager.getResourcePriorities("eco");
        expect(priorities.upgrade).toBe(80);
      });

      it("should prioritize repair in siege posture", () => {
        const priorities = manager.getResourcePriorities("siege");
        expect(priorities.repair).toBe(90);
      });
    });

    describe("posture capabilities", () => {
      it("should allow building in eco posture", () => {
        expect(manager.allowsBuilding("eco")).toBe(true);
      });

      it("should not allow building in siege posture", () => {
        expect(manager.allowsBuilding("siege")).toBe(false);
      });

      it("should not allow building in evacuate posture", () => {
        expect(manager.allowsBuilding("evacuate")).toBe(false);
      });

      it("should allow upgrading in eco posture", () => {
        expect(manager.allowsUpgrading("eco")).toBe(true);
      });

      it("should not allow upgrading in war posture", () => {
        expect(manager.allowsUpgrading("war")).toBe(false);
      });

      it("should identify combat postures", () => {
        expect(manager.isCombatPosture("defensive")).toBe(true);
        expect(manager.isCombatPosture("war")).toBe(true);
        expect(manager.isCombatPosture("siege")).toBe(true);
        expect(manager.isCombatPosture("eco")).toBe(false);
      });

      it("should allow expansion in appropriate postures", () => {
        expect(manager.allowsExpansion("eco")).toBe(true);
        expect(manager.allowsExpansion("expand")).toBe(true);
        expect(manager.allowsExpansion("war")).toBe(false);
      });
    });
  });
});
