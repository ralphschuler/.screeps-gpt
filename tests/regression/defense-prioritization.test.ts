import { describe, expect, it, vi } from "vitest";
import { TowerManager } from "@runtime/defense/TowerManager";
import type { RoomLike } from "@runtime/types/GameContext";

describe("Regression: Defense prioritization", () => {
  it("should prioritize attacking hostiles over repairing structures", () => {
    const towerManager = new TowerManager({ log: vi.fn(), warn: vi.fn() });

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
      hits: 100,
      hitsMax: 100,
      body: [
        { type: ATTACK, hits: 100 },
        { type: MOVE, hits: 100 }
      ]
    } as unknown as Creep;

    const damagedRoad: Structure = {
      id: "road1" as Id<Structure>,
      structureType: STRUCTURE_ROAD,
      pos: { x: 20, y: 20 } as RoomPosition,
      hits: 100,
      hitsMax: 5000
    } as unknown as Structure;

    const mockRoom: RoomLike = {
      name: "W0N0",
      find: (type: FindConstant, options?: FilterOptions) => {
        if (type === FIND_MY_STRUCTURES) {
          if (options?.filter) {
            return [tower, damagedRoad].filter((s: Structure) => (options.filter as (s: Structure) => boolean)(s));
          }
          return [tower];
        }
        if (type === FIND_HOSTILE_CREEPS) {
          return [hostile];
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

    // Should attack hostile, not repair road
    expect(tower.attack).toHaveBeenCalledWith(hostile);
    expect(tower.repair).not.toHaveBeenCalled();
    expect(actions.attack).toBe(1);
    expect(actions.repair).toBe(0);
  });

  it("should prioritize healing damaged friendlies over repairing structures", () => {
    const towerManager = new TowerManager({ log: vi.fn(), warn: vi.fn() });

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

    const damagedCreep: Creep = {
      id: "damaged1" as Id<Creep>,
      name: "Damaged1",
      pos: { x: 30, y: 30 } as RoomPosition,
      hits: 50,
      hitsMax: 100
    } as unknown as Creep;

    const damagedRoad: Structure = {
      id: "road1" as Id<Structure>,
      structureType: STRUCTURE_ROAD,
      pos: { x: 20, y: 20 } as RoomPosition,
      hits: 100,
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
          if (options?.filter) {
            return [damagedCreep].filter(options.filter as (c: Creep) => boolean);
          }
          return [damagedCreep];
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

    // Should heal friendly, not repair road
    expect(tower.heal).toHaveBeenCalledWith(damagedCreep);
    expect(tower.repair).not.toHaveBeenCalled();
    expect(actions.heal).toBe(1);
    expect(actions.repair).toBe(0);
  });

  it("should target wounded hostiles preferentially for easier kills", () => {
    const towerManager = new TowerManager({ log: vi.fn(), warn: vi.fn() });

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

    const healthyHostile: Creep = {
      id: "healthy" as Id<Creep>,
      name: "Healthy",
      pos: { x: 30, y: 30 } as RoomPosition,
      hits: 200,
      hitsMax: 200,
      body: [
        { type: ATTACK, hits: 100 },
        { type: MOVE, hits: 100 }
      ]
    } as unknown as Creep;

    const woundedHostile: Creep = {
      id: "wounded" as Id<Creep>,
      name: "Wounded",
      pos: { x: 30, y: 30 } as RoomPosition,
      hits: 50,
      hitsMax: 200,
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
          return [healthyHostile, woundedHostile];
        }
        return [];
      }
    };

    towerManager.run(mockRoom);

    // Should attack wounded hostile for easier kill
    expect(tower.attack).toHaveBeenCalledWith(woundedHostile);
  });

  it("should handle multiple towers attacking same high-priority target", () => {
    const towerManager = new TowerManager({ log: vi.fn(), warn: vi.fn() });

    const tower1: StructureTower = {
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

    const tower2: StructureTower = {
      id: "tower2" as Id<StructureTower>,
      structureType: STRUCTURE_TOWER,
      pos: {
        x: 26,
        y: 26,
        getRangeTo: vi.fn(() => 5),
        findClosestByRange: vi.fn()
      } as unknown as RoomPosition,
      attack: vi.fn(() => OK),
      heal: vi.fn(() => OK),
      repair: vi.fn(() => OK)
    } as unknown as StructureTower;

    const healer: Creep = {
      id: "healer" as Id<Creep>,
      name: "Healer",
      pos: { x: 30, y: 30 } as RoomPosition,
      hits: 100,
      hitsMax: 100,
      body: [
        { type: HEAL, hits: 100 },
        { type: HEAL, hits: 100 },
        { type: MOVE, hits: 100 }
      ]
    } as unknown as Creep;

    const mockRoom: RoomLike = {
      name: "W0N0",
      find: (type: FindConstant) => {
        if (type === FIND_MY_STRUCTURES) {
          return [tower1, tower2];
        }
        if (type === FIND_HOSTILE_CREEPS) {
          return [healer];
        }
        return [];
      }
    };

    const actions = towerManager.run(mockRoom);

    // Both towers should attack the same high-priority healer
    expect(tower1.attack).toHaveBeenCalledWith(healer);
    expect(tower2.attack).toHaveBeenCalledWith(healer);
    expect(actions.attack).toBe(2);
  });
});
