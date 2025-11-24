import { describe, expect, it, vi, beforeEach } from "vitest";
import { ColonyManager, type ColonyManagerMemory } from "@runtime/planning/ColonyManager";

describe("Room Integration", () => {
  describe("ColonyManager Room Integration Tracking", () => {
    let colonyManager: ColonyManager;
    let memory: ColonyManagerMemory;
    const logger = { log: vi.fn(), warn: vi.fn() };

    beforeEach(() => {
      memory = {
        expansionQueue: [],
        claimedRooms: [],
        shardMessages: [],
        lastExpansionCheck: 0,
        roomsNeedingIntegration: []
      };
      colonyManager = new ColonyManager({ memory, logger });
    });

    it("should detect newly claimed room without spawn", () => {
      // Create a room with controller.my but no spawn
      const newRoom = {
        name: "W1N1",
        controller: { my: true, level: 1 },
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) {
            return []; // No spawns
          }
          if (type === FIND_CONSTRUCTION_SITES) {
            return []; // No construction sites
          }
          return [];
        }
      } as unknown as Room;

      // Create a home room with spawn
      const homeRoom = {
        name: "W0N0",
        controller: { my: true, level: 4 },
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) {
            return [{ pos: { x: 25, y: 25 } }]; // Has spawn
          }
          return [];
        }
      } as unknown as Room;

      const rooms = { W0N0: homeRoom, W1N1: newRoom };

      colonyManager.run(rooms, 100);

      const roomsNeedingWorkforce = colonyManager.getRoomsNeedingWorkforce();
      expect(roomsNeedingWorkforce.length).toBe(1);
      expect(roomsNeedingWorkforce[0].roomName).toBe("W1N1");
      expect(roomsNeedingWorkforce[0].status).toBe("pending");
      expect(roomsNeedingWorkforce[0].homeRoom).toBe("W0N0");
    });

    it("should not track first room with spawn as needing integration", () => {
      // Create a home room with spawn (first room scenario)
      const homeRoom = {
        name: "W0N0",
        controller: { my: true, level: 4 },
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) {
            return [{ pos: { x: 25, y: 25 } }]; // Has spawn
          }
          return [];
        }
      } as unknown as Room;

      const rooms = { W0N0: homeRoom };

      colonyManager.run(rooms, 100);

      const roomsNeedingWorkforce = colonyManager.getRoomsNeedingWorkforce();
      expect(roomsNeedingWorkforce.length).toBe(0);
    });

    it("should update room status to building when spawn construction starts", () => {
      // First, detect the room
      const newRoom = {
        name: "W1N1",
        controller: { my: true, level: 1 },
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) {
            return [];
          }
          if (type === FIND_CONSTRUCTION_SITES) {
            return [];
          }
          return [];
        }
      } as unknown as Room;

      const homeRoom = {
        name: "W0N0",
        controller: { my: true, level: 4 },
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) {
            return [{ pos: { x: 25, y: 25 } }];
          }
          return [];
        }
      } as unknown as Room;

      colonyManager.run({ W0N0: homeRoom, W1N1: newRoom }, 100);

      // Now add a spawn construction site
      const newRoomWithSite = {
        name: "W1N1",
        controller: { my: true, level: 1 },
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) {
            return [];
          }
          if (type === FIND_CONSTRUCTION_SITES) {
            return [{ structureType: STRUCTURE_SPAWN }]; // Has spawn site
          }
          return [];
        }
      } as unknown as Room;

      colonyManager.run({ W0N0: homeRoom, W1N1: newRoomWithSite }, 200);

      const roomsNeedingWorkforce = colonyManager.getRoomsNeedingWorkforce();
      expect(roomsNeedingWorkforce.length).toBe(1);
      expect(roomsNeedingWorkforce[0].status).toBe("building");
    });

    it("should mark room as established when spawn is operational", () => {
      // First, detect the room
      const newRoom = {
        name: "W1N1",
        controller: { my: true, level: 1 },
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) {
            return [];
          }
          return [];
        }
      } as unknown as Room;

      const homeRoom = {
        name: "W0N0",
        controller: { my: true, level: 4 },
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) {
            return [{ pos: { x: 25, y: 25 } }];
          }
          return [];
        }
      } as unknown as Room;

      colonyManager.run({ W0N0: homeRoom, W1N1: newRoom }, 100);

      // Now spawn is built
      const newRoomWithSpawn = {
        name: "W1N1",
        controller: { my: true, level: 1 },
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) {
            return [{ pos: { x: 25, y: 25 } }]; // Spawn is now operational
          }
          return [];
        }
      } as unknown as Room;

      colonyManager.run({ W0N0: homeRoom, W1N1: newRoomWithSpawn }, 500);

      // Room should no longer need workforce (established)
      const roomsNeedingWorkforce = colonyManager.getRoomsNeedingWorkforce();
      expect(roomsNeedingWorkforce.length).toBe(0);

      // Check that the room was marked as established
      expect(memory.roomsNeedingIntegration?.find(r => r.roomName === "W1N1")?.status).toBe("established");
    });

    it("should assign closest home room for workforce sourcing", () => {
      // Create multiple home rooms
      const homeRoom1 = {
        name: "W0N0",
        controller: { my: true, level: 4 },
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) {
            return [{ pos: { x: 25, y: 25 } }];
          }
          return [];
        }
      } as unknown as Room;

      const homeRoom2 = {
        name: "W2N0",
        controller: { my: true, level: 4 },
        find: (type: FindConstant) => {
          if (type === FIND_MY_SPAWNS) {
            return [{ pos: { x: 25, y: 25 } }];
          }
          return [];
        }
      } as unknown as Room;

      // Create new room closer to W2N0
      const newRoom = {
        name: "W3N0",
        controller: { my: true, level: 1 },
        find: () => []
      } as unknown as Room;

      // Mock Game.map.getRoomLinearDistance
      const originalGame = (global as { Game?: { map?: { getRoomLinearDistance?: (r1: string, r2: string) => number } } }).Game;
      (global as { Game: { map: { getRoomLinearDistance: (r1: string, r2: string) => number } } }).Game = {
        map: {
          getRoomLinearDistance: (from: string, to: string) => {
            if (from === "W0N0" && to === "W3N0") return 3;
            if (from === "W2N0" && to === "W3N0") return 1;
            return 10;
          }
        }
      };

      colonyManager.run({ W0N0: homeRoom1, W2N0: homeRoom2, W3N0: newRoom }, 100);

      const roomsNeedingWorkforce = colonyManager.getRoomsNeedingWorkforce();
      expect(roomsNeedingWorkforce.length).toBe(1);
      expect(roomsNeedingWorkforce[0].homeRoom).toBe("W2N0"); // Closer home room

      // Restore original Game object
      (global as { Game?: typeof originalGame }).Game = originalGame;
    });
  });

  describe("getRoomsNeedingWorkforce", () => {
    it("should return only pending and building rooms", () => {
      const memory: ColonyManagerMemory = {
        expansionQueue: [],
        claimedRooms: [],
        shardMessages: [],
        lastExpansionCheck: 0,
        roomsNeedingIntegration: [
          { roomName: "W1N1", status: "pending", homeRoom: "W0N0", claimedAt: 100, lastWorkforceCheck: 100 },
          { roomName: "W2N2", status: "building", homeRoom: "W0N0", claimedAt: 200, lastWorkforceCheck: 200 },
          { roomName: "W3N3", status: "established", homeRoom: "W0N0", claimedAt: 300, lastWorkforceCheck: 300, spawnOperational: 400 }
        ]
      };

      const colonyManager = new ColonyManager({ memory });
      const roomsNeedingWorkforce = colonyManager.getRoomsNeedingWorkforce();

      expect(roomsNeedingWorkforce.length).toBe(2);
      expect(roomsNeedingWorkforce.map(r => r.roomName)).toEqual(["W1N1", "W2N2"]);
    });
  });
});
