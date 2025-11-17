import { describe, it, expect, beforeEach } from "vitest";
import { BootstrapPhaseManager } from "../../packages/bot/src/runtime/bootstrap/BootstrapPhaseManager";
import type { GameContext } from "../../packages/bot/src/runtime/types/GameContext";

/**
 * Regression test for RCL4 transition detection and Phase 2 activation.
 * Validates that the bot correctly detects RCL level changes and transitions
 * between phases, particularly the critical RCL 4 → Phase 2 transition that
 * activates storage and prepares for link network (RCL 5).
 *
 * Issue: #<issue-number>
 * Feature: Automatic RCL4 progression with storage and link infrastructure
 */
describe("RCL4 Transition Detection", () => {
  let bootstrapManager: BootstrapPhaseManager;
  let mockMemory: Memory;
  let mockGame: GameContext;

  beforeEach(() => {
    bootstrapManager = new BootstrapPhaseManager();
    mockMemory = {
      rooms: {}
    } as Memory;

    mockGame = {
      time: 1000,
      rooms: {},
      creeps: {},
      spawns: {},
      cpu: { getUsed: () => 10, limit: 20, bucket: 10000 }
    } as unknown as GameContext;
  });

  describe("Phase detection based on RCL", () => {
    it("should detect Phase 1 for RCL 1-2", () => {
      // RCL 1
      mockGame.rooms["E54N39"] = {
        name: "E54N39",
        controller: { my: true, level: 1 },
        find: () => []
      } as unknown as Room;

      const transitions = bootstrapManager.detectRCLPhaseTransitions(mockGame, mockMemory);

      expect(transitions).toHaveLength(1);
      expect(transitions[0].newPhase).toBe("phase1");
      expect(transitions[0].rclLevel).toBe(1);
      expect(mockMemory.rooms?.["E54N39"]?.phase).toBe("phase1");
    });

    it("should detect Phase 1 for RCL 3", () => {
      mockGame.rooms["E54N39"] = {
        name: "E54N39",
        controller: { my: true, level: 3 },
        find: () => []
      } as unknown as Room;

      const transitions = bootstrapManager.detectRCLPhaseTransitions(mockGame, mockMemory);

      expect(transitions).toHaveLength(1);
      expect(transitions[0].newPhase).toBe("phase1");
      expect(transitions[0].rclLevel).toBe(3);
      expect(transitions[0].reason).toContain("RCL 3");
    });

    it("should detect Phase 2 when RCL 4 is achieved", () => {
      mockGame.rooms["E54N39"] = {
        name: "E54N39",
        controller: { my: true, level: 4 },
        find: () => []
      } as unknown as Room;

      const transitions = bootstrapManager.detectRCLPhaseTransitions(mockGame, mockMemory);

      expect(transitions).toHaveLength(1);
      expect(transitions[0].newPhase).toBe("phase2");
      expect(transitions[0].rclLevel).toBe(4);
      expect(transitions[0].reason).toContain("RCL 4");
      expect(transitions[0].reason).toContain("storage");
      expect(mockMemory.rooms?.["E54N39"]?.phase).toBe("phase2");
      expect(mockMemory.rooms?.["E54N39"]?.phaseActivatedAt).toBe(1000);
    });

    it("should detect Phase 2 for RCL 5", () => {
      mockGame.rooms["E54N39"] = {
        name: "E54N39",
        controller: { my: true, level: 5 },
        find: () => []
      } as unknown as Room;

      const transitions = bootstrapManager.detectRCLPhaseTransitions(mockGame, mockMemory);

      expect(transitions).toHaveLength(1);
      expect(transitions[0].newPhase).toBe("phase2");
      expect(transitions[0].rclLevel).toBe(5);
    });

    it("should detect Phase 4 for RCL 6+", () => {
      mockGame.rooms["E54N39"] = {
        name: "E54N39",
        controller: { my: true, level: 6 },
        find: () => []
      } as unknown as Room;

      const transitions = bootstrapManager.detectRCLPhaseTransitions(mockGame, mockMemory);

      expect(transitions).toHaveLength(1);
      expect(transitions[0].newPhase).toBe("phase4");
      expect(transitions[0].rclLevel).toBe(6);
    });

    it("should detect Phase 5 for RCL 8", () => {
      mockGame.rooms["E54N39"] = {
        name: "E54N39",
        controller: { my: true, level: 8 },
        find: () => []
      } as unknown as Room;

      const transitions = bootstrapManager.detectRCLPhaseTransitions(mockGame, mockMemory);

      expect(transitions).toHaveLength(1);
      expect(transitions[0].newPhase).toBe("phase5");
      expect(transitions[0].rclLevel).toBe(8);
    });
  });

  describe("Phase transition tracking", () => {
    it("should track phase transition from Phase 1 to Phase 2 at RCL 4", () => {
      // Start at RCL 3 (Phase 1)
      mockGame.rooms["E54N39"] = {
        name: "E54N39",
        controller: { my: true, level: 3 },
        find: () => []
      } as unknown as Room;

      let transitions = bootstrapManager.detectRCLPhaseTransitions(mockGame, mockMemory);
      expect(transitions[0].newPhase).toBe("phase1");
      expect(transitions[0].previousPhase).toBeUndefined();

      // Upgrade to RCL 4
      mockGame.time = 5000;
      mockGame.rooms["E54N39"].controller!.level = 4;

      transitions = bootstrapManager.detectRCLPhaseTransitions(mockGame, mockMemory);
      expect(transitions).toHaveLength(1);
      expect(transitions[0].previousPhase).toBe("phase1");
      expect(transitions[0].newPhase).toBe("phase2");
      expect(mockMemory.rooms?.["E54N39"]?.phaseActivatedAt).toBe(5000);
    });

    it("should not report transition if phase hasn't changed", () => {
      // Initialize at RCL 4 (Phase 2)
      mockGame.rooms["E54N39"] = {
        name: "E54N39",
        controller: { my: true, level: 4 },
        find: () => []
      } as unknown as Room;

      bootstrapManager.detectRCLPhaseTransitions(mockGame, mockMemory);

      // Check again without change
      mockGame.time = 1100;
      const transitions = bootstrapManager.detectRCLPhaseTransitions(mockGame, mockMemory);

      expect(transitions).toHaveLength(0);
    });

    it("should handle multiple rooms with different RCL levels", () => {
      mockGame.rooms["E54N39"] = {
        name: "E54N39",
        controller: { my: true, level: 4 },
        find: () => []
      } as unknown as Room;

      mockGame.rooms["E55N39"] = {
        name: "E55N39",
        controller: { my: true, level: 3 },
        find: () => []
      } as unknown as Room;

      const transitions = bootstrapManager.detectRCLPhaseTransitions(mockGame, mockMemory);

      expect(transitions).toHaveLength(2);
      expect(transitions.find(t => t.roomName === "E54N39")?.newPhase).toBe("phase2");
      expect(transitions.find(t => t.roomName === "E55N39")?.newPhase).toBe("phase1");
    });
  });

  describe("Storage status tracking", () => {
    it("should detect operational storage when energy > 10k", () => {
      mockMemory.rooms = {
        E54N39: {
          phase: "phase2",
          rclLevelDetected: 4
        }
      };

      const mockRoom = {
        name: "E54N39",
        storage: {
          store: {
            getUsedCapacity: (resource: ResourceConstant) => {
              return resource === RESOURCE_ENERGY ? 15000 : 0;
            }
          }
        },
        find: () => []
      } as unknown as Room;

      const result = bootstrapManager.checkStorageStatus(mockRoom, mockMemory);

      expect(result).toBe(true);
      expect(mockMemory.rooms?.["E54N39"]?.storageBuilt).toBe(true);
    });

    it("should not mark storage as operational when energy < 10k", () => {
      mockMemory.rooms = {
        E54N39: {
          phase: "phase2",
          rclLevelDetected: 4
        }
      };

      const mockRoom = {
        name: "E54N39",
        storage: {
          store: {
            getUsedCapacity: (resource: ResourceConstant) => {
              return resource === RESOURCE_ENERGY ? 5000 : 0;
            }
          }
        },
        find: () => []
      } as unknown as Room;

      const result = bootstrapManager.checkStorageStatus(mockRoom, mockMemory);

      expect(result).toBe(false);
      expect(mockMemory.rooms?.["E54N39"]?.storageBuilt).toBeUndefined();
    });

    it("should return false when no storage exists", () => {
      mockMemory.rooms = {
        E54N39: {
          phase: "phase2",
          rclLevelDetected: 4
        }
      };

      const mockRoom = {
        name: "E54N39",
        storage: null,
        find: () => []
      } as unknown as Room;

      const result = bootstrapManager.checkStorageStatus(mockRoom, mockMemory);

      expect(result).toBe(false);
    });
  });

  describe("Integration with existing bootstrap logic", () => {
    it("should not interfere with existing bootstrap phase completion", () => {
      mockGame.rooms["E54N39"] = {
        name: "E54N39",
        controller: { my: true, level: 2 },
        energyAvailable: 300,
        energyCapacityAvailable: 300,
        find: () => []
      } as unknown as Room;

      mockMemory.bootstrap = {
        isActive: true,
        startedAt: 100
      };

      mockMemory.roles = {
        harvester: 4
      };

      const bootstrapStatus = bootstrapManager.checkBootstrapStatus(mockGame, mockMemory);

      expect(bootstrapStatus.isActive).toBe(true);
      expect(bootstrapStatus.shouldTransition).toBe(true);
      expect(bootstrapStatus.reason).toContain("Controller reached level 2");
    });
  });
});
