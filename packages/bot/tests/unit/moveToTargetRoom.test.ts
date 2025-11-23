/**
 * Tests for moveToTargetRoom helper function
 * Validates that creeps correctly navigate between rooms without oscillating at edges
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { moveToTargetRoom, ROOM_CENTER_X, ROOM_CENTER_Y } from "@runtime/behavior/controllers/helpers";
import type { CreepLike } from "@runtime/types/GameContext";

interface MockRoom {
  name: string;
}

describe("moveToTargetRoom", () => {
  let mockCreep: CreepLike;
  let mockRoom: MockRoom;

  beforeEach(() => {
    mockRoom = {
      name: "W1N1"
    };

    mockCreep = {
      pos: {
        x: 25,
        y: 25,
        roomName: "W1N1"
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

  describe("when moving to a different room", () => {
    it("should move directly to target room center", () => {
      const result = moveToTargetRoom(mockCreep, "W2N1", 50);

      expect(result).toBe(true);
      expect(mockCreep.moveTo).toHaveBeenCalledWith(
        expect.objectContaining({
          x: ROOM_CENTER_X,
          y: ROOM_CENTER_Y,
          roomName: "W2N1"
        }),
        { reusePath: 50 }
      );
    });

    it("should use default reusePath of 50", () => {
      const result = moveToTargetRoom(mockCreep, "W2N1");

      expect(result).toBe(true);
      expect(mockCreep.moveTo).toHaveBeenCalledWith(
        expect.objectContaining({
          x: ROOM_CENTER_X,
          y: ROOM_CENTER_Y,
          roomName: "W2N1"
        }),
        { reusePath: 50 }
      );
    });

    it("should respect custom reusePath parameter", () => {
      const result = moveToTargetRoom(mockCreep, "W2N1", 100);

      expect(result).toBe(true);
      expect(mockCreep.moveTo).toHaveBeenCalledWith(
        expect.objectContaining({
          x: ROOM_CENTER_X,
          y: ROOM_CENTER_Y,
          roomName: "W2N1"
        }),
        { reusePath: 100 }
      );
    });
  });

  describe("when at room edge", () => {
    it("should move to target room center from x=0", () => {
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
        { reusePath: 50 }
      );
    });

    it("should move to target room center from x=49", () => {
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
        { reusePath: 50 }
      );
    });

    it("should move to target room center from y=0", () => {
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
        { reusePath: 50 }
      );
    });

    it("should move to target room center from y=49", () => {
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
        { reusePath: 50 }
      );
    });

    it("should move to target room center from corner (x=0, y=0)", () => {
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
        { reusePath: 50 }
      );
    });
  });

  describe("anti-oscillation behavior", () => {
    it("should always move to target room center to avoid edge cycling", () => {
      // This simplified approach avoids the oscillation bug by always
      // moving directly to the target room center, letting the pathfinding
      // system handle inter-room navigation naturally
      const result = moveToTargetRoom(mockCreep, "W2N1", 50);

      expect(result).toBe(true);
      expect(mockCreep.moveTo).toHaveBeenCalledWith(
        expect.objectContaining({
          x: ROOM_CENTER_X,
          y: ROOM_CENTER_Y,
          roomName: "W2N1"
        }),
        { reusePath: 50 }
      );
    });
  });
});
