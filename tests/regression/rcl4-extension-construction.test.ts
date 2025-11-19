/**
 * Regression test for RCL 4 extension construction completion
 *
 * Root Cause: ConstructionManager only creates 1 construction site per tick
 * and marks RCL as "planned" even when structures remain missing, preventing
 * all 20 extensions from being built at RCL 4.
 *
 * Expected Behavior: ConstructionManager should continue planning construction
 * sites on subsequent ticks until all planned structures are built or queued.
 *
 * Related Issue: ralphschuler/.screeps-gpt#924
 * Phase: Phase 1 Infrastructure Completion
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConstructionManager } from "../../packages/bot/src/runtime/planning/ConstructionManager";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock Screeps constants
const FIND_MY_SPAWNS = 104 as FindConstant;
const FIND_STRUCTURES = 107 as FindConstant;
const FIND_MY_CONSTRUCTION_SITES = 114 as FindConstant;
const OK = 0;
const ERR_FULL = -8;
const ERR_RCL_NOT_ENOUGH = -14;

interface MockStructure {
  structureType: string;
  pos: { x: number; y: number };
}

interface MockConstructionSite {
  structureType: string;
  pos: { x: number; y: number };
}

/**
 * Create a mock RoomTerrain with no walls
 */
function createMockTerrain(): RoomTerrain {
  return {
    get: vi.fn(() => 0) // Return 0 (plain terrain) for all positions
  } as unknown as RoomTerrain;
}

/**
 * Create a mock Room for testing
 */
function createMockRoom(
  roomName: string,
  rcl: number,
  existingStructures: MockStructure[] = [],
  existingConstructionSites: MockConstructionSite[] = []
): any {
  const structures = [
    ...existingStructures,
    // Always include a spawn as anchor
    {
      structureType: "spawn",
      pos: { x: 25, y: 25 }
    }
  ];

  const constructionSites = [...existingConstructionSites];
  const createdSites: MockConstructionSite[] = [];

  return {
    name: roomName,
    controller: {
      my: true,
      level: rcl
    },
    getTerrain: vi.fn(() => createMockTerrain()),
    find: vi.fn((type: number) => {
      if (type === FIND_MY_SPAWNS) {
        return structures.filter(s => s.structureType === "spawn");
      }
      if (type === FIND_STRUCTURES) {
        return structures;
      }
      if (type === FIND_MY_CONSTRUCTION_SITES) {
        return [...constructionSites, ...createdSites];
      }
      return [];
    }),
    createConstructionSite: vi.fn((x: number, y: number, structureType: string) => {
      // Check if already exists
      const exists = structures.some(s => s.pos.x === x && s.pos.y === y && s.structureType === structureType);
      if (exists) {
        return ERR_FULL;
      }

      const siteExists = [...constructionSites, ...createdSites].some(
        s => s.pos.x === x && s.pos.y === y && s.structureType === structureType
      );
      if (siteExists) {
        return ERR_FULL;
      }

      // Simulate successful creation
      createdSites.push({
        structureType,
        pos: { x, y }
      });
      return OK;
    })
  };
}

/**
 * Create a mock GameContext
 */
function createMockGame(rooms: Record<string, any>): any {
  return {
    rooms
  };
}

