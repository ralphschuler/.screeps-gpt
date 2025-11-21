import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/EventBus.js";
import { EventTypes } from "../../src/EventTypes.js";

// Mock Game object
global.Game = {
  time: 1000
} as Game;

describe("EventBus", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    global.Game.time = 1000;
  });

  describe("subscribe", () => {
    it("should register an event handler", () => {
      const handler = vi.fn();
      eventBus.subscribe("test:event", handler);

      expect(eventBus.getHandlerCount("test:event")).toBe(1);
    });

    it("should allow multiple handlers for the same event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.subscribe("test:event", handler1);
      eventBus.subscribe("test:event", handler2);

      expect(eventBus.getHandlerCount("test:event")).toBe(2);
    });

    it("should return an unsubscribe function", () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe("test:event", handler);

      expect(eventBus.getHandlerCount("test:event")).toBe(1);
      unsubscribe();
      expect(eventBus.getHandlerCount("test:event")).toBe(0);
    });

    it("should handle multiple subscriptions and unsubscriptions", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      const unsub1 = eventBus.subscribe("test:event", handler1);
      const unsub2 = eventBus.subscribe("test:event", handler2);
      const unsub3 = eventBus.subscribe("test:event", handler3);

      expect(eventBus.getHandlerCount("test:event")).toBe(3);

      unsub2();
      expect(eventBus.getHandlerCount("test:event")).toBe(2);

      unsub1();
      unsub3();
      expect(eventBus.getHandlerCount("test:event")).toBe(0);
    });
  });

  describe("emit", () => {
    it("should call subscribed handlers with event data", () => {
      const handler = vi.fn();
      eventBus.subscribe("test:event", handler);

      const testData = { message: "hello" };
      eventBus.emit("test:event", testData, "TestSource");

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        type: "test:event",
        data: testData,
        tick: 1000,
        source: "TestSource"
      });
    });

    it("should call multiple handlers for the same event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      eventBus.subscribe("test:event", handler1);
      eventBus.subscribe("test:event", handler2);
      eventBus.subscribe("test:event", handler3);

      const testData = { value: 42 };
      eventBus.emit("test:event", testData);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it("should not call handlers for different event types", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.subscribe("event:a", handler1);
      eventBus.subscribe("event:b", handler2);

      eventBus.emit("event:a", { data: 1 });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();
    });

    it("should handle emission with no subscribers gracefully", () => {
      expect(() => {
        eventBus.emit("nonexistent:event", { data: "test" });
      }).not.toThrow();
    });

    it("should include Game.time in emitted events", () => {
      const handler = vi.fn();
      eventBus.subscribe("test:event", handler);

      global.Game.time = 5000;
      eventBus.emit("test:event", {});

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ tick: 5000 }));
    });

    it("should allow source to be optional", () => {
      const handler = vi.fn();
      eventBus.subscribe("test:event", handler);

      eventBus.emit("test:event", { data: "test" });

      const call = handler.mock.calls[0][0];
      expect(call).toHaveProperty("type", "test:event");
      expect(call).toHaveProperty("data");
      expect(call).toHaveProperty("tick");
      expect(call).not.toHaveProperty("source");
    });
  });

  describe("error isolation", () => {
    it("should catch and log handler errors without crashing", () => {
      const consoleLogSpy = vi.spyOn(console, "log");
      const handler1 = vi.fn(() => {
        throw new Error("Handler 1 error");
      });
      const handler2 = vi.fn();

      eventBus.subscribe("test:event", handler1);
      eventBus.subscribe("test:event", handler2);

      expect(() => {
        eventBus.emit("test:event", { data: "test" });
      }).not.toThrow();

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("[EventBus] Handler error"));

      consoleLogSpy.mockRestore();
    });

    it("should continue calling remaining handlers after one fails", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn(() => {
        throw new Error("Handler 2 error");
      });
      const handler3 = vi.fn();

      eventBus.subscribe("test:event", handler1);
      eventBus.subscribe("test:event", handler2);
      eventBus.subscribe("test:event", handler3);

      eventBus.emit("test:event", { data: "test" });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });
  });

  describe("clear", () => {
    it("should remove all handlers for a specific event type", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.subscribe("test:event", handler1);
      eventBus.subscribe("test:event", handler2);

      expect(eventBus.getHandlerCount("test:event")).toBe(2);

      eventBus.clear("test:event");

      expect(eventBus.getHandlerCount("test:event")).toBe(0);
      eventBus.emit("test:event", { data: "test" });
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it("should remove all handlers for all events when no type specified", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      eventBus.subscribe("event:a", handler1);
      eventBus.subscribe("event:b", handler2);
      eventBus.subscribe("event:c", handler3);

      eventBus.clear();

      expect(eventBus.getHandlerCount("event:a")).toBe(0);
      expect(eventBus.getHandlerCount("event:b")).toBe(0);
      expect(eventBus.getHandlerCount("event:c")).toBe(0);
    });

    it("should not affect other event types when clearing specific type", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.subscribe("event:a", handler1);
      eventBus.subscribe("event:b", handler2);

      eventBus.clear("event:a");

      expect(eventBus.getHandlerCount("event:a")).toBe(0);
      expect(eventBus.getHandlerCount("event:b")).toBe(1);
    });
  });

  describe("getHandlerCount", () => {
    it("should return 0 for unregistered events", () => {
      expect(eventBus.getHandlerCount("nonexistent:event")).toBe(0);
    });

    it("should return correct count for registered handlers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.subscribe("test:event", handler1);
      expect(eventBus.getHandlerCount("test:event")).toBe(1);

      eventBus.subscribe("test:event", handler2);
      expect(eventBus.getHandlerCount("test:event")).toBe(2);
    });
  });

  describe("getEventTypes", () => {
    it("should return empty array when no handlers registered", () => {
      expect(eventBus.getEventTypes()).toEqual([]);
    });

    it("should return all registered event types", () => {
      eventBus.subscribe("event:a", vi.fn());
      eventBus.subscribe("event:b", vi.fn());
      eventBus.subscribe("event:c", vi.fn());

      const types = eventBus.getEventTypes();
      expect(types).toHaveLength(3);
      expect(types).toContain("event:a");
      expect(types).toContain("event:b");
      expect(types).toContain("event:c");
    });
  });

  describe("typed events", () => {
    it("should work with predefined event types", () => {
      const handler = vi.fn();
      eventBus.subscribe(EventTypes.CREEP_SPAWNED, handler);

      eventBus.emit(EventTypes.CREEP_SPAWNED, {
        creepName: "Harvester1",
        role: "harvester",
        spawnName: "Spawn1"
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EventTypes.CREEP_SPAWNED,
          data: {
            creepName: "Harvester1",
            role: "harvester",
            spawnName: "Spawn1"
          }
        })
      );
    });
  });

  describe("integration scenarios", () => {
    it("should support observer pattern with multiple subscribers", () => {
      const statsCollector = vi.fn();
      const logger = vi.fn();
      const analytics = vi.fn();

      eventBus.subscribe(EventTypes.CREEP_SPAWNED, statsCollector);
      eventBus.subscribe(EventTypes.CREEP_SPAWNED, logger);
      eventBus.subscribe(EventTypes.CREEP_SPAWNED, analytics);

      eventBus.emit(
        EventTypes.CREEP_SPAWNED,
        {
          creepName: "Builder1",
          role: "builder",
          spawnName: "Spawn1"
        },
        "SpawnManager"
      );

      expect(statsCollector).toHaveBeenCalledTimes(1);
      expect(logger).toHaveBeenCalledTimes(1);
      expect(analytics).toHaveBeenCalledTimes(1);
    });

    it("should allow dynamic subscription and unsubscription", () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe("test:event", handler);

      eventBus.emit("test:event", { count: 1 });
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      eventBus.emit("test:event", { count: 2 });
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });
  });
});
