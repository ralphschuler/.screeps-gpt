import { describe, it, expect, beforeEach } from "vitest";
import { createRollingAverage, addToRollingAverage, getRollingAverageValue, createEmptyEconomyMetrics, createEmptyThreatMetrics, calculateThreatLevel } from "../src/metrics/types";

describe("Metrics Types", () => {
  describe("RollingAverage", () => {
    it("should create empty rolling average", () => {
      const avg = createRollingAverage(5);
      expect(avg.values).toEqual([]);
      expect(avg.maxSamples).toBe(5);
      expect(avg.sum).toBe(0);
    });

    it("should add values and calculate average", () => {
      const avg = createRollingAverage(5);
      addToRollingAverage(avg, 10);
      addToRollingAverage(avg, 20);
      expect(getRollingAverageValue(avg)).toBe(15);
    });

    it("should maintain rolling window", () => {
      const avg = createRollingAverage(3);
      addToRollingAverage(avg, 10);
      addToRollingAverage(avg, 20);
      addToRollingAverage(avg, 30);
      addToRollingAverage(avg, 40);
      // Should only have [20, 30, 40]
      expect(avg.values.length).toBe(3);
      expect(getRollingAverageValue(avg)).toBe(30);
    });

    it("should return 0 for empty average", () => {
      const avg = createRollingAverage(5);
      expect(getRollingAverageValue(avg)).toBe(0);
    });
  });

  describe("createEmptyEconomyMetrics", () => {
    it("should create metrics with all zeros", () => {
      const metrics = createEmptyEconomyMetrics();
      expect(metrics.avgEnergyHarvested).toBe(0);
      expect(metrics.energySpentSpawning).toBe(0);
      expect(metrics.energySpentConstruction).toBe(0);
      expect(metrics.energySpentRepair).toBe(0);
      expect(metrics.energySpentTower).toBe(0);
      expect(metrics.controllerProgress).toBe(0);
      expect(metrics.idleWorkerTime).toBe(0);
    });
  });

  describe("createEmptyThreatMetrics", () => {
    it("should create metrics with safe defaults", () => {
      const metrics = createEmptyThreatMetrics();
      expect(metrics.hostileCreepCount).toBe(0);
      expect(metrics.enemyStructuresPresent).toBe(false);
      expect(metrics.damagePerTick).toBe(0);
      expect(metrics.combatAlerts).toBe(0);
    });
  });

  describe("calculateThreatLevel", () => {
    it("should return 0 for no threat", () => {
      const metrics = createEmptyThreatMetrics();
      expect(calculateThreatLevel(metrics)).toBe(0);
    });

    it("should return 1 for medium threat", () => {
      const metrics = {
        ...createEmptyThreatMetrics(),
        hostileCreepCount: 3
      };
      expect(calculateThreatLevel(metrics)).toBe(1);
    });

    it("should return 1 for enemy structures", () => {
      const metrics = {
        ...createEmptyThreatMetrics(),
        enemyStructuresPresent: true
      };
      expect(calculateThreatLevel(metrics)).toBe(1);
    });

    it("should return 2 for high threat", () => {
      const metrics = {
        ...createEmptyThreatMetrics(),
        hostileCreepCount: 5
      };
      expect(calculateThreatLevel(metrics)).toBe(2);
    });

    it("should return 2 for high damage", () => {
      const metrics = {
        ...createEmptyThreatMetrics(),
        damagePerTick: 1000
      };
      expect(calculateThreatLevel(metrics)).toBe(2);
    });

    it("should return 3 for critical threat", () => {
      const metrics = {
        ...createEmptyThreatMetrics(),
        hostileCreepCount: 10
      };
      expect(calculateThreatLevel(metrics)).toBe(3);
    });

    it("should return 3 for critical damage", () => {
      const metrics = {
        ...createEmptyThreatMetrics(),
        damagePerTick: 2000
      };
      expect(calculateThreatLevel(metrics)).toBe(3);
    });
  });
});
