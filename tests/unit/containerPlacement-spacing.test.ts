/**
 * Unit test for ContainerPlacement spacing requirement.
 *
 * Verifies that containers are placed 1 space away from energy sources (range 2),
 * not adjacent to them (range 1).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ContainerPlacement } from "@runtime/infrastructure/ContainerPlacement";

describe("ContainerPlacement Spacing", () => {
  let containerPlacement: ContainerPlacement;
  let mockRoom: Partial<Room>;
  let mockSource: Source;
  let mockSpawn: StructureSpawn;

  beforeEach(() => {
    // Setup global constants
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).LOOK_STRUCTURES = "structure";

    const mockLogger = { log: vi.fn(), warn: vi.fn() };
    containerPlacement = new ContainerPlacement(mockLogger);

    // Create mock spawn
    mockSpawn = {
      id: "spawn-1" as Id<StructureSpawn>,
      pos: {
        x: 15,
        y: 15,
        roomName: "W1N1",
        getRangeTo: vi.fn((pos: RoomPosition) => {
          const dx = Math.abs(pos.x - 15);
          const dy = Math.abs(pos.y - 15);
          return Math.max(dx, dy);
        })
      } as RoomPosition,
      room: {} as Room
    } as StructureSpawn;

    // Create mock source
    mockSource = {
      id: "source-1" as Id<Source>,
      pos: {
        x: 25,
        y: 25,
        roomName: "W1N1",
        findInRange: vi.fn((_findConstant: FindConstant, _range: number) => {
          return []; // No existing containers or sites
        })
      } as RoomPosition,
      energy: 3000,
      energyCapacity: 3000
    } as Source;

    // Create mock room
    mockRoom = {
      name: "W1N1",
      controller: {
        my: true,
        level: 3
      } as StructureController,
      find: vi.fn((findConstant: FindConstant) => {
        if (findConstant === FIND_SOURCES) {
          return [mockSource];
        }
        if (findConstant === FIND_MY_SPAWNS) {
          return [mockSpawn];
        }
        return [];
      }),
      getTerrain: vi.fn(() => ({
        get: vi.fn(() => 0) // All walkable
      })),
      createConstructionSite: vi.fn(() => OK),
      lookForAt: vi.fn(() => [])
    } as Partial<Room>;

    // Setup RoomPosition constructor mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).RoomPosition = class {
      public x: number;
      public y: number;
      public roomName: string;

      public constructor(x: number, y: number, roomName: string) {
        this.x = x;
        this.y = y;
        this.roomName = roomName;
      }

      public lookFor() {
        return [];
      }
    };
  });

  it("should plan containers at range 2 from source (1 space away)", () => {
    const result = containerPlacement.planSourceContainers(mockRoom as Room);

    expect(result).toBe(1);
    expect(mockRoom.createConstructionSite).toHaveBeenCalled();

    // Get the position where container was planned
    const createCall = (mockRoom.createConstructionSite as ReturnType<typeof vi.fn>).mock.calls[0];
    const containerX = createCall[0] as number;
    const containerY = createCall[1] as number;

    // Calculate distance from source (25, 25)
    const dx = Math.abs(containerX - 25);
    const dy = Math.abs(containerY - 25);
    const chebyshevDistance = Math.max(dx, dy);

    // Should be at range 2 (1 space away)
    expect(chebyshevDistance).toBe(2);
  });

  it("should not place container adjacent to source (range 1)", () => {
    const result = containerPlacement.planSourceContainers(mockRoom as Room);

    expect(result).toBe(1);

    const createCall = (mockRoom.createConstructionSite as ReturnType<typeof vi.fn>).mock.calls[0];
    const containerX = createCall[0] as number;
    const containerY = createCall[1] as number;

    // Calculate distance from source
    const dx = Math.abs(containerX - 25);
    const dy = Math.abs(containerY - 25);
    const chebyshevDistance = Math.max(dx, dy);

    // Should NOT be range 1 (adjacent)
    expect(chebyshevDistance).not.toBe(1);
    expect(chebyshevDistance).not.toBe(0);
  });

  it("should detect existing containers at range 2", () => {
    // Mock an existing container at range 2
    (mockSource.pos.findInRange as ReturnType<typeof vi.fn>).mockImplementation(
      (findConstant: FindConstant, range: number) => {
        if (range === 2 && findConstant === FIND_STRUCTURES) {
          return [{ structureType: STRUCTURE_CONTAINER }];
        }
        return [];
      }
    );

    const result = containerPlacement.planSourceContainers(mockRoom as Room);

    // Should not plan a new container since one exists at range 2
    expect(result).toBe(0);
    expect(mockRoom.createConstructionSite).not.toHaveBeenCalled();
  });

  it("should choose position closest to spawn among range 2 positions", () => {
    const result = containerPlacement.planSourceContainers(mockRoom as Room);

    expect(result).toBe(1);

    const createCall = (mockRoom.createConstructionSite as ReturnType<typeof vi.fn>).mock.calls[0];
    const containerX = createCall[0] as number;
    const containerY = createCall[1] as number;

    // Container should be on the side closer to spawn (15, 15)
    // Source is at (25, 25), so container should be towards the top-left
    expect(containerX).toBeLessThanOrEqual(25);
    expect(containerY).toBeLessThanOrEqual(25);
  });

  it("should not place container at RCL 1", () => {
    mockRoom.controller = {
      my: true,
      level: 1
    } as StructureController;

    const result = containerPlacement.planSourceContainers(mockRoom as Room);

    expect(result).toBe(0);
    expect(mockRoom.createConstructionSite).not.toHaveBeenCalled();
  });
});
