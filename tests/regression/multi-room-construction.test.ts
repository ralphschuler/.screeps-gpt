import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConstructionManager } from "@runtime/planning/ConstructionManager";
import type { GameContext } from "@runtime/types/GameContext";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Regression test for issue #632:
 * ConstructionManager maxSitesPerTick=1 bottlenecks multi-room expansion
 *
 * This test verifies that:
 * 1. Multiple rooms can create construction sites in the same tick
 * 2. Per-room budget prevents single-room spam
 * 3. Total tick budget is respected across all rooms
 */

// Mock constants for tests
const FIND_MY_SPAWNS = 104 as FindConstant;
const FIND_STRUCTURES = 107 as FindConstant;
const FIND_MY_CONSTRUCTION_SITES = 114 as FindConstant;
const OK = 0;
const ERR_FULL = -8;
const ERR_RCL_NOT_ENOUGH = -14;

function createMockTerrain(): RoomTerrain {
  return {
    get: vi.fn(() => 0)
  } as unknown as RoomTerrain;
}

function createMockRoom(name: string, rcl: number, owned: boolean = true): any {
  return {
    name,
    controller: owned
      ? {
          my: true,
          level: rcl
        }
      : null,
    getTerrain: vi.fn(() => createMockTerrain()),
    createConstructionSite: vi.fn(() => OK),
    find: vi.fn((type: number) => {
      if (type === FIND_MY_SPAWNS) {
        return [{ structureType: "spawn" as const, pos: { x: 25, y: 25 } }];
      }
      if (type === FIND_STRUCTURES) {
        return [];
      }
      if (type === FIND_MY_CONSTRUCTION_SITES) {
        return [];
      }
      return [];
    })
  };
}

function createGameContext(rooms: any[]): GameContext {
  const roomsMap: Record<string, any> = {};
  for (const room of rooms) {
    roomsMap[room.name] = room;
  }

  return {
    time: 1000,
    cpu: { getUsed: () => 0, limit: 10, bucket: 1000 },
    creeps: {},
    spawns: {},
    rooms: roomsMap
  };
}

