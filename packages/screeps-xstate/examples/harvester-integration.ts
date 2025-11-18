/**
 * Example: Harvester Creep State Machine Integration
 *
 * This example demonstrates how to integrate screeps-xstate with the bot runtime
 * to manage harvester creep behavior using a finite state machine.
 */

import { StateMachine, serialize, restore, and, not } from "../src/index.js";
import type { StateConfig } from "../src/types.js";

// Define the context type for our harvester
interface HarvesterContext {
  creep: Creep;
  sourceId?: Id<Source>;
  targetId?: Id<StructureSpawn | StructureExtension>;
}

// Define all possible events for the harvester
type HarvesterEvent =
  | { type: "START_HARVEST"; sourceId: Id<Source> }
  | { type: "ENERGY_FULL" }
  | { type: "START_DELIVER"; targetId: Id<StructureSpawn | StructureExtension> }
  | { type: "ENERGY_EMPTY" }
  | { type: "TARGET_FULL" }
  | { type: "SOURCE_DEPLETED" };

// Define the state machine configuration
const harvesterStates: Record<string, StateConfig<HarvesterContext, HarvesterEvent>> = {
  idle: {
    onEntry: [
      ctx => {
        ctx.creep.say("💤 idle");
      }
    ],
    on: {
      START_HARVEST: {
        target: "moving_to_source",
        actions: [
          (ctx, event) => {
            ctx.sourceId = event.sourceId;
          }
        ]
      }
    }
  },

  moving_to_source: {
    onEntry: [
      ctx => {
        ctx.creep.say("🚶 to source");
      }
    ],
    on: {
      START_HARVEST: {
        target: "harvesting",
        guard: ctx => {
          if (!ctx.sourceId) return false;
          const source = Game.getObjectById(ctx.sourceId);
          return source ? ctx.creep.pos.isNearTo(source) : false;
        }
      }
    }
  },

  harvesting: {
    onEntry: [
      ctx => {
        ctx.creep.say("⛏️ mining");
      }
    ],
    on: {
      ENERGY_FULL: {
        target: "moving_to_spawn",
        guard: ctx => ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
      },
      SOURCE_DEPLETED: {
        target: "idle",
        guard: ctx => {
          if (!ctx.sourceId) return false;
          const source = Game.getObjectById(ctx.sourceId);
          return source ? source.energy === 0 : true;
        }
      }
    }
  },

  moving_to_spawn: {
    onEntry: [
      ctx => {
        ctx.creep.say("🚶 to spawn");
      }
    ],
    on: {
      START_DELIVER: {
        target: "delivering",
        actions: [
          (ctx, event) => {
            ctx.targetId = event.targetId;
          }
        ],
        guard: and(
          (ctx, event) => {
            const target = Game.getObjectById(event.targetId);
            return target ? ctx.creep.pos.isNearTo(target) : false;
          },
          not((ctx, event) => {
            const target = Game.getObjectById(event.targetId);
            return target ? target.store.getFreeCapacity(RESOURCE_ENERGY) === 0 : true;
          })
        )
      },
      TARGET_FULL: {
        target: "idle",
        guard: ctx => {
          // If all spawns/extensions are full, go idle
          const spawns = Object.values(Game.spawns);
          return spawns.every(spawn => spawn.store.getFreeCapacity(RESOURCE_ENERGY) === 0);
        }
      }
    }
  },

  delivering: {
    onEntry: [
      ctx => {
        ctx.creep.say("📦 deliver");
      }
    ],
    on: {
      ENERGY_EMPTY: {
        target: "idle",
        guard: ctx => ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0,
        actions: [
          ctx => {
            ctx.sourceId = undefined;
            ctx.targetId = undefined;
          }
        ]
      },
      TARGET_FULL: {
        target: "idle",
        guard: ctx => {
          if (!ctx.targetId) return false;
          const target = Game.getObjectById(ctx.targetId);
          return target ? target.store.getFreeCapacity(RESOURCE_ENERGY) === 0 : true;
        }
      }
    }
  }
};

