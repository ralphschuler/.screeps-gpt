import { describe, expect, it, vi } from "vitest";
import { RemoteHaulerController } from "@runtime/behavior/controllers/RemoteHaulerController";
import { RemoteUpgraderController } from "@runtime/behavior/controllers/RemoteUpgraderController";
import { RemoteBuilderController } from "@runtime/behavior/controllers/RemoteBuilderController";
import type { CreepLike } from "@runtime/types/GameContext";

/**
 * Regression test for issue: screeps that should leave the room stay at the rooms edge without moving further
 *
 * Root Cause:
 * - When a creep arrived in the target room but was still near the edge (positions 2-47),
 *   the execute method didn't call moveTo, causing creeps to get stuck at the room edge
 *
 * Fix:
 * - Added explicit moveTo call toward room center when creep is near edge in target room
 * - Used reusePath: 0 and ignoreCreeps: true to ensure fresh pathfinding at room boundaries
 */
describe("Regression: creeps stuck at room edge", () => {
  function createMockCreep(x: number, y: number, roomName: string, role: string, targetRoom: string): CreepLike {
    const moveTo = vi.fn(() => OK);
    return {
      name: `${role}-test`,
      pos: {
        x,
        y,
        roomName,
        findClosestByPath: vi.fn(() => null),
        getRangeTo: vi.fn(() => 10)
      },
      room: {
        name: roomName,
        controller: { my: true, id: "controller-1" } as unknown as StructureController,
        find: vi.fn(() => [])
      },
      moveTo,
      memory: {
        role,
        task: "travel",
        version: 1,
        homeRoom: "W0N0",
        targetRoom
      },
      store: {
        getFreeCapacity: vi.fn(() => 50),
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

  it("RemoteHauler should call moveTo when at edge (x=2) in target room", () => {
    const controller = new RemoteHaulerController();
    const creep = createMockCreep(2, 25, "W1N1", "remoteHauler", "W1N1");
    creep.memory.task = "remoteTravel";

    controller.execute(creep);

    expect(creep.moveTo).toHaveBeenCalled();
    expect(creep.memory.task).toBe("remoteTravel"); // Should not transition yet

    // Verify moveTo was called with reusePath: 0 and ignoreCreeps: true for edge handling
    const moveToCall = (creep.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(moveToCall[1]).toMatchObject({ reusePath: 0, ignoreCreeps: true });
  });

  it("RemoteHauler should call moveTo when at edge (x=47) in target room", () => {
    const controller = new RemoteHaulerController();
    const creep = createMockCreep(47, 25, "W1N1", "remoteHauler", "W1N1");
    creep.memory.task = "remoteTravel";

    controller.execute(creep);

    expect(creep.moveTo).toHaveBeenCalled();
    expect(creep.memory.task).toBe("remoteTravel");

    const moveToCall = (creep.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(moveToCall[1]).toMatchObject({ reusePath: 0, ignoreCreeps: true });
  });

  it("RemoteHauler should transition to pickup when away from edge in target room", () => {
    const controller = new RemoteHaulerController();
    const creep = createMockCreep(25, 25, "W1N1", "remoteHauler", "W1N1");
    creep.memory.task = "remoteTravel";

    controller.execute(creep);

    // Should transition to pickup task when safely away from edge
    expect(creep.memory.task).toBe("remotePickup");
  });

  it("RemoteUpgrader should call moveTo when at edge (y=2) in target room", () => {
    const controller = new RemoteUpgraderController();
    const creep = createMockCreep(25, 2, "W1N1", "remoteUpgrader", "W1N1");

    controller.execute(creep);

    expect(creep.moveTo).toHaveBeenCalled();
    expect(creep.memory.task).toBe("travel");

    const moveToCall = (creep.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(moveToCall[1]).toMatchObject({ reusePath: 0, ignoreCreeps: true });
  });

  it("RemoteUpgrader should call moveTo when at edge (y=47) in target room", () => {
    const controller = new RemoteUpgraderController();
    const creep = createMockCreep(25, 47, "W1N1", "remoteUpgrader", "W1N1");

    controller.execute(creep);

    expect(creep.moveTo).toHaveBeenCalled();
    expect(creep.memory.task).toBe("travel");

    const moveToCall = (creep.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(moveToCall[1]).toMatchObject({ reusePath: 0, ignoreCreeps: true });
  });

  it("RemoteBuilder should call moveTo when at edge in target room", () => {
    const controller = new RemoteBuilderController();
    const creep = createMockCreep(2, 47, "W1N1", "remoteBuilder", "W1N1");

    controller.execute(creep);

    expect(creep.moveTo).toHaveBeenCalled();
    expect(creep.memory.task).toBe("travel");

    const moveToCall = (creep.moveTo as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(moveToCall[1]).toMatchObject({ reusePath: 0, ignoreCreeps: true });
  });

  it("RemoteBuilder should transition to build when away from edge in target room", () => {
    const controller = new RemoteBuilderController();
    const creep = createMockCreep(25, 25, "W1N1", "remoteBuilder", "W1N1");

    controller.execute(creep);

    // Should transition to build/gather task when safely away from edge (with no energy -> gather)
    expect(creep.memory.task).toBe("gather");
  });
});
