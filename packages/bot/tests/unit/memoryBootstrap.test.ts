import { describe, it, expect, vi } from "vitest";
import { MemoryManager } from "../../packages/bot/src/runtime/memory/MemoryManager";

describe("Memory Bootstrapping", () => {
  describe("Memory Initialization", () => {
    it("should initialize empty memory structure", () => {
      const memory: Memory = {} as Memory;
      const creeps: Record<string, { name: string; memory: CreepMemory }> = {};
      const mockLogger = { log: vi.fn() };
      const manager = new MemoryManager(mockLogger);

      manager.pruneMissingCreeps(memory, creeps);
      manager.updateRoleBookkeeping(memory, creeps);

      expect(memory.creeps).toBeDefined();
      expect(memory.roles).toBeDefined();
      expect(memory.roles).toEqual({});
    });

    it("should initialize memory with creeps section", () => {
      const memory: Memory = {} as Memory;
      const creeps = {
        harvester1: { name: "harvester1", memory: { role: "harvester" } as CreepMemory }
      };
      const mockLogger = { log: vi.fn() };
      const manager = new MemoryManager(mockLogger);

      manager.pruneMissingCreeps(memory, creeps);
      const roles = manager.updateRoleBookkeeping(memory, creeps);

      expect(memory.creeps).toBeDefined();
      expect(roles).toEqual({ harvester: 1 });
      expect(memory.roles).toEqual({ harvester: 1 });
    });

    it("should reset stale creep memories", () => {
      const memory: Memory = {
        creeps: {
          oldCreep: { role: "harvester" } as CreepMemory,
          currentCreep: { role: "upgrader" } as CreepMemory
        }
      } as Memory;
      const creeps = {
        currentCreep: { name: "currentCreep", memory: { role: "upgrader" } as CreepMemory }
      };
      const mockLogger = { log: vi.fn() };
      const manager = new MemoryManager(mockLogger);

      const pruned = manager.pruneMissingCreeps(memory, creeps);

      expect(pruned).toEqual(["oldCreep"]);
      expect(memory.creeps).not.toHaveProperty("oldCreep");
      expect(memory.creeps).toHaveProperty("currentCreep");
    });

    it("should maintain room memory across resets", () => {
      const memory: Memory = {
        creeps: {
          oldCreep: { role: "harvester" } as CreepMemory
        },
        rooms: {
          W1N1: { sources: [] }
        }
      } as Memory;
      const creeps: Record<string, { name: string; memory: CreepMemory }> = {};
      const mockLogger = { log: vi.fn() };
      const manager = new MemoryManager(mockLogger);

      manager.pruneMissingCreeps(memory, creeps);

      expect(memory.rooms).toBeDefined();
      expect(memory.rooms?.W1N1).toEqual({ sources: [] });
    });
  });

  describe("Role Bookkeeping", () => {
    it("should count multiple creeps by role", () => {
      const memory: Memory = {} as Memory;
      const creeps = {
        h1: { name: "h1", memory: { role: "harvester" } as CreepMemory },
        h2: { name: "h2", memory: { role: "harvester" } as CreepMemory },
        u1: { name: "u1", memory: { role: "upgrader" } as CreepMemory },
        b1: { name: "b1", memory: { role: "builder" } as CreepMemory }
      };
      const mockLogger = { log: vi.fn() };
      const manager = new MemoryManager(mockLogger);

      const roles = manager.updateRoleBookkeeping(memory, creeps);

      expect(roles).toEqual({
        harvester: 2,
        upgrader: 1,
        builder: 1
      });
      expect(memory.roles).toEqual({
        harvester: 2,
        upgrader: 1,
        builder: 1
      });
    });

    it("should handle creeps without assigned roles", () => {
      const memory: Memory = {} as Memory;
      const creeps = {
        c1: { name: "c1", memory: {} as CreepMemory }
      };
      const mockLogger = { log: vi.fn() };
      const manager = new MemoryManager(mockLogger);

      const roles = manager.updateRoleBookkeeping(memory, creeps);

      expect(roles).toEqual({ unassigned: 1 });
    });

    it("should update role counts on subsequent calls", () => {
      const memory: Memory = {} as Memory;
      const mockLogger = { log: vi.fn() };
      const manager = new MemoryManager(mockLogger);

      const creeps1 = {
        h1: { name: "h1", memory: { role: "harvester" } as CreepMemory }
      };
      manager.updateRoleBookkeeping(memory, creeps1);
      expect(memory.roles).toEqual({ harvester: 1 });

      const creeps2 = {
        h1: { name: "h1", memory: { role: "harvester" } as CreepMemory },
        h2: { name: "h2", memory: { role: "harvester" } as CreepMemory }
      };
      manager.updateRoleBookkeeping(memory, creeps2);
      expect(memory.roles).toEqual({ harvester: 2 });
    });
  });

  describe("Memory Consistency", () => {
    it("should maintain consistency after multiple pruning cycles", () => {
      const memory: Memory = {
        creeps: {
          c1: { role: "harvester" } as CreepMemory,
          c2: { role: "upgrader" } as CreepMemory
        }
      } as Memory;
      const mockLogger = { log: vi.fn() };
      const manager = new MemoryManager(mockLogger);

      // First cycle - remove c1
      const creeps1 = {
        c2: { name: "c2", memory: { role: "upgrader" } as CreepMemory }
      };
      manager.pruneMissingCreeps(memory, creeps1);
      expect(memory.creeps).not.toHaveProperty("c1");
      expect(memory.creeps).toHaveProperty("c2");

      // Second cycle - remove c2
      const creeps2: Record<string, { name: string; memory: CreepMemory }> = {};
      manager.pruneMissingCreeps(memory, creeps2);
      expect(memory.creeps).not.toHaveProperty("c2");
      expect(Object.keys(memory.creeps ?? {})).toHaveLength(0);
    });

    it("should handle undefined creeps memory gracefully", () => {
      const memory: Memory = {} as Memory;
      const creeps: Record<string, { name: string; memory: CreepMemory }> = {};
      const mockLogger = { log: vi.fn() };
      const manager = new MemoryManager(mockLogger);

      expect(() => {
        manager.pruneMissingCreeps(memory, creeps);
        manager.updateRoleBookkeeping(memory, creeps);
      }).not.toThrow();
    });
  });
});
