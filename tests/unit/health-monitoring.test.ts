import { describe, it, expect, beforeEach } from "vitest";
import { HealthMonitor, HealthState } from "../../packages/bot/src/runtime/health/HealthMonitor";
import { WarningDetector, WarningType } from "../../packages/bot/src/runtime/health/WarningDetector";
import { RecoveryOrchestrator, RecoveryMode } from "../../packages/bot/src/runtime/health/RecoveryOrchestrator";
import type { GameContext } from "../../packages/bot/src/runtime/types/GameContext";

describe("HealthMonitor", () => {
  let mockGame: GameContext;
  let mockMemory: Memory;

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

    mockMemory = {} as Memory;
  });

  describe("Health Scoring", () => {
    it("should calculate healthy state with full workforce and energy", () => {
      // Setup healthy conditions
      mockGame.creeps = {
        creep1: { memory: { role: "harvester" } },
        creep2: { memory: { role: "upgrader" } },
        creep3: { memory: { role: "builder" } },
        creep4: { memory: { role: "harvester" } },
        creep5: { memory: { role: "hauler" } },
        creep6: { memory: { role: "harvester" } },
        creep7: { memory: { role: "upgrader" } },
        creep8: { memory: { role: "builder" } },
        creep9: { memory: { role: "harvester" } },
        creep10: { memory: { role: "hauler" } }
      } as Record<string, Creep>;

      mockGame.spawns = {
        Spawn1: { spawning: null } as StructureSpawn
      };

      mockGame.rooms = {
        W1N1: {
          energyAvailable: 800,
          controller: { my: true, level: 5 } as StructureController
        } as Room
      };

      const monitor = new HealthMonitor();
      const status = monitor.calculateHealth(mockGame, mockMemory);

      expect(status.state).toBe(HealthState.HEALTHY);
      expect(status.score).toBeGreaterThanOrEqual(80);
      expect(status.metrics.workforce).toBe(40); // 10/10 * 40
    });

    it("should detect degraded state with low workforce", () => {
      mockGame.creeps = {
        creep1: { memory: { role: "harvester" } },
        creep2: { memory: { role: "upgrader" } },
        creep3: { memory: { role: "builder" } },
        creep4: { memory: { role: "harvester" } },
        creep5: { memory: { role: "hauler" } }
      } as Record<string, Creep>;

      mockGame.spawns = {
        Spawn1: { spawning: null } as StructureSpawn
      };

      mockGame.rooms = {
        W1N1: {
          energyAvailable: 600,
          controller: { my: true, level: 4 } as StructureController
        } as Room
      };

      const monitor = new HealthMonitor();
      const status = monitor.calculateHealth(mockGame, mockMemory);

      expect(status.state).toBe(HealthState.DEGRADED);
      expect(status.score).toBeLessThan(80);
      expect(status.score).toBeGreaterThanOrEqual(60);
    });

    it("should detect critical state with very low workforce", () => {
      mockGame.creeps = {
        creep1: { memory: { role: "harvester" } },
        creep2: { memory: { role: "upgrader" } },
        creep3: { memory: { role: "builder" } },
        creep4: { memory: { role: "harvester" } }
      } as Record<string, Creep>;

      mockGame.spawns = {
        Spawn1: { spawning: null } as StructureSpawn
      };

      mockGame.rooms = {
        W1N1: {
          energyAvailable: 400,
          controller: { my: true, level: 3 } as StructureController
        } as Room
      };

      const monitor = new HealthMonitor();
      const status = monitor.calculateHealth(mockGame, mockMemory);

      expect(status.state).toBe(HealthState.CRITICAL);
      expect(status.score).toBeLessThan(60);
      expect(status.score).toBeGreaterThanOrEqual(40);
    });

    it("should detect emergency state with no harvesters", () => {
      mockGame.creeps = {
        creep1: { memory: { role: "upgrader" } }
      } as Record<string, Creep>;

      mockGame.spawns = {
        Spawn1: { spawning: null } as StructureSpawn
      };

      mockGame.rooms = {
        W1N1: {
          energyAvailable: 100,
          controller: { my: true, level: 2 } as StructureController
        } as Room
      };

      const monitor = new HealthMonitor();
      const status = monitor.calculateHealth(mockGame, mockMemory);

      expect(status.state).toBe(HealthState.EMERGENCY);
      expect(status.score).toBeLessThan(40);
    });

    it("should calculate zero health with no spawns", () => {
      mockGame.creeps = {};
      mockGame.spawns = {};
      mockGame.rooms = {};

      const monitor = new HealthMonitor();
      const status = monitor.calculateHealth(mockGame, mockMemory);

      expect(status.state).toBe(HealthState.EMERGENCY);
      expect(status.score).toBe(0);
    });
  });

  describe("Workforce Health", () => {
    it("should give full workforce points with target creep count", () => {
      mockGame.creeps = Array.from({ length: 10 }, (_, i) => [`creep${i}`, { memory: {} }]).reduce(
        (acc, [k, v]) => ({ ...acc, [k]: v }),
        {}
      ) as Record<string, Creep>;

      mockGame.spawns = { Spawn1: { spawning: null } as StructureSpawn };
      mockGame.rooms = {
        W1N1: { energyAvailable: 800, controller: { my: true, level: 5 } as StructureController } as Room
      };

      const monitor = new HealthMonitor({ targetCreepCount: 10 });
      const status = monitor.calculateHealth(mockGame, mockMemory);

      expect(status.metrics.workforce).toBe(40);
    });

    it("should scale workforce health linearly", () => {
      mockGame.creeps = {
        creep1: { memory: {} },
        creep2: { memory: {} },
        creep3: { memory: {} },
        creep4: { memory: {} },
        creep5: { memory: {} }
      } as Record<string, Creep>;

      mockGame.spawns = { Spawn1: { spawning: null } as StructureSpawn };
      mockGame.rooms = {
        W1N1: { energyAvailable: 500, controller: { my: true, level: 4 } as StructureController } as Room
      };

      const monitor = new HealthMonitor({ targetCreepCount: 10 });
      const status = monitor.calculateHealth(mockGame, mockMemory);

      expect(status.metrics.workforce).toBe(20); // 5/10 * 40
    });
  });

  describe("Energy Health", () => {
    it("should give full energy points with target energy", () => {
      mockGame.creeps = { creep1: { memory: {} } } as Record<string, Creep>;
      mockGame.spawns = { Spawn1: { spawning: null } as StructureSpawn };
      mockGame.rooms = {
        W1N1: {
          energyAvailable: 1000,
          controller: { my: true, level: 5 } as StructureController
        } as Room
      };

      const monitor = new HealthMonitor({ energyTarget: 1000 });
      const status = monitor.calculateHealth(mockGame, mockMemory);

      expect(status.metrics.energy).toBe(30);
    });

    it("should scale energy health linearly", () => {
      mockGame.creeps = { creep1: { memory: {} } } as Record<string, Creep>;
      mockGame.spawns = { Spawn1: { spawning: null } as StructureSpawn };
      mockGame.rooms = {
        W1N1: {
          energyAvailable: 500,
          controller: { my: true, level: 4 } as StructureController
        } as Room
      };

      const monitor = new HealthMonitor({ energyTarget: 1000 });
      const status = monitor.calculateHealth(mockGame, mockMemory);

      expect(status.metrics.energy).toBe(15); // 500/1000 * 30
    });
  });
});

