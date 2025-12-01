/**
 * Metrics and Rolling Average Tests
 */
import { describe, it, expect } from "vitest";
import { RollingAverage } from "../src/logic/pheromone";
import { calculateDangerLevel } from "../src/logic/evolution";

describe("Metrics Types", () => {
  describe("RollingAverage", () => {
    it("should start with empty average", () => {
      const avg = new RollingAverage(5);
      expect(avg.get()).toBe(0);
    });

    it("should add values and calculate average", () => {
      const avg = new RollingAverage(5);
      avg.add(10);
      avg.add(20);
      expect(avg.get()).toBe(15);
    });

    it("should maintain rolling window", () => {
      const avg = new RollingAverage(3);
      avg.add(10);
      avg.add(20);
      avg.add(30);
      avg.add(40);
      // Should only have [20, 30, 40]
      expect(avg.get()).toBe(30);
    });

    it("should return 0 for empty average", () => {
      const avg = new RollingAverage(5);
      expect(avg.get()).toBe(0);
    });

    it("should reset properly", () => {
      const avg = new RollingAverage(5);
      avg.add(50);
      avg.add(100);
      expect(avg.get()).toBe(75);
      avg.reset();
      expect(avg.get()).toBe(0);
    });
  });

  describe("calculateDangerLevel", () => {
    it("should return 0 for no threat", () => {
      expect(calculateDangerLevel(0, 0, false)).toBe(0);
    });

    it("should return 1 for medium threat", () => {
      expect(calculateDangerLevel(3, 0, false)).toBe(1);
    });

    it("should return 1 for enemy structures", () => {
      expect(calculateDangerLevel(0, 0, true)).toBe(1);
    });

    it("should return 2 for high threat", () => {
      expect(calculateDangerLevel(5, 0, false)).toBe(2);
    });

    it("should return 2 for high damage", () => {
      expect(calculateDangerLevel(0, 1000, false)).toBe(2);
    });

    it("should return 3 for critical threat", () => {
      expect(calculateDangerLevel(10, 0, false)).toBe(3);
    });

    it("should return 3 for critical damage", () => {
      expect(calculateDangerLevel(0, 2000, false)).toBe(3);
    });
  });
});
