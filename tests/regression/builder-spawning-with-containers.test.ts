/**
 * Regression test for builder spawning with containers present.
 * Ensures builders continue to spawn even when the room transitions to container-based economy.
 *
 * Issue: No builders spawned when containers exist near sources
 * Root cause: calculateDynamicRoleMinimums() didn't set builder minimum in container-based economy branch
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RoleControllerManager } from "@runtime/behavior/RoleControllerManager";
import type { GameContext, RoomLike, SpawnLike, SourceLike, StructureLike } from "@runtime/types/GameContext";

describe("Builder Spawning with Containers", () => {
  let behaviorController: RoleControllerManager;
  let mockGame: GameContext;
  let mockMemory: Memory;
  let mockRoom: RoomLike;
  let mockSpawn: SpawnLike;
  let mockSource1: SourceLike;
  let mockSource2: SourceLike;
  let mockContainer1: StructureLike;
  let mockContainer2: StructureLike;

  // Helper to create mock creeps based on role counts
  const createMockCreeps = (roleCounts: Record<string, number>): Record<string, unknown> => {
    const creeps: Record<string, unknown> = {};
    let creepIndex = 0;
    for (const [role, count] of Object.entries(roleCounts)) {
      for (let i = 0; i < count; i++) {
        const creepName = `${role}-${creepIndex++}`;
        creeps[creepName] = {
          name: creepName,
          memory: { role },
          store: {
            getUsedCapacity: () => 0,
            getFreeCapacity: () => 50,
            getCapacity: () => 50
          },
          pos: {
            x: 25,
            y: 25,
            roomName: "W1N1",
            findClosestByPath: () => null
          },
          room: mockRoom
        };
      }
    }
    return creeps;
  };

  beforeEach(() => {
    behaviorController = new RoleControllerManager();

    // Mock RCL 2 room with 2 sources and containers near each source
    mockSource1 = {
      id: "source1" as Id<Source>,
      pos: {
        x: 10,
        y: 10,
        roomName: "W1N1",
        findInRange: (type: FindConstant, range: number, _opts?: Record<string, unknown>) => {
          // Return container near source
          if (type === FIND_STRUCTURES && range === 2) {
            return [mockContainer1];
          }
          return [];
        }
      } as RoomPosition
    } as SourceLike;

    mockSource2 = {
      id: "source2" as Id<Source>,
      pos: {
        x: 40,
        y: 40,
        roomName: "W1N1",
        findInRange: (type: FindConstant, range: number, _opts?: Record<string, unknown>) => {
          // Return container near source
          if (type === FIND_STRUCTURES && range === 2) {
            return [mockContainer2];
          }
          return [];
        }
      } as RoomPosition
    } as SourceLike;

    mockContainer1 = {
      structureType: STRUCTURE_CONTAINER,
      id: "container1" as Id<StructureContainer>
    } as StructureLike;

    mockContainer2 = {
      structureType: STRUCTURE_CONTAINER,
      id: "container2" as Id<StructureContainer>
    } as StructureLike;

    mockRoom = {
      name: "W1N1",
      controller: {
        my: true,
        level: 2 // RCL 2
      },
      energyAvailable: 550, // Full energy to pass reserve checks
      energyCapacityAvailable: 550, // RCL 2 with 5 extensions
      find: (type: FindConstant) => {
        if (type === FIND_SOURCES) {
          return [mockSource1, mockSource2];
        }
        if (type === FIND_MY_SPAWNS) {
          return [mockSpawn];
        }
        return [];
      }
    } as RoomLike;

    mockSpawn = {
      name: "Spawn1",
      id: "spawn1" as Id<StructureSpawn>,
      pos: { x: 25, y: 25, roomName: "W1N1" } as RoomPosition,
      room: mockRoom,
      spawning: null,
      spawnCreep: (body: BodyPartConstant[], _name: string, _opts?: Record<string, unknown>) => {
        // Mock successful spawn and update energy
        const bodyCost = body.reduce((sum, part) => sum + (BODYPART_COST[part] ?? 0), 0);
        mockRoom.energyAvailable = Math.max(0, mockRoom.energyAvailable - bodyCost);
        return OK;
      }
    } as SpawnLike;

    mockGame = {
      time: 1000,
      cpu: {
        limit: 100,
        getUsed: () => 10
      },
      rooms: {
        W1N1: mockRoom
      },
      spawns: {
        Spawn1: mockSpawn
      },
      creeps: {}
    } as GameContext;

    mockMemory = {
      creepCounter: 0,
      roles: {}
    } as Memory;
  });

  it("should spawn builders when containers are present near sources", () => {
    // Initial state: no creeps, containers near sources
    const roleCounts: Record<string, number> = {
      harvester: 0,
      upgrader: 0,
      builder: 0,
      stationaryHarvester: 0,
      hauler: 0,
      repairer: 0
    };

    // Execute multiple times to allow all roles to spawn
    // Since spawning is priority-based, we need multiple ticks
    // Need to provide enough energy to pass reserve checks (cost + 20% reserve)
    for (let i = 0; i < 20; i++) {
      mockGame.time += 1;
      mockRoom.energyAvailable = 600; // Higher energy to pass reserve checks
      behaviorController.execute(mockGame, mockMemory, roleCounts);

      if (roleCounts.builder > 0) {
        break; // Builder spawned, test passes
      }
    }

    // Verify builders were spawned
    expect(roleCounts.builder).toBeGreaterThan(0);
  });

  it("should set builder minimum to 2 when containers are present", () => {
    // This test verifies the internal behavior of calculateDynamicRoleMinimums
    const roleCounts: Record<string, number> = {
      harvester: 4,
      upgrader: 3,
      builder: 0, // No builders yet
      stationaryHarvester: 0,
      hauler: 0,
      repairer: 0
    };

    // Mock energy to allow spawning with reserves
    mockRoom.energyAvailable = 600;

    // Execute behavior controller multiple times
    let builderSpawned = false;
    for (let i = 0; i < 10; i++) {
      mockGame.time += 1;
      mockRoom.energyAvailable = 600;
      const result = behaviorController.execute(mockGame, mockMemory, roleCounts);
      if (result.spawnedCreeps.some(name => name.includes("builder"))) {
        builderSpawned = true;
        break;
      }
    }

    // Should attempt to spawn builders since we're below minimum
    expect(builderSpawned).toBe(true);
  });

  it("should maintain builder spawning even with stationary harvesters and haulers", () => {
    // Scenario: Room has transitioned to container-based economy
    // with stationary harvesters and haulers already present
    const roleCounts: Record<string, number> = {
      harvester: 2,
      upgrader: 4, // Set to 4 to match dynamic scaling for RCL 2 with high energy
      builder: 1, // Only 1 builder (below minimum of 2)
      stationaryHarvester: 2, // One per source
      hauler: 2, // Haulers present
      repairer: 1
    };

    // Create mock creeps to match role counts (excluding complex roles that need Game global)
    const creepCountsForMock = {
      harvester: roleCounts.harvester,
      upgrader: roleCounts.upgrader,
      builder: roleCounts.builder
    };
    mockGame.creeps = createMockCreeps(creepCountsForMock);

    // Execute behavior controller with sufficient energy for reserve check
    mockRoom.energyAvailable = 600;
    const result = behaviorController.execute(mockGame, mockMemory, roleCounts);

    // Should spawn another builder to reach minimum of 2
    const builderSpawned = result.spawnedCreeps.some(name => name.includes("builder"));
    expect(builderSpawned).toBe(true);
  });

  it("should not spawn builders if already at or above minimum", () => {
    const roleCounts: Record<string, number> = {
      harvester: 4,
      upgrader: 3,
      builder: 2, // Already at minimum
      stationaryHarvester: 2,
      hauler: 2,
      repairer: 1
    };

    // Execute behavior controller
    const result = behaviorController.execute(mockGame, mockMemory, roleCounts);

    // Should not spawn more builders
    const builderSpawned = result.spawnedCreeps.some(name => name.includes("builder"));
    expect(builderSpawned).toBe(false);
  });

  it("should include builders in minimum role counts regardless of RCL", () => {
    // This test verifies that builder minimum is set even at low RCL with containers
    // RCL 1 scenario: only spawn, no extensions
    mockRoom.energyCapacityAvailable = 300; // Only spawn capacity
    mockRoom.energyAvailable = 600; // Extra energy to ensure spawning works

    if (mockRoom.controller) {
      mockRoom.controller.level = 1;
    }

    const roleCounts: Record<string, number> = {
      harvester: 4, // Harvesters satisfied
      upgrader: 3, // Upgraders satisfied
      builder: 0, // Start with no builders
      stationaryHarvester: 2,
      hauler: 2,
      repairer: 1 // Repairer satisfied
    };

    // Create mock creeps to match role counts (excluding complex roles that need Game global)
    const creepCountsForMock = {
      harvester: roleCounts.harvester,
      upgrader: roleCounts.upgrader,
      builder: roleCounts.builder
    };
    mockGame.creeps = createMockCreeps(creepCountsForMock);

    // Execute once to check that builder is recognized as needing to spawn
    const result = behaviorController.execute(mockGame, mockMemory, roleCounts);

    // Should attempt to spawn builder (either spawn it or identify it as needed)
    // With all higher priority roles satisfied, builder should be next in queue
    const builderSpawned = result.spawnedCreeps.some(name => name.includes("builder"));
    expect(builderSpawned).toBe(true);
  });

  it("should spawn builders at RCL 2 with realistic energy capacity (550)", () => {
    // This test reproduces the real-world bug where builders cannot spawn at RCL 2
    // because the reserve threshold (110) + body cost (450) exceeds capacity (550)

    // Set realistic RCL 2 values
    mockRoom.energyCapacityAvailable = 550; // RCL 2: 1 spawn + 5 extensions
    mockRoom.energyAvailable = 550; // Full energy, no extra buffer

    if (mockRoom.controller) {
      mockRoom.controller.level = 2;
    }

    const roleCounts: Record<string, number> = {
      harvester: 4, // Harvesters satisfied
      upgrader: 4, // Set to 4 to match dynamic scaling for RCL 2 with high energy
      builder: 0, // No builders yet - needs to spawn
      stationaryHarvester: 2, // Container economy active
      hauler: 2, // Haulers present
      repairer: 1 // Repairer present
    };

    // Create mock creeps to match role counts (excluding complex roles that need Game global)
    const creepCountsForMock = {
      harvester: roleCounts.harvester,
      upgrader: roleCounts.upgrader,
      builder: roleCounts.builder
    };
    mockGame.creeps = createMockCreeps(creepCountsForMock);

    // Execute behavior controller
    const result = behaviorController.execute(mockGame, mockMemory, roleCounts);

    // Builder should spawn even with exact capacity (no extra buffer)
    // The reserve threshold should not block essential infrastructure roles
    const builderSpawned = result.spawnedCreeps.some(name => name.includes("builder"));
    expect(builderSpawned).toBe(true);
  });
});
