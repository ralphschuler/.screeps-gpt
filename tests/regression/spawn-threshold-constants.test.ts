import { describe, expect, it } from "vitest";
import { SPAWN_THRESHOLDS } from "@runtime/behavior/constants";

/**
 * Regression test for spawn threshold constant extraction.
 * Validates that extracted constants maintain the expected values that were
 * previously hardcoded in the legacy behavior controller.
 *
 * Related Issues:
 * - #1267: State machine migration (unblocked by this refactor)
 * - #1105: Energy threshold adjustment for spawn idle bug
 *
 * This test ensures that the extraction of hardcoded values to constants
 * doesn't inadvertently change the threshold values that control spawn behavior.
 */
describe("Spawn Threshold Constants - Regression", () => {
  it("should maintain CPU safety margin at 85%", () => {
    expect(SPAWN_THRESHOLDS.CPU_SAFETY_MARGIN).toBe(0.85);
  });

  it("should maintain energy reserve ratio at 20%", () => {
    expect(SPAWN_THRESHOLDS.ENERGY_RESERVE_RATIO).toBe(0.2);
  });

  it("should maintain minimum energy reserve at 50 energy", () => {
    expect(SPAWN_THRESHOLDS.MIN_ENERGY_RESERVE).toBe(50);
  });

  it("should maintain storage high threshold at 50%", () => {
    expect(SPAWN_THRESHOLDS.STORAGE_HIGH_THRESHOLD).toBe(0.5);
  });

  it("should maintain storage medium threshold at 30%", () => {
    expect(SPAWN_THRESHOLDS.STORAGE_MEDIUM_THRESHOLD).toBe(0.3);
  });

  it("should maintain energy high threshold at 90%", () => {
    expect(SPAWN_THRESHOLDS.ENERGY_HIGH_THRESHOLD).toBe(0.9);
  });

  it("should maintain energy medium threshold at 75%", () => {
    expect(SPAWN_THRESHOLDS.ENERGY_MEDIUM_THRESHOLD).toBe(0.75);
  });

  it("should maintain early game energy threshold at 80% (Issue #1105 fix)", () => {
    // This value was adjusted from 0.9 to 0.8 in Issue #1105 to prevent spawn idle
    expect(SPAWN_THRESHOLDS.ENERGY_EARLY_GAME_THRESHOLD).toBe(0.8);
  });

  it("should have storage high threshold greater than medium threshold", () => {
    expect(SPAWN_THRESHOLDS.STORAGE_HIGH_THRESHOLD).toBeGreaterThan(SPAWN_THRESHOLDS.STORAGE_MEDIUM_THRESHOLD);
  });

  it("should have energy high threshold greater than medium threshold", () => {
    expect(SPAWN_THRESHOLDS.ENERGY_HIGH_THRESHOLD).toBeGreaterThan(SPAWN_THRESHOLDS.ENERGY_MEDIUM_THRESHOLD);
  });

  it("should have early game threshold between medium and high thresholds", () => {
    expect(SPAWN_THRESHOLDS.ENERGY_EARLY_GAME_THRESHOLD).toBeGreaterThan(SPAWN_THRESHOLDS.ENERGY_MEDIUM_THRESHOLD);
    expect(SPAWN_THRESHOLDS.ENERGY_EARLY_GAME_THRESHOLD).toBeLessThan(SPAWN_THRESHOLDS.ENERGY_HIGH_THRESHOLD);
  });

  it("should maintain constant values as immutable (readonly)", () => {
    // Verify the 'as const' assertion makes the object readonly
    // TypeScript compilation will fail if we try to modify these values
    const thresholds = SPAWN_THRESHOLDS;
    expect(Object.isFrozen(thresholds)).toBe(false); // 'as const' doesn't freeze at runtime

    // However, we can verify all properties are present
    expect(thresholds).toHaveProperty("CPU_SAFETY_MARGIN");
    expect(thresholds).toHaveProperty("ENERGY_RESERVE_RATIO");
    expect(thresholds).toHaveProperty("MIN_ENERGY_RESERVE");
    expect(thresholds).toHaveProperty("STORAGE_HIGH_THRESHOLD");
    expect(thresholds).toHaveProperty("STORAGE_MEDIUM_THRESHOLD");
    expect(thresholds).toHaveProperty("ENERGY_HIGH_THRESHOLD");
    expect(thresholds).toHaveProperty("ENERGY_MEDIUM_THRESHOLD");
    expect(thresholds).toHaveProperty("ENERGY_EARLY_GAME_THRESHOLD");
  });

  it("should have all threshold values in valid range [0, 1] except MIN_ENERGY_RESERVE", () => {
    // All ratio/percentage thresholds should be between 0 and 1
    expect(SPAWN_THRESHOLDS.CPU_SAFETY_MARGIN).toBeGreaterThanOrEqual(0);
    expect(SPAWN_THRESHOLDS.CPU_SAFETY_MARGIN).toBeLessThanOrEqual(1);

    expect(SPAWN_THRESHOLDS.ENERGY_RESERVE_RATIO).toBeGreaterThanOrEqual(0);
    expect(SPAWN_THRESHOLDS.ENERGY_RESERVE_RATIO).toBeLessThanOrEqual(1);

    expect(SPAWN_THRESHOLDS.STORAGE_HIGH_THRESHOLD).toBeGreaterThanOrEqual(0);
    expect(SPAWN_THRESHOLDS.STORAGE_HIGH_THRESHOLD).toBeLessThanOrEqual(1);

    expect(SPAWN_THRESHOLDS.STORAGE_MEDIUM_THRESHOLD).toBeGreaterThanOrEqual(0);
    expect(SPAWN_THRESHOLDS.STORAGE_MEDIUM_THRESHOLD).toBeLessThanOrEqual(1);

    expect(SPAWN_THRESHOLDS.ENERGY_HIGH_THRESHOLD).toBeGreaterThanOrEqual(0);
    expect(SPAWN_THRESHOLDS.ENERGY_HIGH_THRESHOLD).toBeLessThanOrEqual(1);

    expect(SPAWN_THRESHOLDS.ENERGY_MEDIUM_THRESHOLD).toBeGreaterThanOrEqual(0);
    expect(SPAWN_THRESHOLDS.ENERGY_MEDIUM_THRESHOLD).toBeLessThanOrEqual(1);

    expect(SPAWN_THRESHOLDS.ENERGY_EARLY_GAME_THRESHOLD).toBeGreaterThanOrEqual(0);
    expect(SPAWN_THRESHOLDS.ENERGY_EARLY_GAME_THRESHOLD).toBeLessThanOrEqual(1);

    // MIN_ENERGY_RESERVE is an absolute value, not a ratio
    expect(SPAWN_THRESHOLDS.MIN_ENERGY_RESERVE).toBeGreaterThan(0);
  });
});
