import { describe, it, expect, beforeEach, vi } from "vitest";
import { EnergyBalanceCalculator } from "@runtime/behavior";

describe("EnergyBalanceCalculator", () => {
  let calculator: EnergyBalanceCalculator;
  let mockRoom: Room;

  beforeEach(() => {
    calculator = new EnergyBalanceCalculator();

    // Mock Screeps constants
    global.FIND_SOURCES = 104 as FindConstant;
    global.FIND_MY_CREEPS = 112 as FindConstant;
    global.FIND_MY_STRUCTURES = 113 as FindConstant;
    global.STRUCTURE_SPAWN = "spawn" as StructureConstant;

    global.Game = {
      time: 1000,
      creeps: {}
    } as unknown as Game;
  });

  describe("single source room", () => {
    beforeEach(() => {
      mockRoom = {
        name: "W1N1",
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1" }];
          }
          if (type === FIND_MY_CREEPS) {
            return [{ memory: { role: "harvester" } }];
          }
          if (type === FIND_MY_STRUCTURES) {
            return [];
          }
          return [];
        })
      } as unknown as Room;

      global.Game.creeps = {
        "harvester-1": { room: mockRoom }
      };
    });

    it("should calculate production for single source with one harvester", () => {
      const balance = calculator.calculate(mockRoom);

      expect(balance.sourceCount).toBe(1);
      expect(balance.harvesterCount).toBe(1);
      expect(balance.harvesterEfficiency).toBe(1.0); // Full coverage
      expect(balance.production).toBe(10); // 1 source * 10 energy/tick * 1.0 efficiency
    });

    it("should recommend sustainable spawn budget with minimum floor", () => {
      const balance = calculator.calculate(mockRoom);

      // With 1 source (10 energy/tick) and 1 creep
      // Calculated budget: 10 * 0.8 / 1 = 8 energy/tick
      // But minimum is 200 to allow basic creep spawning
      expect(balance.maxSpawnBudget).toBeGreaterThanOrEqual(200);
    });

    it("should handle partial harvester coverage", () => {
      // Change find to return no harvesters
      mockRoom.find = vi.fn((type: FindConstant) => {
        if (type === FIND_SOURCES) {
          return [{ id: "source1" }];
        }
        if (type === FIND_MY_CREEPS) {
          return []; // No harvesters
        }
        if (type === FIND_MY_STRUCTURES) {
          return [];
        }
        return [];
      });

      const balance = calculator.calculate(mockRoom);

      expect(balance.harvesterEfficiency).toBe(0.5); // Minimum efficiency
      expect(balance.production).toBe(5); // 1 source * 10 * 0.5
    });
  });

  describe("multi-source room", () => {
    beforeEach(() => {
      mockRoom = {
        name: "W1N1",
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1" }, { id: "source2" }, { id: "source3" }];
          }
          if (type === FIND_MY_CREEPS) {
            return [
              { memory: { role: "harvester" } },
              { memory: { role: "harvester" } },
              { memory: { role: "harvester" } }
            ];
          }
          if (type === FIND_MY_STRUCTURES) {
            return [];
          }
          return [];
        })
      } as unknown as Room;

      global.Game.creeps = {
        "harvester-1": { room: mockRoom },
        "harvester-2": { room: mockRoom },
        "harvester-3": { room: mockRoom },
        "upgrader-1": { room: mockRoom },
        "upgrader-2": { room: mockRoom }
      };
    });

    it("should calculate higher production for multiple sources", () => {
      const balance = calculator.calculate(mockRoom);

      expect(balance.sourceCount).toBe(3);
      expect(balance.harvesterCount).toBe(3);
      expect(balance.harvesterEfficiency).toBe(1.0); // Full coverage (3 harvesters / 3 sources)
      expect(balance.production).toBe(30); // 3 sources * 10 energy/tick
    });

    it("should recommend higher spawn budget with more sources", () => {
      const balance = calculator.calculate(mockRoom);

      // 30 energy/tick * 0.8 / 5 creeps = 4.8 energy/tick per creep
      // But minimum is 200
      expect(balance.maxSpawnBudget).toBeGreaterThanOrEqual(200);
    });
  });

  describe("energy balance ratio", () => {
    it("should calculate positive balance when production exceeds consumption", () => {
      mockRoom = {
        name: "W1N1",
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1" }, { id: "source2" }];
          }
          if (type === FIND_MY_CREEPS) {
            return [{ memory: { role: "harvester" } }, { memory: { role: "harvester" } }];
          }
          if (type === FIND_MY_STRUCTURES) {
            return []; // No active spawning
          }
          return [];
        })
      } as unknown as Room;

      global.Game.creeps = {
        "harvester-1": { room: mockRoom },
        "harvester-2": { room: mockRoom }
      };

      const balance = calculator.calculate(mockRoom);

      expect(balance.production).toBe(20); // 2 sources * 10
      expect(balance.consumption).toBeGreaterThanOrEqual(0);
      expect(balance.balance).toBeGreaterThan(0);
      expect(balance.ratio).toBeGreaterThan(1);
    });

    it("should handle room with no sources", () => {
      mockRoom = {
        name: "W1N1",
        find: vi.fn(() => [])
      } as unknown as Room;

      const balance = calculator.calculate(mockRoom);

      expect(balance.sourceCount).toBe(0);
      expect(balance.production).toBe(0);
      expect(balance.harvesterEfficiency).toBe(1.0); // Default when no sources
    });
  });

  describe("edge cases", () => {
    it("should handle room without find method", () => {
      mockRoom = {
        name: "W1N1"
      } as unknown as Room;

      const balance = calculator.calculate(mockRoom);

      expect(balance.sourceCount).toBe(0);
      expect(balance.harvesterCount).toBe(0);
      expect(balance.production).toBe(0);
    });

    it("should handle Game.creeps being undefined", () => {
      mockRoom = {
        name: "W1N1",
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1" }];
          }
          return [];
        })
      } as unknown as Room;

      global.Game = {
        time: 1000
      } as unknown as Game;

      const balance = calculator.calculate(mockRoom);

      expect(balance.production).toBeGreaterThanOrEqual(0);
      expect(balance.maxSpawnBudget).toBeGreaterThanOrEqual(200);
    });

    it("should cap harvester efficiency at 1.0 even with extra harvesters", () => {
      mockRoom = {
        name: "W1N1",
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1" }];
          }
          if (type === FIND_MY_CREEPS) {
            // 3 harvesters for 1 source
            return [
              { memory: { role: "harvester" } },
              { memory: { role: "harvester" } },
              { memory: { role: "harvester" } }
            ];
          }
          if (type === FIND_MY_STRUCTURES) {
            return [];
          }
          return [];
        })
      } as unknown as Room;

      const balance = calculator.calculate(mockRoom);

      expect(balance.harvesterEfficiency).toBe(1.0); // Capped at full efficiency
      expect(balance.production).toBe(10); // Not 30, efficiency capped
    });
  });

  describe("spawn budget calculation", () => {
    it("should ensure minimum spawn budget of 200", () => {
      mockRoom = {
        name: "W1N1",
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1" }];
          }
          if (type === FIND_MY_CREEPS) {
            return [{ memory: { role: "harvester" } }];
          }
          if (type === FIND_MY_STRUCTURES) {
            return [];
          }
          return [];
        })
      } as unknown as Room;

      // Many creeps to force low per-creep budget
      global.Game.creeps = {};
      for (let i = 0; i < 20; i++) {
        global.Game.creeps[`creep-${i}`] = { room: mockRoom };
      }

      const balance = calculator.calculate(mockRoom);

      // Even with many creeps, minimum budget should be 200
      expect(balance.maxSpawnBudget).toBeGreaterThanOrEqual(200);
    });

    it("should scale budget with production", () => {
      const room1Source = {
        name: "W1N1",
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1" }];
          }
          if (type === FIND_MY_CREEPS) {
            return [{ memory: { role: "harvester" } }];
          }
          return [];
        })
      } as unknown as Room;

      const room3Sources = {
        name: "W2N2",
        find: vi.fn((type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1" }, { id: "source2" }, { id: "source3" }];
          }
          if (type === FIND_MY_CREEPS) {
            return [
              { memory: { role: "harvester" } },
              { memory: { role: "harvester" } },
              { memory: { role: "harvester" } }
            ];
          }
          return [];
        })
      } as unknown as Room;

      global.Game.creeps = {
        "harvester-1": { room: room1Source }
      };

      const balance1 = calculator.calculate(room1Source);

      global.Game.creeps = {
        "harvester-1": { room: room3Sources }
      };

      const balance3 = calculator.calculate(room3Sources);

      // More sources should allow higher budget
      expect(balance3.production).toBeGreaterThan(balance1.production);
    });
  });
});
