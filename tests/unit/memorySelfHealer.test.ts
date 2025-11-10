import { describe, it, expect, vi } from "vitest";
import { MemorySelfHealer } from "../../packages/bot/src/runtime/memory/MemorySelfHealer";

describe("MemorySelfHealer", () => {
  describe("Healthy Memory", () => {
    it("should pass health check for valid memory structure", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        version: 1,
        creeps: {
          harvester1: { role: "harvester" } as CreepMemory
        },
        roles: { harvester: 1 },
        rooms: {},
        respawn: {
          needsRespawn: false,
          respawnRequested: false
        }
      } as Memory;

      const result = healer.checkAndRepair(memory);

      expect(result.isHealthy).toBe(true);
      expect(result.issuesFound).toHaveLength(0);
      expect(result.issuesRepaired).toHaveLength(0);
      expect(result.requiresReset).toBe(false);
    });

    it("should not log anything for healthy memory", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({ logRepairs: true }, mockLogger);

      const memory: Memory = {
        creeps: {},
        roles: {},
        rooms: {},
        respawn: {
          needsRespawn: false,
          respawnRequested: false
        }
      } as Memory;

      healer.checkAndRepair(memory);

      expect(mockLogger.log).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe("Missing Structures", () => {
    it("should repair missing Memory.creeps", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {} as Memory;
      const result = healer.checkAndRepair(memory);

      expect(memory.creeps).toBeDefined();
      expect(memory.creeps).toEqual({});
      expect(result.issuesFound).toContain("Memory.creeps is missing");
      expect(result.issuesRepaired).toContain("Initialized Memory.creeps");
      expect(result.isHealthy).toBe(false);
    });

    it("should repair missing Memory.roles", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        creeps: {}
      } as Memory;
      const result = healer.checkAndRepair(memory);

      expect(memory.roles).toBeDefined();
      expect(memory.roles).toEqual({});
      expect(result.issuesFound).toContain("Memory.roles is missing");
      expect(result.issuesRepaired).toContain("Initialized Memory.roles");
    });

    it("should repair missing Memory.rooms", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        creeps: {},
        roles: {}
      } as Memory;
      const result = healer.checkAndRepair(memory);

      expect(memory.rooms).toBeDefined();
      expect(memory.rooms).toEqual({});
      expect(result.issuesFound).toContain("Memory.rooms is missing");
      expect(result.issuesRepaired).toContain("Initialized Memory.rooms");
    });

    it("should repair missing Memory.respawn", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        creeps: {},
        roles: {},
        rooms: {}
      } as Memory;
      const result = healer.checkAndRepair(memory);

      expect(memory.respawn).toBeDefined();
      expect(memory.respawn).toEqual({
        needsRespawn: false,
        respawnRequested: false
      });
      expect(result.issuesFound).toContain("Memory.respawn is missing");
      expect(result.issuesRepaired).toContain("Initialized Memory.respawn");
    });

    it("should repair all missing core structures at once", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {} as Memory;
      const result = healer.checkAndRepair(memory);

      expect(memory.creeps).toEqual({});
      expect(memory.roles).toEqual({});
      expect(memory.rooms).toEqual({});
      expect(memory.respawn).toEqual({
        needsRespawn: false,
        respawnRequested: false
      });
      expect(result.issuesFound.length).toBeGreaterThanOrEqual(4);
      expect(result.issuesRepaired.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Invalid Types", () => {
    it("should repair Memory.creeps when it is not an object", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        creeps: "invalid" as any
      } as Memory;
      const result = healer.checkAndRepair(memory);

      expect(memory.creeps).toEqual({});
      expect(result.issuesFound).toContain("Memory.creeps is not a valid object");
      expect(result.issuesRepaired).toContain("Reset Memory.creeps to empty object");
    });

    it("should repair Memory.creeps when it is an array", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        creeps: [] as any
      } as Memory;
      const result = healer.checkAndRepair(memory);

      expect(memory.creeps).toEqual({});
      expect(result.issuesFound).toContain("Memory.creeps is not a valid object");
    });

    it("should repair Memory.roles when it is not an object", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        creeps: {},
        roles: 123 as any
      } as Memory;
      const result = healer.checkAndRepair(memory);

      expect(memory.roles).toEqual({});
      expect(result.issuesFound).toContain("Memory.roles is not a valid object");
      expect(result.issuesRepaired).toContain("Reset Memory.roles to empty object");
    });

    it("should repair Memory.respawn when it is not an object", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        creeps: {},
        roles: {},
        rooms: {},
        respawn: "invalid" as any
      } as Memory;
      const result = healer.checkAndRepair(memory);

      expect(memory.respawn).toEqual({
        needsRespawn: false,
        respawnRequested: false
      });
      expect(result.issuesFound).toContain("Memory.respawn is not a valid object");
      expect(result.issuesRepaired).toContain("Reset Memory.respawn to default state");
    });
  });

  describe("Invalid Field Values", () => {
    it("should remove invalid creep memory entries", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        creeps: {
          valid: { role: "harvester" } as CreepMemory,
          invalid: null as any,
          alsoInvalid: "not an object" as any
        },
        roles: {},
        rooms: {},
        respawn: {
          needsRespawn: false,
          respawnRequested: false
        }
      } as Memory;

      const result = healer.checkAndRepair(memory);

      expect(memory.creeps).toHaveProperty("valid");
      expect(memory.creeps).not.toHaveProperty("invalid");
      expect(memory.creeps).not.toHaveProperty("alsoInvalid");
      expect(result.issuesFound.length).toBeGreaterThanOrEqual(2);
      expect(result.issuesRepaired.length).toBeGreaterThanOrEqual(2);
    });

    it("should remove invalid role counts", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        creeps: {},
        roles: {
          harvester: 5,
          invalid: -1,
          alsoInvalid: "not a number" as any,
          infinity: Infinity
        },
        rooms: {},
        respawn: {
          needsRespawn: false,
          respawnRequested: false
        }
      } as Memory;

      const result = healer.checkAndRepair(memory);

      expect(memory.roles).toHaveProperty("harvester");
      expect(memory.roles?.harvester).toBe(5);
      expect(memory.roles).not.toHaveProperty("invalid");
      expect(memory.roles).not.toHaveProperty("alsoInvalid");
      expect(memory.roles).not.toHaveProperty("infinity");
      expect(result.issuesFound.length).toBeGreaterThanOrEqual(3);
    });

    it("should repair invalid respawn fields", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        creeps: {},
        roles: {},
        rooms: {},
        respawn: {
          needsRespawn: "yes" as any,
          respawnRequested: 123 as any,
          lastSpawnLostTick: "not a number" as any
        }
      } as Memory;

      const result = healer.checkAndRepair(memory);

      expect(memory.respawn?.needsRespawn).toBe(false);
      expect(memory.respawn?.respawnRequested).toBe(false);
      expect(memory.respawn?.lastSpawnLostTick).toBeUndefined();
      expect(result.issuesFound.length).toBeGreaterThanOrEqual(3);
      expect(result.issuesRepaired.length).toBeGreaterThanOrEqual(3);
    });

    it("should remove invalid Memory.version", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        version: "not a number" as any,
        creeps: {},
        roles: {},
        rooms: {},
        respawn: {
          needsRespawn: false,
          respawnRequested: false
        }
      } as Memory;

      const result = healer.checkAndRepair(memory);

      expect(memory.version).toBeUndefined();
      expect(result.issuesFound).toContain("Memory.version is not a number");
      expect(result.issuesRepaired).toContain(
        "Removed invalid Memory.version (will be initialized by migration manager)"
      );
    });
  });

  describe("Optional Structures", () => {
    it("should not require Memory.stats to be present", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        creeps: {},
        roles: {},
        rooms: {},
        respawn: {
          needsRespawn: false,
          respawnRequested: false
        }
      } as Memory;

      const result = healer.checkAndRepair(memory);

      expect(result.isHealthy).toBe(true);
      expect(memory.stats).toBeUndefined();
    });

    it("should remove invalid Memory.stats", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        creeps: {},
        roles: {},
        rooms: {},
        respawn: {
          needsRespawn: false,
          respawnRequested: false
        },
        stats: "invalid" as any
      } as Memory;

      const result = healer.checkAndRepair(memory);

      expect(memory.stats).toBeUndefined();
      expect(result.issuesFound).toContain("Memory.stats is not a valid object");
      expect(result.issuesRepaired).toContain("Removed invalid Memory.stats");
    });

    it("should not require Memory.systemReport to be present", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        creeps: {},
        roles: {},
        rooms: {},
        respawn: {
          needsRespawn: false,
          respawnRequested: false
        }
      } as Memory;

      const result = healer.checkAndRepair(memory);

      expect(result.isHealthy).toBe(true);
      expect(memory.systemReport).toBeUndefined();
    });

    it("should remove invalid Memory.systemReport", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        creeps: {},
        roles: {},
        rooms: {},
        respawn: {
          needsRespawn: false,
          respawnRequested: false
        },
        systemReport: [] as any
      } as Memory;

      const result = healer.checkAndRepair(memory);

      expect(memory.systemReport).toBeUndefined();
      expect(result.issuesFound).toContain("Memory.systemReport is not a valid object");
      expect(result.issuesRepaired).toContain("Removed invalid Memory.systemReport");
    });
  });

  describe("Circular References", () => {
    it("should detect circular references", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: any = {
        creeps: {},
        roles: {},
        rooms: {}
      };
      memory.circular = memory; // Create circular reference

      const result = healer.checkAndRepair(memory);

      expect(result.requiresReset).toBe(true);
      expect(result.isHealthy).toBe(false);
      expect(result.issuesFound).toContain("Memory contains circular references or unserializable data");
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[MemorySelfHealer] CRITICAL: Memory is not serializable. Manual reset recommended. Continuing with unreliable memory state."
      );
    });
  });

  describe("Configuration", () => {
    it("should respect autoRepair=false setting", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({ autoRepair: false }, mockLogger);

      const memory: Memory = {} as Memory;
      const result = healer.checkAndRepair(memory);

      expect(memory.creeps).toBeUndefined();
      expect(memory.roles).toBeUndefined();
      expect(result.issuesFound.length).toBeGreaterThan(0);
      expect(result.issuesRepaired).toHaveLength(0);
    });

    it("should respect logRepairs=false setting", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({ logRepairs: false }, mockLogger);

      const memory: Memory = {} as Memory;
      healer.checkAndRepair(memory);

      expect(mockLogger.log).not.toHaveBeenCalled();
    });

    it("should log repair summary when logRepairs=true", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({ logRepairs: true }, mockLogger);

      const memory: Memory = {} as Memory;
      healer.checkAndRepair(memory);

      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringMatching(/\[MemorySelfHealer\] Found .+ repaired/));
    });
  });

  describe("Emergency Reset", () => {
    it("should perform emergency reset", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        version: 5,
        creeps: { badData: "invalid" as any },
        roles: { badRole: -99 },
        rooms: { badRoom: [] as any },
        stats: { corrupted: true } as any,
        respawn: "broken" as any
      } as Memory;

      healer.emergencyReset(memory);

      expect(memory.version).toBe(5); // Version should be preserved
      expect(memory.creeps).toEqual({});
      expect(memory.roles).toEqual({});
      expect(memory.rooms).toEqual({});
      expect(memory.respawn).toEqual({
        needsRespawn: false,
        respawnRequested: false
      });
      expect(memory.stats).toBeUndefined();

      expect(mockLogger.warn).toHaveBeenCalledWith("[MemorySelfHealer] Performing emergency memory reset");
      expect(mockLogger.log).toHaveBeenCalledWith(
        "[MemorySelfHealer] Emergency reset complete. Memory restored to safe defaults."
      );
    });

    it("should initialize version if not present during emergency reset", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {} as Memory;
      healer.emergencyReset(memory);

      expect(memory.version).toBeUndefined(); // Should be left for migration manager
      expect(memory.creeps).toEqual({});
      expect(memory.roles).toEqual({});
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle partial corruption gracefully", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        version: 1,
        creeps: {
          good1: { role: "harvester" } as CreepMemory,
          bad: null as any,
          good2: { role: "upgrader" } as CreepMemory
        },
        roles: {
          harvester: 1,
          invalid: Infinity,
          upgrader: 1
        },
        rooms: {},
        respawn: {
          needsRespawn: false,
          respawnRequested: false
        }
      } as Memory;

      const result = healer.checkAndRepair(memory);

      expect(memory.creeps?.good1).toBeDefined();
      expect(memory.creeps?.good2).toBeDefined();
      expect(memory.creeps).not.toHaveProperty("bad");
      expect(memory.roles?.harvester).toBe(1);
      expect(memory.roles?.upgrader).toBe(1);
      expect(memory.roles).not.toHaveProperty("invalid");
      expect(result.isHealthy).toBe(false);
      expect(result.issuesFound.length).toBeGreaterThan(0);
      expect(result.issuesRepaired.length).toBeGreaterThan(0);
    });

    it("should handle complete corruption requiring reset", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: any = {};
      memory.self = memory; // Circular reference

      const result = healer.checkAndRepair(memory);

      expect(result.requiresReset).toBe(true);
      expect(result.isHealthy).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should validate respawn with valid lastSpawnLostTick", () => {
      const mockLogger = { log: vi.fn(), warn: vi.fn() };
      const healer = new MemorySelfHealer({}, mockLogger);

      const memory: Memory = {
        creeps: {},
        roles: {},
        rooms: {},
        respawn: {
          needsRespawn: true,
          respawnRequested: true,
          lastSpawnLostTick: 12345
        }
      } as Memory;

      const result = healer.checkAndRepair(memory);

      expect(result.isHealthy).toBe(true);
      expect(memory.respawn?.lastSpawnLostTick).toBe(12345);
    });
  });
});
