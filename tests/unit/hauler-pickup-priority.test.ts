import { describe, expect, it, vi, beforeEach } from "vitest";
import { tryPickupDroppedEnergy } from "@runtime/behavior/controllers/helpers";
import type { CreepLike, PositionLike, RoomLike } from "@runtime/types/GameContext";

// Set up global Screeps constants before tests
beforeEach(() => {
  (globalThis as typeof globalThis & Record<string, unknown>).FIND_DROPPED_RESOURCES = 107 as FindConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).RESOURCE_ENERGY = "energy" as ResourceConstant;
  (globalThis as typeof globalThis & Record<string, unknown>).ERR_NOT_IN_RANGE = -9 as ScreepsReturnCode;
  (globalThis as typeof globalThis & Record<string, unknown>).OK = 0 as ScreepsReturnCode;
});

/**
 * Helper to create a mock dropped energy resource
 */
function createMockResource(id: string, amount: number, pos: { x: number; y: number }): Resource {
  return {
    id: id as Id<Resource>,
    resourceType: RESOURCE_ENERGY,
    amount,
    pos: { x: pos.x, y: pos.y } as RoomPosition
  } as Resource;
}

/**
 * Helper to create a mock creep with configurable position and room
 */
function createMockCreep(
  droppedResources: Resource[],
  creepPos: { x: number; y: number } = { x: 25, y: 25 },
  freeCapacity = 400
): CreepLike & { lastPickupTarget: Resource | null } {
  let lastPickupTarget: Resource | null = null;

  const room: RoomLike = {
    name: "W1N1",
    controller: null,
    find: (type: FindConstant, opts?: { filter?: (object: unknown) => boolean }) => {
      if (type === FIND_DROPPED_RESOURCES) {
        // Apply the filter if provided
        if (opts?.filter) {
          return droppedResources.filter(opts.filter);
        }
        return droppedResources;
      }
      return [];
    },
    findPath: () => [],
    createConstructionSite: () => OK,
    getTerrain: () => ({ get: () => 0 }) as unknown as RoomTerrain
  };

  const pos: PositionLike = {
    findClosestByPath: vi.fn(() => null),
    inRangeTo: vi.fn(() => false),
    findInRange: vi.fn(() => []),
    getRangeTo: vi.fn((target: RoomPosition | { pos: RoomPosition }) => {
      const targetPos = "pos" in target ? target.pos : target;
      return Math.abs(targetPos.x - creepPos.x) + Math.abs(targetPos.y - creepPos.y);
    })
  };

  const creep: CreepLike & { lastPickupTarget: Resource | null } = {
    name: "hauler-test",
    memory: { role: "hauler" } as CreepMemory,
    store: {
      getUsedCapacity: vi.fn(() => 400 - freeCapacity),
      getFreeCapacity: vi.fn(() => freeCapacity)
    },
    pos,
    room,
    harvest: vi.fn(() => OK),
    transfer: vi.fn(() => OK),
    moveTo: vi.fn(() => OK),
    upgradeController: vi.fn(() => OK),
    withdraw: vi.fn(() => OK),
    build: vi.fn(() => OK),
    repair: vi.fn(() => OK),
    pickup: vi.fn((target: Resource) => {
      lastPickupTarget = target;
      return ERR_NOT_IN_RANGE;
    }),
    drop: vi.fn(() => OK),
    lastPickupTarget: null,
    get lastTarget() {
      return lastPickupTarget;
    }
  };

  // Update lastPickupTarget getter dynamically
  Object.defineProperty(creep, "lastPickupTarget", {
    get: () => lastPickupTarget
  });

  return creep;
}

