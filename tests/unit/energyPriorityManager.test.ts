import { describe, expect, it, vi } from "vitest";
import { EnergyPriorityManager, EnergyPriority, DEFAULT_ENERGY_CONFIG } from "@runtime/energy";
import type { RoomLike } from "@runtime/types/GameContext";

/**
 * Create a mock room for testing
 */
function createMockRoom(config: {
  towers?: { energy: number; capacity: number }[];
  spawns?: { x: number; y: number }[];
  containers?: { x: number; y: number; energy: number; capacity: number }[];
  storage?: { energy: number; capacity: number };
}): RoomLike {
  const towers = (config.towers ?? []).map((t, i) => ({
    structureType: STRUCTURE_TOWER,
    id: `tower-${i}` as Id<StructureTower>,
    store: {
      getUsedCapacity: vi.fn(() => t.energy),
      getCapacity: vi.fn(() => t.capacity),
      getFreeCapacity: vi.fn(() => t.capacity - t.energy)
    }
  }));

  const spawns = (config.spawns ?? []).map((s, i) => ({
    structureType: STRUCTURE_SPAWN,
    id: `spawn-${i}` as Id<StructureSpawn>,
    pos: {
      x: s.x,
      y: s.y,
      isNearTo: vi.fn((pos: { x: number; y: number }) => {
        return Math.abs(pos.x - s.x) <= 1 && Math.abs(pos.y - s.y) <= 1;
      }),
      findInRange: vi.fn((type: FindConstant, range: number, opts?: { filter?: (s: unknown) => boolean }) => {
        if (type === FIND_STRUCTURES && range === 1) {
          const nearbyContainers = (config.containers ?? []).filter(c => {
            const dist = Math.abs(c.x - s.x) + Math.abs(c.y - s.y);
            return dist <= 1;
          });

          const structures = nearbyContainers.map((c, idx) => ({
            structureType: STRUCTURE_CONTAINER,
            id: `container-${idx}` as Id<StructureContainer>,
            pos: { x: c.x, y: c.y },
            store: {
              getUsedCapacity: vi.fn(() => c.energy),
              getCapacity: vi.fn(() => c.capacity),
              getFreeCapacity: vi.fn(() => c.capacity - c.energy)
            }
          }));

          if (opts?.filter) {
            return structures.filter(opts.filter);
          }
          return structures;
        }
        return [];
      })
    }
  }));

  const containers = (config.containers ?? []).map((c, i) => ({
    structureType: STRUCTURE_CONTAINER,
    id: `container-${i}` as Id<StructureContainer>,
    pos: { x: c.x, y: c.y },
    store: {
      getUsedCapacity: vi.fn(() => c.energy),
      getCapacity: vi.fn(() => c.capacity),
      getFreeCapacity: vi.fn(() => c.capacity - c.energy)
    }
  }));

  const storage = config.storage
    ? {
        structureType: STRUCTURE_STORAGE,
        id: "storage-1" as Id<StructureStorage>,
        store: {
          getUsedCapacity: vi.fn(() => config.storage!.energy),
          getCapacity: vi.fn(() => config.storage!.capacity),
          getFreeCapacity: vi.fn(() => config.storage!.capacity - config.storage!.energy)
        }
      }
    : null;

  return {
    name: "W0N0",
    controller: null,
    storage: storage as StructureStorage | undefined,
    find: vi.fn((type: FindConstant, opts?: { filter?: (s: unknown) => boolean }) => {
      if (type === FIND_MY_STRUCTURES) {
        let structures: unknown[] = [...towers, ...spawns];
        if (opts?.filter) {
          return structures.filter(opts.filter);
        }
        return structures;
      }

      if (type === FIND_MY_SPAWNS) {
        return spawns;
      }

      if (type === FIND_STRUCTURES) {
        let structures: unknown[] = [...containers];
        if (storage) {
          structures.push(storage);
        }
        if (opts?.filter) {
          return structures.filter(opts.filter);
        }
        return structures;
      }

      return [];
    })
  };
}

