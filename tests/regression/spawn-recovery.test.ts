/**
 * Regression test for spawn recovery and cold boot scenarios.
 * Ensures the SpawnManager handles empty rooms and dynamic body generation correctly.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SpawnManager, type BodyPartConfig } from "@runtime/planning/SpawnManager";

describe("Spawn Recovery and Cold Boot", () => {
  let spawnManager: SpawnManager;
  let mockRoom: Partial<Room>;
  let mockSpawn: Partial<StructureSpawn>;

  beforeEach(() => {
    global.Game = {
      time: 1000
    } as Game;

    global.MAX_CREEP_SIZE = 50;

    spawnManager = new SpawnManager({ maxQueueSize: 20 });

    mockRoom = {
      name: "W1N1",
      energyAvailable: 300,
      energyCapacityAvailable: 550
    };

    mockSpawn = {
      name: "Spawn1",
      room: mockRoom as Room,
      spawning: null,
      spawnCreep: (body: BodyPartConstant[], _name: string, _opts?: SpawnOptions) => {
        // Calculate cost
        const cost = spawnManager.calculateBodyCost(body);
        if ((mockRoom.energyAvailable ?? 0) >= cost) {
          return OK;
        }
        return ERR_NOT_ENOUGH_ENERGY;
      }
    };
  });

  describe("Spawn Queue Management", () => {
    it("should add spawn requests to the queue", () => {
      const bodyConfig: BodyPartConfig = {
        base: [WORK, CARRY, MOVE]
      };

      const requestId = spawnManager.addRequest("harvester", bodyConfig, { role: "harvester" } as CreepMemory, 50);

      expect(requestId).toBeDefined();
      expect(requestId).toMatch(/^spawn-/);

      const stats = spawnManager.getQueueStats();
      expect(stats.size).toBe(1);
    });

    it("should reject requests when queue is full", () => {
      const bodyConfig: BodyPartConfig = {
        base: [WORK, CARRY, MOVE]
      };

      // Fill the queue
      for (let i = 0; i < 20; i++) {
        spawnManager.addRequest("test", bodyConfig, {} as CreepMemory, 50);
      }

      // Try to add one more
      const requestId = spawnManager.addRequest("overflow", bodyConfig, {} as CreepMemory, 50);

      expect(requestId).toBeNull();
    });

    it("should prioritize higher priority requests", () => {
      const bodyConfig: BodyPartConfig = {
        base: [WORK, CARRY, MOVE]
      };

      // Add low priority request
      spawnManager.addRequest("low", bodyConfig, { role: "low" } as CreepMemory, 25);

      // Add high priority request
      spawnManager.addRequest("high", bodyConfig, { role: "high" } as CreepMemory, 75);

      const spawned = spawnManager.processQueue([mockSpawn as StructureSpawn], 0);

      // High priority should spawn first
      expect(spawned[0]).toMatch(/high-/);
    });

    it("should clear expired requests", () => {
      const bodyConfig: BodyPartConfig = {
        base: [WORK, CARRY, MOVE]
      };

      // Add request with deadline in the past
      spawnManager.addRequest("expired", bodyConfig, {} as CreepMemory, 50, Game.time - 10);

      spawnManager.clearExpired();

      const stats = spawnManager.getQueueStats();
      expect(stats.size).toBe(0);
    });
  });

  describe("Dynamic Body Generation", () => {
    it("should generate basic body when only base parts are configured", () => {
      const bodyConfig: BodyPartConfig = {
        base: [WORK, CARRY, MOVE]
      };

      const body = spawnManager.generateBody(bodyConfig, mockRoom as Room);

      expect(body).toEqual([WORK, CARRY, MOVE]);
    });

    it("should scale body with pattern repeats based on available energy", () => {
      mockRoom.energyAvailable = 550;

      const bodyConfig: BodyPartConfig = {
        base: [MOVE],
        pattern: [WORK, CARRY, MOVE],
        maxRepeats: 5
      };

      const body = spawnManager.generateBody(bodyConfig, mockRoom as Room);

      // Base: 1 MOVE (50)
      // Pattern: 1 WORK (100) + 1 CARRY (50) + 1 MOVE (50) = 200
      // Can afford: floor((550 - 50) / 200) = 2 repeats
      // Total: 1 + (3 * 2) = 7 parts
      expect(body.length).toBe(7);
    });

    it("should respect maxRepeats limit", () => {
      mockRoom.energyAvailable = 10000; // Plenty of energy

      const bodyConfig: BodyPartConfig = {
        base: [MOVE],
        pattern: [WORK, MOVE],
        maxRepeats: 3
      };

      const body = spawnManager.generateBody(bodyConfig, mockRoom as Room);

      // Base: 1 MOVE
      // Pattern repeated 3 times: 3 * 2 = 6
      // Total: 1 + 6 = 7 parts
      expect(body.length).toBe(7);
    });

    it("should return empty array when not enough energy for base parts", () => {
      mockRoom.energyAvailable = 50; // Not enough for WORK + CARRY + MOVE

      const bodyConfig: BodyPartConfig = {
        base: [WORK, CARRY, MOVE]
      };

      const body = spawnManager.generateBody(bodyConfig, mockRoom as Room);

      expect(body).toEqual([]);
    });

    it("should enforce MAX_CREEP_SIZE limit", () => {
      mockRoom.energyAvailable = 100000; // Unlimited energy

      const bodyConfig: BodyPartConfig = {
        base: [MOVE],
        pattern: [WORK, MOVE],
        maxRepeats: 100
      };

      const body = spawnManager.generateBody(bodyConfig, mockRoom as Room);

      expect(body.length).toBeLessThanOrEqual(MAX_CREEP_SIZE);
    });
  });

  describe("Cold Boot Scenarios", () => {
    it("should handle empty room with minimal energy", () => {
      mockRoom.energyAvailable = 300; // Just enough for basic harvester

      const bodyConfig: BodyPartConfig = {
        base: [WORK, CARRY, MOVE]
      };

      spawnManager.addRequest("harvester", bodyConfig, { role: "harvester" } as CreepMemory, 100);

      const spawned = spawnManager.processQueue([mockSpawn as StructureSpawn], 0);

      expect(spawned.length).toBe(1);
      expect(spawned[0]).toMatch(/harvester-/);
    });

    it("should wait for energy when room is completely empty", () => {
      mockRoom.energyAvailable = 0;

      const bodyConfig: BodyPartConfig = {
        base: [WORK, CARRY, MOVE]
      };

      spawnManager.addRequest("harvester", bodyConfig, { role: "harvester" } as CreepMemory, 100);

      const spawned = spawnManager.processQueue([mockSpawn as StructureSpawn], 0);

      expect(spawned.length).toBe(0);

      // Simulate energy refill
      mockRoom.energyAvailable = 300;

      const spawned2 = spawnManager.processQueue([mockSpawn as StructureSpawn], 0);
      expect(spawned2.length).toBe(1);
    });

    it("should spawn multiple creeps when multiple spawns are available", () => {
      const mockSpawn2: Partial<StructureSpawn> = {
        name: "Spawn2",
        room: mockRoom as Room,
        spawning: null,
        spawnCreep: mockSpawn.spawnCreep
      };

      mockRoom.energyAvailable = 600; // Enough for two creeps

      const bodyConfig: BodyPartConfig = {
        base: [WORK, CARRY, MOVE]
      };

      spawnManager.addRequest("harvester1", bodyConfig, { role: "harvester" } as CreepMemory, 100);
      spawnManager.addRequest("harvester2", bodyConfig, { role: "harvester" } as CreepMemory, 100);

      const spawned = spawnManager.processQueue([mockSpawn as StructureSpawn, mockSpawn2 as StructureSpawn], 0);

      expect(spawned.length).toBe(2);
    });
  });

  describe("Body Cost Calculation", () => {
    it("should correctly calculate cost for basic body parts", () => {
      const body: BodyPartConstant[] = [WORK, CARRY, MOVE];
      const cost = spawnManager.calculateBodyCost(body);

      // WORK: 100, CARRY: 50, MOVE: 50
      expect(cost).toBe(200);
    });

    it("should correctly calculate cost for complex body", () => {
      const body: BodyPartConstant[] = [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
      const cost = spawnManager.calculateBodyCost(body);

      // WORK: 200, CARRY: 100, MOVE: 150
      expect(cost).toBe(450);
    });

    it("should handle expensive body parts", () => {
      const body: BodyPartConstant[] = [CLAIM, MOVE];
      const cost = spawnManager.calculateBodyCost(body);

      // CLAIM: 600, MOVE: 50
      expect(cost).toBe(650);
    });
  });

  describe("Queue State Management", () => {
    it("should detect pending requests for a role", () => {
      const bodyConfig: BodyPartConfig = {
        base: [WORK, CARRY, MOVE]
      };

      spawnManager.addRequest("harvester", bodyConfig, {} as CreepMemory, 50);

      expect(spawnManager.hasPendingRequest("harvester")).toBe(true);
      expect(spawnManager.hasPendingRequest("builder")).toBe(false);
    });

    it("should clear all requests when clear() is called", () => {
      const bodyConfig: BodyPartConfig = {
        base: [WORK, CARRY, MOVE]
      };

      spawnManager.addRequest("test1", bodyConfig, {} as CreepMemory, 50);
      spawnManager.addRequest("test2", bodyConfig, {} as CreepMemory, 50);

      const stats1 = spawnManager.getQueueStats();
      expect(stats1.size).toBe(2);

      spawnManager.clear();

      const stats2 = spawnManager.getQueueStats();
      expect(stats2.size).toBe(0);
    });
  });
});
