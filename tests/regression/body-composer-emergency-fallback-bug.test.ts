import { describe, it, expect, beforeEach, vi } from "vitest";
import { BodyComposer } from "@runtime/behavior/BodyComposer";

/**
 * Regression test for critical bug: Emergency body fallback uses adjusted capacity
 *
 * Bug Description:
 * When scaleBody() fails due to budget constraints, generateBody() falls back to
 * generateEmergencyBody(adjustedCapacity) instead of generateEmergencyBody(energyCapacity).
 * This causes [WORK, MOVE] to spawn when 200+ energy is available for [WORK, CARRY, MOVE].
 *
 * Root Cause:
 * 1. Emergency mode passes energyAvailable = 200 (sufficient for minimal harvester)
 * 2. calculateSustainableCapacity() reduces adjustedCapacity to ~150
 * 3. scaleBody() fails because base pattern needs 200 energy
 * 4. Falls back to generateEmergencyBody(adjustedCapacity=150)
 * 5. Returns [WORK, MOVE] instead of [WORK, CARRY, MOVE]
 *
 * Issue: ralphschuler/.screeps-gpt#1222 (Critical bot state - creeps spawned with only WORK+MOVE)
 * Fix: Pass original energyCapacity to generateEmergencyBody(), not adjustedCapacity
 */
describe("Regression: Emergency Body Fallback Bug", () => {
  let composer: BodyComposer;
  let mockRoom: Room;

  beforeEach(() => {
    // Mock Screeps constants
    global.WORK = "work" as BodyPartConstant;
    global.CARRY = "carry" as BodyPartConstant;
    global.MOVE = "move" as BodyPartConstant;
    global.BODYPART_COST = {
      [WORK]: 100,
      [CARRY]: 50,
      [MOVE]: 50
    } as Record<BodyPartConstant, number>;
    // FIND_SOURCES and RESOURCE_ENERGY used for sustainable capacity calculation
    global.FIND_SOURCES = 104 as FindConstant;
    global.RESOURCE_ENERGY = "energy" as ResourceConstant;

    composer = new BodyComposer();

    // Mock Game global for creep counting
    global.Game = {
      time: 1000,
      creeps: {} // Emergency scenario: 0 creeps
    } as unknown as Game;

    // Mock room with low energy but above 200
    mockRoom = {
      name: "E54N39",
      controller: {
        my: true,
        level: 4
      },
      energyAvailable: 220, // Above 200 - should spawn [WORK, CARRY, MOVE]
      energyCapacityAvailable: 1300,
      storage: null,
      // Mock find to return sources for sustainable capacity calculation
      find: vi.fn((type: FindConstant) => {
        if (type === FIND_SOURCES) {
          return [
            {
              id: "source1",
              energy: 3000,
              energyCapacity: 3000
            }
          ];
        }
        return [];
      })
    } as unknown as Room;
  });

  it("should spawn [WORK, CARRY, MOVE] when 200+ energy available", () => {
    // Emergency scenario: 0 creeps, 220 energy available
    // BUG: Sustainable capacity calculation reduced adjustedCapacity to ~150
    // Emergency fallback used adjustedCapacity instead of original energyCapacity
    // Result: Spawned [WORK, MOVE] instead of [WORK, CARRY, MOVE]

    const body = composer.generateBody("harvester", 220, mockRoom);

    // FIXED: Should now return [WORK, CARRY, MOVE] (200 energy)
    // Previously returned [WORK, MOVE] (150 energy) due to bug
    expect(body).toEqual([WORK, CARRY, MOVE]);

    const cost = composer.calculateBodyCost(body);
    expect(cost).toBe(200);
  });

  it("should spawn [WORK, CARRY, MOVE] even when sustainable capacity is low", () => {
    // Scenario: Room has 250 energy, but sustainable capacity calculation
    // determines only 150 energy is sustainable
    // Emergency fallback should still use actual 250 energy, not 150

    const body = composer.generateBody("harvester", 250, mockRoom);

    // Should return [WORK, CARRY, MOVE] because 250 >= 200
    expect(body).toEqual([WORK, CARRY, MOVE]);
    expect(composer.calculateBodyCost(body)).toBe(200);
  });

  it("should correctly spawn [WORK, MOVE] only when energy is below 200", () => {
    // When energy is genuinely low (150-199), [WORK, MOVE] is correct
    const body = composer.generateBody("harvester", 180, mockRoom);

    // With 180 energy, should spawn [WORK, MOVE] (150 energy)
    // Cannot afford [WORK, CARRY, MOVE] (200 energy)
    expect(body).toEqual([WORK, MOVE]);
    expect(composer.calculateBodyCost(body)).toBe(150);
  });

  it("should spawn optimal body when emergency mode passes higher energy", () => {
    // Emergency mode with 300 energy may still spawn emergency body
    // if sustainable capacity calculation limits it
    const body = composer.generateBody("harvester", 300, mockRoom);

    // Should at minimum spawn [WORK, CARRY, MOVE], not [WORK, MOVE]
    expect(body).toContain(WORK);
    expect(body).toContain(CARRY); // CRITICAL: Must have CARRY
    expect(body).toContain(MOVE);

    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeGreaterThanOrEqual(200);
    expect(cost).toBeLessThanOrEqual(300);
  });

  it("should work correctly for upgrader role", () => {
    // Upgrader pattern also has base of [WORK, CARRY, MOVE] = 200
    const body = composer.generateBody("upgrader", 220, mockRoom);

    expect(body).toEqual([WORK, CARRY, MOVE]);
    expect(composer.calculateBodyCost(body)).toBe(200);
  });

  it("should work correctly for builder role", () => {
    // Builder pattern has base of [WORK, CARRY, MOVE, MOVE] = 250
    // With 220 energy, should fall back to emergency [WORK, CARRY, MOVE] = 200
    const body = composer.generateBody("builder", 220, mockRoom);

    expect(body).toEqual([WORK, CARRY, MOVE]);
    expect(composer.calculateBodyCost(body)).toBe(200);
  });

  it("should handle exact 200 energy correctly", () => {
    // Edge case: exactly 200 energy available
    const body = composer.generateBody("harvester", 200, mockRoom);

    // Should spawn [WORK, CARRY, MOVE], not [WORK, MOVE]
    expect(body).toEqual([WORK, CARRY, MOVE]);
    expect(composer.calculateBodyCost(body)).toBe(200);
  });

  it("should handle 199 energy correctly (just below threshold)", () => {
    // Just below 200 energy - should spawn [WORK, MOVE]
    const body = composer.generateBody("harvester", 199, mockRoom);

    expect(body).toEqual([WORK, MOVE]);
    expect(composer.calculateBodyCost(body)).toBe(150);
  });

  it("should not regress to [WORK, MOVE] with abundant energy", () => {
    // High energy scenario - should never spawn [WORK, MOVE]
    // Create separate mock room to avoid test isolation issues
    const abundantEnergyRoom = {
      ...mockRoom,
      energyAvailable: 500
    } as Room;

    const body = composer.generateBody("harvester", 500, abundantEnergyRoom);

    // Should spawn scaled body, not minimal emergency body
    expect(body).not.toEqual([WORK, MOVE]);
    expect(body).toContain(CARRY); // Must have CARRY part

    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeGreaterThan(200);
  });

  it("should work without room context (fallback scenario)", () => {
    // When no room context provided, no budget constraints apply
    // Should still spawn correct emergency body
    const body = composer.generateBody("harvester", 220);

    // Without room context, should scale normally
    // Or fall back to emergency if pattern fails
    expect(body.length).toBeGreaterThan(0);

    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(220);
  });
});
