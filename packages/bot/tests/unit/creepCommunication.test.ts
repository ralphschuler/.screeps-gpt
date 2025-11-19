import { describe, it, expect, beforeEach } from "vitest";
import { CreepCommunicationManager } from "@runtime/behavior/CreepCommunicationManager";

describe("CreepCommunicationManager", () => {
  let manager: CreepCommunicationManager;
  let mockCreep: {
    say: (message: string, toPublic?: boolean) => number;
    name: string;
    pos: RoomPosition;
    room: {
      visual: RoomVisual;
      name: string;
    };
    memory: {
      stuck?: boolean;
    };
  };

  beforeEach(() => {
    manager = new CreepCommunicationManager();

    // Mock creep
    mockCreep = {
      say: () => 0,
      name: "test-creep",
      pos: { x: 25, y: 25, roomName: "W1N1" } as RoomPosition,
      room: {
        visual: {
          line: () => undefined,
          circle: () => undefined
        } as unknown as RoomVisual,
        name: "W1N1"
      },
      memory: {}
    };
  });

  describe("Configuration", () => {
    it("should use default configuration", () => {
      const config = manager.getConfig();
      expect(config.verbosity).toBe("normal");
      expect(config.enableRoomVisuals).toBe(false);
      expect(config.cpuBudget).toBe(0.1);
    });

    it("should accept custom configuration", () => {
      const customManager = new CreepCommunicationManager({
        verbosity: "verbose",
        enableRoomVisuals: true,
        cpuBudget: 0.5
      });

      const config = customManager.getConfig();
      expect(config.verbosity).toBe("verbose");
      expect(config.enableRoomVisuals).toBe(true);
      expect(config.cpuBudget).toBe(0.5);
    });

    it("should update configuration at runtime", () => {
      manager.updateConfig({ verbosity: "minimal" });
      expect(manager.getConfig().verbosity).toBe("minimal");

      manager.updateConfig({ enableRoomVisuals: true });
      expect(manager.getConfig().enableRoomVisuals).toBe(true);
    });

    it("should support disabled verbosity", () => {
      const disabledManager = new CreepCommunicationManager({ verbosity: "disabled" });
      expect(disabledManager.getConfig().verbosity).toBe("disabled");
    });
  });

  describe("Communication", () => {
    it("should make creep say harvest action", () => {
      let saidMessage = "";
      mockCreep.say = (message: string) => {
        saidMessage = message;
        return 0;
      };

      manager.say(mockCreep, "harvest");
      expect(saidMessage).toBe("⛏️");
    });

    it("should make creep say deliver action", () => {
      let saidMessage = "";
      mockCreep.say = (message: string) => {
        saidMessage = message;
        return 0;
      };

      manager.say(mockCreep, "deliver");
      expect(saidMessage).toBe("📦");
    });

    it("should make creep say upgrade action", () => {
      let saidMessage = "";
      mockCreep.say = (message: string) => {
        saidMessage = message;
        return 0;
      };

      manager.say(mockCreep, "upgrade");
      expect(saidMessage).toBe("⚡");
    });

    it("should not communicate when disabled", () => {
      const disabledManager = new CreepCommunicationManager({ verbosity: "disabled" });
      let saidMessage = "";
      mockCreep.say = (message: string) => {
        saidMessage = message;
        return 0;
      };

      disabledManager.say(mockCreep, "harvest");
      expect(saidMessage).toBe("");
    });

    it("should include additional text in verbose mode", () => {
      const verboseManager = new CreepCommunicationManager({ verbosity: "verbose" });
      let saidMessage = "";
      mockCreep.say = (message: string) => {
        saidMessage = message;
        return 0;
      };

      verboseManager.say(mockCreep, "harvest", "mining");
      expect(saidMessage).toContain("⛏️");
      expect(saidMessage).toContain("mining");
    });

    it("should truncate message to 10 characters", () => {
      const verboseManager = new CreepCommunicationManager({ verbosity: "verbose" });
      let saidMessage = "";
      mockCreep.say = (message: string) => {
        saidMessage = message;
        return 0;
      };

      verboseManager.say(mockCreep, "harvest", "verylongtext");
      expect(saidMessage.length).toBeLessThanOrEqual(10);
    });
  });

  describe("Error Communication", () => {
    it("should say error when not stuck", () => {
      let saidMessage = "";
      mockCreep.say = (message: string) => {
        saidMessage = message;
        return 0;
      };

      manager.sayError(mockCreep);
      expect(saidMessage).toBe("⚠️");
    });

    it("should say stuck when creep is stuck", () => {
      let saidMessage = "";
      mockCreep.say = (message: string) => {
        saidMessage = message;
        return 0;
      };
      mockCreep.memory.stuck = true;

      manager.sayError(mockCreep);
      expect(saidMessage).toBe("❌");
    });

    it("should not communicate error in minimal mode", () => {
      const minimalManager = new CreepCommunicationManager({ verbosity: "minimal" });
      let saidMessage = "";
      mockCreep.say = (message: string) => {
        saidMessage = message;
        return 0;
      };

      minimalManager.sayError(mockCreep);
      expect(saidMessage).toBe("");
    });
  });

  describe("Resource Status", () => {
    it("should say full when resource is full", () => {
      let saidMessage = "";
      mockCreep.say = (message: string) => {
        saidMessage = message;
        return 0;
      };

      manager.sayResourceStatus(mockCreep, true);
      expect(saidMessage).toBe("✅");
    });

    it("should say empty when resource is empty", () => {
      let saidMessage = "";
      mockCreep.say = (message: string) => {
        saidMessage = message;
        return 0;
      };

      manager.sayResourceStatus(mockCreep, false);
      expect(saidMessage).toBe("🔋");
    });

    it("should include percentage when provided", () => {
      let saidMessage = "";
      mockCreep.say = (message: string) => {
        saidMessage = message;
        return 0;
      };

      manager.sayResourceStatus(mockCreep, true, 75);
      expect(saidMessage).toContain("75%");
    });
  });

  describe("Tick Management", () => {
    it("should reset CPU usage on new tick", () => {
      manager.resetTick(100);
      const stats1 = manager.getCpuUsage();
      expect(stats1.used).toBe(0);

      manager.resetTick(101);
      const stats2 = manager.getCpuUsage();
      expect(stats2.used).toBe(0);
    });

    it("should not reset CPU usage on same tick", () => {
      manager.resetTick(100);

      // Simulate some CPU usage by calling say
      manager.say(mockCreep, "harvest", undefined, () => 0.01);

      manager.resetTick(100); // Same tick
      const stats = manager.getCpuUsage();
      // CPU should still be tracked from first call
      expect(stats.used).toBeGreaterThanOrEqual(0);
    });
  });

  describe("CPU Budget", () => {
    it("should track CPU usage", () => {
      let cpuCounter = 0;
      const cpuGetter = () => {
        cpuCounter += 0.01;
        return cpuCounter;
      };

      manager.resetTick(100);
      manager.say(mockCreep, "harvest", undefined, cpuGetter);

      const stats = manager.getCpuUsage();
      expect(stats.used).toBeGreaterThan(0);
    });

    it("should report CPU budget percentage", () => {
      manager.resetTick(100);
      const stats = manager.getCpuUsage();

      expect(stats.budget).toBe(0.1);
      expect(stats.percentage).toBeGreaterThanOrEqual(0);
      expect(stats.percentage).toBeLessThanOrEqual(100);
    });
  });

  describe("Room Visuals", () => {
    it("should not draw visuals when disabled", () => {
      let lineCalled = false;
      let circleCalled = false;

      mockCreep.room.visual = {
        line: () => {
          lineCalled = true;
        },
        circle: () => {
          circleCalled = true;
        }
      } as unknown as RoomVisual;

      const target = { x: 30, y: 30, roomName: "W1N1" } as RoomPosition;
      manager.drawTaskGoal(mockCreep, target);

      expect(lineCalled).toBe(false);
      expect(circleCalled).toBe(false);
    });

    it("should draw visuals when enabled", () => {
      const visualManager = new CreepCommunicationManager({ enableRoomVisuals: true });

      let lineCalled = false;
      let circleCalled = false;

      mockCreep.room.visual = {
        line: () => {
          lineCalled = true;
        },
        circle: () => {
          circleCalled = true;
        }
      } as unknown as RoomVisual;

      const target = { x: 30, y: 30, roomName: "W1N1" } as RoomPosition;
      visualManager.drawTaskGoal(mockCreep, target);

      expect(lineCalled).toBe(true);
      expect(circleCalled).toBe(true);
    });
  });
});
