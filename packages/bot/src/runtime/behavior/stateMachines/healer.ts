/**
 * Healer Creep State Machine
 *
 * Manages healer behavior using finite state machine from screeps-xstate.
 * Healers support combat by healing wounded friendly creeps.
 */

import type { StateConfig } from "@ralphschuler/screeps-xstate";

export interface HealerContext {
  creep: Creep;
  targetRoom?: string;
  squadId?: string;
  targetId?: Id<Creep>;
}

export type HealerEvent =
  | { type: "ARRIVED_AT_TARGET" }
  | { type: "HEAL"; targetId: Id<Creep> }
  | { type: "TARGET_HEALED" };

export const healerStates: Record<string, StateConfig<HealerContext, HealerEvent>> = {
  travel: {
    on: {
      ARRIVED_AT_TARGET: {
        target: "heal",
        guard: ctx => !ctx.targetRoom || ctx.creep.room.name === ctx.targetRoom
      }
    }
  },

  heal: {
    on: {
      HEAL: {
        target: "heal",
        actions: [
          (ctx, event) => {
            ctx.targetId = event.targetId;
          }
        ]
      },
      TARGET_HEALED: {
        target: "heal",
        actions: [
          ctx => {
            ctx.targetId = undefined;
          }
        ]
      }
    }
  }
};

export const HEALER_INITIAL_STATE = "travel";