describe("WarningDetector", () => {
  let mockGame: GameContext;
  let mockMemory: Memory;

  beforeEach(() => {
    mockGame = {
      time: 1000,
      cpu: { limit: 100, getUsed: () => 10 } as CPU,
      creeps: {},
      spawns: {},
      rooms: {}
    } as GameContext;

    mockMemory = {} as Memory;
  });

  describe("Harvester Detection", () => {
    it("should detect no harvesters as critical", () => {
      mockGame.creeps = {
        creep1: { memory: { role: "upgrader" } },
        creep2: { memory: { role: "builder" } }
      } as Record<string, Creep>;

      const detector = new WarningDetector();
      const healthStatus = {
        score: 50,
        state: HealthState.CRITICAL,
        metrics: { workforce: 20, energy: 15, spawn: 10, infrastructure: 5 },
        timestamp: 1000
      };
      const warnings = detector.detectWarnings(mockGame, mockMemory, healthStatus);

      const noHarvesterWarning = warnings.find(w => w.type === WarningType.NO_HARVESTERS);
      expect(noHarvesterWarning).toBeDefined();
      expect(noHarvesterWarning?.severity).toBe("critical");
    });

    it("should detect low harvester count as warning", () => {
      mockGame.creeps = {
        creep1: { memory: { role: "harvester" } },
        creep2: { memory: { role: "upgrader" } }
      } as Record<string, Creep>;

      const detector = new WarningDetector({ minHarvesters: 2 });
      const healthStatus = {
        score: 65,
        state: HealthState.DEGRADED,
        metrics: { workforce: 25, energy: 20, spawn: 15, infrastructure: 5 },
        timestamp: 1000
      };
      const warnings = detector.detectWarnings(mockGame, mockMemory, healthStatus);

      const depletionWarning = warnings.find(w => w.type === WarningType.WORKFORCE_DEPLETION);
      expect(depletionWarning).toBeDefined();
      expect(depletionWarning?.severity).toBe("warning");
    });

    it("should not warn with sufficient harvesters", () => {
      mockGame.creeps = {
        creep1: { memory: { role: "harvester" } },
        creep2: { memory: { role: "harvester" } },
        creep3: { memory: { role: "upgrader" } }
      } as Record<string, Creep>;

      const detector = new WarningDetector({ minHarvesters: 2 });
      const healthStatus = {
        score: 80,
        state: HealthState.HEALTHY,
        metrics: { workforce: 32, energy: 25, spawn: 18, infrastructure: 5 },
        timestamp: 1000
      };
      const warnings = detector.detectWarnings(mockGame, mockMemory, healthStatus);

      const harvesterWarnings = warnings.filter(
        w => w.type === WarningType.NO_HARVESTERS || w.type === WarningType.WORKFORCE_DEPLETION
      );
      expect(harvesterWarnings).toHaveLength(0);
    });
  });

  describe("Energy Starvation Detection", () => {
    it("should detect low energy as warning", () => {
      mockGame.creeps = {
        creep1: { memory: { role: "harvester" } },
        creep2: { memory: { role: "harvester" } }
      } as Record<string, Creep>;
      mockGame.rooms = {
        W1N1: {
          energyAvailable: 200,
          controller: { my: true, level: 3 } as StructureController
        } as Room
      };

      const detector = new WarningDetector({ energyStarvationThreshold: 300 });
      const healthStatus = {
        score: 55,
        state: HealthState.CRITICAL,
        metrics: { workforce: 25, energy: 15, spawn: 10, infrastructure: 5 },
        timestamp: 1000
      };
      const warnings = detector.detectWarnings(mockGame, mockMemory, healthStatus);

      const energyWarning = warnings.find(w => w.type === WarningType.ENERGY_STARVATION);
      expect(energyWarning).toBeDefined();
      expect(energyWarning?.severity).toBe("warning");
    });

    it("should not warn with sufficient energy", () => {
      mockGame.creeps = {
        creep1: { memory: { role: "harvester" } },
        creep2: { memory: { role: "harvester" } }
      } as Record<string, Creep>;
      mockGame.rooms = {
        W1N1: {
          energyAvailable: 500,
          controller: { my: true, level: 4 } as StructureController
        } as Room
      };

      const detector = new WarningDetector({ energyStarvationThreshold: 300 });
      const healthStatus = {
        score: 75,
        state: HealthState.DEGRADED,
        metrics: { workforce: 30, energy: 22, spawn: 18, infrastructure: 5 },
        timestamp: 1000
      };
      const warnings = detector.detectWarnings(mockGame, mockMemory, healthStatus);

      const energyWarning = warnings.find(w => w.type === WarningType.ENERGY_STARVATION);
      expect(energyWarning).toBeUndefined();
    });
  });
});

