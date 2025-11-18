import { describe, expect, it } from "vitest";
import { and, or, not } from "../../src/helpers/guards.js";

describe("Guard helpers", () => {
  interface TestContext {
    value: number;
    flag: boolean;
  }

  interface TestEvent {
    type: string;
  }

  describe("and combinator", () => {
    it("should return true when all guards pass", () => {
      const guard1 = (ctx: TestContext) => ctx.value > 0;
      const guard2 = (ctx: TestContext) => ctx.flag === true;

      const combined = and(guard1, guard2);

      expect(combined({ value: 10, flag: true }, { type: "TEST" })).toBe(true);
    });

    it("should return false when any guard fails", () => {
      const guard1 = (ctx: TestContext) => ctx.value > 0;
      const guard2 = (ctx: TestContext) => ctx.flag === true;

      const combined = and(guard1, guard2);

      expect(combined({ value: 10, flag: false }, { type: "TEST" })).toBe(false);
      expect(combined({ value: -1, flag: true }, { type: "TEST" })).toBe(false);
    });

    it("should work with single guard", () => {
      const guard = (ctx: TestContext) => ctx.value > 5;
      const combined = and(guard);

      expect(combined({ value: 10, flag: false }, { type: "TEST" })).toBe(true);
      expect(combined({ value: 3, flag: false }, { type: "TEST" })).toBe(false);
    });

    it("should work with no guards (return true)", () => {
      const combined = and<TestContext, TestEvent>();

      expect(combined({ value: 10, flag: false }, { type: "TEST" })).toBe(true);
    });

    it("should work with three or more guards", () => {
      const guard1 = (ctx: TestContext) => ctx.value > 0;
      const guard2 = (ctx: TestContext) => ctx.value < 100;
      const guard3 = (ctx: TestContext) => ctx.flag === true;

      const combined = and(guard1, guard2, guard3);

      expect(combined({ value: 50, flag: true }, { type: "TEST" })).toBe(true);
      expect(combined({ value: 50, flag: false }, { type: "TEST" })).toBe(false);
      expect(combined({ value: -1, flag: true }, { type: "TEST" })).toBe(false);
      expect(combined({ value: 150, flag: true }, { type: "TEST" })).toBe(false);
    });
  });

  describe("or combinator", () => {
    it("should return true when any guard passes", () => {
      const guard1 = (ctx: TestContext) => ctx.value > 100;
      const guard2 = (ctx: TestContext) => ctx.flag === true;

      const combined = or(guard1, guard2);

      expect(combined({ value: 10, flag: true }, { type: "TEST" })).toBe(true);
      expect(combined({ value: 150, flag: false }, { type: "TEST" })).toBe(true);
    });

    it("should return false when all guards fail", () => {
      const guard1 = (ctx: TestContext) => ctx.value > 100;
      const guard2 = (ctx: TestContext) => ctx.flag === true;

      const combined = or(guard1, guard2);

      expect(combined({ value: 10, flag: false }, { type: "TEST" })).toBe(false);
    });

    it("should work with single guard", () => {
      const guard = (ctx: TestContext) => ctx.value > 5;
      const combined = or(guard);

      expect(combined({ value: 10, flag: false }, { type: "TEST" })).toBe(true);
      expect(combined({ value: 3, flag: false }, { type: "TEST" })).toBe(false);
    });

    it("should work with no guards (return false)", () => {
      const combined = or<TestContext, TestEvent>();

      expect(combined({ value: 10, flag: false }, { type: "TEST" })).toBe(false);
    });

    it("should work with three or more guards", () => {
      const guard1 = (ctx: TestContext) => ctx.value < 0;
      const guard2 = (ctx: TestContext) => ctx.value > 100;
      const guard3 = (ctx: TestContext) => ctx.flag === true;

      const combined = or(guard1, guard2, guard3);

      expect(combined({ value: 50, flag: true }, { type: "TEST" })).toBe(true);
      expect(combined({ value: 50, flag: false }, { type: "TEST" })).toBe(false);
      expect(combined({ value: -1, flag: false }, { type: "TEST" })).toBe(true);
      expect(combined({ value: 150, flag: false }, { type: "TEST" })).toBe(true);
    });
  });

  describe("not combinator", () => {
    it("should invert guard result", () => {
      const guard = (ctx: TestContext) => ctx.value > 5;
      const inverted = not(guard);

      expect(inverted({ value: 10, flag: false }, { type: "TEST" })).toBe(false);
      expect(inverted({ value: 3, flag: false }, { type: "TEST" })).toBe(true);
    });

    it("should work with complex guards", () => {
      const guard = (ctx: TestContext) => ctx.value > 0 && ctx.flag;
      const inverted = not(guard);

      expect(inverted({ value: 10, flag: true }, { type: "TEST" })).toBe(false);
      expect(inverted({ value: 10, flag: false }, { type: "TEST" })).toBe(true);
      expect(inverted({ value: -1, flag: true }, { type: "TEST" })).toBe(true);
    });
  });

  describe("Complex combinations", () => {
    it("should combine and + or", () => {
      const guard1 = (ctx: TestContext) => ctx.value > 0;
      const guard2 = (ctx: TestContext) => ctx.value < 100;
      const guard3 = (ctx: TestContext) => ctx.flag === true;

      // (value > 0 AND value < 100) OR flag === true
      const combined = or(and(guard1, guard2), guard3);

      expect(combined({ value: 50, flag: false }, { type: "TEST" })).toBe(true);
      expect(combined({ value: 150, flag: true }, { type: "TEST" })).toBe(true);
      expect(combined({ value: 150, flag: false }, { type: "TEST" })).toBe(false);
    });

    it("should combine and + not", () => {
      const guard1 = (ctx: TestContext) => ctx.value > 0;
      const guard2 = (ctx: TestContext) => ctx.flag === true;

      // value > 0 AND NOT flag
      const combined = and(guard1, not(guard2));

      expect(combined({ value: 10, flag: false }, { type: "TEST" })).toBe(true);
      expect(combined({ value: 10, flag: true }, { type: "TEST" })).toBe(false);
    });

    it("should combine or + not", () => {
      const guard1 = (ctx: TestContext) => ctx.value > 100;
      const guard2 = (ctx: TestContext) => ctx.flag === true;

      // value > 100 OR NOT flag
      const combined = or(guard1, not(guard2));

      expect(combined({ value: 10, flag: false }, { type: "TEST" })).toBe(true);
      expect(combined({ value: 150, flag: true }, { type: "TEST" })).toBe(true);
      expect(combined({ value: 10, flag: true }, { type: "TEST" })).toBe(false);
    });

    it("should handle nested combinations", () => {
      const guard1 = (ctx: TestContext) => ctx.value > 0;
      const guard2 = (ctx: TestContext) => ctx.value < 50;
      const guard3 = (ctx: TestContext) => ctx.value > 50;
      const guard4 = (ctx: TestContext) => ctx.value < 100;

      // (0 < value < 50) OR (50 < value < 100)
      const combined = or(and(guard1, guard2), and(guard3, guard4));

      expect(combined({ value: 25, flag: false }, { type: "TEST" })).toBe(true);
      expect(combined({ value: 75, flag: false }, { type: "TEST" })).toBe(true);
      expect(combined({ value: 50, flag: false }, { type: "TEST" })).toBe(false);
      expect(combined({ value: 150, flag: false }, { type: "TEST" })).toBe(false);
    });
  });

  describe("Real-world Screeps scenarios", () => {
    interface CreepContext {
      energy: number;
      capacity: number;
      health: number;
      maxHealth: number;
    }

    it("should check if creep needs energy", () => {
      const needsEnergy = (ctx: CreepContext) => ctx.energy < ctx.capacity * 0.5;
      const lowHealth = (ctx: CreepContext) => ctx.health < ctx.maxHealth * 0.3;

      // Needs energy AND not critically damaged
      const shouldHarvest = and(needsEnergy, not(lowHealth));

      expect(shouldHarvest({ energy: 10, capacity: 50, health: 80, maxHealth: 100 }, { type: "TEST" })).toBe(true);

      expect(shouldHarvest({ energy: 10, capacity: 50, health: 20, maxHealth: 100 }, { type: "TEST" })).toBe(false);
    });

    it("should check if creep is full or emergency", () => {
      const isFull = (ctx: CreepContext) => ctx.energy >= ctx.capacity;
      const isEmergency = (ctx: CreepContext) => ctx.health < ctx.maxHealth * 0.2;

      // Should deliver if full OR emergency
      const shouldDeliver = or(isFull, isEmergency);

      expect(shouldDeliver({ energy: 50, capacity: 50, health: 100, maxHealth: 100 }, { type: "TEST" })).toBe(true);

      expect(shouldDeliver({ energy: 30, capacity: 50, health: 10, maxHealth: 100 }, { type: "TEST" })).toBe(true);

      expect(shouldDeliver({ energy: 30, capacity: 50, health: 80, maxHealth: 100 }, { type: "TEST" })).toBe(false);
    });
  });
});
