/**
 * Tests for findClosestOrFirst helper function
 * Validates ignoreCreeps behavior for narrow passage pathfinding
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { findClosestOrFirst } from "@runtime/behavior/controllers/helpers";
import type { CreepLike } from "@runtime/types/GameContext";

interface MockTarget {
  pos: RoomPosition;
  id: string;
}

describe("findClosestOrFirst", () => {
  let mockCreep: CreepLike;
  let findClosestByPathMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findClosestByPathMock = vi.fn();
    mockCreep = {
      name: "test-creep",
      pos: {
        x: 25,
        y: 25,
        roomName: "W5N5",
        findClosestByPath: findClosestByPathMock,
        getRangeTo: vi.fn(() => 10)
      },
      room: { name: "W5N5", find: vi.fn(() => []) },
      moveTo: vi.fn(() => OK),
      memory: {},
      store: {
        getFreeCapacity: vi.fn(() => 0),
        getUsedCapacity: vi.fn(() => 0)
      },
      harvest: vi.fn(() => OK),
      transfer: vi.fn(() => OK),
      upgradeController: vi.fn(() => OK),
      withdraw: vi.fn(() => OK),
      build: vi.fn(() => OK),
      repair: vi.fn(() => OK),
      pickup: vi.fn(() => OK)
    } as unknown as CreepLike;
  });

  it("should return null when targets array is empty", () => {
    const result = findClosestOrFirst(mockCreep, []);

    expect(result).toBeNull();
    expect(findClosestByPathMock).not.toHaveBeenCalled();
  });

  it("should default to ignoreCreeps: true when no options provided", () => {
    const targets: MockTarget[] = [{ pos: { x: 10, y: 10, roomName: "W5N5" } as RoomPosition, id: "target1" }];
    findClosestByPathMock.mockReturnValue(targets[0]);

    findClosestOrFirst(mockCreep, targets);

    expect(findClosestByPathMock).toHaveBeenCalledWith(targets, { ignoreCreeps: true });
  });

  it("should use ignoreCreeps: true when options object is empty", () => {
    const targets: MockTarget[] = [{ pos: { x: 10, y: 10, roomName: "W5N5" } as RoomPosition, id: "target1" }];
    findClosestByPathMock.mockReturnValue(targets[0]);

    findClosestOrFirst(mockCreep, targets, {});

    expect(findClosestByPathMock).toHaveBeenCalledWith(targets, { ignoreCreeps: true });
  });

  it("should respect explicit ignoreCreeps: false when passed", () => {
    const targets: MockTarget[] = [{ pos: { x: 10, y: 10, roomName: "W5N5" } as RoomPosition, id: "target1" }];
    findClosestByPathMock.mockReturnValue(targets[0]);

    findClosestOrFirst(mockCreep, targets, { ignoreCreeps: false });

    expect(findClosestByPathMock).toHaveBeenCalledWith(targets, { ignoreCreeps: false });
  });

  it("should respect explicit ignoreCreeps: true when passed", () => {
    const targets: MockTarget[] = [{ pos: { x: 10, y: 10, roomName: "W5N5" } as RoomPosition, id: "target1" }];
    findClosestByPathMock.mockReturnValue(targets[0]);

    findClosestOrFirst(mockCreep, targets, { ignoreCreeps: true });

    expect(findClosestByPathMock).toHaveBeenCalledWith(targets, { ignoreCreeps: true });
  });

  it("should return closest target when findClosestByPath succeeds", () => {
    const targets: MockTarget[] = [
      { pos: { x: 10, y: 10, roomName: "W5N5" } as RoomPosition, id: "target1" },
      { pos: { x: 40, y: 40, roomName: "W5N5" } as RoomPosition, id: "target2" }
    ];
    findClosestByPathMock.mockReturnValue(targets[0]);

    const result = findClosestOrFirst(mockCreep, targets);

    expect(result).toBe(targets[0]);
  });

  it("should return first target as fallback when findClosestByPath returns null", () => {
    const targets: MockTarget[] = [
      { pos: { x: 10, y: 10, roomName: "W5N5" } as RoomPosition, id: "target1" },
      { pos: { x: 40, y: 40, roomName: "W5N5" } as RoomPosition, id: "target2" }
    ];
    findClosestByPathMock.mockReturnValue(null);

    const result = findClosestOrFirst(mockCreep, targets);

    expect(result).toBe(targets[0]);
  });
});