describe("RCL 4 Extension Construction Regression", () => {
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      log: vi.fn(),
      warn: vi.fn()
    };
  });

  describe("Multi-tick Construction Planning", () => {
    it("should continue planning across ticks until all RCL 4 extensions are queued", () => {
      // Create room at RCL 4 with spawn only
      const room = createMockRoom("W1N1", 4);
      const game = createMockGame({ W1N1: room });

      // Create ConstructionManager with maxSitesPerTick = 1 (old default behavior)
      const manager = new ConstructionManager(
        mockLogger,
        1, // maxSitesPerTick
        1, // maxSitesPerRoom
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        OK,
        ERR_FULL,
        ERR_RCL_NOT_ENOUGH
      );

      // Simulate multiple ticks of construction planning
      let totalSitesCreated = 0;
      const maxTicks = 100; // Safety limit

      for (let tick = 0; tick < maxTicks; tick++) {
        const sitesThisTick = manager.planConstructionSites(game);
        totalSitesCreated += sitesThisTick;

        // If no sites created this tick, we should be done
        if (sitesThisTick === 0) {
          break;
        }
      }

      // At RCL 4, we should have:
      // - 5 extensions (RCL 2)
      // - 5 extensions (RCL 3)
      // - 10 extensions (RCL 4)
      // - 1 container (RCL 2)
      // - 1 tower (RCL 3)
      // - 1 storage (RCL 4)
      // Total: 23 structures minimum

      // The critical assertion: all 20 extensions should be planned
      const extensionSites = room
        .find(FIND_MY_CONSTRUCTION_SITES)
        .filter((s: MockConstructionSite) => s.structureType === "extension");

      expect(extensionSites.length).toBeGreaterThanOrEqual(20);
      expect(totalSitesCreated).toBeGreaterThan(1); // Should take multiple ticks
    });

    it("should handle existing structures and only plan missing ones", () => {
      // Create room at RCL 4 with 15 extensions already built
      const existingExtensions: MockStructure[] = [];
      for (let i = 0; i < 15; i++) {
        existingExtensions.push({
          structureType: "extension",
          pos: { x: 20 + i, y: 20 }
        });
      }

      const room = createMockRoom("W1N1", 4, existingExtensions);
      const game = createMockGame({ W1N1: room });

      const manager = new ConstructionManager(
        mockLogger,
        1,
        1,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        OK,
        ERR_FULL,
        ERR_RCL_NOT_ENOUGH
      );

      // Plan construction over multiple ticks
      let totalSitesCreated = 0;
      for (let tick = 0; tick < 100; tick++) {
        const sitesThisTick = manager.planConstructionSites(game);
        totalSitesCreated += sitesThisTick;
        if (sitesThisTick === 0) break;
      }

      // Should create sites for remaining 5 extensions plus other structures
      expect(totalSitesCreated).toBeGreaterThanOrEqual(5);

      // Verify extensions specifically
      const extensionSites = room
        .find(FIND_MY_CONSTRUCTION_SITES)
        .filter((s: MockConstructionSite) => s.structureType === "extension");

      // Should have 5 new extension construction sites (to reach 20 total)
      expect(extensionSites.length).toBeGreaterThanOrEqual(5);
    });

    it("should stop planning when all RCL structures exist or are queued", () => {
      // Create room with all RCL 4 structures already built
      const room = createMockRoom("W1N1", 4);
      const game = createMockGame({ W1N1: room });

      const manager = new ConstructionManager(
        mockLogger,
        1,
        1,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        OK,
        ERR_FULL,
        ERR_RCL_NOT_ENOUGH
      );

      // First pass: create all construction sites
      let totalSites = 0;
      for (let tick = 0; tick < 100; tick++) {
        const sites = manager.planConstructionSites(game);
        totalSites += sites;
        if (sites === 0) break;
      }

      // Record how many sites were created initially
      const initialSiteCount = totalSites;

      // Now simulate all construction sites being built
      const allSites = room.find(FIND_MY_CONSTRUCTION_SITES);
      const newStructures = allSites.map((site: MockConstructionSite) => ({
        structureType: site.structureType,
        pos: site.pos
      }));

      // Create new room with all structures built
      const roomWithStructures = createMockRoom("W1N1", 4, newStructures);
      const gameWithStructures = createMockGame({ W1N1: roomWithStructures });

      // Second pass: should not create any new sites
      const sitesAfterBuild = manager.planConstructionSites(gameWithStructures);

      expect(sitesAfterBuild).toBe(0);
      expect(initialSiteCount).toBeGreaterThan(0);
    });
  });

  describe("RCL Transition Handling", () => {
    it("should replan when RCL increases from 3 to 4", () => {
      // Start at RCL 3 with all RCL 3 structures
      const room = createMockRoom("W1N1", 3);
      const game = createMockGame({ W1N1: room });

      const manager = new ConstructionManager(
        mockLogger,
        1,
        1,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        OK,
        ERR_FULL,
        ERR_RCL_NOT_ENOUGH
      );

      // Plan at RCL 3
      for (let tick = 0; tick < 50; tick++) {
        const sites = manager.planConstructionSites(game);
        if (sites === 0) break;
      }

      const rcl3Sites = room.find(FIND_MY_CONSTRUCTION_SITES).length;

      // Upgrade to RCL 4
      room.controller.level = 4;

      // Plan at RCL 4 - should create more sites
      let rcl4SitesCreated = 0;
      for (let tick = 0; tick < 50; tick++) {
        const sites = manager.planConstructionSites(game);
        rcl4SitesCreated += sites;
        if (sites === 0) break;
      }

      expect(rcl4SitesCreated).toBeGreaterThan(0);
      expect(room.find(FIND_MY_CONSTRUCTION_SITES).length).toBeGreaterThan(rcl3Sites);
    });
  });

  describe("Construction Site Limits", () => {
    it("should respect maxSitesPerTick parameter", () => {
      const room = createMockRoom("W1N1", 4);
      const game = createMockGame({ W1N1: room });

      // Create manager with maxSitesPerTick = 3 and maxSitesPerRoom = 3
      const manager = new ConstructionManager(
        mockLogger,
        3, // maxSitesPerTick
        3, // maxSitesPerRoom - allow 3 sites from single room
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        OK,
        ERR_FULL,
        ERR_RCL_NOT_ENOUGH
      );

      // First tick should create exactly 3 sites
      const sitesFirstTick = manager.planConstructionSites(game);
      expect(sitesFirstTick).toBe(3);

      // Second tick should create more (up to 3)
      const sitesSecondTick = manager.planConstructionSites(game);
      expect(sitesSecondTick).toBeGreaterThan(0);
      expect(sitesSecondTick).toBeLessThanOrEqual(3);
    });
  });

  describe("Edge Cases", () => {
    it("should handle room with no controller", () => {
      const room = createMockRoom("W1N1", 4);
      room.controller = undefined;
      const game = createMockGame({ W1N1: room });

      const manager = new ConstructionManager(mockLogger);
      const sites = manager.planConstructionSites(game);

      expect(sites).toBe(0);
    });

    it("should handle room that is not owned", () => {
      const room = createMockRoom("W1N1", 4);
      room.controller.my = false;
      const game = createMockGame({ W1N1: room });

      const manager = new ConstructionManager(mockLogger);
      const sites = manager.planConstructionSites(game);

      expect(sites).toBe(0);
    });

    it("should handle multiple rooms correctly", () => {
      const room1 = createMockRoom("W1N1", 4);
      const room2 = createMockRoom("W2N2", 3);
      const game = createMockGame({ W1N1: room1, W2N2: room2 });

      const manager = new ConstructionManager(
        mockLogger,
        1,
        1,
        FIND_MY_SPAWNS,
        FIND_STRUCTURES,
        FIND_MY_CONSTRUCTION_SITES,
        OK,
        ERR_FULL,
        ERR_RCL_NOT_ENOUGH
      );

      // Should plan for first room only (due to maxSitesPerTick = 1 and break)
      const sites = manager.planConstructionSites(game);
      expect(sites).toBe(1);
    });
  });
});
