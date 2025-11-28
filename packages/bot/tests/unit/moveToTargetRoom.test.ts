/**
 * Tests for moveToTargetRoom helper function
 * Validates that creeps correctly navigate between rooms without oscillating at edges
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { moveToTargetRoom, ROOM_CENTER_X, ROOM_CENTER_Y } from "@runtime/behavior/controllers/helpers";
import type { CreepLike } from "@runtime/types/GameContext";

interface MockRoom {
  name: string;
  findExitTo: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
}

describe("moveToTargetRoom", () => {
  let mockCreep: CreepLike;
  let mockRoom: MockRoom;

  // Exit direction constant (valid ExitConstant values are 1=TOP, 3=RIGHT, 5=BOTTOM, 7=LEFT)
  const EXIT_RIGHT = 3; // FIND_EXIT_RIGHT constant

  beforeEach(() => {
    mockRoom = {
      name: "W1N1",
      findExitTo: vi.fn(),
      find: vi.fn()
    };

    mockCreep = {
      pos: {
        x: 25,
        y: 25,
        roomName: "W1N1",
        findClosestByPath: vi.fn()
      },
      room: mockRoom,
      moveTo: vi.fn()
    } as unknown as CreepLike;
  });

  describe("when already in target room", () => {
    it("should return false and not move", () => {
      const result = moveToTargetRoom(mockCreep, "W1N1");

      expect(result).toBe(false);
      expect(mockCreep.moveTo).not.toHaveBeenCalled();
    });
  });

  describe("when not at room edge", () => {
    it("should find exit and move to exit position with ignoreCreeps", () => {
      const exitPositions = [
        { x: 49, y: 25, roomName: "W1N1" },
        { x: 49, y: 26, roomName: "W1N1" }
      ];

      mockRoom.findExitTo.mockReturnValue(EXIT_RIGHT);
      mockRoom.find.mockReturnValue(exitPositions);
      mockCreep.pos.findClosestByPath.mockReturnValue(exitPositions[0]);

      const result = moveToTargetRoom(mockCreep, "W2N1", 50);

      expect(result).toBe(true);
      expect(mockRoom.findExitTo).toHaveBeenCalledWith("W2N1");
      expect(mockRoom.find).toHaveBeenCalledWith(EXIT_RIGHT);
      // Should use ignoreCreeps for better routing through narrow passages
      expect(mockCreep.pos.findClosestByPath).toHaveBeenCalledWith(exitPositions, { ignoreCreeps: true });
      expect(mockCreep.moveTo).toHaveBeenCalledWith(exitPositions[0], { reusePath: 50, ignoreCreeps: true });
    });
  });

  describe("when at room edge (x=0)", () => {
    it("should move directly to target room center with fresh pathfinding and ignoreCreeps", () => {
      mockCreep.pos.x = 0;
      mockCreep.pos.y = 25;

      const result = moveToTargetRoom(mockCreep, "W0N1", 50);

      expect(result).toBe(true);
      expect(mockCreep.moveTo).toHaveBeenCalledWith(
        expect.objectContaining({
          x: ROOM_CENTER_X,
          y: ROOM_CENTER_Y,
          roomName: "W0N1"
        }),
        { reusePath: 0, ignoreCreeps: true } // Force fresh pathfinding at room edges to prevent cycling
      );
      // Should not call findExitTo when at edge
      expect(mockRoom.findExitTo).not.toHaveBeenCalled();
    });
  });

  describe("when at room edge (x=49)", () => {
    it("should move directly to target room center with fresh pathfinding and ignoreCreeps", () => {
      mockCreep.pos.x = 49;
      mockCreep.pos.y = 25;

      const result = moveToTargetRoom(mockCreep, "W2N1", 50);

      expect(result).toBe(true);
      expect(mockCreep.moveTo).toHaveBeenCalledWith(
        expect.objectContaining({
          x: ROOM_CENTER_X,
          y: ROOM_CENTER_Y,
          roomName: "W2N1"
        }),
        { reusePath: 0, ignoreCreeps: true } // Force fresh pathfinding at room edges to prevent cycling
      );
      expect(mockRoom.findExitTo).not.toHaveBeenCalled();
    });
  });

  describe("when at room edge (y=0)", () => {
    it("should move directly to target room center with fresh pathfinding and ignoreCreeps", () => {
      mockCreep.pos.x = 25;
      mockCreep.pos.y = 0;

      const result = moveToTargetRoom(mockCreep, "W1N2", 50);

      expect(result).toBe(true);
      expect(mockCreep.moveTo).toHaveBeenCalledWith(
        expect.objectContaining({
          x: ROOM_CENTER_X,
          y: ROOM_CENTER_Y,
          roomName: "W1N2"
        }),
        { reusePath: 0, ignoreCreeps: true } // Force fresh pathfinding at room edges to prevent cycling
      );
      expect(mockRoom.findExitTo).not.toHaveBeenCalled();
    });
  });

  describe("when at room edge (y=49)", () => {
    it("should move directly to target room center with fresh pathfinding and ignoreCreeps", () => {
      mockCreep.pos.x = 25;
      mockCreep.pos.y = 49;

      const result = moveToTargetRoom(mockCreep, "W1N0", 50);

      expect(result).toBe(true);
      expect(mockCreep.moveTo).toHaveBeenCalledWith(
        expect.objectContaining({
          x: ROOM_CENTER_X,
          y: ROOM_CENTER_Y,
          roomName: "W1N0"
        }),
        { reusePath: 0, ignoreCreeps: true } // Force fresh pathfinding at room edges to prevent cycling
      );
      expect(mockRoom.findExitTo).not.toHaveBeenCalled();
    });
  });

  describe("when at corner (x=0, y=0)", () => {
    it("should move directly to target room center with fresh pathfinding and ignoreCreeps", () => {
      mockCreep.pos.x = 0;
      mockCreep.pos.y = 0;

      const result = moveToTargetRoom(mockCreep, "W0N2", 50);

      expect(result).toBe(true);
      expect(mockCreep.moveTo).toHaveBeenCalledWith(
        expect.objectContaining({
          x: ROOM_CENTER_X,
          y: ROOM_CENTER_Y,
          roomName: "W0N2"
        }),
        { reusePath: 0, ignoreCreeps: true } // Force fresh pathfinding at room edges to prevent cycling
      );
      expect(mockRoom.findExitTo).not.toHaveBeenCalled();
    });
  });

  describe("when in target room but at edge", () => {
    it("should move to room center with ignoreCreeps to prevent oscillation", () => {
      mockCreep.pos.x = 0;
      mockCreep.pos.y = 25;
      mockRoom.name = "W1N1";

      const result = moveToTargetRoom(mockCreep, "W1N1", 50);

      expect(result).toBe(true);
      expect(mockCreep.moveTo).toHaveBeenCalledWith(
        expect.objectContaining({
          x: ROOM_CENTER_X,
          y: ROOM_CENTER_Y,
          roomName: "W1N1"
        }),
        { reusePath: 0, ignoreCreeps: true }
      );
    });
  });

  describe("when exit not found", () => {
    it("should return false when findExitTo returns error", () => {
      mockRoom.findExitTo.mockReturnValue(ERR_NO_PATH);

      const result = moveToTargetRoom(mockCreep, "W5N5");

      expect(result).toBe(false);
      expect(mockCreep.moveTo).not.toHaveBeenCalled();
    });

    it("should return false when no exit positions found", () => {
      mockRoom.findExitTo.mockReturnValue(EXIT_RIGHT);
      mockRoom.find.mockReturnValue([]);

      const result = moveToTargetRoom(mockCreep, "W2N1");

      expect(result).toBe(false);
      expect(mockCreep.moveTo).not.toHaveBeenCalled();
    });
  });

  describe("when pathfinding fails", () => {
    it("should use first exit position as fallback with ignoreCreeps", () => {
      const exitPositions = [
        { x: 49, y: 25, roomName: "W1N1" },
        { x: 49, y: 26, roomName: "W1N1" }
      ];

      mockRoom.findExitTo.mockReturnValue(EXIT_RIGHT);
      mockRoom.find.mockReturnValue(exitPositions);
      mockCreep.pos.findClosestByPath.mockReturnValue(null);

      const result = moveToTargetRoom(mockCreep, "W2N1", 50);

      expect(result).toBe(true);
      expect(mockCreep.moveTo).toHaveBeenCalledWith(exitPositions[0], { reusePath: 50, ignoreCreeps: true });
    });
  });
});
