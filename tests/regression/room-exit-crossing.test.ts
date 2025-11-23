import { describe, expect, it, vi } from "vitest";
import { moveToTargetRoom } from "@runtime/behavior/controllers/helpers";
import type { CreepLike } from "@runtime/types/GameContext";

/**
 * Regression test for room exit crossing behavior.
 * Validates that scouts and claimers can successfully cross room exits
 * without getting stuck in cycling loops at room boundaries.
 *
 * Related Issue:
 * - Issue: fix(runtime): scouts/claimers get stuck cycling at room exits - excessive creep sizes
 *   prevent efficient multi-room movement
 *
 * Root Cause:
 * - moveToTargetRoom() used cached paths (reusePath parameter) at room edges
 * - Cached paths became stale at room boundaries, causing back-and-forth cycling
 *
 * Fix:
 * - Set reusePath: 0 when at room edges to force fresh pathfinding
 * - Prevents path cache corruption at room boundaries
 */
describe("Room Exit Crossing - Regression", () => {
  /**
   * Helper function to create a mock creep with specified position
   */
  function createMockCreep(x: number, y: number, roomName = "W5N5"): CreepLike {
    const moveTo = vi.fn(() => OK);
    return {
      name: "scout-test",
      pos: {
        x,
        y,
        roomName,
        findClosestByPath: vi.fn(() => null),
        getRangeTo: vi.fn(() => 10)
      },
      room: { name: roomName, find: vi.fn(() => []) },
      moveTo,
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
    };
  }
  it("should use fresh pathfinding (reusePath: 0) when creep is at left edge (x=0)", () => {
    const creep = createMockCreep(0, 25);
    const result = moveToTargetRoom(creep, "W4N5", 50);

    expect(result).toBe(true);
    expect(creep.moveTo).toHaveBeenCalled();

    // Verify reusePath: 0 is used (fresh pathfinding)
    const moveToCall = (creep.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(moveToCall[1]).toEqual({ reusePath: 0 });
  });

  it("should use fresh pathfinding (reusePath: 0) when creep is at right edge (x=49)", () => {
    const creep = createMockCreep(49, 25);
    const result = moveToTargetRoom(creep, "W6N5", 50);

    expect(result).toBe(true);
    expect(creep.moveTo).toHaveBeenCalled();

    // Verify reusePath: 0 is used
    const moveToCall = (creep.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(moveToCall[1]).toEqual({ reusePath: 0 });
  });

  it("should use fresh pathfinding (reusePath: 0) when creep is at top edge (y=0)", () => {
    const creep = createMockCreep(25, 0);
    const result = moveToTargetRoom(creep, "W5N6", 50);

    expect(result).toBe(true);
    expect(creep.moveTo).toHaveBeenCalled();

    // Verify reusePath: 0 is used
    const moveToCall = (creep.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(moveToCall[1]).toEqual({ reusePath: 0 });
  });

  it("should use fresh pathfinding (reusePath: 0) when creep is at bottom edge (y=49)", () => {
    const creep = createMockCreep(25, 49);
    const result = moveToTargetRoom(creep, "W5N4", 50);

    expect(result).toBe(true);
    expect(creep.moveTo).toHaveBeenCalled();

    // Verify reusePath: 0 is used
    const moveToCall = (creep.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(moveToCall[1]).toEqual({ reusePath: 0 });
  });

  it("should use fresh pathfinding at corner (x=0, y=0)", () => {
    const creep = createMockCreep(0, 0);
    const result = moveToTargetRoom(creep, "W4N6", 50);

    expect(result).toBe(true);
    expect(creep.moveTo).toHaveBeenCalled();

    // Verify reusePath: 0 is used
    const moveToCall = (creep.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(moveToCall[1]).toEqual({ reusePath: 0 });
  });

  it("should use provided reusePath parameter when creep is NOT at edge", () => {
    const moveTo = vi.fn(() => OK);
    const findExitTo = vi.fn(() => 1 as ExitConstant); // FIND_EXIT_TOP = 1
    const find = vi.fn(() => [{ x: 25, y: 0, roomName: "W5N5" }] as RoomPosition[]);

    const creep: CreepLike = {
      name: "scout-test",
      pos: {
        x: 25,
        y: 25,
        roomName: "W5N5",
        findClosestByPath: vi.fn(() => ({ x: 25, y: 0, roomName: "W5N5" } as RoomPosition)),
        getRangeTo: vi.fn(() => 10)
      },
      room: { name: "W5N5", findExitTo, find },
      moveTo,
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
    };

    const result = moveToTargetRoom(creep, "W5N6", 50);

    expect(result).toBe(true);
    expect(moveTo).toHaveBeenCalled();

    // When NOT at edge, should use provided reusePath (50)
    const moveToCall = moveTo.mock.calls[0];
    expect(moveToCall[1]).toEqual({ reusePath: 50 });
  });

  it("should return false when creep is already in target room", () => {
    const creep = createMockCreep(25, 25);

    // Creep already in target room
    const result = moveToTargetRoom(creep, "W5N5", 50);

    expect(result).toBe(false);
    expect(creep.moveTo).not.toHaveBeenCalled();
  });

  it("should move to target room center when at edge", () => {
    const creep = createMockCreep(0, 25);
    const result = moveToTargetRoom(creep, "W4N5", 50);

    expect(result).toBe(true);
    expect(creep.moveTo).toHaveBeenCalled();

    // Verify moving to target room center (25, 25)
    const moveToCall = (creep.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    const targetPos = moveToCall[0];
    expect(targetPos.x).toBe(25);
    expect(targetPos.y).toBe(25);
    expect(targetPos.roomName).toBe("W4N5");
  });
});
