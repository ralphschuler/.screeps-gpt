/**
 * Unit tests for InitializationManager
 *
 * Tests the phased initialization system that spreads startup workload
 * across multiple ticks to prevent CPU bucket drain after deployment/restart.
 *
 * Related Issue: #1498 - Staggered initialization after deployment/restart
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { InitializationManager } from "../../packages/bot/src/runtime/bootstrap/InitializationManager";
import type { GameContext } from "../../packages/bot/src/runtime/types/GameContext";

describe("InitializationManager", () => {
  let manager: InitializationManager;
  let mockLogger: { log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
  let mockMemory: Memory;

  const createMockGame = (overrides: Partial<GameContext> = {}): GameContext => ({
    time: 1000,
    cpu: {
      getUsed: () => 5,
      limit: 20,
      bucket: 5000
    },
    creeps: {},
    spawns: {},
    rooms: {},
    ...overrides
  });

  beforeEach(() => {
    mockLogger = {
      log: vi.fn(),
      warn: vi.fn()
    };
    mockMemory = {} as Memory;
    manager = new InitializationManager({}, mockLogger);
  });

  describe("phase registration", () => {
    it("should register phases in priority order", () => {
      manager.registerPhase({
        name: "phase-high",
        priority: 100,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      manager.registerPhase({
        name: "phase-low",
        priority: 10,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      manager.registerPhase({
        name: "phase-medium",
        priority: 50,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      const phases = manager.getPhases();
      expect(phases[0].name).toBe("phase-low");
      expect(phases[1].name).toBe("phase-medium");
      expect(phases[2].name).toBe("phase-high");
    });

    it("should return empty array when no phases registered", () => {
      expect(manager.getPhases()).toEqual([]);
    });
  });

  describe("isComplete", () => {
    it("should return true when no phases registered", () => {
      expect(manager.isComplete(mockMemory)).toBe(true);
    });

    it("should return false when init has not started", () => {
      manager.registerPhase({
        name: "test-phase",
        priority: 0,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      expect(manager.isComplete(mockMemory)).toBe(false);
    });

    it("should return true when Memory.init.complete is true", () => {
      manager.registerPhase({
        name: "test-phase",
        priority: 0,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      mockMemory.init = {
        phase: 1,
        startTick: 1000,
        complete: true
      };

      expect(manager.isComplete(mockMemory)).toBe(true);
    });

    it("should return false when Memory.init.complete is false", () => {
      manager.registerPhase({
        name: "test-phase",
        priority: 0,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      mockMemory.init = {
        phase: 0,
        startTick: 1000,
        complete: false
      };

      expect(manager.isComplete(mockMemory)).toBe(false);
    });
  });

  describe("needsInitialization", () => {
    it("should return false when no phases registered", () => {
      expect(manager.needsInitialization(mockMemory)).toBe(false);
    });

    it("should return true when Memory.init does not exist", () => {
      manager.registerPhase({
        name: "test-phase",
        priority: 0,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      expect(manager.needsInitialization(mockMemory)).toBe(true);
    });

    it("should return true when init started but not complete", () => {
      manager.registerPhase({
        name: "test-phase",
        priority: 0,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      mockMemory.init = {
        phase: 0,
        startTick: 1000,
        complete: false
      };

      expect(manager.needsInitialization(mockMemory)).toBe(true);
    });

    it("should return false when init is complete", () => {
      manager.registerPhase({
        name: "test-phase",
        priority: 0,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      mockMemory.init = {
        phase: 1,
        startTick: 1000,
        complete: true
      };

      expect(manager.needsInitialization(mockMemory)).toBe(false);
    });
  });

  describe("tick execution", () => {
    it("should initialize Memory.init on first tick", () => {
      manager.registerPhase({
        name: "test-phase",
        priority: 0,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      const game = createMockGame();
      manager.tick(game, mockMemory);

      expect(mockMemory.init).toBeDefined();
      expect(mockMemory.init?.startTick).toBe(1000);
      expect(mockMemory.init?.phase).toBeGreaterThanOrEqual(0);
    });

    it("should execute phases within CPU budget", () => {
      const phase1Execute = vi.fn();
      const phase2Execute = vi.fn();

      manager.registerPhase({
        name: "phase-1",
        priority: 0,
        cpuEstimate: 2,
        execute: phase1Execute
      });

      manager.registerPhase({
        name: "phase-2",
        priority: 10,
        cpuEstimate: 2,
        execute: phase2Execute
      });

      const game = createMockGame();
      const result = manager.tick(game, mockMemory);

      expect(phase1Execute).toHaveBeenCalled();
      expect(phase2Execute).toHaveBeenCalled();
      expect(result.phasesExecuted).toContain("phase-1");
      expect(result.phasesExecuted).toContain("phase-2");
    });

    it("should skip phases when CPU budget exhausted", () => {
      const phase1Execute = vi.fn();
      const phase2Execute = vi.fn();

      manager.registerPhase({
        name: "phase-1",
        priority: 0,
        cpuEstimate: 1,
        execute: phase1Execute
      });

      manager.registerPhase({
        name: "phase-2",
        priority: 10,
        cpuEstimate: 20, // Very high estimate - exceeds budget
        execute: phase2Execute
      });

      const game = createMockGame({
        cpu: {
          getUsed: () => 10, // Already at 50% CPU
          limit: 20,
          bucket: 5000
        }
      });

      const result = manager.tick(game, mockMemory);

      expect(phase1Execute).toHaveBeenCalled();
      expect(phase2Execute).not.toHaveBeenCalled();
      expect(result.phasesExecuted).toContain("phase-1");
      expect(result.phasesSkipped).toContain("phase-2");
    });

    it("should defer initialization when bucket is critically low", () => {
      manager.registerPhase({
        name: "test-phase",
        priority: 0,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      const game = createMockGame({
        cpu: {
          getUsed: () => 0,
          limit: 20,
          bucket: 100 // Below default minBucketLevel of 500
        }
      });

      const result = manager.tick(game, mockMemory);

      expect(result.phasesExecuted).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("CPU bucket")
      );
    });

    it("should mark complete when all phases executed", () => {
      const phase1Execute = vi.fn();

      manager.registerPhase({
        name: "phase-1",
        priority: 0,
        cpuEstimate: 1,
        execute: phase1Execute
      });

      const game = createMockGame();
      const result = manager.tick(game, mockMemory);

      expect(result.complete).toBe(true);
      expect(mockMemory.init?.complete).toBe(true);
    });

    it("should force complete after max init ticks", () => {
      const phaseExecute = vi.fn();

      manager = new InitializationManager({ maxInitTicks: 5 }, mockLogger);

      manager.registerPhase({
        name: "expensive-phase",
        priority: 0,
        cpuEstimate: 100, // Never fits in budget
        execute: phaseExecute
      });

      // Initialize with startTick in the past
      mockMemory.init = {
        phase: 0,
        startTick: 990, // Started 10 ticks ago
        complete: false
      };

      const game = createMockGame();
      const result = manager.tick(game, mockMemory);

      expect(result.complete).toBe(true);
      expect(mockMemory.init?.complete).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Max init ticks")
      );
    });

    it("should continue phase execution on next tick", () => {
      const phase1Execute = vi.fn();
      const phase2Execute = vi.fn();

      manager.registerPhase({
        name: "phase-1",
        priority: 0,
        cpuEstimate: 1,
        execute: phase1Execute
      });

      manager.registerPhase({
        name: "phase-2",
        priority: 10,
        cpuEstimate: 10, // Fits in budget but not after phase 1 on first tick
        execute: phase2Execute
      });

      // First tick - phase 1 executes, phase 2 skipped due to high CPU usage
      let firstTickCpu = 15; // Already at 75% CPU after phase 1
      const game1 = createMockGame({
        cpu: {
          getUsed: () => firstTickCpu,
          limit: 20,
          bucket: 5000
        }
      });

      manager.tick(game1, mockMemory);
      expect(phase1Execute).toHaveBeenCalled();
      expect(mockMemory.init?.phase).toBe(1);

      // Second tick - phase 2 now has fresh budget
      const game2 = createMockGame({
        time: 1001,
        cpu: {
          getUsed: () => 0, // Fresh CPU budget
          limit: 20,
          bucket: 5000
        }
      });

      const result = manager.tick(game2, mockMemory);
      expect(phase2Execute).toHaveBeenCalled();
      expect(result.complete).toBe(true);
    });

    it("should handle phase execution errors gracefully", () => {
      const errorPhase = vi.fn(() => {
        throw new Error("Phase failed!");
      });
      const nextPhase = vi.fn();

      manager.registerPhase({
        name: "error-phase",
        priority: 0,
        cpuEstimate: 1,
        execute: errorPhase
      });

      manager.registerPhase({
        name: "next-phase",
        priority: 10,
        cpuEstimate: 1,
        execute: nextPhase
      });

      const game = createMockGame();
      const result = manager.tick(game, mockMemory);

      // Error phase should be recorded but not stop execution
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Phase \"error-phase\" failed")
      );
      expect(nextPhase).toHaveBeenCalled();
      expect(result.phasesExecuted).toContain("error-phase");
      expect(result.phasesExecuted).toContain("next-phase");
      // Failed phases should also be tracked in Memory.init.completedPhases for consistency
      expect(mockMemory.init?.completedPhases).toContain("error-phase");
      expect(mockMemory.init?.completedPhases).toContain("next-phase");
    });

    it("should track completed phases in Memory", () => {
      manager.registerPhase({
        name: "phase-1",
        priority: 0,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      manager.registerPhase({
        name: "phase-2",
        priority: 10,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      const game = createMockGame();
      manager.tick(game, mockMemory);

      expect(mockMemory.init?.completedPhases).toContain("phase-1");
      expect(mockMemory.init?.completedPhases).toContain("phase-2");
    });
  });

  describe("reset", () => {
    it("should clear Memory.init", () => {
      mockMemory.init = {
        phase: 2,
        startTick: 1000,
        complete: true,
        completedPhases: ["phase-1", "phase-2"]
      };

      manager.reset(mockMemory);

      expect(mockMemory.init).toBeUndefined();
    });
  });

  describe("getStatus", () => {
    it("should return correct status for incomplete initialization", () => {
      manager.registerPhase({
        name: "phase-1",
        priority: 0,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      manager.registerPhase({
        name: "phase-2",
        priority: 10,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      mockMemory.init = {
        phase: 1,
        startTick: 1000,
        complete: false
      };

      const status = manager.getStatus(mockMemory);

      expect(status.totalPhases).toBe(2);
      expect(status.completedPhases).toBe(1);
      expect(status.currentPhase).toBe("phase-2");
      expect(status.isComplete).toBe(false);
    });

    it("should return null currentPhase when all phases complete", () => {
      manager.registerPhase({
        name: "phase-1",
        priority: 0,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      mockMemory.init = {
        phase: 1, // Past the only phase
        startTick: 1000,
        complete: true
      };

      const status = manager.getStatus(mockMemory);

      expect(status.currentPhase).toBeNull();
      expect(status.isComplete).toBe(true);
    });
  });

  describe("configuration", () => {
    it("should use default configuration values", () => {
      const defaultManager = new InitializationManager();

      // Test behavior with default minBucketLevel (500)
      defaultManager.registerPhase({
        name: "test",
        priority: 0,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      const lowBucketGame = createMockGame({
        cpu: { getUsed: () => 0, limit: 20, bucket: 400 }
      });

      const result = defaultManager.tick(lowBucketGame, mockMemory);
      expect(result.phasesExecuted).toHaveLength(0); // Deferred due to low bucket
    });

    it("should respect custom minBucketLevel", () => {
      const customManager = new InitializationManager({ minBucketLevel: 100 }, mockLogger);

      customManager.registerPhase({
        name: "test",
        priority: 0,
        cpuEstimate: 1,
        execute: vi.fn()
      });

      const lowBucketGame = createMockGame({
        cpu: { getUsed: () => 0, limit: 20, bucket: 400 }
      });

      const result = customManager.tick(lowBucketGame, mockMemory);
      expect(result.phasesExecuted).toContain("test"); // Not deferred - bucket is above 100
    });

    it("should respect custom cpuSafetyMargin", () => {
      // Default margin is 0.8 (80%), so with limit 20, budget is 16
      // Custom margin of 0.5 means budget is 10
      const customManager = new InitializationManager({ cpuSafetyMargin: 0.5 }, mockLogger);

      const phaseExecute = vi.fn();
      customManager.registerPhase({
        name: "expensive-phase",
        priority: 0,
        cpuEstimate: 12, // Would fit with 0.8 margin but not 0.5
        execute: phaseExecute
      });

      const game = createMockGame({
        cpu: { getUsed: () => 0, limit: 20, bucket: 5000 }
      });

      const result = customManager.tick(game, mockMemory);
      expect(phaseExecute).not.toHaveBeenCalled();
      expect(result.phasesSkipped).toContain("expensive-phase");
    });
  });
});
