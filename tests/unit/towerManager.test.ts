import { describe, expect, it, vi, beforeEach } from "vitest";
import { TowerManager } from "@runtime/defense/TowerManager";
import type { RoomLike } from "@runtime/types/GameContext";

describe("TowerManager", () => {
  let towerManager: TowerManager;

  beforeEach(() => {
    towerManager = new TowerManager({ log: vi.fn(), warn: vi.fn() });
  });

  describe("Defense prioritization", () => {
    it("should attack hostile creeps with highest priority", () => {
      const tower: StructureTower = {
        id: "tower1" as Id<StructureTower>,
        structureType: STRUCTURE_TOWER,
        pos: {
          x: 25,
          y: 25,
          getRangeTo: vi.fn((pos: RoomPosition) => Math.abs(25 - pos.x) + Math.abs(25 - pos.y)),
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
        hits: 100,
        hitsMax: 100,
        body: [
          { type: ATTACK, hits: 100 },
          { type: MOVE, hits: 100 }
        ]
      } as unknown as Creep;

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

      const actions = towerManager.run(mockRoom);

      expect(tower.attack).toHaveBeenCalledWith(hostile);
      expect(actions.attack).toBe(1);
      expect(actions.heal).toBe(0);
      expect(actions.repair).toBe(0);
    });

    it("should prioritize healers as high-threat targets", () => {
      const tower: StructureTower = {
        id: "tower1" as Id<StructureTower>,
        structureType: STRUCTURE_TOWER,
        pos: {
          x: 25,
          y: 25,
          getRangeTo: vi.fn((pos: RoomPosition) => Math.abs(25 - pos.x) + Math.abs(25 - pos.y)),
          findClosestByRange: vi.fn()
        } as unknown as RoomPosition,
        attack: vi.fn(() => OK),
        heal: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      } as unknown as StructureTower;

      const attacker: Creep = {
        id: "attacker" as Id<Creep>,
        name: "Attacker",
        pos: { x: 20, y: 20 } as RoomPosition,
        hits: 100,
        hitsMax: 100,
        body: [
          { type: ATTACK, hits: 100 },
          { type: MOVE, hits: 100 }
        ]
      } as unknown as Creep;

      const healer: Creep = {
        id: "healer" as Id<Creep>,
        name: "Healer",
        pos: { x: 30, y: 30 } as RoomPosition,
        hits: 100,
        hitsMax: 100,
        body: [
          { type: HEAL, hits: 100 },
          { type: MOVE, hits: 100 }
        ]
      } as unknown as Creep;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant) => {
          if (type === FIND_MY_STRUCTURES) {
            return [tower];
          }
          if (type === FIND_HOSTILE_CREEPS) {
            return [attacker, healer];
          }
          return [];
        }
      };

      towerManager.run(mockRoom);

      // Should attack healer first (higher threat priority)
      expect(tower.attack).toHaveBeenCalledWith(healer);
    });

    it("should heal damaged friendlies when no hostiles present", () => {
      const tower: StructureTower = {
        id: "tower1" as Id<StructureTower>,
        structureType: STRUCTURE_TOWER,
        pos: {
          x: 25,
          y: 25,
          getRangeTo: vi.fn(),
          findClosestByRange: vi.fn()
        } as unknown as RoomPosition,
        attack: vi.fn(() => OK),
        heal: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      } as unknown as StructureTower;

      const damagedCreep: Creep = {
        id: "damaged1" as Id<Creep>,
        name: "Damaged1",
        pos: { x: 30, y: 30 } as RoomPosition,
        hits: 50,
        hitsMax: 100
      } as unknown as Creep;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant, options?: FilterOptions) => {
          if (type === FIND_MY_STRUCTURES) {
            return [tower];
          }
          if (type === FIND_HOSTILE_CREEPS) {
            return [];
          }
          if (type === FIND_MY_CREEPS) {
            if (options?.filter) {
              return [damagedCreep].filter(options.filter as (c: Creep) => boolean);
            }
            return [damagedCreep];
          }
          return [];
        }
      };

      const actions = towerManager.run(mockRoom);

      expect(tower.heal).toHaveBeenCalledWith(damagedCreep);
      expect(actions.heal).toBe(1);
    });

    it("should repair damaged structures when no combat actions needed", () => {
      const tower: StructureTower = {
        id: "tower1" as Id<StructureTower>,
        structureType: STRUCTURE_TOWER,
        pos: {
          x: 25,
          y: 25,
          getRangeTo: vi.fn(),
          findClosestByRange: vi.fn((structures: Structure[]) => structures[0])
        } as unknown as RoomPosition,
        attack: vi.fn(() => OK),
        heal: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      } as unknown as StructureTower;

      const damagedRoad: Structure = {
        id: "road1" as Id<Structure>,
        structureType: STRUCTURE_ROAD,
        pos: { x: 30, y: 30 } as RoomPosition,
        hits: 2000,
        hitsMax: 5000
      } as unknown as Structure;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant, options?: FilterOptions) => {
          if (type === FIND_MY_STRUCTURES) {
            if (options?.filter) {
              const filtered = [tower, damagedRoad].filter(options.filter as (s: Structure) => boolean);
              return filtered.filter((s: Structure) => s.structureType === STRUCTURE_TOWER);
            }
            return [tower];
          }
          if (type === FIND_HOSTILE_CREEPS) {
            return [];
          }
          if (type === FIND_MY_CREEPS) {
            return [];
          }
          if (type === FIND_STRUCTURES) {
            if (options?.filter) {
              return [damagedRoad].filter(options.filter as (s: Structure) => boolean);
            }
            return [damagedRoad];
          }
          return [];
        }
      };

      const actions = towerManager.run(mockRoom);

      expect(tower.repair).toHaveBeenCalledWith(damagedRoad);
      expect(actions.repair).toBe(1);
    });

    it("should skip walls and ramparts in standard repair", () => {
      const tower: StructureTower = {
        id: "tower1" as Id<StructureTower>,
        structureType: STRUCTURE_TOWER,
        pos: {
          x: 25,
          y: 25,
          getRangeTo: vi.fn(),
          findClosestByRange: vi.fn()
        } as unknown as RoomPosition,
        attack: vi.fn(() => OK),
        heal: vi.fn(() => OK),
        repair: vi.fn(() => OK)
      } as unknown as StructureTower;

      const wall: Structure = {
        id: "wall1" as Id<Structure>,
        structureType: STRUCTURE_WALL,
        pos: { x: 30, y: 30 } as RoomPosition,
        hits: 1000,
        hitsMax: 300000000
      } as unknown as Structure;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant, options?: FilterOptions) => {
          if (type === FIND_MY_STRUCTURES) {
            return [tower];
          }
          if (type === FIND_HOSTILE_CREEPS) {
            return [];
          }
          if (type === FIND_MY_CREEPS) {
            return [];
          }
          if (type === FIND_STRUCTURES) {
            if (options?.filter) {
              return [wall].filter(options.filter as (s: Structure) => boolean);
            }
            return [wall];
          }
          return [];
        }
      };

      const actions = towerManager.run(mockRoom);

      expect(tower.repair).not.toHaveBeenCalled();
      expect(actions.repair).toBe(0);
    });
  });

  describe("Threat assessment", () => {
    it("should calculate threat summary for a room", () => {
      const tower: StructureTower = {
        id: "tower1" as Id<StructureTower>,
        structureType: STRUCTURE_TOWER,
        pos: {
          x: 25,
          y: 25,
          getRangeTo: vi.fn(() => 10),
          findClosestByRange: vi.fn()
        } as unknown as RoomPosition
      } as unknown as StructureTower;

      const hostile: Creep = {
        id: "hostile1" as Id<Creep>,
        name: "Hostile1",
        pos: { x: 30, y: 30 } as RoomPosition,
        hits: 100,
        hitsMax: 100,
        body: [
          { type: ATTACK, hits: 100 },
          { type: ATTACK, hits: 100 },
          { type: MOVE, hits: 100 }
        ]
      } as unknown as Creep;

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

      const summary = towerManager.getThreatSummary(mockRoom);

      expect(summary.hostileCount).toBe(1);
      expect(summary.totalThreat).toBeGreaterThan(0);
      expect(summary.highestThreat).toBeDefined();
      expect(summary.highestThreat?.creep).toBe(hostile);
    });

    it("should return zero threat when no hostiles present", () => {
      const tower: StructureTower = {
        id: "tower1" as Id<StructureTower>,
        structureType: STRUCTURE_TOWER,
        pos: {
          x: 25,
          y: 25,
          getRangeTo: vi.fn(),
          findClosestByRange: vi.fn()
        } as unknown as RoomPosition
      } as unknown as StructureTower;

      const mockRoom: RoomLike = {
        name: "W0N0",
        find: (type: FindConstant) => {
          if (type === FIND_MY_STRUCTURES) {
            return [tower];
          }
          if (type === FIND_HOSTILE_CREEPS) {
            return [];
          }
          return [];
        }
      };

      const summary = towerManager.getThreatSummary(mockRoom);

      expect(summary.hostileCount).toBe(0);
      expect(summary.totalThreat).toBe(0);
      expect(summary.highestThreat).toBeNull();
    });
  });

  describe("No towers available", () => {
    it("should return zero actions when no towers exist", () => {
      const mockRoom: RoomLike = {
        name: "W0N0",
        find: () => []
      };

      const actions = towerManager.run(mockRoom);

      expect(actions.attack).toBe(0);
      expect(actions.heal).toBe(0);
      expect(actions.repair).toBe(0);
    });
  });
});
