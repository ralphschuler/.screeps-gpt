import { describe, expect, it, vi } from "vitest";
import { assign, log, chain } from "../../src/helpers/actions.js";

describe("Action helpers", () => {
  interface TestContext {
    counter: number;
    name: string;
    flag: boolean;
  }

  interface TestEvent {
    type: "TEST";
    value?: number;
  }

  describe("assign", () => {
    it("should assign a static value to context property", () => {
      const action = assign<TestContext, TestEvent, "counter">("counter", 42);
      const ctx: TestContext = { counter: 0, name: "test", flag: false };

      action(ctx, { type: "TEST" });

      expect(ctx.counter).toBe(42);
    });

    it("should assign a computed value to context property", () => {
      const action = assign<TestContext, TestEvent, "counter">("counter", ctx => ctx.counter + 10);
      const ctx: TestContext = { counter: 5, name: "test", flag: false };

      action(ctx, { type: "TEST" });

      expect(ctx.counter).toBe(15);
    });

    it("should use event data in computed value", () => {
      const action = assign<TestContext, TestEvent, "counter">(
        "counter",
        (ctx, event) => ctx.counter + (event.value || 0)
      );
      const ctx: TestContext = { counter: 5, name: "test", flag: false };

      action(ctx, { type: "TEST", value: 20 });

      expect(ctx.counter).toBe(25);
    });

    it("should assign string values", () => {
      const action = assign<TestContext, TestEvent, "name">("name", "updated");
      const ctx: TestContext = { counter: 0, name: "test", flag: false };

      action(ctx, { type: "TEST" });

      expect(ctx.name).toBe("updated");
    });

    it("should assign boolean values", () => {
      const action = assign<TestContext, TestEvent, "flag">("flag", true);
      const ctx: TestContext = { counter: 0, name: "test", flag: false };

      action(ctx, { type: "TEST" });

      expect(ctx.flag).toBe(true);
    });

    it("should assign computed string values", () => {
      const action = assign<TestContext, TestEvent, "name">("name", ctx => `${ctx.name}_updated`);
      const ctx: TestContext = { counter: 0, name: "test", flag: false };

      action(ctx, { type: "TEST" });

      expect(ctx.name).toBe("test_updated");
    });
  });

  describe("log", () => {
    it("should log a static message", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const action = log<TestContext, TestEvent>("Test message");
      const ctx: TestContext = { counter: 0, name: "test", flag: false };

      action(ctx, { type: "TEST" });

      expect(consoleSpy).toHaveBeenCalledWith("Test message");
      consoleSpy.mockRestore();
    });

    it("should log a computed message", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const action = log<TestContext, TestEvent>(ctx => `Counter is ${ctx.counter}`);
      const ctx: TestContext = { counter: 42, name: "test", flag: false };

      action(ctx, { type: "TEST" });

      expect(consoleSpy).toHaveBeenCalledWith("Counter is 42");
      consoleSpy.mockRestore();
    });

    it("should log message with event data", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const action = log<TestContext, TestEvent>((ctx, event) => `Event: ${event.type}, Value: ${event.value}`);
      const ctx: TestContext = { counter: 0, name: "test", flag: false };

      action(ctx, { type: "TEST", value: 100 });

      expect(consoleSpy).toHaveBeenCalledWith("Event: TEST, Value: 100");
      consoleSpy.mockRestore();
    });
  });

  describe("chain", () => {
    it("should execute multiple actions in sequence", () => {
      const action1 = vi.fn();
      const action2 = vi.fn();
      const action3 = vi.fn();

      const chained = chain(action1, action2, action3);
      const ctx: TestContext = { counter: 0, name: "test", flag: false };
      const event: TestEvent = { type: "TEST" };

      chained(ctx, event);

      expect(action1).toHaveBeenCalledWith(ctx, event);
      expect(action2).toHaveBeenCalledWith(ctx, event);
      expect(action3).toHaveBeenCalledWith(ctx, event);
    });

    it("should execute actions in the correct order", () => {
      const calls: number[] = [];
      const action1 = vi.fn(() => calls.push(1));
      const action2 = vi.fn(() => calls.push(2));
      const action3 = vi.fn(() => calls.push(3));

      const chained = chain(action1, action2, action3);
      const ctx: TestContext = { counter: 0, name: "test", flag: false };

      chained(ctx, { type: "TEST" });

      expect(calls).toEqual([1, 2, 3]);
    });

    it("should pass mutations between chained actions", () => {
      const action1 = (ctx: TestContext) => {
        ctx.counter += 5;
      };
      const action2 = (ctx: TestContext) => {
        ctx.counter *= 2;
      };
      const action3 = (ctx: TestContext) => {
        ctx.name = `count_${ctx.counter}`;
      };

      const chained = chain(action1, action2, action3);
      const ctx: TestContext = { counter: 10, name: "test", flag: false };

      chained(ctx, { type: "TEST" });

      expect(ctx.counter).toBe(30); // (10 + 5) * 2
      expect(ctx.name).toBe("count_30");
    });

    it("should work with a single action", () => {
      const action = vi.fn();
      const chained = chain(action);
      const ctx: TestContext = { counter: 0, name: "test", flag: false };
      const event: TestEvent = { type: "TEST" };

      chained(ctx, event);

      expect(action).toHaveBeenCalledWith(ctx, event);
    });

    it("should work with no actions", () => {
      const chained = chain<TestContext, TestEvent>();
      const ctx: TestContext = { counter: 0, name: "test", flag: false };

      expect(() => chained(ctx, { type: "TEST" })).not.toThrow();
    });
  });

  describe("Combined helpers", () => {
    it("should chain assign and log actions", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const combined = chain(
        assign<TestContext, TestEvent, "counter">("counter", ctx => ctx.counter + 10),
        log<TestContext, TestEvent>(ctx => `Counter updated to ${ctx.counter}`)
      );

      const ctx: TestContext = { counter: 5, name: "test", flag: false };

      combined(ctx, { type: "TEST" });

      expect(ctx.counter).toBe(15);
      expect(consoleSpy).toHaveBeenCalledWith("Counter updated to 15");
      consoleSpy.mockRestore();
    });

    it("should chain multiple assign actions", () => {
      const combined = chain(
        assign<TestContext, TestEvent, "counter">("counter", 100),
        assign<TestContext, TestEvent, "name">("name", "updated"),
        assign<TestContext, TestEvent, "flag">("flag", true)
      );

      const ctx: TestContext = { counter: 0, name: "test", flag: false };

      combined(ctx, { type: "TEST" });

      expect(ctx.counter).toBe(100);
      expect(ctx.name).toBe("updated");
      expect(ctx.flag).toBe(true);
    });
  });

  describe("Real-world Screeps scenarios", () => {
    interface CreepContext {
      creep: {
        say: (msg: string) => void;
        memory: { role: string; target?: string };
      };
      energy: number;
      target?: string;
    }

    type CreepEvent = { type: "HARVEST"; sourceId: string } | { type: "DELIVER" };

    it("should update creep memory and energy", () => {
      const mockCreep = {
        say: vi.fn(),
        memory: { role: "harvester" }
      };

      const harvestAction = chain(
        assign<CreepContext, CreepEvent, "target">("target", (ctx, event) =>
          event.type === "HARVEST" ? event.sourceId : undefined
        ),
        assign<CreepContext, CreepEvent, "energy">("energy", ctx => ctx.energy + 50),
        log<CreepContext, CreepEvent>(ctx => `Harvested energy, now at ${ctx.energy}`)
      );

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const ctx: CreepContext = {
        creep: mockCreep,
        energy: 0
      };

      harvestAction(ctx, { type: "HARVEST", sourceId: "source1" });

      expect(ctx.target).toBe("source1");
      expect(ctx.energy).toBe(50);
      expect(consoleSpy).toHaveBeenCalledWith("Harvested energy, now at 50");

      consoleSpy.mockRestore();
    });

    it("should make creep say message on state entry", () => {
      const mockCreep = {
        say: vi.fn(),
        memory: { role: "harvester" }
      };

      const entryAction = chain(
        (ctx: CreepContext) => ctx.creep.say("⛏️ mining"),
        log<CreepContext, CreepEvent>("Creep started harvesting")
      );

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const ctx: CreepContext = {
        creep: mockCreep,
        energy: 0
      };

      entryAction(ctx, { type: "HARVEST", sourceId: "source1" });

      expect(mockCreep.say).toHaveBeenCalledWith("⛏️ mining");
      expect(consoleSpy).toHaveBeenCalledWith("Creep started harvesting");

      consoleSpy.mockRestore();
    });
  });
});
