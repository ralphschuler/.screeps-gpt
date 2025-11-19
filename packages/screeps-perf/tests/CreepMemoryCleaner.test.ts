import { describe, it, expect, beforeEach, vi } from "vitest";
import { cleanUpCreepMemory, setupCreepMemoryCleaner } from "../src/CreepMemoryCleaner";

// Mock Screeps globals
const mockGame = {
  time: 0,
  creeps: {} as Record<string, unknown>
};

const mockMemory = {
  creeps: {} as Record<string, unknown>,
  screepsPerf: undefined as { lastMemoryCleanUp: number } | undefined
};

// Setup global mocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Game = mockGame;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Memory = mockMemory;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).StructureSpawn = {
  prototype: {
    createCreep: vi.fn()
  }
};

describe("CreepMemoryCleaner", () => {
  beforeEach(() => {
    // Reset mocks
    mockGame.time = 0;
    mockGame.creeps = {};
    mockMemory.creeps = {};
    mockMemory.screepsPerf = undefined;
    vi.clearAllMocks();
  });

  describe("cleanUpCreepMemory", () => {
    it("should initialize screepsPerf memory on first run", () => {
      cleanUpCreepMemory();

      expect(Memory.screepsPerf).toBeDefined();
      expect(Memory.screepsPerf?.lastMemoryCleanUp).toBe(0);
    });

    it("should not clean up memory if less than 100 ticks have passed", () => {
      Memory.creeps = { deadCreep: { role: "harvester" } };
      Memory.screepsPerf = { lastMemoryCleanUp: 0 };
      mockGame.time = 50;

      cleanUpCreepMemory();

      expect(Memory.creeps.deadCreep).toBeDefined();
    });

    it("should clean up memory for dead creeps after 100 ticks", () => {
      Memory.creeps = { deadCreep: { role: "harvester" } };
      Memory.screepsPerf = { lastMemoryCleanUp: 0 };
      mockGame.time = 101;
      mockGame.creeps = {}; // No living creeps

      cleanUpCreepMemory();

      expect(Memory.creeps.deadCreep).toBeUndefined();
      expect(Memory.screepsPerf?.lastMemoryCleanUp).toBe(101);
    });

    it("should preserve memory for living creeps", () => {
      const liveCreep = { name: "liveCreep" };
      Memory.creeps = {
        liveCreep: { role: "harvester" },
        deadCreep: { role: "builder" }
      };
      Memory.screepsPerf = { lastMemoryCleanUp: 0 };
      mockGame.time = 101;
      mockGame.creeps = { liveCreep };

      cleanUpCreepMemory();

      expect(Memory.creeps.liveCreep).toBeDefined();
      expect(Memory.creeps.deadCreep).toBeUndefined();
    });

    it("should handle multiple dead creeps", () => {
      Memory.creeps = {
        dead1: { role: "harvester" },
        dead2: { role: "builder" },
        dead3: { role: "upgrader" }
      };
      Memory.screepsPerf = { lastMemoryCleanUp: 0 };
      mockGame.time = 101;
      mockGame.creeps = {};

      cleanUpCreepMemory();

      expect(Object.keys(Memory.creeps)).toHaveLength(0);
    });
  });

  describe("setupCreepMemoryCleaner", () => {
    it("should patch StructureSpawn.prototype.createCreep", () => {
      const originalCreateCreep = StructureSpawn.prototype.createCreep;

      setupCreepMemoryCleaner();

      expect(StructureSpawn.prototype.createCreep).not.toBe(originalCreateCreep);
    });

    it("should call cleanup when createCreep is invoked", () => {
      Memory.creeps = { deadCreep: { role: "harvester" } };
      Memory.screepsPerf = { lastMemoryCleanUp: 0 };
      mockGame.time = 101;
      mockGame.creeps = {};

      setupCreepMemoryCleaner();

      // Create a spawn and call createCreep
      const spawn = Object.create(StructureSpawn.prototype) as StructureSpawn;

      try {
        // This will call our patched version which should trigger cleanup
        spawn.createCreep();
      } catch {
        // Original createCreep may fail in test environment, that's okay
      }

      // Memory should have been cleaned up
      expect(Memory.creeps.deadCreep).toBeUndefined();
    });
  });
});
