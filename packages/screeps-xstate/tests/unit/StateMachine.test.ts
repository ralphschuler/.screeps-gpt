import { describe, expect, it, vi } from "vitest";
import { StateMachine } from "../../src/StateMachine.js";
import type { StateConfig } from "../../src/types.js";

describe("StateMachine", () => {
  interface TestContext {
    counter: number;
    flag: boolean;
  }

  type TestEvent = { type: "INCREMENT" } | { type: "DECREMENT" } | { type: "RESET" } | { type: "FLAG" };

  describe("Basic state transitions", () => {
    it("should initialize with the correct state", () => {
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {},
          active: {}
        },
        { counter: 0, flag: false }
      );

      expect(machine.getState()).toBe("idle");
    });

    it("should transition to a new state on valid event", () => {
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {
            on: {
              INCREMENT: { target: "active" }
            }
          },
          active: {}
        },
        { counter: 0, flag: false }
      );

      machine.send({ type: "INCREMENT" });
      expect(machine.getState()).toBe("active");
    });

    it("should remain in same state if event is not defined", () => {
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {},
          active: {}
        },
        { counter: 0, flag: false }
      );

      machine.send({ type: "INCREMENT" });
      expect(machine.getState()).toBe("idle");
    });

    it("should handle multiple transitions", () => {
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
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
        },
        { counter: 0, flag: false }
      );

      machine.send({ type: "INCREMENT" });
      expect(machine.getState()).toBe("active");

      machine.send({ type: "RESET" });
      expect(machine.getState()).toBe("idle");
    });
  });

  describe("Guards", () => {
    it("should allow transition when guard returns true", () => {
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {
            on: {
              INCREMENT: {
                target: "active",
                guard: ctx => ctx.counter < 10
              }
            }
          },
          active: {}
        },
        { counter: 5, flag: false }
      );

      machine.send({ type: "INCREMENT" });
      expect(machine.getState()).toBe("active");
    });

    it("should block transition when guard returns false", () => {
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {
            on: {
              INCREMENT: {
                target: "active",
                guard: ctx => ctx.counter < 10
              }
            }
          },
          active: {}
        },
        { counter: 15, flag: false }
      );

      machine.send({ type: "INCREMENT" });
      expect(machine.getState()).toBe("idle");
    });

    it("should evaluate guard with event data", () => {
      interface EventWithData {
        type: "INCREMENT";
        amount?: number;
      }
      const machine = new StateMachine<TestContext, EventWithData>(
        "idle",
        {
          idle: {
            on: {
              INCREMENT: {
                target: "active",
                guard: (ctx, event) => (event.amount || 0) > 5
              }
            }
          },
          active: {}
        },
        { counter: 0, flag: false }
      );

      machine.send({ type: "INCREMENT", amount: 3 });
      expect(machine.getState()).toBe("idle");

      machine.send({ type: "INCREMENT", amount: 10 });
      expect(machine.getState()).toBe("active");
    });
  });

  describe("Actions", () => {
    it("should execute transition actions", () => {
      const action = vi.fn();
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {
            on: {
              INCREMENT: {
                target: "active",
                actions: [action]
              }
            }
          },
          active: {}
        },
        { counter: 0, flag: false }
      );

      machine.send({ type: "INCREMENT" });
      expect(action).toHaveBeenCalledOnce();
      expect(action).toHaveBeenCalledWith({ counter: 0, flag: false }, { type: "INCREMENT" });
    });

    it("should execute multiple transition actions in order", () => {
      const calls: number[] = [];
      const action1 = vi.fn(() => calls.push(1));
      const action2 = vi.fn(() => calls.push(2));

      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {
            on: {
              INCREMENT: {
                target: "active",
                actions: [action1, action2]
              }
            }
          },
          active: {}
        },
        { counter: 0, flag: false }
      );

      machine.send({ type: "INCREMENT" });
      expect(calls).toEqual([1, 2]);
    });

    it("should execute onEntry actions when entering a state", () => {
      const entryAction = vi.fn();
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {
            on: {
              INCREMENT: { target: "active" }
            }
          },
          active: {
            onEntry: [entryAction]
          }
        },
        { counter: 0, flag: false }
      );

      machine.send({ type: "INCREMENT" });
      expect(entryAction).toHaveBeenCalledOnce();
    });

    it("should execute onExit actions when leaving a state", () => {
      const exitAction = vi.fn();
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {
            onExit: [exitAction],
            on: {
              INCREMENT: { target: "active" }
            }
          },
          active: {}
        },
        { counter: 0, flag: false }
      );

      machine.send({ type: "INCREMENT" });
      expect(exitAction).toHaveBeenCalledOnce();
    });

    it("should execute actions in order: exit -> transition -> entry", () => {
      const calls: string[] = [];
      const exitAction = vi.fn(() => calls.push("exit"));
      const transitionAction = vi.fn(() => calls.push("transition"));
      const entryAction = vi.fn(() => calls.push("entry"));

      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {
            onExit: [exitAction],
            on: {
              INCREMENT: {
                target: "active",
                actions: [transitionAction]
              }
            }
          },
          active: {
            onEntry: [entryAction]
          }
        },
        { counter: 0, flag: false }
      );

      machine.send({ type: "INCREMENT" });
      expect(calls).toEqual(["exit", "transition", "entry"]);
    });

    it("should allow actions to modify context", () => {
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {
            on: {
              INCREMENT: {
                target: "active",
                actions: [
                  ctx => {
                    ctx.counter += 1;
                  }
                ]
              }
            }
          },
          active: {}
        },
        { counter: 0, flag: false }
      );

      expect(machine.getContext().counter).toBe(0);
      machine.send({ type: "INCREMENT" });
      expect(machine.getContext().counter).toBe(1);
    });
  });

  describe("Context management", () => {
    it("should return the current context", () => {
      const initialContext = { counter: 42, flag: true };
      const machine = new StateMachine<TestContext, TestEvent>("idle", { idle: {} }, initialContext);

      expect(machine.getContext()).toBe(initialContext);
    });

    it("should preserve context mutations across transitions", () => {
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
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
          active: {
            on: {
              INCREMENT: {
                target: "idle",
                actions: [
                  ctx => {
                    ctx.counter += 10;
                  }
                ]
              }
            }
          }
        },
        { counter: 0, flag: false }
      );

      machine.send({ type: "INCREMENT" });
      expect(machine.getContext().counter).toBe(5);

      machine.send({ type: "INCREMENT" });
      expect(machine.getContext().counter).toBe(15);
    });
  });

  describe("matches method", () => {
    it("should return true for current state", () => {
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        { idle: {}, active: {} },
        { counter: 0, flag: false }
      );

      expect(machine.matches("idle")).toBe(true);
      expect(machine.matches("active")).toBe(false);
    });

    it("should update after transitions", () => {
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {
            on: {
              INCREMENT: { target: "active" }
            }
          },
          active: {}
        },
        { counter: 0, flag: false }
      );

      expect(machine.matches("idle")).toBe(true);
      machine.send({ type: "INCREMENT" });
      expect(machine.matches("active")).toBe(true);
    });
  });

  describe("reset method", () => {
    it("should reset to initial state", () => {
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {
            on: {
              INCREMENT: { target: "active" }
            }
          },
          active: {}
        },
        { counter: 0, flag: false }
      );

      machine.send({ type: "INCREMENT" });
      expect(machine.getState()).toBe("active");

      machine.reset();
      expect(machine.getState()).toBe("idle");
    });

    it("should not modify context when resetting", () => {
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {
            on: {
              INCREMENT: {
                target: "active",
                actions: [
                  ctx => {
                    ctx.counter = 100;
                  }
                ]
              }
            }
          },
          active: {}
        },
        { counter: 0, flag: false }
      );

      machine.send({ type: "INCREMENT" });
      expect(machine.getContext().counter).toBe(100);

      machine.reset();
      expect(machine.getContext().counter).toBe(100);
    });
  });

  describe("Edge cases", () => {
    it("should handle states with no transitions", () => {
      const machine = new StateMachine<TestContext, TestEvent>(
        "terminal",
        {
          terminal: {}
        },
        { counter: 0, flag: false }
      );

      machine.send({ type: "INCREMENT" });
      expect(machine.getState()).toBe("terminal");
    });

    it("should handle guards that throw errors", () => {
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {
            on: {
              INCREMENT: {
                target: "active",
                guard: () => {
                  throw new Error("Guard error");
                }
              }
            }
          },
          active: {}
        },
        { counter: 0, flag: false }
      );

      expect(() => machine.send({ type: "INCREMENT" })).toThrow("Guard error");
    });

    it("should handle missing target state configuration", () => {
      const machine = new StateMachine<TestContext, TestEvent>(
        "idle",
        {
          idle: {
            on: {
              INCREMENT: { target: "nonexistent" }
            }
          }
        },
        { counter: 0, flag: false }
      );

      // Should not throw, just transition to state without config
      machine.send({ type: "INCREMENT" });
      expect(machine.getState()).toBe("nonexistent");
    });
  });

  describe("Real-world Screeps scenarios", () => {
    interface CreepContext {
      creep: { store: { energy: number }; say: (msg: string) => void };
      sourceId?: string;
      targetId?: string;
    }

    type CreepEvent =
      | { type: "HARVEST"; sourceId: string }
      | { type: "ENERGY_FULL" }
      | { type: "DELIVER"; targetId: string }
      | { type: "ENERGY_EMPTY" };

    it("should handle harvester creep state machine", () => {
      const mockCreep = {
        store: { energy: 0 },
        say: vi.fn()
      };

      const states: Record<string, StateConfig<CreepContext, CreepEvent>> = {
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
          onEntry: [ctx => ctx.creep.say("⛏️ mining")],
          on: {
            ENERGY_FULL: {
              target: "returning",
              guard: ctx => ctx.creep.store.energy >= 50
            }
          }
        },
        returning: {
          on: {
            DELIVER: {
              target: "delivering",
              actions: [
                (ctx, event) => {
                  ctx.targetId = event.targetId;
                }
              ]
            }
          }
        },
        delivering: {
          onEntry: [ctx => ctx.creep.say("📦 delivery")],
          on: {
            ENERGY_EMPTY: {
              target: "idle",
              guard: ctx => ctx.creep.store.energy === 0
            }
          }
        }
      };

      const machine = new StateMachine<CreepContext, CreepEvent>("idle", states, { creep: mockCreep });

      // Start harvesting
      machine.send({ type: "HARVEST", sourceId: "source1" });
      expect(machine.getState()).toBe("harvesting");
      expect(machine.getContext().sourceId).toBe("source1");
      expect(mockCreep.say).toHaveBeenCalledWith("⛏️ mining");

      // Try to transition with insufficient energy (guard fails)
      machine.send({ type: "ENERGY_FULL" });
      expect(machine.getState()).toBe("harvesting");

      // Fill energy and transition
      mockCreep.store.energy = 50;
      machine.send({ type: "ENERGY_FULL" });
      expect(machine.getState()).toBe("returning");

      // Start delivery
      machine.send({ type: "DELIVER", targetId: "spawn1" });
      expect(machine.getState()).toBe("delivering");
      expect(machine.getContext().targetId).toBe("spawn1");
      expect(mockCreep.say).toHaveBeenCalledWith("📦 delivery");

      // Empty energy and return to idle
      mockCreep.store.energy = 0;
      machine.send({ type: "ENERGY_EMPTY" });
      expect(machine.getState()).toBe("idle");
    });
  });
});