describe("EnergyPriorityManager", () => {
  describe("getTowerEnergyNeeds", () => {
    it("should calculate energy needs for towers below 50% capacity", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        towers: [
          { energy: 250, capacity: 1000 }, // 25% full, needs 250 to reach 50%
          { energy: 600, capacity: 1000 } // 60% full, needs 0
        ]
      });

      const needs = manager.getTowerEnergyNeeds(room);
      expect(needs).toBe(250); // Only first tower needs energy
    });

    it("should return 0 when all towers are above minimum capacity", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        towers: [
          { energy: 500, capacity: 1000 },
          { energy: 750, capacity: 1000 }
        ]
      });

      const needs = manager.getTowerEnergyNeeds(room);
      expect(needs).toBe(0);
    });

    it("should return 0 when room has no towers", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({});

      const needs = manager.getTowerEnergyNeeds(room);
      expect(needs).toBe(0);
    });

    it("should respect custom tower minimum capacity configuration", () => {
      const manager = new EnergyPriorityManager({ towerMinCapacity: 0.8 });
      const room = createMockRoom({
        towers: [{ energy: 500, capacity: 1000 }] // 50% full, needs 300 to reach 80%
      });

      const needs = manager.getTowerEnergyNeeds(room);
      expect(needs).toBe(300);
    });
  });

  describe("getSpawnContainerNeeds", () => {
    it("should calculate energy needs for spawn-adjacent containers", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        spawns: [{ x: 25, y: 25 }],
        containers: [
          { x: 24, y: 25, energy: 100, capacity: 2000 }, // Adjacent, needs 200
          { x: 30, y: 30, energy: 100, capacity: 2000 } // Not adjacent, ignored
        ]
      });

      const needs = manager.getSpawnContainerNeeds(room);
      expect(needs).toBe(200); // 300 reserve - 100 current = 200 needed
    });

    it("should return 0 when spawn containers are above reserve threshold", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        spawns: [{ x: 25, y: 25 }],
        containers: [{ x: 24, y: 25, energy: 500, capacity: 2000 }]
      });

      const needs = manager.getSpawnContainerNeeds(room);
      expect(needs).toBe(0);
    });

    it("should return 0 when room has no spawns", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({});

      const needs = manager.getSpawnContainerNeeds(room);
      expect(needs).toBe(0);
    });

    it("should respect custom spawn container reserve configuration", () => {
      const manager = new EnergyPriorityManager({ spawnContainerReserve: 500 });
      const room = createMockRoom({
        spawns: [{ x: 25, y: 25 }],
        containers: [{ x: 24, y: 25, energy: 200, capacity: 2000 }]
      });

      const needs = manager.getSpawnContainerNeeds(room);
      expect(needs).toBe(300); // 500 reserve - 200 current = 300 needed
    });
  });

  describe("isSpawnContainer", () => {
    it("should identify containers adjacent to spawns", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        spawns: [{ x: 25, y: 25 }],
        containers: [{ x: 24, y: 25, energy: 100, capacity: 2000 }]
      });

      const container = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
      })[0] as StructureContainer;

      expect(manager.isSpawnContainer(container, room)).toBe(true);
    });

    it("should return false for containers not adjacent to spawns", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        spawns: [{ x: 25, y: 25 }],
        containers: [{ x: 30, y: 30, energy: 100, capacity: 2000 }]
      });

      const container = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
      })[0] as StructureContainer;

      expect(manager.isSpawnContainer(container, room)).toBe(false);
    });
  });

  describe("canWithdrawFromContainer", () => {
    it("should allow withdrawal from non-spawn containers", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        spawns: [{ x: 25, y: 25 }],
        containers: [{ x: 30, y: 30, energy: 500, capacity: 2000 }]
      });

      const container = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
      })[0] as StructureContainer;

      expect(manager.canWithdrawFromContainer(container, 500, room)).toBe(true);
    });

    it("should allow withdrawal from spawn containers if reserve is maintained", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        spawns: [{ x: 25, y: 25 }],
        containers: [{ x: 24, y: 25, energy: 500, capacity: 2000 }]
      });

      const container = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
      })[0] as StructureContainer;

      expect(manager.canWithdrawFromContainer(container, 100, room)).toBe(true); // 500 - 100 = 400 > 300
    });

    it("should prevent withdrawal from spawn containers if it violates reserve", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        spawns: [{ x: 25, y: 25 }],
        containers: [{ x: 24, y: 25, energy: 400, capacity: 2000 }]
      });

      const container = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
      })[0] as StructureContainer;

      expect(manager.canWithdrawFromContainer(container, 200, room)).toBe(false); // 400 - 200 = 200 < 300
    });
  });

  describe("calculateEnergyBudget", () => {
    it("should calculate correct budget with critical needs", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        towers: [{ energy: 200, capacity: 1000 }], // Needs 300
        spawns: [{ x: 25, y: 25 }],
        containers: [
          { x: 24, y: 25, energy: 100, capacity: 2000 }, // Spawn container, needs 200
          { x: 30, y: 30, energy: 500, capacity: 2000 } // Regular container
        ],
        storage: { energy: 1000, capacity: 10000 }
      });

      const budget = manager.calculateEnergyBudget(room);
      expect(budget.towersNeed).toBe(300);
      expect(budget.spawnContainersNeed).toBe(200);
      // Total available = 100 + 500 + 1000 = 1600
      // Available for upgrade = 1600 - 300 - 200 = 1100
      expect(budget.availableForUpgrade).toBe(1100);
    });

    it("should return 0 available when critical needs exceed total energy", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        towers: [{ energy: 0, capacity: 1000 }], // Needs 500
        spawns: [{ x: 25, y: 25 }],
        containers: [{ x: 24, y: 25, energy: 100, capacity: 2000 }] // Only 100 available
      });

      const budget = manager.calculateEnergyBudget(room);
      expect(budget.towersNeed).toBe(500);
      expect(budget.spawnContainersNeed).toBe(200);
      expect(budget.availableForUpgrade).toBe(0); // 100 - 500 - 200 = -600, clamped to 0
    });
  });

  describe("hasEnergyForUpgrades", () => {
    it("should allow upgrades when critical needs are minimal", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        towers: [{ energy: 900, capacity: 1000 }], // Needs 0
        spawns: [{ x: 25, y: 25 }],
        containers: [{ x: 24, y: 25, energy: 300, capacity: 2000 }]
      });

      expect(manager.hasEnergyForUpgrades(room)).toBe(true);
    });

    it("should allow upgrades when there is significant surplus", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        towers: [{ energy: 200, capacity: 1000 }], // Needs 300
        spawns: [{ x: 25, y: 25 }],
        containers: [{ x: 30, y: 30, energy: 2000, capacity: 2000 }]
      });

      expect(manager.hasEnergyForUpgrades(room)).toBe(true); // 2000 - 300 = 1700 > 500
    });

    it("should prevent upgrades when critical needs are high and no surplus", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        towers: [{ energy: 200, capacity: 1000 }], // Needs 300
        spawns: [{ x: 25, y: 25 }],
        containers: [
          { x: 24, y: 25, energy: 100, capacity: 2000 }, // Needs 200
          { x: 30, y: 30, energy: 400, capacity: 2000 }
        ]
      });

      expect(manager.hasEnergyForUpgrades(room)).toBe(false); // Total need 500, available 500
    });
  });

  describe("getAvailableEnergySources", () => {
    it("should return all containers and storage when not respecting reserves", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        spawns: [{ x: 25, y: 25 }],
        containers: [
          { x: 24, y: 25, energy: 100, capacity: 2000 },
          { x: 30, y: 30, energy: 500, capacity: 2000 }
        ],
        storage: { energy: 1000, capacity: 10000 }
      });

      const sources = manager.getAvailableEnergySources(room, 0, false);
      expect(sources.length).toBe(3); // 2 containers + storage
    });

    it("should exclude spawn containers below reserve when respecting reserves", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        spawns: [{ x: 25, y: 25 }],
        containers: [
          { x: 24, y: 25, energy: 100, capacity: 2000 }, // Below reserve
          { x: 30, y: 30, energy: 500, capacity: 2000 }
        ],
        storage: { energy: 1000, capacity: 10000 }
      });

      const sources = manager.getAvailableEnergySources(room, 0, true);
      expect(sources.length).toBe(2); // Only non-spawn container + storage
    });

    it("should include spawn containers above reserve when respecting reserves", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        spawns: [{ x: 25, y: 25 }],
        containers: [
          { x: 24, y: 25, energy: 500, capacity: 2000 }, // Above reserve
          { x: 30, y: 30, energy: 500, capacity: 2000 }
        ]
      });

      const sources = manager.getAvailableEnergySources(room, 0, true);
      expect(sources.length).toBe(2); // Both containers
    });

    it("should respect minEnergy threshold", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        containers: [
          { x: 30, y: 30, energy: 50, capacity: 2000 },
          { x: 31, y: 31, energy: 500, capacity: 2000 }
        ]
      });

      const sources = manager.getAvailableEnergySources(room, 100, false);
      expect(sources.length).toBe(1); // Only container with 500 energy
    });
  });

  describe("getMaxWithdrawAmount", () => {
    it("should return full amount for non-spawn containers", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        spawns: [{ x: 25, y: 25 }],
        containers: [{ x: 30, y: 30, energy: 500, capacity: 2000 }]
      });

      const container = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
      })[0] as StructureContainer;

      expect(manager.getMaxWithdrawAmount(container, room)).toBe(500);
    });

    it("should respect reserve for spawn containers", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        spawns: [{ x: 25, y: 25 }],
        containers: [{ x: 24, y: 25, energy: 500, capacity: 2000 }]
      });

      const container = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
      })[0] as StructureContainer;

      expect(manager.getMaxWithdrawAmount(container, room)).toBe(200); // 500 - 300 reserve
    });

    it("should return 0 for spawn containers at or below reserve", () => {
      const manager = new EnergyPriorityManager();
      const room = createMockRoom({
        spawns: [{ x: 25, y: 25 }],
        containers: [{ x: 24, y: 25, energy: 250, capacity: 2000 }]
      });

      const container = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
      })[0] as StructureContainer;

      expect(manager.getMaxWithdrawAmount(container, room)).toBe(0);
    });
  });

  describe("priority constants", () => {
    it("should define correct priority order", () => {
      expect(EnergyPriority.DEFENSE).toBe(0);
      expect(EnergyPriority.SPAWN).toBe(1);
      expect(EnergyPriority.GROWTH).toBe(2);
      expect(EnergyPriority.STORAGE).toBe(3);
    });
  });

  describe("default configuration", () => {
    it("should have expected default values", () => {
      expect(DEFAULT_ENERGY_CONFIG.spawnContainerReserve).toBe(300);
      expect(DEFAULT_ENERGY_CONFIG.towerMinCapacity).toBe(0.5);
    });
  });
});
