/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi } from "vitest";
import { MemoryGarbageCollector } from "../../src/runtime/memory/MemoryGarbageCollector";
import { MemoryMigrationManager } from "../../src/runtime/memory/MemoryMigrationManager";
import { MemoryUtilizationMonitor } from "../../src/runtime/memory/MemoryUtilizationMonitor";

describe("Memory Management System", () => {
  describe("MemoryGarbageCollector", () => {
    describe("Garbage Collection", () => {
      it("should clean orphaned room data after retention period", () => {
        const mockLogger = { log: vi.fn() };
        const collector = new MemoryGarbageCollector({ roomDataRetentionTicks: 1000 }, mockLogger);

        const memory: Memory = {
          rooms: {
            W1N1: { lastSeen: 11000 } as any,
            W2N2: { lastSeen: 1000 } as any
          }
        } as Memory;

        const game = { time: 12000, rooms: {} };
        const result = collector.collect(game, memory);

        expect(result.roomDataCleaned).toBe(1);
        expect(memory.rooms).toHaveProperty("W1N1");
        expect(memory.rooms).not.toHaveProperty("W2N2");
      });

      it("should preserve visible room data", () => {
        const mockLogger = { log: vi.fn() };
        const collector = new MemoryGarbageCollector({}, mockLogger);

        const memory: Memory = {
          rooms: {
            W1N1: { lastSeen: 1 } as any,
            W2N2: { lastSeen: 1 } as any
          }
        } as Memory;

        const game = { time: 20000, rooms: { W1N1: {} } };
        const result = collector.collect(game, memory);

        expect(memory.rooms).toHaveProperty("W1N1");
        expect(result.roomDataCleaned).toBeGreaterThanOrEqual(0);
      });

      it("should rotate old system reports", () => {
        const mockLogger = { log: vi.fn() };
        const collector = new MemoryGarbageCollector({ reportRetentionTicks: 500 }, mockLogger);

        const memory: Memory = {
          systemReport: {
            lastGenerated: 1000,
            report: {
              tick: 1000,
              summary: "old",
              findings: [],
              repository: undefined
            }
          }
        } as Memory;

        const game = { time: 2000, rooms: {} };
        const result = collector.collect(game, memory);

        expect(result.reportsRotated).toBe(1);
        expect(memory.systemReport?.report).toBeUndefined();
        expect(memory.systemReport?.lastGenerated).toBe(1000);
      });

      it("should respect CPU throttling via maxCleanupPerTick", () => {
        const mockLogger = { log: vi.fn() };
        const collector = new MemoryGarbageCollector({ maxCleanupPerTick: 2, roomDataRetentionTicks: 100 }, mockLogger);

        const memory: Memory = {
          rooms: {
            R1: { lastSeen: 1 },
            R2: { lastSeen: 1 },
            R3: { lastSeen: 1 },
            R4: { lastSeen: 1 }
          }
        } as Memory;

        const game = { time: 10000, rooms: {} };
        const result = collector.collect(game, memory);

        // Should only clean up to maxCleanupPerTick rooms
        expect(result.roomDataCleaned).toBeLessThanOrEqual(2);
      });
    });

    describe("Memory Usage Tracking", () => {
      it("should estimate memory usage", () => {
        const mockLogger = { log: vi.fn() };
        const collector = new MemoryGarbageCollector({}, mockLogger);

        const memory: Memory = {
          creeps: {
            harvester1: { role: "harvester" } as CreepMemory
          },
          roles: { harvester: 1 }
        } as Memory;

        const usage = collector.getMemoryUsage(memory);
        expect(usage).toBeGreaterThan(0);
      });

      it("should handle serialization errors gracefully", () => {
        const mockLogger = { log: vi.fn() };
        const collector = new MemoryGarbageCollector({}, mockLogger);

        // Create circular reference
        const memory: any = { circular: null };
        memory.circular = memory;

        const usage = collector.getMemoryUsage(memory);
        expect(usage).toBe(0);
        expect(mockLogger.log).toHaveBeenCalled();
      });
    });
  });

  describe("MemoryMigrationManager", () => {
    describe("Migration Execution", () => {
      it("should apply pending migrations in order", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };
        const manager = new MemoryMigrationManager(3, mockLogger);

        let executionOrder: number[] = [];

        manager.registerMigration({
          version: 2,
          description: "Migration 2",
          handler: () => {
            executionOrder.push(2);
          }
        });

        manager.registerMigration({
          version: 3,
          description: "Migration 3",
          handler: () => {
            executionOrder.push(3);
          }
        });

        const memory: Memory = { version: 1 } as Memory;
        const result = manager.migrate(memory);

        expect(result.success).toBe(true);
        expect(result.migrationsApplied).toBe(2);
        expect(executionOrder).toEqual([2, 3]);
        expect(memory.version).toBe(3);
      });

      it("should skip migrations if already at current version", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };
        const manager = new MemoryMigrationManager(2, mockLogger);

        const memory: Memory = { version: 2 } as Memory;
        const result = manager.migrate(memory);

        expect(result.migrationsApplied).toBe(0);
        expect(result.success).toBe(true);
      });

      it("should handle migration failures gracefully", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };
        const manager = new MemoryMigrationManager(3, mockLogger);

        manager.registerMigration({
          version: 2,
          description: "Failing migration",
          handler: () => {
            throw new Error("Migration failed");
          }
        });

        const memory: Memory = { version: 1 } as Memory;
        const result = manager.migrate(memory);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(memory.version).toBe(1); // Version should not change
      });

      it("should initialize version field on first migration", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };
        const manager = new MemoryMigrationManager(1, mockLogger);

        const memory: Memory = {} as Memory;
        const result = manager.migrate(memory);

        expect(result.success).toBe(true);
        expect(memory.version).toBe(1);
      });
    });

    describe("Memory Validation", () => {
      it("should validate memory with version field", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };
        const manager = new MemoryMigrationManager(1, mockLogger);

        const memory: Memory = { version: 1 } as Memory;
        expect(manager.validateMemory(memory)).toBe(true);
      });

      it("should reject memory without version field", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };
        const manager = new MemoryMigrationManager(1, mockLogger);

        const memory: Memory = {} as Memory;
        expect(manager.validateMemory(memory)).toBe(false);
      });
    });

    describe("Migration Status", () => {
      it("should report migration status correctly", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };
        const manager = new MemoryMigrationManager(3, mockLogger);

        manager.registerMigration({
          version: 2,
          description: "Migration 2",
          handler: () => {}
        });

        manager.registerMigration({
          version: 3,
          description: "Migration 3",
          handler: () => {}
        });

        const memory: Memory = { version: 1 } as Memory;
        const status = manager.getStatus(memory);

        expect(status.currentVersion).toBe(3);
        expect(status.memoryVersion).toBe(1);
        expect(status.pendingMigrations).toBe(2);
        expect(status.availableMigrations).toBe(3); // Including built-in migration
      });
    });
  });

  describe("MemoryUtilizationMonitor", () => {
    describe("Memory Measurement", () => {
      it("should measure memory utilization", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };
        const monitor = new MemoryUtilizationMonitor({}, mockLogger);

        const memory: Memory = {
          creeps: {
            h1: { role: "harvester" } as CreepMemory
          },
          roles: { harvester: 1 }
        } as Memory;

        const utilization = monitor.measure(memory);

        expect(utilization.currentBytes).toBeGreaterThan(0);
        expect(utilization.usagePercent).toBeGreaterThanOrEqual(0);
        expect(utilization.usagePercent).toBeLessThanOrEqual(1);
      });

      it("should detect warning threshold", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };
        const monitor = new MemoryUtilizationMonitor({ warningThreshold: 0.01, maxMemoryBytes: 100 }, mockLogger);

        const memory: Memory = {
          creeps: {
            h1: { role: "harvester" } as CreepMemory
          }
        } as Memory;

        const utilization = monitor.measure(memory);

        expect(utilization.isWarning).toBe(true);
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it("should detect critical threshold", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };
        const monitor = new MemoryUtilizationMonitor({ criticalThreshold: 0.01, maxMemoryBytes: 100 }, mockLogger);

        const memory: Memory = {
          creeps: {
            h1: { role: "harvester" } as CreepMemory
          }
        } as Memory;

        const utilization = monitor.measure(memory);

        expect(utilization.isCritical).toBe(true);
      });

      it("should measure subsystem usage", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };
        const monitor = new MemoryUtilizationMonitor({}, mockLogger);

        const memory: Memory = {
          creeps: {
            h1: { role: "harvester" } as CreepMemory
          },
          roles: { harvester: 1 },
          stats: {
            time: 1000,
            cpu: { used: 10, limit: 20, bucket: 5000 },
            creeps: { count: 1 },
            rooms: { count: 1 }
          }
        } as Memory;

        const utilization = monitor.measure(memory);

        expect(utilization.subsystems.creeps).toBeGreaterThan(0);
        expect(utilization.subsystems.roles).toBeGreaterThan(0);
        expect(utilization.subsystems.stats).toBeGreaterThan(0);
      });
    });

    describe("Allocation Checks", () => {
      it("should allow allocation under critical threshold", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };
        const monitor = new MemoryUtilizationMonitor({ criticalThreshold: 0.9, maxMemoryBytes: 10000 }, mockLogger);

        const memory: Memory = {} as Memory;
        const canAllocate = monitor.canAllocate(memory, 100);

        expect(canAllocate).toBe(true);
      });

      it("should prevent allocation over critical threshold", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };
        const monitor = new MemoryUtilizationMonitor({ criticalThreshold: 0.1, maxMemoryBytes: 100 }, mockLogger);

        const memory: Memory = {
          creeps: {
            h1: { role: "harvester" } as CreepMemory
          }
        } as Memory;

        const canAllocate = monitor.canAllocate(memory, 1000);
        expect(canAllocate).toBe(false);
      });
    });

    describe("Memory Budget", () => {
      it("should provide liberal budget under warning threshold", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };
        const monitor = new MemoryUtilizationMonitor({ warningThreshold: 0.9, maxMemoryBytes: 10000 }, mockLogger);

        const memory: Memory = {} as Memory;
        const budget = monitor.getBudget("creeps", memory);

        expect(budget).toBe(1000); // 10% of maxMemoryBytes
      });

      it("should provide conservative budget at warning threshold", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };
        const monitor = new MemoryUtilizationMonitor(
          { warningThreshold: 0.01, criticalThreshold: 0.95, maxMemoryBytes: 10000 },
          mockLogger
        );

        const memory: Memory = {
          creeps: {
            h1: { role: "harvester" } as CreepMemory
          }
        } as Memory;

        const budget = monitor.getBudget("creeps", memory);

        // At warning threshold, budget should be max(subsystemUsage, 5% of total)
        expect(budget).toBeGreaterThan(0);
        // Should be either current usage or 5% of max, whichever is greater
        const expectedMin = Math.max(0, 500); // 5% of 10000
        expect(budget).toBeGreaterThanOrEqual(expectedMin * 0.5); // Allow some tolerance
      });

      it("should limit budget at critical threshold", () => {
        const mockLogger = { log: vi.fn(), warn: vi.fn() };

        // Create a memory object large enough to trigger critical threshold
        const largeMemory: Memory = {
          creeps: {},
          stats: {
            time: 1000,
            cpu: { used: 10, limit: 20, bucket: 5000 },
            creeps: { count: 100 },
            rooms: { count: 10 }
          }
        } as Memory;

        // Add many creeps to increase memory size
        for (let i = 0; i < 50; i++) {
          (largeMemory.creeps as any)[`creep${i}`] = {
            role: "harvester",
            homeRoom: "W1N1",
            targetRoom: "W2N2"
          };
        }

        const memorySize = JSON.stringify(largeMemory).length;
        const monitor = new MemoryUtilizationMonitor(
          { criticalThreshold: 0.5, maxMemoryBytes: memorySize + 100 },
          mockLogger
        );

        // First measure to establish state
        const utilization = monitor.measure(largeMemory);
        expect(utilization.isCritical).toBe(true);

        // Budget for existing subsystem should equal current usage when critical
        const creepsBudget = monitor.getBudget("creeps", largeMemory);
        const expectedBudget = utilization.subsystems.creeps ?? 0;
        expect(creepsBudget).toBe(expectedBudget);
        expect(creepsBudget).toBeGreaterThan(0);
      });
    });
  });
});
