/**
 * Unit test for creeps picking up dropped energy.
 *
 * Verifies that all energy-gathering creep roles attempt to pick up
 * dropped energy when it's available and they have capacity.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BehaviorController } from "@runtime/behavior/BehaviorController";
import type { GameContext } from "@runtime/types/GameContext";

describe("Creeps Pickup Dropped Energy", () => {
  let behaviorController: BehaviorController;
  let memory: Memory;
  let game: GameContext;
  let mockRoom: Room;
  let mockDroppedEnergy: Resource;

  beforeEach(() => {
    behaviorController = new BehaviorController(
      {
        useTaskSystem: false,
        cpuSafetyMargin: 0.85,
        maxCpuPerCreep: 1.5
      },
      { log: vi.fn(), warn: vi.fn() }
    );

    memory = {} as Memory;

    // Create mock dropped energy
    mockDroppedEnergy = {
      id: "resource-1" as Id<Resource>,
      pos: {
        x: 22,
        y: 22,
        roomName: "W1N1"
      } as RoomPosition,
      resourceType: RESOURCE_ENERGY,
      amount: 100
    } as Resource;

    // Create mock room
    mockRoom = {
      name: "W1N1",
      controller: {
        id: "controller-1" as Id<StructureController>,
        my: true,
        level: 3
      } as StructureController,
      find: vi.fn((findConstant: FindConstant, options?: FilterOptions<FindConstant>) => {
        if (findConstant === FIND_DROPPED_RESOURCES) {
          const resources = [mockDroppedEnergy];
          if (options?.filter) {
            return resources.filter(r => options.filter!(r as Resource));
          }
          return resources;
        }
        if (findConstant === FIND_SOURCES_ACTIVE) {
          return [
            {
              id: "source-1" as Id<Source>,
              pos: { x: 25, y: 25, roomName: "W1N1" } as RoomPosition,
              energy: 3000
            }
          ];
        }
        if (findConstant === FIND_STRUCTURES) {
          return [];
        }
        return [];
      })
    } as Room;

    // Setup global Game object
    game = {
      time: 1000,
      cpu: {
        getUsed: vi.fn().mockReturnValue(5),
        limit: 100,
        bucket: 10000
      },
      creeps: {},
      spawns: {},
      rooms: {
        W1N1: mockRoom
      }
    } as unknown as GameContext;
  });

  function createMockCreep(role: string, task: string): Creep {
    return {
      name: `${role}-1`,
      id: `creep-${role}` as Id<Creep>,
      pos: {
        x: 20,
        y: 20,
        roomName: "W1N1",
        findClosestByPath: vi.fn((targets: unknown[]) => {
          return Array.isArray(targets) && targets.length > 0 ? targets[0] : null;
        })
      } as RoomPosition,
      memory: {
        role,
        task,
        version: 1
      } as CreepMemory,
      store: {
        getFreeCapacity: vi.fn().mockReturnValue(50),
        getUsedCapacity: vi.fn().mockReturnValue(0),
        energy: 0,
        getCapacity: vi.fn().mockReturnValue(50)
      } as StoreDefinition,
      harvest: vi.fn().mockReturnValue(OK),
      pickup: vi.fn().mockReturnValue(OK),
      withdraw: vi.fn().mockReturnValue(OK),
      transfer: vi.fn().mockReturnValue(OK),
      moveTo: vi.fn().mockReturnValue(OK),
      upgradeController: vi.fn().mockReturnValue(OK),
      build: vi.fn().mockReturnValue(OK),
      repair: vi.fn().mockReturnValue(OK),
      room: mockRoom
    } as Creep;
  }

  it("harvester should pick up dropped energy before harvesting", () => {
    const harvester = createMockCreep("harvester", "harvest");
    game.creeps = { "harvester-1": harvester };

    behaviorController.execute(game, memory, { harvester: 1 });

    expect(harvester.pickup).toHaveBeenCalledWith(mockDroppedEnergy);
  });

  it("upgrader should pick up dropped energy during recharge", () => {
    const upgrader = createMockCreep("upgrader", "recharge");
    game.creeps = { "upgrader-1": upgrader };

    behaviorController.execute(game, memory, { upgrader: 1 });

    expect(upgrader.pickup).toHaveBeenCalledWith(mockDroppedEnergy);
  });

  it("builder should pick up dropped energy during gather", () => {
    const builder = createMockCreep("builder", "gather");
    game.creeps = { "builder-1": builder };

    behaviorController.execute(game, memory, { builder: 1 });

    expect(builder.pickup).toHaveBeenCalledWith(mockDroppedEnergy);
  });

  it("repairer should pick up dropped energy during gather", () => {
    const repairer = createMockCreep("repairer", "repairerGather");
    game.creeps = { "repairer-1": repairer };

    behaviorController.execute(game, memory, { repairer: 1 });

    expect(repairer.pickup).toHaveBeenCalledWith(mockDroppedEnergy);
  });

  it("hauler should pick up dropped energy during pickup task", () => {
    const hauler = createMockCreep("hauler", "pickup");
    game.creeps = { "hauler-1": hauler };

    behaviorController.execute(game, memory, { hauler: 1 });

    expect(hauler.pickup).toHaveBeenCalledWith(mockDroppedEnergy);
  });

  it("remoteMiner should pick up dropped energy during mine task", () => {
    const remoteMiner = createMockCreep("remoteMiner", "mine");
    remoteMiner.memory.homeRoom = "W1N1";
    remoteMiner.memory.targetRoom = "W1N1";
    game.creeps = { "remoteMiner-1": remoteMiner };

    behaviorController.execute(game, memory, { remoteMiner: 1 });

    expect(remoteMiner.pickup).toHaveBeenCalledWith(mockDroppedEnergy);
  });

  it("should not pick up energy if creep is full", () => {
    const harvester = createMockCreep("harvester", "harvest");
    (harvester.store.getFreeCapacity as ReturnType<typeof vi.fn>).mockReturnValue(0);
    game.creeps = { "harvester-1": harvester };

    behaviorController.execute(game, memory, { harvester: 1 });

    // Should not pickup since creep is full
    expect(harvester.pickup).not.toHaveBeenCalled();
  });

  it("should not pick up energy less than minimum threshold", () => {
    const harvester = createMockCreep("harvester", "harvest");
    game.creeps = { "harvester-1": harvester };

    // Mock dropped energy with amount less than 50
    mockDroppedEnergy.amount = 30;

    behaviorController.execute(game, memory, { harvester: 1 });

    // Should not pickup since amount is below threshold (50)
    expect(harvester.pickup).not.toHaveBeenCalled();
  });

  it("should move to dropped energy if not in range", () => {
    const harvester = createMockCreep("harvester", "harvest");
    (harvester.pickup as ReturnType<typeof vi.fn>).mockReturnValue(ERR_NOT_IN_RANGE);
    game.creeps = { "harvester-1": harvester };

    behaviorController.execute(game, memory, { harvester: 1 });

    expect(harvester.pickup).toHaveBeenCalledWith(mockDroppedEnergy);
    expect(harvester.moveTo).toHaveBeenCalledWith(mockDroppedEnergy, expect.objectContaining({ range: 1 }));
  });

  it("multiple creep types should all pick up dropped energy", () => {
    const harvester = createMockCreep("harvester", "harvest");
    const upgrader = createMockCreep("upgrader", "recharge");
    const builder = createMockCreep("builder", "gather");

    game.creeps = {
      "harvester-1": harvester,
      "upgrader-1": upgrader,
      "builder-1": builder
    };

    behaviorController.execute(game, memory, {
      harvester: 1,
      upgrader: 1,
      builder: 1
    });

    // All should attempt to pick up dropped energy
    expect(harvester.pickup).toHaveBeenCalledWith(mockDroppedEnergy);
    expect(upgrader.pickup).toHaveBeenCalledWith(mockDroppedEnergy);
    expect(builder.pickup).toHaveBeenCalledWith(mockDroppedEnergy);
  });
});
