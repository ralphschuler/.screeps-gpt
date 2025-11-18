import { describe, expect, it } from "vitest";
import { StateMachine } from "../../src/StateMachine.js";
import { serialize, restore } from "../../src/helpers/persistence.js";
import type { StateConfig } from "../../src/types.js";

describe("Persistence helpers", () => {
  interface TestContext {
    counter: number;
    name: string;
  }

  type TestEvent = { type: "INCREMENT" } | { type: "RESET" };

  const testStates: Record<string, StateConfig<TestContext, TestEvent>> = {
    idle: {
      on: {
        INCREMENT: { target: "active" }
      }
    },
    active: {
      on: {
        RESET: { target: "idle" }
      }
    }
  };

  describe("serialize", () => {
    it("should serialize machine state and context", () => {
      const machine = new StateMachine<TestContext, TestEvent>("idle", testStates, { counter: 0, name: "test" });

      const serialized = serialize(machine);

      expect(serialized).toEqual({
        state: "idle",
        context: { counter: 0, name: "test" }
      });
    });

    it("should capture current state after transitions", () => {
      const machine = new StateMachine<TestContext, TestEvent>("idle", testStates, { counter: 0, name: "test" });

      machine.send({ type: "INCREMENT" });

      const serialized = serialize(machine);

      expect(serialized).toEqual({
        state: "active",
        context: { counter: 0, name: "test" }
      });
    });

    it("should capture context mutations", () => {
      const statesWithActions: Record<string, StateConfig<TestContext, TestEvent>> = {
        idle: {
          on: {
            INCREMENT: {
              target: "active",
              actions: [
                ctx => {
                  ctx.counter += 5;
                }
              ]
            }
          }
        },
        active: {}
      };

      const machine = new StateMachine<TestContext, TestEvent>("idle", statesWithActions, { counter: 0, name: "test" });

      machine.send({ type: "INCREMENT" });

      const serialized = serialize(machine);

      expect(serialized).toEqual({
        state: "active",
        context: { counter: 5, name: "test" }
      });
    });

    it("should handle complex context objects", () => {
      interface ComplexContext {
        nested: {
          value: number;
          array: number[];
        };
        flag: boolean;
      }

      interface ComplexEvent {
        type: "TEST";
      }

      const machine = new StateMachine<ComplexContext, ComplexEvent>(
        "idle",
        { idle: {} },
        {
          nested: {
            value: 42,
            array: [1, 2, 3]
          },
          flag: true
        }
      );

      const serialized = serialize(machine);

      expect(serialized.context).toEqual({
        nested: {
          value: 42,
          array: [1, 2, 3]
        },
        flag: true
      });
    });
  });

  describe("restore", () => {
    it("should restore machine from serialized data", () => {
      const serialized = {
        state: "active",
        context: { counter: 10, name: "restored" }
      };

      const machine = restore(serialized, testStates);

      expect(machine.getState()).toBe("active");
      expect(machine.getContext()).toEqual({ counter: 10, name: "restored" });
    });

    it("should create functional machine after restore", () => {
      const serialized = {
        state: "active",
        context: { counter: 10, name: "restored" }
      };

      const machine = restore(serialized, testStates);

      machine.send({ type: "RESET" });

      expect(machine.getState()).toBe("idle");
    });

    it("should preserve state configuration after restore", () => {
      const serialized = {
        state: "idle",
        context: { counter: 0, name: "test" }
      };

      const machine = restore(serialized, testStates);

      machine.send({ type: "INCREMENT" });

      expect(machine.getState()).toBe("active");
    });
  });

  describe("Serialize-Restore round trip", () => {
    it("should maintain state through serialization cycle", () => {
      const original = new StateMachine<TestContext, TestEvent>("idle", testStates, { counter: 42, name: "original" });

      original.send({ type: "INCREMENT" });

      const serialized = serialize(original);
      const restored = restore(serialized, testStates);

      expect(restored.getState()).toBe(original.getState());
      expect(restored.getContext()).toEqual(original.getContext());
    });

    it("should allow continued operation after restore", () => {
      const original = new StateMachine<TestContext, TestEvent>("idle", testStates, { counter: 0, name: "test" });

      original.send({ type: "INCREMENT" });

      const serialized = serialize(original);
      const restored = restore(serialized, testStates);

      restored.send({ type: "RESET" });

      expect(restored.getState()).toBe("idle");
    });

    it("should handle multiple serialization cycles", () => {
      let machine = new StateMachine<TestContext, TestEvent>("idle", testStates, { counter: 0, name: "test" });

      // First cycle
      machine.send({ type: "INCREMENT" });
      let serialized = serialize(machine);
      machine = restore(serialized, testStates);
      expect(machine.getState()).toBe("active");

      // Second cycle
      machine.send({ type: "RESET" });
      serialized = serialize(machine);
      machine = restore(serialized, testStates);
      expect(machine.getState()).toBe("idle");

      // Third cycle
      machine.send({ type: "INCREMENT" });
      serialized = serialize(machine);
      machine = restore(serialized, testStates);
      expect(machine.getState()).toBe("active");
    });
  });

  describe("Real-world Screeps Memory scenario", () => {
    interface CreepContext {
      role: string;
      sourceId?: string;
      targetId?: string;
      energy: number;
    }

    type CreepEvent =
      | { type: "HARVEST"; sourceId: string }
      | { type: "DELIVER"; targetId: string }
      | { type: "COMPLETE" };

    const creepStates: Record<string, StateConfig<CreepContext, CreepEvent>> = {
      idle: {
        on: {
          HARVEST: {
            target: "harvesting",
            actions: [
              (ctx, event) => {
                ctx.sourceId = event.sourceId;
              }
            ]
          }
        }
      },
      harvesting: {
        on: {
          DELIVER: {
            target: "delivering",
            actions: [
              (ctx, event) => {
                ctx.targetId = event.targetId;
              },
              ctx => {
                ctx.energy = 50;
              }
            ]
          }
        }
      },
      delivering: {
        on: {
          COMPLETE: {
            target: "idle",
            actions: [
              ctx => {
                ctx.energy = 0;
                ctx.sourceId = undefined;
                ctx.targetId = undefined;
              }
            ]
          }
        }
      }
    };

    it("should persist harvester state between ticks", () => {
      // Tick 1: Initialize and start harvesting
      let machine = new StateMachine<CreepContext, CreepEvent>("idle", creepStates, { role: "harvester", energy: 0 });

      machine.send({ type: "HARVEST", sourceId: "source1" });

      // Simulate saving to Memory
      const tick1Memory = serialize(machine);

      // Tick 2: Restore and continue to delivery
      machine = restore(tick1Memory, creepStates);
      expect(machine.getState()).toBe("harvesting");
      expect(machine.getContext().sourceId).toBe("source1");

      machine.send({ type: "DELIVER", targetId: "spawn1" });

      // Simulate saving to Memory
      const tick2Memory = serialize(machine);

      // Tick 3: Restore and complete delivery
      machine = restore(tick2Memory, creepStates);
      expect(machine.getState()).toBe("delivering");
      expect(machine.getContext().targetId).toBe("spawn1");
      expect(machine.getContext().energy).toBe(50);

      machine.send({ type: "COMPLETE" });

      expect(machine.getState()).toBe("idle");
      expect(machine.getContext().energy).toBe(0);
    });

    it("should handle Memory-like storage format", () => {
      // Simulate Screeps Memory structure
      const memory: { creepMachine?: { state: string; context: unknown } } = {};

      const machine = new StateMachine<CreepContext, CreepEvent>("idle", creepStates, { role: "harvester", energy: 0 });

      machine.send({ type: "HARVEST", sourceId: "source1" });

      // Store in memory
      memory.creepMachine = serialize(machine);

      expect(memory.creepMachine).toBeDefined();
      expect(memory.creepMachine?.state).toBe("harvesting");

      // Restore from memory
      const restored = restore(memory.creepMachine!, creepStates);

      expect(restored.getState()).toBe("harvesting");
      expect(restored.getContext()).toEqual({
        role: "harvester",
        energy: 0,
        sourceId: "source1"
      });
    });
  });
});
