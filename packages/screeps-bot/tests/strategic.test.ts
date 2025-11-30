import { describe, it, expect, beforeEach } from "vitest";
import { StrategyManager } from "../src/strategic/StrategyManager";
import { calculateExpansionScore, createExpansionTarget, createWarTarget, advanceWarStage, retreatWarStage } from "../src/strategic/types";
import type { WarTarget } from "../src/core/types";

describe("StrategyManager", () => {
  let manager: StrategyManager;

  beforeEach(() => {
    manager = new StrategyManager();
  });

  describe("calculateExpansionScore", () => {
    it("should give higher score for more sources", () => {
      const score1 = calculateExpansionScore(1, 2, false, "plains", null);
      const score2 = calculateExpansionScore(2, 2, false, "plains", null);
      expect(score2).toBeGreaterThan(score1);
    });

    it("should penalize distance", () => {
      const nearScore = calculateExpansionScore(2, 1, false, "plains", null);
      const farScore = calculateExpansionScore(2, 5, false, "plains", null);
      expect(nearScore).toBeGreaterThan(farScore);
    });

    it("should penalize enemy presence", () => {
      const safeScore = calculateExpansionScore(2, 2, false, "plains", null);
      const hostileScore = calculateExpansionScore(2, 2, true, "plains", null);
      expect(safeScore).toBeGreaterThan(hostileScore);
    });

    it("should give bonus for plains terrain", () => {
      const plainsScore = calculateExpansionScore(2, 2, false, "plains", null);
      const swampScore = calculateExpansionScore(2, 2, false, "swamp", null);
      expect(plainsScore).toBeGreaterThan(swampScore);
    });

    it("should give bonus for minerals", () => {
      const noMineral = calculateExpansionScore(2, 2, false, "plains", null);
      const withMineral = calculateExpansionScore(2, 2, false, "plains", "O");
      expect(withMineral).toBeGreaterThan(noMineral);
    });
  });

  describe("createExpansionTarget", () => {
    it("should create target with calculated score", () => {
      const target = createExpansionTarget("W5N5", 2, 3, false, "plains");
      expect(target.roomName).toBe("W5N5");
      expect(target.sources).toBe(2);
      expect(target.distance).toBe(3);
      expect(target.enemyPresence).toBe(false);
      expect(target.terrain).toBe("plains");
      expect(target.score).toBeGreaterThan(0);
    });
  });

  describe("createWarTarget", () => {
    it("should create war target with prewar stage", () => {
      const target = createWarTarget("TestPlayer", ["W1N1", "W1N2"], 50);
      expect(target.playerName).toBe("TestPlayer");
      expect(target.rooms).toEqual(["W1N1", "W1N2"]);
      expect(target.priority).toBe(50);
      expect(target.stage).toBe("prewar");
    });
  });

  describe("advanceWarStage", () => {
    it("should progress through war stages", () => {
      const target = createWarTarget("TestPlayer", [], 50);
      expect(target.stage).toBe("prewar");

      advanceWarStage(target);
      expect(target.stage).toBe("limited");

      advanceWarStage(target);
      expect(target.stage).toBe("siege");

      advanceWarStage(target);
      expect(target.stage).toBe("attrition");

      advanceWarStage(target);
      expect(target.stage).toBe("attrition"); // Stays at max
    });
  });

  describe("retreatWarStage", () => {
    it("should regress through war stages", () => {
      const target: WarTarget = { ...createWarTarget("TestPlayer", [], 50), stage: "attrition" };

      retreatWarStage(target);
      expect(target.stage).toBe("siege");

      retreatWarStage(target);
      expect(target.stage).toBe("limited");

      retreatWarStage(target);
      expect(target.stage).toBe("prewar");
    });
  });

  describe("addExpansionTarget", () => {
    it("should add new expansion target", () => {
      manager.addExpansionTarget("W5N5", 2, 3, false, "plains");
      const targets = manager.getTopExpansionTargets();
      expect(targets.length).toBe(1);
      expect(targets[0].roomName).toBe("W5N5");
    });

    it("should update existing target", () => {
      manager.addExpansionTarget("W5N5", 1, 3, false, "plains");
      manager.addExpansionTarget("W5N5", 2, 3, false, "plains");
      const targets = manager.getTopExpansionTargets();
      expect(targets.length).toBe(1);
    });

    it("should reject targets with insufficient sources", () => {
      const customManager = new StrategyManager({ minSources: 2 });
      customManager.addExpansionTarget("W5N5", 1, 3, false, "plains");
      const targets = customManager.getTopExpansionTargets();
      expect(targets.length).toBe(0);
    });

    it("should reject targets beyond max distance", () => {
      const customManager = new StrategyManager({ maxDistance: 2 });
      customManager.addExpansionTarget("W5N5", 2, 5, false, "plains");
      const targets = customManager.getTopExpansionTargets();
      expect(targets.length).toBe(0);
    });
  });

  describe("removeExpansionTarget", () => {
    it("should remove expansion target", () => {
      manager.addExpansionTarget("W5N5", 2, 3, false, "plains");
      manager.removeExpansionTarget("W5N5");
      const targets = manager.getTopExpansionTargets();
      expect(targets.length).toBe(0);
    });
  });

  describe("getTopExpansionTargets", () => {
    it("should return targets sorted by score", () => {
      manager.addExpansionTarget("W1N1", 1, 5, true, "swamp");
      manager.addExpansionTarget("W2N2", 2, 1, false, "plains");
      const targets = manager.getTopExpansionTargets(5);
      expect(targets[0].roomName).toBe("W2N2");
    });

    it("should limit results to count parameter", () => {
      manager.addExpansionTarget("W1N1", 2, 1, false, "plains");
      manager.addExpansionTarget("W2N2", 2, 1, false, "plains");
      manager.addExpansionTarget("W3N3", 2, 1, false, "plains");
      const targets = manager.getTopExpansionTargets(2);
      expect(targets.length).toBe(2);
    });
  });

  describe("addWarTarget", () => {
    it("should add new war target", () => {
      manager.addWarTarget("TestPlayer", ["W1N1"], 50);
      const targets = manager.getWarTargets();
      expect(targets.length).toBe(1);
      expect(targets[0].playerName).toBe("TestPlayer");
    });

    it("should merge rooms for existing target", () => {
      manager.addWarTarget("TestPlayer", ["W1N1"], 50);
      manager.addWarTarget("TestPlayer", ["W2N2"], 60);
      const targets = manager.getWarTargets();
      expect(targets.length).toBe(1);
      expect(targets[0].rooms).toContain("W1N1");
      expect(targets[0].rooms).toContain("W2N2");
      expect(targets[0].priority).toBe(60);
    });
  });

  describe("removeWarTarget", () => {
    it("should remove war target", () => {
      manager.addWarTarget("TestPlayer", ["W1N1"], 50);
      manager.removeWarTarget("TestPlayer");
      expect(manager.getWarTargets().length).toBe(0);
    });
  });

  describe("escalateWar / deescalateWar", () => {
    it("should advance war stage", () => {
      manager.addWarTarget("TestPlayer", ["W1N1"], 50);
      manager.escalateWar("TestPlayer");
      expect(manager.getWarStage("TestPlayer")).toBe("limited");
    });

    it("should retreat war stage", () => {
      manager.addWarTarget("TestPlayer", ["W1N1"], 50);
      manager.escalateWar("TestPlayer");
      manager.deescalateWar("TestPlayer");
      expect(manager.getWarStage("TestPlayer")).toBe("prewar");
    });

    it("should remove target when deescalated from prewar", () => {
      manager.addWarTarget("TestPlayer", ["W1N1"], 50);
      manager.deescalateWar("TestPlayer");
      expect(manager.isWarTarget("TestPlayer")).toBe(false);
    });
  });

  describe("isWarTarget", () => {
    it("should return true for active war target", () => {
      manager.addWarTarget("TestPlayer", ["W1N1"], 50);
      expect(manager.isWarTarget("TestPlayer")).toBe(true);
    });

    it("should return false for non-target", () => {
      expect(manager.isWarTarget("NotATarget")).toBe(false);
    });
  });

  describe("saveToMemory / loadFromMemory", () => {
    it("should save and load state", () => {
      manager.addExpansionTarget("W5N5", 2, 3, false, "plains");
      manager.addWarTarget("TestPlayer", ["W1N1"], 50);
      manager.escalateWar("TestPlayer");

      const saved = manager.saveToMemory();

      const newManager = new StrategyManager();
      newManager.loadFromMemory(saved.expansionTargets, saved.warTargets);

      expect(newManager.getTopExpansionTargets().length).toBe(1);
      expect(newManager.getWarStage("TestPlayer")).toBe("limited");
    });
  });
});
