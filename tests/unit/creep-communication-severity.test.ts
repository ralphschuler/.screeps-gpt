/**
 * Tests for CreepCommunicationManager severity-based message filtering
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreepCommunicationManager, CommunicationLevel } from "@runtime/behavior";

// Mock creep for testing
function createMockCreep(name = "testCreep"): any {
  const sayMock = vi.fn().mockReturnValue(OK);
  return {
    name,
    say: sayMock,
    pos: { x: 25, y: 25, roomName: "W1N1" } as RoomPosition,
    room: {
      name: "W1N1",
      visual: {
        line: vi.fn(),
        circle: vi.fn()
      }
    },
    memory: {}
  };
}

describe("CreepCommunicationManager Severity System", () => {
  let manager: CreepCommunicationManager;
  let creep: ReturnType<typeof createMockCreep>;

  beforeEach(() => {
    creep = createMockCreep();
  });

  describe("CommunicationLevel Configuration", () => {
    it("should default to VERBOSE level for 'normal' verbosity (backward compatibility)", () => {
      manager = new CreepCommunicationManager({ verbosity: "normal" });
      const config = manager.getConfig();
      expect(config.level).toBe(CommunicationLevel.VERBOSE);
    });

    it("should map 'minimal' verbosity to ERROR level (backward compatibility)", () => {
      manager = new CreepCommunicationManager({ verbosity: "minimal" });
      const config = manager.getConfig();
      expect(config.level).toBe(CommunicationLevel.ERROR);
    });

    it("should map 'verbose' verbosity to VERBOSE level", () => {
      manager = new CreepCommunicationManager({ verbosity: "verbose" });
      const config = manager.getConfig();
      expect(config.level).toBe(CommunicationLevel.VERBOSE);
    });

    it("should map 'disabled' verbosity to SILENT level", () => {
      manager = new CreepCommunicationManager({ verbosity: "disabled" });
      const config = manager.getConfig();
      expect(config.level).toBe(CommunicationLevel.SILENT);
    });

    it("should allow explicit level override", () => {
      manager = new CreepCommunicationManager({
        verbosity: "normal",
        level: CommunicationLevel.VERBOSE
      });
      const config = manager.getConfig();
      expect(config.level).toBe(CommunicationLevel.VERBOSE);
    });
  });

  describe("Message Filtering by Severity", () => {
    it("should show ERROR messages at WARNING level", () => {
      manager = new CreepCommunicationManager({ level: CommunicationLevel.WARNING });
      manager.error(creep, "error", "test");
      expect(creep.say).toHaveBeenCalled();
    });

    it("should show WARNING messages at WARNING level", () => {
      manager = new CreepCommunicationManager({ level: CommunicationLevel.WARNING });
      manager.warn(creep, "empty", "test");
      expect(creep.say).toHaveBeenCalled();
    });

    it("should NOT show INFO messages at WARNING level", () => {
      manager = new CreepCommunicationManager({ level: CommunicationLevel.WARNING });
      manager.info(creep, "gather", "test");
      expect(creep.say).not.toHaveBeenCalled();
    });

    it("should NOT show VERBOSE messages at WARNING level", () => {
      manager = new CreepCommunicationManager({ level: CommunicationLevel.WARNING });
      manager.verbose(creep, "harvest", "test");
      expect(creep.say).not.toHaveBeenCalled();
    });

    it("should show routine actions only at VERBOSE level", () => {
      manager = new CreepCommunicationManager({ level: CommunicationLevel.VERBOSE });
      manager.say(creep, "harvest"); // harvest defaults to VERBOSE
      expect(creep.say).toHaveBeenCalled();

      creep = createMockCreep();
      manager = new CreepCommunicationManager({ level: CommunicationLevel.WARNING });
      manager.say(creep, "harvest");
      expect(creep.say).not.toHaveBeenCalled();
    });
  });

  describe("Action Default Severity Mapping", () => {
    it("should treat 'stuck' and 'error' as ERROR level", () => {
      manager = new CreepCommunicationManager({ level: CommunicationLevel.ERROR });
      manager.say(creep, "stuck");
      expect(creep.say).toHaveBeenCalled();

      creep = createMockCreep();
      manager.say(creep, "error");
      expect(creep.say).toHaveBeenCalled();
    });

    it("should treat 'empty' and 'full' as WARNING level", () => {
      manager = new CreepCommunicationManager({ level: CommunicationLevel.WARNING });
      manager.say(creep, "empty");
      expect(creep.say).toHaveBeenCalled();

      creep = createMockCreep();
      manager.say(creep, "full");
      expect(creep.say).toHaveBeenCalled();
    });

    it("should treat 'gather' as INFO level", () => {
      manager = new CreepCommunicationManager({ level: CommunicationLevel.INFO });
      manager.say(creep, "gather");
      expect(creep.say).toHaveBeenCalled();

      creep = createMockCreep();
      manager = new CreepCommunicationManager({ level: CommunicationLevel.WARNING });
      manager.say(creep, "gather");
      expect(creep.say).not.toHaveBeenCalled();
    });

    it("should treat routine actions as VERBOSE level", () => {
      const routineActions: Array<"harvest" | "deliver" | "upgrade" | "build" | "repair"> = [
        "harvest",
        "deliver",
        "upgrade",
        "build",
        "repair"
      ];

      manager = new CreepCommunicationManager({ level: CommunicationLevel.VERBOSE });
      for (const action of routineActions) {
        creep = createMockCreep();
        manager.say(creep, action);
        expect(creep.say).toHaveBeenCalled();
      }

      // Should not show at WARNING level
      manager = new CreepCommunicationManager({ level: CommunicationLevel.WARNING });
      for (const action of routineActions) {
        creep = createMockCreep();
        manager.say(creep, action);
        expect(creep.say).not.toHaveBeenCalled();
      }
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain sayError() behavior", () => {
      manager = new CreepCommunicationManager({ level: CommunicationLevel.WARNING });
      manager.sayError(creep, "test");
      expect(creep.say).toHaveBeenCalled();
    });

    it("should handle stuck creeps in sayError()", () => {
      manager = new CreepCommunicationManager({ level: CommunicationLevel.WARNING, verbosity: "verbose" });
      creep.memory.stuck = true;
      manager.sayError(creep, "test");
      expect(creep.say).toHaveBeenCalledWith("❌ test", false);
    });

    it("should maintain sayResourceStatus() behavior", () => {
      manager = new CreepCommunicationManager({ level: CommunicationLevel.WARNING });
      manager.sayResourceStatus(creep, true, 100);
      expect(creep.say).toHaveBeenCalled();

      creep = createMockCreep();
      manager.sayResourceStatus(creep, false, 0);
      expect(creep.say).toHaveBeenCalled();
    });
  });

  describe("Configuration Updates", () => {
    it("should allow runtime level updates", () => {
      manager = new CreepCommunicationManager({ level: CommunicationLevel.SILENT });
      manager.say(creep, "harvest");
      expect(creep.say).not.toHaveBeenCalled();

      manager.updateConfig({ level: CommunicationLevel.VERBOSE });
      creep = createMockCreep();
      manager.say(creep, "harvest");
      expect(creep.say).toHaveBeenCalled();
    });

    it("should update level when verbosity changes", () => {
      manager = new CreepCommunicationManager({ verbosity: "disabled" });
      expect(manager.getConfig().level).toBe(CommunicationLevel.SILENT);

      manager.updateConfig({ verbosity: "verbose" });
      expect(manager.getConfig().level).toBe(CommunicationLevel.VERBOSE);
    });
  });

  describe("SILENT Level", () => {
    it("should suppress all messages at SILENT level", () => {
      manager = new CreepCommunicationManager({ level: CommunicationLevel.SILENT });

      manager.error(creep, "error", "test");
      expect(creep.say).not.toHaveBeenCalled();

      creep = createMockCreep();
      manager.warn(creep, "empty", "test");
      expect(creep.say).not.toHaveBeenCalled();

      creep = createMockCreep();
      manager.info(creep, "gather", "test");
      expect(creep.say).not.toHaveBeenCalled();

      creep = createMockCreep();
      manager.verbose(creep, "harvest", "test");
      expect(creep.say).not.toHaveBeenCalled();
    });
  });

  describe("Severity Method Convenience", () => {
    beforeEach(() => {
      manager = new CreepCommunicationManager({ level: CommunicationLevel.VERBOSE, verbosity: "verbose" });
    });

    it("should have error() method for ERROR level messages", () => {
      manager.error(creep, "error", "critical");
      expect(creep.say).toHaveBeenCalledWith("⚠️ critica", false);
    });

    it("should have warn() method for WARNING level messages", () => {
      manager.warn(creep, "empty", "low");
      expect(creep.say).toHaveBeenCalled();
    });

    it("should have info() method for INFO level messages", () => {
      manager.info(creep, "gather", "ok");
      expect(creep.say).toHaveBeenCalled();
    });

    it("should have verbose() method for VERBOSE level messages", () => {
      manager.verbose(creep, "harvest", "ok");
      expect(creep.say).toHaveBeenCalled();
    });
  });
});
