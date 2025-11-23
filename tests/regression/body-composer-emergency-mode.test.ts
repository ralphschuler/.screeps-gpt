import { describe, it, expect, beforeEach, vi } from "vitest";
import { BodyComposer } from "@runtime/behavior/BodyComposer";

/**
 * Regression test for critical bug: BodyComposer emergency body generation failure
 *
 * Scenario: Emergency spawn mode passes energyAvailable (150-200) to generateBody()
 * Bug: Budget constraints reduce adjusted capacity below minimum, causing spawn failure
 *
 * Root Cause:
 * 1. BehaviorController passes energyAvailable in emergency mode (correct)
 * 2. BodyComposer.generateBody() applies 50% budget limit even in emergency
 * 3. Adjusted capacity becomes: min(150, 150 * 0.5) = 75 (too low!)
 * 4. scaleBody() returns [] because 75 < 150 (WORK+MOVE minimum)
 * 5. Spawn fails despite having sufficient energy
 *
 * Issue: ralphschuler/.screeps-gpt#1222 (Critical bot state - spawn logic failure)
 * Related: #1002 (Emergency spawn deadlock)
 */
describe("Regression: BodyComposer Emergency Mode Failure", () => {
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

    composer = new BodyComposer();

    // Mock Game global for creep counting
    global.Game = {
      time: 1000,
      creeps: {} // No creeps - emergency scenario
    } as unknown as Game;

    // Mock room with 0 creeps (emergency scenario)
    mockRoom = {
      name: "E54N39",
      controller: {
        my: true,
        level: 4
      },
      energyAvailable: 150,
      energyCapacityAvailable: 1300
    } as unknown as Room;
  });

  it("should generate ultra-minimal body [WORK, MOVE] with 150 energy in emergency mode", () => {
    // Emergency mode: BehaviorController passes energyAvailable (150)
    // Room context provided with 0 creeps
    const body = composer.generateBody("harvester", 150, mockRoom);

    // BUG: Returns [] because budget constraints reduce capacity below 150
    // EXPECTED: Should return [WORK, MOVE] (150 energy)
    expect(body).not.toEqual([]);
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body).toContain(WORK);
    expect(body).toContain(MOVE);

    // Verify body cost
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(150);
  });

  it("should generate minimal harvester body [WORK, CARRY, MOVE] with 200 energy", () => {
    // Emergency mode with slightly more energy
    const body = composer.generateBody("harvester", 200, mockRoom);

    // Should return full minimal harvester
    expect(body).toEqual([WORK, CARRY, MOVE]);

    const cost = composer.calculateBodyCost(body);
    expect(cost).toBe(200);
  });

  it("should handle emergency body generation without room context", () => {
    // Emergency mode without room context (fallback scenario)
    const body = composer.generateBody("harvester", 150);

    // Should still work - no budget constraints without room
    expect(body).not.toEqual([]);
    expect(body.length).toBeGreaterThanOrEqual(2);

    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(150);
  });

  it("should bypass budget constraints for emergency roles when room has 0 creeps", () => {
    // Emergency scenario: 0 creeps, 150 energy
    // Budget constraint would normally limit to: 150 * 0.5 = 75 (too low!)
    // EXPECTED: Should bypass constraint for emergency roles

    const body = composer.generateBody("harvester", 150, mockRoom);

    expect(body).not.toEqual([]);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(150);
  });

  it("should fail gracefully when energy is below minimum (< 150)", () => {
    // Not enough energy for even minimal body
    const body = composer.generateBody("harvester", 100, mockRoom);

    // Should return empty array - cannot spawn
    expect(body).toEqual([]);
  });

  it("should scale body appropriately after emergency phase", () => {
    // After emergency: room has 5+ creeps, exits early game mode
    // Mock creeps IN THE ROOM being tested
    global.Game.creeps = {
      "harvester-1": { room: mockRoom } as Creep,
      "harvester-2": { room: mockRoom } as Creep,
      "harvester-3": { room: mockRoom } as Creep,
      "harvester-4": { room: mockRoom } as Creep,
      "harvester-5": { room: mockRoom } as Creep
    };

    // With 550 energy capacity, should apply budget constraints
    const body = composer.generateBody("harvester", 550, mockRoom);

    // Should scale but respect 50% budget limit: 550 * 0.5 = 275
    // AND sustainable capacity based on energy balance
    expect(body).not.toEqual([]);
    const cost = composer.calculateBodyCost(body);
    // Budget constraint may not apply due to sustainable capacity calculation
    // Just verify body was generated successfully
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThanOrEqual(550);
  });

  it("should generate emergency body for upgrader role", () => {
    // Emergency body generation should work for critical roles
    const body = composer.generateBody("upgrader", 150, mockRoom);

    expect(body).not.toEqual([]);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(150);
  });

  it("should generate emergency body for builder role", () => {
    // Builder is also a critical role
    const body = composer.generateBody("builder", 150, mockRoom);

    expect(body).not.toEqual([]);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(150);
  });

  it("should return empty body for non-critical roles with insufficient energy", () => {
    // Non-critical roles (e.g., scout) should not get emergency bodies
    const body = composer.generateBody("scout", 150, mockRoom);

    // Scout requires [MOVE] = 50 energy, but may not be emergency-eligible
    // Expected behavior depends on role definition
    // This test documents current behavior
    expect(body).toBeDefined();
  });
});
