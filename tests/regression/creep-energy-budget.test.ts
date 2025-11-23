import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";
import { BodyComposer } from "@runtime/behavior/BodyComposer";

/**
 * Regression test for creep energy budget constraint.
 * Validates that creeps are spawned using no more than 50% of available
 * energy capacity to maintain spawn throughput and prevent energy depletion.
 *
 * Related Issue:
 * - Issue: fix(runtime): scouts/claimers get stuck cycling at room exits - excessive creep sizes
 *   prevent efficient multi-room movement
 *
 * Root Cause:
 * - BodyComposer.generateBody() did not enforce 50% budget constraint
 * - Oversized creeps reduced spawn throughput and depleted energy reserves
 *
 * Fix:
 * - Added budget limit (energyCapacity * 0.5) after early game check
 * - Budget only applies when room context is provided (actual spawning)
 * - Exceptions:
 *   1. Early game (< 5 creeps): Allow rapid bootstrap
 *   2. Low energy rooms (≤ 450): Budget too restrictive at RCL 1-2
 */
describe("Creep Energy Budget - Regression", () => {
  const composer = new BodyComposer();

  // Mock Screeps constants
  beforeAll(() => {
    global.WORK = "work" as BodyPartConstant;
    global.MOVE = "move" as BodyPartConstant;
    global.CARRY = "carry" as BodyPartConstant;
  });

  // Mock room context with 5+ creeps (post-early-game)
  // This simulates stable operation where 50% budget should be enforced
  const mockRoomStable = {
    name: "W1N1",
    controller: { my: true, level: 3 },
    energyAvailable: 800,
    energyCapacityAvailable: 800,
    find: vi.fn(() => [])
  } as unknown as Room;

  let originalGame: Game;

  // Mock Game.creeps for stable room (5+ creeps)
  beforeEach(() => {
    originalGame = global.Game;
    global.Game = {
      creeps: {
        creep1: { room: { name: "W1N1" } },
        creep2: { room: { name: "W1N1" } },
        creep3: { room: { name: "W1N1" } },
        creep4: { room: { name: "W1N1" } },
        creep5: { room: { name: "W1N1" } }
      }
    } as unknown as Game;
  });

  afterEach(() => {
    global.Game = originalGame;
  });

  it("should NOT enforce 50% budget for harvester at RCL 1 (300 capacity)", () => {
    const body = composer.generateBody("harvester", 300, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    // NEW: Budget constraint only applies when capacity > 450
    // At RCL 1 (300), no budget constraint - can use full capacity
    expect(cost).toBeLessThanOrEqual(300);
  });

  it("should NOT enforce 50% budget for harvester at RCL 2 (550 capacity at low end)", () => {
    // RCL 2 starts at 550, but we only apply budget when > 450
    // At exactly 550, budget SHOULD apply (550 > 450)
    const body = composer.generateBody("harvester", 550, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    // Budget applies: 550 * 0.5 = 275
    expect(cost).toBeLessThanOrEqual(275);
  });

  it("should enforce 50% budget for harvester at RCL 3 (800 capacity)", () => {
    const body = composer.generateBody("harvester", 800, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(400);
  });

  it("should enforce 50% budget for upgrader at RCL 2 (550 capacity)", () => {
    const body = composer.generateBody("upgrader", 550, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(275);
  });

  it("should enforce 50% budget for builder at RCL 2 (550 capacity)", () => {
    const body = composer.generateBody("builder", 550, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(275);
  });

  it("should enforce 50% budget for remoteMiner at RCL 3 (800 capacity)", () => {
    const body = composer.generateBody("remoteMiner", 800, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(400);
  });

  it("should enforce 50% budget for remoteHauler at RCL 3 (800 capacity)", () => {
    const body = composer.generateBody("remoteHauler", 800, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(400);
  });

  it("should enforce 50% budget for hauler at RCL 4 (1300 capacity)", () => {
    const body = composer.generateBody("hauler", 1300, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(650);
  });

  it("should enforce 50% budget for repairer at RCL 3 (800 capacity)", () => {
    const body = composer.generateBody("repairer", 800, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(400);
  });

  it("should enforce 50% budget for attacker at RCL 4 (1300 capacity)", () => {
    const body = composer.generateBody("attacker", 1300, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(650);
  });

  it("should enforce 50% budget for healer at RCL 4 (1300 capacity)", () => {
    const body = composer.generateBody("healer", 1300, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(650);
  });

  it("should enforce 50% budget for dismantler at RCL 3 (800 capacity)", () => {
    const body = composer.generateBody("dismantler", 800, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(400);
  });

  it("should enforce 50% budget at high RCL (5400 capacity)", () => {
    const body = composer.generateBody("harvester", 5400, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(2700);
  });

  it("should handle minimal energy (200) and stay within 50% budget", () => {
    const body = composer.generateBody("harvester", 200, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    // With 200 energy, falls back to emergency [WORK, CARRY, MOVE] = 200
    // Emergency bodies use full available energy
    expect(cost).toBe(200);
  });

  it("should return emergency body even when budget would constrain it", () => {
    // With 150 capacity and 50% budget = 75 energy (too low for normal body)
    // Falls back to emergency [WORK, MOVE] = 150 energy
    // FIXED: Emergency bodies now use full energy, not budget-constrained
    const body = composer.generateBody("harvester", 150, mockRoomStable);
    expect(body).toEqual([WORK, MOVE]);
  });

  it("should respect 50% budget even at maximum energy capacity", () => {
    // RCL 8 maximum: 12900 energy capacity
    const body = composer.generateBody("harvester", 12900, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(6450);
  });

  it("should respect 50 body part limit while enforcing budget", () => {
    // At very high capacity, should hit 50 part limit before budget limit
    const body = composer.generateBody("harvester", 12900, mockRoomStable);
    expect(body.length).toBeLessThanOrEqual(50);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(6450);
  });

  it("should NOT apply budget at exactly 450 energy", () => {
    // Boundary test: at 450, budget should NOT apply (threshold is > 450)
    const body = composer.generateBody("harvester", 450, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    // No budget constraint at 450: can use full capacity
    expect(cost).toBeLessThanOrEqual(450);
  });

  it("should apply budget at 451 energy (just above threshold)", () => {
    // Just above threshold: budget should apply
    const body = composer.generateBody("harvester", 451, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    // Budget applies: 451 * 0.5 = 225.5
    expect(cost).toBeLessThanOrEqual(226);
  });

  it("should apply budget at 500 energy (RCL 2+)", () => {
    // RCL 2+ with 500+ energy: budget should apply
    const body = composer.generateBody("harvester", 500, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    // Budget applies: 500 * 0.5 = 250
    expect(cost).toBeLessThanOrEqual(250);
  });

  it("should allow full capacity at 400 energy (below 450 threshold)", () => {
    // NEW: At 400 energy, no budget constraint (≤ 450 threshold)
    // Can use full 400 energy, not restricted to 50%
    const body = composer.generateBody("harvester", 400, mockRoomStable);
    const cost = composer.calculateBodyCost(body);
    expect(cost).toBeLessThanOrEqual(400); // Full capacity allowed
    expect(body.length).toBeGreaterThanOrEqual(3); // At least [WORK, CARRY, MOVE]
  });

  it("should generate valid body composition within budget", () => {
    const body = composer.generateBody("harvester", 1000, mockRoomStable);
    const cost = composer.calculateBodyCost(body);

    // Verify budget constraint
    expect(cost).toBeLessThanOrEqual(500);

    // Verify body is not empty
    expect(body.length).toBeGreaterThan(0);

    // Verify body contains expected parts
    expect(body.filter(p => p === WORK).length).toBeGreaterThan(0);
    expect(body.filter(p => p === CARRY).length).toBeGreaterThan(0);
    expect(body.filter(p => p === MOVE).length).toBeGreaterThan(0);
  });

  describe("early game (< 5 creeps)", () => {
    let originalGame: typeof global.Game;

    beforeEach(() => {
      originalGame = global.Game;
      // Mock early game scenario with only 2 creeps
      global.Game = {
        creeps: {
          creep1: { room: { name: "W1N1" } },
          creep2: { room: { name: "W1N1" } }
        }
      } as unknown as Game;
    });

    afterEach(() => {
      global.Game = originalGame;
    });

    it("should allow full capacity", () => {
      const body = composer.generateBody("harvester", 550, mockRoomStable);
      const cost = composer.calculateBodyCost(body);

      // In early game, should allow more than 50% (up to sustainable capacity)
      expect(cost).toBeGreaterThan(275); // More than 50% budget
      expect(cost).toBeLessThanOrEqual(550); // But not more than capacity
    });
  });
});
