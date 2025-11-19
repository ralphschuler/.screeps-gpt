import { describe, expect, it, vi } from "vitest";
import { StateMachine } from "../../src/StateMachine.js";
import { mergeStates, createStateFactory, prefixStates, createBridge } from "../../src/helpers/composition.js";

describe("Composition helpers", () => {
  interface TestContext {
    value: number;
    flag: boolean;
  }

  type TestEvent = { type: "START" } | { type: "STOP" } | { type: "TOGGLE" } | { type: "BRIDGE" };

  describe("mergeStates", () => {
    it("should merge non-overlapping states", () => {
      const states1 = {
        idle: {
          on: {
            START: { target: "active" }
          }
        }
      };

      const states2 = {
        active: {
          on: {
            STOP: { target: "idle" }
          }
        }
      };

      const merged = mergeStates<TestContext, TestEvent>(states1, states2);

      expect(merged).toHaveProperty("idle");
      expect(merged).toHaveProperty("active");
      expect(merged.idle.on?.START.target).toBe("active");
      expect(merged.active.on?.STOP.target).toBe("idle");
    });

    it("should merge overlapping states with combined transitions", () => {
      const states1 = {
        idle: {
          on: {
            START: { target: "active" }
          }
        }
      };

      const states2 = {
        idle: {
          on: {
            TOGGLE: { target: "toggled" }
          }
        }
      };

      const merged = mergeStates<TestContext, TestEvent>(states1, states2);

      expect(merged.idle.on?.START).toBeDefined();
      expect(merged.idle.on?.TOGGLE).toBeDefined();
      expect(merged.idle.on?.START.target).toBe("active");
      expect(merged.idle.on?.TOGGLE.target).toBe("toggled");
    });

    it("should merge entry and exit actions", () => {
      const action1 = vi.fn();
      const action2 = vi.fn();

      const states1 = {
        idle: {
          onEntry: [action1]
        }
      };

      const states2 = {
        idle: {
          onEntry: [action2]
        }
      };

      const merged = mergeStates<TestContext, TestEvent>(states1, states2);

      expect(merged.idle.onEntry).toHaveLength(2);
      expect(merged.idle.onEntry).toContain(action1);
      expect(merged.idle.onEntry).toContain(action2);
    });

    it("should handle multiple merges", () => {
      const states1 = { a: { on: { START: { target: "b" } } } };
      const states2 = { b: { on: { STOP: { target: "c" } } } };
      const states3 = { c: { on: { TOGGLE: { target: "a" } } } };

      const merged = mergeStates<TestContext, TestEvent>(states1, states2, states3);

      expect(merged).toHaveProperty("a");
      expect(merged).toHaveProperty("b");
      expect(merged).toHaveProperty("c");
    });

    it("should work with StateMachine", () => {
      const baseStates = {
        idle: {
          on: {
            START: { target: "active" }
          }
        }
      };

      const extendedStates = {
        active: {
          on: {
            STOP: { target: "idle" }
          }
        }
      };

      const merged = mergeStates<TestContext, TestEvent>(baseStates, extendedStates);
      const machine = new StateMachine("idle", merged, { value: 0, flag: false });

      expect(machine.getState()).toBe("idle");
      machine.send({ type: "START" });
      expect(machine.getState()).toBe("active");
      machine.send({ type: "STOP" });
      expect(machine.getState()).toBe("idle");
    });
  });

  describe("createStateFactory", () => {
    it("should create a parameterized state factory", () => {
      const createToggleStates = createStateFactory<TestContext, TestEvent, { initialValue: number }>(
        ({ initialValue }) => ({
          off: {
            onEntry: [ctx => (ctx.value = initialValue)],
            on: {
              TOGGLE: { target: "on" }
            }
          },
          on: {
            onEntry: [ctx => (ctx.value = initialValue * 2)],
            on: {
              TOGGLE: { target: "off" }
            }
          }
        })
      );

      const states = createToggleStates({ initialValue: 10 });
      const machine = new StateMachine("off", states, { value: 0, flag: false });

      // onEntry is not called on construction, only on state transitions
      expect(machine.getContext().value).toBe(0);

      // Trigger a transition to activate onEntry
      machine.send({ type: "TOGGLE" });
      expect(machine.getContext().value).toBe(20);

      // Transition back
      machine.send({ type: "TOGGLE" });
      expect(machine.getContext().value).toBe(10);
    });

    it("should create reusable state patterns", () => {
      const createCounterStates = createStateFactory<TestContext, TestEvent, { increment: number }>(
        ({ increment }) => ({
          idle: {
            on: {
              START: { target: "counting" }
            }
          },
          counting: {
            onEntry: [ctx => (ctx.value += increment)],
            on: {
              STOP: { target: "idle" }
            }
          }
        })
      );

      const fastCounter = createCounterStates({ increment: 10 });
      const slowCounter = createCounterStates({ increment: 1 });

      const machine1 = new StateMachine("idle", fastCounter, { value: 0, flag: false });
      machine1.send({ type: "START" });
      expect(machine1.getContext().value).toBe(10);

      const machine2 = new StateMachine("idle", slowCounter, { value: 0, flag: false });
      machine2.send({ type: "START" });
      expect(machine2.getContext().value).toBe(1);
    });
  });

  describe("prefixStates", () => {
    it("should prefix all state names", () => {
      const states = {
        idle: { on: { START: { target: "active" } } },
        active: { on: { STOP: { target: "idle" } } }
      };

      const prefixed = prefixStates<TestContext, TestEvent>("work_", states);

      expect(prefixed).toHaveProperty("work_idle");
      expect(prefixed).toHaveProperty("work_active");
      expect(prefixed).not.toHaveProperty("idle");
      expect(prefixed).not.toHaveProperty("active");
    });

    it("should update transition targets with prefix", () => {
      const states = {
        idle: { on: { START: { target: "active" } } },
        active: { on: { STOP: { target: "idle" } } }
      };

      const prefixed = prefixStates<TestContext, TestEvent>("work_", states);

      expect(prefixed.work_idle.on?.START.target).toBe("work_active");
      expect(prefixed.work_active.on?.STOP.target).toBe("work_idle");
    });

    it("should preserve external transition targets", () => {
      const states = {
        idle: { on: { START: { target: "active" }, BRIDGE: { target: "external_state" } } },
        active: { on: { STOP: { target: "idle" } } }
      };

      const prefixed = prefixStates<TestContext, TestEvent>("work_", states);

      expect(prefixed.work_idle.on?.START.target).toBe("work_active");
      expect(prefixed.work_idle.on?.BRIDGE.target).toBe("external_state"); // Not prefixed
    });

    it("should work with StateMachine", () => {
      const states = {
        idle: { on: { START: { target: "active" } } },
        active: { on: { STOP: { target: "idle" } } }
      };

      const prefixed = prefixStates<TestContext, TestEvent>("test_", states);
      const machine = new StateMachine("test_idle", prefixed, { value: 0, flag: false });

      expect(machine.getState()).toBe("test_idle");
      machine.send({ type: "START" });
      expect(machine.getState()).toBe("test_active");
    });

    it("should enable namespacing for composed machines", () => {
      const baseStates = {
        idle: { on: { START: { target: "active" } } },
        active: { on: { STOP: { target: "idle" } } }
      };

      const workStates = prefixStates<TestContext, TestEvent>("work_", baseStates);
      const combatStates = prefixStates<TestContext, TestEvent>("combat_", baseStates);

      const merged = mergeStates<TestContext, TestEvent>(workStates, combatStates);

      expect(merged).toHaveProperty("work_idle");
      expect(merged).toHaveProperty("work_active");
      expect(merged).toHaveProperty("combat_idle");
      expect(merged).toHaveProperty("combat_active");
    });
  });

  describe("createBridge", () => {
    it("should create a bridge transition", () => {
      const bridge = createBridge<TestContext, TestEvent>("state_a", "BRIDGE", "state_b");

      expect(bridge).toHaveProperty("state_a");
      expect(bridge.state_a.on?.BRIDGE.target).toBe("state_b");
    });

    it("should support guards in bridges", () => {
      const guard = vi.fn(() => true);
      const bridge = createBridge<TestContext, TestEvent>("state_a", "BRIDGE", "state_b", guard);

      expect(bridge.state_a.on?.BRIDGE.guard).toBe(guard);
    });

    it("should connect separate state machines", () => {
      const workStates = {
        work_idle: { on: { START: { target: "work_active" } } },
        work_active: { on: { STOP: { target: "work_idle" } } }
      };

      const combatStates = {
        combat_idle: { on: { START: { target: "combat_active" } } },
        combat_active: { on: { STOP: { target: "combat_idle" } } }
      };

      const bridge = createBridge<TestContext, TestEvent>("work_idle", "BRIDGE", "combat_active");

      const merged = mergeStates<TestContext, TestEvent>(workStates, combatStates, bridge);
      const machine = new StateMachine("work_idle", merged, { value: 0, flag: false });

      expect(machine.getState()).toBe("work_idle");
      machine.send({ type: "BRIDGE" });
      expect(machine.getState()).toBe("combat_active");
    });
  });

  describe("Real-world composition scenarios", () => {
    it("should compose a complex creep state machine", () => {
      // Create reusable movement states
      const createMovementStates = createStateFactory<TestContext, TestEvent, { targetState: string }>(
        ({ targetState }) => ({
          moving: {
            onEntry: [ctx => (ctx.flag = true)],
            on: {
              STOP: { target: targetState }
            }
          }
        })
      );

      // Create work states
      const workStates = {
        work_idle: {
          on: {
            START: { target: "work_active" }
          }
        },
        work_active: {
          onEntry: [ctx => (ctx.value += 1)],
          on: {
            STOP: { target: "work_idle" }
          }
        }
      };

      // Create movement for work
      const workMovement = prefixStates<TestContext, TestEvent>(
        "work_",
        createMovementStates({ targetState: "active" })
      );

      // Combine everything
      const allStates = mergeStates<TestContext, TestEvent>(workStates, workMovement);
      const machine = new StateMachine("work_idle", allStates, { value: 0, flag: false });

      machine.send({ type: "START" });
      expect(machine.getState()).toBe("work_active");
      expect(machine.getContext().value).toBe(1);
    });

    it("should create role-based state machines with factories", () => {
      const createRoleStates = createStateFactory<TestContext, TestEvent, { role: string; value: number }>(
        ({ role, value }) => ({
          [`${role}_idle`]: {
            onEntry: [ctx => (ctx.value = value)],
            on: {
              START: { target: `${role}_active` }
            }
          },
          [`${role}_active`]: {
            on: {
              STOP: { target: `${role}_idle` }
            }
          }
        })
      );

      const harvesterStates = createRoleStates({ role: "harvester", value: 10 });
      const builderStates = createRoleStates({ role: "builder", value: 20 });

      const merged = mergeStates<TestContext, TestEvent>(harvesterStates, builderStates);

      const harvester = new StateMachine("harvester_idle", merged, { value: 0, flag: false });
      harvester.send({ type: "START" });
      harvester.send({ type: "STOP" });
      expect(harvester.getContext().value).toBe(10);

      const builder = new StateMachine("builder_idle", merged, { value: 0, flag: false });
      builder.send({ type: "START" });
      builder.send({ type: "STOP" });
      expect(builder.getContext().value).toBe(20);
    });
  });
});
