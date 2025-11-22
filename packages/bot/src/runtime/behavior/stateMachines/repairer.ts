/**
 * Repairer Creep State Machine
 *
 * Manages repairer behavior using finite state machine from screeps-xstate.
 * Repairers gather energy and repair damaged structures.
 */

import type { StateConfig } from "@ralphschuler/screeps-xstate";

export interface RepairerContext {
  creep: Creep;
  targetId?: Id<Structure>;
}

export type RepairerEvent =
  | { type: "START_GATHER" }
  | { type: "ENERGY_FULL" }
  | { type: "START_REPAIR"; targetId: Id<Structure> }
  | { type: "ENERGY_EMPTY" };

export const repairerStates: Record<string, StateConfig<RepairerContext, RepairerEvent>> = {
  gather: {
    on: {
      ENERGY_FULL: {
        target: "repair",
        guard: ctx => ctx.creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
      }
    }
  },

  repair: {
    on: {
      START_REPAIR: {
        target: "repair",
        actions: [
          (ctx, event) => {
            if (event.type === "START_REPAIR") {
              ctx.targetId = event.targetId;
            }
          }
        ]
      },
      ENERGY_EMPTY: {
        target: "gather",
        guard: ctx => ctx.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0,
        actions: [
          ctx => {
            ctx.targetId = undefined;
          }
        ]
      }
    }
  }
};

export const REPAIRER_INITIAL_STATE = "gather";
