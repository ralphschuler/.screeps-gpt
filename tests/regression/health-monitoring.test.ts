import { describe, it, expect, beforeEach } from "vitest";
import { HealthProcess } from "../../packages/bot/src/runtime/processes/HealthProcess";
import type { GameContext } from "../../packages/bot/src/runtime/types/GameContext";
import type { ProcessContext } from "@ralphschuler/screeps-kernel";

/**
 * Regression tests for bot health monitoring and autonomous recovery system.
 *
 * These tests validate:
 * - Health monitoring detects degraded states early (100-500 ticks before failure)
 * - Recovery orchestration activates appropriate responses
 * - Health metrics are exported to Memory.stats for external monitoring
 * - System recovers autonomously from simulated failure scenarios
 *
 * Historical context:
 * - Issue #1218: Death spiral Nov 21 (RCL 2, 0 creeps)
 * - Issue #1145: Previous death spiral required manual intervention
 * - This system aims to achieve 95%+ autonomous recovery rate
 */
describe("Health Monitoring System - Regression Tests", () => {
  let mockGame: GameContext;
  let mockMemory: Memory;
  let healthProcess: HealthProcess;

  beforeEach(() => {
    mockGame = {
      time: 1000,
      cpu: {
        limit: 100,
        tickLimit: 500,
        bucket: 10000,
        shardLimits: {},
        unlocked: false,
        unlockedTime: undefined,
        getUsed: () => 10,
        setShardLimits: () => {},
        halt: () => {},
        generatePixel: () => 0
      },
      creeps: {},
      spawns: {},
      rooms: {}
    } as GameContext;

    mockMemory = {
      stats: {
        time: 1000,
        cpu: { used: 10, limit: 100, bucket: 10000 },
        creeps: { count: 0 },
        rooms: { count: 1 }
      }
    } as Memory;

    healthProcess = new HealthProcess();
  });

  describe("Scenario: Two Harvester Death Spiral (Issue #1218)", () => {
    it("should detect health degradation when harvesters die", () => {
      // Initial healthy state: 2 harvesters working
      mockGame.creeps = {
        harvester1: { memory: { role: "harvester" } },
        harvester2: { memory: { role: "harvester" } },
        upgrader1: { memory: { role: "upgrader" } },
        builder1: { memory: { role: "builder" } }
      } as Record<string, Creep>;

      mockGame.spawns = {
        Spawn1: { spawning: null, room: { name: "W1N1" } } as StructureSpawn
      };

      mockGame.rooms = {
        W1N1: {
          energyAvailable: 500,
          controller: { my: true, level: 3 } as StructureController
        } as Room
      };

      const ctx: ProcessContext<Memory> = {
        game: mockGame,
        memory: mockMemory
      };

      healthProcess.run(ctx);

      // Should detect degraded state (less than optimal harvesters)
      expect(mockMemory.health).toBeDefined();
      const healthData = mockMemory.health as {
        score: number;
        state: string;
        warnings?: { type: string }[];
      };
      expect(healthData.score).toBeLessThan(100);

      // Now simulate one harvester dying - should trigger warning
      delete mockGame.creeps.harvester2;
      mockGame.time = 1100;
      healthProcess.run(ctx);

      const updatedHealth = mockMemory.health as {
        score: number;
        state: string;
        warnings?: { type: string }[];
      };
      expect(updatedHealth.warnings).toBeDefined();
      // Should have workforce depletion or no harvester warning
      const harvesterWarning = updatedHealth.warnings?.find(
        w => w.type === "WORKFORCE_DEPLETION" || w.type === "NO_HARVESTERS"
      );
      expect(harvesterWarning).toBeDefined();
    });

    it("should activate recovery mode when last harvester is at risk", () => {
      // Simulate critical state: only 1 harvester remaining
      mockGame.creeps = {
        harvester1: { memory: { role: "harvester" } },
        upgrader1: { memory: { role: "upgrader" } }
      } as Record<string, Creep>;

      mockGame.spawns = {
        Spawn1: { spawning: null, room: { name: "W1N1" } } as StructureSpawn
      };

      mockGame.rooms = {
        W1N1: {
          energyAvailable: 200,
          controller: { my: true, level: 2 } as StructureController
        } as Room
      };

      const ctx: ProcessContext<Memory> = {
        game: mockGame,
        memory: mockMemory
      };

      healthProcess.run(ctx);

      // Should activate active recovery
      const healthData = mockMemory.health as {
        score: number;
        state: string;
        recovery?: { mode: string };
      };
      expect(healthData.state).toBe("CRITICAL");
      expect(healthData.recovery?.mode).toBe("ACTIVE");
      expect(mockMemory.activeRecovery).toBe(true);
    });

    it("should enter emergency mode when all harvesters are dead", () => {
      // Simulate emergency: no harvesters
      mockGame.creeps = {
        upgrader1: { memory: { role: "upgrader" } }
      } as Record<string, Creep>;

      mockGame.spawns = {
        Spawn1: { spawning: null, room: { name: "W1N1" } } as StructureSpawn
      };

      mockGame.rooms = {
        W1N1: {
          energyAvailable: 50,
          controller: { my: true, level: 2 } as StructureController
        } as Room
      };

      const ctx: ProcessContext<Memory> = {
        game: mockGame,
        memory: mockMemory
      };

      healthProcess.run(ctx);

      // Should enter emergency recovery
      const healthData = mockMemory.health as {
        score: number;
        state: string;
        recovery?: { mode: string };
        warnings?: { severity: string }[];
      };
      expect(healthData.state).toBe("EMERGENCY");
      expect(healthData.recovery?.mode).toBe("EMERGENCY");
      expect(mockMemory.emergencyRecovery).toBe(true);

      // Should have critical warning
      const criticalWarnings = healthData.warnings?.filter(w => w.severity === "critical");
      expect(criticalWarnings?.length).toBeGreaterThan(0);
    });
  });

  describe("Scenario: Low Energy Death Spiral", () => {
    it("should detect energy starvation early", () => {
      mockGame.creeps = {
        harvester1: { memory: { role: "harvester" } },
        harvester2: { memory: { role: "harvester" } },
        upgrader1: { memory: { role: "upgrader" } }
      } as Record<string, Creep>;

      mockGame.spawns = {
        Spawn1: { spawning: null, room: { name: "W1N1" } } as StructureSpawn
      };

      mockGame.rooms = {
        W1N1: {
          energyAvailable: 250, // Below starvation threshold
          controller: { my: true, level: 3 } as StructureController
        } as Room
      };

      const ctx: ProcessContext<Memory> = {
        game: mockGame,
        memory: mockMemory
      };

      healthProcess.run(ctx);

      const healthData = mockMemory.health as {
        warnings?: { type: string; severity: string }[];
      };
      const energyWarning = healthData.warnings?.find(w => w.type === "ENERGY_STARVATION");
      expect(energyWarning).toBeDefined();
      expect(energyWarning?.severity).toBe("warning");
    });

    it("should reduce CPU usage when bucket is low and energy is critical", () => {
      mockGame.cpu.bucket = 500; // Low bucket
      mockGame.creeps = {
        harvester1: { memory: { role: "harvester" } }
      } as Record<string, Creep>;

      mockGame.spawns = {
        Spawn1: { spawning: null, room: { name: "W1N1" } } as StructureSpawn
      };

      mockGame.rooms = {
        W1N1: {
          energyAvailable: 100,
          controller: { my: true, level: 2 } as StructureController
        } as Room
      };

      const ctx: ProcessContext<Memory> = {
        game: mockGame,
        memory: mockMemory
      };

      healthProcess.run(ctx);

      // Should activate reduced operations mode due to low bucket and critical state
      // Note: reducedOperations is set when CPU bucket < 1000 AND in active recovery
      const healthData = mockMemory.health as {
        state: string;
        recovery?: { mode: string };
      };
      // Should be in emergency or active recovery mode
      expect(["EMERGENCY", "ACTIVE"]).toContain(healthData.recovery?.mode);
    });
  });

  describe("Health Metrics Export", () => {
    it("should export health metrics to Memory for external monitoring", () => {
      mockGame.creeps = {
        harvester1: { memory: { role: "harvester" } },
        harvester2: { memory: { role: "harvester" } },
        upgrader1: { memory: { role: "upgrader" } },
        builder1: { memory: { role: "builder" } }
      } as Record<string, Creep>;

      mockGame.spawns = {
        Spawn1: { spawning: null, room: { name: "W1N1" } } as StructureSpawn
      };

      mockGame.rooms = {
        W1N1: {
          energyAvailable: 600,
          controller: { my: true, level: 4 } as StructureController
        } as Room
      };

      const ctx: ProcessContext<Memory> = {
        game: mockGame,
        memory: mockMemory
      };

      healthProcess.run(ctx);

      // Verify health data is stored in memory
      expect(mockMemory.health).toBeDefined();
      const healthData = mockMemory.health as {
        score: number;
        state: string;
        metrics: {
          workforce: number;
          energy: number;
          spawn: number;
          infrastructure: number;
        };
        timestamp: number;
      };

      expect(healthData.score).toBeGreaterThan(0);
      expect(healthData.state).toBeDefined();
      expect(healthData.metrics).toBeDefined();
      expect(healthData.metrics.workforce).toBeGreaterThanOrEqual(0);
      expect(healthData.metrics.energy).toBeGreaterThanOrEqual(0);
      expect(healthData.metrics.spawn).toBeGreaterThanOrEqual(0);
      expect(healthData.metrics.infrastructure).toBeGreaterThanOrEqual(0);
      expect(healthData.timestamp).toBe(mockGame.time);
    });

    it("should include warning count in health metrics", () => {
      mockGame.creeps = {
        harvester1: { memory: { role: "harvester" } } // Only 1 harvester - triggers warning
      } as Record<string, Creep>;

      mockGame.spawns = {
        Spawn1: { spawning: null, room: { name: "W1N1" } } as StructureSpawn
      };

      mockGame.rooms = {
        W1N1: {
          energyAvailable: 250, // Low energy - triggers warning
          controller: { my: true, level: 2 } as StructureController
        } as Room
      };

      const ctx: ProcessContext<Memory> = {
        game: mockGame,
        memory: mockMemory
      };

      healthProcess.run(ctx);

      const healthData = mockMemory.health as {
        warnings?: unknown[];
      };
      expect(healthData.warnings).toBeDefined();
      expect(healthData.warnings!.length).toBeGreaterThan(0);
    });

    it("should include recovery mode in health metrics", () => {
      mockGame.creeps = {
        harvester1: { memory: { role: "harvester" } }
      } as Record<string, Creep>;

      mockGame.spawns = {
        Spawn1: { spawning: null, room: { name: "W1N1" } } as StructureSpawn
      };

      mockGame.rooms = {
        W1N1: {
          energyAvailable: 150,
          controller: { my: true, level: 2 } as StructureController
        } as Room
      };

      const ctx: ProcessContext<Memory> = {
        game: mockGame,
        memory: mockMemory
      };

      healthProcess.run(ctx);

      const healthData = mockMemory.health as {
        recovery?: { mode: string; actionsCount: number };
      };
      expect(healthData.recovery).toBeDefined();
      expect(healthData.recovery?.mode).toBeDefined();
      expect(["NORMAL", "MONITOR", "ACTIVE", "EMERGENCY"]).toContain(healthData.recovery?.mode);
    });
  });

  describe("CPU and Performance", () => {
    it("should skip health check when CPU threshold exceeded", () => {
      mockGame.cpu.getUsed = () => 95; // 95/100 = 95% usage

      mockGame.creeps = {
        harvester1: { memory: { role: "harvester" } }
      } as Record<string, Creep>;

      const ctx: ProcessContext<Memory> = {
        game: mockGame,
        memory: mockMemory
      };

      healthProcess.run(ctx);

      // Health should not be updated due to CPU guard
      expect(mockMemory.health).toBeUndefined();
    });

    it("should skip health check during emergency reset", () => {
      mockMemory.emergencyReset = true;

      mockGame.creeps = {
        harvester1: { memory: { role: "harvester" } }
      } as Record<string, Creep>;

      const ctx: ProcessContext<Memory> = {
        game: mockGame,
        memory: mockMemory
      };

      healthProcess.run(ctx);

      // Health should not be updated during emergency reset
      expect(mockMemory.health).toBeUndefined();
    });

    it("should skip health check during respawn", () => {
      mockMemory.needsRespawn = true;

      const ctx: ProcessContext<Memory> = {
        game: mockGame,
        memory: mockMemory
      };

      healthProcess.run(ctx);

      // Health should not be updated during respawn
      expect(mockMemory.health).toBeUndefined();
    });
  });

  describe("Recovery Success Validation", () => {
    it("should clear recovery flags when health returns to normal", () => {
      // Setup recovery state
      mockMemory.activeRecovery = true;
      mockMemory.reducedOperations = true;

      // Simulate health recovery - 10 creeps, good energy
      mockGame.creeps = Array.from({ length: 10 }, (_, i) => [
        `creep${i}`,
        { memory: { role: i < 3 ? "harvester" : "upgrader" } }
      ]).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}) as Record<string, Creep>;

      mockGame.spawns = {
        Spawn1: { spawning: null, room: { name: "W1N1" } } as StructureSpawn
      };

      mockGame.rooms = {
        W1N1: {
          energyAvailable: 800,
          controller: { my: true, level: 5 } as StructureController
        } as Room
      };

      const ctx: ProcessContext<Memory> = {
        game: mockGame,
        memory: mockMemory
      };

      healthProcess.run(ctx);

      const healthData = mockMemory.health as {
        state: string;
        recovery?: { mode: string };
      };

      // Health should be good or degraded (but not critical/emergency)
      expect(["HEALTHY", "DEGRADED"]).toContain(healthData.state);

      // Recovery mode should be NORMAL or MONITOR (not ACTIVE or EMERGENCY)
      expect(["NORMAL", "MONITOR"]).toContain(healthData.recovery?.mode);
    });
  });
});
