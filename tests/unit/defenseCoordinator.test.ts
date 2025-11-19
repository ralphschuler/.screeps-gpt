import { describe, expect, it, vi, beforeEach } from "vitest";
import { DefenseCoordinator, type DefenseMemory } from "@runtime/defense/DefenseCoordinator";
import { ThreatDetector, type ThreatMemory } from "@runtime/defense/ThreatDetector";
import { TowerManager } from "@runtime/defense/TowerManager";
import { CombatManager } from "@runtime/defense/CombatManager";
import type { RoomLike } from "@runtime/types/GameContext";

describe("DefenseCoordinator", () => {
  let coordinator: DefenseCoordinator;
  let threatDetector: ThreatDetector;
  let towerManager: TowerManager;
  let combatManager: CombatManager;
  let threatMemory: ThreatMemory;
  let defenseMemory: DefenseMemory;

  beforeEach(() => {
    threatMemory = { rooms: {}, lastUpdate: 0 };
    defenseMemory = { posture: {}, lastDefenseAction: 0 };

    const logger = { log: vi.fn(), warn: vi.fn() };

    threatDetector = new ThreatDetector(logger, threatMemory);
    towerManager = new TowerManager(logger);
    combatManager = new CombatManager({ logger });

    coordinator = new DefenseCoordinator(
      threatDetector,
      towerManager,
      combatManager,
      logger,
      defenseMemory
    );

    // Mock Game.time
    (global as { Game?: { time: number } }).Game = { time: 1000 };
  });

  describe("Defensive posture", () => {
    it("should maintain normal posture with no threats", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        find: () => []
      };

      const result = coordinator.coordinateDefense(mockRoom, 1000);

      expect(result.posture).toBe("normal");
      expect(defenseMemory.posture["W0N0"]).toBe("normal");
    });

    it("should activate alert posture for low threats", () => {
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

      const result = coordinator.coordinateDefense(mockRoom, 1000);

      expect(result.posture).toBe("alert");
      expect(defenseMemory.posture["W0N0"]).toBe("alert");
    });

    it("should activate defensive posture for high threats", () => {
      const hostile: Creep = {
        id: "hostile1" as Id<Creep>,
        name: "PowerfulHostile",
        pos: { x: 25, y: 25 } as RoomPosition,
        owner: { username: "Enemy" } as Owner,
        body: [
          { type: ATTACK, hits: 100 },
          { type: ATTACK, hits: 100 },
          { type: ATTACK, hits: 100 },
          { type: HEAL, hits: 100 },
          { type: HEAL, hits: 100 }
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

      const result = coordinator.coordinateDefense(mockRoom, 1000);

      expect(result.posture).toBe("defensive");
      expect(defenseMemory.posture["W0N0"]).toBe("defensive");
    });

    it("should activate emergency posture for critical threats", () => {
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

      const result = coordinator.coordinateDefense(mockRoom, 1000);

      expect(result.posture).toBe("emergency");
      expect(defenseMemory.posture["W0N0"]).toBe("emergency");
    });
  });

  describe("Tower coordination", () => {
    it("should engage towers when threats present", () => {
      const tower: StructureTower = {
        id: "tower1" as Id<StructureTower>,
        structureType: STRUCTURE_TOWER,
        pos: {
          x: 25,
          y: 25,
          getRangeTo: vi.fn(() => 5),
          findClosestByRange: vi.fn()
        } as unknown as RoomPosition,
        attack: vi.fn(() => OK),
        heal: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      } as unknown as StructureTower;

      const hostile: Creep = {
        id: "hostile1" as Id<Creep>,
        name: "Hostile1",
        pos: { x: 30, y: 30 } as RoomPosition,
        owner: { username: "Enemy" } as Owner,
        hits: 100,
        hitsMax: 100,
        body: [{ type: ATTACK, hits: 100 }]
      } as Creep;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant) => {
          if (type === FIND_MY_STRUCTURES) {
            return [tower];
          }
          if (type === FIND_HOSTILE_CREEPS) {
            return [hostile];
          }
          return [];
        }
      };

      const result = coordinator.coordinateDefense(mockRoom, 1000);

      expect(result.towersEngaged).toBe(1);
      expect(tower.attack).toHaveBeenCalledWith(hostile);
    });
  });

  describe("Defensive mode checks", () => {
    it("should detect defensive mode active", () => {
      defenseMemory.posture["W0N0"] = "defensive";

      const isActive = coordinator.isDefensiveModeActive("W0N0");

      expect(isActive).toBe(true);
    });

    it("should detect emergency mode as defensive", () => {
      defenseMemory.posture["W0N0"] = "emergency";

      const isActive = coordinator.isDefensiveModeActive("W0N0");

      expect(isActive).toBe(true);
    });

    it("should not detect normal mode as defensive", () => {
      defenseMemory.posture["W0N0"] = "normal";

      const isActive = coordinator.isDefensiveModeActive("W0N0");

      expect(isActive).toBe(false);
    });

    it("should not detect alert mode as defensive", () => {
      defenseMemory.posture["W0N0"] = "alert";

      const isActive = coordinator.isDefensiveModeActive("W0N0");

      expect(isActive).toBe(false);
    });
  });

  describe("Upgrading pause logic", () => {
    it("should pause upgrading during defensive posture", () => {
      defenseMemory.posture["W0N0"] = "defensive";

      const shouldPause = coordinator.shouldPauseUpgrading("W0N0");

      expect(shouldPause).toBe(true);
    });

    it("should pause upgrading during emergency posture", () => {
      defenseMemory.posture["W0N0"] = "emergency";

      const shouldPause = coordinator.shouldPauseUpgrading("W0N0");

      expect(shouldPause).toBe(true);
    });

    it("should not pause upgrading during alert posture", () => {
      defenseMemory.posture["W0N0"] = "alert";

      const shouldPause = coordinator.shouldPauseUpgrading("W0N0");

      expect(shouldPause).toBe(false);
    });

    it("should not pause upgrading during normal posture", () => {
      defenseMemory.posture["W0N0"] = "normal";

      const shouldPause = coordinator.shouldPauseUpgrading("W0N0");

      expect(shouldPause).toBe(false);
    });
  });

  describe("Defender prioritization", () => {
    it("should prioritize defenders during alert", () => {
      defenseMemory.posture["W0N0"] = "alert";

      const shouldPrioritize = coordinator.shouldPrioritizeDefenders("W0N0");

      expect(shouldPrioritize).toBe(true);
    });

    it("should prioritize defenders during defensive", () => {
      defenseMemory.posture["W0N0"] = "defensive";

      const shouldPrioritize = coordinator.shouldPrioritizeDefenders("W0N0");

      expect(shouldPrioritize).toBe(true);
    });

    it("should prioritize defenders during emergency", () => {
      defenseMemory.posture["W0N0"] = "emergency";

      const shouldPrioritize = coordinator.shouldPrioritizeDefenders("W0N0");

      expect(shouldPrioritize).toBe(true);
    });

    it("should not prioritize defenders during normal", () => {
      defenseMemory.posture["W0N0"] = "normal";

      const shouldPrioritize = coordinator.shouldPrioritizeDefenders("W0N0");

      expect(shouldPrioritize).toBe(false);
    });
  });

  describe("Threat level queries", () => {
    it("should return threat level from detector", () => {
      threatMemory.rooms["W0N0"] = {
        roomName: "W0N0",
        threatLevel: "high",
        hostileCount: 3,
        totalThreatScore: 200,
        threats: [],
        assessedAt: 1000
      };

      const level = coordinator.getThreatLevel("W0N0");

      expect(level).toBe("high");
    });

    it("should return none for unknown rooms", () => {
      const level = coordinator.getThreatLevel("UnknownRoom");

      expect(level).toBe("none");
    });
  });

  describe("Threatened rooms list", () => {
    it("should return all threatened rooms", () => {
      threatMemory.rooms["W0N0"] = {
        roomName: "W0N0",
        threatLevel: "high",
        hostileCount: 3,
        totalThreatScore: 200,
        threats: [],
        assessedAt: 1000
      };
      threatMemory.rooms["W0N1"] = {
        roomName: "W0N1",
        threatLevel: "medium",
        hostileCount: 2,
        totalThreatScore: 100,
        threats: [],
        assessedAt: 1000
      };
      threatMemory.rooms["W0N2"] = {
        roomName: "W0N2",
        threatLevel: "none",
        hostileCount: 0,
        totalThreatScore: 0,
        threats: [],
        assessedAt: 1000
      };

      const threatened = coordinator.getThreatenedRooms();

      expect(threatened).toContain("W0N0");
      expect(threatened).toContain("W0N1");
      expect(threatened).not.toContain("W0N2");
    });
  });
});
