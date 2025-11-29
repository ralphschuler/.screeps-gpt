import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  conditions,
  hasEnergy,
  isFull,
  isEmpty,
  hasFreeCapacity,
  hasCapacityPercent,
  isDamaged,
  isHealthBelow,
  hasBodyPart,
  hasWorkParts,
  hasCarryParts,
  hasRoleType,
  hasConstructionSites,
  hasRepairTargets,
  enemiesNearby,
  hasEnergySources
} from "../../../src/screeps/conditions.js";
import type { CreepDecisionContext } from "../../../src/screeps/types.js";

// Mock constants
const WORK = "work";
const CARRY = "carry";
const MOVE = "move";

(global as Record<string, unknown>).WORK = WORK;
(global as Record<string, unknown>).CARRY = CARRY;
(global as Record<string, unknown>).MOVE = MOVE;
(global as Record<string, unknown>).RESOURCE_ENERGY = "energy";

describe("Xtree Conditions", () => {
  let mockCreep: Partial<Creep>;
  let ctx: CreepDecisionContext;

  beforeEach(() => {
    mockCreep = {
      store: {
        getUsedCapacity: vi.fn().mockReturnValue(50),
        getFreeCapacity: vi.fn().mockReturnValue(50),
        getCapacity: vi.fn().mockReturnValue(100)
      } as unknown as Store<Creep, false>,
      body: [{ type: WORK as BodyPartConstant, hits: 100 }],
      hits: 100,
      hitsMax: 100,
      spawning: false,
      memory: {} as CreepMemory
    };
    ctx = {
      creep: mockCreep as Creep,
      room: {} as Room,
      energyAvailable: true,
      nearbyEnemies: false,
      constructionSites: 0,
      damagedStructures: 0
    };
  });

  describe("conditions registry", () => {
    it("should export all conditions", () => {
      expect(conditions).toBeDefined();
      expect(conditions.hasEnergy).toBe(hasEnergy);
      expect(conditions.isFull).toBe(isFull);
      expect(conditions.isEmpty).toBe(isEmpty);
      expect(conditions.hasFreeCapacity).toBe(hasFreeCapacity);
      expect(conditions.isDamaged).toBe(isDamaged);
    });
  });

  describe("Energy conditions", () => {
    it("hasEnergy returns true when creep has energy above threshold", () => {
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(60);
      expect(hasEnergy(50)(ctx)).toBe(true);
    });

    it("hasEnergy returns false when creep has energy at or below threshold", () => {
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(50);
      expect(hasEnergy(50)(ctx)).toBe(false);
    });

    it("isFull returns true when creep has no free capacity", () => {
      (mockCreep.store!.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
      expect(isFull(ctx)).toBe(true);
    });

    it("isFull returns false when creep has free capacity", () => {
      (mockCreep.store!.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(50);
      expect(isFull(ctx)).toBe(false);
    });

    it("isEmpty returns true when creep has no energy", () => {
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
      expect(isEmpty(ctx)).toBe(true);
    });

    it("isEmpty returns false when creep has energy", () => {
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(50);
      expect(isEmpty(ctx)).toBe(false);
    });

    it("hasFreeCapacity returns true when creep has free capacity", () => {
      (mockCreep.store!.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(50);
      expect(hasFreeCapacity(ctx)).toBe(true);
    });

    it("hasFreeCapacity returns false when creep has no free capacity", () => {
      (mockCreep.store!.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
      expect(hasFreeCapacity(ctx)).toBe(false);
    });

    it("hasCapacityPercent returns true when at specified percentage", () => {
      (mockCreep.store!.getCapacity as ReturnType<typeof vi.fn>).mockReturnValue(100);
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(75);
      expect(hasCapacityPercent(50)(ctx)).toBe(true);
    });

    it("hasCapacityPercent returns false when below specified percentage", () => {
      (mockCreep.store!.getCapacity as ReturnType<typeof vi.fn>).mockReturnValue(100);
      (mockCreep.store!.getUsedCapacity as ReturnType<typeof vi.fn>).mockReturnValue(25);
      expect(hasCapacityPercent(50)(ctx)).toBe(false);
    });
  });

  describe("Creep conditions", () => {
    it("isDamaged returns true when creep is damaged", () => {
      mockCreep.hits = 50;
      mockCreep.hitsMax = 100;
      expect(isDamaged(ctx)).toBe(true);
    });

    it("isDamaged returns false when creep is at full health", () => {
      mockCreep.hits = 100;
      mockCreep.hitsMax = 100;
      expect(isDamaged(ctx)).toBe(false);
    });

    it("isHealthBelow returns true when health is below percentage", () => {
      mockCreep.hits = 25;
      mockCreep.hitsMax = 100;
      expect(isHealthBelow(30)(ctx)).toBe(true);
    });

    it("isHealthBelow returns false when health is at or above percentage", () => {
      mockCreep.hits = 50;
      mockCreep.hitsMax = 100;
      expect(isHealthBelow(30)(ctx)).toBe(false);
    });

    it("hasBodyPart returns true when creep has the body part", () => {
      mockCreep.body = [{ type: WORK as BodyPartConstant, hits: 100 }];
      expect(hasBodyPart(WORK as BodyPartConstant)(ctx)).toBe(true);
    });

    it("hasBodyPart returns false when creep does not have the body part", () => {
      mockCreep.body = [{ type: CARRY as BodyPartConstant, hits: 100 }];
      expect(hasBodyPart(WORK as BodyPartConstant)(ctx)).toBe(false);
    });

    it("hasWorkParts returns true when creep has WORK parts", () => {
      mockCreep.body = [{ type: WORK as BodyPartConstant, hits: 100 }];
      expect(hasWorkParts(ctx)).toBe(true);
    });

    it("hasCarryParts returns true when creep has CARRY parts", () => {
      mockCreep.body = [{ type: CARRY as BodyPartConstant, hits: 100 }];
      expect(hasCarryParts(ctx)).toBe(true);
    });

    it("hasRoleType returns true when creep has the specified role", () => {
      mockCreep.memory = { role: "harvester" } as unknown as CreepMemory;
      expect(hasRoleType("harvester")(ctx)).toBe(true);
    });

    it("hasRoleType returns false when creep has a different role", () => {
      mockCreep.memory = { role: "harvester" } as unknown as CreepMemory;
      expect(hasRoleType("upgrader")(ctx)).toBe(false);
    });
  });

  describe("Room conditions", () => {
    it("hasConstructionSites returns true when construction sites exist", () => {
      ctx.constructionSites = 3;
      expect(hasConstructionSites(ctx)).toBe(true);
    });

    it("hasConstructionSites returns false when no construction sites", () => {
      ctx.constructionSites = 0;
      expect(hasConstructionSites(ctx)).toBe(false);
    });

    it("hasRepairTargets returns true when damaged structures exist", () => {
      ctx.damagedStructures = 5;
      expect(hasRepairTargets(ctx)).toBe(true);
    });

    it("hasRepairTargets returns false when no damaged structures", () => {
      ctx.damagedStructures = 0;
      expect(hasRepairTargets(ctx)).toBe(false);
    });

    it("enemiesNearby returns true when enemies are nearby", () => {
      ctx.nearbyEnemies = true;
      expect(enemiesNearby(ctx)).toBe(true);
    });

    it("enemiesNearby returns false when no enemies nearby", () => {
      ctx.nearbyEnemies = false;
      expect(enemiesNearby(ctx)).toBe(false);
    });

    it("hasEnergySources returns true when energy is available", () => {
      ctx.energyAvailable = true;
      expect(hasEnergySources(ctx)).toBe(true);
    });

    it("hasEnergySources returns false when no energy available", () => {
      ctx.energyAvailable = false;
      expect(hasEnergySources(ctx)).toBe(false);
    });
  });
});
