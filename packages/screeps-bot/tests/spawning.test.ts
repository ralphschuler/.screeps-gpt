import { describe, it, expect, beforeEach } from "vitest";
import { calculateBodyCost, scaleBody, createSpawnMemory, type RoleSpawnConfig } from "../src/spawning/types";

describe("Spawning Types", () => {
  describe("calculateBodyCost", () => {
    it("should calculate cost for simple body", () => {
      const body: BodyPartConstant[] = [WORK, CARRY, MOVE];
      expect(calculateBodyCost(body)).toBe(200); // 100 + 50 + 50
    });

    it("should calculate cost for complex body", () => {
      const body: BodyPartConstant[] = [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
      expect(calculateBodyCost(body)).toBe(400); // 200 + 100 + 100
    });

    it("should handle military parts", () => {
      const body: BodyPartConstant[] = [ATTACK, RANGED_ATTACK, HEAL, TOUGH, MOVE];
      expect(calculateBodyCost(body)).toBe(540); // 80 + 150 + 250 + 10 + 50
    });

    it("should handle claim part", () => {
      const body: BodyPartConstant[] = [CLAIM, MOVE];
      expect(calculateBodyCost(body)).toBe(650); // 600 + 50
    });

    it("should return 0 for empty body", () => {
      expect(calculateBodyCost([])).toBe(0);
    });
  });

  describe("scaleBody", () => {
    const baseConfig: RoleSpawnConfig = {
      role: "swarmHarvester",
      family: "economy",
      baseBody: [WORK, CARRY, MOVE],
      scalingParts: [WORK, MOVE],
      maxParts: 20,
      priority: 0
    };

    it("should return empty array if not enough energy for base body", () => {
      const body = scaleBody(baseConfig, 100, 300);
      expect(body).toEqual([]);
    });

    it("should return base body with exact energy", () => {
      const body = scaleBody(baseConfig, 200, 300);
      expect(body).toEqual([WORK, CARRY, MOVE]);
    });

    it("should scale body with extra energy", () => {
      const body = scaleBody(baseConfig, 500, 500);
      // Base: 200 (WORK, CARRY, MOVE)
      // Scale: 150 (WORK, MOVE) x2 = 300
      expect(body).toEqual([WORK, CARRY, MOVE, WORK, MOVE, WORK, MOVE]);
    });

    it("should not exceed maxParts", () => {
      const limitedConfig = { ...baseConfig, maxParts: 5 };
      const body = scaleBody(limitedConfig, 1000, 1000);
      expect(body.length).toBeLessThanOrEqual(5);
    });

    it("should not exceed 50 parts total", () => {
      const unlimitedConfig = { ...baseConfig, maxParts: 100 };
      const body = scaleBody(unlimitedConfig, 10000, 10000);
      expect(body.length).toBeLessThanOrEqual(50);
    });

    it("should respect maxEnergy parameter", () => {
      const body = scaleBody(baseConfig, 1000, 350);
      // With maxEnergy of 350, can only add 1 scaling set (150)
      expect(body).toEqual([WORK, CARRY, MOVE, WORK, MOVE]);
    });
  });

  describe("createSpawnMemory", () => {
    it("should create memory with role and task", () => {
      const memory = createSpawnMemory("swarmHarvester", "W1N1");
      expect(memory.role).toBe("swarmHarvester");
      expect(memory.task).toBe("idle");
      expect(memory.version).toBe(1);
      expect(memory.homeRoom).toBe("W1N1");
    });

    it("should handle different roles", () => {
      const defenderMemory = createSpawnMemory("swarmDefender", "E2S2");
      expect(defenderMemory.role).toBe("swarmDefender");
      expect(defenderMemory.homeRoom).toBe("E2S2");
    });
  });
});
