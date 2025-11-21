import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/EventBus.js";
import { EventEmitter } from "../../src/EventEmitter.js";
import { EventTypes } from "../../src/EventTypes.js";

// Mock Game object
global.Game = {
  time: 1000
} as Game;

describe("EventEmitter", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    global.Game.time = 1000;
  });

  describe("emitEvent", () => {
    it("should emit events through the event bus", () => {
      const handler = vi.fn();
      eventBus.subscribe("test:event", handler);

      class TestEmitter extends EventEmitter {
        public triggerEvent() {
          this.emitEvent("test:event", { data: "test" });
        }
      }

      const emitter = new TestEmitter(eventBus);
      emitter.triggerEvent();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "test:event",
          data: { data: "test" }
        })
      );
    });

    it("should use constructor name as default source", () => {
      const handler = vi.fn();
      eventBus.subscribe("test:event", handler);

      class CustomManager extends EventEmitter {
        public triggerEvent() {
          this.emitEvent("test:event", { value: 42 });
        }
      }

      const manager = new CustomManager(eventBus);
      manager.triggerEvent();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "CustomManager"
        })
      );
    });

    it("should allow custom source to be specified", () => {
      const handler = vi.fn();
      eventBus.subscribe("test:event", handler);

      class TestEmitter extends EventEmitter {
        public triggerEvent() {
          this.emitEvent("test:event", { data: "test" }, "CustomSource");
        }
      }

      const emitter = new TestEmitter(eventBus);
      emitter.triggerEvent();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "CustomSource"
        })
      );
    });

    it("should work with typed events", () => {
      const handler = vi.fn();
      eventBus.subscribe(EventTypes.ENERGY_DEPLETED, handler);

      class TowerManager extends EventEmitter {
        public reportEnergyDepletion() {
          this.emitEvent(EventTypes.ENERGY_DEPLETED, {
            roomName: "E1N1",
            structureType: "tower",
            structureId: "tower-id"
          });
        }
      }

      const manager = new TowerManager(eventBus);
      manager.reportEnergyDepletion();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EventTypes.ENERGY_DEPLETED,
          data: {
            roomName: "E1N1",
            structureType: "tower",
            structureId: "tower-id"
          }
        })
      );
    });
  });

  describe("integration with EventBus", () => {
    it("should support multiple emitters sharing the same event bus", () => {
      const handler = vi.fn();
      eventBus.subscribe("shared:event", handler);

      class EmitterA extends EventEmitter {
        public emit() {
          this.emitEvent("shared:event", { source: "A" });
        }
      }

      class EmitterB extends EventEmitter {
        public emit() {
          this.emitEvent("shared:event", { source: "B" });
        }
      }

      const emitterA = new EmitterA(eventBus);
      const emitterB = new EmitterB(eventBus);

      emitterA.emit();
      emitterB.emit();

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: { source: "A" },
          source: "EmitterA"
        })
      );
      expect(handler).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: { source: "B" },
          source: "EmitterB"
        })
      );
    });
  });
});
