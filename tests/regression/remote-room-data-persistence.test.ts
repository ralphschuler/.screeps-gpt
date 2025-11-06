import { describe, expect, it, vi } from "vitest";
import { ScoutManager } from "@runtime/scouting/ScoutManager";
import type { GameContext, RoomLike } from "@runtime/types/GameContext";

describe("Regression: Remote room data persistence", () => {
  it("should recover from lost scout memory", () => {
    const scoutManager = new ScoutManager({ log: vi.fn(), warn: vi.fn() });
    const mockMemory = {} as Memory;
    const mockGame: GameContext = {
      time: 1000,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    // Initial scout - memory should be created
    const mockRoom: RoomLike = {
      name: "W1N1",
      controller: null,
      find: (type: FindConstant) => {
        if (type === FIND_SOURCES) {
          return [{ id: "source1" as Id<Source>, pos: { x: 10, y: 10 } }] as Source[];
        }
        return [];
      }
    };

    scoutManager.scoutRoom(mockRoom, mockMemory, mockGame);

    // Verify initial data
    expect(mockMemory.scout).toBeDefined();
    expect(mockMemory.scout?.rooms).toHaveProperty("W1N1");

    // Corrupt the rooms object (e.g., set to null)
    (mockMemory as unknown as Record<string, unknown>).scout = null;

    // Attempt to retrieve data should initialize memory without crashing
    const data = scoutManager.getRoomData("W1N1", mockMemory);

    expect(mockMemory.scout).toBeDefined();
    expect(data).toBeNull(); // Data is lost, but system recovers

    // Re-scout the room after recovery
    scoutManager.scoutRoom(mockRoom, mockMemory, mockGame);

    // Verify data is restored
    const restoredData = scoutManager.getRoomData("W1N1", mockMemory);
    expect(restoredData).toBeDefined();
    expect(restoredData?.roomName).toBe("W1N1");
  });

  it("should handle partial memory corruption gracefully", () => {
    const scoutManager = new ScoutManager({ log: vi.fn(), warn: vi.fn() });
    const mockMemory: Memory = {
      scout: {
        rooms: {},
        lastUpdate: 0,
        activeScouts: {}
      }
    } as Memory;

    // Add some room data
    mockMemory.scout!.rooms["W1N1"] = {
      roomName: "W1N1",
      lastScouted: 1500,
      owned: false,
      sourceCount: 2,
      sources: [],
      hasHostiles: false,
      hostileCount: 0,
      isSourceKeeper: false
    };

    // Corrupt the rooms object (e.g., set to null)
    (mockMemory.scout as unknown as Record<string, unknown>).rooms = null;

    // Operations should not crash, but reinitialize if needed
    const allRooms = scoutManager.getAllRooms(mockMemory);

    // Should return empty array or handle gracefully
    expect(Array.isArray(allRooms)).toBe(true);
  });

  it("should preserve scout data across tick resets", () => {
    const scoutManager = new ScoutManager({ log: vi.fn(), warn: vi.fn() });
    const mockMemory: Memory = {} as Memory;

    // Simulate multiple ticks with scout operations
    for (let tick = 1000; tick <= 1100; tick += 10) {
      const mockGame: GameContext = {
        time: tick,
        cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
        creeps: {},
        spawns: {},
        rooms: {}
      };

      const mockRoom: RoomLike = {
        name: `W${tick % 10}N${tick % 10}`,
        controller: null,
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: `source-${tick}` as Id<Source>, pos: { x: 10, y: 10 } }] as Source[];
          }
          return [];
        }
      };

      scoutManager.scoutRoom(mockRoom, mockMemory, mockGame);
    }

    // Verify all data is preserved
    const allRooms = scoutManager.getAllRooms(mockMemory);
    expect(allRooms.length).toBeGreaterThan(0);
    expect(mockMemory.scout?.lastUpdate).toBe(1100);
  });

  it("should handle concurrent scout operations without data loss", () => {
    const scoutManager = new ScoutManager({ log: vi.fn(), warn: vi.fn() });
    const mockMemory: Memory = {} as Memory;
    const mockGame: GameContext = {
      time: 5000,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    // Scout multiple rooms in the same tick (simulating multiple creeps)
    const rooms = ["W1N1", "W2N2", "W3N3", "W4N4", "W5N5"];

    rooms.forEach(roomName => {
      const mockRoom: RoomLike = {
        name: roomName,
        controller: null,
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: `source-${roomName}` as Id<Source>, pos: { x: 10, y: 10 } }] as Source[];
          }
          return [];
        }
      };

      scoutManager.scoutRoom(mockRoom, mockMemory, mockGame);
    });

    // Verify all rooms were stored
    const allRooms = scoutManager.getAllRooms(mockMemory);
    expect(allRooms).toHaveLength(5);

    rooms.forEach(roomName => {
      const data = scoutManager.getRoomData(roomName, mockMemory);
      expect(data).toBeDefined();
      expect(data?.roomName).toBe(roomName);
    });
  });

  it("should clean up old data without affecting recent data", () => {
    const scoutManager = new ScoutManager({ log: vi.fn(), warn: vi.fn() }, 5000); // 5k tick lifetime
    const mockMemory: Memory = {
      scout: {
        rooms: {
          VeryOld: {
            roomName: "VeryOld",
            lastScouted: 0, // Age = 10000 ticks
            owned: false,
            sourceCount: 1,
            sources: [],
            hasHostiles: false,
            hostileCount: 0,
            isSourceKeeper: false
          },
          Recent: {
            roomName: "Recent",
            lastScouted: 9000, // Age = 1000 ticks
            owned: false,
            sourceCount: 1,
            sources: [],
            hasHostiles: false,
            hostileCount: 0,
            isSourceKeeper: false
          }
        },
        lastUpdate: 10000,
        activeScouts: {}
      }
    } as Memory;

    const mockGame: GameContext = {
      time: 10000,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: {},
      spawns: {},
      rooms: {}
    };

    const removed = scoutManager.cleanupOldData(mockMemory, mockGame);

    expect(removed).toBe(1);
    expect(mockMemory.scout?.rooms).not.toHaveProperty("VeryOld");
    expect(mockMemory.scout?.rooms).toHaveProperty("Recent");
  });
});
