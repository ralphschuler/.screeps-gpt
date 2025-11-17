import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConstructionManager } from "@runtime/planning/ConstructionManager";
import type { GameContext } from "@runtime/types/GameContext";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock constants for tests
const FIND_MY_SPAWNS = 104 as FindConstant;
const FIND_STRUCTURES = 107 as FindConstant;
const FIND_MY_CONSTRUCTION_SITES = 114 as FindConstant;
const ERR_INVALID_TARGET = -7;
const ERR_FULL = -8;
const ERR_RCL_NOT_ENOUGH = -14;
const OK = 0;

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

describe("ConstructionManager", () => {
  let logger: any;

  beforeEach(() => {
    logger = {
      log: vi.fn(),
      warn: vi.fn()
    };
  });

  describe("planConstructionSites", () => {
    it("should skip rooms without controllers", () => {
      const manager = new ConstructionManager(
        logger,
        1,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        OK,
        ERR_FULL,
        ERR_RCL_NOT_ENOUGH
      );
      const room = createMockRoom("W0N0", 2, false);
      const game = createGameContext([room]);

      const created = manager.planConstructionSites(game);

      expect(created).toBe(0);
      expect(room.createConstructionSite).not.toHaveBeenCalled();
    });

    it("should create construction sites for owned rooms", () => {
      const manager = new ConstructionManager(
        logger,
        1,
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

      expect(created).toBeGreaterThan(0);
      expect(room.createConstructionSite).toHaveBeenCalled();
    });

    it("should respect maxSitesPerTick limit", () => {
      const maxSites = 2;
      const manager = new ConstructionManager(
        logger,
        maxSites,
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

      expect(created).toBeLessThanOrEqual(maxSites);
    });

    it("should log when construction site is created", () => {
      const manager = new ConstructionManager(
        logger,
        1,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        OK,
        ERR_FULL,
        ERR_RCL_NOT_ENOUGH
      );
      const room = createMockRoom("W0N0", 2, true);
      const game = createGameContext([room]);

      manager.planConstructionSites(game);

      expect(logger.log).toHaveBeenCalled();
      const logMessage = logger.log.mock.calls[0][0];
      expect(logMessage).toContain("ConstructionManager");
      expect(logMessage).toContain("W0N0");
    });

    it("should handle creation errors gracefully", () => {
      const manager = new ConstructionManager(
        logger,
        1,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        OK,
        ERR_FULL,
        ERR_RCL_NOT_ENOUGH
      );
      const room = createMockRoom("W0N0", 2, true);
      room.createConstructionSite = vi.fn(() => ERR_INVALID_TARGET);
      const game = createGameContext([room]);

      const created = manager.planConstructionSites(game);

      expect(created).toBe(0);
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should not log for ERR_FULL errors", () => {
      const manager = new ConstructionManager(
        logger,
        1,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        OK,
        ERR_FULL,
        ERR_RCL_NOT_ENOUGH
      );
      const room = createMockRoom("W0N0", 2, true);
      room.createConstructionSite = vi.fn(() => ERR_FULL);
      const game = createGameContext([room]);

      manager.planConstructionSites(game);

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("should not log for ERR_RCL_NOT_ENOUGH errors", () => {
      const manager = new ConstructionManager(
        logger,
        1,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        OK,
        ERR_FULL,
        ERR_RCL_NOT_ENOUGH
      );
      const room = createMockRoom("W0N0", 2, true);
      room.createConstructionSite = vi.fn(() => ERR_RCL_NOT_ENOUGH);
      const game = createGameContext([room]);

      manager.planConstructionSites(game);

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("should handle multiple rooms", () => {
      const manager = new ConstructionManager(
        logger,
        10,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        OK,
        ERR_FULL,
        ERR_RCL_NOT_ENOUGH
      );
      const room1 = createMockRoom("W0N0", 2, true);
      const room2 = createMockRoom("W1N1", 3, true);
      const game = createGameContext([room1, room2]);

      manager.planConstructionSites(game);

      expect(room1.createConstructionSite).toHaveBeenCalled();
      expect(room2.createConstructionSite).toHaveBeenCalled();
    });

    it("should continue planning at same RCL until all structures are queued", () => {
      const manager = new ConstructionManager(
        logger,
        1,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        OK,
        ERR_FULL,
        ERR_RCL_NOT_ENOUGH
      );
      const room = createMockRoom("W0N0", 2, true);
      const game = createGameContext([room]);

      // First tick
      const created1 = manager.planConstructionSites(game);
      expect(created1).toBeGreaterThan(0);

      // Reset mock
      room.createConstructionSite.mockClear();

      // Second tick with same RCL - should continue planning
      const created2 = manager.planConstructionSites(game);
      // Should create more sites until all structures are planned
      expect(created2).toBeGreaterThanOrEqual(0);

      // Continue until all structures are planned
      let totalCreated = created1 + created2;
      let tick = 3;
      while (tick < 100) {
        const created = manager.planConstructionSites(game);
        totalCreated += created;
        if (created === 0) {
          break; // All structures planned
        }
        tick++;
      }

      // Should have created multiple structures across ticks
      expect(totalCreated).toBeGreaterThan(1);
    });

    it("should replan when RCL changes", () => {
      const manager = new ConstructionManager(
        logger,
        1,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        OK,
        ERR_FULL,
        ERR_RCL_NOT_ENOUGH
      );
      const room = createMockRoom("W0N0", 2, true);
      const game = createGameContext([room]);

      // First tick at RCL 2
      manager.planConstructionSites(game);

      // Upgrade to RCL 3
      room.controller.level = 3;

      // Should plan again
      const created = manager.planConstructionSites(game);
      expect(created).toBeGreaterThan(0);
    });
  });

  describe("resetRoom", () => {
    it("should clear room planning state", () => {
      const manager = new ConstructionManager(
        logger,
        1,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        OK,
        ERR_FULL,
        ERR_RCL_NOT_ENOUGH
      );
      const room = createMockRoom("W0N0", 2, true);
      const game = createGameContext([room]);

      // Plan once
      manager.planConstructionSites(game);

      // Reset
      manager.resetRoom("W0N0");

      // Should plan again even at same RCL
      const created = manager.planConstructionSites(game);
      expect(created).toBeGreaterThan(0);
    });
  });
});
