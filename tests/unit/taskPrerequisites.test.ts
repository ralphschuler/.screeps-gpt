import { describe, it, expect, beforeEach } from "vitest";
import { MinionHasBodyParts } from "@runtime/tasks";

// Setup global constants
global.WORK = "work" as BodyPartConstant;
global.CARRY = "carry" as BodyPartConstant;
global.MOVE = "move" as BodyPartConstant;
global.ATTACK = "attack" as BodyPartConstant;
global.RANGED_ATTACK = "ranged_attack" as BodyPartConstant;
global.HEAL = "heal" as BodyPartConstant;
global.CLAIM = "claim" as BodyPartConstant;
global.TOUGH = "tough" as BodyPartConstant;

describe("MinionHasBodyParts prerequisite", () => {
  const createMockCreep = (body: Array<{ type: BodyPartConstant; hits: number }>): Creep => {
    return {
      body,
      name: "TestCreep",
      id: "creep1" as Id<Creep>
    } as unknown as Creep;
  };

  describe("basic functionality", () => {
    it("should reject creep without required parts", () => {
      const creep = createMockCreep([
        { type: CARRY, hits: 100 },
        { type: MOVE, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({ [WORK]: 1 });
      expect(prereq.meets(creep)).toBe(false);
    });

    it("should accept creep with exactly the required number of parts", () => {
      const creep = createMockCreep([
        { type: WORK, hits: 100 },
        { type: CARRY, hits: 100 },
        { type: MOVE, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({ [WORK]: 1 });
      expect(prereq.meets(creep)).toBe(true);
    });

    it("should accept creep with more than required parts", () => {
      const creep = createMockCreep([
        { type: WORK, hits: 100 },
        { type: WORK, hits: 100 },
        { type: WORK, hits: 100 },
        { type: CARRY, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({ [WORK]: 2 });
      expect(prereq.meets(creep)).toBe(true);
    });

    it("should accept creep with sufficient functional parts", () => {
      const creep = createMockCreep([
        { type: WORK, hits: 100 },
        { type: WORK, hits: 100 },
        { type: CARRY, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({ [WORK]: 2 });
      expect(prereq.meets(creep)).toBe(true);
    });
  });

  describe("damaged body parts filtering", () => {
    it("should ignore damaged body parts with zero hits", () => {
      const creep = createMockCreep([
        { type: WORK, hits: 0 }, // Damaged - should not count
        { type: WORK, hits: 100 }, // Functional
        { type: CARRY, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({ [WORK]: 2 });
      expect(prereq.meets(creep)).toBe(false); // Only 1 functional WORK part
    });

    it("should count all functional parts when none are damaged", () => {
      const creep = createMockCreep([
        { type: WORK, hits: 100 },
        { type: WORK, hits: 50 }, // Partially damaged but still functional
        { type: WORK, hits: 1 }, // Barely functional but still counts
        { type: CARRY, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({ [WORK]: 3 });
      expect(prereq.meets(creep)).toBe(true);
    });

    it("should reject creep when all required parts are damaged", () => {
      const creep = createMockCreep([
        { type: WORK, hits: 0 },
        { type: WORK, hits: 0 },
        { type: CARRY, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({ [WORK]: 1 });
      expect(prereq.meets(creep)).toBe(false);
    });

    it("should handle mix of damaged and functional parts correctly", () => {
      const creep = createMockCreep([
        { type: WORK, hits: 0 }, // Damaged
        { type: WORK, hits: 100 }, // Functional
        { type: WORK, hits: 0 }, // Damaged
        { type: WORK, hits: 100 }, // Functional
        { type: CARRY, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({ [WORK]: 2 });
      expect(prereq.meets(creep)).toBe(true); // Exactly 2 functional WORK parts
    });
  });

  describe("multiple part types validation", () => {
    it("should validate multiple part types simultaneously", () => {
      const creep = createMockCreep([
        { type: WORK, hits: 100 },
        { type: CARRY, hits: 100 },
        { type: CARRY, hits: 100 },
        { type: MOVE, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({
        [WORK]: 1,
        [CARRY]: 2,
        [MOVE]: 1
      });
      expect(prereq.meets(creep)).toBe(true);
    });

    it("should reject if any part type requirement is not met", () => {
      const creep = createMockCreep([
        { type: WORK, hits: 100 },
        { type: CARRY, hits: 100 }, // Only 1 CARRY, need 2
        { type: MOVE, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({
        [WORK]: 1,
        [CARRY]: 2,
        [MOVE]: 1
      });
      expect(prereq.meets(creep)).toBe(false);
    });

    it("should handle multiple part types with damaged parts", () => {
      const creep = createMockCreep([
        { type: WORK, hits: 100 },
        { type: WORK, hits: 0 }, // Damaged
        { type: CARRY, hits: 100 },
        { type: CARRY, hits: 100 },
        { type: CARRY, hits: 0 }, // Damaged
        { type: MOVE, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({
        [WORK]: 1,
        [CARRY]: 2,
        [MOVE]: 1
      });
      expect(prereq.meets(creep)).toBe(true);
    });

    it("should reject if multiple part types have too many damaged parts", () => {
      const creep = createMockCreep([
        { type: WORK, hits: 0 }, // Damaged
        { type: WORK, hits: 100 },
        { type: CARRY, hits: 0 }, // Damaged
        { type: CARRY, hits: 100 },
        { type: MOVE, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({
        [WORK]: 2,
        [CARRY]: 2,
        [MOVE]: 1
      });
      expect(prereq.meets(creep)).toBe(false); // Only 1 functional WORK and 1 functional CARRY
    });
  });

  describe("edge cases", () => {
    it("should handle empty body", () => {
      const creep = createMockCreep([]);

      const prereq = new MinionHasBodyParts({ [WORK]: 1 });
      expect(prereq.meets(creep)).toBe(false);
    });

    it("should handle empty requirements (should always pass)", () => {
      const creep = createMockCreep([
        { type: WORK, hits: 100 },
        { type: CARRY, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({});
      expect(prereq.meets(creep)).toBe(true);
    });

    it("should handle requirement of 0 parts (should always pass)", () => {
      const creep = createMockCreep([{ type: CARRY, hits: 100 }]);

      const prereq = new MinionHasBodyParts({ [WORK]: 0 });
      expect(prereq.meets(creep)).toBe(true);
    });

    it("should handle large number of parts", () => {
      const body = [];
      for (let i = 0; i < 50; i++) {
        body.push({ type: WORK, hits: 100 });
      }
      const creep = createMockCreep(body);

      const prereq = new MinionHasBodyParts({ [WORK]: 50 });
      expect(prereq.meets(creep)).toBe(true);
    });

    it("should handle all part types damaged in large body", () => {
      const body = [];
      for (let i = 0; i < 25; i++) {
        body.push({ type: WORK, hits: 0 }); // All damaged
      }
      for (let i = 0; i < 25; i++) {
        body.push({ type: CARRY, hits: 100 });
      }
      const creep = createMockCreep(body);

      const prereq = new MinionHasBodyParts({ [WORK]: 1 });
      expect(prereq.meets(creep)).toBe(false); // All WORK parts damaged
    });

    it("should handle different part types (combat parts)", () => {
      const creep = createMockCreep([
        { type: ATTACK, hits: 100 },
        { type: RANGED_ATTACK, hits: 100 },
        { type: HEAL, hits: 100 },
        { type: TOUGH, hits: 100 },
        { type: MOVE, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({
        [ATTACK]: 1,
        [HEAL]: 1
      });
      expect(prereq.meets(creep)).toBe(true);
    });
  });

  describe("toMeet method", () => {
    it("should return empty array (cannot modify existing creep body)", () => {
      const creep = createMockCreep([
        { type: CARRY, hits: 100 },
        { type: MOVE, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({ [WORK]: 1 });
      const actions = prereq.toMeet(creep);

      expect(actions).toEqual([]);
    });

    it("should return empty array even when prerequisites are met", () => {
      const creep = createMockCreep([
        { type: WORK, hits: 100 },
        { type: CARRY, hits: 100 },
        { type: MOVE, hits: 100 }
      ]);

      const prereq = new MinionHasBodyParts({ [WORK]: 1 });
      const actions = prereq.toMeet(creep);

      expect(actions).toEqual([]);
    });
  });
});
