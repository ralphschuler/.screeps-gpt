/**
 * Harvester Creep State Machine
 *
 * Manages harvester behavior using finite state machine from screeps-xstate.
 * Harvesters collect energy from sources and deliver to spawns/extensions.
 */

import type { StateConfig } from "@ralphschuler/screeps-xstate";

export interface HarvesterContext {
  creep: Creep;
  sourceId?: Id<Source>;
  targetId?: Id<AnyStoreStructure>;
}

export type HarvesterEvent =
  | { type: "START_HARVEST"; sourceId: Id<Source> }
  | { type: "ENERGY_FULL" }
  | { type: "START_DELIVER"; targetId: Id<AnyStoreStructure> }
  | { type: "ENERGY_EMPTY" }
  | { type: "TARGET_FULL" }
  | { type: "SOURCE_DEPLETED" }
  | { type: "START_UPGRADE" };

export const harvesterStates: Record<string, StateConfig<HarvesterContext, HarvesterEvent>> = {
  idle: {
    onEntry: [
      ctx => {
        ctx.sourceId = undefined;
        ctx.targetId = undefined;
      }
    ],
    on: {
      START_HARVEST: {
        target: "harvesting",
        actions: [
          (ctx, event) => {
            if (event.type === "START_HARVEST") {
              ctx.sourceId = event.sourceId;
            }
          }
        ]
      }
    }
  },

  harvesting: {
    on: {
      ENERGY_FULL: {
        target: "delivering",
        guard: ctx => ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
      },
      SOURCE_DEPLETED: {
        target: "idle",
        actions: [
          ctx => {
            ctx.sourceId = undefined;
          }
        ]
      }
    }
  },

  delivering: {
    on: {
      START_DELIVER: {
        target: "delivering",
        actions: [
          (ctx, event) => {
            if (event.type === "START_DELIVER") {
              ctx.targetId = event.targetId;
            }
          }
        ]
      },
      ENERGY_EMPTY: {
        target: "idle",
        guard: ctx => ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0
      },
      TARGET_FULL: {
        target: "upgrading",
        actions: [
          ctx => {
            ctx.targetId = undefined;
          }
        ]
      },
      START_UPGRADE: {
        target: "upgrading",
        actions: [
          ctx => {
            ctx.targetId = undefined;
          }
        ]
      }
    }
  },

  upgrading: {
    on: {
      ENERGY_EMPTY: {
        target: "idle",
        guard: ctx => ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0
      }
    }
  }
};

export const HARVESTER_INITIAL_STATE = "idle";
