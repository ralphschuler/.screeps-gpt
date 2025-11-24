import { describe, it, expect, beforeEach, vi } from "vitest";
import { BodyComposer } from "@runtime/behavior";

/**
 * Tests for source-aware body composition feature.
 * Validates that body generation adjusts to room's energy production capacity.
 *
 * Related Issue: ralphschuler/.screeps-gpt#XXX
 */
describe("BodyComposer - Source-Aware Body Composition", () => {
  let composer: BodyComposer;
  let mockRoom: Room;

  beforeEach(() => {
    composer = new BodyComposer();

    // Mock Screeps constants
    global.FIND_SOURCES = 104 as FindConstant;
    global.FIND_MY_CREEPS = 112 as FindConstant;
    global.WORK = "work" as BodyPartConstant;
    global.CARRY = "carry" as BodyPartConstant;
    global.MOVE = "move" as BodyPartConstant;
    global.BODYPART_COST = {
      work: 100,
      carry: 50,
      move: 50,
      attack: 80,
      ranged_attack: 150,
      heal: 250,
      claim: 600,
      tough: 10
    } as Record<BodyPartConstant, number>;

    // Mock Game global
    global.Game = {
      time: 1000,
      creeps: {}
    } as unknown as Game;
  });

  describe("single source scenarios", () => {
    beforeEach(() => {
      // Mock room with 1 source
      const mockSource = {
        id: "source1" as Id<Source>,
        pos: { x: 10, y: 10, roomName: "W1N1" }
      } as Source;

      mockRoom = {
        name: "W1N1",
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [mockSource];
          }
          if (type === FIND_MY_CREEPS) {
            // 1 harvester for full coverage
            return [
              {
                memory: { role: "harvester" },
                pos: { x: 11, y: 10 }
              }
            ];
          }
          return [];
        })
      } as unknown as Room;

      // Mock Game.creeps for room
      global.Game = {
        time: 1000,
        creeps: {
          "harvester-1": { room: mockRoom },
          "upgrader-1": { room: mockRoom },
          "builder-1": { room: mockRoom },
          "hauler-1": { room: mockRoom },
          "repairer-1": { room: mockRoom }
        }
      } as unknown as Game;
    });

    it("should limit body size with 1 source even with high energy capacity", () => {
      // RCL 4 has 1300 energy capacity, but 1 source can only sustain smaller creeps
      const body = composer.generateBody("harvester", 1300, mockRoom);
      const cost = composer.calculateBodyCost(body);

      // With 1 source: 10 energy/tick * 0.8 = 8 energy/tick sustainable
      // With 3 creeps: 8 / 3 ≈ 2.67 energy/tick per creep
      // Should be significantly less than 1300
      expect(cost).toBeLessThan(1300);
      expect(cost).toBeGreaterThan(0);
    });

    it("should generate minimal body when capacity exceeds production", () => {
      const bodyNormal = composer.generateBody("harvester", 1300);
      const bodySourceAware = composer.generateBody("harvester", 1300, mockRoom);

      const costNormal = composer.calculateBodyCost(bodyNormal);
      const costSourceAware = composer.calculateBodyCost(bodySourceAware);

      // Source-aware body should be smaller or equal (with 5+ creeps, limiting applies)
      expect(costSourceAware).toBeLessThanOrEqual(costNormal);
    });
  });

  describe("multiple source scenarios", () => {
    beforeEach(() => {
      // Mock room with 2 sources
      const mockSource1 = {
        id: "source1" as Id<Source>,
        pos: { x: 10, y: 10, roomName: "W1N1" }
      } as Source;

      const mockSource2 = {
        id: "source2" as Id<Source>,
        pos: { x: 40, y: 40, roomName: "W1N1" }
      } as Source;

      mockRoom = {
        name: "W1N1",
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [mockSource1, mockSource2];
          }
          if (type === FIND_MY_CREEPS) {
            // 2 harvesters for full coverage
            return [
              { memory: { role: "harvester" }, pos: { x: 11, y: 10 } },
              { memory: { role: "harvester" }, pos: { x: 41, y: 40 } }
            ];
          }
          return [];
        })
      } as unknown as Room;

      global.Game = {
        time: 1000,
        creeps: {
          "harvester-1": { room: mockRoom },
          "harvester-2": { room: mockRoom },
          "upgrader-1": { room: mockRoom }
        }
      } as unknown as Game;
    });

    it("should allow larger bodies with 2 sources", () => {
      const bodySingleSource = composer.generateBody("harvester", 1300, mockRoom);
      const costSingleSource = composer.calculateBodyCost(bodySingleSource);

      // With 2 sources, production is 20 energy/tick
      // Should allow at least minimal viable bodies
      expect(costSingleSource).toBeGreaterThanOrEqual(200);
      expect(costSingleSource).toBeLessThan(1300);
    });

    it("should scale body based on source count", () => {
      // Create a room with 1 source for comparison
      const mockRoom1Source = {
        name: "W1N1",
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1", pos: { x: 10, y: 10 } }];
          }
          if (type === FIND_MY_CREEPS) {
            return [{ memory: { role: "harvester" }, pos: { x: 11, y: 10 } }];
          }
          return [];
        })
      } as unknown as Room;

      const body1Source = composer.generateBody("harvester", 1300, mockRoom1Source);
      const body2Sources = composer.generateBody("harvester", 1300, mockRoom);

      const cost1Source = composer.calculateBodyCost(body1Source);
      const cost2Sources = composer.calculateBodyCost(body2Sources);

      // 2 sources should allow larger bodies
      expect(cost2Sources).toBeGreaterThanOrEqual(cost1Source);
    });
  });

  describe("no harvester scenarios", () => {
    beforeEach(() => {
      // Mock room with sources but no harvesters
      mockRoom = {
        name: "W1N1",
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [
              { id: "source1", pos: { x: 10, y: 10 } },
              { id: "source2", pos: { x: 40, y: 40 } }
            ];
          }
          if (type === FIND_MY_CREEPS) {
            // No harvesters
            return [];
          }
          return [];
        })
      } as unknown as Room;

      global.Game = {
        time: 1000,
        creeps: {}
      } as unknown as Game;
    });

    it("should limit body size when no harvesters present", () => {
      const body = composer.generateBody("harvester", 1300, mockRoom);
      const cost = composer.calculateBodyCost(body);

      // With no harvesters, production capacity is 0
      // Should generate minimal emergency body
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(1300);
    });

    it("should still generate viable body for bootstrapping", () => {
      const body = composer.generateBody("harvester", 300, mockRoom);

      // Should generate at least minimal body for bootstrapping
      expect(body.length).toBeGreaterThan(0);
      expect(body).toContain(WORK);
      expect(body).toContain(MOVE);
    });
  });

  describe("backward compatibility", () => {
    it("should work without room parameter (original behavior)", () => {
      const body = composer.generateBody("harvester", 550);
      expect(body.length).toBeGreaterThan(0);
      expect(composer.calculateBodyCost(body)).toBeLessThanOrEqual(550);
    });

    it("should generate same body without room context", () => {
      const bodyOriginal = composer.generateBody("harvester", 800);
      const costOriginal = composer.calculateBodyCost(bodyOriginal);

      // Without room, should use full capacity
      expect(costOriginal).toBeGreaterThan(500);
      expect(costOriginal).toBeLessThanOrEqual(800);
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      mockRoom = {
        name: "W1N1",
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1", pos: { x: 10, y: 10 } }];
          }
          if (type === FIND_MY_CREEPS) {
            return [{ memory: { role: "harvester" }, pos: { x: 11, y: 10 } }];
          }
          return [];
        })
      } as unknown as Room;

      global.Game = {
        time: 1000,
        creeps: {
          "harvester-1": { room: mockRoom }
        }
      } as unknown as Game;
    });

    it("should handle very low energy capacity (below 200 minimum)", () => {
      const body = composer.generateBody("harvester", 150, mockRoom);
      // 150 energy is below the 200 energy minimum for [WORK, CARRY, MOVE]
      expect(body.length).toBe(0);
    });

    it("should handle very high creep count", () => {
      // Mock many creeps in room
      const manyCreeps: Record<string, Creep> = {};
      for (let i = 0; i < 20; i++) {
        manyCreeps[`creep-${i}`] = { room: mockRoom } as Creep;
      }
      global.Game.creeps = manyCreeps;

      const body = composer.generateBody("harvester", 1300, mockRoom);
      const cost = composer.calculateBodyCost(body);

      // With many creeps, per-creep budget should be very small
      expect(cost).toBeLessThan(1300);
      expect(cost).toBeGreaterThan(0);
    });

    it("should never return negative or zero sustainable capacity", () => {
      // Even with 0 production, should return minimal viable body
      const mockEmptyRoom = {
        name: "W1N1",
        find: vi.fn(() => [])
      } as unknown as Room;

      global.Game.creeps = {};

      const body = composer.generateBody("harvester", 300, mockEmptyRoom);

      // Should still generate some body
      expect(body.length).toBeGreaterThan(0);
    });
  });

  describe("production capacity calculation", () => {
    it("should calculate correct theoretical production for multiple sources", () => {
      mockRoom = {
        name: "W1N1",
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [
              { id: "source1", pos: { x: 10, y: 10 } },
              { id: "source2", pos: { x: 40, y: 40 } },
              { id: "source3", pos: { x: 25, y: 25 } }
            ];
          }
          if (type === FIND_MY_CREEPS) {
            return [
              { memory: { role: "harvester" }, pos: { x: 11, y: 10 } },
              { memory: { role: "harvester" }, pos: { x: 41, y: 40 } },
              { memory: { role: "harvester" }, pos: { x: 26, y: 25 } }
            ];
          }
          return [];
        })
      } as unknown as Room;

      global.Game = {
        time: 1000,
        creeps: {
          "harvester-1": { room: mockRoom },
          "harvester-2": { room: mockRoom },
          "harvester-3": { room: mockRoom },
          "upgrader-1": { room: mockRoom },
          "upgrader-2": { room: mockRoom }
        }
      } as unknown as Game;

      const body = composer.generateBody("harvester", 2000, mockRoom);
      const cost = composer.calculateBodyCost(body);

      // 3 sources with full coverage = 30 energy/tick production
      // With 5 creeps, low consumption - excellent energy balance
      // New system allows full capacity when energy balance is excellent (ratio >= 1.5)
      expect(cost).toBeGreaterThanOrEqual(200);
      expect(cost).toBeLessThanOrEqual(2000);
    });
  });
});
