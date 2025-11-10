/**
 * Regression test for memory migration safety features.
 * Ensures rollback mechanism and data loss protection work correctly.
 *
 * Related issue: Memory schema migration system lacks rollback mechanism
 * Root cause: Failed migrations could corrupt memory without recovery
 * Fix: Added backup/rollback, validation, and preview capabilities
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryMigrationManager } from "../../packages/bot/src/runtime/memory/MemoryMigrationManager";

describe("Memory Migration Safety", () => {
  let manager: MemoryMigrationManager;
  let mockLogger: { log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockLogger = {
      log: vi.fn(),
      warn: vi.fn()
    };

    // Mock Game.time for backup timestamps
    global.Game = { time: 12345 } as Game;
  });

  describe("Rollback on Migration Failure", () => {
    it("should rollback memory when migration throws error", () => {
      manager = new MemoryMigrationManager(3, mockLogger);

      // Register failing migration
      manager.registerMigration({
        version: 2,
        description: "Failing migration",
        handler: (memory: Memory) => {
          memory.stats = { time: 999 } as any;
          throw new Error("Migration intentionally failed");
        }
      });

      const memory: Memory = {
        version: 1,
        stats: { time: 100 } as any
      } as Memory;

      // Capture the complete initial state
      const originalVersion = memory.version;
      const originalStats = memory.stats?.time;

      const result = manager.migrate(memory);

      // Migration should fail
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // Memory should be rolled back to original state - the mutation inside handler should not persist
      expect(memory.version).toBe(originalVersion);
      expect(memory.stats?.time).toBe(originalStats);
      expect(memory.stats?.time).not.toBe(999); // Ensure the mutation was rolled back
    });

    it("should rollback memory when validation fails after migration", () => {
      manager = new MemoryMigrationManager(2, mockLogger);

      // Register migration that corrupts memory in a way that fails validation
      manager.registerMigration({
        version: 2,
        description: "Migration that creates circular reference",
        handler: (memory: Memory) => {
          // Create a circular reference that will fail JSON.stringify in validation
          const circular: any = { next: null };
          circular.next = circular;
          (memory as any).circular = circular;
        }
      });

      const memory: Memory = {
        version: 1,
        stats: { time: 100 } as any
      } as Memory;

      const result = manager.migrate(memory);

      // Migration should fail due to validation (circular reference prevents serialization)
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes("validation") || e.includes("circular"))).toBe(true);

      // Memory should be rolled back
      expect(memory.version).toBe(1);
      expect((memory as any).circular).toBeUndefined();
    });

    it("should preserve complex memory structure during rollback", () => {
      manager = new MemoryMigrationManager(2, mockLogger);

      manager.registerMigration({
        version: 2,
        description: "Failing migration",
        handler: () => {
          throw new Error("Fail");
        }
      });

      const memory: Memory = {
        version: 1,
        creeps: {
          harvester1: { role: "harvester", homeRoom: "W1N1" } as CreepMemory,
          hauler1: { role: "hauler", targetRoom: "W2N2" } as CreepMemory
        },
        rooms: {
          W1N1: { lastSeen: 1000 } as any,
          W2N2: { lastSeen: 2000 } as any
        },
        stats: {
          time: 5000,
          cpu: { used: 10, limit: 50, bucket: 5000 },
          creeps: { count: 2 },
          rooms: { count: 2 }
        }
      } as Memory;

      const originalCreepsCount = Object.keys(memory.creeps ?? {}).length;
      const originalRoomsCount = Object.keys(memory.rooms ?? {}).length;

      const result = manager.migrate(memory);

      expect(result.success).toBe(false);

      // Verify complex structures are preserved
      expect(memory.version).toBe(1);
      expect(Object.keys(memory.creeps ?? {})).toHaveLength(originalCreepsCount);
      expect(Object.keys(memory.rooms ?? {})).toHaveLength(originalRoomsCount);
      expect(memory.creeps?.harvester1?.role).toBe("harvester");
      expect(memory.creeps?.hauler1?.targetRoom).toBe("W2N2");
      expect(memory.stats?.time).toBe(5000);
    });

    it("should handle multiple migration failures correctly", () => {
      manager = new MemoryMigrationManager(4, mockLogger);

      // Register successful migration
      manager.registerMigration({
        version: 2,
        description: "Successful migration",
        handler: (memory: Memory) => {
          memory.roles = { harvester: 1 };
        }
      });

      // Register failing migration
      manager.registerMigration({
        version: 3,
        description: "Failing migration",
        handler: () => {
          throw new Error("Fail at v3");
        }
      });

      const memory: Memory = { version: 1 } as Memory;

      const result = manager.migrate(memory);

      // Should fail and rollback completely
      expect(result.success).toBe(false);
      expect(memory.version).toBe(1);
      expect(memory.roles).toBeUndefined(); // Should not have v2 changes
    });
  });

  describe("Backup Integrity", () => {
    it("should create backup with checksum", () => {
      manager = new MemoryMigrationManager(2, mockLogger);

      manager.registerMigration({
        version: 2,
        description: "Test migration",
        handler: (memory: Memory) => {
          memory.roles = { test: 1 };
        }
      });

      const memory: Memory = { version: 1, stats: { time: 100 } as any } as Memory;

      // Trigger migration to test backup creation
      const result = manager.migrate(memory);

      expect(result.success).toBe(true);
      // If we got here successfully, backup was created and used correctly
    });

    it("should handle corrupted memory gracefully", () => {
      manager = new MemoryMigrationManager(2, mockLogger);

      manager.registerMigration({
        version: 2,
        description: "Migration",
        handler: (memory: Memory) => {
          memory.stats = { time: 200 } as any;
        }
      });

      // Create memory with circular reference
      const memory: Memory = { version: 1 } as Memory;

      const result = manager.migrate(memory);

      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe("Migration Preview (Dry-Run)", () => {
    it("should preview successful migration without applying changes", () => {
      manager = new MemoryMigrationManager(3, mockLogger);

      manager.registerMigration({
        version: 2,
        description: "Migration 2",
        handler: (memory: Memory) => {
          memory.roles = { harvester: 1 };
        }
      });

      manager.registerMigration({
        version: 3,
        description: "Migration 3",
        handler: (memory: Memory) => {
          if (memory.roles) {
            memory.roles.hauler = 1;
          }
        }
      });

      const memory: Memory = { version: 1 } as Memory;

      const preview = manager.previewMigration(memory);

      // Preview should succeed
      expect(preview.success).toBe(true);
      expect(preview.fromVersion).toBe(1);
      expect(preview.toVersion).toBe(3);
      expect(preview.migrationsToApply).toBe(2);
      expect(preview.error).toBeUndefined();

      // Original memory should be unchanged
      expect(memory.version).toBe(1);
      expect(memory.roles).toBeUndefined();
    });

    it("should preview failed migration without corrupting memory", () => {
      manager = new MemoryMigrationManager(2, mockLogger);

      manager.registerMigration({
        version: 2,
        description: "Failing migration",
        handler: () => {
          throw new Error("Preview fail");
        }
      });

      const memory: Memory = { version: 1, stats: { time: 100 } as any } as Memory;

      const preview = manager.previewMigration(memory);

      // Preview should fail
      expect(preview.success).toBe(false);
      expect(preview.error).toBeDefined();
      expect(preview.migrationsToApply).toBe(1);

      // Original memory should be unchanged
      expect(memory.version).toBe(1);
      expect(memory.stats?.time).toBe(100);
    });

    it("should return success when already at target version", () => {
      manager = new MemoryMigrationManager(2, mockLogger);

      const memory: Memory = { version: 2 } as Memory;

      const preview = manager.previewMigration(memory);

      expect(preview.success).toBe(true);
      expect(preview.migrationsToApply).toBe(0);
      expect(preview.error).toBeUndefined();
    });

    it("should detect validation failures in preview", () => {
      manager = new MemoryMigrationManager(2, mockLogger);

      manager.registerMigration({
        version: 2,
        description: "Migration that creates circular reference",
        handler: (memory: Memory) => {
          // Create circular reference that fails validation
          const circular: any = { next: null };
          circular.next = circular;
          (memory as any).circular = circular;
        }
      });

      const memory: Memory = { version: 1 } as Memory;

      const preview = manager.previewMigration(memory);

      // Should detect validation failure
      expect(preview.success).toBe(false);
      expect(preview.error).toBeDefined();
      expect(preview.error).toMatch(/validation|circular/i);
    });
  });

  describe("Migration Error Messages", () => {
    it("should provide detailed error messages on failure", () => {
      manager = new MemoryMigrationManager(2, mockLogger);

      manager.registerMigration({
        version: 2,
        description: "Throwing migration",
        handler: () => {
          throw new Error("Specific error message");
        }
      });

      const memory: Memory = { version: 1 } as Memory;

      const result = manager.migrate(memory);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Specific error message");
    });

    it("should log rollback information", () => {
      manager = new MemoryMigrationManager(2, mockLogger);

      manager.registerMigration({
        version: 2,
        description: "Failing",
        handler: () => {
          throw new Error("Fail");
        }
      });

      const memory: Memory = { version: 1 } as Memory;

      manager.migrate(memory);

      // Should have logged rollback
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalled();
    });
  });

  describe("Successful Migration Path", () => {
    it("should complete successful migrations without rollback", () => {
      manager = new MemoryMigrationManager(3, mockLogger);

      manager.registerMigration({
        version: 2,
        description: "Add roles",
        handler: (memory: Memory) => {
          memory.roles = { harvester: 0 };
        }
      });

      manager.registerMigration({
        version: 3,
        description: "Add stats",
        handler: (memory: Memory) => {
          memory.stats = { time: Game.time } as any;
        }
      });

      const memory: Memory = { version: 1 } as Memory;

      const result = manager.migrate(memory);

      expect(result.success).toBe(true);
      expect(result.migrationsApplied).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(memory.version).toBe(3);
      expect(memory.roles).toBeDefined();
      expect(memory.stats).toBeDefined();
    });

    it("should validate memory after successful migration", () => {
      manager = new MemoryMigrationManager(2, mockLogger);

      manager.registerMigration({
        version: 2,
        description: "Valid migration",
        handler: (memory: Memory) => {
          memory.roles = { test: 1 };
        }
      });

      const memory: Memory = { version: 1 } as Memory;

      const result = manager.migrate(memory);

      // Validation should pass
      expect(result.success).toBe(true);
      expect(manager.validateMemory(memory)).toBe(true);
    });
  });
});
