import { describe, expect, it, vi, beforeEach } from "vitest";
import { ScoutManager, type RemoteRoomData } from "@runtime/scouting/ScoutManager";
import type { GameContext, RoomLike } from "@runtime/types/GameContext";

describe("ScoutManager", () => {
  let scoutManager: ScoutManager;
  let mockMemory: Memory;
  let mockGame: GameContext;

  beforeEach(() => {
    scoutManager = new ScoutManager({ log: vi.fn(), warn: vi.fn() });
    mockMemory = {} as Memory;
    mockGame = {
      time: 1000,
      cpu: { getUsed: () => 0, limit: 20, bucket: 1000 },
      creeps: {},
      spawns: {},
      rooms: {}
    };
  });

  describe("Memory initialization", () => {
    it("should initialize scout memory if not present", () => {
      scoutManager.initializeMemory(mockMemory);

      expect(mockMemory.scout).toBeDefined();
      expect(mockMemory.scout).toHaveProperty("rooms");
      expect(mockMemory.scout).toHaveProperty("lastUpdate");
      expect(mockMemory.scout).toHaveProperty("activeScouts");
    });

    it("should not overwrite existing scout memory", () => {
      const existingData = {
        rooms: { W1N1: {} as RemoteRoomData },
        lastUpdate: 500,
        activeScouts: {}
      };
      mockMemory.scout = existingData;

      scoutManager.initializeMemory(mockMemory);

      expect(mockMemory.scout).toBe(existingData);
    });
  });

  describe("Room scouting", () => {
    it("should scout a basic unowned room with sources", () => {
      const mockRoom: RoomLike = {
        name: "W1N1",
        controller: null,
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [
              { id: "source1" as Id<Source>, pos: { x: 10, y: 10 } },
              { id: "source2" as Id<Source>, pos: { x: 20, y: 20 } }
            ] as Source[];
          }
          if (type === FIND_MINERALS) {
            return [
              { id: "mineral1" as Id<Mineral>, mineralType: RESOURCE_HYDROGEN, pos: { x: 25, y: 25 } }
            ] as Mineral[];
          }
          if (type === FIND_HOSTILE_CREEPS) {
            return [];
          }
          return [];
        }
      };

      const data = scoutManager.scoutRoom(mockRoom, mockMemory, mockGame);

      expect(data).toBeDefined();
      expect(data?.roomName).toBe("W1N1");
      expect(data?.sourceCount).toBe(2);
      expect(data?.sources).toHaveLength(2);
      expect(data?.owned).toBe(false);
      expect(data?.hasHostiles).toBe(false);
      expect(data?.isSourceKeeper).toBe(false);
      expect(data?.mineral).toBeDefined();
      expect(data?.mineral?.type).toBe(RESOURCE_HYDROGEN);
    });

    it("should detect owned rooms", () => {
      const mockRoom: RoomLike = {
        name: "W2N2",
        controller: {
          id: "controller1" as Id<StructureController>,
          owner: { username: "PlayerX" },
          level: 5,
          progress: 100,
          progressTotal: 1000
        } as StructureController,
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1" as Id<Source>, pos: { x: 10, y: 10 } }] as Source[];
          }
          return [];
        }
      };

      const data = scoutManager.scoutRoom(mockRoom, mockMemory, mockGame);

      expect(data?.owned).toBe(true);
      expect(data?.owner).toBe("PlayerX");
      expect(data?.controllerLevel).toBe(5);
    });

    it("should detect reserved rooms", () => {
      const mockRoom: RoomLike = {
        name: "W3N3",
        controller: {
          id: "controller1" as Id<StructureController>,
          reservation: {
            username: "ReserverX",
            ticksToEnd: 4999
          },
          progress: 0,
          progressTotal: 0
        } as StructureController,
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1" as Id<Source>, pos: { x: 10, y: 10 } }] as Source[];
          }
          return [];
        }
      };

      const data = scoutManager.scoutRoom(mockRoom, mockMemory, mockGame);

      expect(data?.reserved).toBe(true);
      expect(data?.reservedBy).toBe("ReserverX");
      expect(data?.reservationEndsAt).toBe(5999); // 1000 + 4999
    });

    it("should detect hostiles in room", () => {
      const mockRoom: RoomLike = {
        name: "W4N4",
        controller: null,
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1" as Id<Source>, pos: { x: 10, y: 10 } }] as Source[];
          }
          if (type === FIND_HOSTILE_CREEPS) {
            return [{}, {}, {}] as Creep[]; // 3 hostiles
          }
          return [];
        }
      };

      const data = scoutManager.scoutRoom(mockRoom, mockMemory, mockGame);

      expect(data?.hasHostiles).toBe(true);
      expect(data?.hostileCount).toBe(3);
    });

    it("should detect Source Keeper rooms", () => {
      const mockRoom: RoomLike = {
        name: "W5N5",
        controller: null,
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1" as Id<Source>, pos: { x: 10, y: 10 } }] as Source[];
          }
          if (type === FIND_STRUCTURES) {
            return [{ structureType: STRUCTURE_KEEPER_LAIR }] as StructureKeeperLair[];
          }
          return [];
        }
      };

      const data = scoutManager.scoutRoom(mockRoom, mockMemory, mockGame);

      expect(data?.isSourceKeeper).toBe(true);
    });

    it("should persist data to memory", () => {
      const mockRoom: RoomLike = {
        name: "W6N6",
        controller: null,
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1" as Id<Source>, pos: { x: 10, y: 10 } }] as Source[];
          }
          return [];
        }
      };

      scoutManager.scoutRoom(mockRoom, mockMemory, mockGame);

      expect(mockMemory.scout).toBeDefined();
      expect(mockMemory.scout?.rooms).toHaveProperty("W6N6");
      expect(mockMemory.scout?.lastUpdate).toBe(1000);
    });
  });

  describe("Data retrieval", () => {
    it("should retrieve room data from memory", () => {
      const mockRoom: RoomLike = {
        name: "W7N7",
        controller: null,
        find: (type: FindConstant) => {
          if (type === FIND_SOURCES) {
            return [{ id: "source1" as Id<Source>, pos: { x: 10, y: 10 } }] as Source[];
          }
          return [];
        }
      };

      scoutManager.scoutRoom(mockRoom, mockMemory, mockGame);
      const data = scoutManager.getRoomData("W7N7", mockMemory);

      expect(data).toBeDefined();
      expect(data?.roomName).toBe("W7N7");
    });

    it("should return null for unknown rooms", () => {
      scoutManager.initializeMemory(mockMemory);
      const data = scoutManager.getRoomData("UnknownRoom", mockMemory);

      expect(data).toBeNull();
    });

    it("should retrieve all scouted rooms", () => {
      const mockRoom1: RoomLike = {
        name: "W8N8",
        controller: null,
        find: () => [{ id: "source1" as Id<Source>, pos: { x: 10, y: 10 } }] as Source[]
      };

      const mockRoom2: RoomLike = {
        name: "W9N9",
        controller: null,
        find: () => [{ id: "source2" as Id<Source>, pos: { x: 20, y: 20 } }] as Source[]
      };

      scoutManager.scoutRoom(mockRoom1, mockMemory, mockGame);
      scoutManager.scoutRoom(mockRoom2, mockMemory, mockGame);

      const allRooms = scoutManager.getAllRooms(mockMemory);

      expect(allRooms).toHaveLength(2);
      expect(allRooms.map(r => r.roomName)).toContain("W8N8");
      expect(allRooms.map(r => r.roomName)).toContain("W9N9");
    });
  });

  describe("Finding remote targets", () => {
    beforeEach(() => {
      scoutManager.initializeMemory(mockMemory);
    });

    it("should find best remote target based on criteria", () => {
      // Add multiple rooms to memory
      mockMemory.scout!.rooms = {
        W1N1: {
          roomName: "W1N1",
          lastScouted: 900,
          owned: false,
          sourceCount: 2,
          sources: [],
          hasHostiles: false,
          hostileCount: 0,
          isSourceKeeper: false,
          pathDistance: 2
        },
        W2N2: {
          roomName: "W2N2",
          lastScouted: 950,
          owned: false,
          sourceCount: 1,
          sources: [],
          hasHostiles: false,
          hostileCount: 0,
          isSourceKeeper: false,
          pathDistance: 1
        }
      };

      const target = scoutManager.findBestRemoteTarget("W0N0", mockMemory, mockGame);

      expect(target).toBeDefined();
      expect(target?.roomName).toBe("W2N2"); // Closer room (pathDistance 1 vs 2)
    });

    it("should exclude owned rooms", () => {
      mockMemory.scout!.rooms = {
        W1N1: {
          roomName: "W1N1",
          lastScouted: 900,
          owned: true,
          owner: "OtherPlayer",
          sourceCount: 2,
          sources: [],
          hasHostiles: false,
          hostileCount: 0,
          isSourceKeeper: false,
          pathDistance: 1
        }
      };

      const target = scoutManager.findBestRemoteTarget("W0N0", mockMemory, mockGame);

      expect(target).toBeNull();
    });

    it("should exclude SK rooms", () => {
      mockMemory.scout!.rooms = {
        W1N1: {
          roomName: "W1N1",
          lastScouted: 900,
          owned: false,
          sourceCount: 3,
          sources: [],
          hasHostiles: false,
          hostileCount: 0,
          isSourceKeeper: true,
          pathDistance: 1
        }
      };

      const target = scoutManager.findBestRemoteTarget("W0N0", mockMemory, mockGame);

      expect(target).toBeNull();
    });

    it("should exclude rooms with hostiles", () => {
      mockMemory.scout!.rooms = {
        W1N1: {
          roomName: "W1N1",
          lastScouted: 900,
          owned: false,
          sourceCount: 2,
          sources: [],
          hasHostiles: true,
          hostileCount: 2,
          isSourceKeeper: false,
          pathDistance: 1
        }
      };

      const target = scoutManager.findBestRemoteTarget("W0N0", mockMemory, mockGame);

      expect(target).toBeNull();
    });
  });

  describe("Data cleanup", () => {
    it("should remove old scout data", () => {
      mockMemory.scout = {
        rooms: {
          OldRoom: {
            roomName: "OldRoom",
            lastScouted: 0, // Age = 11000, older than lifetime (10000)
            owned: false,
            sourceCount: 1,
            sources: [],
            hasHostiles: false,
            hostileCount: 0,
            isSourceKeeper: false
          },
          NewRoom: {
            roomName: "NewRoom",
            lastScouted: 10999, // Age = 1, recent
            owned: false,
            sourceCount: 1,
            sources: [],
            hasHostiles: false,
            hostileCount: 0,
            isSourceKeeper: false
          }
        },
        lastUpdate: 11000,
        activeScouts: {}
      };

      mockGame.time = 11000; // Update game time to match

      const removed = scoutManager.cleanupOldData(mockMemory, mockGame);

      expect(removed).toBe(1);
      expect(mockMemory.scout?.rooms).not.toHaveProperty("OldRoom");
      expect(mockMemory.scout?.rooms).toHaveProperty("NewRoom");
    });
  });

  describe("Path distance calculation", () => {
    it("should update path distance for a room", () => {
      mockMemory.scout = {
        rooms: {
          W1N1: {
            roomName: "W1N1",
            lastScouted: 1000,
            owned: false,
            sourceCount: 1,
            sources: [],
            hasHostiles: false,
            hostileCount: 0,
            isSourceKeeper: false
          }
        },
        lastUpdate: 1000,
        activeScouts: {}
      };

      // Mock Game.map.findRoute
      (global as unknown as Record<string, unknown>).Game = {
        map: {
          findRoute: vi.fn().mockReturnValue([{ room: "W1N0" }, { room: "W1N1" }])
        }
      };

      scoutManager.updatePathDistance("W0N0", "W1N1", mockMemory);

      expect(mockMemory.scout?.rooms.W1N1.pathDistance).toBe(2);
    });
  });

  describe("Rescouting needs", () => {
    it("should identify rooms needing rescouting", () => {
      mockGame.time = 11000; // Update game time

      mockMemory.scout = {
        rooms: {
          OldData: {
            roomName: "OldData",
            lastScouted: 0, // Age = 11000, more than half of lifetime (5000)
            owned: false,
            sourceCount: 1,
            sources: [],
            hasHostiles: false,
            hostileCount: 0,
            isSourceKeeper: false
          },
          RecentData: {
            roomName: "RecentData",
            lastScouted: 10999, // Age = 1, less than half of lifetime
            owned: false,
            sourceCount: 1,
            sources: [],
            hasHostiles: false,
            hostileCount: 0,
            isSourceKeeper: false
          }
        },
        lastUpdate: 11000,
        activeScouts: {}
      };

      const needsRescouting = scoutManager.getRoomsNeedingRescouting(mockMemory, mockGame);

      expect(needsRescouting).toContain("OldData");
      expect(needsRescouting).not.toContain("RecentData");
    });
  });
});
