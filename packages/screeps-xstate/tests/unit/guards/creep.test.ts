import { describe, it, expect, beforeEach } from "vitest";
import {
  hasBodyPart,
  hasWorkParts,
  hasCarryParts,
  hasMoveParts,
  isDamaged,
  isHealthBelow,
  isSpawning,
  hasMinBodyParts,
  hasActiveBodyPart,
  hasRole,
  hasRoleType
} from "../../../src/guards/creep.js";
import type { CreepContext } from "../../../src/guards/types.js";

// Mock WORK, CARRY, MOVE constants
const WORK = "work";
const CARRY = "carry";
const MOVE = "move";
const ATTACK = "attack";

// Make them available globally for the tests
(global as Record<string, unknown>).WORK = WORK;
(global as Record<string, unknown>).CARRY = CARRY;
(global as Record<string, unknown>).MOVE = MOVE;
(global as Record<string, unknown>).ATTACK = ATTACK;

describe("Creep Guards", () => {
  let mockCreep: Partial<Creep>;
  let ctx: CreepContext;

  beforeEach(() => {
    mockCreep = {
      body: [],
      hits: 100,
      hitsMax: 100,
      spawning: false,
      memory: {} as CreepMemory
    };
    ctx = { creep: mockCreep as Creep };
  });

  describe("hasBodyPart", () => {
    it("returns true when creep has the body part", () => {
      mockCreep.body = [{ type: WORK as BodyPartConstant, hits: 100 }];
      const guard = hasBodyPart(WORK as BodyPartConstant);
      expect(guard(ctx)).toBe(true);
    });

    it("returns false when creep does not have the body part", () => {
      mockCreep.body = [{ type: CARRY as BodyPartConstant, hits: 100 }];
      const guard = hasBodyPart(WORK as BodyPartConstant);
      expect(guard(ctx)).toBe(false);
    });

    it("returns true when body part exists among multiple parts", () => {
      mockCreep.body = [
        { type: WORK as BodyPartConstant, hits: 100 },
        { type: CARRY as BodyPartConstant, hits: 100 },
        { type: MOVE as BodyPartConstant, hits: 100 }
      ];
      const guard = hasBodyPart(CARRY as BodyPartConstant);
      expect(guard(ctx)).toBe(true);
    });
  });

  describe("hasWorkParts", () => {
    it("returns true when creep has WORK parts", () => {
      mockCreep.body = [{ type: WORK as BodyPartConstant, hits: 100 }];
      expect(hasWorkParts(ctx)).toBe(true);
    });

    it("returns false when creep has no WORK parts", () => {
      mockCreep.body = [{ type: CARRY as BodyPartConstant, hits: 100 }];
      expect(hasWorkParts(ctx)).toBe(false);
    });
  });

  describe("hasCarryParts", () => {
    it("returns true when creep has CARRY parts", () => {
      mockCreep.body = [{ type: CARRY as BodyPartConstant, hits: 100 }];
      expect(hasCarryParts(ctx)).toBe(true);
    });

    it("returns false when creep has no CARRY parts", () => {
      mockCreep.body = [{ type: WORK as BodyPartConstant, hits: 100 }];
      expect(hasCarryParts(ctx)).toBe(false);
    });
  });

  describe("hasMoveParts", () => {
    it("returns true when creep has MOVE parts", () => {
      mockCreep.body = [{ type: MOVE as BodyPartConstant, hits: 100 }];
      expect(hasMoveParts(ctx)).toBe(true);
    });

    it("returns false when creep has no MOVE parts", () => {
      mockCreep.body = [{ type: WORK as BodyPartConstant, hits: 100 }];
      expect(hasMoveParts(ctx)).toBe(false);
    });
  });

  describe("isDamaged", () => {
    it("returns true when creep is damaged", () => {
      mockCreep.hits = 50;
      mockCreep.hitsMax = 100;
      expect(isDamaged(ctx)).toBe(true);
    });

    it("returns false when creep is at full health", () => {
      mockCreep.hits = 100;
      mockCreep.hitsMax = 100;
      expect(isDamaged(ctx)).toBe(false);
    });
  });

  describe("isHealthBelow", () => {
    it("returns true when health is below percentage", () => {
      mockCreep.hits = 25;
      mockCreep.hitsMax = 100;
      const guard = isHealthBelow(30);
      expect(guard(ctx)).toBe(true);
    });

    it("returns false when health is at or above percentage", () => {
      mockCreep.hits = 50;
      mockCreep.hitsMax = 100;
      const guard = isHealthBelow(30);
      expect(guard(ctx)).toBe(false);
    });

    it("returns false when health is exactly at threshold", () => {
      mockCreep.hits = 30;
      mockCreep.hitsMax = 100;
      const guard = isHealthBelow(30);
      expect(guard(ctx)).toBe(false);
    });
  });

  describe("isSpawning", () => {
    it("returns true when creep is spawning", () => {
      mockCreep.spawning = true;
      expect(isSpawning(ctx)).toBe(true);
    });

    it("returns false when creep is not spawning", () => {
      mockCreep.spawning = false;
      expect(isSpawning(ctx)).toBe(false);
    });
  });

  describe("hasMinBodyParts", () => {
    it("returns true when creep has at least minimum parts", () => {
      mockCreep.body = [
        { type: WORK as BodyPartConstant, hits: 100 },
        { type: WORK as BodyPartConstant, hits: 100 },
        { type: WORK as BodyPartConstant, hits: 100 }
      ];
      const guard = hasMinBodyParts({ part: WORK as BodyPartConstant, count: 2 });
      expect(guard(ctx)).toBe(true);
    });

    it("returns false when creep has fewer than minimum parts", () => {
      mockCreep.body = [{ type: WORK as BodyPartConstant, hits: 100 }];
      const guard = hasMinBodyParts({ part: WORK as BodyPartConstant, count: 2 });
      expect(guard(ctx)).toBe(false);
    });

    it("returns true when creep has exactly minimum parts", () => {
      mockCreep.body = [
        { type: WORK as BodyPartConstant, hits: 100 },
        { type: WORK as BodyPartConstant, hits: 100 }
      ];
      const guard = hasMinBodyParts({ part: WORK as BodyPartConstant, count: 2 });
      expect(guard(ctx)).toBe(true);
    });
  });

  describe("hasActiveBodyPart", () => {
    it("returns true when creep has active (undamaged) body part", () => {
      mockCreep.body = [{ type: WORK as BodyPartConstant, hits: 100 }];
      const guard = hasActiveBodyPart(WORK as BodyPartConstant);
      expect(guard(ctx)).toBe(true);
    });

    it("returns false when body part has 0 hits", () => {
      mockCreep.body = [{ type: WORK as BodyPartConstant, hits: 0 }];
      const guard = hasActiveBodyPart(WORK as BodyPartConstant);
      expect(guard(ctx)).toBe(false);
    });

    it("returns false when body part does not exist", () => {
      mockCreep.body = [{ type: CARRY as BodyPartConstant, hits: 100 }];
      const guard = hasActiveBodyPart(WORK as BodyPartConstant);
      expect(guard(ctx)).toBe(false);
    });
  });

  describe("hasRole", () => {
    it("returns true when creep has a role", () => {
      mockCreep.memory = { role: "harvester" } as unknown as CreepMemory;
      expect(hasRole(ctx)).toBe(true);
    });

    it("returns false when creep has no role", () => {
      mockCreep.memory = {} as CreepMemory;
      expect(hasRole(ctx)).toBe(false);
    });

    it("returns false when memory is undefined", () => {
      mockCreep.memory = undefined as unknown as CreepMemory;
      expect(hasRole(ctx)).toBe(false);
    });
  });

  describe("hasRoleType", () => {
    it("returns true when creep has the specified role", () => {
      mockCreep.memory = { role: "harvester" } as unknown as CreepMemory;
      const guard = hasRoleType("harvester");
      expect(guard(ctx)).toBe(true);
    });

    it("returns false when creep has a different role", () => {
      mockCreep.memory = { role: "harvester" } as unknown as CreepMemory;
      const guard = hasRoleType("upgrader");
      expect(guard(ctx)).toBe(false);
    });

    it("returns false when creep has no role", () => {
      mockCreep.memory = {} as CreepMemory;
      const guard = hasRoleType("harvester");
      expect(guard(ctx)).toBe(false);
    });
  });
});
