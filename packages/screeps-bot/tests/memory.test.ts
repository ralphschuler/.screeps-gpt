import { describe, it, expect, beforeEach } from "vitest";
import { MemoryManager } from "../src/memory/MemoryManager";
import { createEmptyMemory, validateMemory, migrateMemory } from "../src/memory/types";

describe("MemoryManager", () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager();
    // Reset global Memory mock
    (global as Record<string, unknown>).Memory = {};
  });

  describe("createEmptyMemory", () => {
    it("should create memory with all required fields", () => {
      const memory = createEmptyMemory();
      expect(memory.rooms).toEqual({});
      expect(memory.clusters).toEqual({});
      expect(memory.expansionTargets).toEqual([]);
      expect(memory.warTargets).toEqual([]);
      expect(memory.spawnQueue).toEqual([]);
      expect(memory.config).toBeDefined();
      expect(memory.stats).toBeDefined();
      expect(memory.lastGlobalUpdate).toBe(0);
    });

    it("should include default config", () => {
      const memory = createEmptyMemory();
      expect(memory.config.pheromoneDecayRate).toBe(0.95);
      expect(memory.config.pheromoneDiffusionRate).toBe(0.3);
      expect(memory.config.updateInterval).toBe(5);
      expect(memory.config.threatEscalationThreshold).toBe(2);
      expect(memory.config.cpuBudget).toBe(0.8);
    });

    it("should include empty stats", () => {
      const memory = createEmptyMemory();
      expect(memory.stats.totalCreeps).toBe(0);
      expect(memory.stats.totalRooms).toBe(0);
      expect(memory.stats.totalClusters).toBe(0);
      expect(memory.stats.avgCpuUsage).toBe(0);
      expect(memory.stats.ticksRunning).toBe(0);
    });
  });

  describe("validateMemory", () => {
    it("should return true for valid memory", () => {
      const memory = createEmptyMemory();
      expect(validateMemory(memory)).toBe(true);
    });

    it("should return false for null", () => {
      expect(validateMemory(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(validateMemory(undefined)).toBe(false);
    });

    it("should return false for missing rooms", () => {
      const memory = { ...createEmptyMemory() };
      delete (memory as Record<string, unknown>).rooms;
      expect(validateMemory(memory)).toBe(false);
    });

    it("should return false for non-array expansionTargets", () => {
      const memory = { ...createEmptyMemory(), expansionTargets: {} };
      expect(validateMemory(memory)).toBe(false);
    });
  });

  describe("migrateMemory", () => {
    it("should fill in missing fields", () => {
      const partial = { rooms: { "W1N1": {} } };
      const migrated = migrateMemory(partial as Partial<ReturnType<typeof createEmptyMemory>>);
      expect(migrated.clusters).toEqual({});
      expect(migrated.expansionTargets).toEqual([]);
      expect(migrated.config).toBeDefined();
    });

    it("should preserve existing values", () => {
      const partial = {
        rooms: { "W1N1": { name: "W1N1" } },
        lastGlobalUpdate: 1000
      };
      const migrated = migrateMemory(partial as Partial<ReturnType<typeof createEmptyMemory>>);
      expect(migrated.rooms["W1N1"].name).toBe("W1N1");
      expect(migrated.lastGlobalUpdate).toBe(1000);
    });

    it("should merge config with defaults", () => {
      const partial = {
        config: { cpuBudget: 0.9 }
      };
      const migrated = migrateMemory(partial as Partial<ReturnType<typeof createEmptyMemory>>);
      expect(migrated.config.cpuBudget).toBe(0.9);
      expect(migrated.config.pheromoneDecayRate).toBe(0.95);
    });
  });

  describe("initialize", () => {
    it("should create empty memory when none exists", () => {
      manager.initialize();
      const memory = manager.getMemory();
      expect(memory.rooms).toEqual({});
    });

    it("should only initialize once", () => {
      manager.initialize();
      const firstMemory = manager.getMemory();
      firstMemory.lastGlobalUpdate = 999;

      manager.initialize();
      expect(manager.getMemory().lastGlobalUpdate).toBe(999);
    });
  });

  describe("room state operations", () => {
    beforeEach(() => {
      manager.initialize();
    });

    it("should set room state", () => {
      const state = { name: "W1N1", evolutionStage: "seed" as const, posture: "eco" as const, threatLevel: 0 as const, pheromones: {} as Record<string, number>, lastUpdate: 0 };
      manager.setRoomState("W1N1", state as ReturnType<typeof createEmptyMemory>["rooms"][string]);
      expect(manager.getRoomStates()["W1N1"].name).toBe("W1N1");
    });

    it("should remove room state", () => {
      const state = { name: "W1N1", evolutionStage: "seed" as const, posture: "eco" as const, threatLevel: 0 as const, pheromones: {} as Record<string, number>, lastUpdate: 0 };
      manager.setRoomState("W1N1", state as ReturnType<typeof createEmptyMemory>["rooms"][string]);
      manager.removeRoomState("W1N1");
      expect(manager.getRoomStates()["W1N1"]).toBeUndefined();
    });
  });

  describe("config operations", () => {
    beforeEach(() => {
      manager.initialize();
    });

    it("should get config", () => {
      const config = manager.getConfig();
      expect(config.cpuBudget).toBe(0.8);
    });

    it("should update config", () => {
      manager.updateConfig({ cpuBudget: 0.9 });
      expect(manager.getConfig().cpuBudget).toBe(0.9);
    });
  });

  describe("stats operations", () => {
    beforeEach(() => {
      manager.initialize();
    });

    it("should get stats", () => {
      const stats = manager.getStats();
      expect(stats.ticksRunning).toBe(0);
    });

    it("should update stats", () => {
      manager.updateStats({ totalCreeps: 10, ticksRunning: 100 });
      const stats = manager.getStats();
      expect(stats.totalCreeps).toBe(10);
      expect(stats.ticksRunning).toBe(100);
    });
  });

  describe("global update tick", () => {
    beforeEach(() => {
      manager.initialize();
    });

    it("should set and get last global update", () => {
      manager.setLastGlobalUpdate(5000);
      expect(manager.getLastGlobalUpdate()).toBe(5000);
    });
  });

  describe("reset", () => {
    beforeEach(() => {
      manager.initialize();
    });

    it("should reset memory to defaults", () => {
      manager.updateStats({ ticksRunning: 1000 });
      manager.setLastGlobalUpdate(5000);
      manager.reset();
      expect(manager.getStats().ticksRunning).toBe(0);
      expect(manager.getLastGlobalUpdate()).toBe(0);
    });
  });

  describe("getMemorySizeEstimate", () => {
    beforeEach(() => {
      manager.initialize();
    });

    it("should return size estimate", () => {
      const size = manager.getMemorySizeEstimate();
      expect(size).toBeGreaterThan(0);
    });
  });
});