describe("RecoveryOrchestrator", () => {
  let mockGame: GameContext;
  let mockMemory: Memory;

  beforeEach(() => {
    mockGame = {
      time: 1000,
      cpu: { limit: 100, getUsed: () => 10 } as CPU,
      creeps: {},
      spawns: {},
      rooms: {}
    } as GameContext;

    mockMemory = {} as Memory;
  });

  describe("Recovery Mode Determination", () => {
    it("should enter monitoring mode for degraded health", () => {
      const orchestrator = new RecoveryOrchestrator();
      const healthStatus = {
        score: 70,
        state: HealthState.DEGRADED,
        metrics: { workforce: 28, energy: 21, spawn: 16, infrastructure: 5 },
        timestamp: 1000
      };

      const recoveryState = orchestrator.orchestrateRecovery(mockGame, mockMemory, healthStatus, []);

      expect(recoveryState.mode).toBe(RecoveryMode.MONITOR);
    });

    it("should enter active recovery for critical health", () => {
      mockGame.creeps = {
        creep1: { memory: { role: "harvester" } }
      } as Record<string, Creep>;

      const orchestrator = new RecoveryOrchestrator();
      const healthStatus = {
        score: 50,
        state: HealthState.CRITICAL,
        metrics: { workforce: 20, energy: 15, spawn: 10, infrastructure: 5 },
        timestamp: 1000
      };

      const recoveryState = orchestrator.orchestrateRecovery(mockGame, mockMemory, healthStatus, []);

      expect(recoveryState.mode).toBe(RecoveryMode.ACTIVE);
      expect(mockMemory.activeRecovery).toBe(true);
    });

    it("should enter emergency recovery for emergency health", () => {
      mockGame.creeps = {};

      const orchestrator = new RecoveryOrchestrator();
      const healthStatus = {
        score: 20,
        state: HealthState.EMERGENCY,
        metrics: { workforce: 0, energy: 10, spawn: 10, infrastructure: 0 },
        timestamp: 1000
      };

      const recoveryState = orchestrator.orchestrateRecovery(mockGame, mockMemory, healthStatus, []);

      expect(recoveryState.mode).toBe(RecoveryMode.EMERGENCY);
      expect(mockMemory.emergencyRecovery).toBe(true);
    });

    it("should return to normal mode for healthy state", () => {
      mockGame.creeps = Array.from({ length: 10 }, (_, i) => [`creep${i}`, { memory: {} }]).reduce(
        (acc, [k, v]) => ({ ...acc, [k]: v }),
        {}
      ) as Record<string, Creep>;

      const orchestrator = new RecoveryOrchestrator();
      const healthStatus = {
        score: 90,
        state: HealthState.HEALTHY,
        metrics: { workforce: 40, energy: 27, spawn: 18, infrastructure: 5 },
        timestamp: 1000
      };

      const recoveryState = orchestrator.orchestrateRecovery(mockGame, mockMemory, healthStatus, []);

      expect(recoveryState.mode).toBe(RecoveryMode.NORMAL);
    });
  });

  describe("Recovery Actions", () => {
    it("should prioritize harvester spawn in emergency", () => {
      mockGame.creeps = {};

      const orchestrator = new RecoveryOrchestrator();
      const healthStatus = {
        score: 15,
        state: HealthState.EMERGENCY,
        metrics: { workforce: 0, energy: 5, spawn: 10, infrastructure: 0 },
        timestamp: 1000
      };

      const recoveryState = orchestrator.orchestrateRecovery(mockGame, mockMemory, healthStatus, []);

      expect(recoveryState.actions.length).toBeGreaterThan(0);
      const harvesterAction = recoveryState.actions.find(a => a.type === "PRIORITIZE_HARVESTER");
      expect(harvesterAction).toBeDefined();
    });

    it("should boost harvester spawn in active recovery", () => {
      mockGame.creeps = {
        creep1: { memory: { role: "harvester" } }
      } as Record<string, Creep>;

      const orchestrator = new RecoveryOrchestrator();
      const healthStatus = {
        score: 45,
        state: HealthState.CRITICAL,
        metrics: { workforce: 18, energy: 12, spawn: 10, infrastructure: 5 },
        timestamp: 1000
      };

      const recoveryState = orchestrator.orchestrateRecovery(mockGame, mockMemory, healthStatus, []);

      expect(recoveryState.actions.length).toBeGreaterThan(0);
      const boostAction = recoveryState.actions.find(a => a.type === "BOOST_HARVESTER_SPAWN");
      expect(boostAction).toBeDefined();
    });

    it("should clear recovery flags when returning to normal", () => {
      mockMemory.emergencyRecovery = true;
      mockMemory.activeRecovery = true;

      mockGame.creeps = Array.from({ length: 10 }, (_, i) => [`creep${i}`, { memory: {} }]).reduce(
        (acc, [k, v]) => ({ ...acc, [k]: v }),
        {}
      ) as Record<string, Creep>;

      const orchestrator = new RecoveryOrchestrator();

      // First, trigger degraded to clear flags
      const degradedStatus = {
        score: 75,
        state: HealthState.DEGRADED,
        metrics: { workforce: 30, energy: 22, spawn: 18, infrastructure: 5 },
        timestamp: 1000
      };
      orchestrator.orchestrateRecovery(mockGame, mockMemory, degradedStatus, []);

      expect(mockMemory.emergencyRecovery).toBeUndefined();
      expect(mockMemory.activeRecovery).toBeUndefined();
    });
  });
});
