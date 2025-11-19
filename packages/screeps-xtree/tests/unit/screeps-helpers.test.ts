import { describe, it, expect, beforeEach } from "vitest";
import { CreepConditions } from "../../src/screeps/helpers.js";
import type { CreepDecisionContext } from "../../src/screeps/types.js";

describe("Screeps Helpers", () => {
  let mockCreep: Partial<Creep>;
  let mockRoom: Partial<Room>;
  let context: CreepDecisionContext;

  beforeEach(() => {
    mockCreep = {
      store: {
        getFreeCapacity: (_resource?: ResourceConstant) => 50,
        getUsedCapacity: (_resource?: ResourceConstant) => 0
      } as Store<Creep, false>,
      hits: 100,
      hitsMax: 100,
      pos: {} as RoomPosition
    };

    mockRoom = {
      find: () => []
    } as Partial<Room>;

    context = {
      creep: mockCreep as Creep,
      room: mockRoom as Room,
      energyAvailable: true,
      nearbyEnemies: false,
      constructionSites: 0,
      damagedStructures: 0
    };
  });

  describe("CreepConditions.hasFreeCapacity", () => {
    it("should return true when creep has free capacity", () => {
      mockCreep.store = {
        getFreeCapacity: () => 50
      } as Store<Creep, false>;

      expect(CreepConditions.hasFreeCapacity(context)).toBe(true);
    });

    it("should return false when creep has no free capacity", () => {
      mockCreep.store = {
        getFreeCapacity: () => 0
      } as Store<Creep, false>;

      expect(CreepConditions.hasFreeCapacity(context)).toBe(false);
    });
  });

  describe("CreepConditions.isFull", () => {
    it("should return true when creep is full", () => {
      mockCreep.store = {
        getFreeCapacity: () => 0
      } as Store<Creep, false>;

      expect(CreepConditions.isFull(context)).toBe(true);
    });

    it("should return false when creep is not full", () => {
      mockCreep.store = {
        getFreeCapacity: () => 50
      } as Store<Creep, false>;

      expect(CreepConditions.isFull(context)).toBe(false);
    });
  });

  describe("CreepConditions.isEmpty", () => {
    it("should return true when creep is empty", () => {
      mockCreep.store = {
        getUsedCapacity: () => 0
      } as Store<Creep, false>;

      expect(CreepConditions.isEmpty(context)).toBe(true);
    });

    it("should return false when creep has energy", () => {
      mockCreep.store = {
        getUsedCapacity: () => 50
      } as Store<Creep, false>;

      expect(CreepConditions.isEmpty(context)).toBe(false);
    });
  });

  describe("CreepConditions.isDamaged", () => {
    it("should return true when creep is damaged", () => {
      mockCreep.hits = 50;
      mockCreep.hitsMax = 100;

      expect(CreepConditions.isDamaged(context)).toBe(true);
    });

    it("should return false when creep is at full health", () => {
      mockCreep.hits = 100;
      mockCreep.hitsMax = 100;

      expect(CreepConditions.isDamaged(context)).toBe(false);
    });
  });

  describe("CreepConditions.hasConstructionSites", () => {
    it("should return true when construction sites exist", () => {
      context.constructionSites = 3;

      expect(CreepConditions.hasConstructionSites(context)).toBe(true);
    });

    it("should return false when no construction sites", () => {
      context.constructionSites = 0;

      expect(CreepConditions.hasConstructionSites(context)).toBe(false);
    });
  });

  describe("CreepConditions.hasRepairTargets", () => {
    it("should return true when damaged structures exist", () => {
      context.damagedStructures = 5;

      expect(CreepConditions.hasRepairTargets(context)).toBe(true);
    });

    it("should return false when no damaged structures", () => {
      context.damagedStructures = 0;

      expect(CreepConditions.hasRepairTargets(context)).toBe(false);
    });
  });

  describe("CreepConditions.enemiesNearby", () => {
    it("should return true when enemies are nearby", () => {
      context.nearbyEnemies = true;

      expect(CreepConditions.enemiesNearby(context)).toBe(true);
    });

    it("should return false when no enemies nearby", () => {
      context.nearbyEnemies = false;

      expect(CreepConditions.enemiesNearby(context)).toBe(false);
    });
  });

  describe("CreepConditions.hasEnergySources", () => {
    it("should return true when energy is available", () => {
      context.energyAvailable = true;

      expect(CreepConditions.hasEnergySources(context)).toBe(true);
    });

    it("should return false when no energy available", () => {
      context.energyAvailable = false;

      expect(CreepConditions.hasEnergySources(context)).toBe(false);
    });
  });
});
