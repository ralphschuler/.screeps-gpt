import { describe, expect, it, vi, beforeEach } from "vitest";
import { ThreatDetector, type ThreatMemory } from "@runtime/defense/ThreatDetector";
import type { RoomLike } from "@runtime/types/GameContext";

describe("ThreatDetector", () => {
  let threatDetector: ThreatDetector;
  let mockMemory: ThreatMemory;

  beforeEach(() => {
    mockMemory = {
      rooms: {},
      lastUpdate: 0
    };
    threatDetector = new ThreatDetector({ log: vi.fn(), warn: vi.fn() }, mockMemory);
    
    // Mock Game.time
    (global as { Game?: { time: number } }).Game = { time: 1000 };
  });

  describe("Threat detection", () => {
    it("should detect no threats in empty room", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        find: () => []
      };

      const assessment = threatDetector.scanRoom(mockRoom, 1000);

      expect(assessment.roomName).toBe("W0N0");
      expect(assessment.threatLevel).toBe("none");
      expect(assessment.hostileCount).toBe(0);
      expect(assessment.totalThreatScore).toBe(0);
      expect(assessment.threats).toHaveLength(0);
    });

    it("should detect low threat from single weak hostile", () => {
      const hostile: Creep = {
        id: "hostile1" as Id<Creep>,
        name: "Hostile1",
        pos: { x: 25, y: 25 } as RoomPosition,
        owner: { username: "Enemy" } as Owner,
        body: [
          { type: MOVE, hits: 100 },
          { type: ATTACK, hits: 100 }
        ]
      } as Creep;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant) => {
          if (type === FIND_HOSTILE_CREEPS) {
            return [hostile];
          }
          return [];
        }
      };

      const assessment = threatDetector.scanRoom(mockRoom, 1000);

      expect(assessment.threatLevel).toBe("low");
      expect(assessment.hostileCount).toBe(1);
      expect(assessment.threats).toHaveLength(1);
      expect(assessment.threats[0].bodyParts.attack).toBe(1);
      expect(assessment.threats[0].threatScore).toBeGreaterThan(0);
    });

    it("should detect medium threat from multiple hostiles", () => {
      const hostile1: Creep = {
        id: "hostile1" as Id<Creep>,
        name: "Hostile1",
        pos: { x: 25, y: 25 } as RoomPosition,
        owner: { username: "Enemy" } as Owner,
        body: [
          { type: ATTACK, hits: 100 },
          { type: MOVE, hits: 100 }
        ]
      } as Creep;

      const hostile2: Creep = {
        id: "hostile2" as Id<Creep>,
        name: "Hostile2",
        pos: { x: 26, y: 25 } as RoomPosition,
        owner: { username: "Enemy" } as Owner,
        body: [
          { type: ATTACK, hits: 100 },
          { type: MOVE, hits: 100 }
        ]
      } as Creep;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant) => {
          if (type === FIND_HOSTILE_CREEPS) {
            return [hostile1, hostile2];
          }
          return [];
        }
      };

      const assessment = threatDetector.scanRoom(mockRoom, 1000);

      expect(assessment.threatLevel).toBe("medium");
      expect(assessment.hostileCount).toBe(2);
      expect(assessment.threats).toHaveLength(2);
    });

    it("should detect high threat from powerful hostile", () => {
      const hostile: Creep = {
        id: "hostile1" as Id<Creep>,
        name: "PowerfulHostile",
        pos: { x: 25, y: 25 } as RoomPosition,
        owner: { username: "Enemy" } as Owner,
        body: [
          { type: ATTACK, hits: 100 },
          { type: ATTACK, hits: 100 },
          { type: ATTACK, hits: 100 },
          { type: ATTACK, hits: 100 },
          { type: ATTACK, hits: 100 },
          { type: HEAL, hits: 100 },
          { type: HEAL, hits: 100 },
          { type: MOVE, hits: 100 }
        ]
      } as Creep;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant) => {
          if (type === FIND_HOSTILE_CREEPS) {
            return [hostile];
          }
          return [];
        }
      };

      const assessment = threatDetector.scanRoom(mockRoom, 1000);

      expect(assessment.threatLevel).toBe("high");
      expect(assessment.hostileCount).toBe(1);
      expect(assessment.totalThreatScore).toBeGreaterThanOrEqual(150);
    });

    it("should detect critical threat from many hostiles", () => {
      const hostiles: Creep[] = [];
      for (let i = 0; i < 5; i++) {
        hostiles.push({
          id: `hostile${i}` as Id<Creep>,
          name: `Hostile${i}`,
          pos: { x: 25 + i, y: 25 } as RoomPosition,
          owner: { username: "Enemy" } as Owner,
          body: [
            { type: ATTACK, hits: 100 },
            { type: MOVE, hits: 100 }
          ]
        } as Creep);
      }

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant) => {
          if (type === FIND_HOSTILE_CREEPS) {
            return hostiles;
          }
          return [];
        }
      };

      const assessment = threatDetector.scanRoom(mockRoom, 1000);

      expect(assessment.threatLevel).toBe("critical");
      expect(assessment.hostileCount).toBe(5);
    });
  });

  describe("Threat scoring", () => {
    it("should prioritize healers with higher threat score", () => {
      const attacker: Creep = {
        id: "attacker" as Id<Creep>,
        name: "Attacker",
        pos: { x: 25, y: 25 } as RoomPosition,
        owner: { username: "Enemy" } as Owner,
        body: [
          { type: ATTACK, hits: 100 },
          { type: ATTACK, hits: 100 },
          { type: MOVE, hits: 100 }
        ]
      } as Creep;

      const healer: Creep = {
        id: "healer" as Id<Creep>,
        name: "Healer",
        pos: { x: 26, y: 25 } as RoomPosition,
        owner: { username: "Enemy" } as Owner,
        body: [
          { type: HEAL, hits: 100 },
          { type: MOVE, hits: 100 }
        ]
      } as Creep;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant) => {
          if (type === FIND_HOSTILE_CREEPS) {
            return [attacker, healer];
          }
          return [];
        }
      };

      const assessment = threatDetector.scanRoom(mockRoom, 1000);

      const attackerThreat = assessment.threats.find(t => t.id === attacker.id);
      const healerThreat = assessment.threats.find(t => t.id === healer.id);

      expect(healerThreat?.threatScore).toBeGreaterThan(attackerThreat?.threatScore ?? 0);
    });

    it("should calculate threat score for dismantlers", () => {
      const dismantler: Creep = {
        id: "dismantler" as Id<Creep>,
        name: "Dismantler",
        pos: { x: 25, y: 25 } as RoomPosition,
        owner: { username: "Enemy" } as Owner,
        body: [
          { type: WORK, hits: 100 },
          { type: WORK, hits: 100 },
          { type: MOVE, hits: 100 }
        ]
      } as Creep;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant) => {
          if (type === FIND_HOSTILE_CREEPS) {
            return [dismantler];
          }
          return [];
        }
      };

      const assessment = threatDetector.scanRoom(mockRoom, 1000);

      expect(assessment.threats[0].bodyParts.work).toBe(2);
      expect(assessment.threats[0].threatScore).toBeGreaterThan(0);
    });
  });

  describe("Memory persistence", () => {
    it("should persist threat assessment to memory", () => {
      const hostile: Creep = {
        id: "hostile1" as Id<Creep>,
        name: "Hostile1",
        pos: { x: 25, y: 25 } as RoomPosition,
        owner: { username: "Enemy" } as Owner,
        body: [{ type: ATTACK, hits: 100 }]
      } as Creep;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant) => {
          if (type === FIND_HOSTILE_CREEPS) {
            return [hostile];
          }
          return [];
        }
      };

      threatDetector.scanRoom(mockRoom, 1000);

      expect(mockMemory.rooms["W0N0"]).toBeDefined();
      expect(mockMemory.rooms["W0N0"].hostileCount).toBe(1);
      expect(mockMemory.lastUpdate).toBe(1000);
    });

    it("should retrieve threat assessment from memory", () => {
      mockMemory.rooms["W0N0"] = {
        roomName: "W0N0",
        threatLevel: "high",
        hostileCount: 3,
        totalThreatScore: 200,
        threats: [],
        assessedAt: 1000
      };

      const assessment = threatDetector.getThreatAssessment("W0N0");

      expect(assessment).toBeDefined();
      expect(assessment?.threatLevel).toBe("high");
      expect(assessment?.hostileCount).toBe(3);
    });

    it("should detect active threats within time window", () => {
      mockMemory.rooms["W0N0"] = {
        roomName: "W0N0",
        threatLevel: "medium",
        hostileCount: 2,
        totalThreatScore: 100,
        threats: [],
        assessedAt: 995 // 5 ticks ago
      };

      const hasThreats = threatDetector.hasActiveThreats("W0N0", 10);

      expect(hasThreats).toBe(true);
    });

    it("should not detect threats outside time window", () => {
      mockMemory.rooms["W0N0"] = {
        roomName: "W0N0",
        threatLevel: "medium",
        hostileCount: 2,
        totalThreatScore: 100,
        threats: [],
        assessedAt: 980 // 20 ticks ago
      };

      const hasThreats = threatDetector.hasActiveThreats("W0N0", 10);

      expect(hasThreats).toBe(false);
    });
  });

  describe("Threat cleanup", () => {
    it("should clean up old threat data", () => {
      mockMemory.rooms["W0N0"] = {
        roomName: "W0N0",
        threatLevel: "low",
        hostileCount: 1,
        totalThreatScore: 10,
        threats: [],
        assessedAt: 800 // 200 ticks ago
      };
      mockMemory.rooms["W0N1"] = {
        roomName: "W0N1",
        threatLevel: "high",
        hostileCount: 3,
        totalThreatScore: 200,
        threats: [],
        assessedAt: 950 // 50 ticks ago
      };

      threatDetector.cleanupOldThreats(1000, 100);

      expect(mockMemory.rooms["W0N0"]).toBeUndefined();
      expect(mockMemory.rooms["W0N1"]).toBeDefined();
    });

    it("should clean up rooms with no threats", () => {
      mockMemory.rooms["W0N0"] = {
        roomName: "W0N0",
        threatLevel: "none",
        hostileCount: 0,
        totalThreatScore: 0,
        threats: [],
        assessedAt: 990
      };

      threatDetector.cleanupOldThreats(1000, 100);

      expect(mockMemory.rooms["W0N0"]).toBeUndefined();
    });
  });

  describe("Threatened rooms", () => {
    it("should return list of threatened rooms", () => {
      mockMemory.rooms["W0N0"] = {
        roomName: "W0N0",
        threatLevel: "high",
        hostileCount: 3,
        totalThreatScore: 200,
        threats: [],
        assessedAt: 1000
      };
      mockMemory.rooms["W0N1"] = {
        roomName: "W0N1",
        threatLevel: "none",
        hostileCount: 0,
        totalThreatScore: 0,
        threats: [],
        assessedAt: 1000
      };
      mockMemory.rooms["W0N2"] = {
        roomName: "W0N2",
        threatLevel: "medium",
        hostileCount: 2,
        totalThreatScore: 80,
        threats: [],
        assessedAt: 1000
      };

      const threatened = threatDetector.getThreatenedRooms();

      expect(threatened).toContain("W0N0");
      expect(threatened).toContain("W0N2");
      expect(threatened).not.toContain("W0N1");
    });
  });
});