describe("tryPickupDroppedEnergy - Pickup Priority", () => {
  describe("Amount-based prioritization", () => {
    it("should prioritize large energy piles over closer small piles", () => {
      // Large pile far away (200 energy at distance 20)
      const largePile = createMockResource("large", 200, { x: 45, y: 25 });
      // Small pile close by (30 energy at distance 5)
      const smallPile = createMockResource("small", 30, { x: 30, y: 25 });

      const creep = createMockCreep([largePile, smallPile], { x: 25, y: 25 });

      const result = tryPickupDroppedEnergy(creep, 10, 100);

      expect(result).toBe(true);
      expect(creep.pickup).toHaveBeenCalledWith(largePile);
    });

    it("should prioritize highest amount when multiple piles above threshold", () => {
      // Three piles above threshold, different amounts
      const pile1 = createMockResource("pile1", 150, { x: 30, y: 25 }); // 5 dist
      const pile2 = createMockResource("pile2", 300, { x: 45, y: 25 }); // 20 dist
      const pile3 = createMockResource("pile3", 200, { x: 35, y: 25 }); // 10 dist

      const creep = createMockCreep([pile1, pile2, pile3], { x: 25, y: 25 });

      tryPickupDroppedEnergy(creep, 10, 100);

      // Should pick the largest pile (300 energy)
      expect(creep.pickup).toHaveBeenCalledWith(pile2);
    });

    it("should use distance as tiebreaker for similar amounts", () => {
      // Two piles with similar amounts (within 50 energy)
      const farPile = createMockResource("far", 120, { x: 45, y: 25 }); // 20 dist
      const closePile = createMockResource("close", 100, { x: 30, y: 25 }); // 5 dist

      const creep = createMockCreep([farPile, closePile], { x: 25, y: 25 });

      tryPickupDroppedEnergy(creep, 10, 100);

      // Should pick the closer pile since amounts are within 50
      expect(creep.pickup).toHaveBeenCalledWith(closePile);
    });
  });

  describe("Threshold filtering", () => {
    it("should ignore piles below minimum amount", () => {
      const smallPile = createMockResource("small", 5, { x: 26, y: 25 }); // Below 10 threshold

      const creep = createMockCreep([smallPile], { x: 25, y: 25 });

      const result = tryPickupDroppedEnergy(creep, 10, 100);

      expect(result).toBe(false);
      expect(creep.pickup).not.toHaveBeenCalled();
    });

    it("should pick up piles at exactly minimum amount", () => {
      const minPile = createMockResource("min", 10, { x: 26, y: 25 });

      const creep = createMockCreep([minPile], { x: 25, y: 25 });

      const result = tryPickupDroppedEnergy(creep, 10, 100);

      expect(result).toBe(true);
      expect(creep.pickup).toHaveBeenCalledWith(minPile);
    });
  });

  describe("Capacity checks", () => {
    it("should not attempt pickup when creep is at full capacity", () => {
      const pile = createMockResource("pile", 100, { x: 26, y: 25 });

      const creep = createMockCreep([pile], { x: 25, y: 25 }, 0); // No free capacity

      const result = tryPickupDroppedEnergy(creep, 10, 100);

      expect(result).toBe(false);
      expect(creep.pickup).not.toHaveBeenCalled();
    });

    it("should attempt pickup when creep has partial capacity", () => {
      const pile = createMockResource("pile", 100, { x: 26, y: 25 });

      const creep = createMockCreep([pile], { x: 25, y: 25 }, 50); // Partial capacity

      const result = tryPickupDroppedEnergy(creep, 10, 100);

      expect(result).toBe(true);
      expect(creep.pickup).toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should return false when no dropped resources exist", () => {
      const creep = createMockCreep([], { x: 25, y: 25 });

      const result = tryPickupDroppedEnergy(creep, 10, 100);

      expect(result).toBe(false);
      expect(creep.pickup).not.toHaveBeenCalled();
    });

    it("should handle single resource correctly", () => {
      const pile = createMockResource("single", 150, { x: 30, y: 25 });

      const creep = createMockCreep([pile], { x: 25, y: 25 });

      const result = tryPickupDroppedEnergy(creep, 10, 100);

      expect(result).toBe(true);
      expect(creep.pickup).toHaveBeenCalledWith(pile);
    });

    it("should prioritize above-threshold pile over larger below-threshold pile when threshold matters", () => {
      // Pile above threshold (105)
      const aboveThreshold = createMockResource("above", 105, { x: 45, y: 25 }); // 20 dist
      // Pile below threshold (95) but larger amount difference
      const belowThreshold = createMockResource("below", 95, { x: 26, y: 25 }); // 1 dist

      const creep = createMockCreep([aboveThreshold, belowThreshold], { x: 25, y: 25 });

      tryPickupDroppedEnergy(creep, 10, 100);

      // Should prioritize the above-threshold pile despite being farther
      expect(creep.pickup).toHaveBeenCalledWith(aboveThreshold);
    });
  });

  describe("Movement behavior", () => {
    it("should move to target when not in range", () => {
      const pile = createMockResource("pile", 150, { x: 30, y: 25 });

      const creep = createMockCreep([pile], { x: 25, y: 25 });
      // Override pickup to return ERR_NOT_IN_RANGE
      (creep.pickup as ReturnType<typeof vi.fn>).mockReturnValue(ERR_NOT_IN_RANGE);

      const result = tryPickupDroppedEnergy(creep, 10, 100);

      expect(result).toBe(true);
      expect(creep.moveTo).toHaveBeenCalledWith(pile, expect.objectContaining({ range: 1 }));
    });
  });
});