/**
 * Manages harvester state machines for all harvester creeps.
 */
export class HarvesterManager {
  private machines: Map<string, StateMachine<HarvesterContext, HarvesterEvent>> = new Map();

  /**
   * Initialize or restore state machines for all harvester creeps.
   */
  public initialize(): void {
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      if (creep.memory.role !== "harvester") continue;

      // Restore from memory or create new machine
      if (creep.memory.stateMachine) {
        const machine = restore<HarvesterContext, HarvesterEvent>(creep.memory.stateMachine, harvesterStates);
        // Update creep reference (it's a new Game object each tick)
        machine.getContext().creep = creep;
        this.machines.set(name, machine);
      } else {
        const machine = new StateMachine<HarvesterContext, HarvesterEvent>("idle", harvesterStates, { creep });
        this.machines.set(name, machine);
      }
    }
  }

  /**
   * Run the harvester state machine logic for all harvesters.
   */
  public run(): void {
    for (const [name, machine] of this.machines) {
      const creep = Game.creeps[name];
      if (!creep) {
        this.machines.delete(name);
        continue;
      }

      const ctx = machine.getContext();

      // Execute behavior based on current state
      if (machine.matches("idle")) {
        // Find nearest source
        const sources = creep.room.find(FIND_SOURCES);
        if (sources.length > 0) {
          const source = creep.pos.findClosestByPath(sources);
          if (source) {
            machine.send({ type: "START_HARVEST", sourceId: source.id });
          }
        }
      } else if (machine.matches("moving_to_source")) {
        if (ctx.sourceId) {
          const source = Game.getObjectById(ctx.sourceId);
          if (source) {
            creep.moveTo(source);
            if (creep.pos.isNearTo(source)) {
              machine.send({ type: "START_HARVEST", sourceId: source.id });
            }
          }
        }
      } else if (machine.matches("harvesting")) {
        if (ctx.sourceId) {
          const source = Game.getObjectById(ctx.sourceId);
          if (source && source.energy > 0) {
            creep.harvest(source);

            // Check if full
            if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
              machine.send({ type: "ENERGY_FULL" });
            }
          } else {
            machine.send({ type: "SOURCE_DEPLETED" });
          }
        }
      } else if (machine.matches("moving_to_spawn")) {
        // Find spawn/extension that needs energy
        const targets = creep.room.find(FIND_MY_STRUCTURES, {
          filter: structure =>
            (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });

        if (targets.length === 0) {
          machine.send({ type: "TARGET_FULL" });
        } else {
          const target = creep.pos.findClosestByPath(targets);
          if (target) {
            creep.moveTo(target);
            if (creep.pos.isNearTo(target)) {
              machine.send({
                type: "START_DELIVER",
                targetId: target.id as Id<StructureSpawn | StructureExtension>
              });
            }
          }
        }
      } else if (machine.matches("delivering")) {
        if (ctx.targetId) {
          const target = Game.getObjectById(ctx.targetId);
          if (target && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            const result = creep.transfer(target, RESOURCE_ENERGY);

            if (result === ERR_NOT_ENOUGH_RESOURCES) {
              machine.send({ type: "ENERGY_EMPTY" });
            }

            // Check if empty
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
              machine.send({ type: "ENERGY_EMPTY" });
            }
          } else {
            machine.send({ type: "TARGET_FULL" });
          }
        }
      }

      // Save state to memory
      creep.memory.stateMachine = serialize(machine);
    }
  }

  /**
   * Clean up state machines for dead creeps.
   */
  public cleanup(): void {
    for (const name of this.machines.keys()) {
      if (!Game.creeps[name]) {
        this.machines.delete(name);
      }
    }
  }
}

// Usage in main game loop:
// const harvesterManager = new HarvesterManager();
//
// export function loop() {
//   harvesterManager.initialize();
//   harvesterManager.run();
//   harvesterManager.cleanup();
// }
