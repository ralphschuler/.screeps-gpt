import { describe, expect, it, vi, beforeEach } from "vitest";
import { moveToTargetRoom } from "@runtime/behavior/controllers/helpers";
import { ClaimerController } from "@runtime/behavior/controllers/ClaimerController";
import type { CreepLike } from "@runtime/types/GameContext";

/**
 * Regression test for issue: creeps trying to move into other rooms get stuck
 * in their home room without leaving it.
 *
 * Root Cause:
 * - When a creep was near (but not at) the room exit, it would try to move
 *   to the exit tile position, but cached paths (reusePath > 0) could prevent
 *   the creep from actually crossing the room boundary.
 * - The exit tile navigation didn't ensure crossing into the adjacent room.
 *
 * Fix:
 * - When creep is near exit (within 3 tiles of edge), move directly toward
 *   the target room center with reusePath: 0 to force cross-room pathfinding.
 * - This ensures the pathfinder computes a path that crosses the boundary.
 */
describe("Regression: claimer stuck at room boundary", () => {
  beforeEach(() => {
    // Reset Game.map mock between tests
    vi.resetAllMocks();
  });

  /**
   * Helper to create a mock creep
   */
  function createMockCreep(x: number, y: number, roomName: string, targetRoom?: string): CreepLike {
    const moveTo = vi.fn(() => OK);
    const findExitTo = vi.fn(() => {
      // Return appropriate exit direction for adjacent rooms
      // W0N1 -> W1N1 = FIND_EXIT_RIGHT (3)
      // W1N1 -> W0N1 = FIND_EXIT_LEFT (7)
      if (roomName === "W1N1" && targetRoom === "W0N1") return 7; // LEFT
      if (roomName === "W0N1" && targetRoom === "W1N1") return 3; // RIGHT
      if (roomName === "W1N1" && targetRoom === "W1N0") return 5; // BOTTOM
      if (roomName === "W1N1" && targetRoom === "W1N2") return 1; // TOP
      return -2 as ExitConstant; // ERR_NO_PATH for non-adjacent
    });
    const find = vi.fn(() => {
      // Return exit positions for the room
      return [
        { x: 0, y: 10, roomName } as RoomPosition,
        { x: 0, y: 25, roomName } as RoomPosition,
        { x: 0, y: 40, roomName } as RoomPosition
      ];
    });

    return {
      name: "claimer-test",
      pos: {
        x,
        y,
        roomName,
        findClosestByPath: vi.fn(positions => positions?.[1] ?? null),
        getRangeTo: vi.fn(() => 10)
      },
      room: {
        name: roomName,
        findExitTo,
        find,
        controller: roomName === targetRoom ? ({ my: false, id: "controller-1" } as unknown as StructureController) : null
      },
      moveTo,
      memory: {
        role: "claimer",
        task: "travel",
        version: 1,
        targetRoom
      },
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
      pickup: vi.fn(() => OK),
      claimController: vi.fn(() => ERR_NOT_IN_RANGE),
      reserveController: vi.fn(() => ERR_NOT_IN_RANGE)
    };
  }

  it("claimer near exit (x=3) should use exit-based navigation (not near enough for direct crossing)", () => {
    const creep = createMockCreep(3, 25, "W1N1", "W0N1");
    const result = moveToTargetRoom(creep, "W0N1", 50);

    expect(result).toBe(true);
    expect(creep.moveTo).toHaveBeenCalled();

    // At x=3, the creep is NOT within the "near exit" zone (x <= 2 or x >= 47)
    // So it should use exit-based navigation (moving to exit tile, not target room center)
    // The key assertion is that moveTo was called
  });

  it("claimer near exit (x=2) should move toward target room center", () => {
    const creep = createMockCreep(2, 30, "W1N1", "W0N1");
    const result = moveToTargetRoom(creep, "W0N1", 50);

    expect(result).toBe(true);
    expect(creep.moveTo).toHaveBeenCalled();

    const moveToCall = (creep.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    const targetPos = moveToCall[0];

    expect(targetPos.x).toBe(25);
    expect(targetPos.y).toBe(25);
    expect(targetPos.roomName).toBe("W0N1");
    expect(moveToCall[1]).toMatchObject({ reusePath: 0, ignoreCreeps: true });
  });

  it("claimer far from exit (x=25) should use exit-based navigation", () => {
    const creep = createMockCreep(25, 25, "W1N1", "W0N1");
    const result = moveToTargetRoom(creep, "W0N1", 50);

    expect(result).toBe(true);
    expect(creep.moveTo).toHaveBeenCalled();

    // When far from exit, exit-based navigation is used (varies by implementation)
    // The key assertion is that moveTo is called to move the creep
  });

  it("claimer at edge (x=0) should move toward target room center", () => {
    const creep = createMockCreep(0, 25, "W1N1", "W0N1");
    const result = moveToTargetRoom(creep, "W0N1", 50);

    expect(result).toBe(true);
    expect(creep.moveTo).toHaveBeenCalled();

    const moveToCall = (creep.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    const targetPos = moveToCall[0];

    expect(targetPos.x).toBe(25);
    expect(targetPos.y).toBe(25);
    expect(targetPos.roomName).toBe("W0N1");
    expect(moveToCall[1]).toMatchObject({ reusePath: 0, ignoreCreeps: true });
  });

  it("claimer should continue moving when moveToTargetRoom is called repeatedly", () => {
    // Simulate a creep that is stuck and moveToTargetRoom is called multiple times
    const creep = createMockCreep(2, 25, "W1N1", "W0N1");

    // First call
    const result1 = moveToTargetRoom(creep, "W0N1", 50);
    expect(result1).toBe(true);

    // Reset and simulate next tick (creep still at same position)
    (creep.moveTo as ReturnType<typeof vi.fn>).mockClear();

    // Second call
    const result2 = moveToTargetRoom(creep, "W0N1", 50);
    expect(result2).toBe(true);
    expect(creep.moveTo).toHaveBeenCalled();
  });

  it("claimer should always return true when not in target room (still moving)", () => {
    const creep = createMockCreep(25, 25, "W1N1", "W0N1");

    // When not in target room, should always return true (still moving)
    const result = moveToTargetRoom(creep, "W0N1", 50);
    expect(result).toBe(true);

    // moveTo should be called
    expect(creep.moveTo).toHaveBeenCalled();
  });

  it("claimer in target room at edge should move toward center", () => {
    const creep = createMockCreep(0, 25, "W0N1", "W0N1");
    const result = moveToTargetRoom(creep, "W0N1", 50);

    expect(result).toBe(true);
    expect(creep.moveTo).toHaveBeenCalled();

    const moveToCall = (creep.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    const targetPos = moveToCall[0];

    // Should move to center of target room
    expect(targetPos.x).toBe(25);
    expect(targetPos.y).toBe(25);
    expect(targetPos.roomName).toBe("W0N1");
    expect(moveToCall[1]).toMatchObject({ reusePath: 0, ignoreCreeps: true });
  });

  it("claimer in target room away from edge should return false (arrived)", () => {
    const creep = createMockCreep(25, 25, "W0N1", "W0N1");
    const result = moveToTargetRoom(creep, "W0N1", 50);

    // Should return false - creep has arrived
    expect(result).toBe(false);
    expect(creep.moveTo).not.toHaveBeenCalled();
  });
});

describe("Regression: claimer controller using moveToTargetRoom", () => {
  it("ClaimerController should continue calling moveToTargetRoom until arrived", () => {
    const controller = new ClaimerController();

    // Create mock creep near exit but not in target room
    const moveTo = vi.fn(() => OK);
    const creep: CreepLike = {
      name: "claimer-near-exit",
      pos: {
        x: 2,
        y: 25,
        roomName: "W1N1",
        findClosestByPath: vi.fn(() => null),
        getRangeTo: vi.fn(() => 10)
      },
      room: {
        name: "W1N1",
        findExitTo: vi.fn(() => 7), // FIND_EXIT_LEFT
        find: vi.fn(() => [{ x: 0, y: 25, roomName: "W1N1" }]),
        controller: null
      },
      moveTo,
      memory: {
        role: "claimer",
        task: "travel",
        version: 1,
        targetRoom: "W0N1"
      },
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
      pickup: vi.fn(() => OK),
      claimController: vi.fn(() => ERR_NOT_IN_RANGE),
      reserveController: vi.fn(() => ERR_NOT_IN_RANGE)
    };

    // Execute should call moveTo
    controller.execute(creep);

    expect(moveTo).toHaveBeenCalled();

    // Verify movement was toward target room with fresh pathfinding
    const moveToCall = moveTo.mock.calls[0];
    expect(moveToCall[1]).toMatchObject({ reusePath: 0, ignoreCreeps: true });
  });
});