describe("Multi-room construction planning (regression #632)", () => {
  let logger: any;

  beforeEach(() => {
    logger = {
      log: vi.fn(),
      warn: vi.fn()
    };
  });

  it("should allow multiple rooms to create sites in the same tick", () => {
    // With new defaults: maxSitesPerTick=5, maxSitesPerRoom=1
    const manager = new ConstructionManager(
      logger,
      5, // Total budget
      1, // Per-room budget
      FIND_MY_SPAWNS,
      FIND_STRUCTURES,
      FIND_MY_CONSTRUCTION_SITES,
      OK,
      ERR_FULL,
      ERR_RCL_NOT_ENOUGH
    );

    // Create 5 rooms that need construction
    const rooms = [
      createMockRoom("W0N0", 2, true),
      createMockRoom("W1N1", 2, true),
      createMockRoom("W2N2", 2, true),
      createMockRoom("W3N3", 2, true),
      createMockRoom("W4N4", 2, true)
    ];
    const game = createGameContext(rooms);

    const created = manager.planConstructionSites(game);

    // Should create sites in multiple rooms (up to total budget)
    expect(created).toBe(5);

    // Each room should get exactly 1 site (per-room limit)
    for (const room of rooms) {
      expect(room.createConstructionSite).toHaveBeenCalledTimes(1);
    }
  });

  it("should respect per-room budget to prevent single-room spam", () => {
    const manager = new ConstructionManager(
      logger,
      10, // High total budget
      2, // Per-room budget = 2
      FIND_MY_SPAWNS,
      FIND_STRUCTURES,
      FIND_MY_CONSTRUCTION_SITES,
      OK,
      ERR_FULL,
      ERR_RCL_NOT_ENOUGH
    );

    const room = createMockRoom("W0N0", 2, true);
    const game = createGameContext([room]);

    const created = manager.planConstructionSites(game);

    // Should create at most 2 sites per room (per-room limit)
    expect(created).toBeLessThanOrEqual(2);
    expect(room.createConstructionSite.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("should respect total tick budget across all rooms", () => {
    const manager = new ConstructionManager(
      logger,
      3, // Total budget = 3
      1, // Per-room budget = 1 (easier to test exact counts)
      FIND_MY_SPAWNS,
      FIND_STRUCTURES,
      FIND_MY_CONSTRUCTION_SITES,
      OK,
      ERR_FULL,
      ERR_RCL_NOT_ENOUGH
    );

    // Create 5 rooms that need construction
    const rooms = [
      createMockRoom("W0N0", 2, true),
      createMockRoom("W1N1", 2, true),
      createMockRoom("W2N2", 2, true),
      createMockRoom("W3N3", 2, true),
      createMockRoom("W4N4", 2, true)
    ];
    const game = createGameContext(rooms);

    const created = manager.planConstructionSites(game);

    // Should create at most 3 sites total (total budget)
    expect(created).toBe(3);

    // Exactly 3 rooms should get sites (one site per room with per-room budget = 1)
    const roomsWithSites = rooms.filter(r => r.createConstructionSite.mock.calls.length > 0);
    expect(roomsWithSites.length).toBe(3);
  });

  it("should scale better than old default (maxSitesPerTick=1)", () => {
    // Old behavior: maxSitesPerTick=1, no per-room limit
    const oldManager = new ConstructionManager(
      logger,
      1, // Old default
      1,
      FIND_MY_SPAWNS,
      FIND_STRUCTURES,
      FIND_MY_CONSTRUCTION_SITES,
      OK,
      ERR_FULL,
      ERR_RCL_NOT_ENOUGH
    );

    // New behavior: maxSitesPerTick=5, maxSitesPerRoom=1
    const newManager = new ConstructionManager(
      logger,
      5, // New default
      1,
      FIND_MY_SPAWNS,
      FIND_STRUCTURES,
      FIND_MY_CONSTRUCTION_SITES,
      OK,
      ERR_FULL,
      ERR_RCL_NOT_ENOUGH
    );

    // Create 5 rooms that need construction
    const roomsOld = [
      createMockRoom("W0N0", 2, true),
      createMockRoom("W1N1", 2, true),
      createMockRoom("W2N2", 2, true),
      createMockRoom("W3N3", 2, true),
      createMockRoom("W4N4", 2, true)
    ];

    const roomsNew = [
      createMockRoom("W0N0", 2, true),
      createMockRoom("W1N1", 2, true),
      createMockRoom("W2N2", 2, true),
      createMockRoom("W3N3", 2, true),
      createMockRoom("W4N4", 2, true)
    ];

    const gameOld = createGameContext(roomsOld);
    const gameNew = createGameContext(roomsNew);

    const createdOld = oldManager.planConstructionSites(gameOld);
    const createdNew = newManager.planConstructionSites(gameNew);

    // Old behavior: only 1 site per tick
    expect(createdOld).toBe(1);

    // New behavior: up to 5 sites per tick
    expect(createdNew).toBe(5);

    // New behavior should create 5x more sites per tick
    expect(createdNew).toBe(createdOld * 5);
  });

  it("should not exceed global construction site limit (100)", () => {
    const manager = new ConstructionManager(
      logger,
      100, // Try to create many sites
      10,
      FIND_MY_SPAWNS,
      FIND_STRUCTURES,
      FIND_MY_CONSTRUCTION_SITES,
      OK,
      ERR_FULL,
      ERR_RCL_NOT_ENOUGH
    );

    // Create 10 rooms
    const rooms = Array.from({ length: 10 }, (_, i) => createMockRoom(`W${i}N${i}`, 2, true));
    const game = createGameContext(rooms);

    const created = manager.planConstructionSites(game);

    // Should not exceed reasonable limits per tick
    // (in practice, BasePlanner and RCL progression naturally limit this)
    expect(created).toBeLessThanOrEqual(100);
  });
});
