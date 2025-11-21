import { describe, expect, it, vi } from "vitest";
import { TowerManager } from "@runtime/defense/TowerManager";
import { RepairPriority } from "@shared/contracts";
import type { RoomLike } from "@runtime/types/GameContext";

describe("Tower Repair Priority System", () => {
  it("should prioritize critical structures (<20% health) first", () => {
    const towerManager = new TowerManager({ log: vi.fn(), warn: vi.fn() });

    const tower: StructureTower = {
      id: "tower1" as Id<StructureTower>,
      structureType: STRUCTURE_TOWER,
      pos: {
        x: 25,
        y: 25,
        getRangeTo: vi.fn((pos: RoomPosition) => {
          // Critical spawn closer
          if (pos.x === 20) return 5;
          // Medium priority road farther
          return 10;
        }),
        findClosestByRange: vi.fn()
      } as unknown as RoomPosition,
      store: {
        getUsedCapacity: vi.fn(() => 600) // Above 500 threshold
      } as unknown as StoreDefinition,
      attack: vi.fn(() => OK),
      heal: vi.fn(() => OK),
      repair: vi.fn(() => OK)
    } as unknown as StructureTower;

    // Critical: spawn at 15% health
    const criticalSpawn: StructureSpawn = {
      id: "spawn1" as Id<StructureSpawn>,
      structureType: STRUCTURE_SPAWN,
      pos: { x: 20, y: 20 } as RoomPosition,
      hits: 150,
      hitsMax: 1000,
      my: true
    } as unknown as StructureSpawn;

    // Medium: road at 40% health
    const mediumRoad: StructureRoad = {
      id: "road1" as Id<StructureRoad>,
      structureType: STRUCTURE_ROAD,
      pos: { x: 30, y: 30 } as RoomPosition,
      hits: 2000,
      hitsMax: 5000
    } as unknown as StructureRoad;

    const mockRoom: RoomLike = {
      name: "W0N0",
      find: (type: FindConstant, options?: FilterOptions) => {
        if (type === FIND_MY_STRUCTURES) {
          if (options?.filter) {
            return [tower].filter(options.filter as (s: Structure) => boolean);
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
            return [criticalSpawn, mediumRoad].filter(options.filter as (s: Structure) => boolean);
          }
          return [criticalSpawn, mediumRoad];
        }
        return [];
      }
    };

    const actions = towerManager.run(mockRoom);

    // Should repair critical spawn over medium priority road
    expect(tower.repair).toHaveBeenCalledWith(criticalSpawn);
    expect(actions.repair).toBe(1);
  });

  it("should reserve tower energy for defense (>500 threshold)", () => {
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
      store: {
        getUsedCapacity: vi.fn(() => 400) // Below 500 threshold
      } as unknown as StoreDefinition,
      attack: vi.fn(() => OK),
      heal: vi.fn(() => OK),
      repair: vi.fn(() => OK)
    } as unknown as StructureTower;

    const damagedRoad: StructureRoad = {
      id: "road1" as Id<StructureRoad>,
      structureType: STRUCTURE_ROAD,
      pos: { x: 20, y: 20 } as RoomPosition,
      hits: 1000,
      hitsMax: 5000
    } as unknown as StructureRoad;

    const mockRoom: RoomLike = {
      name: "W0N0",
      find: (type: FindConstant, options?: FilterOptions) => {
        if (type === FIND_MY_STRUCTURES) {
          if (options?.filter) {
            return [tower].filter(options.filter as (s: Structure) => boolean);
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

    // Should NOT repair when energy is below threshold
    expect(tower.repair).not.toHaveBeenCalled();
    expect(actions.repair).toBe(0);
  });

  it("should prioritize high-priority infrastructure (spawn/extensions/containers <50%)", () => {
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
      store: {
        getUsedCapacity: vi.fn(() => 600)
      } as unknown as StoreDefinition,
      attack: vi.fn(() => OK),
      heal: vi.fn(() => OK),
      repair: vi.fn(() => OK)
    } as unknown as StructureTower;

    // High: container at 40% health
    const highContainer: StructureContainer = {
      id: "container1" as Id<StructureContainer>,
      structureType: STRUCTURE_CONTAINER,
      pos: { x: 20, y: 20 } as RoomPosition,
      hits: 100000,
      hitsMax: 250000
    } as unknown as StructureContainer;

    // Low: tower at 70% health
    const lowTower: StructureTower = {
      id: "tower2" as Id<StructureTower>,
      structureType: STRUCTURE_TOWER,
      pos: { x: 30, y: 30 } as RoomPosition,
      hits: 2100,
      hitsMax: 3000
    } as unknown as StructureTower;

    const mockRoom: RoomLike = {
      name: "W0N0",
      find: (type: FindConstant, options?: FilterOptions) => {
        if (type === FIND_MY_STRUCTURES) {
          if (options?.filter) {
            return [tower].filter(options.filter as (s: Structure) => boolean);
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
            return [highContainer, lowTower].filter(options.filter as (s: Structure) => boolean);
          }
          return [highContainer, lowTower];
        }
        return [];
      }
    };

    const actions = towerManager.run(mockRoom);

    // Should repair high-priority container over low-priority tower
    expect(tower.repair).toHaveBeenCalledWith(highContainer);
    expect(actions.repair).toBe(1);
  });

  it("should consider distance efficiency when selecting repair targets", () => {
    const towerManager = new TowerManager({ log: vi.fn(), warn: vi.fn() });

    const tower: StructureTower = {
      id: "tower1" as Id<StructureTower>,
      structureType: STRUCTURE_TOWER,
      pos: {
        x: 25,
        y: 25,
        getRangeTo: vi.fn((pos: RoomPosition) => {
          // Close road
          if (pos.x === 20) return 5;
          // Far road
          return 35;
        }),
        findClosestByRange: vi.fn()
      } as unknown as RoomPosition,
      store: {
        getUsedCapacity: vi.fn(() => 600)
      } as unknown as StoreDefinition,
      attack: vi.fn(() => OK),
      heal: vi.fn(() => OK),
      repair: vi.fn(() => OK)
    } as unknown as StructureTower;

    // Same priority, close target
    const closeRoad: StructureRoad = {
      id: "road1" as Id<StructureRoad>,
      structureType: STRUCTURE_ROAD,
      pos: { x: 20, y: 20 } as RoomPosition,
      hits: 2000,
      hitsMax: 5000
    } as unknown as StructureRoad;

    // Same priority, far target (>30 tiles)
    const farRoad: StructureRoad = {
      id: "road2" as Id<StructureRoad>,
      structureType: STRUCTURE_ROAD,
      pos: { x: 40, y: 40 } as RoomPosition,
      hits: 2000,
      hitsMax: 5000
    } as unknown as StructureRoad;

    const mockRoom: RoomLike = {
      name: "W0N0",
      find: (type: FindConstant, options?: FilterOptions) => {
        if (type === FIND_MY_STRUCTURES) {
          if (options?.filter) {
            return [tower].filter(options.filter as (s: Structure) => boolean);
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
            return [closeRoad, farRoad].filter(options.filter as (s: Structure) => boolean);
          }
          return [closeRoad, farRoad];
        }
        return [];
      }
    };

    const actions = towerManager.run(mockRoom);

    // Should repair close road over far road (higher efficiency)
    expect(tower.repair).toHaveBeenCalledWith(closeRoad);
    expect(actions.repair).toBe(1);
  });

  it("should repair roads below 50% health as medium priority", () => {
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
      store: {
        getUsedCapacity: vi.fn(() => 600)
      } as unknown as StoreDefinition,
      attack: vi.fn(() => OK),
      heal: vi.fn(() => OK),
      repair: vi.fn(() => OK)
    } as unknown as StructureTower;

    const damagedRoad: StructureRoad = {
      id: "road1" as Id<StructureRoad>,
      structureType: STRUCTURE_ROAD,
      pos: { x: 20, y: 20 } as RoomPosition,
      hits: 2000, // 40% health
      hitsMax: 5000
    } as unknown as StructureRoad;

    const mockRoom: RoomLike = {
      name: "W0N0",
      find: (type: FindConstant, options?: FilterOptions) => {
        if (type === FIND_MY_STRUCTURES) {
          if (options?.filter) {
            return [tower].filter(options.filter as (s: Structure) => boolean);
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

    // Should repair road below 50%
    expect(tower.repair).toHaveBeenCalledWith(damagedRoad);
    expect(actions.repair).toBe(1);
  });

  it("should maintain defense priority over repairs", () => {
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
      store: {
        getUsedCapacity: vi.fn(() => 600)
      } as unknown as StoreDefinition,
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

    const criticalSpawn: StructureSpawn = {
      id: "spawn1" as Id<StructureSpawn>,
      structureType: STRUCTURE_SPAWN,
      pos: { x: 20, y: 20 } as RoomPosition,
      hits: 150, // 15% health - critical
      hitsMax: 1000,
      my: true
    } as unknown as StructureSpawn;

    const mockRoom: RoomLike = {
      name: "W0N0",
      find: (type: FindConstant, options?: FilterOptions) => {
        if (type === FIND_MY_STRUCTURES) {
          if (options?.filter) {
            return [tower].filter(options.filter as (s: Structure) => boolean);
          }
          return [tower];
        }
        if (type === FIND_HOSTILE_CREEPS) {
          return [hostile];
        }
        if (type === FIND_MY_CREEPS) {
          return [];
        }
        if (type === FIND_STRUCTURES) {
          if (options?.filter) {
            return [criticalSpawn].filter(options.filter as (s: Structure) => boolean);
          }
          return [criticalSpawn];
        }
        return [];
      }
    };

    const actions = towerManager.run(mockRoom);

    // Should attack hostile, not repair critical spawn
    expect(tower.attack).toHaveBeenCalledWith(hostile);
    expect(tower.repair).not.toHaveBeenCalled();
    expect(actions.attack).toBe(1);
    expect(actions.repair).toBe(0);
  });
});
