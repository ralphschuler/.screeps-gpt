import { describe, it, expect, beforeEach, vi } from "vitest";
import { EmpireManager } from "@runtime/empire/EmpireManager";
import type { GameContext, RoomLike } from "@runtime/types/GameContext";

/**
 * Regression test for Issue: takeover checks should not add our own rooms to the list
 *
 * Root cause: The takeover target identification logic may incorrectly include
 * our own rooms if:
 * 1. Scout reports include our own rooms with incorrect owner field
 * 2. PLAYER_USERNAME build-time constant doesn't match actual Game.username
 * 3. Room ownership changes between scouting and takeover analysis
 *
 * Remediation: Added additional runtime check using controller.my flag for
 * extra validation in identifyTakeoverTargets method.
 *
 * @see packages/bot/src/runtime/empire/EmpireManager.ts
 */
describe("Takeover target identification regression", () => {
  let memory: Memory;
  let mockGame: GameContext;

  beforeEach(() => {
    memory = {
      empire: {
        lastUpdate: 0,
        cpuBudgets: {},
        threats: [],
        transferHistory: []
      },
      colony: {
        expansionQueue: [],
        claimedRooms: [],
        shardMessages: [],
        lastExpansionCheck: 0
      },
      scout: {
        rooms: {},
        lastUpdate: 0,
        activeScouts: {}
      }
    } as unknown as Memory;

    mockGame = {
      time: 1000,
      cpu: {
        limit: 100,
        bucket: 10000,
        getUsed: () => 10
      },
      gcl: {
        level: 5,
        progress: 1000
      },
      rooms: {}
    } as unknown as GameContext;

    // Reset global Game object for tests
    vi.stubGlobal("Game", {
      time: 1000,
      rooms: {},
      map: {
        findRoute: () => []
      }
    });
  });

  describe("Own room exclusion", () => {
    it("should never add rooms we control to takeover targets via controller.my check", () => {
      const empire = new EmpireManager({ logger: { log: vi.fn(), warn: vi.fn() } });

      // Setup: scout report for a room we own but with mismatched owner field
      // This simulates the case where PLAYER_USERNAME doesn't match the actual owner
      const scoutMemory = memory.scout as { rooms: Record<string, unknown> };
      scoutMemory.rooms["W1N1"] = {
        roomName: "W1N1",
        lastScouted: 900,
        owned: true,
        owner: "SomeOtherPlayer", // Incorrectly reported owner
        controllerLevel: 5,
        sourceCount: 2,
        sources: [],
        hasHostiles: false,
        hostileCount: 0,
        isSourceKeeper: false,
        threatLevel: "low"
      };

      // Mock Game.rooms to indicate we actually own this room
      const mockRoom: Partial<RoomLike> = {
        name: "W1N1",
        controller: {
          my: true, // Key check: we actually own this room
          level: 5,
          owner: { username: "ActualPlayer" }
        } as StructureController,
        find: vi.fn().mockReturnValue([]),
        storage: undefined,
        terminal: undefined
      };

      mockGame.rooms["W1N1"] = mockRoom as RoomLike;
      vi.stubGlobal("Game", {
        time: 1000,
        rooms: mockGame.rooms,
        map: {
          findRoute: () => []
        }
      });

      // Run empire manager
      empire.run(mockGame, memory);

      // Verify: takeover targets should NOT include W1N1
      const takeoverMemory = memory.takeover as { targets: Array<{ roomName: string }> } | undefined;
      const targets = takeoverMemory?.targets ?? [];
      const ownRoomInTargets = targets.find(t => t.roomName === "W1N1");

      expect(ownRoomInTargets).toBeUndefined();
    });

    it("should correctly identify enemy rooms as takeover targets", () => {
      const empire = new EmpireManager({ logger: { log: vi.fn(), warn: vi.fn() } });

      // Setup: scout report for an enemy room
      const scoutMemory = memory.scout as { rooms: Record<string, unknown> };
      scoutMemory.rooms["W2N2"] = {
        roomName: "W2N2",
        lastScouted: 900,
        owned: true,
        owner: "EnemyPlayer",
        controllerLevel: 3,
        sourceCount: 2,
        sources: [],
        hasHostiles: false,
        hostileCount: 0,
        isSourceKeeper: false,
        threatLevel: "low"
      };

      // Add our own room to make empire run
      const ourRoom: Partial<RoomLike> = {
        name: "W1N1",
        controller: {
          my: true,
          level: 5
        } as StructureController,
        find: vi.fn().mockReturnValue([]),
        storage: undefined,
        terminal: undefined
      };

      mockGame.rooms["W1N1"] = ourRoom as RoomLike;

      // Game.rooms does NOT contain W2N2 (not visible)
      vi.stubGlobal("Game", {
        time: 1000,
        rooms: mockGame.rooms,
        map: {
          findRoute: () => []
        }
      });

      empire.run(mockGame, memory);

      // Verify: takeover targets SHOULD include W2N2
      const takeoverMemory = memory.takeover as { targets: Array<{ roomName: string }> } | undefined;
      const targets = takeoverMemory?.targets ?? [];
      const enemyRoomInTargets = targets.find(t => t.roomName === "W2N2");

      expect(enemyRoomInTargets).toBeDefined();
      expect(enemyRoomInTargets?.roomName).toBe("W2N2");
    });

    it("should exclude rooms where PLAYER_USERNAME matches owner", () => {
      const empire = new EmpireManager({ logger: { log: vi.fn(), warn: vi.fn() } });

      // Setup: scout report with owner matching PLAYER_USERNAME
      // PLAYER_USERNAME is set to "ralphschuler" in vitest.config.ts
      const scoutMemory = memory.scout as { rooms: Record<string, unknown> };
      scoutMemory.rooms["W3N3"] = {
        roomName: "W3N3",
        lastScouted: 900,
        owned: true,
        owner: "ralphschuler", // Matches the PLAYER_USERNAME in vitest config
        controllerLevel: 4,
        sourceCount: 1,
        sources: [],
        hasHostiles: false,
        hostileCount: 0,
        isSourceKeeper: false,
        threatLevel: "low"
      };

      const ourRoom: Partial<RoomLike> = {
        name: "W1N1",
        controller: {
          my: true,
          level: 5
        } as StructureController,
        find: vi.fn().mockReturnValue([]),
        storage: undefined,
        terminal: undefined
      };

      mockGame.rooms["W1N1"] = ourRoom as RoomLike;
      vi.stubGlobal("Game", {
        time: 1000,
        rooms: mockGame.rooms,
        map: {
          findRoute: () => []
        }
      });

      empire.run(mockGame, memory);

      // Verify: takeover targets should NOT include W3N3
      const takeoverMemory = memory.takeover as { targets: Array<{ roomName: string }> } | undefined;
      const targets = takeoverMemory?.targets ?? [];
      const matchedRoomInTargets = targets.find(t => t.roomName === "W3N3");

      expect(matchedRoomInTargets).toBeUndefined();
    });

    it("should handle rooms becoming owned between scout and analysis", () => {
      const empire = new EmpireManager({ logger: { log: vi.fn(), warn: vi.fn() } });

      // Setup: scout report for a room that was enemy-owned when scouted
      // but we've since claimed it
      const scoutMemory = memory.scout as { rooms: Record<string, unknown> };
      scoutMemory.rooms["W4N4"] = {
        roomName: "W4N4",
        lastScouted: 500, // Scouted earlier
        owned: true,
        owner: "FormerEnemy", // Was owned by enemy when scouted
        controllerLevel: 2,
        sourceCount: 2,
        sources: [],
        hasHostiles: false,
        hostileCount: 0,
        isSourceKeeper: false,
        threatLevel: "low"
      };

      // Now we own both W1N1 and W4N4
      const ourRoom1: Partial<RoomLike> = {
        name: "W1N1",
        controller: {
          my: true,
          level: 5
        } as StructureController,
        find: vi.fn().mockReturnValue([]),
        storage: undefined,
        terminal: undefined
      };

      const ourRoom2: Partial<RoomLike> = {
        name: "W4N4",
        controller: {
          my: true, // We now control this room
          level: 3
        } as StructureController,
        find: vi.fn().mockReturnValue([]),
        storage: undefined,
        terminal: undefined
      };

      mockGame.rooms["W1N1"] = ourRoom1 as RoomLike;
      mockGame.rooms["W4N4"] = ourRoom2 as RoomLike;
      vi.stubGlobal("Game", {
        time: 1000,
        rooms: mockGame.rooms,
        map: {
          findRoute: () => []
        }
      });

      empire.run(mockGame, memory);

      // Verify: takeover targets should NOT include W4N4
      // even though scout data says it was enemy-owned
      const takeoverMemory = memory.takeover as { targets: Array<{ roomName: string }> } | undefined;
      const targets = takeoverMemory?.targets ?? [];
      const claimedRoomInTargets = targets.find(t => t.roomName === "W4N4");

      expect(claimedRoomInTargets).toBeUndefined();
    });
  });
});
